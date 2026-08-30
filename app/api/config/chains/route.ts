import { NextResponse } from "next/server";
import { getChains } from "@/lib/vudy";

export async function GET() {
  try {
    const result = await getChains();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error consultando cadenas soportadas" },
      { status: 502 }
    );
  }
}
