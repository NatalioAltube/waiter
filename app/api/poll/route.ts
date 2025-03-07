import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Actualizar la configuración para OpenAI con la nueva API key
const OPENAI_API_KEY =
  "" // API key actualizada

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Mejorar la lista de palabras clave para interrupciones
const WAKE_WORDS = {
  es: [
    "disculpa",
    "perdona",
    "oye",
    "camarero",
    "mesero",
    "para",
    "detente",
    "espera",
    "un momento",
    "silencio",
    "cállate",
    "basta",
    "suficiente",
    "alto",
    "stop",
    "gracias",
    "por favor",
  ],
  en: [
    "excuse me",
    "sorry",
    "hey",
    "waiter",
    "stop",
    "hold on",
    "wait",
    "silence",
    "quiet",
    "enough",
    "halt",
    "shut up",
    "thanks",
    "thank you",
    "please",
  ],
  fr: [
    "excusez-moi",
    "pardon",
    "garçon",
    "serveur",
    "arrêtez",
    "attendez",
    "silence",
    "tais-toi",
    "assez",
    "stop",
    "merci",
    "s'il vous plaît",
  ],
  it: ["scusa", "scusi", "cameriere", "fermati", "aspetta", "silenzio", "basta", "stop", "grazie", "per favore"],
}

// Almacenamiento de mensajes para cada cliente
interface Message {
  id: string
  event: string
  data: any
  timestamp: number
}

// Mapa para almacenar los mensajes por cliente
const clientMessages = new Map<string, Message[]>()

// Mapa para rastrear el estado de procesamiento de cada cliente
const clientProcessingState = new Map<
  string,
  {
    isProcessing: boolean
    lastTranscribedText: string
    currentResponseId: string | null
    lastAudioTimestamp: number
    conversationHistory: Array<{ role: string; content: string }>
    pendingResponses: Array<{ responseId: string; text: string; voice: string }>
  }
>()

// Caché para datos del restaurante
let restaurantDataCache: any = null
let lastCacheTime = 0
const CACHE_TTL = 60000 // 1 minuto

// Función para cargar datos del restaurante con caché
function loadRestaurantData() {
  const now = Date.now()

  // Si tenemos datos en caché y no han expirado, usarlos
  if (restaurantDataCache && now - lastCacheTime < CACHE_TTL) {
    return restaurantDataCache
  }

  try {
    // Intentar cargar desde public/data/restaurant-data.json
    const dataPath = path.join(process.cwd(), "public", "data", "restaurant-data.json")

    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, "utf8")
      console.log("Datos del restaurante cargados correctamente desde:", dataPath)
      restaurantDataCache = JSON.parse(data)
      lastCacheTime = now
      return restaurantDataCache
    } else {
      // Intentar cargar desde public/data/restaurant.json como alternativa
      const fallbackPath = path.join(process.cwd(), "public", "data", "restaurant.json")
      if (fs.existsSync(fallbackPath)) {
        const data = fs.readFileSync(fallbackPath, "utf8")
        console.log("Datos del restaurante cargados desde fallback:", fallbackPath)
        restaurantDataCache = JSON.parse(data)
        lastCacheTime = now
        return restaurantDataCache
      }

      console.warn("Archivo restaurant-data.json no encontrado en:", dataPath)
      console.warn("Archivo restaurant.json no encontrado como fallback")
    }

    // Si no existe ninguno de los archivos, crear datos predeterminados
    console.log("Creando datos predeterminados del restaurante")
    const defaultData = {
      restaurante: {
        nombre: "Restaurante Demo",
        direccion: "Calle Principal 123, Ciudad",
        telefono: "+34 123 456 789",
        horario: "Lunes a Domingo: 12:00 - 23:00",
        descripcion: "Restaurante especializado en comida mediterránea con opciones vegetarianas y veganas.",
      },
      menu: {
        categorias: [
          {
            nombre: "Entrantes",
            platos: [
              {
                nombre: "Ensalada mixta",
                descripcion: "Lechuga, tomate, cebolla, aceitunas y atún",
                precio: 8.5,
                alergenos: ["pescado"],
                vegetariano: true,
              },
              {
                nombre: "Patatas bravas",
                descripcion: "Patatas fritas con salsa picante",
                precio: 6.5,
                alergenos: [],
                vegetariano: true,
              },
            ],
          },
          {
            nombre: "Principales",
            platos: [
              {
                nombre: "Paella de mariscos",
                descripcion: "Arroz con mariscos variados",
                precio: 18.5,
                alergenos: ["crustáceos", "moluscos"],
                vegetariano: false,
              },
              {
                nombre: "Pasta al pesto",
                descripcion: "Pasta con salsa de albahaca, piñones y queso parmesano",
                precio: 12.5,
                alergenos: ["gluten", "lácteos", "frutos secos"],
                vegetariano: true,
              },
            ],
          },
          {
            nombre: "Postres",
            platos: [
              {
                nombre: "Tarta de chocolate",
                descripcion: "Tarta casera de chocolate con nata",
                precio: 6.5,
                alergenos: ["gluten", "lácteos", "huevo"],
                vegetariano: true,
              },
              {
                nombre: "Fruta de temporada",
                descripcion: "Selección de frutas frescas",
                precio: 5.0,
                alergenos: [],
                vegetariano: true,
                vegano: true,
              },
            ],
          },
        ],
      },
      especiales: [
        {
          nombre: "Menú del día",
          descripcion: "Entrante + Principal + Postre + Bebida",
          precio: 15.9,
          disponible: "Lunes a Viernes de 13:00 a 16:00",
        },
      ],
    }

    // Intentar guardar los datos predeterminados para futuras ejecuciones
    try {
      const dir = path.join(process.cwd(), "public", "data")
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(path.join(dir, "restaurant-data.json"), JSON.stringify(defaultData, null, 2))
      console.log("Datos predeterminados guardados en:", path.join(dir, "restaurant-data.json"))
    } catch (saveError) {
      console.warn("No se pudieron guardar los datos predeterminados:", saveError)
    }

    restaurantDataCache = defaultData
    lastCacheTime = now
    return defaultData
  } catch (error) {
    console.error("Error al cargar datos del restaurante:", error)
    const errorData = {
      error: "Error al cargar datos del restaurante",
      detalles: error instanceof Error ? error.message : String(error),
      restaurante: {
        nombre: "Restaurante",
        direccion: "Dirección no disponible",
        telefono: "Teléfono no disponible",
        horario: "Horario no disponible",
      },
      menu: {
        mensaje: "Menú no disponible. Por favor, consulta con el administrador.",
      },
    }

    restaurantDataCache = errorData
    lastCacheTime = now
    return errorData
  }
}

