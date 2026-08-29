import { NextRequest, NextResponse } from "next/server";
import { createRequest, listRequests } from "@/lib/store";
import type { CreatePaymentRequestInput } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ requests: listRequests() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | Partial<CreatePaymentRequestInput>
    | null;

  if (
    !body ||
    !body.providerName ||
    !body.destinationWallet ||
    !body.amount ||
    !body.currency ||
    !body.chain
  ) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: providerName, destinationWallet, amount, currency, chain" },
      { status: 400 }
    );
  }

  if (typeof body.amount !== "number" || body.amount <= 0) {
    return NextResponse.json(
      { error: "amount debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  const created = createRequest({
    providerName: body.providerName,
    destinationWallet: body.destinationWallet,
    amount: body.amount,
    currency: body.currency,
    chain: body.chain,
    reason: body.reason ?? "",
    requestedBy: body.requestedBy ?? "Solicitante",
  });

  return NextResponse.json({ request: created }, { status: 201 });
}
