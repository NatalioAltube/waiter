// En utils/simli.ts
export const speakWithSimli = async (text: string) => {
  try {
    // No podemos usar window.location.origin en el servidor
    // Usamos una URL absoluta o relativa dependiendo del entorno
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3000";
    
    const ttsResponse = await fetch(`${baseUrl}/api/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      throw new Error(`Error generando audio: ${errorText}`);
    }

    console.log("[speakWithSimli] Audio generado correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error en speakWithSimli:", error);
    return false;
  }
};

// export const speakWithSimli = async (text: string) => {
//   try {
//     // Primero generamos el audio con OpenAI
//     const ttsResponse = await fetch("/api/text-to-speech", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ text }),
//     });

//     if (!ttsResponse.ok) {
//       throw new Error("Error generando audio");
//     }

//     // Obtener el audio como blob
//     const audioBlob = await ttsResponse.blob();
//     const audioUrl = URL.createObjectURL(audioBlob);

//     // Reproducir el audio
//     const audio = new Audio(audioUrl);
//     await audio.play();

//     // Limpiar cuando termine
//     audio.onended = () => {
//       URL.revokeObjectURL(audioUrl);
//     };

//     return true;
//   } catch (error) {
//     console.error("❌ Error en speakWithSimli:", error);
//     return false;
//   }
// };

















  