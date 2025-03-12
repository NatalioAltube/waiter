import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Datos de respaldo en caso de error
const BACKUP_DATA = {
  nombre: "La Parrilla Española",
  descripcion: "Restaurante especializado en carnes a la parrilla y platos tradicionales españoles.",
  horario: "Lunes a Domingo de 12:00 a 23:00",
  menu: [
    {
      nombre: "Entrantes",
      platos: [
        { nombre: "Patatas bravas", descripcion: "Patatas fritas con salsa picante", precio: 5.5 },
        { nombre: "Croquetas de jamón", descripcion: "Croquetas caseras de jamón ibérico", precio: 6.0 },
      ],
    },
    {
      nombre: "Carnes",
      platos: [
        { nombre: "Chuletón de buey", descripcion: "Chuletón de buey madurado (500g)", precio: 24.0 },
        { nombre: "Secreto ibérico", descripcion: "Corte de cerdo ibérico a la parrilla", precio: 18.5 },
      ],
    },
    {
      nombre: "Postres",
      platos: [
        { nombre: "Flan casero", descripcion: "Flan casero con caramelo", precio: 4.5 },
        { nombre: "Tarta de Santiago", descripcion: "Tarta tradicional de almendra", precio: 5.0 },
      ],
    },
  ],
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


  
  

