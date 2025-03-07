"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, Volume2, Settings, RefreshCw } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Configuración de parámetros de audio y detección
const MAX_RECORDING_DURATION = 20000 // 20 segundos para frases más largas
const VOICE_DETECTION_THRESHOLD = 0.03 // Umbral de volumen para detección de voz
const SILENCE_THRESHOLD_TIME = 700 // Tiempo de silencio antes de procesar el audio (ms)

// Inicializar variables globales para el navegador
if (typeof window !== "undefined") {
  window.interruptionCounter = 0
  window.isListeningForInterruption = false
  window.audioContext = null
  window.ambientNoiseLevel = 0.01 // Nivel de ruido ambiental inicial
}

export default function Home() {
  // Estado para el idioma seleccionado
  const [language, setLanguage] = useState<string>("es")

  // Estado para la grabación
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [isListening, setIsListening] = useState<boolean>(true) // Comienza escuchando automáticamente
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [transcribedText, setTranscribedText] = useState<string>("")
  const [responseText, setResponseText] = useState<string>("")
  const [clientId] = useState<string>(() => `client_${Date.now()}`)
  const [lastTimestamp, setLastTimestamp] = useState<number>(0)
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false)
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [needsRestart, setNeedsRestart] = useState<boolean>(false)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [sensitivityLevel, setSensitivityLevel] = useState<number>(5) // 1-10, donde 10 es más sensible

  // Referencias
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTranscribedTextRef = useRef<string>("")
  const silenceCounterRef = useRef<number>(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastVoiceActivityRef = useRef<number>(Date.now())
  const processingQueueRef = useRef<boolean>(false)
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null)
  const ambientNoiseLevelRef = useRef<number>(0.01)
  const calibrationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Referencias para funciones para evitar dependencias circulares
  const startRecordingRef = useRef<() => Promise<void>>(async () => {})
  const stopRecordingRef = useRef<() => void>(() => {})

  // Función para calibrar el nivel de ruido ambiental
  const calibrateAmbientNoise = useCallback(() => {
    if (!analyserRef.current) return;
    
    console.log("Calibrando nivel de ruido ambiental...");
    
    let samples = 0;
    let totalLevel = 0;
    
    const sampleNoise = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedValue = average / 255;
      
      totalLevel += normalizedValue;
      samples++;
      
      if (samples < 20) {
        // Tomar 20 muestras durante 2 segundos
        setTimeout(sampleNoise, 100);
      } else {
        // Calcular el promedio y establecer como nivel de ruido ambiental
        const avgLevel = totalLevel / samples;
        ambientNoiseLevelRef.current = avgLevel * 0.7; // Usar 70% del nivel promedio como base
        
        if (typeof window !== "undefined") {
          window.ambientNoiseLevel = ambientNoiseLevelRef.current;
        }
        
        console.log(`Nivel de ruido ambiental calibrado: ${ambientNoiseLevelRef.current.toFixed(4)}`);
      }
    };
    
    sampleNoise();
  }, []);

  // Función para limpiar todos los recursos de audio
  const cleanupAudioResources = useCallback(() => {
    console.log("Limpiando recursos de audio...")

    // Detener grabación si está activa
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    // Detener reproducción de audio si está activa
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current.src = ""
      audioElementRef.current = null
    }

    // Detener stream de micrófono
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      microphoneStreamRef.current = null
    }

    // Limpiar timeouts
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }

    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current)
      calibrationTimeoutRef.current = null
    }

    // Resetear estados
    processingQueueRef.current = false
    audioChunksRef.current = []

    console.log("Recursos de audio limpiados correctamente")
  }, [])

  // Función para hacer ping al servidor
  const pingServer = useCallback(async () => {
    try {
      console.log("Intentando hacer ping al servidor...")

      // Usar fetch con un timeout para evitar esperas infinitas
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch("/api/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          action: "ping",
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`Error de conexión: ${response.status}`)
        setIsServerConnected(false)
        setError(`Error de conexión: ${response.status}`)
        return false
      }

      const data = await response.json()

      if (data.success) {
        console.log("Ping exitoso al servidor")
        setIsServerConnected(true)
        setError(null)
        return true
      } else {
        console.error("Error en la respuesta del servidor:", data)
        setIsServerConnected(false)
        setError("Error en la respuesta del servidor")
        return false
      }
    } catch (error) {
      console.error("Error al hacer ping al servidor:", error)
      setIsServerConnected(false)
      setError(error instanceof Error ? error.message : "Error de conexión")
      return false
    }
  }, [clientId])

  // Función para interrumpir la respuesta actual
  const interruptResponse = useCallback(async () => {
    console.log("=== INICIANDO INTERRUPCIÓN DE RESPUESTA ===")

    if (isPlayingAudio && audioElementRef.current) {
      audioElementRef.current.pause()
      setIsPlayingAudio(false)
    }

    // Limpiar recursos de audio
    cleanupAudioResources()

    try {
      await fetch("/api/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          action: "interrupt",
        }),
      })

      // Resetear el estado
      await fetch("/api/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          action: "reset_state",
        }),
      })

      setIsProcessing(false)
      setCurrentResponseId(null)

      // Forzar reinicio de grabación con menor delay
      setNeedsRestart(true)

      // Reinicio inmediato
      setTimeout(() => {
        if (startRecordingRef.current) {
          startRecordingRef.current()
        }
      }, 200) // Más rápido para mejor fluidez

      console.log("=== INTERRUPCIÓN COMPLETADA, REINICIANDO GRABACIÓN ===")
    } catch (error) {
      console.error("Error al interrumpir respuesta:", error)
      setIsProcessing(false)
      setCurrentResponseId(null)

      // Forzar reinicio de grabación incluso si hay error
      setNeedsRestart(true)

      // Reinicio inmediato
      setTimeout(() => {
        if (startRecordingRef.current) {
          startRecordingRef.current()
        }
      }, 200)
    }
  }, [clientId, isPlayingAudio, cleanupAudioResources])

  // Función para reproducir respuesta de audio
  const playAudioResponse = useCallback(
    (audioBase64: string) => {
      try {
        console.log("=== INICIANDO REPRODUCCIÓN DE AUDIO ===")

        // Crear un nuevo elemento de audio para cada respuesta
        const audioElement = new Audio()

        // Establecer estado de carga
        setIsPlayingAudio(true)

        audioElement.oncanplaythrough = () => {
          console.log("Audio listo para reproducir")
        }

        audioElement.onplay = () => {
          setIsPlayingAudio(true)
          console.log("Audio comenzó a reproducirse")

          // Iniciar escucha activa para interrupciones mientras se reproduce el audio
          if (typeof window !== "undefined") {
            window.isListeningForInterruption = true
            window.interruptionCounter = 0 // Resetear contador al iniciar
          }
        }

        // Optimizar los tiempos de espera y transiciones
        audioElement.onended = () => {
          console.log("=== AUDIO TERMINADO, REINICIANDO GRABACIÓN ===")
          setIsPlayingAudio(false)
          if (typeof window !== "undefined") {
            window.isListeningForInterruption = false
          }

          // Limpiar referencia
          if (audioElementRef.current === audioElement) {
            audioElementRef.current = null
          }

          // Resetear estados relevantes
          setIsProcessing(false)
          setCurrentResponseId(null)
          processingQueueRef.current = false

          // Iniciar grabación más rápido después de terminar el audio
          setTimeout(() => {
            console.log("Reiniciando grabación después de audio terminado")
            if (startRecordingRef.current) {
              startRecordingRef.current()
            }
          }, 200) // Reducido para mejor fluidez
        }

        audioElement.onerror = (e) => {
          console.error("Error al cargar audio:", e)
          setError("Error al reproducir audio")
          setIsPlayingAudio(false)
          if (typeof window !== "undefined") {
            window.isListeningForInterruption = false
          }

          // Forzar reinicio de grabación
          setNeedsRestart(true)
        }

        // Añadir botón físico para interrupciones (tecla Escape)
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Escape" || e.key === " ") {
            console.log("Interrupción manual detectada (tecla Escape o Espacio)")
            audioElement.pause()
            setIsPlayingAudio(false)
            if (typeof window !== "undefined") {
              window.isListeningForInterruption = false
            }
            interruptResponse()
          }
        }

        document.addEventListener("keydown", handleKeyDown)

        // Convertir base64 a blob
        const byteCharacters = atob(audioBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "audio/mp3" })

        // Crear URL para el blob
        const audioUrl = URL.createObjectURL(blob)
        audioElement.src = audioUrl

        // Guardar referencia y reproducir
        audioElementRef.current = audioElement

        // Pequeño delay antes de reproducir
        setTimeout(() => {
          audioElement.play().catch((error) => {
            console.error("Error al reproducir audio:", error)
            setError("Error al reproducir audio: " + error.message)
            if (typeof window !== "undefined") {
              window.isListeningForInterruption = false
            }

            // Forzar reinicio de grabación
            setNeedsRestart(true)
          })
        }, 100) // Reducido para mejor fluidez

        // Limpiar el event listener cuando se desmonte
        return () => {
          document.removeEventListener("keydown", handleKeyDown)
        }
      } catch (error) {
        console.error("Error al procesar audio:", error)
        setError("Error al procesar audio: " + (error instanceof Error ? error.message : String(error)))
        if (typeof window !== "undefined") {
          window.isListeningForInterruption = false
        }

        // Forzar reinicio de grabación
        setNeedsRestart(true)
      }
    },
    [interruptResponse],
  )

  // Función para procesar mensajes del servidor
  const processMessages = useCallback(
    (messages: any[]) => {
      console.log("[processMessages] Procesando mensajes:", messages.length)

      for (const message of messages) {
        console.log("[processMessages] Procesando mensaje:", message.event)

        switch (message.event) {
          case "connected":
            console.log("[processMessages] Conexión establecida:", message.data)
            setIsServerConnected(true)

            // Iniciar grabación automáticamente al conectar
            setNeedsRestart(true)
            break

          case "transcription":
            console.log("[processMessages] Transcripción recibida:", message.data.text)
            if (message.data.text && message.data.text.trim().length > 0) {
              setTranscribedText(message.data.text)
              setConversationHistory((prev) => [...prev, { role: "user", content: message.data.text }])
              lastTranscribedTextRef.current = message.data.text
            }
            break

          case "response_chunk":
            console.log("[processMessages] Chunk de respuesta recibido:", message.data)
            if (message.data.responseId === currentResponseId || !currentResponseId) {
              setResponseText((prev) => {
                if (message.data.isComplete) {
                  setConversationHistory((prev) => [...prev, { role: "assistant", content: message.data.text }])
                  return message.data.text
                }
                return prev + message.data.text
              })
            }
            break

          case "audio_response":
            console.log("[processMessages] Respuesta de audio recibida")
            if (message.data.responseId === currentResponseId || !currentResponseId) {
              console.log("[processMessages] Reproduciendo audio")
              playAudioResponse(message.data.audio)
            }
            break

          case "error":
            console.error("[processMessages] Error del servidor:", message.data)
            setError(message.data.message)
            setIsProcessing(false)

            // Reintentar grabación después de un error
            setNeedsRestart(true)
            break

          case "interrupted":
            console.log("Respuesta interrumpida")
            setIsProcessing(false)

            // Detener cualquier reproducción de audio
            if (isPlayingAudio && audioElementRef.current) {
              audioElementRef.current.pause()
              setIsPlayingAudio(false)
            }

            // Reiniciar grabación después de interrupción
            setNeedsRestart(true)
            break

          case "wake_word_detected":
            console.log("Palabra clave detectada:", message.data.text)

            // Si estamos reproduciendo audio, detenerlo
            if (isPlayingAudio && audioElementRef.current) {
              audioElementRef.current.pause()
              setIsPlayingAudio(false)
            }

            // Interrumpir la respuesta actual
            interruptResponse()
            break

          case "state_reset":
            console.log("Estado reseteado:", message.data)
            setIsProcessing(false)
            setCurrentResponseId(null)

            // Reiniciar grabación después de reset
            setNeedsRestart(true)
            break
            
          case "sentiment_analysis":
            console.log("Análisis de sentimiento recibido:", message.data)
            // Aquí podrías implementar lógica para manejar el sentimiento detectado
            break
        }
      }
    },
    [currentResponseId, isPlayingAudio, playAudioResponse, interruptResponse],
  )

  // Función para realizar el polling al servidor
  const startPolling = useCallback(() => {
    console.log("[startPolling] Iniciando polling")

    const intervalId = setInterval(async () => {
      try {
        console.log("[startPolling] Realizando solicitud de polling")
        const response = await fetch(`/api/poll?clientId=${clientId}&lastTimestamp=${lastTimestamp}`)

        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`)
        }

        const messages = await response.json()
        console.log("[startPolling] Mensajes recibidos:", messages.length)

        if (!Array.isArray(messages)) {
          console.warn("[startPolling] Respuesta del servidor no es un array:", messages)
          return
        }

        if (messages.length > 0) {
          processMessages(messages)
          const latestTimestamp = Math.max(...messages.map((msg) => msg.timestamp))
          setLastTimestamp(latestTimestamp)
        }

        setIsServerConnected(true)
        setError(null)
      } catch (error) {
        console.error("[startPolling] Error:", error)
        setIsServerConnected(false)
        setError(error instanceof Error ? error.message : "Error de conexión")

        setTimeout(() => {
          if (!isServerConnected) {
            pingServer()
          }
        }, 5000)
      }
    }, 1000)

    pollingIntervalRef.current = intervalId

    return () => clearInterval(intervalId)
  }, [clientId, lastTimestamp, isServerConnected, processMessages, pingServer])

  // Función para analizar el audio y detectar interrupciones
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calcular el nivel de audio promedio
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedValue = average / 255 // Normalizar a un valor entre 0 y 1

    setAudioLevel(normalizedValue)

    // Ajustar el umbral de detección según el nivel de sensibilidad configurado
    const adjustedThreshold = VOICE_DETECTION_THRESHOLD * (11 - sensitivityLevel) / 5;
    
    // Usar el nivel de ruido ambiental para ajustar el umbral
    const dynamicThreshold = Math.max(adjustedThreshold, ambientNoiseLevelRef.current * 1.5);

    // Detectar actividad de voz
    if (normalizedValue > dynamicThreshold) {
      // Hay actividad de voz
      lastVoiceActivityRef.current = Date.now()

      // Si estamos reproduciendo audio y hay actividad de voz fuerte (posible interrupción)
      if (
        isPlayingAudio &&
        audioElementRef.current &&
        typeof window !== "undefined" &&
        window.isListeningForInterruption
      ) {
        // Usar un umbral adaptativo basado en el nivel de audio ambiente y sensibilidad
        const interruptionBaseThreshold = dynamicThreshold * 2.0 * (11 - sensitivityLevel) / 5;
        const adaptiveThreshold = Math.max(interruptionBaseThreshold, normalizedValue * 0.7);
        
        if (normalizedValue > adaptiveThreshold) {
          console.log(
            `Posible interrupción detectada durante reproducción, nivel: ${normalizedValue.toFixed(2)}, umbral: ${adaptiveThreshold.toFixed(2)}`,
          )

          // Contar cuántas muestras consecutivas tienen nivel alto
          if (typeof window !== "undefined") {
            if (!window.interruptionCounter) window.interruptionCounter = 0
            window.interruptionCounter++

            // Incrementar el contador más rápido si el nivel es muy alto
            if (normalizedValue > adaptiveThreshold * 1.5) {
              window.interruptionCounter++
            }
          }

          // Requerir más muestras consecutivas para interrupción pero con umbral dinámico
          // Ajustar según el nivel de sensibilidad (3-1 muestras)
          const requiredSamples = Math.max(1, 4 - Math.floor(sensitivityLevel / 3));
          
          if (typeof window !== "undefined" && window.interruptionCounter > requiredSamples) {
            console.log("Interrupción confirmada por nivel de audio, deteniendo audio")
            window.interruptionCounter = 0
            window.isListeningForInterruption = false
            audioElementRef.current.pause()
            setIsPlayingAudio(false)
            interruptResponse()
          }
        } else {
          // Reducir el contador gradualmente si el nivel baja
          if (typeof window !== "undefined" && window.interruptionCounter > 0) {
            window.interruptionCounter -= 0.5 // Reducción más gradual
          }
        }
      } else {
        // Resetear contador si no estamos reproduciendo o el nivel no es suficiente
        if (typeof window !== "undefined" && window.interruptionCounter) {
          window.interruptionCounter = 0
        }
      }
    } else {
      // Limpiar el temporizador de silencio si existe
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }

      if (isRecording && !silenceTimerRef.current) {
        // No hay actividad de voz y estamos grabando
        // Iniciar temporizador para detener la grabación después de un período de silencio
        silenceTimerRef.current = setTimeout(() => {
          if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            console.log("Silencio detectado, deteniendo grabación")
            stopRecordingRef.current()
          }
          silenceTimerRef.current = null
        }, SILENCE_THRESHOLD_TIME)

        // Resetear contador de interrupción
        if (typeof window !== "undefined" && window.interruptionCounter) {
          window.interruptionCounter = 0
        }
      }
    }

    // Continuar analizando
    requestAnimationFrame(analyzeAudio)
  }, [isRecording, isPlayingAudio, interruptResponse, sensitivityLevel])

  // Función para detener la grabación
  const stopRecording = useCallback(() => {
    console.log("Deteniendo grabación...")

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    setIsRecording(false)
  }, [])

  // Asignar la función stopRecording a la referencia
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  // Función para iniciar la grabación
  const startRecording = useCallback(async () => {
    // Verificar si ya estamos grabando o procesando
    if (isRecording || isProcessing || isPlayingAudio) {
      console.log("No se puede iniciar grabación: ya hay una grabación o procesamiento en curso")
      return
    }

    // Asegurar reseteo
    processingQueueRef.current = false

    try {
      console.log("=== INICIANDO GRABACIÓN ===")
      processingQueueRef.current = true

      // Limpiar recursos previos
      cleanupAudioResources()

      // Resetear el estado
      setError(null)
      audioChunksRef.current = []

      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      microphoneStreamRef.current = stream

      // Configurar análisis de audio
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        if (typeof window !== "undefined") {
          window.audioContext = audioContextRef.current
        }
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
      }

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Calibrar el nivel de ruido ambiental después de un breve período
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current)
      }
      
      calibrationTimeoutRef.current = setTimeout(() => {
        calibrateAmbientNoise()
      }, 1000)

      // Iniciar análisis de audio
      analyzeAudio()

      // Crear el MediaRecorder con manejo de errores mejorado
      const options: any = {}

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus"
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm"
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      // Configurar eventos
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("Error en MediaRecorder:", event)
        setError("Error en la grabación: " + (event.error ? event.error.message : "Error desconocido"))
        processingQueueRef.current = false
        setIsRecording(false)

        // Reintentar después de un error
        setNeedsRestart(true)
      }

      mediaRecorder.onstop = async () => {
        console.log("Grabación detenida, procesando audio...")

        // Si no hay chunks, reiniciar grabación
        if (audioChunksRef.current.length === 0) {
          console.log("No hay datos de audio, reiniciando grabación")
          setIsRecording(false)
          processingQueueRef.current = false
          setNeedsRestart(true)
          return
        }

        try {
          // Crear blob de audio
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" })

          // Si el blob es muy pequeño, probablemente sea ruido
          if (audioBlob.size < 1000) {
            console.log(`Audio demasiado pequeño (${audioBlob.size} bytes), probablemente ruido`)
            setIsRecording(false)
            processingQueueRef.current = false
            setNeedsRestart(true)
            return
          }

          // Convertir blob a base64
          const reader = new FileReader()
          reader.readAsDataURL(audioBlob)
          reader.onloadend = async () => {
            const base64Data = reader.result?.toString() || ""
            const base64Audio = base64Data.split(",")[1] // Extraer solo la parte base64

            if (base64Audio) {
              setIsProcessing(true)

              try {
                // Enviar audio al servidor
                const response = await fetch("/api/poll", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    clientId,
                    action: "transcribe",
                    language,
                    data: {
                      audio: base64Audio,
                      lastText: lastTranscribedTextRef.current,
                      conversationHistory: conversationHistory,
                    },
                  }),
                })

                if (!response.ok) {
                  throw new Error(`Error en la solicitud: ${response.status}`)
                }

                const data = await response.json()

                if (data.success) {
                  if (!data.ignored && data.transcribedText) {
                    lastTranscribedTextRef.current = data.transcribedText
                    setCurrentResponseId(data.responseId || null)
                  } else if (data.ignored) {
                    // Si la transcripción fue ignorada, reanudar la escucha
                    setIsProcessing(false)
                    processingQueueRef.current = false
                    setNeedsRestart(true)
                  }
                } else {
                  console.warn("Transcripción ignorada:", data.reason)
                  setIsProcessing(false)
                  processingQueueRef.current = false
                  setNeedsRestart(true)
                }
              } catch (error) {
                console.error("Error al enviar audio:", error)
                setError("Error al enviar audio: " + (error instanceof Error ? error.message : String(error)))
                setIsProcessing(false)
                processingQueueRef.current = false
                setNeedsRestart(true)
              }
            } else {
              processingQueueRef.current = false
              setNeedsRestart(true)
            }
          }
        } catch (error) {
          console.error("Error al procesar audio:", error)
          setError("Error al procesar audio: " + (error instanceof Error ? error.message : String(error)))
          setIsRecording(false)
          setIsProcessing(false)
          processingQueueRef.current = false
          setNeedsRestart(true)
        }
      }

      // Iniciar grabación
      mediaRecorder.start()
      setIsRecording(true)
      processingQueueRef.current = false
      console.log("Grabación iniciada correctamente")

      // Configurar timeout para detener la grabación después de MAX_RECORDING_DURATION
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }

      // Aumentar el tiempo máximo de grabación para frases más largas
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          console.log("Tiempo máximo de grabación alcanzado, deteniendo grabación")
          stopRecordingRef.current()
        }
      }, MAX_RECORDING_DURATION)
    } catch (error) {
      console.error("Error al iniciar grabación:", error)
      setError("Error al iniciar grabación: " + (error instanceof Error ? error.message : String(error)))
      setIsRecording(false)
      processingQueueRef.current = false

      // Reintentar después de un error
      setNeedsRestart(true)
    }
  }, [
    clientId,
    language,
    conversationHistory,
    isRecording,
    isProcessing,
    isPlayingAudio,
    analyzeAudio,
    cleanupAudioResources,
    calibrateAmbientNoise,
  ])

  // Asignar la función startRecording a la referencia
  useEffect(() => {
    startRecordingRef.current = startRecording
  }, [startRecording])

  // Efecto para iniciar el polling al cargar la página
  useEffect(() => {
    const cleanup = startPolling()

    // Limpiar al desmontar
    return cleanup
  }, [startPolling])

  // Efecto para hacer ping al servidor
  useEffect(() => {
    // Hacer ping inicial con reintento
    const doPing = async () => {
      try {
        const success = await pingServer()
        if (!success) {
          console.log("Ping fallido, reintentando en 3 segundos...")
          setTimeout(doPing, 3000)
        } else {
          console.log("Conexión establecida con el servidor")
        }
      } catch (error) {
        console.error("Error en ping inicial, reintentando en 3 segundos:", error)
        setTimeout(doPing, 3000)
      }
    }

    doPing()

    // Configurar intervalo de ping con manejo de errores
    pingIntervalRef.current = setInterval(() => {
      pingServer().catch((error) => {
        console.error("Error en ping periódico:", error)
      })
    }, 30000)

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [pingServer])

  // Efecto para limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      cleanupAudioResources()
    }
  }, [cleanupAudioResources])

  // Efecto para reiniciar la grabación cuando sea necesario
  useEffect(() => {
    if (needsRestart) {
      console.log("Reiniciando grabación por needsRestart flag...")

      // Limpiar cualquier timer de reinicio existente
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
      }

      // Usar un timeout más corto para asegurar que todos los estados se actualicen
      restartTimerRef.current = setTimeout(() => {
        if (!isRecording && !isProcessing && !isPlayingAudio) {
          console.log("Ejecutando reinicio de grabación...")
          setNeedsRestart(false)
          startRecordingRef.current()
        } else {
          console.log("No se puede reiniciar grabación, estados actuales:", {
            isRecording,
            isProcessing,
            isPlayingAudio,
          })

          // Si hay un bloqueo, forzar limpieza y reintentar
          if (isRecording || isProcessing || isPlayingAudio) {
            console.log("Forzando limpieza de recursos y reinicio...")
            cleanupAudioResources()
            processingQueueRef.current = false
            setIsRecording(false)
            setIsProcessing(false)
            setIsPlayingAudio(false)

            // Reintentar después de la limpieza forzada con menor delay
            setTimeout(() => {
              setNeedsRestart(false)
              startRecordingRef.current()
            }, 200) // Reducido para mejor fluidez
          }
        }
      }, 500) // Reducido para mejor fluidez

      return () => {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current)
        }
      }
    }
  }, [needsRestart, isRecording, isProcessing, isPlayingAudio, cleanupAudioResources])

  // Mecanismo de recuperación menos agresivo
  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      // Verificar si el sistema podría estar atascado
      const currentTime = Date.now()
      const timeSinceLastActivity = currentTime - lastVoiceActivityRef.current

      if (!isRecording && !isProcessing && !isPlayingAudio && timeSinceLastActivity > 4000) {
        console.log("Sistema posiblemente atascado, reiniciando grabación...")
        processingQueueRef.current = false

        if (startRecordingRef.current) {
          startRecordingRef.current()
        }
      }
    }, 3000) // Verificar con menos frecuencia

    return () => clearInterval(recoveryInterval)
  }, [isRecording, isProcessing, isPlayingAudio])

  // Añadir un botón físico para interrupciones
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === " ") && isPlayingAudio) {
        console.log("Interrupción manual global detectada (tecla Escape o Espacio)")
        interruptResponse()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isPlayingAudio, interruptResponse])

  // Renderizar la interfaz de usuario
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Asistente de Voz</h1>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full mr-2 ${isServerConnected ? "bg-green-500" : "bg-red-500"}`}></div>
              <span className="text-sm text-gray-500">{isServerConnected ? "Conectado" : "Desconectado"}</span>
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <Settings className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Configuración</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-700 block mb-1">Idioma</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="it">Italiano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-gray-700 block mb-1">
                    Sensibilidad de detección de voz: {sensitivityLevel}
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={sensitivityLevel} 
                    onChange={(e) => setSensitivityLevel(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Baja</span>
                    <span>Alta</span>
                  </div>
                </div>
                <div>
                  <button 
                    onClick={calibrateAmbientNoise}
                    className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Calibrar ruido ambiental
                  </button>
                </div>
              </div>
            </div>
          )}

          {!showSettings && (
            <div className="mb-4">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un idioma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto">
              <p className="text-gray-700">{transcribedText || "Habla para ver la transcripción aquí..."}</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto">
              <p className="text-blue-700">{responseText || "La respuesta aparecerá aquí..."}</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Indicador de nivel de audio */}
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-100"
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              ></div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-green-700 font-medium">
                {isRecording ? (
                  <span className="flex items-center justify-center">
                    <Mic className="mr-2 h-5 w-5 animate-pulse text-red-500" /> Escuchando...
                  </span>
                ) : isProcessing ? (
                  "Procesando..."
                ) : isPlayingAudio ? (
                  <span className="flex items-center justify-center">
                    <Volume2 className="mr-2 h-5 w-5 animate-pulse" /> Reproduciendo respuesta...
                  </span>
                ) : (
                  "Iniciando escucha..."
                )}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Di "oye", "disculpa" o "para" para interrumpir la respuesta actual
              </p>
            </div>

            {/* Botón de interrupción manual */}
            {isPlayingAudio && (
              <button
                onClick={interruptResponse}
                className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded transition-colors"
              >
                Interrumpir respuesta
              </button>
            )}

            {/* Botón para forzar reinicio de grabación */}
            {!isRecording && !isPlayingAudio && (
              <button
                onClick={() => setNeedsRestart(true)}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition-colors"
              >
                Reiniciar grabación
              </button>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Historial de conversación:</h3>
            <div className="bg-white rounded-lg p-3 max-h-[200px] overflow-y-auto text-xs">
              {conversationHistory.length === 0 ? (
                <p className="text-gray-500">No hay historial de conversación</p>
              ) : (
                conversationHistory.map((msg, index) => (
                  <div key={index} className={`mb-2 ${msg.role === "user" ? "text-blue-600" : "text-green-600"}`}>
                    <span className="font-bold">{msg.role === "user" ? "Tú: " : "Asistente: "}</span>
                    {msg.content}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}















































// "use client"

// import { useRef, useState, useEffect, useCallback } from "react"
// // Importación directa del componente
// import Avatar3D from "@/components/Avatar3D"

// export default function Home() {
//   const [isListening, setIsListening] = useState(false)
//   const [isProcessing, setIsProcessing] = useState(false)
//   const [isPlayingAudio, setIsPlayingAudio] = useState(false)
//   const [transcript, setTranscript] = useState("")
//   const [response, setResponse] = useState("")
//   const [currentSpeechText, setCurrentSpeechText] = useState("")
//   const [error, setError] = useState<string | null>(null)
//   const [avatarState, setAvatarState] = useState<"idle" | "listening" | "speaking">("idle")
//   const [clientId] = useState<string>(() => `client_${Date.now()}`)
//   const [lastTimestamp, setLastTimestamp] = useState<number>(0)
//   const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
//   const [selectedDish, setSelectedDish] = useState<any>(null)
//   const [dishImage, setDishImage] = useState<string | null>(null)
//   const [isRecording, setIsRecording] = useState(false)
//   const [isServerConnected, setIsServerConnected] = useState(false)
//   const [pollingPaused, setPollingPaused] = useState(false)

//   // Referencias
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null)
//   const audioChunksRef = useRef<Blob[]>([])
//   const audioElementRef = useRef<HTMLAudioElement | null>(null)
//   const isMounted = useRef(true)
//   const messagesEndRef = useRef<HTMLDivElement>(null)
//   const consecutiveErrorsRef = useRef(0)
//   const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const avatarRef = useRef<HTMLIFrameElement | null>(null)

//   // Ping server to check connection
//   const pingServer = useCallback(async () => {
//     try {
//       console.log("Pinging server to check connection...")

//       const controller = new AbortController()
//       const timeoutId = setTimeout(() => controller.abort(), 5000)

//       const response = await fetch("/api/poll", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           clientId,
//           action: "ping",
//         }),
//         signal: controller.signal,
//       })

//       clearTimeout(timeoutId)

//       if (!response.ok) {
//         throw new Error(`Server ping failed: ${response.status}`)
//       }

//       const data = await response.json()
//       console.log("Server ping response:", data)

//       setIsServerConnected(true)
//       setError(null)
//       return true
//     } catch (error) {
//       console.error("Server ping failed:", error)
//       setIsServerConnected(false)
//       setError(`Error de conexión: ${error instanceof Error ? error.message : String(error)}`)
//       return false
//     }
//   }, [clientId])

//   // Send message to avatar
//   const sendMessageToAvatar = useCallback((type: string, data: any = {}) => {
//     if (avatarRef.current && avatarRef.current.contentWindow) {
//       try {
//         avatarRef.current.contentWindow.postMessage({ type, data }, "*")
//       } catch (err) {
//         console.error("Error sending message to avatar:", err)
//       }
//     }
//   }, [])

//   // Polling hook functionality
//   const sendAction = useCallback(
//     async (action: string, payload?: any) => {
//       try {
//         console.log(`Sending ${action} action to server...`)

//         // Check server connection first
//         if (!isServerConnected && action !== "ping") {
//           const connected = await pingServer()
//           if (!connected) {
//             throw new Error("No hay conexión con el servidor")
//           }
//         }

//         // Add timeout to prevent hanging requests
//         const controller = new AbortController()
//         const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

//         const response = await fetch("/api/poll", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             clientId,
//             action,
//             payload,
//           }),
//           signal: controller.signal,
//         })

//         clearTimeout(timeoutId)

//         // Handle different error status codes
//         if (!response.ok) {
//           let errorMessage = `Error en la solicitud: ${response.status}`

//           try {
//             // Try to get more detailed error from response
//             const errorData = await response.json()
//             if (errorData && errorData.error) {
//               errorMessage = `Error: ${errorData.error}`
//             }
//           } catch (parseError) {
//             // If we can't parse the error response, use the status code
//             console.warn("Could not parse error response:", parseError)
//           }

//           throw new Error(errorMessage)
//         }

//         const data = await response.json()
//         return data
//       } catch (error) {
//         // Handle abort errors differently
//         if (error.name === "AbortError") {
//           console.error("Request timed out:", action)
//           setError("La solicitud ha tardado demasiado tiempo. Inténtalo de nuevo.")
//         } else {
//           console.error(`Error sending ${action} action:`, error)
//           setError(error instanceof Error ? error.message : "Error desconocido")
//         }
//         throw error
//       }
//     },
//     [clientId, isServerConnected, pingServer],
//   )

//   const stopRecording = useCallback(() => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
//       mediaRecorderRef.current.stop()
//     }
//     setIsRecording(false)
//     setAvatarState("idle")
//   }, [])

//   // Audio recorder hook functionality
//   const startRecording = useCallback(async () => {
//     try {
//       if (isRecording || isProcessing || isPlayingAudio) return

//       // Check server connection before starting recording
//       if (!isServerConnected) {
//         const connected = await pingServer()
//         if (!connected) {
//           setError("No se puede iniciar la grabación: no hay conexión con el servidor")
//           return
//         }
//       }

//       audioChunksRef.current = []

//       // Request microphone permissions
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

//       // Configure MediaRecorder
//       const options: MediaRecorderOptions = {}

//       if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
//         options.mimeType = "audio/webm;codecs=opus"
//       } else if (MediaRecorder.isTypeSupported("audio/webm")) {
//         options.mimeType = "audio/webm"
//       }

//       const mediaRecorder = new MediaRecorder(stream, options)
//       mediaRecorderRef.current = mediaRecorder

//       // Set up events
//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           audioChunksRef.current.push(event.data)
//         }
//       }

//       mediaRecorder.onstop = async () => {
//         // Process the recorded audio
//         if (audioChunksRef.current.length > 0) {
//           const audioBlob = new Blob(audioChunksRef.current, {
//             type: mediaRecorder.mimeType || "audio/webm",
//           })

//           // Check if the blob is too small (likely just noise)
//           if (audioBlob.size < 1000) {
//             console.log("Audio blob too small, likely just noise. Restarting recording.")
//             setTimeout(() => {
//               if (isMounted.current) {
//                 startRecording()
//               }
//             }, 500)
//             return
//           }

//           // Convert to base64 and send to server
//           const reader = new FileReader()
//           reader.readAsDataURL(audioBlob)
//           reader.onloadend = async () => {
//             try {
//               const base64Data = reader.result?.toString() || ""
//               const base64Audio = base64Data.split(",")[1]

//               if (base64Audio) {
//                 setIsProcessing(true)

//                 try {
//                   const result = await sendAction("transcribe", { audio: base64Audio })
//                   console.log("Transcription result:", result)

//                   if (!result.success) {
//                     console.warn("Transcription was not successful:", result)
//                     setIsProcessing(false)
//                     if (result.error) {
//                       setError(`Error en la transcripción: ${result.error}`)
//                     }

//                     // Restart recording after a short delay
//                     setTimeout(() => {
//                       if (isMounted.current) {
//                         startRecording()
//                       }
//                     }, 2000)
//                   }
//                 } catch (apiError) {
//                   console.error("API error during transcription:", apiError)
//                   setIsProcessing(false)
//                   setError(`Error al enviar audio: ${apiError instanceof Error ? apiError.message : String(apiError)}`)

//                   // Restart recording after a short delay
//                   setTimeout(() => {
//                     if (isMounted.current) {
//                       startRecording()
//                     }
//                   }, 2000)
//                 }
//               }
//             } catch (processError) {
//               console.error("Error processing audio data:", processError)
//               setIsProcessing(false)
//               setError(
//                 `Error al procesar audio: ${processError instanceof Error ? processError.message : String(processError)}`,
//               )

//               // Restart recording after a short delay
//               setTimeout(() => {
//                 if (isMounted.current) {
//                   startRecording()
//                 }
//               }, 2000)
//             }
//           }
//         }

//         setIsRecording(false)
//         setAvatarState("idle")
//       }

//       // Start recording
//       mediaRecorder.start()
//       setIsRecording(true)
//       setAvatarState("listening")

//       // Tell avatar to start listening
//       sendMessageToAvatar("LISTEN")

//       // Set timeout to stop recording after a while
//       setTimeout(() => {
//         if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
//           stopRecording()
//         }
//       }, 5000)
//     } catch (error) {
//       console.error("Error starting recording:", error)
//       setError(`Error al iniciar la grabación: ${error instanceof Error ? error.message : String(error)}`)
//       setIsRecording(false)
//       setAvatarState("idle")
//     }
//   }, [
//     isRecording,
//     isProcessing,
//     isPlayingAudio,
//     stopRecording,
//     sendAction,
//     isServerConnected,
//     pingServer,
//     sendMessageToAvatar,
//   ])

//   // Audio player hook functionality
//   const playAudio = useCallback(
//     async (audioUrl: string, responseText = "") => {
//       try {
//         // Stop any previous playback
//         if (audioElementRef.current) {
//           audioElementRef.current.pause()
//           audioElementRef.current.src = ""
//         }

//         // Create a new audio element
//         const audio = new Audio(audioUrl)
//         audioElementRef.current = audio

//         // Set up events
//         audio.onplay = () => {
//           setIsPlayingAudio(true)
//           setAvatarState("speaking")

//           // Tell avatar to speak the response text
//           if (responseText) {
//             setCurrentSpeechText(responseText)
//             sendMessageToAvatar("SPEAK", { text: responseText })
//           }
//         }

//         audio.onended = () => {
//           setIsPlayingAudio(false)
//           setAvatarState("idle")
//           setIsProcessing(false)
//           setCurrentSpeechText("")

//           // Tell avatar to go back to idle
//           sendMessageToAvatar("IDLE")

//           // Restart listening after a brief delay
//           setTimeout(() => {
//             if (isMounted.current) {
//               startRecording()
//             }
//           }, 1000)
//         }

//         audio.onerror = (error) => {
//           console.error("Error playing audio:", error)
//           setError("Error al reproducir audio")
//           setIsPlayingAudio(false)
//           setAvatarState("idle")
//           setCurrentSpeechText("")

//           // Restart recording after error
//           setTimeout(() => {
//             if (isMounted.current) {
//               startRecording()
//             }
//           }, 2000)
//         }

//         // Play audio
//         setAvatarState("speaking")
//         setIsPlayingAudio(true)
//         await audio.play()
//       } catch (error) {
//         console.error("Error playing audio:", error)
//         setError(`Error al reproducir audio: ${error instanceof Error ? error.message : String(error)}`)
//         setIsPlayingAudio(false)
//         setAvatarState("idle")
//         setCurrentSpeechText("")

//         // Restart recording after error
//         setTimeout(() => {
//           if (isMounted.current) {
//             startRecording()
//           }
//         }, 2000)
//       }
//     },
//     [startRecording, sendMessageToAvatar],
//   )

//   const stopAudio = useCallback(() => {
//     if (audioElementRef.current) {
//       audioElementRef.current.pause()
//       audioElementRef.current.src = ""
//       setIsPlayingAudio(false)
//       setAvatarState("idle")
//       setCurrentSpeechText("")

//       // Tell avatar to go back to idle
//       sendMessageToAvatar("IDLE")
//     }
//   }, [sendMessageToAvatar])

//   // Function to handle polling
//   const doPoll = useCallback(async () => {
//     if (pollingPaused) return

//     try {
//       // Add cache buster to prevent caching issues
//       const cacheBuster = Date.now()
//       const controller = new AbortController()
//       const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

//       const response = await fetch(`/api/poll?clientId=${clientId}&lastTimestamp=${lastTimestamp}&_=${cacheBuster}`, {
//         signal: controller.signal,
//       })

//       clearTimeout(timeoutId)

//       if (!response.ok) {
//         throw new Error(`Error en la respuesta: ${response.status}`)
//       }

//       const data = await response.json()

//       // Reset error counter on successful request
//       consecutiveErrorsRef.current = 0
//       setIsServerConnected(true)

//       // Check if data has the expected structure
//       if (data) {
//         // Handle both array format and object with messages property
//         const messages = Array.isArray(data) ? data : data.messages || []

//         if (messages.length > 0) {
//           console.log(`Received ${messages.length} messages from server`)

//           // Process messages
//           for (const message of messages) {
//             if (message.timestamp > lastTimestamp) {
//               setLastTimestamp(message.timestamp)
//             }

//             // Handle different message types
//             if (message.action === "transcriptionResult" || message.event === "transcription") {
//               const transcriptText = message.transcript || (message.data && message.data.text) || ""
//               setTranscript(transcriptText)
//               if (transcriptText) {
//                 setConversationHistory((prev) => [...prev, { role: "user", content: transcriptText }])
//               }
//             } else if (message.action === "chatResult" || message.event === "response_chunk") {
//               const responseText = message.response || (message.data && message.data.text) || ""
//               const isComplete = message.data ? message.data.isComplete : true

//               if (responseText && isComplete) {
//                 setResponse(responseText)
//                 setConversationHistory((prev) => [...prev, { role: "assistant", content: responseText }])
//               }

//               const audioUrl = message.audioUrl || (message.data && message.data.audioUrl)
//               if (audioUrl) {
//                 playAudio(audioUrl, responseText)
//               }
//             } else if (message.event === "audio_response") {
//               if (message.data && message.data.responseId) {
//                 const audioUrl = `/api/audio/${message.data.responseId}`
//                 playAudio(audioUrl, message.data.text || response)
//               }
//             } else if (message.action === "error" || message.event === "error") {
//               const errorMsg = message.message || (message.data && message.data.message) || "Error desconocido"
//               console.error("Server reported error:", errorMsg)
//               setError(errorMsg)
//             }
//           }
//         }
//       }

//       // Clear error if polling is successful
//       setError(null)
//     } catch (error) {
//       consecutiveErrorsRef.current++

//       // Only show error after multiple consecutive failures to avoid flickering
//       if (consecutiveErrorsRef.current > 3) {
//         console.error(`Error in polling (attempt ${consecutiveErrorsRef.current}):`, error)

//         if (error.name === "AbortError") {
//           setError("Tiempo de espera agotado al conectar con el servidor")
//         } else {
//           setError(error instanceof Error ? error.message : "Error de conexión")
//         }

//         setIsServerConnected(false)
//       }

//       // If we have too many consecutive errors, pause polling and try to reconnect
//       if (consecutiveErrorsRef.current > 10) {
//         console.log("Too many consecutive errors, pausing polling for 5 seconds")
//         setPollingPaused(true)

//         // Try to reconnect after a delay
//         setTimeout(async () => {
//           const connected = await pingServer()
//           if (connected) {
//             consecutiveErrorsRef.current = 0
//             setPollingPaused(false)
//           } else {
//             // If still can't connect, try again later
//             setTimeout(() => {
//               setPollingPaused(false)
//             }, 10000)
//           }
//         }, 5000)
//       }
//     }
//   }, [clientId, lastTimestamp, playAudio, pollingPaused, pingServer, response])

//   // Start polling for messages
//   useEffect(() => {
//     // Initial ping to check server connection
//     pingServer()

//     // Set up polling interval
//     const intervalId = setInterval(() => {
//       doPoll()
//     }, 1000)

//     pollingIntervalRef.current = intervalId

//     return () => {
//       if (pollingIntervalRef.current) {
//         clearInterval(pollingIntervalRef.current)
//       }
//     }
//   }, [doPoll, pingServer])

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       isMounted.current = false
//       if (audioElementRef.current) {
//         audioElementRef.current.pause()
//         audioElementRef.current.src = ""
//       }
//     }
//   }, [])

//   // Start recording automatically on load
//   useEffect(() => {
//     // Wait for server connection before starting recording
//     const checkConnectionAndStart = async () => {
//       const connected = await pingServer()
//       if (connected) {
//         const timer = setTimeout(() => {
//           startRecording()
//         }, 1000)
//         return () => clearTimeout(timer)
//       } else {
//         // Retry after a delay
//         const retryTimer = setTimeout(() => {
//           checkConnectionAndStart()
//         }, 3000)
//         return () => clearTimeout(retryTimer)
//       }
//     }

//     checkConnectionAndStart()
//   }, [startRecording, pingServer])

//   // Auto-scroll to the latest message
//   useEffect(() => {
//     if (messagesEndRef.current) {
//       messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
//     }
//   }, [conversationHistory])

//   return (
//     <main className="flex min-h-screen flex-col items-center p-4 bg-gray-50">
//       <div className="w-full max-w-4xl bg-white rounded-lg shadow-md overflow-hidden">
//         <div className="bg-blue-600 text-white p-4">
//           <h1 className="text-2xl font-bold text-center">Voice Waiter Bot - La Trattoria Italiana</h1>
//         </div>

//         <div className="flex flex-col md:flex-row">
//           {/* Avatar 3D Panel */}
//           <div className="flex-1 p-4 border-r flex flex-col items-center justify-center">
//             <div className="text-center mb-4">
//               <h2 className="text-4xl font-bold text-red-500">AVATAR 3D</h2>
//               <div className="flex items-center justify-center mt-1">
//                 <div className={`w-3 h-3 rounded-full mr-2 ${isServerConnected ? "bg-green-500" : "bg-red-500"}`}></div>
//                 <span className="text-sm text-gray-500">
//                   {isServerConnected ? "Servidor conectado" : "Servidor desconectado"}
//                 </span>
//               </div>
//             </div>
//             <div className="h-96 w-full bg-gray-100 rounded-lg">
//               <Avatar3D
//                 isListening={isRecording}
//                 isSpeaking={isPlayingAudio}
//                 speechText={currentSpeechText}
//                 ref={avatarRef}
//               />
//             </div>
//             <div className="mt-4 text-center">
//               <p className="text-gray-700">El sistema está escuchando automáticamente...</p>
//               {isRecording && <p className="text-blue-600 font-bold">Grabando...</p>}
//               {isPlayingAudio && <p className="text-green-600 font-bold">Hablando...</p>}
//             </div>

//             {isProcessing && (
//               <div className="text-center mt-4">
//                 <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
//                 <p className="mt-2 text-gray-600">Procesando tu mensaje...</p>
//               </div>
//             )}

//             {error && (
//               <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
//                 <p className="font-bold">Error:</p>
//                 <p>{error}</p>
//                 <button
//                   onClick={() => pingServer()}
//                   className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
//                 >
//                   Reintentar conexión
//                 </button>
//               </div>
//             )}
//           </div>

//           {/* Right panel with conversation and images */}
//           <div className="w-full md:w-1/2 flex flex-col">
//             {/* Conversation panel */}
//             <div className="p-4 border-b">
//               <h2 className="text-xl font-bold mb-2 text-red-500">CONVERSACIÓN</h2>
//               <div className="h-48 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
//                 {conversationHistory.length === 0 ? (
//                   <div className="text-center text-gray-500 mt-10">
//                     <p>La conversación aparecerá aquí</p>
//                   </div>
//                 ) : (
//                   conversationHistory.map((msg, index) => (
//                     <div
//                       key={index}
//                       className={`mb-3 p-3 rounded-lg ${msg.role === "user" ? "bg-blue-100 ml-8" : "bg-gray-200 mr-8"}`}
//                     >
//                       {msg.content}
//                     </div>
//                   ))
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>
//             </div>

//             {/* Images panel */}
//             <div className="p-4 flex-1">
//               <h2 className="text-xl font-bold mb-2 text-red-500">IMÁGENES</h2>
//               {selectedDish ? (
//                 <div className="bg-gray-50 p-4 rounded-lg">
//                   <h3 className="text-lg font-bold mb-2">{selectedDish.nombre}</h3>

//                   {dishImage && (
//                     <div className="mb-4 rounded-lg overflow-hidden">
//                       <img
//                         src={dishImage || "/placeholder.svg"}
//                         alt={selectedDish.nombre}
//                         className="w-full h-48 object-cover"
//                         onError={(e) => {
//                           const target = e.target as HTMLImageElement
//                           target.src = "/placeholder.svg?height=200&width=300"
//                         }}
//                       />
//                     </div>
//                   )}

//                   <p className="text-gray-700 mb-2">{selectedDish.descripcion}</p>

//                   <div className="flex justify-between items-center mb-2">
//                     <span className="font-bold">Precio:</span>
//                     <span className="text-green-600 font-bold">{selectedDish.precio}€</span>
//                   </div>

//                   {selectedDish.alergenos && selectedDish.alergenos.length > 0 && (
//                     <div className="mb-2">
//                       <span className="font-bold">Alérgenos:</span>
//                       <span className="ml-2">{selectedDish.alergenos.join(", ")}</span>
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500 h-48 flex flex-col justify-center">
//                   <p>Selecciona un plato para ver su información</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </main>
//   )
// }







