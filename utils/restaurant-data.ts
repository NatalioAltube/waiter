// Interfaz para los datos del restaurante
interface RestaurantData {
  nombre: string
  descripcion: string
  horario: string
  menu: Array<{
    nombre: string
    platos: Array<{
      nombre: string
      descripcion: string
      precio: number
    }>
  }>
}

let cachedData: RestaurantData | null = null

/**
 * Obtiene los datos del restaurante desde el archivo JSON
 */
export async function getRestaurantData(): Promise<RestaurantData> {
  if (cachedData) {
    return cachedData
  }

  try {
    const response = await fetch("/api/restaurant-data")
    if (!response.ok) {
      throw new Error("Error al cargar los datos del restaurante")
    }

    const data = await response.json()
    cachedData = data
    return data
  } catch (error) {
    console.error("Error al cargar los datos del restaurante:", error)
    throw error
  }
}

/**
 * Genera un prompt mejorado con los datos del restaurante
 */
export async function getRestaurantPrompt(): Promise<string> {
  const data = await getRestaurantData()

  const prompt = `
Eres una camarera virtual llamada María que trabaja en el restaurante "${data.nombre}".

Información del restaurante:
- Descripción: ${data.descripcion}
- Horario: ${data.horario}

Menú completo del restaurante:
${data.menu
  .map(
    (categoria) => `
${categoria.nombre}:
${categoria.platos.map((plato) => `- ${plato.nombre}: ${plato.descripcion}. Precio: ${plato.precio}€`).join("\n")}
`,
  )
  .join("\n")}

Instrucciones importantes:
1. Responde de manera amable y profesional a las preguntas sobre el menú.
2. Sé concisa pero informativa. Tus respuestas deben ser breves (máximo 2-3 frases).
3. Responde siempre en español de España, usando expresiones naturales como "vale", "genial", "perfecto".
4. NO uses formatos como negrita, cursiva o listas con asteriscos.
5. Si te preguntan por un plato que no está en el menú, indícalo amablemente y sugiere alternativas similares de nuestro menú.
6. Usa un tono conversacional y natural, como una camarera española real.
7. Evita usar caracteres especiales como asteriscos, almohadillas o guiones bajos.
8. IMPORTANTE: Siempre responde como si tuvieras el menú delante. NUNCA digas que no tienes el menú o que no conoces los platos.
9. Cuando menciones precios, siempre incluye el símbolo € después del número.
10. Si te preguntan por recomendaciones, sugiere platos específicos del menú.
11. Si te preguntan por ingredientes o alérgenos, responde basándote en la descripción del plato.
12. Usa expresiones faciales apropiadas: sonríe cuando recomiendes algo, muestra interés cuando te pregunten.
13. Si te preguntan algo no relacionado con el restaurante, responde amablemente que eres la camarera y estás ahí para atenderles con el menú.
14. Cuando te saluden, responde con un saludo amable como "¡Hola! Bienvenido/a a La Parrilla Española. ¿En qué puedo ayudarte?"
15. Si te preguntan por el plato más popular, recomienda el "Secreto ibérico" o el "Chuletón de buey".
16. Cuando un cliente pida un plato, confirma el pedido con entusiasmo.
17. Si el cliente dice "finalizar pedido" o similar, resume los platos pedidos y pregunta si desea algo más.
18. Si el cliente menciona "pagar" o "la cuenta", agradece la visita y despídete amablemente.
19.INSTRUCCIÓN SOBRE PRECIOS: Cuando menciones precios, SIEMPRE usa el formato español con el símbolo del euro después del número y la coma como separador decimal.
Por ejemplo:
- "El chuletón de buey cuesta 24,00€"
- "Las patatas bravas cuestan 5,50€"
- "El total de su pedido es 29,50€"
- NUNCA digas "twenty-four euros" o "five point five euros"
- SIEMPRE di "veinticuatro euros" o "cinco euros con cincuenta céntimos"
`

  return prompt
}







// -------------------------------------------------------------------------

// import fs from "fs"
// import path from "path"

// // Tipo para los datos del restaurante
// export interface RestaurantData {
//   nombre: string
//   descripcion: string
//   horario: string
//   menu: {
//     nombre: string
//     platos: {
//       nombre: string
//       descripcion: string
//       precio: number
//     }[]
//   }[]
// }

// // Datos de respaldo en caso de error
// const BACKUP_DATA: RestaurantData = {
//   nombre: "La Parrilla Española",
//   descripcion: "Restaurante especializado en carnes a la parrilla y platos tradicionales españoles.",
//   horario: "Lunes a Domingo de 12:00 a 23:00",
//   menu: [
//     {
//       nombre: "Entrantes",
//       platos: [
//         { nombre: "Patatas bravas", descripcion: "Patatas fritas con salsa picante", precio: 5.5 },
//         { nombre: "Croquetas de jamón", descripcion: "Croquetas caseras de jamón ibérico", precio: 6.0 },
//       ],
//     },
//     {
//       nombre: "Carnes",
//       platos: [
//         { nombre: "Chuletón de buey", descripcion: "Chuletón de buey madurado (500g)", precio: 24.0 },
//         { nombre: "Secreto ibérico", descripcion: "Corte de cerdo ibérico a la parrilla", precio: 18.5 },
//       ],
//     },
//     {
//       nombre: "Postres",
//       platos: [
//         { nombre: "Flan casero", descripcion: "Flan casero con caramelo", precio: 4.5 },
//         { nombre: "Tarta de Santiago", descripcion: "Tarta tradicional de almendra", precio: 5.0 },
//       ],
//     },
//   ],
// }

// let cachedData: RestaurantData | null = null

