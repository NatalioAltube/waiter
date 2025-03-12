import { NextResponse } from "next/server"
import { RESTAURANT_DATA } from "@/utils/restaurant-data"

export async function GET() {
  return NextResponse.json(RESTAURANT_DATA)
}



