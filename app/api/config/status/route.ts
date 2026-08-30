import { NextResponse } from "next/server";
import { vudyConfig } from "@/lib/vudy";

/**
 * Read-only diagnostic: tells you whether the Vudy client is currently
 * live or falling back to mock mode for each auth pattern, without
 * exposing the actual API key/IDs. Useful during the demo to show the
 * reviewer exactly what's real vs simulated at a glance.
 */
export async function GET() {
  return NextResponse.json(vudyConfig);
}
