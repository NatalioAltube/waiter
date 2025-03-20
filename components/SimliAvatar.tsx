// ULTIMA VERSION QUE FUNCIONA 17/03
//----------------------------------------------------------------
"use client"

import { useEffect, useRef, useState } from "react"
import { getRestaurantPrompt, getRestaurantData } from "@/utils/restaurant-data"
import OrderPanel from "@/components/OrderPanel"

const SimliAvatar = () => {
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [orders, setOrders] = useState<Array<{ item: string; quantity: number; price: number }>>([])
  // Usar una cadena estática para el ID inicial y actualizarla en el cliente
  const [clientId, setClientId] = useState("client-pending")
  const [menuData, setMenuData] = useState<any>(null)
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [lastBotMessage, setLastBotMessage] = useState("")
  const [debugText, setDebugText] = useState("")
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoProcessIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const conversationHistoryRef = useRef<Array<{ role: string; text: string }>>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const menuDataRef = useRef<any>(null)
  const [messageLog, setMessageLog] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const [windowMessageListenerSetup, setWindowMessageListenerSetup] = useState(false)

const processTranscribedAudio = async (audioFile: File) => {
  try {
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", "whisper-1");
    formData.append("language", "es"); // 🔥 Forzar idioma español

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    let transcribedText = data.text.trim();

    // 🚨 Antes filtrábamos frases cortas o irrelevantes, ahora las procesamos todas
    if (!transcribedText) {
      console.warn("⚠️ Transcripción vacía, ignorada.");
      return;
    }

    console.log("✅ Texto transcrito:", transcribedText);

    // 🔥 Ahora enviamos TODO el texto para que `detectOrdersInText()` haga la validación
    detectOrdersInText(transcribedText);

  } catch (error) {
    console.error("Error procesando audio transcrito:", error);
  }
};

// 🎙️ Capturar audio y enviarlo a transcribir de forma continua
const captureAudioAndTranscribe = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 44100,
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);

    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const audioChunks: Blob[] = [];

    const detectSound = () => {
      const buffer = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buffer);
      const volume = buffer.reduce((acc, val) => acc + Math.abs(val - 128), 0) / buffer.length;
      return volume > 10;
    };



  const waitForSpeech = () =>
      new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (detectSound()) {
            console.log("🔴 Voz detectada, comenzando la grabación...");
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

    console.log("🟢 Esperando a que comiences a hablar...");
    await waitForSpeech();

    mediaRecorder.start();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioFile = new File([audioBlob], "audio.webm");

      console.log("🎙️ Audio capturado, enviando a transcripción...");
      await processTranscribedAudio(audioFile);

      // 🔄 Reiniciar la captura para permitir múltiples pedidos
      captureAudioAndTranscribe();
    };

    // Detener grabación si hay silencio prolongado
    setTimeout(() => {
      console.log("🛑 Silencio detectado, deteniendo grabación...");
      mediaRecorder.stop();
      audioContext.close();
    }, 5000);

  } catch (error) {
    console.error("Error capturando audio:", error);
  }
};

  // 🔹 Crear referencias para la grabación de audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Generar el ID del cliente solo en el lado del cliente
  useEffect(() => {
    setIsClient(true);
    setClientId(`client-${Date.now()}`); 
  }, []);

  // Verificar que el menú está cargado correctamente
  useEffect(() => {
    console.log("📋 Datos del menú cargados:", menuDataRef.current)
  }, [menuDataRef.current])

  // Verificar el estado final de la comanda
  useEffect(() => {
    console.log("✅ Estado final de la comanda:", orders)
  }, [orders])

  useEffect(() => {
    if (!isSessionActive) {
      console.log("🛑 Sesión finalizada. Deteniendo grabación paralela...");
  
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
  
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }, [isSessionActive]);

  // Función para normalizar texto de manera más efectiva
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
      .replace(/[.,;:!?]/g, " ") // Elimina signos de puntuación
      .replace(/\s+/g, " ") // Reemplaza múltiples espacios por uno solo
      .trim();

  const updateOrder = (itemName: string, quantity: number, price: number) => {
    setOrders((prevOrders) => {
        let updated = false;
        const updatedOrders = prevOrders.map((order) => {
            if (order.item === itemName) {
                updated = true;
                return { ...order, quantity }; // Modificar cantidad
            }
            return order;
        });

        if (!updated) {
            updatedOrders.push({ item: itemName, quantity, price });
        }

        console.log(`🛠 Pedido actualizado: ${itemName}, Cantidad: ${quantity}, Precio: ${price}`);
        return updatedOrders;
    });
};

//   const removeOrder = (itemName: string) => {
//     setOrders((prevOrders) => {
//         const updatedOrders = prevOrders.filter(order => order.item !== itemName);

//         console.log(`🗑 Pedido eliminado: ${itemName}`);
//         return updatedOrders;
//     });
//   };

//   const addOrder = (itemName: string, quantity = 1, price = 0) => {
//     setOrders((prevOrders) => {
//         const updatedOrders = [...prevOrders];
//         const existingOrderIndex = updatedOrders.findIndex((order) => order.item.toLowerCase() === itemName.toLowerCase());

//         if (existingOrderIndex >= 0) {
//             updatedOrders[existingOrderIndex] = {
//                 ...updatedOrders[existingOrderIndex],
//                 quantity: updatedOrders[existingOrderIndex].quantity + quantity,
//             };
//             console.log("🔄 Pedido actualizado:", updatedOrders[existingOrderIndex]);
//         } else {
//             updatedOrders.push({ item: itemName, quantity, price });
//             console.log("➕ Nuevo pedido añadido:", { item: itemName, quantity, price });
//         }

//         return updatedOrders;
//     });
// };


  // 📌 Detectar platos en el texto transcrito
  const detectOrdersInText = (text: string) => {
    if (!menuDataRef.current || !text) {
        console.warn("🚨 Menú vacío o texto sin contenido.");
        return;
    }

    console.log("🔍 Analizando texto para pedidos:", text);
    const normalizedText = normalizeText(text);
    console.log("✅ Texto normalizado:", normalizedText);

    const platosMap = new Map();

    // 📌 Crear un mapa dinámico de platos desde el menú
    menuDataRef.current.menu.forEach((category: any) => {
        category.platos.forEach((dish: any) => {
            const normalizedName = normalizeText(dish.nombre);
            platosMap.set(normalizedName, dish);
        });
    });

    let found = false;
    let correctionMode = false;
    let possibleIncompleteRequest = false;

    // 📌 Detectar correcciones como "No, en realidad quiero..."
    if (/no |en realidad |me equivoqué/i.test(normalizedText)) {
        console.log("🔄 Corrección de pedido detectada.");
        correctionMode = true;
    }

    const detectedPlates = new Set(); // Para evitar duplicados

    for (const [dishName, dish] of platosMap.entries()) {
        if (
            normalizedText.includes(dishName) ||
            levenshtein(normalizedText, dishName) <= 2
        ) {
            if (detectedPlates.has(dish.nombre)) {
                console.log(`⚠️ Plato "${dish.nombre}" ya detectado, evitando duplicado.`);
                continue;
            }

            found = true;
            detectedPlates.add(dish.nombre);

            console.log(`✅ Plato detectado: ${dishName}`);

            let quantity = 1;
            const beforeText = normalizedText.substring(
                Math.max(0, normalizedText.indexOf(dishName) - 50),
                normalizedText.indexOf(dishName)
            );

            const numberMatch = beforeText.match(/(\d+)\s*$/);
            if (numberMatch) {
                quantity = Number.parseInt(numberMatch[1], 10);
            }

            // 📌 Si la frase se corta ("quiero un chuletón de..."), esperar más información
            if (/\bde\b$/.test(normalizedText)) {
                console.warn("⚠️ Pedido parece incompleto, esperando más información...");
                possibleIncompleteRequest = true;
                break;
            }

            if (correctionMode) {
                console.log(
                    `🔄 Corrección detectada: Actualizando ${dish.nombre} a ${quantity}.`
                );
                updateOrder(dish.nombre, quantity, dish.precio);
            } else {
                console.log(
                    `📦 Añadiendo pedido: ${quantity}x ${dish.nombre} a ${dish.precio}€`
                );
                addOrderDirectly(dish.nombre, quantity, dish.precio);
            }
        }
    }

    if (!found && !possibleIncompleteRequest) {
        console.warn("❌ No se detectó ningún plato en el texto.");
    }
};


  const levenshtein = (a: string, b: string): number => {
    const tmp = Array(b.length + 1)
      .fill(0)
      .map((_, i) => i);
    let last, val;
  
    for (let i = 0; i < a.length; i++) {
      last = i + 1;
      for (let j = 0; j < b.length; j++) {
        val = tmp[j];
        tmp[j] = last = a[i] === b[j] ? val : Math.min(val, last, tmp[j + 1]) + 1;
      }
    }
  
    return tmp[b.length];
  };

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
              detectFormattedOrders(msg)
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
    if (autoProcessIntervalRef.current) {
      clearInterval(autoProcessIntervalRef.current)
    }

    autoProcessIntervalRef.current = setInterval(() => {
      // Procesar tanto el último mensaje del usuario como la respuesta del bot
      if (lastUserMessage) {
        console.log("Auto-procesando mensaje del usuario:", lastUserMessage)
        detectOrdersInText(lastUserMessage)
        detectFormattedOrders(lastUserMessage)
      }

      if (lastBotMessage) {
        console.log("Auto-procesando respuesta del bot:", lastBotMessage)
        detectOrdersInText(lastBotMessage)
        detectFormattedOrders(lastBotMessage)
      }
    }, 3000)

    return () => {
      if (autoProcessIntervalRef.current) {
        clearInterval(autoProcessIntervalRef.current)
      }
    }
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
- Agrega todos los pedidos que el usuario te pida, a la comanda, y suma los precios en la sección de comanda
- No digas los precios a menos que el cliente te los pida
INSTRUCCIÓN SOBRE PRECIOS: Cuando menciones precios, SIEMPRE usa el formato español con el símbolo del euro después del número y la coma como separador decimal.
Por ejemplo:
- "El chuletón de buey cuesta 24.00€"
- "Las patatas bravas cuestan 5.50€"
- "El total de su pedido es 29.50€"
- NUNCA digas "twenty-four euros" o "five point five euros"
- SIEMPRE di "veinticuatro euros" o "cinco euros con cincuenta céntimos"

Esto es CRÍTICO para el funcionamiento del sistema.
`

      const response = await fetch("https://api.simli.ai/startE2ESession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
          faceId: "bec78a8e-8bc2-4b51-bfc0-fd6ce5b30548", //13c29695-3b4e-4ee8-b12d-fcab81a50ea5
          voiceId: "5c29d7e3-a133-4c7e-804a-1d9c6dea83f6", //a956b555-5c82-404f-9580-243b5178978d
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

      // Mejorar la configuración del listener de mensajes
      if (!windowMessageListenerSetup) {
        // Función para procesar mensajes
        const processMessage = (text: string, source: string) => {
          console.log(`💬 Mensaje de ${source}:`, text)
          setMessageLog((prev) => [...prev, `${source}: ${text.substring(0, 50)}...`])

          // Procesar el mensaje para detectar pedidos
          detectOrdersInText(text)
          detectFormattedOrders(text)

          // Actualizar el último mensaje según la fuente
          if (source === "Usuario") {
            setLastUserMessage(text)
          } else if (source === "Bot") {
            setLastBotMessage(text)
          }
        }

        // Handler para mensajes de window
        const handleWindowMessage = (event: MessageEvent) => {
          try {
            // Intentar diferentes formatos de mensajes
            if (typeof event.data === "string") {
              // Intentar parsear como JSON
              try {
                const data = JSON.parse(event.data)
                if (data.transcript || data.text || data.message) {
                  const userText = data.transcript || data.text || data.message || ""
                  processMessage(userText, "Usuario")
                }
                if (data.response || data.reply || data.answer) {
                  const botText = data.response || data.reply || data.answer || ""
                  processMessage(botText, "Bot")
                }
              } catch (e) {
                // Si no es JSON, verificar si contiene texto útil
                if (event.data.length > 10) {
                  processMessage(event.data, "Desconocido")
                }
              }
            } else if (typeof event.data === "object" && event.data !== null) {
              // Procesar objeto directamente
              const data = event.data
              if (data.transcript || data.text || data.message) {
                const userText = data.transcript || data.text || data.message || ""
                processMessage(userText, "Usuario")
              }
              if (data.response || data.reply || data.answer) {
                const botText = data.response || data.reply || data.answer || ""
                processMessage(botText, "Bot")
              }
            }
          } catch (e) {
            // Ignorar errores de parsing
            console.error("Error procesando mensaje:", e)
          }
        }

        // Añadir listener
        window.addEventListener("message", handleWindowMessage)

        // Limpiar al desmontar
        window.addEventListener("beforeunload", () => {
          window.removeEventListener("message", handleWindowMessage)
        })
        setWindowMessageListenerSetup(true)
      }

      setRoomUrl(data.roomUrl)
      setIsSessionActive(true)
      setIsLoading(false)

      // ✅ Iniciar la captura de audio para transcribir y conectar con la comanda
      captureAudioAndTranscribe();

      // Iniciar polling y procesamiento automático
      setupPolling()
      setupAutoProcessing()
    } catch (error) {
      console.error("❌ Error al iniciar la sesión de Simli:", error)
      setError(error instanceof Error ? error.message : "Error desconocido")
      setMessageLog((prev) => [...prev, `❌ Error: ${error instanceof Error ? error.message : "Error desconocido"}`])
      setIsLoading(false)
    }
  }

  const endSimliSession = () => {
    console.log("🔴 Finalizando sesión de Simli...");
    
    setIsSessionActive(false);
    setRoomUrl(null);

    console.log("📋 Comanda finalizada:", orders);
    setOrders([]); // Resetear la comanda

    conversationHistoryRef.current = [];
    setMessageLog([]);

    // 🚨 🔴 Asegurar que se detiene la grabación paralela
    if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== "inactive") {
            console.log("🛑 Deteniendo grabación paralela...");
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
    }

    // 🚨 🔴 Detener y limpiar el stream de audio
    if (audioStreamRef.current) {
        console.log("🔇 Cerrando stream de audio...");
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
    }

    if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
    }
    if (autoProcessIntervalRef.current) {
        clearInterval(autoProcessIntervalRef.current);
    }

    console.log("✅ Sesión de Simli finalizada y grabación detenida.");
};

  // Función para añadir pedidos directamente - mejorada con más logs
  const addOrderDirectly = (item: string, quantity = 1, price = 0) => {
    console.log(`🛒 Añadiendo pedido: ${item}, Cantidad: ${quantity}, Precio: ${price}`)

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
        console.log("🔄 Pedido actualizado:", updatedOrders[existingOrderIndex])
      } else {
        updatedOrders.push({ item, quantity, price })
        console.log("➕ Nuevo pedido añadido:", { item, quantity, price })
      }

      console.log("📋 Comanda final:", updatedOrders)
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

      if (autoProcessIntervalRef.current) {
        clearInterval(autoProcessIntervalRef.current)
      }
    }
  }, []);

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
              <div className="text-gray-600 text-xl">
                Haz clic en "Pedir" para hablar con la camarera
              </div>
            )}
          </div>
        )}
  
        {/* Botón de control - Movido apenas más a la derecha */}
        {isSessionActive ? (
          <div className="fixed bottom-4 left-[60%] z-10"> {/* 🔄 Ajustado más a la derecha */}
            <button
              onClick={endSimliSession}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-6 px-10 rounded-full shadow-lg"
            >
              Colgar
            </button>
          </div>
        ) : (
          <div className="fixed bottom-4 left-[60%] z-10"> {/* 🔄 Ajustado más a la derecha */}
            <button
              onClick={startSimliSession}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-6 px-10 rounded-full shadow-lg"
            >
              Pedir
            </button>
          </div>
        )}
      </div>
  
      {/* Panel de pedidos */}
      <div className="w-1/4 h-full border-l border-gray-200 flex flex-col">
        {isClient ? (
          <>
            <div className="h-[85%] flex flex-col"> {/* 🔼 Subimos un poco el contenido */}
              <OrderPanel orders={orders} clientId={clientId} />
            </div>
  
            {/* Contenedor para QR y Logo - Alineados correctamente */}
            <div className="flex justify-between items-center px-4 py-4 border-t border-gray-200">
              {/* Código QR */}
              <img src="/menu_QR.jpg" alt="Código QR" className="w-40 h-40 object-contain" onError={(e) => console.error("❌ Error cargando QR:", e)} />
  
              {/* Logo de la empresa - Más grande pero manteniendo proporción */}
              <img src="/1.jpg" alt="Logo Empresa" className="w-46 h-46 object-contain" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-400">Cargando panel de pedidos...</div>
          </div>
        )}
      </div>
    </div>
  )}
    

export default SimliAvatar

// //----------------------------------------------------------------

// // ULTIMA VERSION QUE FUNCIONA 17/03
// //----------------------------------------------------------------
// "use client"

// import { useEffect, useRef, useState } from "react"
// import { getRestaurantPrompt, getRestaurantData } from "@/utils/restaurant-data"
// import OrderPanel from "@/components/OrderPanel"

// const SimliAvatar = () => {
//   const [roomUrl, setRoomUrl] = useState<string | null>(null)
//   const [error, setError] = useState<string | null>(null)
//   const audioRef = useRef<HTMLAudioElement | null>(null)
//   const [isLoading, setIsLoading] = useState(true)
//   const [isSessionActive, setIsSessionActive] = useState(false)
//   const [orders, setOrders] = useState<Array<{ item: string; quantity: number; price: number }>>([])
//   // Usar una cadena estática para el ID inicial y actualizarla en el cliente
//   const [clientId, setClientId] = useState("client-pending")
//   const [menuData, setMenuData] = useState<any>(null)
//   const [lastUserMessage, setLastUserMessage] = useState("")
//   const [lastBotMessage, setLastBotMessage] = useState("")
//   const [debugText, setDebugText] = useState("")
//   const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const autoProcessIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const conversationHistoryRef = useRef<Array<{ role: string; text: string }>>([])
//   const iframeRef = useRef<HTMLIFrameElement>(null)
//   const menuDataRef = useRef<any>(null)
//   const [messageLog, setMessageLog] = useState<string[]>([])
//   const [isClient, setIsClient] = useState(false)
//   const [windowMessageListenerSetup, setWindowMessageListenerSetup] = useState(false)

//   // Generar el ID del cliente solo en el lado del cliente
//   useEffect(() => {
//     setIsClient(true)
//     setClientId(`client-${Date.now()}`)
//   }, [])

//   // Verificar que el menú está cargado correctamente
//   useEffect(() => {
//     console.log("📋 Datos del menú cargados:", menuDataRef.current)
//   }, [menuDataRef.current])

//   // Verificar el estado final de la comanda
//   useEffect(() => {
//     console.log("✅ Estado final de la comanda:", orders)
//   }, [orders])

//   // Función para normalizar texto de manera más efectiva
//   const normalizeText = (text: string) =>
//     text
//       .toLowerCase()
//       .normalize("NFD")
//       .replace(/[\u0300-\u036f]/g, "")
//       .replace(/[.,;:!?]/g, " ")
//       .replace(/\s+/g, " ")
//       .trim()

//   // Mejorar la función detectOrdersInText para que sea más efectiva
//   const detectOrdersInText = (text: string) => {
//     if (!menuDataRef.current || !text) {
//       console.warn("🚨 Menu data o texto vacío en detectOrdersInText")
//       return
//     }

//     console.log("🔍 Analizando texto para pedidos:", text)
//     // Añadir al log de mensajes para depuración
//     setMessageLog((prev) => [...prev, `Analizando: ${text.substring(0, 50)}...`])

//     // Normalizar el texto para búsqueda
//     const normalizedText = normalizeText(text)

//     // Crear un mapa de nombres de platos normalizados para búsqueda más robusta
//     const platosMap = new Map()

//     menuDataRef.current.menu.forEach((category: any) => {
//       category.platos.forEach((dish: any) => {
//         // Normalizar el nombre (quitar acentos, etc.)
//         const normalizedName = normalizeText(dish.nombre)
//         platosMap.set(normalizedName, dish)

//         // También guardar el nombre original para búsqueda directa
//         platosMap.set(dish.nombre.toLowerCase(), dish)

//         // Añadir versiones parciales del nombre para mejorar la detección
//         const words = normalizedName.split(" ")
//         if (words.length > 1) {
//           // Si el nombre tiene múltiples palabras, añadir la primera palabra significativa
//           const significantWords = words.filter((w) => !["el", "la", "los", "las", "de", "del"].includes(w))
//           if (significantWords.length > 0) {
//             platosMap.set(significantWords[0], dish)
//           }
//         }
//       })
//     })

//     // Buscar coincidencias de platos en el texto
//     for (const [dishName, dish] of platosMap.entries()) {
//       // Usar una búsqueda más flexible
//       if (normalizedText.includes(dishName)) {
//         console.log(`✅ Plato detectado: ${dishName} - Dish: ${JSON.stringify(dish)}`)
//         setMessageLog((prev) => [...prev, `✅ Plato detectado: ${dish.nombre}`])

//         // Buscar cantidad
//         let quantity = 1

//         // Buscar en un contexto más amplio antes del nombre del plato
//         const beforeText = normalizedText.substring(
//           Math.max(0, normalizedText.indexOf(dishName) - 50),
//           normalizedText.indexOf(dishName),
//         )

//         // Patrones de cantidad más completos
//         if (beforeText.match(/\bun[oa]?\b/i)) quantity = 1
//         else if (beforeText.match(/\bdos\b/i)) quantity = 2
//         else if (beforeText.match(/\btres\b/i)) quantity = 3
//         else if (beforeText.match(/\bcuatro\b/i)) quantity = 4
//         else if (beforeText.match(/\bcinco\b/i)) quantity = 5

//         // Buscar números directamente
//         const numberMatch = beforeText.match(/(\d+)\s*$/)
//         if (numberMatch) {
//           quantity = Number.parseInt(numberMatch[1], 10)
//         }

//         console.log(`📦 Añadiendo pedido: ${quantity}x ${dish.nombre} a ${dish.precio}€`)
//         setMessageLog((prev) => [...prev, `📦 Añadiendo: ${quantity}x ${dish.nombre}`])

//         // Añadir el pedido con un pequeño retraso para asegurar que se procese correctamente
//         setTimeout(() => {
//           addOrderDirectly(dish.nombre, quantity, dish.precio)
//         }, 100)
//       }
//     }
//   }

//   // Mejorar la función detectFormattedOrders para que sea más flexible
//   const detectFormattedOrders = (text: string) => {
//     if (!text) {
//       console.warn("🚨 Texto vacío en detectFormattedOrders")
//       return
//     }

//     console.log("🔍 Buscando pedidos formateados en:", text)

//     // Buscar patrones de "PEDIDO: [nombre del plato], cantidad [número]"
//     const orderRegex = /PEDIDO:\s*([^,]+),\s*cantidad\s*(\d+)/gi
//     let match

//     while ((match = orderRegex.exec(text)) !== null) {
//       const dishName = match[1].trim()
//       const quantity = Number.parseInt(match[2], 10)

//       console.log(`🎯 Pedido detectado en formato específico: ${quantity}x ${dishName}`)
//       setMessageLog((prev) => [...prev, `🎯 Pedido detectado: ${quantity}x ${dishName}`])

//       // Buscar el plato en el menú para obtener el precio
//       let price = 0
//       let foundDish = null

//       if (menuDataRef.current) {
//         menuDataRef.current.menu.forEach((category: any) => {
//           category.platos.forEach((dish: any) => {
//             // Comparación flexible para encontrar coincidencias aproximadas
//             if (
//               dish.nombre.toLowerCase().includes(dishName.toLowerCase()) ||
//               dishName.toLowerCase().includes(dish.nombre.toLowerCase())
//             ) {
//               price = dish.precio
//               foundDish = dish
//               console.log(`💰 Precio encontrado para ${dishName}: ${price}€`)
//             }
//           })
//         })
//       }

//       // Añadir el pedido con el nombre exacto del menú si se encontró
//       setTimeout(() => {
//         addOrderDirectly(foundDish ? foundDish.nombre : dishName, quantity, price)
//       }, 100)
//     }

//     // Buscar también patrones más simples como "He añadido [cantidad] [plato]"
//     const simpleOrderRegex = /(he añadido|añad[oi]|anoté|anotado|pedido)\s+(\d+)\s+([a-zá-úñ\s]+)/gi
//     while ((match = simpleOrderRegex.exec(text)) !== null) {
//       const quantity = Number.parseInt(match[2], 10)
//       const dishName = match[3].trim()

//       console.log(`🍽️ Pedido simple detectado: ${quantity}x ${dishName}`)
//       setMessageLog((prev) => [...prev, `🍽️ Pedido simple: ${quantity}x ${dishName}`])

//       // Buscar el plato en el menú
//       let price = 0
//       let foundDish = null

//       if (menuDataRef.current) {
//         menuDataRef.current.menu.forEach((category: any) => {
//           category.platos.forEach((dish: any) => {
//             const dishLower = dish.nombre.toLowerCase()
//             const searchLower = dishName.toLowerCase()

//             if (dishLower.includes(searchLower) || searchLower.includes(dishLower)) {
//               price = dish.precio
//               foundDish = dish
//             }
//           })
//         })
//       }

//       // Añadir el pedido
//       setTimeout(() => {
//         addOrderDirectly(foundDish ? foundDish.nombre : dishName, quantity, price)
//       }, 100)
//     }
//   }

//   // Configurar polling mejorado para capturar mensajes
//   const setupPolling = () => {
//     if (pollingIntervalRef.current) {
//       clearInterval(pollingIntervalRef.current)
//     }

//     // Usar un enfoque más agresivo para capturar mensajes
//     pollingIntervalRef.current = setInterval(() => {
//       try {
//         // Intentar acceder al contenido del iframe (puede fallar por CORS)
//         if (iframeRef.current?.contentDocument) {
//           // Buscar mensajes en el DOM del iframe
//           const messages = Array.from(iframeRef.current.contentDocument.querySelectorAll("*"))
//             .filter((el) => el.textContent?.trim().length > 5) // Filtrar mensajes vacíos o muy cortos
//             .map((el) => el.textContent?.trim())
//             .filter(Boolean)

//           // Procesar mensajes encontrados
//           messages.forEach((msg) => {
//             if (msg && msg.length > 5) {
//               console.log("💬 Mensaje encontrado en iframe:", msg)
//               detectOrdersInText(msg)
//               detectFormattedOrders(msg)
//             }
//           })
//         }
//       } catch (error) {
//         // Error de CORS - normal, no hacer nada
//       }
//     }, 100) // Polling más frecuente

//     return () => {
//       if (pollingIntervalRef.current) {
//         clearInterval(pollingIntervalRef.current)
//       }
//     }
//   }

//   // Procesamiento automático de mensajes cada 3 segundos
//   const setupAutoProcessing = () => {
//     if (autoProcessIntervalRef.current) {
//       clearInterval(autoProcessIntervalRef.current)
//     }

//     autoProcessIntervalRef.current = setInterval(() => {
//       // Procesar tanto el último mensaje del usuario como la respuesta del bot
//       if (lastUserMessage) {
//         console.log("Auto-procesando mensaje del usuario:", lastUserMessage)
//         detectOrdersInText(lastUserMessage)
//         detectFormattedOrders(lastUserMessage)
//       }

//       if (lastBotMessage) {
//         console.log("Auto-procesando respuesta del bot:", lastBotMessage)
//         detectOrdersInText(lastBotMessage)
//         detectFormattedOrders(lastBotMessage)
//       }
//     }, 3000)

//     return () => {
//       if (autoProcessIntervalRef.current) {
//         clearInterval(autoProcessIntervalRef.current)
//       }
//     }
//   }

//   const startSimliSession = async () => {
//     try {
//       console.log("Iniciando sesión en Simli...")
//       setIsLoading(true)
//       setMessageLog([])

//       if (!process.env.NEXT_PUBLIC_SIMLI_API_KEY) {
//         throw new Error("NEXT_PUBLIC_SIMLI_API_KEY no está definida")
//       }

//       // Cargar los datos del menú
//       const restaurantData = await getRestaurantData()
//       setMenuData(restaurantData)
//       menuDataRef.current = restaurantData
//       console.log("Datos del restaurante cargados:", restaurantData)
//       setMessageLog((prev) => [...prev, "✅ Datos del restaurante cargados"])

//       const restaurantPrompt = await getRestaurantPrompt()
//       console.log("Prompt del restaurante generado correctamente")

//       // Modificar el prompt para que el bot confirme explícitamente los pedidos
//       const enhancedPrompt = `
// ${restaurantPrompt}

// INSTRUCCIÓN IMPORTANTE: Cuando un cliente pida un plato, SIEMPRE confirma el pedido explícitamente mencionando el nombre exacto del plato.
// Por ejemplo:
// - Si el cliente dice "Quiero una tabla de quesos", responde con "Perfecto, una tabla de quesos. ¿Algo más?"
// - Si el cliente dice "Tráeme dos cervezas", responde con "Dos cervezas, anotado. ¿Desea algo más?"
// - Agrega todos los pedidos que el usuario te pida, a la comanda, y suma los precios en la sección de comanda

// INSTRUCCIÓN SOBRE PRECIOS: Cuando menciones precios, SIEMPRE usa el formato español con el símbolo del euro después del número y la coma como separador decimal.
// Por ejemplo:
// - "El chuletón de buey cuesta 24,00€"
// - "Las patatas bravas cuestan 5,50€"
// - "El total de su pedido es 29,50€"
// - NUNCA digas "twenty-four euros" o "five point five euros"
// - SIEMPRE di "veinticuatro euros" o "cinco euros con cincuenta céntimos"

// Esto es CRÍTICO para el funcionamiento del sistema.
// `

//       const response = await fetch("https://api.simli.ai/startE2ESession", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
//           faceId: "13c29695-3b4e-4ee8-b12d-fcab81a50ea5",
//           voiceId: "a956b555-5c82-404f-9580-243b5178978d",
//           language: "es",
//           systemPrompt: enhancedPrompt,
//           maxSessionLength: 3600,
//           maxIdleTime: 300,
//         }),
//       })

//       if (!response.ok) {
//         const errorText = await response.text()
//         console.error("Error detallado de Simli:", errorText)
//         throw new Error(`Error Simli API: ${errorText}`)
//       }

//       const data = await response.json()
//       console.log("✅ Respuesta de Simli:", data)
//       setMessageLog((prev) => [...prev, "✅ Sesión de Simli iniciada"])

//       if (!data.roomUrl) {
//         throw new Error("No se recibió una Room URL válida de Simli.")
//       }

//       // Mejorar la configuración del listener de mensajes
//       if (!windowMessageListenerSetup) {
//         // Función para procesar mensajes
//         const processMessage = (text: string, source: string) => {
//           console.log(`💬 Mensaje de ${source}:`, text)
//           setMessageLog((prev) => [...prev, `${source}: ${text.substring(0, 50)}...`])

//           // Procesar el mensaje para detectar pedidos
//           detectOrdersInText(text)
//           detectFormattedOrders(text)

//           // Actualizar el último mensaje según la fuente
//           if (source === "Usuario") {
//             setLastUserMessage(text)
//           } else if (source === "Bot") {
//             setLastBotMessage(text)
//           }
//         }

//         // Handler para mensajes de window
//         const handleWindowMessage = (event: MessageEvent) => {
//           try {
//             // Intentar diferentes formatos de mensajes
//             if (typeof event.data === "string") {
//               // Intentar parsear como JSON
//               try {
//                 const data = JSON.parse(event.data)
//                 if (data.transcript || data.text || data.message) {
//                   const userText = data.transcript || data.text || data.message || ""
//                   processMessage(userText, "Usuario")
//                 }
//                 if (data.response || data.reply || data.answer) {
//                   const botText = data.response || data.reply || data.answer || ""
//                   processMessage(botText, "Bot")
//                 }
//               } catch (e) {
//                 // Si no es JSON, verificar si contiene texto útil
//                 if (event.data.length > 10) {
//                   processMessage(event.data, "Desconocido")
//                 }
//               }
//             } else if (typeof event.data === "object" && event.data !== null) {
//               // Procesar objeto directamente
//               const data = event.data
//               if (data.transcript || data.text || data.message) {
//                 const userText = data.transcript || data.text || data.message || ""
//                 processMessage(userText, "Usuario")
//               }
//               if (data.response || data.reply || data.answer) {
//                 const botText = data.response || data.reply || data.answer || ""
//                 processMessage(botText, "Bot")
//               }
//             }
//           } catch (e) {
//             // Ignorar errores de parsing
//             console.error("Error procesando mensaje:", e)
//           }
//         }

//         // Añadir listener
//         window.addEventListener("message", handleWindowMessage)

//         // Limpiar al desmontar
//         window.addEventListener("beforeunload", () => {
//           window.removeEventListener("message", handleWindowMessage)
//         })
//         setWindowMessageListenerSetup(true)
//       }

//       setRoomUrl(data.roomUrl)
//       setIsSessionActive(true)
//       setIsLoading(false)

//       // Iniciar polling y procesamiento automático
//       setupPolling()
//       setupAutoProcessing()
//     } catch (error) {
//       console.error("❌ Error al iniciar la sesión de Simli:", error)
//       setError(error instanceof Error ? error.message : "Error desconocido")
//       setMessageLog((prev) => [...prev, `❌ Error: ${error instanceof Error ? error.message : "Error desconocido"}`])
//       setIsLoading(false)
//     }
//   }

//   const endSimliSession = () => {
//     setIsSessionActive(false)
//     setRoomUrl(null)
//     // Guardar la comanda actual (en una aplicación real, esto se enviaría a un servidor)
//     console.log("Comanda finalizada:", orders)
//     // Limpiar la comanda para el próximo cliente
//     setOrders([])
//     // Limpiar el historial de conversación
//     conversationHistoryRef.current = []
//     setMessageLog([])

//     // Limpiar intervalos
//     if (pollingIntervalRef.current) {
//       clearInterval(pollingIntervalRef.current)
//     }
//     if (autoProcessIntervalRef.current) {
//       clearInterval(autoProcessIntervalRef.current)
//     }

//     console.log("Sesión de Simli finalizada")
//   }

//   // Función para añadir pedidos directamente - mejorada con más logs
//   const addOrderDirectly = (item: string, quantity = 1, price = 0) => {
//     console.log(`🛒 Añadiendo pedido: ${item}, Cantidad: ${quantity}, Precio: ${price}`)

//     // Buscar el precio si no se proporciona
//     if (price === 0 && menuDataRef.current) {
//       menuDataRef.current.menu.forEach((category: any) => {
//         category.platos.forEach((dish: any) => {
//           if (dish.nombre.toLowerCase() === item.toLowerCase()) {
//             price = dish.precio
//           }
//         })
//       })
//     }

//     setOrders((prevOrders) => {
//       const updatedOrders = [...prevOrders]
//       const existingOrderIndex = updatedOrders.findIndex((order) => order.item.toLowerCase() === item.toLowerCase())

//       if (existingOrderIndex >= 0) {
//         updatedOrders[existingOrderIndex] = {
//           ...updatedOrders[existingOrderIndex],
//           quantity: updatedOrders[existingOrderIndex].quantity + quantity,
//         }
//         console.log("🔄 Pedido actualizado:", updatedOrders[existingOrderIndex])
//       } else {
//         updatedOrders.push({ item, quantity, price })
//         console.log("➕ Nuevo pedido añadido:", { item, quantity, price })
//       }

//       console.log("📋 Comanda final:", updatedOrders)
//       return updatedOrders
//     })
//   }

//   // Limpiar al desmontar
//   useEffect(() => {
//     return () => {
//       if (audioRef.current) {
//         audioRef.current.pause()
//         URL.revokeObjectURL(audioRef.current.src)
//       }

//       if (pollingIntervalRef.current) {
//         clearInterval(pollingIntervalRef.current)
//       }

//       if (autoProcessIntervalRef.current) {
//         clearInterval(autoProcessIntervalRef.current)
//       }
//     }
//   }, [])

//   return (
//     <div className="w-full h-screen bg-white flex">
//       {/* Área principal del avatar */}
//       <div className="flex-grow h-full relative">
//         {isLoading ? (
//           <div className="w-full h-full flex items-center justify-center">
//             <div className="text-gray-600 text-xl">Cargando avatar...</div>
//           </div>
//         ) : isSessionActive && roomUrl ? (
//           <iframe
//             ref={iframeRef}
//             src={roomUrl}
//             className="w-full h-full"
//             allow="camera; microphone; autoplay"
//             style={{ border: "none" }}
//           />
//         ) : (
//           <div className="w-full h-full flex items-center justify-center">
//             {error ? (
//               <div className="text-red-500 text-xl">{error}</div>
//             ) : (
//               <div className="text-gray-600 text-xl">Haz clic en "Pedir" para hablar con la camarera</div>
//             )}
//           </div>
//         )}

//         {/* Botones de control - Ambos en la misma posición */}
//         {isSessionActive ? (
//           <div className="fixed bottom-4 left-[30%] z-10">
//             <button
//               onClick={endSimliSession}
//               className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg"
//             >
//               Colgar
//             </button>
//           </div>
//         ) : (
//           <div className="fixed bottom-4 left-[30%] z-10">
//             <button
//               onClick={startSimliSession}
//               className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full shadow-lg"
//             >
//               Pedir
//             </button>
//           </div>
//         )}
//       </div>

//       {/* Panel de pedidos */}
//       <div className="w-1/4 h-full border-l border-gray-200 flex flex-col">
//         {/* Solo renderizar el panel de pedidos en el cliente para evitar errores de hidratación */}
//         {isClient ? (
//           <>
//             <OrderPanel orders={orders} clientId={clientId} />

//             {/* Panel de depuración */}
//             <div className="h-1/3 border-t border-gray-200 p-2 overflow-auto bg-gray-50">
//               <h3 className="text-sm font-bold mb-1">Registro de mensajes:</h3>
//               <div className="text-xs">
//                 {messageLog.map((msg, i) => (
//                   <div key={i} className="mb-1">
//                     {msg}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </>
//         ) : (
//           <div className="w-full h-full flex items-center justify-center">
//             <div className="text-gray-400">Cargando panel de pedidos...</div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// export default SimliAvatar

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
