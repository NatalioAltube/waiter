import { type NextRequest, NextResponse } from "next/server"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import fs from 'fs'
import path from 'path'

// ADVERTENCIA: Incluir API keys en el código es un riesgo de seguridad
// Solo para desarrollo, nunca para producción
const OPENAI_API_KEY = "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";  // Reemplaza esto con tu API key real

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

// Función para cargar los datos del restaurante
function loadRestaurantData() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'restaurant-data.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error("Error al cargar los datos del restaurante:", error);
    // Devolver un objeto vacío en caso de error para evitar que la aplicación falle
    return { 
      restaurante: { nombre: "Restaurante" },
      menu: { entrantes: [], platos_principales: [], postres: [], bebidas: [] },
      especiales_del_dia: []
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    
    // Cargar datos del restaurante
    const restaurantData = loadRestaurantData()

    // Crear cliente OpenAI con la API key directa
    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
    })

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: `You are a helpful assistant for waiters in a restaurant called "${restaurantData.restaurante?.nombre || 'nuestro restaurante'}". 
      Provide concise, practical responses about taking orders, handling customer requests, 
      menu recommendations, and restaurant procedures. Be polite and professional.
      Keep responses brief and to the point, as if speaking in a busy restaurant environment.
      
      Here is the current restaurant information, menu and specials:
      ${JSON.stringify(restaurantData, null, 2)}
      
      Use this information to answer questions about the menu, ingredients, prices, 
      allergens, and any other restaurant-specific information. If asked about items 
      not on the menu, politely explain they are not available but suggest similar 
      alternatives from the menu. If asked about images or photos, explain that you can 
      describe the dishes but cannot show images directly.
      
      When recommending dishes, consider dietary restrictions, popular items, and chef's specials.
      If you don't know specific information that's not in the restaurant data, be honest and offer to check with the kitchen.`,
      messages,
    })

    return NextResponse.json({ message: text })
  } catch (error) {
    console.error("Error generating chat response:", error)
    return NextResponse.json(
      { error: "Failed to generate response: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

