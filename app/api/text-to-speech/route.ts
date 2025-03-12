import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Función para limpiar el texto
function cleanText(text: string): string {
  if (!text) return ""

  return (
    text
      // Eliminar formatos markdown
      .replace(/\*\*(.*?)\*\*/g, "$1") // Negrita
      .replace(/\*(.*?)\*/g, "$1") // Cursiva
      .replace(/__(.*?)__/g, "$1") // Subrayado
      .replace(/_(.*?)_/g, "$1") // Cursiva alternativa
      .replace(/~~(.*?)~~/g, "$1") // Tachado
      .replace(/`(.*?)`/g, "$1") // Código
      .replace(/```(.*?)```/g, "$1") // Bloque de código
      .replace(/\[(.*?)\]$$(.*?)$$/g, "$1") // Enlaces

      // Eliminar caracteres especiales sueltos
      .replace(/[*_~`#]/g, "")

      // Normalizar espacios
      .replace(/\s+/g, " ")
      .trim()
  )
}

// Asegurarnos de que la función de text-to-speech aplique correctamente la limpieza de texto

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Se requiere el texto para la síntesis" }, { status: 400 })
    }

    // Limpiar el texto
    const cleanedText = cleanText(text)
    console.log("Texto original:", text)
    console.log("Texto limpio para TTS:", cleanedText)

    // Crear el audio con OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy", // Alloy suena más natural para español
      input: cleanedText,
      speed: 1.1, // Ligeramente más rápido para sonar más natural
    })

    // Convertir el stream a ArrayBuffer
    const buffer = await mp3.arrayBuffer()

    // Devolver el audio como respuesta
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Error en text-to-speech:", error)
    return NextResponse.json({ error: "Error generando el audio" }, { status: 500 })
  }
}

// ------------------------------------------------------------------

// VERSIÓN 2 QUE FUNCIONA

// import { NextResponse } from "next/server"
// import OpenAI from "openai"

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })

// // Función para limpiar el texto
// function cleanText(text: string): string {
//   return text
//     .replace(/[#*_~`]/g, "") // Eliminar caracteres especiales
//     .replace(/\s+/g, " ") // Normalizar espacios
//     .trim()
// }

// export async function POST(request: Request) {
//   try {
//     const { text, voice = "nova", model = "tts-1" } = await request.json()

//     if (!text) {
//       return NextResponse.json({ error: "Se requiere el texto para la síntesis" }, { status: 400 })
//     }

//     // Limpiar el texto
//     const cleanedText = cleanText(text)
//     console.log("Generando audio para:", cleanedText)

//     // Mejorar la pronunciación en español usando SSML
//     const ssmlText = `<speak>
//       <lang xml:lang="es-ES">
//         ${cleanedText}
//       </lang>
//     </speak>`

//     const mp3 = await openai.audio.speech.create({
//       model: model,
//       voice: voice, // Nova funciona mejor para español
//       input: ssmlText,
//       speed: 1.0, // Ligeramente más lento para mejor pronunciación
//     })

//     // Convertir el stream a ArrayBuffer
//     const buffer = await mp3.arrayBuffer()

//     // Devolver el audio como respuesta
//     return new NextResponse(buffer, {
//       headers: {
//         "Content-Type": "audio/mpeg",
//         "Content-Length": buffer.byteLength.toString(),
//       },
//     })
//   } catch (error) {
//     console.error("Error en text-to-speech:", error)

//     // Si el error es por SSML, intentar sin SSML
//     if (error instanceof Error && error.message.includes("SSML")) {
//       try {
//         const { text, voice = "nova", model = "tts-1" } = await request.json()
//         const cleanedText = cleanText(text)

//         console.log("Reintentando sin SSML:", cleanedText)

//         const mp3 = await openai.audio.speech.create({
//           model: model,
//           voice: voice,
//           input: cleanedText,
//           speed: 1.0,
//         })

//         const buffer = await mp3.arrayBuffer()

//         return new NextResponse(buffer, {
//           headers: {
//             "Content-Type": "audio/mpeg",
//             "Content-Length": buffer.byteLength.toString(),
//           },
//         })
//       } catch (fallbackError) {
//         console.error("Error en fallback:", fallbackError)
//         return NextResponse.json({ error: "Error generando el audio (fallback)" }, { status: 500 })
//       }
//     }

//     return NextResponse.json({ error: "Error generando el audio" }, { status: 500 })
//   }
// }

// ------------------------------------------------------------------

// VERSIÓN 1 QUE FUNCIONA
// import { NextResponse } from "next/server"
// import OpenAI from "openai"

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })

// export async function POST(request: Request) {
//   try {
//     const { text, voice = "alloy", model = "tts-1" } = await request.json()

//     if (!text) {
//       return NextResponse.json({ error: "Se requiere el texto para la síntesis" }, { status: 400 })
//     }

//     // Limpiar el texto antes de enviarlo a OpenAI
//     const cleanedText = text
//       .replace(/[#*_~`]/g, "")
//       .replace(/\s+/g, " ")
//       .trim()

//     const mp3 = await openai.audio.speech.create({
//       model: model,
//       voice: voice,
//       input: cleanedText,
//       speed: 1.0,
//     })

//     // Convertir el stream a ArrayBuffer
//     const buffer = await mp3.arrayBuffer()

//     // Devolver el audio como respuesta
//     return new NextResponse(buffer, {
//       headers: {
//         "Content-Type": "audio/mpeg",
//         "Content-Length": buffer.byteLength.toString(),
//       },
//     })
//   } catch (error) {
//     console.error("Error en text-to-speech:", error)
//     return NextResponse.json({ error: "Error generando el audio" }, { status: 500 })
//   }
// }