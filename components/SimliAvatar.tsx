"use client"

import { useEffect, useRef, useState } from "react"
import { getRestaurantPrompt, getRestaurantData } from "@/utils/restaurant-data"
import OrderPanel from "./OrderPanel"

const SimliAvatar = () => {
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [orders, setOrders] = useState<Array<{ item: string; quantity: number; price: number }>>([])
  const [clientId] = useState(`client-${Date.now()}`)
  const [menuData, setMenuData] = useState<any>(null)
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [lastBotMessage, setLastBotMessage] = useState("")
  const [debugText, setDebugText] = useState("")
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const conversationHistoryRef = useRef<Array<{ role: string; text: string }>>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const menuDataRef = useRef<any>(null)
  const [messageLog, setMessageLog] = useState<string[]>([])

  // Función mejorada para detectar pedidos con mejor logging y detección
  const detectOrdersInText = (text: string) => {
    if (!menuDataRef.current || !text) return

    console.log("🔍 Analizando texto para pedidos:", text)
    // Añadir al log de mensajes para depuración
    setMessageLog((prev) => [...prev, `Analizando: ${text.substring(0, 50)}...`])

    const textLower = text.toLowerCase()

    // Crear un mapa de nombres de platos normalizados para búsqueda más robusta
    const platosMap = new Map()

    menuDataRef.current.menu.forEach((category: any) => {
      category.platos.forEach((dish: any) => {
        // Normalizar el nombre (quitar acentos, etc.)
        const normalizedName = dish.nombre
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")

        platosMap.set(normalizedName, dish)
        // También guardar el nombre original para búsqueda directa
        platosMap.set(dish.nombre.toLowerCase(), dish)
      })
    })

    // Normalizar el texto de entrada para búsqueda
    const normalizedText = textLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    // Buscar coincidencias de platos en el texto
    for (const [dishName, dish] of platosMap.entries()) {
      if (normalizedText.includes(dishName)) {
        console.log(`✅ Plato detectado: ${dish.nombre}`)
        setMessageLog((prev) => [...prev, `✅ Plato detectado: ${dish.nombre}`])

        // Buscar cantidad
        let quantity = 1

        // Buscar en un contexto más amplio antes del nombre del plato
        const beforeText = normalizedText.substring(
          Math.max(0, normalizedText.indexOf(dishName) - 30),
          normalizedText.indexOf(dishName),
        )

        // Patrones de cantidad más completos
        if (beforeText.match(/\bun[oa]?\b/i)) quantity = 1
        else if (beforeText.match(/\bdos\b/i)) quantity = 2
        else if (beforeText.match(/\btres\b/i)) quantity = 3
        else if (beforeText.match(/\bcuatro\b/i)) quantity = 4
        else if (beforeText.match(/\bcinco\b/i)) quantity = 5

        // Buscar números directamente
        const numberMatch = beforeText.match(/(\d+)\s*$/)
        if (numberMatch) {
          quantity = Number.parseInt(numberMatch[1], 10)
        }

        console.log(`📦 Añadiendo pedido: ${quantity}x ${dish.nombre} a ${dish.precio}€`)
        setMessageLog((prev) => [...prev, `📦 Añadiendo: ${quantity}x ${dish.nombre}`])

        // Añadir el pedido con un pequeño retraso para asegurar que el estado se actualiza
        setTimeout(() => {
          addOrderDirectly(dish.nombre, quantity, dish.precio)
        }, 100)

        // No salir del bucle para detectar múltiples platos en el mismo mensaje
      }
    }
  }

  // Configurar polling mejorado para capturar mensajes
  const setupPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Usar un enfoque más agresivo para capturar mensajes
    pollingIntervalRef.current = setInterval(() => {
      try {
        // Intentar acceder al contenido del iframe (puede fallar por CORS)
        if (iframeRef.current?.contentDocument) {
          // Buscar mensajes en el DOM del iframe
          const messages = Array.from(iframeRef.current.contentDocument.querySelectorAll("*"))
            .filter((el) => el.textContent?.trim().length > 5) // Filtrar mensajes vacíos o muy cortos
            .map((el) => el.textContent?.trim())
            .filter(Boolean)

          // Procesar mensajes encontrados
          messages.forEach((msg) => {
            if (msg && msg.length > 5) {
              console.log("💬 Mensaje encontrado en iframe:", msg)
              detectOrdersInText(msg)
            }
          })
        }
      } catch (error) {
        // Error de CORS - normal, no hacer nada
      }
    }, 100) // Polling más frecuente

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }

  // Procesamiento automático de mensajes cada 3 segundos
  const setupAutoProcessing = () => {
    const autoProcessInterval = setInterval(() => {
      // Procesar tanto el último mensaje del usuario como la respuesta del bot
      if (lastUserMessage) {
        console.log("Auto-procesando mensaje del usuario:", lastUserMessage)
        detectOrdersInText(lastUserMessage)
      }

      if (lastBotMessage) {
        console.log("Auto-procesando respuesta del bot:", lastBotMessage)
        detectOrdersInText(lastBotMessage)
      }
    }, 3000)

    return () => clearInterval(autoProcessInterval)
  }

  const startSimliSession = async () => {
    try {
      console.log("Iniciando sesión en Simli...")
      setIsLoading(true)
      setMessageLog([])

      if (!process.env.NEXT_PUBLIC_SIMLI_API_KEY) {
        throw new Error("NEXT_PUBLIC_SIMLI_API_KEY no está definida")
      }

      // Cargar los datos del menú
      const restaurantData = await getRestaurantData()
      setMenuData(restaurantData)
      menuDataRef.current = restaurantData
      console.log("Datos del restaurante cargados:", restaurantData)
      setMessageLog((prev) => [...prev, "✅ Datos del restaurante cargados"])

      const restaurantPrompt = await getRestaurantPrompt()
      console.log("Prompt del restaurante generado correctamente")

      // Modificar el prompt para que el bot confirme explícitamente los pedidos
      const enhancedPrompt = `
${restaurantPrompt}

INSTRUCCIÓN IMPORTANTE: Cuando un cliente pida un plato, SIEMPRE confirma el pedido explícitamente mencionando el nombre exacto del plato.
Por ejemplo:
- Si el cliente dice "Quiero una tabla de quesos", responde con "Perfecto, una tabla de quesos. ¿Algo más?"
- Si el cliente dice "Tráeme dos cervezas", responde con "Dos cervezas, anotado. ¿Desea algo más?"

Esto es CRÍTICO para el funcionamiento del sistema.
`

      const response = await fetch("https://api.simli.ai/startE2ESession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
          faceId: "13c29695-3b4e-4ee8-b12d-fcab81a50ea5",
          voiceId: "bf5d344d-62b4-4fb8-9073-312bb29c7e4f",
          language: "es",
          systemPrompt: enhancedPrompt,
          maxSessionLength: 3600,
          maxIdleTime: 300,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error detallado de Simli:", errorText)
        throw new Error(`Error Simli API: ${errorText}`)
      }

      const data = await response.json()
      console.log("✅ Respuesta de Simli:", data)
      setMessageLog((prev) => [...prev, "✅ Sesión de Simli iniciada"])

      if (!data.roomUrl) {
        throw new Error("No se recibió una Room URL válida de Simli.")
      }

      // Configurar listener de mensajes
      window.addEventListener("message", (event) => {
        try {
          // Intentar diferentes formatos de mensajes
          if (typeof event.data === "string") {
            // Intentar parsear como JSON
            try {
              const data = JSON.parse(event.data)
              if (data.transcript || data.text || data.message) {
                const userText = data.transcript || data.text || data.message || ""
                console.log("Texto de usuario recibido:", userText)
                setLastUserMessage(userText)
                setMessageLog((prev) => [...prev, `👤 Usuario: ${userText}`])
                detectOrdersInText(userText)
              }
              if (data.response || data.reply || data.answer) {
                const botText = data.response || data.reply || data.answer || ""
                console.log("Texto de bot recibido:", botText)
                setLastBotMessage(botText)
                setMessageLog((prev) => [...prev, `🤖 Bot: ${botText}`])
                detectOrdersInText(botText)
              }
            } catch (e) {
              // Si no es JSON, verificar si contiene texto útil
              if (event.data.length > 10) {
                console.log("Texto plano recibido:", event.data)
                setMessageLog((prev) => [...prev, `📝 Texto: ${event.data.substring(0, 50)}...`])
                detectOrdersInText(event.data)
              }
            }
          } else if (typeof event.data === "object" && event.data !== null) {
            // Procesar objeto directamente
            const data = event.data
            if (data.transcript || data.text || data.message) {
              const userText = data.transcript || data.text || data.message || ""
              console.log("Texto de usuario recibido (objeto):", userText)
              setLastUserMessage(userText)
              setMessageLog((prev) => [...prev, `👤 Usuario (obj): ${userText}`])
              detectOrdersInText(userText)
            }
            if (data.response || data.reply || data.answer) {
              const botText = data.response || data.reply || data.answer || ""
              console.log("Texto de bot recibido (objeto):", botText)
              setLastBotMessage(botText)
              setMessageLog((prev) => [...prev, `🤖 Bot (obj): ${botText}`])
              detectOrdersInText(botText)
            }
          }
        } catch (e) {
          // Ignorar errores de parsing
          console.error("Error procesando mensaje:", e)
        }
      })

      setRoomUrl(data.roomUrl)
      setIsSessionActive(true)
      setIsLoading(false)

      // Iniciar polling y procesamiento automático
      setupPolling()
      setupAutoProcessing()

      // Añadir un plato de prueba para verificar que la comanda funciona
      setTimeout(() => {
        addOrderDirectly("Patatas bravas", 1, 5.5)
        setDebugText("Añadido plato de prueba inicial: Patatas bravas")
        setMessageLog((prev) => [...prev, "✅ Añadido plato de prueba: Patatas bravas"])
      }, 2000)
    } catch (error) {
      console.error("❌ Error al iniciar la sesión de Simli:", error)
      setError(error instanceof Error ? error.message : "Error desconocido")
      setMessageLog((prev) => [...prev, `❌ Error: ${error instanceof Error ? error.message : "Error desconocido"}`])
      setIsLoading(false)
    }
  }

  const endSimliSession = () => {
    setIsSessionActive(false)
    setRoomUrl(null)
    // Guardar la comanda actual (en una aplicación real, esto se enviaría a un servidor)
    console.log("Comanda finalizada:", orders)
    // Limpiar la comanda para el próximo cliente
    setOrders([])
    // Limpiar el historial de conversación
    conversationHistoryRef.current = []
    setMessageLog([])
    console.log("Sesión de Simli finalizada")
  }

  // Función para añadir pedidos directamente - mejorada con más logs
  const addOrderDirectly = (item: string, quantity = 1, price = 0) => {
    console.log(`➕ Añadiendo pedido: ${quantity} x ${item} a ${price}€`)

    // Buscar el precio si no se proporciona
    if (price === 0 && menuDataRef.current) {
      menuDataRef.current.menu.forEach((category: any) => {
        category.platos.forEach((dish: any) => {
          if (dish.nombre.toLowerCase() === item.toLowerCase()) {
            price = dish.precio
          }
        })
      })
    }

    setOrders((prevOrders) => {
      const updatedOrders = [...prevOrders]
      const existingOrderIndex = updatedOrders.findIndex((order) => order.item.toLowerCase() === item.toLowerCase())

      if (existingOrderIndex >= 0) {
        updatedOrders[existingOrderIndex] = {
          ...updatedOrders[existingOrderIndex],
          quantity: updatedOrders[existingOrderIndex].quantity + quantity,
        }
      } else {
        updatedOrders.push({ item, quantity, price })
      }

      console.log("📋 Comanda actualizada:", updatedOrders)
      return updatedOrders
    })
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full h-screen bg-white flex">
      {/* Área principal del avatar */}
      <div className="flex-grow h-full relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-600 text-xl">Cargando avatar...</div>
          </div>
        ) : isSessionActive && roomUrl ? (
          <iframe
            ref={iframeRef}
            src={roomUrl}
            className="w-full h-full"
            allow="camera; microphone; autoplay"
            style={{ border: "none" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {error ? (
              <div className="text-red-500 text-xl">{error}</div>
            ) : (
              <div className="text-gray-600 text-xl">Haz clic en "Pedir" para hablar con la camarera</div>
            )}
          </div>
        )}

        {/* Botones de control - Ambos en la misma posición */}
        {isSessionActive ? (
          <div className="fixed bottom-4 right-96 z-10">
            <button
              onClick={endSimliSession}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg"
            >
              Colgar
            </button>
          </div>
        ) : (
          <div className="fixed bottom-4 right-96 z-10">
            <button
              onClick={startSimliSession}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full shadow-lg"
            >
              Pedir
            </button>
          </div>
        )}
      </div>

      {/* Panel de pedidos */}
      <div className="w-1/4 h-full border-l border-gray-200 flex flex-col">
        <OrderPanel orders={orders} clientId={clientId} />

        {/* Panel de depuración */}
        <div className="h-1/3 border-t border-gray-200 p-2 overflow-auto bg-gray-50">
          <h3 className="text-sm font-bold mb-1">Registro de mensajes:</h3>
          <div className="text-xs">
            {messageLog.map((msg, i) => (
              <div key={i} className="mb-1">
                {msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimliAvatar





//----------------------------------------------------------------------------

// VERSIÓN ULTIMA QUE FUNCIONA 

// "use client"

// import { useEffect, useRef, useState } from "react"

// // Función para limpiar el texto de caracteres especiales
// function cleanText(text: string): string {
//   return text
//     .replace(/[#*_~`]/g, "") // Eliminar caracteres especiales
//     .replace(/\s+/g, " ") // Normalizar espacios
//     .trim()
// }

// const SimliAvatar = () => {
//   const [roomUrl, setRoomUrl] = useState<string | null>(null)
//   const [error, setError] = useState<string | null>(null)
//   const audioRef = useRef<HTMLAudioElement | null>(null)
//   const [isLoading, setIsLoading] = useState(true)

//   const startSimliSession = async () => {
//     try {
//       console.log("Iniciando sesión en Simli...")

//       // Verificar que la API key existe
//       if (!process.env.NEXT_PUBLIC_SIMLI_API_KEY) {
//         throw new Error("NEXT_PUBLIC_SIMLI_API_KEY no está definida")
//       }

//       const response = await fetch("https://api.simli.ai/startE2ESession", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
//           faceId: "13c29695-3b4e-4ee8-b12d-fcab81a50ea5", // Avatar femenino
//           voiceId: "bf5d344d-62b4-4fb8-9073-312bb29c7e4f", // Voz en español
//           language: "es",
//           systemPrompt: "Eres una camarera virtual amable y profesional. Hablas español de España.",
//           maxSessionLength: 3600,
//           maxIdleTime: 300,
//         }),
//       })

//       if (!response.ok) {
//         throw new Error(`Error Simli API: ${await response.text()}`)
//       }

//       const data = await response.json()
//       console.log("✅ Respuesta de Simli:", data)

//       if (!data.roomUrl) {
//         throw new Error("No se recibió una Room URL válida de Simli.")
//       }

//       setRoomUrl(data.roomUrl)
//       return data.roomUrl
//     } catch (error) {
//       console.error("❌ Error al iniciar la sesión de Simli:", error)
//       setError(error instanceof Error ? error.message : "Error desconocido")
//       throw error
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   // Función para hacer que el avatar hable
//   const speak = async (text: string) => {
//     if (!text) return

//     try {
//       // Limpiar el texto antes de enviarlo
//       const cleanedText = cleanText(text)
//       console.log("Texto limpio a reproducir:", cleanedText)

//       const ttsResponse = await fetch("/api/text-to-speech", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           text: cleanedText,
//           voice: "nova", // Mejor voz para español
//           model: "tts-1",
//         }),
//       })

//       if (!ttsResponse.ok) {
//         throw new Error("Error generando audio")
//       }

//       const audioBlob = await ttsResponse.blob()
//       const audioUrl = URL.createObjectURL(audioBlob)

//       if (audioRef.current) {
//         audioRef.current.pause()
//         URL.revokeObjectURL(audioRef.current.src)
//       }

//       const audio = new Audio(audioUrl)
//       audioRef.current = audio
//       await audio.play()
//       console.log("Reproduciendo audio...")

//       audio.onended = () => {
//         URL.revokeObjectURL(audioUrl)
//         audioRef.current = null
//         console.log("Audio finalizado")
//       }
//     } catch (error) {
//       console.error("Error:", error)
//     }
//   }

//   // Verificar que los datos del restaurante se cargan correctamente
//   useEffect(() => {
//     async function testJsonLoading() {
//       try {
//         const response = await fetch("/api/test-json")
//         const data = await response.json()
//         console.log("Test de carga de JSON:", data.success ? "Éxito" : "Fallo")
//         if (!data.success) {
//           console.error("Error en la carga de JSON:", data.error)
//         }
//       } catch (error) {
//         console.error("Error al probar la carga de JSON:", error)
//       }
//     }

//     testJsonLoading()
//   }, [])

//   useEffect(() => {
//     startSimliSession()
//     return () => {
//       if (audioRef.current) {
//         audioRef.current.pause()
//         URL.revokeObjectURL(audioRef.current.src)
//       }
//     }
//   }, [])

//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       ;(window as any).speakWithAvatar = speak
//     }
//     return () => {
//       if (typeof window !== "undefined") {
//         delete (window as any).speakWithAvatar
//       }
//     }
//   }, [])

//   return (
//     <div className="w-full h-screen bg-white">
//       {isLoading ? (
//         <div className="w-full h-full flex items-center justify-center">
//           <div className="text-gray-600 text-xl">Cargando avatar...</div>
//         </div>
//       ) : roomUrl ? (
//         <iframe
//           src={roomUrl}
//           className="w-full h-full"
//           allow="camera; microphone; autoplay"
//           style={{ border: "none" }}
//         />
//       ) : (
//         <div className="w-full h-full flex items-center justify-center">
//           <div className="text-red-500 text-xl">{error || "No se pudo cargar el avatar"}</div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default SimliAvatar

//-----------------------------------------------------------------------------------

// VERSION 1 QUE FUNCIONA

// "use client"

// import { useEffect, useRef, useState } from "react"

// // Función para limpiar el texto de caracteres especiales
// function cleanText(text: string): string {
//   return text
//     .replace(/[#*_~`]/g, "") // Eliminar caracteres especiales
//     .replace(/\s+/g, " ") // Normalizar espacios
//     .trim()
// }

// const SimliAvatar = () => {
//   const [roomUrl, setRoomUrl] = useState<string | null>(null)
//   const [error, setError] = useState<string | null>(null)
//   const audioRef = useRef<HTMLAudioElement | null>(null)

//   const startSimliSession = async () => {
//     try {
//       console.log("Iniciando sesión en Simli...")

//       const response = await fetch("https://api.simli.ai/startE2ESession", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
//           faceId: "13c29695-3b4e-4ee8-b12d-fcab81a50ea5", // Avatar femenino
//           voiceId: "bf5d344d-62b4-4fb8-9073-312bb29c7e4f", // Voz en español
//           language: "es",
//           systemPrompt: "Eres una camarera virtual amable y profesional. Hablas español de España.",
//           maxSessionLength: 3600,
//           maxIdleTime: 300,
//         }),
//       })

//       if (!response.ok) {
//         throw new Error(`Error Simli API: ${await response.text()}`)
//       }

//       const data = await response.json()
//       console.log("✅ Respuesta de Simli:", data)

//       if (!data.roomUrl) {
//         throw new Error("No se recibió una Room URL válida de Simli.")
//       }

//       setRoomUrl(data.roomUrl)
//       return data.roomUrl
//     } catch (error) {
//       console.error("❌ Error al iniciar la sesión de Simli:", error)
//       setError(error instanceof Error ? error.message : "Error desconocido")
//       throw error
//     }
//   }

//   // Función para hacer que el avatar hable
//   const speak = async (text: string) => {
//     if (!text) return

//     try {
//       // Limpiar el texto antes de enviarlo
//       const cleanedText = cleanText(text)
//       console.log("Texto limpio a reproducir:", cleanedText)

//       const ttsResponse = await fetch("/api/text-to-speech", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           text: cleanedText,
//           voice: "alloy", // Voz más natural para español
//           model: "tts-1",
//           language: "es",
//         }),
//       })

//       if (!ttsResponse.ok) {
//         throw new Error("Error generando audio")
//       }

//       const audioBlob = await ttsResponse.blob()
//       const audioUrl = URL.createObjectURL(audioBlob)

//       if (audioRef.current) {
//         audioRef.current.pause()
//         URL.revokeObjectURL(audioRef.current.src)
//       }

//       const audio = new Audio(audioUrl)
//       audioRef.current = audio
//       await audio.play()

//       audio.onended = () => {
//         URL.revokeObjectURL(audioUrl)
//         audioRef.current = null
//       }
//     } catch (error) {
//       console.error("Error:", error)
//     }
//   }

//   useEffect(() => {
//     startSimliSession()
//     return () => {
//       if (audioRef.current) {
//         audioRef.current.pause()
//         URL.revokeObjectURL(audioRef.current.src)
//       }
//     }
//   }, [])

//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       ;(window as any).speakWithAvatar = speak
//     }
//     return () => {
//       if (typeof window !== "undefined") {
//         delete (window as any).speakWithAvatar
//       }
//     }
//   }, [])

//   return (
//     <div className="w-full h-screen bg-white">
//       {roomUrl ? (
//         <iframe
//           src={roomUrl}
//           className="w-full h-full"
//           allow="camera; microphone; autoplay"
//           style={{ border: "none" }}
//         />
//       ) : (
//         <div className="w-full h-full flex items-center justify-center">
//           {error ? (
//             <div className="text-red-500 text-xl">{error}</div>
//           ) : (
//             <div className="text-gray-600 text-xl">Cargando avatar...</div>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }

// export default SimliAvatar
