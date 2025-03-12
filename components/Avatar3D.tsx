"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { createAvatar } from "simli-client"; // Intentar importar el método directamente

interface Avatar3DProps {
  state: "idle" | "listening" | "speaking";
  audioUrl?: string;
  text?: string;
  onAnimationComplete?: () => void;
}

export default function Avatar3D({
  state,
  audioUrl,
  text,
  onAnimationComplete,
}: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const avatarRef = useRef<any>(null);
  const apiKey = process.env.NEXT_PUBLIC_SIMLI_API_KEY;

  useEffect(() => {
    if (!containerRef.current) {
      console.error("❌ No se encontró el contenedor para el avatar.");
      return;
    }

    if (!apiKey) {
      console.error("❌ API Key de Simli no configurada. Revisa tu archivo .env.local");
      return;
    }

    const initializeAvatar = async () => {
      try {
        console.log("✅ Inicializando avatar con Simli...");

        // Intentar crear el avatar utilizando el método createAvatar
        const avatar = await createAvatar({
          apiKey,
          container: containerRef.current,
          model: "clara",
          options: {
            cameraTarget: "head",
            cameraDistance: 0.7,
            backgroundColor: "#f3f4f6",
          },
        });

        avatarRef.current = avatar;
        setIsAvatarLoaded(true);
        console.log("✅ Avatar cargado exitosamente.");

        await avatar.playAnimation("idle");
      } catch (error) {
        console.error("❌ Error al inicializar el avatar:", error);
      }
    };

    initializeAvatar();
  }, [apiKey]);

  useEffect(() => {
    const handleAvatarState = async () => {
      if (!avatarRef.current) {
        console.warn("⚠️ Avatar aún no está listo para cambiar de estado.");
        return;
      }

      const avatar = avatarRef.current;
      console.log(`🔄 Cambiando estado del avatar a: ${state}`);

      try {
        if (state === "speaking" && text && audioUrl) {
          console.log("💬 Avatar hablando con texto y audio.");
          const audio = new Audio(audioUrl);
          audio.oncanplaythrough = async () => {
            await avatar.speak(text, { audio, animation: true });
            if (onAnimationComplete) onAnimationComplete();
          };
          audio.load();
        } else if (state === "listening") {
          await avatar.playAnimation("listening");
        } else {
          await avatar.playAnimation("idle");
        }
      } catch (error) {
        console.error("❌ Error al cambiar el estado del avatar:", error);
      }
    };

    handleAvatarState();
  }, [state, text, audioUrl, onAnimationComplete]);

  return (
    <>
      <div className="w-full h-full relative" style={{ minHeight: "300px" }}>
        <div ref={containerRef} className="w-full h-full absolute inset-0"></div>

        {!isAvatarLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-gray-500 mt-2">Cargando avatar...</p>
          </div>
        )}
      </div>
    </>
  );
}




























