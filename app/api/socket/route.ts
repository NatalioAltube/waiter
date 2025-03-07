import { type NextRequest, NextResponse } from "next/server"

// Configuración para OpenAI
const OPENAI_API_KEY =
  ""

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Mapa para almacenar las conexiones activas
const activeConnections = new Map()
let connectionId = 0

export async function GET(req: NextRequest) {
  const id = connectionId++
  const encoder = new TextEncoder()

  // Crear un TransformStream para enviar eventos al cliente
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Almacenar la conexión
  activeConnections.set(id, writer)

  // Enviar un evento inicial
  const initialEvent = {
    event: "connected",
    data: { id, message: "Conexión establecida" },
  }
  writer.write(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`))

  // Eliminar la conexión cuando se cierre
  req.signal.addEventListener("abort", () => {
    activeConnections.delete(id)
    writer.close()
  })

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json()

    if (action === "transcribe") {
      // Procesar la transcripción
      const audioBlob = data.audio
      const formData = new FormData()
      formData.append("file", audioBlob)
      formData.append("model", "whisper-1")

      // Llamar a la API de OpenAI para transcribir
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Error en la transcripción")
      }

      const transcriptionData = await response.json()

      // Enviar la transcripción a todos los clientes
      broadcastToAll({
        event: "transcription",
        data: { text: transcriptionData.text },
      })

      // Procesar con el LLM
      processWithLLM(transcriptionData.text)

      return NextResponse.json({ success: true })
    } else if (action === "interrupt") {
      // Manejar interrupción
      broadcastToAll({
        event: "interrupted",
        data: { message: "Respuesta interrumpida" },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    console.error("Error en la solicitud:", error)
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 })
  }
}

// Función para enviar un evento a todos los clientes conectados
function broadcastToAll(eventData: any) {
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify(eventData)}\n\n`

  for (const writer of activeConnections.values()) {
    writer.write(encoder.encode(message)).catch(() => {
      // Ignorar errores de escritura (conexiones cerradas)
    })
  }
}

// Función para procesar el texto con el LLM y enviar la respuesta
async function processWithLLM(text: string) {
  try {
    // Llamar a la API de OpenAI para generar respuesta
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for waiters in a restaurant. 
            Provide concise, practical responses about taking orders, handling customer requests, 
            menu recommendations, and restaurant procedures. Be polite and professional.
            Keep responses brief and to the point, as if speaking in a busy restaurant environment.`,
          },
          { role: "user", content: text },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error("Error en la generación de respuesta")
    }

    // Procesar la respuesta en streaming
    const reader = response.body?.getReader()
    let responseText = ""

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decodificar y procesar los chunks
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split("\n").filter((line) => line.trim() !== "")

        for (const line of lines) {
          if (line.includes("[DONE]")) continue
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6))
              if (data.choices && data.choices[0].delta.content) {
                const textChunk = data.choices[0].delta.content
                responseText += textChunk

                // Enviar el chunk de texto a todos los clientes
                broadcastToAll({
                  event: "response_chunk",
                  data: { text: textChunk },
                })
              }
            } catch (e) {
              // Ignorar errores de parsing JSON
            }
          }
        }
      }

      // Convertir a voz y enviar
      await textToSpeech(responseText)
    }
  } catch (error) {
    console.error("Error en el procesamiento con LLM:", error)
    broadcastToAll({
      event: "error",
      data: { message: "Error en la generación de respuesta" },
    })
  }
}

// Función para convertir texto a voz
async function textToSpeech(text: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "alloy",
      }),
    })

    if (!response.ok) {
      throw new Error("Error en la conversión de texto a voz")
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")

    // Enviar el audio a todos los clientes
    broadcastToAll({
      event: "audio_response",
      data: { audio: audioBase64 },
    })
  } catch (error) {
    console.error("Error en la conversión de texto a voz:", error)
    broadcastToAll({
      event: "error",
      data: { message: "Error en la conversión de texto a voz" },
    })
  }
}

