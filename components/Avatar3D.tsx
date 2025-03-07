"use client"

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react"

interface Avatar3DProps {
  state?: "idle" | "listening" | "speaking"
  isListening?: boolean
  isSpeaking?: boolean
  speechText?: string
}

const Avatar3D = forwardRef<HTMLIFrameElement, Avatar3DProps>(function Avatar3D(
  { state, isListening, isSpeaking, speechText = "" },
  ref,
) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const currentState = state || (isSpeaking ? "speaking" : isListening ? "listening" : "idle")
  const apiKey = process.env.NEXT_PUBLIC_SIMIL_API_KEY

  // Expose the iframe ref to parent component
  useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement)

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        switch (event.data.type) {
          case "AVATAR_READY":
            console.log("Avatar is ready")
            setIsLoaded(true)
            setError(null)
            break

          case "AVATAR_ERROR":
            console.error("Avatar error:", event.data.error)
            setError(event.data.error || "Error en el avatar")
            break

          case "SPEAK_COMPLETE":
            console.log("Avatar finished speaking")
            break
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // Send message to the iframe
  const sendMessage = (type: string, data: any = {}) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type, data }, "*")
      } catch (err) {
        console.error("Error sending message to avatar:", err)
      }
    }
  }

  // Handle state changes
  useEffect(() => {
    if (!isLoaded) return

    switch (currentState) {
      case "speaking":
        if (speechText) {
          sendMessage("SPEAK", { text: speechText })
        } else {
          sendMessage("ANIMATE", { animation: "speaking" })
        }
        break

      case "listening":
        sendMessage("LISTEN")
        break

      case "idle":
        sendMessage("IDLE")
        break
    }
  }, [currentState, isLoaded, speechText])

  // Initialize avatar when API key is available
  useEffect(() => {
    if (apiKey && iframeRef.current) {
      // Set API key
      sendMessage("SET_API_KEY", { apiKey })
    }
  }, [apiKey])

  return (
    <div className="w-full h-full relative bg-gray-100 rounded-lg overflow-hidden">
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Cargando avatar...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
          <div className="text-center p-4">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Avatar iframe */}
      <iframe
        ref={iframeRef}
        src="/avatar.html"
        className="w-full h-full border-0"
        allow="camera; microphone; clipboard-write"
        title="SIMIL Avatar"
      />

      {/* Status indicator */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
        <div className="inline-block px-3 py-1 bg-black bg-opacity-50 rounded-full text-white text-sm">
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                currentState === "idle"
                  ? "bg-gray-400"
                  : currentState === "listening"
                    ? "bg-blue-500 animate-pulse"
                    : "bg-green-500 animate-pulse"
              }`}
            />
            {currentState === "idle" && "Esperando..."}
            {currentState === "listening" && "Escuchando..."}
            {currentState === "speaking" && "Hablando..."}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Avatar3D















