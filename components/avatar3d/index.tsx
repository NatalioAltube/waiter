"use client"

import { useEffect, useState } from "react"

interface Avatar3DProps {
  state: "idle" | "listening" | "speaking"
}

export function Avatar3D({ state }: Avatar3DProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Simular tiempo de carga
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // Determinar qué imagen mostrar según el estado
  const getAvatarImage = () => {
    switch (state) {
      case "listening":
        return "/avatar-listening.png"
      case "speaking":
        return "/avatar-speaking.png"
      case "idle":
      default:
        return "/avatar-idle.png"
    }
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      {/* Fallback a un avatar simple si no hay imágenes disponibles */}
      <div className="relative w-32 h-32 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden">
        <div className="text-white text-4xl">
          {state === "idle" && "😊"}
          {state === "listening" && "👂"}
          {state === "speaking" && "🗣️"}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 bg-green-500 ${
            state === "speaking" ? "animate-pulse" : "opacity-0"
          }`}
        ></div>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {state === "idle" && "Esperando..."}
        {state === "listening" && "Escuchando..."}
        {state === "speaking" && "Hablando..."}
      </p>
    </div>
  )
}

