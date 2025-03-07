import { type NextRequest, NextResponse } from "next/server"

// ADVERTENCIA: Incluir API keys en el código es un riesgo de seguridad
// Solo para desarrollo, nunca para producción
const OPENAI_API_KEY = "" // Reemplaza esto con tu API key real

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Usar la API de OpenAI directamente
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: (() => {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("model", "whisper-1")
        return formData
      })(),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error("Error transcribing audio:", error)
    return NextResponse.json(
      { error: "Failed to transcribe audio: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

