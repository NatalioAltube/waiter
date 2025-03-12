import { NextResponse } from "next/server";

const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY;
const FACE_ID = "13c29695-3b4e-4ee8-b12d-fcab81a50ea5"; 
const VOICE_ID = "bf5d344d-62b4-4fb8-9073-312bb29c7e4f";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
    }

    const response = await fetch("https://api.simli.ai/v1/speak", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SIMLI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        faceId: FACE_ID,
        voiceId: VOICE_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error en Simli API:", response.status, errorText);
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log("✅ Respuesta de Simli:", data);

    return NextResponse.json(data);

  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}










