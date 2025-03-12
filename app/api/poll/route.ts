import { NextResponse } from "next/server"
import { getRestaurantPrompt } from "@/utils/restaurant-data"

// Mapa para almacenar los mensajes de cada cliente
const clientMessagesMap = new Map<string, any[]>()

// Mapa para almacenar el estado de procesamiento de cada cliente
const clientProcessingState = new Map<
  string,
  {
    isProcessing: boolean
    conversationHistory: { role: string; content: string }[]
    currentResponseId: string | null
  }
>()

// Función para limpiar el texto de caracteres especiales
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

// Asegurarnos de que la función processWithLLM aplique correctamente la limpieza de texto
// y use los datos del restaurante

// Modificar la función processWithLLM para asegurar que:
// 1. Se obtiene correctamente el prompt con los datos del restaurante
// 2. Se limpia adecuadamente la respuesta del LLM

async function processWithLLM(clientId: string, text: string) {
  const clientState = clientProcessingState.get(clientId)
  if (!clientState) return

  try {
    console.log(`Procesando mensaje para cliente ${clientId}: "${text}"`)

    // Obtener el prompt con los datos del restaurante
    const systemPrompt = getRestaurantPrompt()
    console.log("Prompt del restaurante generado correctamente")
    console.log("Primeras 100 caracteres del prompt:", systemPrompt.substring(0, 100))

    // Verificar que el prompt contiene datos del restaurante
    if (!systemPrompt.includes("La Parrilla Española")) {
      console.error("ERROR: El prompt no contiene los datos del restaurante")
    } else {
      console.log("✅ El prompt contiene los datos del restaurante")
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          ...clientState.conversationHistory,
          { role: "user", content: text },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Error en la respuesta de OpenAI:", errorText)
      throw new Error(`Error OpenAI: ${response.status}`)
    }

    const data = await response.json()
    let responseText = data.choices[0]?.message?.content

    // Limpiar el texto de respuesta - asegurarnos de que se aplica correctamente
    if (responseText) {
      console.log(`Respuesta original: "${responseText}"`)
      responseText = cleanText(responseText)
      console.log(`Respuesta limpia: "${responseText}"`)

      clientState.conversationHistory.push(
        { role: "user", content: text },
        { role: "assistant", content: responseText },
      )

      const clientMessages = clientMessagesMap.get(clientId) || []
      clientMessages.push({
        type: "speak",
        text: responseText,
        timestamp: Date.now(),
      })
      clientMessagesMap.set(clientId, clientMessages)
    }
  } catch (error) {
    console.error("Error procesando mensaje:", error)

    // Añadir mensaje de error para el cliente
    const clientMessages = clientMessagesMap.get(clientId) || []
    clientMessages.push({
      type: "error",
      text: "Lo siento, ha ocurrido un error al procesar tu solicitud.",
      timestamp: Date.now(),
    })
    clientMessagesMap.set(clientId, clientMessages)
  } finally {
    clientState.isProcessing = false
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("clientId")
  const lastTimestamp = Number.parseInt(searchParams.get("lastTimestamp") || "0")

  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
  }

  const messages = clientMessagesMap.get(clientId) || []
  const newMessages = messages.filter((msg) => msg.timestamp > lastTimestamp)

  return NextResponse.json({
    messages: newMessages,
    timestamp: newMessages.length > 0 ? Math.max(...newMessages.map((msg) => msg.timestamp)) : lastTimestamp,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, action, text } = body

    if (!clientId) {
      return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
    }

    // Inicializar estado del cliente si no existe
    if (!clientProcessingState.has(clientId)) {
      clientProcessingState.set(clientId, {
        isProcessing: false,
        conversationHistory: [],
        currentResponseId: null,
      })
    }

    const clientState = clientProcessingState.get(clientId)!

    if (action === "transcribe" && text) {
      if (!clientState.isProcessing) {
        clientState.isProcessing = true
        // Procesar de forma asíncrona
        processWithLLM(clientId, text)
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json({
          success: false,
          error: "Ya hay un procesamiento en curso",
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en POST:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
      },
      { status: 500 },
    )
  }
}



//-----------------------------------------------------------------

// VERSIÓN 2 QUE FUNCIONA 

// import { NextResponse } from "next/server"
// import { getRestaurantPrompt } from "@/utils/restaurant-data"

// // Mapa para almacenar los mensajes de cada cliente
// const clientMessagesMap = new Map<string, any[]>()

// // Mapa para almacenar el estado de procesamiento de cada cliente
// const clientProcessingState = new Map<
//   string,
//   {
//     isProcessing: boolean
//     conversationHistory: { role: string; content: string }[]
//     currentResponseId: string | null
//   }
// >()

// // Función para limpiar el texto de caracteres especiales
// function cleanText(text: string): string {
//   return text
//     .replace(/[#*_~`]/g, "") // Eliminar caracteres especiales
//     .replace(/\s+/g, " ") // Normalizar espacios
//     .trim()
// }

// async function processWithLLM(clientId: string, text: string) {
//   const clientState = clientProcessingState.get(clientId)
//   if (!clientState) return

//   try {
//     console.log(`Procesando mensaje para cliente ${clientId}: "${text}"`)

//     // Obtener el prompt con los datos del restaurante
//     const systemPrompt = getRestaurantPrompt()
//     console.log("Prompt del restaurante generado correctamente")

//     const response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4",
//         messages: [
//           { role: "system", content: systemPrompt },
//           ...clientState.conversationHistory,
//           { role: "user", content: text },
//         ],
//         max_tokens: 150,
//         temperature: 0.7,
//       }),
//     })

//     if (!response.ok) {
//       const errorText = await response.text()
//       console.error("Error en la respuesta de OpenAI:", errorText)
//       throw new Error(`Error OpenAI: ${response.status}`)
//     }

//     const data = await response.json()
//     let responseText = data.choices[0]?.message?.content

//     // Limpiar el texto de respuesta
//     if (responseText) {
//       responseText = cleanText(responseText)
//       console.log(`Respuesta generada: "${responseText}"`)

//       clientState.conversationHistory.push(
//         { role: "user", content: text },
//         { role: "assistant", content: responseText },
//       )

//       const clientMessages = clientMessagesMap.get(clientId) || []
//       clientMessages.push({
//         type: "speak",
//         text: responseText,
//         timestamp: Date.now(),
//       })
//       clientMessagesMap.set(clientId, clientMessages)
//     }
//   } catch (error) {
//     console.error("Error procesando mensaje:", error)

//     // Añadir mensaje de error para el cliente
//     const clientMessages = clientMessagesMap.get(clientId) || []
//     clientMessages.push({
//       type: "error",
//       text: "Lo siento, ha ocurrido un error al procesar tu solicitud.",
//       timestamp: Date.now(),
//     })
//     clientMessagesMap.set(clientId, clientMessages)
//   } finally {
//     clientState.isProcessing = false
//   }
// }

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url)
//   const clientId = searchParams.get("clientId")
//   const lastTimestamp = Number.parseInt(searchParams.get("lastTimestamp") || "0")

//   if (!clientId) {
//     return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
//   }

//   const messages = clientMessagesMap.get(clientId) || []
//   const newMessages = messages.filter((msg) => msg.timestamp > lastTimestamp)

//   return NextResponse.json({
//     messages: newMessages,
//     timestamp: newMessages.length > 0 ? Math.max(...newMessages.map((msg) => msg.timestamp)) : lastTimestamp,
//   })
// }

// export async function POST(request: Request) {
//   try {
//     const body = await request.json()
//     const { clientId, action, text } = body

//     if (!clientId) {
//       return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
//     }

//     // Inicializar estado del cliente si no existe
//     if (!clientProcessingState.has(clientId)) {
//       clientProcessingState.set(clientId, {
//         isProcessing: false,
//         conversationHistory: [],
//         currentResponseId: null,
//       })
//     }

//     const clientState = clientProcessingState.get(clientId)!

//     if (action === "transcribe" && text) {
//       if (!clientState.isProcessing) {
//         clientState.isProcessing = true
//         // Procesar de forma asíncrona
//         processWithLLM(clientId, text)
//         return NextResponse.json({ success: true })
//       } else {
//         return NextResponse.json({
//           success: false,
//           error: "Ya hay un procesamiento en curso",
//         })
//       }
//     }

//     return NextResponse.json({ success: true })
//   } catch (error) {
//     console.error("Error en POST:", error)
//     return NextResponse.json(
//       {
//         success: false,
//         error: "Error interno del servidor",
//       },
//       { status: 500 },
//     )
//   }
// }

//-----------------------------------------------------------------

// VERSIÓN 1 QUE FUNCIONA 

// import { NextResponse } from "next/server"
// import { getRestaurantPrompt } from "@/utils/restaurant-data"

// // Mapa para almacenar los mensajes de cada cliente
// const clientMessagesMap = new Map<string, any[]>()

// // Mapa para almacenar el estado de procesamiento de cada cliente
// const clientProcessingState = new Map<
//   string,
//   {
//     isProcessing: boolean
//     conversationHistory: { role: string; content: string }[]
//     currentResponseId: string | null
//   }
// >()

// // Función para limpiar el texto de caracteres especiales
// function cleanText(text: string): string {
//   return text
//     .replace(/[#*_~`]/g, "") // Eliminar caracteres especiales
//     .replace(/\s+/g, " ") // Normalizar espacios
//     .trim()
// }

// async function processWithLLM(clientId: string, text: string) {
//   const clientState = clientProcessingState.get(clientId)
//   if (!clientState) return

//   try {
//     console.log(`Procesando mensaje para cliente ${clientId}: "${text}"`)

//     // Obtener el prompt con los datos del restaurante
//     const systemPrompt = getRestaurantPrompt()
//     console.log("Prompt del restaurante generado correctamente")

//     const response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4",
//         messages: [
//           { role: "system", content: systemPrompt },
//           ...clientState.conversationHistory,
//           { role: "user", content: text },
//         ],
//         max_tokens: 150,
//         temperature: 0.7,
//       }),
//     })

//     if (!response.ok) {
//       throw new Error(`Error OpenAI: ${await response.text()}`)
//     }

//     const data = await response.json()
//     let responseText = data.choices[0]?.message?.content

//     // Limpiar el texto de respuesta
//     if (responseText) {
//       responseText = cleanText(responseText)
//       console.log(`Respuesta generada: "${responseText}"`)

//       clientState.conversationHistory.push(
//         { role: "user", content: text },
//         { role: "assistant", content: responseText },
//       )

//       const clientMessages = clientMessagesMap.get(clientId) || []
//       clientMessages.push({
//         type: "speak",
//         text: responseText,
//         timestamp: Date.now(),
//       })
//       clientMessagesMap.set(clientId, clientMessages)
//     }
//   } catch (error) {
//     console.error("Error procesando mensaje:", error)
//   } finally {
//     clientState.isProcessing = false
//   }
// }

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url)
//   const clientId = searchParams.get("clientId")
//   const lastTimestamp = Number.parseInt(searchParams.get("lastTimestamp") || "0")