// Función para obtener el prompt según el idioma
function getSystemPromptByLanguage(language: string) {
  const restaurantData = loadRestaurantData()
  const restaurantName = restaurantData.restaurante?.nombre || "nuestro restaurante"

  switch (language) {
    case "en":
      return `You are a helpful assistant for waiters in a restaurant called "${restaurantName}". 
      Provide concise, practical responses about taking orders, handling customer requests, 
      menu recommendations, and restaurant procedures. Be polite and professional.
      Keep responses brief and to the point, as if speaking in a busy restaurant environment.
      
      Here is the current restaurant information, menu and specials:
      ${JSON.stringify(restaurantData, null, 2)}
      
      Use this information to answer questions about the menu, ingredients, prices, 
      allergens, and any other restaurant-specific information. If asked about items 
      not on the menu, politely explain they are not available but suggest similar 
      alternatives from the menu.
      
      When recommending dishes, consider dietary restrictions, popular items, and chef's specials.
      If you don't know specific information that's not in the restaurant data, be honest and offer to check with the kitchen.
      
      ALWAYS RESPOND IN ENGLISH.
      
      IMPORTANT: Remember the conversation history and maintain context. If a customer refers to a previous order or question,
      use that information in your response.`

    case "fr":
      return `Vous êtes un assistant utile pour les serveurs dans un restaurant appelé "${restaurantName}". 
      Fournissez des réponses concises et pratiques concernant les commandes, les demandes des clients, 
      les recommandations de menu et les procédures du restaurant. Soyez poli et professionnel.
      Gardez les réponses brèves et précises, comme si vous parliez dans un restaurant animé.
      
      Voici les informations actuelles sur le restaurant, le menu et les spécialités:
      ${JSON.stringify(restaurantData, null, 2)}
      
      Utilisez ces informations pour répondre aux questions sur le menu, les ingrédients, les prix, 
      les allergènes et toute autre information spécifique au restaurant. Si on vous demande des plats 
      qui ne sont pas au menu, expliquez poliment qu'ils ne sont pas disponibles mais suggérez des 
      alternatives similaires du menu.
      
      Lorsque vous recommandez des plats, tenez compte des restrictions alimentaires, des plats populaires et des spécialités du chef.
      Si vous ne connaissez pas des informations spécifiques qui ne figurent pas dans les données du restaurant, soyez honnête et proposez de vérifier auprès de la cuisine.
      
      RÉPONDEZ TOUJOURS EN FRANÇAIS.
      
      IMPORTANT: Souvenez-vous de l'historique de la conversation et maintenez le contexte. Si un client fait référence à une commande ou une question précédente,
      utilisez cette information dans votre réponse.`

    case "it":
      return `Sei un assistente utile per i camerieri in un ristorante chiamato "${restaurantName}". 
      Fornisci risposte concise e pratiche su come prendere ordini, gestire le richieste dei clienti, 
      raccomandazioni sul menu e procedure del ristorante. Sii educato e professionale.
      Mantieni le risposte brevi e al punto, como se stessi parlando in un ristorante affollato.
      
      Ecco le informazioni attuali sul ristorante, il menu e le specialità:
      ${JSON.stringify(restaurantData, null, 2)}
      
      Utilizza queste informazioni per rispondere a domande sul menu, ingredienti, prezzi, 
      allergeni e qualsiasi altra informazione specifica del ristorante. Se ti vengono chiesti piatti 
      non presenti nel menu, spiega gentilmente che non sono disponibili ma suggerisci 
      alternative simili dal menu.
      
      Quando consigli i piatti, considera le restrizioni alimentari, i piatti popolari e le specialità dello chef.
      Se non conosci informazioni specifiche che non sono nei dati del ristorante, sii onesto e offri di verificare con la cucina.
      
      RISPONDI SEMPRE IN ITALIANO.
      
      IMPORTANTE: Ricorda la cronologia della conversazione e mantieni il contesto. Se un cliente fa riferimento a un ordine o a una domanda precedente,
      utilizza quell'informazione nella tua risposta.`

    case "es":
    default:
      return `Eres un asistente útil para camareros en un restaurante llamado "${restaurantName}". 
      Proporciona respuestas concisas y prácticas sobre cómo tomar pedidos, atender solicitudes de clientes, 
      recomendaciones del menú y procedimientos del restaurante. Sé educado y profesional.
      Mantén las respuestas breves y al grano, como si estuvieras hablando en un restaurante concurrido.
      
      Aquí está la información actual del restaurante, menú y especialidades:
      ${JSON.stringify(restaurantData, null, 2)}
      
      Utiliza esta información para responder preguntas sobre el menú, ingredientes, precios, 
      alérgenos y cualquier otra información específica del restaurante. Si te preguntan por platos 
      que no están en el menú, explica amablemente que no están disponibles pero sugiere 
      alternativas similares del menú.
      
      Al recomendar platos, considera restricciones dietéticas, platos populares y especialidades del chef.
      Si no conoces información específica que no está en los datos del restaurante, sé honesto y ofrece consultar con la cocina.
      
      RESPONDE SIEMPRE EN ESPAÑOL.
      
      IMPORTANTE: Recuerda el historial de la conversación y mantén el contexto. Si un cliente hace referencia a un pedido o pregunta anterior,
      utiliza esa información en tu respuesta.`
  }
}

