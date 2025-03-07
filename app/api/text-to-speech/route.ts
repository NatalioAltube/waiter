import { type NextRequest, NextResponse } from "next/server"

// ADVERTENCIA: Incluir API keys en el código es un riesgo de seguridad
// Solo para desarrollo, nunca para producción
const OPENAI_API_KEY = "" // Reemplaza esto con tu API key real

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 })
    }

    // Usar la API de OpenAI directamente
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
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`)
    }

    const audioData = await response.arrayBuffer()

    return new NextResponse(audioData, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    console.error("Error generating speech:", error)
    return NextResponse.json(
      { error: "Failed to generate speech: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

