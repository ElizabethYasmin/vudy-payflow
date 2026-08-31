import { NextResponse } from "next/server";
import { getRequest, updateStatus } from "@/lib/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getRequest(id);

  if (!existing) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `La solicitud ya está en estado "${existing.status}"` },
      { status: 409 }
    );
  }

  const rejected = await updateStatus(id, "rejected", "Aprobador");
  return NextResponse.json({ request: rejected });
}
