// Datos del restaurante directamente en el código
// Esto garantiza que siempre estén disponibles
export const RESTAURANT_DATA = {
    nombre: "La Parrilla Española",
    descripcion: "Restaurante especializado en carnes a la parrilla y platos tradicionales españoles.",
    horario: "Lunes a Domingo de 12:00 a 23:00",
    menu: [
      {
        nombre: "Entrantes",
        platos: [
          { nombre: "Patatas bravas", descripcion: "Patatas fritas con salsa picante", precio: 5.5 },
          { nombre: "Croquetas de jamón", descripcion: "Croquetas caseras de jamón ibérico", precio: 6.0 },
          { nombre: "Tabla de quesos", descripcion: "Selección de quesos españoles", precio: 12.0 },
          { nombre: "Gambas al ajillo", descripcion: "Gambas salteadas con ajo y guindilla", precio: 9.5 },
        ],
      },
      {
        nombre: "Carnes",
        platos: [
          { nombre: "Chuletón de buey", descripcion: "Chuletón de buey madurado (500g)", precio: 24.0 },
          { nombre: "Secreto ibérico", descripcion: "Corte de cerdo ibérico a la parrilla", precio: 18.5 },
          { nombre: "Entrecot", descripcion: "Entrecot de ternera a la parrilla", precio: 19.0 },
          { nombre: "Pollo a la parrilla", descripcion: "Medio pollo marinado a la parrilla", precio: 12.5 },
        ],
      },
      {
        nombre: "Pescados",
        platos: [
          { nombre: "Lubina a la espalda", descripcion: "Lubina a la parrilla con ajada", precio: 18.0 },
          { nombre: "Pulpo a la gallega", descripcion: "Pulpo cocido con pimentón y aceite de oliva", precio: 16.5 },
          { nombre: "Dorada al horno", descripcion: "Dorada al horno con patatas y verduras", precio: 17.0 },
        ],
      },
      {
        nombre: "Postres",
        platos: [
          { nombre: "Flan casero", descripcion: "Flan casero con caramelo", precio: 4.5 },
          { nombre: "Tarta de Santiago", descripcion: "Tarta tradicional de almendra", precio: 5.0 },
          { nombre: "Crema catalana", descripcion: "Crema catalana con azúcar caramelizado", precio: 4.5 },
          { nombre: "Helado", descripcion: "Dos bolas de helado a elegir", precio: 4.0 },
        ],
      },
      {
        nombre: "Bebidas",
        platos: [
          { nombre: "Agua mineral", descripcion: "Botella de 50cl", precio: 2.0 },
          { nombre: "Refresco", descripcion: "Coca-Cola, Fanta, etc.", precio: 2.5 },
          { nombre: "Cerveza", descripcion: "Caña de cerveza", precio: 2.5 },
          { nombre: "Vino de la casa", descripcion: "Copa de vino tinto o blanco", precio: 3.0 },
          { nombre: "Sangría", descripcion: "Jarra de sangría (1L)", precio: 12.0 },
        ],
      },
    ],
  }
  
  /**
   * Obtiene los datos del restaurante (ahora directamente del objeto)
   */
  export function getRestaurantData() {
    // Simplemente devuelve los datos hardcodeados
    console.log("Usando datos de restaurante hardcodeados")
    return RESTAURANT_DATA
  }
  
  // Asegurarnos de que la función getRestaurantPrompt genere un prompt adecuado
  // con los datos del restaurante
  
  /**
   * Genera un prompt con los datos del restaurante
   */
  export function getRestaurantPrompt() {
    const data = RESTAURANT_DATA
  
    // Verificar que tenemos datos
    if (!data || !data.menu || data.menu.length === 0) {
      console.error("ERROR: No hay datos de restaurante disponibles")
      return "Eres una camarera virtual que trabaja en un restaurante español. Responde amablemente a las preguntas sobre el menú."
    }
  
    // Construir un prompt detallado con los datos del restaurante
    const prompt = `
  Eres una camarera virtual que trabaja en el restaurante "${data.nombre}".
  
  Información del restaurante:
  - Descripción: ${data.descripcion}
  - Horario: ${data.horario}
  
  Menú del restaurante:
  ${data.menu
    .map(
      (categoria) => `
  ${categoria.nombre}:
  ${categoria.platos.map((plato) => `- ${plato.nombre}: ${plato.descripcion}. Precio: ${plato.precio}€`).join("\n")}
  `,
    )
    .join("\n")}
  
  Instrucciones:
  1. Responde de manera amable y profesional a las preguntas sobre el menú.
  2. Sé concisa pero informativa.
  3. Responde siempre en español de España, usando expresiones naturales.
  4. NO uses formatos como negrita, cursiva o listas con asteriscos.
  5. Si te preguntan por un plato que no está en el menú, indícalo amablemente.
  6. Usa un tono conversacional y natural, como una camarera española real.
  7. Evita usar caracteres especiales como asteriscos, almohadillas o guiones bajos.
  8. IMPORTANTE: Siempre responde como si tuvieras el menú delante. NUNCA digas que no tienes el menú o que no conoces los platos.
  `
  
    console.log("Prompt generado correctamente con datos del restaurante")
    return prompt
  }
  
  

