"use client"

import { useEffect, useState } from "react"

interface FallbackAvatarProps {
  state: "idle" | "listening" | "speaking"
  text?: string
}

export default function FallbackAvatar({ state, text }: FallbackAvatarProps) {
  const [animationFrame, setAnimationFrame] = useState(0)

  // Animación simple para el avatar de respaldo
  useEffect(() => {
    let frameId: number | null = null

    if (state === "speaking") {
      const animate = () => {
        setAnimationFrame((prev) => (prev + 1) % 3)
        frameId = requestAnimationFrame(() => {
          setTimeout(animate, 300) // Cambiar cada 300ms
        })
      }

      animate()
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [state])

  // Emojis para cada estado
  const getEmoji = () => {
    if (state === "idle") return "😊"
    if (state === "listening") return "👂"

    // Para el estado "speaking", alternar entre diferentes emojis
    const speakingEmojis = ["🗣️", "😀", "😃"]
    return speakingEmojis[animationFrame]
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg">
      <div className="text-8xl mb-4">{getEmoji()}</div>
      <p className="text-lg font-medium text-gray-700">
        {state === "idle" && "Esperando..."}
        {state === "listening" && "Escuchando..."}
        {state === "speaking" && "Hablando..."}
      </p>
      {state === "speaking" && text && (
        <div className="mt-4 max-w-xs text-center">
          <p className="text-sm text-gray-600">{text}</p>
        </div>
      )}
      {state === "speaking" && (
        <div className="mt-4 w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 animate-pulse rounded-full"></div>
        </div>
      )}
    </div>
  )
}

