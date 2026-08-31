import { randomUUID } from "crypto";
import { query } from "./db";
import type {
  AuditEvent,
  CreatePaymentRequestInput,
  PaymentRequest,
  PaymentRequestStatus,
} from "./types";

/**
 * Postgres-backed store (Vercel Storage / Neon). Replaces the earlier
 * in-memory version — same function names/signatures as before, now async,
 * so the API routes only needed an `await` added, nothing else changed.
 *
 * Why this exists: on Vercel, each request can be served by a different,
 * short-lived serverless instance, so `globalThis` state doesn't reliably
 * survive between them (observed directly: approving a request could 404
 * because the instance handling the click never saw the instance that
 * created it). A real database is shared by every instance, so this
 * problem goes away by construction.
 */

interface RequestRow {
  id: string;
  provider_name: string;
  destination_wallet: string;
  amount: string; // NUMERIC comes back as a string from pg — parsed below
  currency: string;
  chain: string;
  reason: string;
  requested_by: string;
  status: PaymentRequestStatus;
  vudy_tx_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  request_id: string;
  event: string;
  actor: string;
  detail: string | null;
  created_at: string;
}

function toRequest(row: RequestRow, audit: AuditEvent[]): PaymentRequest {
  return {
    id: row.id,
    providerName: row.provider_name,
    destinationWallet: row.destination_wallet,
    amount: Number(row.amount),
    currency: row.currency,
    chain: row.chain,
    reason: row.reason,
    requestedBy: row.requested_by,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vudyTxRef: row.vudy_tx_ref ?? undefined,
    audit,
  };
}

function toAuditEvent(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    event: row.event,
    actor: row.actor,
    detail: row.detail ?? undefined,
    createdAt: row.created_at,
  };
}

async function auditFor(requestIds: string[]): Promise<Map<string, AuditEvent[]>> {
  const map = new Map<string, AuditEvent[]>();
  if (requestIds.length === 0) return map;

  const rows = await query<AuditRow>(
    `SELECT * FROM audit_log WHERE request_id = ANY($1) ORDER BY created_at ASC`,
    [requestIds]
  );
  for (const row of rows) {
    const list = map.get(row.request_id) ?? [];
    list.push(toAuditEvent(row));
    map.set(row.request_id, list);
  }
  return map;
}

export async function listRequests(): Promise<PaymentRequest[]> {
  const rows = await query<RequestRow>(`SELECT * FROM payment_requests ORDER BY created_at DESC`);
  const auditMap = await auditFor(rows.map((r) => r.id));
  return rows.map((row) => toRequest(row, auditMap.get(row.id) ?? []));
}

export async function getRequest(id: string): Promise<PaymentRequest | undefined> {
  const rows = await query<RequestRow>(`SELECT * FROM payment_requests WHERE id = $1`, [id]);
  if (rows.length === 0) return undefined;
  const auditMap = await auditFor([id]);
  return toRequest(rows[0], auditMap.get(id) ?? []);
}

export async function createRequest(input: CreatePaymentRequestInput): Promise<PaymentRequest> {
  const id = randomUUID();
  const requestedBy = input.requestedBy || "Solicitante";

  const rows = await query<RequestRow>(
    `INSERT INTO payment_requests
       (id, provider_name, destination_wallet, amount, currency, chain, reason, requested_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING *`,
    [
      id,
      input.providerName,
      input.destinationWallet,
      input.amount,
      input.currency,
      input.chain,
      input.reason ?? "",
      requestedBy,
    ]
  );

  const auditId = randomUUID();
  await query(`INSERT INTO audit_log (id, request_id, event, actor) VALUES ($1,$2,'created',$3)`, [
    auditId,
    id,
    requestedBy,
  ]);

  return toRequest(rows[0], [
    { id: auditId, event: "created", actor: requestedBy, createdAt: new Date().toISOString() },
  ]);
}

export async function updateStatus(
  id: string,
  status: PaymentRequestStatus,
  actor: string,
  detail?: string,
  vudyTxRef?: string
): Promise<PaymentRequest | undefined> {
  const rows = await query<RequestRow>(
    `UPDATE payment_requests
       SET status = $2,
           updated_at = now(),
           vudy_tx_ref = COALESCE($3, vudy_tx_ref)
     WHERE id = $1
     RETURNING *`,
    [id, status, vudyTxRef ?? null]
  );
  if (rows.length === 0) return undefined;

  await query(
    `INSERT INTO audit_log (id, request_id, event, actor, detail) VALUES ($1,$2,$3,$4,$5)`,
    [randomUUID(), id, `status:${status}`, actor, detail ?? null]
  );

  const auditMap = await auditFor([id]);
  return toRequest(rows[0], auditMap.get(id) ?? []);
}
