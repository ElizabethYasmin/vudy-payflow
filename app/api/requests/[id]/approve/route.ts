import { NextResponse } from "next/server";
import { getRequest, updateStatus } from "@/lib/store";
import { createSend } from "@/lib/vudy";

/**
 * Approving a request is the moment the money actually moves: once this
 * fires, we call Vudy's `send/create` endpoint to settle on-chain.
 *
 * Kept intentionally simple for the prototype: a single approval settles
 * immediately. Production version would require N approvers (see README /
 * business case for the multi-approval design this simplifies).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getRequest(id);

  if (!existing) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `La solicitud ya está en estado "${existing.status}"` },
      { status: 409 }
    );
  }

  updateStatus(id, "approved", "Aprobador");

  try {
    const send = await createSend({
      chain: existing.chain,
      token: existing.currency,
      recipients: [{ address: existing.destinationWallet, amount: existing.amount }],
      note: `Pago aprobado: ${existing.reason || existing.providerName}`,
    });

    const settled = updateStatus(
      id,
      "settled",
      "Sistema (Vudy)",
      send.mock ? "Simulado (modo mock — sin credenciales/IDs de Vudy configurados)" : "Liquidado en Vudy",
      send.sendId
    );

    return NextResponse.json({ request: settled, vudy: send });
  } catch (error) {
    const failed = updateStatus(
      id,
      "failed",
      "Sistema (Vudy)",
      error instanceof Error ? error.message : "Error desconocido al liquidar"
    );
    return NextResponse.json({ request: failed, error: String(error) }, { status: 502 });
  }
}