// export function getRestaurantData(): RestaurantData {
//   // Si ya tenemos datos en caché, los devolvemos
//   if (cachedData) return cachedData

//   try {
//     // Método 1: Intentar cargar desde el sistema de archivos (funciona en desarrollo)
//     try {
//       const filePath = path.join(process.cwd(), "public/data/restaurant-data.json")
//       console.log("Intentando cargar datos desde:", filePath)

//       const fileContents = fs.readFileSync(filePath, "utf8")
//       const data = JSON.parse(fileContents) as RestaurantData

//       console.log("Datos cargados correctamente desde el sistema de archivos")
//       cachedData = data
//       return data
//     } catch (fsError) {
//       console.log("Error al cargar con fs:", fsError)

//       // Método 2: Intentar cargar usando require (funciona en producción)
//       try {
//         // Esto funciona en producción pero puede dar problemas en desarrollo
//         // @ts-ignore - Ignoramos el error de TypeScript
//         const data = require("../../public/data/restaurant-data.json")
//         console.log("Datos cargados correctamente usando require")
//         cachedData = data
//         return data
//       } catch (requireError) {
//         console.log("Error al cargar con require:", requireError)
//         throw new Error("No se pudo cargar el archivo JSON")
//       }
//     }
//   } catch (error) {
//     console.error("Error al cargar los datos del restaurante:", error)
//     console.log("Usando datos de respaldo")

//     // Devolver datos de respaldo
//     cachedData = BACKUP_DATA
//     return BACKUP_DATA
//   }
// }

// export function getRestaurantPrompt(): string {
//   const data = getRestaurantData()

//   return `
// Eres una camarera virtual que trabaja en el restaurante "${data.nombre}".

// Información del restaurante:
// - Descripción: ${data.descripcion}
// - Horario: ${data.horario}

// Menú del restaurante:
// ${data.menu
//   .map(
//     (categoria) => `
// ${categoria.nombre}:
// ${categoria.platos.map((plato) => `- ${plato.nombre}: ${plato.descripcion}. Precio: ${plato.precio}€`).join("\n")}
// `,
//   )
//   .join("\n")}

// Instrucciones:
// 1. Responde de manera amable y profesional a las preguntas sobre el menú.
// 2. Sé concisa pero informativa.
// 3. Responde siempre en español de España.
// 4. No uses caracteres especiales como #, *, _, etc.
// 5. Si te preguntan por un plato que no está en el menú, indícalo amablemente.
// 6. Usa un tono conversacional y natural.
// `
// }

//-------------------------------------------------------------------------------

// import fs from "fs"
// import path from "path"

// // Tipo para los datos del restaurante
// export interface RestaurantData {
//   nombre: string
//   descripcion: string
//   horario: string
//   menu: {
//     nombre: string
//     platos: {
//       nombre: string
//       descripcion: string
//       precio: number
//     }[]
//   }[]
// }

// // Datos de respaldo en caso de error
// const BACKUP_DATA: RestaurantData = {
//   nombre: "Restaurante Demo",
//   descripcion: "Un restaurante de comida española con platos tradicionales.",
//   horario: "Lunes a Domingo de 12:00 a 23:00",
//   menu: [
//     {
//       nombre: "Entrantes",
//       platos: [
//         { nombre: "Patatas bravas", descripcion: "Patatas fritas con salsa picante", precio: 5.5 },
//         { nombre: "Croquetas", descripcion: "Croquetas caseras de jamón", precio: 6.0 },
//       ],
//     },
//     {
//       nombre: "Principales",
//       platos: [
//         { nombre: "Paella", descripcion: "Paella valenciana tradicional", precio: 15.0 },
//         { nombre: "Tortilla española", descripcion: "Tortilla de patatas casera", precio: 8.5 },
//       ],
//     },
//   ],
// }

// let cachedData: RestaurantData | null = null

// export function getRestaurantData(): RestaurantData {
//   if (cachedData) return cachedData

//   try {
//     // Ruta al archivo JSON
//     const filePath = path.join(process.cwd(), "public/data/restaurant-data.json")
//     console.log("Cargando datos del restaurante desde:", filePath)

//     // Leer el archivo
//     const fileContents = fs.readFileSync(filePath, "utf8")

//     // Parsear el JSON
//     const data = JSON.parse(fileContents) as RestaurantData
//     console.log("Datos del restaurante cargados correctamente")

//     // Guardar en caché
//     cachedData = data
//     return data
//   } catch (error) {
//     console.error("Error al cargar los datos del restaurante:", error)
//     console.log("Usando datos de respaldo")

//     // Devolver datos de respaldo
//     cachedData = BACKUP_DATA
//     return BACKUP_DATA
//   }
// }

// export function getRestaurantPrompt(): string {
//   const data = getRestaurantData()

//   return `
// Eres una camarera virtual que trabaja en el restaurante "${data.nombre}".

// Información del restaurante:
// - Descripción: ${data.descripcion}
// - Horario: ${data.horario}

// Menú del restaurante:
// ${data.menu
//   .map(
//     (categoria) => `
// ${categoria.nombre}:
// ${categoria.platos.map((plato) => `- ${plato.nombre}: ${plato.descripcion}. Precio: ${plato.precio}€`).join("\n")}
// `,
//   )
//   .join("\n")}

// Instrucciones:
// 1. Responde de manera amable y profesional a las preguntas sobre el menú.
// 2. Sé concisa pero informativa.
// 3. Responde siempre en español.
// 4. No uses caracteres especiales como #, *, _, etc.
// 5. Si te preguntan por un plato que no está en el menú, indícalo amablemente.
// `
// }