//   if (!clientId) {
//     return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
//   }

//   const messages = clientMessagesMap.get(clientId) || []
//   const newMessages = messages.filter((msg) => msg.timestamp > lastTimestamp)

//   return NextResponse.json({
//     messages: newMessages,
//     timestamp: newMessages.length > 0 ? Math.max(...newMessages.map((msg) => msg.timestamp)) : lastTimestamp,
//   })
// }

// export async function POST(request: Request) {
//   try {
//     const body = await request.json()
//     const { clientId, action, text } = body

//     if (!clientId) {
//       return NextResponse.json({ error: "clientId es requerido" }, { status: 400 })
//     }

//     // Inicializar estado del cliente si no existe
//     if (!clientProcessingState.has(clientId)) {
//       clientProcessingState.set(clientId, {
//         isProcessing: false,
//         conversationHistory: [],
//         currentResponseId: null,
//       })
//     }

//     const clientState = clientProcessingState.get(clientId)!

//     if (action === "transcribe" && text) {
//       if (!clientState.isProcessing) {
//         clientState.isProcessing = true
//         processWithLLM(clientId, text)
//         return NextResponse.json({ success: true })
//       }
//     }

//     return NextResponse.json({ success: true })
//   } catch (error) {
//     console.error("Error en POST:", error)
//     return NextResponse.json(
//       {
//         success: false,
//         error: "Error interno del servidor",
//       },
//       { status: 500 },
//     )
//   }
// }