// Función para añadir un mensaje para un cliente específico
function addMessageForClient(clientId: string, event: string, data: any) {
  const messages = clientMessages.get(clientId) || []
  const message: Message = {
    id: Date.now().toString(),
    event,
    data,
    timestamp: Date.now(),
  }
  messages.push(message)
  clientMessages.set(clientId, messages)
}

// Mejorar la detección de palabras clave para interrupciones
function containsWakeWord(text: string, language = "es"): boolean {
  const normalizedText = text.toLowerCase().trim()
  const wakeWords = WAKE_WORDS[language as keyof typeof WAKE_WORDS] || WAKE_WORDS.es

  // Detectar patrones de interrupción natural
  const interruptionPatterns = [
    /^(um+|eh+|ah+|oh+)$/i, // Sonidos de duda/interrupción
    /^(espera+|wait+|un momento+)$/i, // Peticiones de espera
    /^(perdona+|disculpa+|oye+|hey+)$/i, // Llamadas de atención
    /^(para+|stop+|alto+|detente+)$/i, // Comandos de parada
  ]

  for (const pattern of interruptionPatterns) {
    if (pattern.test(normalizedText)) {
      console.log(`Patrón de interrupción detectado: "${normalizedText}"`)
      return true
    }
  }

  // First check for exact matches
  for (const word of wakeWords) {
    // Only detect the word when it is a complete word, not part of another word
    // Using regular expressions to detect complete words
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, "i")

    // Special cases for words that are interruption commands
    if (word === "para" || word === "stop" || word === "alto" || word === "basta" || word === "detente") {
      // For these words, only detect them if they are alone or at the beginning of the phrase
      // or preceded by words like "di", "dile", "por favor"
      if (
        normalizedText === word.toLowerCase() ||
        normalizedText.startsWith(`${word.toLowerCase()} `) ||
        /\b(di|dile|por favor|oye)\s+\b(para|stop|alto|basta|detente)\b/i.test(normalizedText) ||
        // Add detection for short phrases that contain only the keyword
        (normalizedText.split(/\s+/).length <= 2 && regex.test(normalizedText))
      ) {
        console.log(`Palabra clave de interrupción detectada: "${word}" en "${normalizedText}"`)
        return true
      }
    }
    // For other keywords like "disculpa", "perdona", "oye", etc.
    else if (regex.test(normalizedText)) {
      // Analyze context to reduce false positives
      const negativeContextPatterns = [
        /\b(no|sin)\s+\b(disculpa|perdona|oye)\b/i, // "no disculpa", "sin disculpa"
        /\b(está|estoy|estaba)\s+\b(bien|ok|vale)\b/i, // "está bien", "estoy bien"
      ]

      let isNegativeContext = false
      for (const pattern of negativeContextPatterns) {
        if (pattern.test(normalizedText)) {
          isNegativeContext = true
          break
        }
      }

      if (!isNegativeContext) {
        console.log(`Palabra clave detectada: "${word}" en "${normalizedText}"`)
        return true
      }
    }
  }

  // Análisis de intención basado en longitud y puntuación
  // Frases muy cortas con signos de exclamación o interrogación suelen ser interrupciones
  if (normalizedText.length < 10 && /[!?¡¿]+/.test(normalizedText)) {
    console.log(`Posible interrupción por entonación: "${normalizedText}"`)
    return true
  }

  // If the text is very short (1-2 words), consider it as a possible interruption
  if (normalizedText.split(/\s+/).length <= 2 && normalizedText.length < 8) {
    console.log(`Texto corto detectado como posible interrupción: "${normalizedText}"`)
    return true
  }

  return false
}

