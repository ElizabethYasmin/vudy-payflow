import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/vudy";

const WALLET = process.env.VUDY_WALLET_ADDRESS || "0x0000000000000000000000000000000000dEaD";

export async function GET() {
  try {
    const portfolio = await getPortfolio(WALLET);
    return NextResponse.json(portfolio);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error consultando balance" },
      { status: 502 }
    );
  }
}
