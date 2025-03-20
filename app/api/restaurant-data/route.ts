import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Datos de respaldo en caso de error
const BACKUP_DATA = {
  "nombre": "EBAL Restaurant",
  "descripcion": "Restaurante con variedad de platos principales, postres y bebidas. Especializado en cocina internacional y sabores únicos.",
  "horario": "Abierto todos los días de 12:00 pm - 8:00 pm",
  "ubicacion": "123 Anywhere St., Any City, ST 12345",
  "telefono": "+123-456-7890",
  "redes_sociales": "@ebalresto",
  "menu": [
    {
      "nombre": "Platos principales",
      "platos": [
        {
          "nombre": "Pollo a la Piccata",
          "descripcion": "Pechugas de pollo de corral salteadas en salsa de vino blanco seco, jugo de limón natural y alcaparras encurtidas. Servido con puré de patatas al ajo y espárragos verdes al vapor.",
          "precio": 18.50,
          "alergenos": [
            "Sulfitos: presente en el vino blanco",
            "Lácteos: mantequilla en la salsa",
            "Puede contener trazas de frutos secos en el puré de patatas"
          ]
        },
        {
          "nombre": "Salmón",
          "descripcion": "Filete de salmón fresco sazonado con sal y pimienta, cocinado a la parrilla y servido con salsa de mantequilla de limón. Acompañado de verduras asadas (pimientos, calabacín, berenjena) y pilaf de arroz.",
          "precio": 22.00,
          "alergenos": [
            "Pescado: salmón",
            "Lácteos: mantequilla en la salsa",
            "Puede contener trazas de gluten en el arroz pilaf"
          ]
        },
        {
          "nombre": "Solomillo",
          "descripcion": "Solomillo de ternera de primera calidad, marinado con hierbas frescas y especias, cocinado a la parrilla y servido con chutney de manzana dulce y ácida. Incluye boniato asado y judías verdes al vapor.",
          "precio": 28.00,
          "alergenos": [
            "No contiene alérgenos principales",
            "Puede contener trazas de sulfitos en el chutney de manzana"
          ]
        },
        {
          "nombre": "Risotto",
          "descripcion": "Arroz Arborio cocinado lentamente con caldo de verduras, champiñones laminados y cebolla caramelizada. Enriquecido con queso parmesano y mantequilla, coronado con perejil fresco.",
          "precio": 16.50,
          "alergenos": [
            "Lácteos: queso parmesano y mantequilla",
            "Puede contener trazas de gluten si se usa caldo comercial"
          ]
        }
      ]
    },
    {
      "nombre": "Postres",
      "platos": [
        {
          "nombre": "Volcán de Chocolate",
          "descripcion": "Bizcocho de chocolate con centro fundido de chocolate caliente, elaborado con cacao puro, mantequilla, huevos y azúcar. Textura crujiente por fuera y cremosa por dentro.",
          "precio": 7.00,
          "alergenos": [
            "Gluten: harina en la masa",
            "Lácteos: mantequilla",
            "Huevos: presentes en la preparación"
          ]
        },
        {
          "nombre": "Crema Catalana",
          "descripcion": "Postre tradicional a base de crema pastelera aromatizada con canela y cítricos, cubierta con una fina capa de azúcar caramelizado.",
          "precio": 6.50,
          "alergenos": [
            "Lácteos: leche y nata",
            "Huevos: presentes en la crema"
          ]
        },
        {
          "nombre": "Tiramisú",
          "descripcion": "Postre italiano con capas de bizcochos de soletilla empapados en café expreso y crema de mascarpone, decorado con cacao en polvo.",
          "precio": 8.00,
          "alergenos": [
            "Gluten: bizcochos de soletilla",
            "Lácteos: queso mascarpone y nata",
            "Huevos: en la crema de mascarpone"
          ]
        },
        {
          "nombre": "Tarta de Queso",
          "descripcion": "Tarta cremosa horneada con una base de galleta triturada, queso crema, nata, mantequilla y un toque de vainilla. Puede llevar cobertura de frutos rojos.",
          "precio": 7.50,
          "alergenos": [
            "Gluten: base de galleta",
            "Lácteos: queso crema, nata y mantequilla",
            "Huevos: en la mezcla de queso"
          ]
        }
      ]
    },
    {
      "nombre": "Bebidas",
      "platos": [
        {
          "nombre": "Café",
          "descripcion": "Espresso, cortado, con leche o americano. Preparado con granos de café de origen seleccionado.",
          "precio": 2.00,
          "alergenos": [
            "No contiene alérgenos"
          ]
        },
        {
          "nombre": "Coca-Cola",
          "descripcion": "Refrescos de cola, limón, naranja y agua con gas.",
          "precio": 3.00,
          "alergenos": [
            "Puede contener sulfitos en algunas variedades"
          ]
        },
        {
          "nombre": "Jugo natural",
          "descripcion": "Zumo recién exprimido de naranja, manzana o zanahoria.",
          "precio": 4.00,
          "alergenos": [
            "No contiene alérgenos"
          ]
        }
      ]
    }
  ]
}

export async function GET() {
  try {
    // Intentar cargar desde el sistema de archivos
    try {
      const filePath = path.join(process.cwd(), "public/data/restaurant-data.json")
      console.log("Intentando cargar datos desde:", filePath)

      const fileContents = fs.readFileSync(filePath, "utf8")
      const data = JSON.parse(fileContents)

      console.log("Datos cargados correctamente desde el sistema de archivos")
      return NextResponse.json(data)
    } catch (fsError) {
      console.log("Error al cargar con fs:", fsError)

      // Intentar cargar usando import.meta (solo funciona en Edge Runtime)
      try {
        // Esto solo funciona en Edge Runtime
        const response = await fetch(new URL("/public/data/restaurant-data.json", import.meta.url))
        if (response.ok) {
          const data = await response.json()
          console.log("Datos cargados correctamente usando import.meta")
          return NextResponse.json(data)
        } else {
          throw new Error(`Error al cargar: ${response.status}`)
        }
      } catch (importError) {
        console.log("Error al cargar con import.meta:", importError)

        // Devolver datos de respaldo
        console.log("Usando datos de respaldo")
        return NextResponse.json(BACKUP_DATA)
      }
    }
  } catch (error) {
    console.error("Error al cargar los datos del restaurante:", error)
    return NextResponse.json(BACKUP_DATA)
  }
}


  
  

