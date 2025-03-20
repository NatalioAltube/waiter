import { type NextRequest, NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

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
    
    // Responder con texto para que el cliente lo procese
    return NextResponse.json({ text: data.text })

  } catch (error) {
    console.error("Error transcribing audio:", error)
    return NextResponse.json(
      { error: "Failed to transcribe audio: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}


// import { type NextRequest, NextResponse } from "next/server"

// // ADVERTENCIA: Incluir API keys en el código es un riesgo de seguridad
// // Solo para desarrollo, nunca para producción
// //const OPENAI_API_KEY = "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" // Reemplaza esto con tu API key real

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// console.log(OPENAI_API_KEY);

// export async function POST(req: NextRequest) {
//   try {
//     const formData = await req.formData()
//     const file = formData.get("file") as File

//     if (!file) {
//       return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
//     }

//     // Usar la API de OpenAI directamente
//     const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${OPENAI_API_KEY}`,
//       },
//       body: (() => {
//         const formData = new FormData()
//         formData.append("file", file)
//         formData.append("model", "whisper-1")
//         return formData
//       })(),
//     })

//     if (!response.ok) {
//       const errorData = await response.json()
//       throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`)
//     }

//     const data = await response.json()
//     return NextResponse.json({ text: data.text })
//   } catch (error) {
//     console.error("Error transcribing audio:", error)
//     return NextResponse.json(
//       { error: "Failed to transcribe audio: " + (error instanceof Error ? error.message : String(error)) },
//       { status: 500 },
//     )
//   }
// }