// Función para calcular la distancia de Levenshtein (similitud entre textos)
function levenshteinDistance(a: string, b: string): number {
  const matrix = []

  // Incrementar a lo largo de la primera columna de cada fila
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  // Incrementar a lo largo de la primera fila de cada columna
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Rellenar el resto de la matriz
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1, // inserción
          matrix[i - 1][j] + 1, // eliminación
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Función para filtrar textos no deseados
function filterUnwantedText(text: string): string {
  // Lista de frases a filtrar
  const unwantedPhrases = [
    "Subtítulos realizados por la comunidad de Amara.org",
    "Amara.org",
    "¡Gracias por ver el vídeo!",
    "Subtítulos",
    "gracias por ver",
    "subtitles by",
    "community subtitles",
    "thank you for watching",
  ]

  // Filtrar frases no deseadas
  let filteredText = text
  unwantedPhrases.forEach((phrase) => {
    filteredText = filteredText.replace(new RegExp(phrase, "gi"), "")
  })

  // Eliminar espacios extra y devolver texto limpio
  return filteredText.trim()
}

// Inicializar el estado de procesamiento para un cliente
function initClientProcessingState(clientId: string) {
  if (!clientProcessingState.has(clientId)) {
    clientProcessingState.set(clientId, {
      isProcessing: false,
      lastTranscribedText: "",
      currentResponseId: null,
      lastAudioTimestamp: 0,
      conversationHistory: [],
      pendingResponses: [],
    })
  }
}

// Función para limpiar mensajes antiguos
function cleanupOldMessages() {
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000 // 1 hora

  // Limpiar mensajes antiguos para cada cliente
  for (const [clientId, messages] of clientMessages.entries()) {
    const filteredMessages = messages.filter((msg) => msg.timestamp > oneHourAgo)

    if (filteredMessages.length !== messages.length) {
      console.log(
        `Limpiando mensajes antiguos para cliente ${clientId}: ${messages.length - filteredMessages.length} mensajes eliminados`,
      )
      clientMessages.set(clientId, filteredMessages)
    }
  }

  // Limpiar estados de clientes inactivos
  for (const [clientId, state] of clientProcessingState.entries()) {
    if (state.lastAudioTimestamp < oneHourAgo) {
      console.log(`Eliminando estado de cliente inactivo: ${clientId}`)
      clientProcessingState.delete(clientId)
    }
  }
}

// Programar limpieza periódica de mensajes antiguos
setInterval(cleanupOldMessages, 30 * 60 * 1000) // Cada 30 minutos

// Función para procesar el texto con el LLM
async function processWithLLM(clientId: string, text: string, language = "es", responseId: string) {
  try {
    console.log(`[processWithLLM] Iniciando procesamiento para cliente ${clientId}`)
    console.log(`[processWithLLM] Texto a procesar: "${text}"`)
    console.log(`[processWithLLM] Idioma: ${language}, ResponseId: ${responseId}`)

    const clientState = clientProcessingState.get(clientId)
    if (!clientState) {
      console.error(`[processWithLLM] Estado de cliente no encontrado para ${clientId}`)
      return
    }

    // Reducir el delay inicial para responder más rápido
    await new Promise((resolve) => setTimeout(resolve, 100)) // Reduced from 500ms to 100ms

    // Filtrar texto para eliminar referencias a Amara.org o subtítulos
    if (
      text.toLowerCase().includes("amara.org") ||
      text.toLowerCase().includes("subtítulos") ||
      text.toLowerCase().includes("subtitulos") ||
      text.toLowerCase().includes("gracias por ver")
    ) {
      console.log("[processWithLLM] Texto filtrado por contener referencias a subtítulos:", text)
      clientState.isProcessing = false
      return
    }

    if (!text.trim()) {
      console.log("[processWithLLM] Texto vacío, ignorando")
      clientState.isProcessing = false
      return
    }

    // Verificar que este responseId sigue siendo el actual
    if (clientState.currentResponseId !== responseId) {
      console.log(`[processWithLLM] ResponseId ${responseId} ya no es el actual, ignorando`)
      return
    }

    // Verificación adicional para palabras clave - solo para comandos específicos, no para preguntas normales
    // Esto evita que palabras como "para" en "algo para comer" sean detectadas como interrupciones
    const isStandaloneCommand = text.trim().split(" ").length <= 3 // Comandos cortos como "para" o "detente por favor"
    if (isStandaloneCommand && containsWakeWord(text, language)) {
      console.log(`[processWithLLM] Comando de interrupción detectado en texto corto: "${text}"`)
      clientState.isProcessing = false
      return
    }

    const systemPrompt = getSystemPromptByLanguage(language)
    console.log("[processWithLLM] System prompt generado correctamente")

    // Seleccionar la voz según el idioma
    let voice = "alloy"
    switch (language) {
      case "en":
        voice = "nova"
        break
      case "fr":
        voice = "alloy"
        break
      case "it":
        voice = "alloy"
        break
      case "es":
      default:
        voice = "alloy"
        break
    }

    // Preparar los mensajes para el modelo
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
    ]

    // Añadir historial de conversación
    const recentHistory = clientState.conversationHistory.slice(-10)
    messages.push(...recentHistory)

    // Añadir el mensaje actual del usuario
    if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].content !== text) {
      messages.push({ role: "user", content: text })
    }

    console.log("[processWithLLM] Enviando solicitud a OpenAI")
    console.log("[processWithLLM] Mensajes:", JSON.stringify(messages, null, 2))

    // Usar un modelo más rápido para respuestas más ágiles
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Cambiado de gpt-4 a gpt-3.5-turbo para respuestas más rápidas
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[processWithLLM] Error en la respuesta de OpenAI:", response.status, errorText)
      throw new Error(`Error en la respuesta: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    console.log("[processWithLLM] Respuesta de OpenAI recibida:", JSON.stringify(responseData, null, 2))

    // Verificar nuevamente que este responseId sigue siendo el actual
    if (clientState.currentResponseId !== responseId) {
      console.log(`[processWithLLM] ResponseId ${responseId} ya no es el actual, ignorando`)
      return
    }

    const responseText = responseData.choices[0].message.content

    // Verificar que tengamos una respuesta antes de convertir a voz
    if (responseText && responseText.trim() && clientState.currentResponseId === responseId) {
      console.log("[processWithLLM] Enviando respuesta al cliente:", responseText)

      // Añadir el texto completo como un mensaje de respuesta
      addMessageForClient(clientId, "response_chunk", {
        text: responseText,
        responseId: responseId,
        isComplete: true,
      })

      // Añadir a la cola de respuestas pendientes
      clientState.pendingResponses.push({
        responseId,
        text: responseText,
        voice,
      })

      // Convertir a voz
      await textToSpeech(clientId, responseText, voice, responseId)
    } else {
      console.warn("[processWithLLM] Respuesta vacía del LLM o responseId ya no es actual")
      if (clientState.currentResponseId === responseId) {
        addMessageForClient(clientId, "error", {
          message: "No se pudo generar una respuesta. Por favor, intenta de nuevo.",
          responseId: responseId,
        })
        clientState.isProcessing = false
      }
    }
  } catch (error) {
    console.error("[processWithLLM] Error:", error)

    const clientState = clientProcessingState.get(clientId)
    if (clientState && clientState.currentResponseId === responseId) {
      addMessageForClient(clientId, "error", {
        message: "Error al procesar la respuesta: " + (error instanceof Error ? error.message : "Error desconocido"),
        responseId: responseId,
      })
      clientState.isProcessing = false
    }
  }
}

// Función para convertir texto a voz
async function textToSpeech(clientId: string, text: string, voice = "alloy", responseId: string) {
  try {
    console.log(`[textToSpeech] Iniciando conversión para cliente ${clientId}`)
    console.log(`[textToSpeech] Texto a convertir: "${text}"`)
    console.log(`[textToSpeech] Voz: ${voice}, ResponseId: ${responseId}`)

    const clientState = clientProcessingState.get(clientId)
    if (!clientState) {
      console.error(`[textToSpeech] Estado de cliente no encontrado para ${clientId}`)
      return
    }

    // Verificar que este responseId sigue siendo el actual
    if (clientState.currentResponseId !== responseId) {
      console.log(`[textToSpeech] ResponseId ${responseId} ya no es el actual para TTS, ignorando`)
      return
    }

    if (!text || !text.trim()) {
      console.warn("[textToSpeech] Texto vacío para conversión a voz")
      addMessageForClient(clientId, "error", {
        message: "No se pudo generar audio para una respuesta vacía",
        responseId: responseId,
      })
      clientState.isProcessing = false
      return
    }

    // Limitar el texto a un máximo de 4096 caracteres
    const trimmedText = text.trim().substring(0, 4000)
    console.log("[textToSpeech] Texto preparado para TTS:", trimmedText)

    console.log("[textToSpeech] Enviando solicitud a OpenAI TTS")
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: trimmedText,
        voice: voice,
        response_format: "mp3",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[textToSpeech] Error en la API de TTS:", response.status, errorText)
      throw new Error(`Error en la conversión de texto a voz: ${response.status} - ${errorText}`)
    }

    console.log("[textToSpeech] Respuesta de TTS recibida, procesando audio")
    const audioBuffer = await response.arrayBuffer()

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      throw new Error("Buffer de audio vacío recibido de la API")
    }

    // Verificar una última vez antes de enviar el audio
    if (clientState.currentResponseId !== responseId) {
      console.log(`[textToSpeech] ResponseId ${responseId} ya no es el actual después de TTS API, ignorando`)
      return
    }

    const audioBase64 = Buffer.from(audioBuffer).toString("base64")
    console.log("[textToSpeech] Audio convertido a base64, longitud:", audioBase64.length)

    // Registrar el timestamp de este audio
    clientState.lastAudioTimestamp = Date.now()

    // Añadir mensaje de audio
    addMessageForClient(clientId, "audio_response", {
      audio: audioBase64,
      responseId: responseId,
      timestamp: clientState.lastAudioTimestamp,
    })

    console.log("[textToSpeech] Mensaje de audio enviado al cliente")

    // Procesar la siguiente respuesta pendiente si existe
    const pendingResponses = clientState.pendingResponses
    const currentIndex = pendingResponses.findIndex((r) => r.responseId === responseId)

    if (currentIndex >= 0 && currentIndex < pendingResponses.length - 1) {
      // Hay una respuesta pendiente siguiente
      const nextResponse = pendingResponses[currentIndex + 1]
      console.log("[textToSpeech] Procesando siguiente respuesta pendiente:", nextResponse.responseId)

      // Esperar un momento antes de procesar la siguiente respuesta
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Procesar la siguiente respuesta
      await textToSpeech(clientId, nextResponse.text, nextResponse.voice, nextResponse.responseId)
    } else {
      // No hay más respuestas pendientes, marcar como no procesando
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Verificar una última vez antes de cambiar el estado
      if (clientState.currentResponseId === responseId) {
        clientState.isProcessing = false
        console.log("[textToSpeech] Procesamiento completado")
      }
    }
  } catch (error) {
    console.error("[textToSpeech] Error:", error)

    const clientState = clientProcessingState.get(clientId)
    if (clientState && clientState.currentResponseId === responseId) {
      addMessageForClient(clientId, "error", {
        message:
          "Error en la conversión de texto a voz: " + (error instanceof Error ? error.message : "Error desconocido"),
        responseId: responseId,
      })
      clientState.isProcessing = false
    }
  }
}

// Endpoint GET para polling
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") || "default"
    const lastTimestamp = Number.parseInt(url.searchParams.get("lastTimestamp") || "0")

    // Inicializar estado de procesamiento para este cliente
    initClientProcessingState(clientId)

    // Obtener mensajes para este cliente que sean más recientes que lastTimestamp
    const messages = clientMessages.get(clientId) || []
    const newMessages = messages.filter((msg) => msg.timestamp > lastTimestamp)

    // Si no hay mensajes para este cliente, inicializar con un mensaje de conexión
    if (!clientMessages.has(clientId)) {
      const connectMessage: Message = {
        id: Date.now().toString(),
        event: "connected",
        data: { id: clientId, message: "Conexión establecida" },
        timestamp: Date.now(),
      }
      clientMessages.set(clientId, [connectMessage])
      return NextResponse.json([connectMessage])
    }

    // Limpiar mensajes antiguos (más de 5 minutos)
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    const filteredMessages = messages.filter((msg) => msg.timestamp > fiveMinutesAgo)
    clientMessages.set(clientId, filteredMessages)

    return NextResponse.json(newMessages)
  } catch (error) {
    console.error("Error en GET /api/poll:", error)
    return NextResponse.json(
      { error: "Error interno del servidor", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

// Endpoint POST para acciones
export async function POST(req: NextRequest) {
  try {
    // Manejar errores de JSON parsing
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error("[POST] Error parsing JSON:", parseError)
      return NextResponse.json(
        {
          error: "Error al procesar la solicitud: JSON inválido",
          success: false,
        },
        { status: 400 },
      )
    }

    const { clientId, action } = body

    // Manejar acción de ping de forma simple y robusta
    if (action === "ping") {
      console.log(`[POST] Ping recibido para cliente ${clientId}`)
      return NextResponse.json({ success: true, timestamp: Date.now() })
    }

    // Para otras acciones, procesar normalmente
    const { data, language = "es" } = body
    console.log(`[POST] Recibida acción: ${action} para cliente ${clientId}`)

    // Add connection status check
    const isClientConnected = clientMessages.has(clientId)
    if (!isClientConnected) {
      console.log(`[POST] Cliente ${clientId} no está conectado, reconectando...`)
      // Force reconnection
      const connectMessage: Message = {
        id: Date.now().toString(),
        event: "connected",
        data: { id: clientId, message: "Reconexión establecida" },
        timestamp: Date.now(),
      }
      clientMessages.set(clientId, [connectMessage])
    }

    // Inicializar estado de procesamiento para este cliente
    initClientProcessingState(clientId)
    const clientState = clientProcessingState.get(clientId)!

    // Mejorar el manejo de transcripciones e interrupciones
    if (action === "transcribe") {
      // Si ya está procesando, verificar si es una interrupción
      if (clientState.isProcessing) {
        // Verificar si el audio contiene una palabra clave de interrupción
        const audioBase64 = data.audio

        // Convertir base64 a blob
        const binaryString = atob(audioBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const audioBlob = new Blob([bytes], { type: "audio/webm" })

        // Mejorar la detección de interrupciones durante el procesamiento
        if (audioBlob.size > 3000) {
          // Reduced threshold for faster interruption detection
          console.log(
            `[POST] Posible interrupción detectada durante procesamiento, tamaño audio: ${audioBlob.size} bytes`,
          )

          // Process the transcription to check if it contains a keyword
          const formData = new FormData()
          formData.append("file", audioBlob, "audio.webm")
          formData.append("model", "whisper-1")
          formData.append("language", language)

          try {
            const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
              },
              body: formData,
            })

            if (response.ok) {
              const transcriptionData = await response.json()
              const transcribedText = transcriptionData.text

              console.log(`[POST] Texto de posible interrupción: "${transcribedText}"`)

              // Ser más sensible a las interrupciones
              if (
                transcribedText.trim().length < 15 &&
                (containsWakeWord(transcribedText, language) || transcribedText.trim().length < 3) // Very short utterances
              ) {
                console.log(`[POST] Interrupción confirmada: "${transcribedText}"`)

                // Interrupt current processing
                clientState.isProcessing = false
                clientState.currentResponseId = null
                clientState.pendingResponses = [] // Clear pending responses

                // Notify client
                addMessageForClient(clientId, "interrupted", {
                  message: "Respuesta interrumpida",
                  interruptionText: transcribedText,
                })

                return NextResponse.json({
                  success: true,
                  interrupted: true,
                  transcribedText: transcribedText,
                })
              }
            }
          } catch (error) {
            console.error("[POST] Error al verificar interrupción:", error)
          }
        }

        console.log(`Cliente ${clientId} ya está procesando una solicitud, ignorando nueva transcripción`)
        return NextResponse.json({
          success: false,
          ignored: true,
          reason: "Ya está procesando una solicitud",
        })
      }

      // Procesar la transcripción
      const audioBase64 = data.audio
      const lastTranscribedText = clientState.lastTranscribedText

      // Actualizar el historial de conversación si se proporciona
      if (data.conversationHistory) {
        clientState.conversationHistory = data.conversationHistory
      }

      // Convertir base64 a blob
      const binaryString = atob(audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const audioBlob = new Blob([bytes], { type: "audio/webm" })

      // Verificar tamaño mínimo para evitar ruido
      if (audioBlob.size < 800) {
        console.log("Audio demasiado pequeño, probablemente ruido:", audioBlob.size, "bytes")
        return NextResponse.json({
          success: false,
          ignored: true,
          reason: "Audio demasiado pequeño",
        })
      }

      const formData = new FormData()
      formData.append("file", audioBlob, "audio.webm")
      formData.append("model", "whisper-1")
      formData.append("language", language)

      // Llamar a la API de OpenAI para transcribir
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Error en la transcripción: ${JSON.stringify(errorData)}`)
      }

      const transcriptionData = await response.json()
      let transcribedText = transcriptionData.text

      // Filtrar texto no deseado
      transcribedText = filterUnwantedText(transcribedText)

      // Si el texto está vacío, probablemente sea ruido
      if (!transcribedText || transcribedText.trim().length === 0) {
        return NextResponse.json({
          success: true,
          transcribedText: "",
          ignored: true,
          reason: "Texto vacío",
        })
      }

      // Verificar si hay una palabra clave mientras está hablando
      if (containsWakeWord(transcribedText, language)) {
        console.log(`Palabra clave detectada en transcripción: "${transcribedText}"`)
        addMessageForClient(clientId, "wake_word_detected", {
          text: transcribedText,
          wakeWord: true,
        })
      }

      // Ser menos estricto con la similitud para evitar duplicados
      if (
        lastTranscribedText &&
        (transcribedText === lastTranscribedText ||
          levenshteinDistance(transcribedText.toLowerCase(), lastTranscribedText.toLowerCase()) < 3)
      ) {
        return NextResponse.json({
          success: true,
          transcribedText: transcribedText,
          ignored: true,
          reason: "Texto duplicado",
        })
      }

      // Actualizar el último texto transcrito
      clientState.lastTranscribedText = transcribedText

      // Marcar como procesando
      clientState.isProcessing = true

      // Generar un ID único para esta respuesta
      const responseId = Date.now().toString()
      clientState.currentResponseId = responseId

      // Limpiar respuestas pendientes anteriores
      clientState.pendingResponses = []

      // Añadir la transcripción a los mensajes
      addMessageForClient(clientId, "transcription", { text: transcribedText, responseId })

      // Procesar con el LLM
      processWithLLM(clientId, transcribedText, language, responseId)

      return NextResponse.json({
        success: true,
        transcribedText: transcribedText,
        responseId: responseId,
      })
    } else if (action === "interrupt") {
      // Manejar interrupción
      console.log(`[POST] Interrupción manual recibida para cliente ${clientId}`)
      addMessageForClient(clientId, "interrupted", { message: "Respuesta interrumpida" })

      // Resetear el estado de procesamiento
      clientState.isProcessing = false
      clientState.currentResponseId = null
      clientState.pendingResponses = [] // Clear pending responses

      return NextResponse.json({ success: true })
    } else if (action === "reset_state") {
      // Resetear el estado de procesamiento del cliente pero mantener el historial
      const conversationHistory = clientState.conversationHistory

      clientProcessingState.set(clientId, {
        isProcessing: false,
        lastTranscribedText: "",
        currentResponseId: null,
        lastAudioTimestamp: 0,
        conversationHistory: conversationHistory,
        pendingResponses: [],
      })

      // Notificar al cliente que el estado se ha reseteado
      addMessageForClient(clientId, "state_reset", { message: "Estado reseteado" })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    console.error("[POST] Error:", error)
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500 },
    )
  }
}





























