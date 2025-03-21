import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Datos de respaldo en caso de error
const BACKUP_DATA = {
  "nombre": "EBAL Restaurant",
  "descripcion": "Restaurante con variedad de platos principales, entrantes, postres y bebidas. Especializado en cocina internacional y sabores únicos.",
  "horario": "Abierto todos los días de 12:00 pm - 8:00 pm",
  "ubicacion": "123 Anywhere St., Any City, ST 12345",
  "telefono": "+123-456-7890",
  "redes_sociales": "@ebalresto",
  "menu": [
    {
      "nombre": "Entrantes",
      "platos": [
        {
          "nombre": "Tosta",
          "descripcion": "Rebanada de pan rústico de masa madre, tostado hasta quedar crujiente, cubierto con tomates cherry en dados, ajo finamente picado, albahaca fresca y un toque de aceite de oliva virgen extra. Se adereza con sal marina y pimienta negra recién molida.",
          "precio": 5.00,
          "alergenos": [
            "Gluten (presente en el pan)",
            "Puede contener trazas de frutos secos"
          ]
        },
        {
          "nombre": "Queso",
          "descripcion": "Pequeños bocados de queso de cabra cremoso, envueltos en una fina capa de masa filo horneada hasta quedar dorada y crujiente. Se sirven con un toque de miel de romero y nueces caramelizadas.",
          "precio": 6.50,
          "alergenos": [
            "Lácteos (queso de cabra)",
            "Gluten (masa filo)",
            "Frutos secos (nueces caramelizadas)"
          ]
        },
        {
          "nombre": "Gambas",
          "descripcion": "Gambas frescas, peladas y salteadas en una mezcla de ajo picado, jugo de limón natural y mantequilla. Se sirven con pan crujiente para mojar en la salsa.",
          "precio": 8.00,
          "alergenos": [
            "Mariscos (gambas)",
            "Lácteos (mantequilla)",
            "Gluten (pan de acompañamiento)"
          ]
        }
      ]
    },
    {
      "nombre": "Platos principales",
      "platos": [
        {
          "nombre": "Salmón",
          "descripcion": "Filete de salmón fresco, sazonado con sal y pimienta, cocinado a la parrilla hasta obtener un dorado perfecto. Se sirve con salsa de mantequilla de limón, verduras asadas (pimientos, calabacín y berenjena) y arroz aromático infusionado con hierbas.",
          "precio": 12.00,
          "alergenos": [
            "Pescado (salmón)",
            "Lácteos (mantequilla en la salsa)",
            "Puede contener trazas de gluten en el arroz"
          ]
        },
        {
          "nombre": "Solomillo",
          "descripcion": "Solomillo de ternera de primera calidad, marinado con una mezcla de especias y hierbas frescas, cocinado a la parrilla y servido con compota de manzana dulce y ácida. Acompañado de boniato asado y judías verdes al vapor.",
          "precio": 14.00,
          "alergenos": [
            "No contiene alérgenos principales",
            "Puede contener trazas de sulfitos en la compota de manzana"
          ]
        },
        {
          "nombre": "Paella",
          "descripcion": "Versión tradicional elaborada con arroz de grano corto, pollo, conejo, judía verde (bajoqueta), garrofón, tomate, aceite de oliva virgen extra y caldo de ave. Sazonada con pimentón, azafrán y romero, cocinada a fuego lento en paellera hasta obtener el característico 'socarrat'.",
          "precio": 16.50,
          "alergenos": [
            "Puede contener trazas de gluten en el caldo comercial",
            "Sulfitos en el vino usado para el sofrito"
          ]
        }
      ]
    },
    {
      "nombre": "Postres",
      "platos": [
        {
          "nombre": "Volcán de Chocolate",
          "descripcion": "Bizcocho de chocolate con un centro fundido de chocolate caliente, elaborado con cacao puro, mantequilla, huevos frescos y azúcar. Se hornea hasta lograr una textura crujiente por fuera y cremosa por dentro.",
          "precio": 5.00,
          "alergenos": [
            "Gluten (harina en la masa)",
            "Lácteos (mantequilla)",
            "Huevos"
          ]
        },
        {
          "nombre": "Crema Catalana",
          "descripcion": "Postre tradicional a base de crema pastelera aromatizada con canela y piel de cítricos, cubierta con una fina capa de azúcar caramelizado mediante soplete.",
          "precio": 6.50,
          "alergenos": [
            "Lácteos (leche y nata)",
            "Huevos"
          ]
        },
        {
          "nombre": "Tarta de Frutos Rojos",
          "descripcion": "Tarta cremosa de frutos rojos horneada con una base de galleta triturada y un toque de vainilla.",
          "precio": 5.50,
          "alergenos": [
            "Gluten (base de galleta)",
            "Lácteos (queso crema, nata y mantequilla)",
            "Huevos"
          ]
        }
      ]
    },
    {
      "nombre": "Bebidas",
      "platos": [
        {
          "nombre": "Café",
          "descripcion": "Preparado con granos de café de origen seleccionado.",
          "precio": 2.00,
          "alergenos": [
            "No contiene alérgenos"
          ]
        },
        {
          "nombre": "Coca-Cola",
          "descripcion": "Bebida gaseosa de cola.",
          "precio": 3.00,
          "alergenos": [
            "Puede contener sulfitos en algunas variedades"
          ]
        },
        {
          "nombre": "Cerveza",
          "descripcion": "Cerveza.",
          "precio": 3.00,
          "alergenos": [
            "Gluten (presente en la cebada y el trigo en algunas variedades)"
          ]
        },
        {
          "nombre": "Agua",
          "descripcion": "Agua mineralizada, fresca o al natural.",
          "precio": 3.00,
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


  
  

