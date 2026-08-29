import { randomUUID } from "crypto";
import type {
  AuditEvent,
  CreatePaymentRequestInput,
  PaymentRequest,
  PaymentRequestStatus,
} from "./types";

/**
 * In-memory store.
 *
 * This is a deliberate simplification for the 1-day prototype: state lives
 * in server memory and resets on redeploy/restart. In production this would
 * be a PostgreSQL table (payment_requests + audit_log), which is exactly the
 * approach documented in the business case as a "next step".
 *
 * We attach the store to `globalThis` so it survives Next.js dev-server hot
 * reloads (otherwise every file edit would wipe the demo data).
 */

declare global {
  // eslint-disable-next-line no-var
  var __paymentRequestStore: PaymentRequest[] | undefined;
}

function seed(): PaymentRequest[] {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      providerName: "Distribuidora Andina SAC",
      destinationWallet: "0x000000000000000000000000000000000000dE",
      amount: 25,
      currency: "USDT",
      chain: "polygon",
      reason: "Pago de factura #A-1042 (materia prima)",
      requestedBy: "Elizabeth Huanca (Solicitante)",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      audit: [
        {
          id: randomUUID(),
          event: "created",
          actor: "Elizabeth Huanca (Solicitante)",
          createdAt: now,
        },
      ],
    },
  ];
}

function getStore(): PaymentRequest[] {
  if (!globalThis.__paymentRequestStore) {
    globalThis.__paymentRequestStore = seed();
  }
  return globalThis.__paymentRequestStore;
}

function addAudit(request: PaymentRequest, event: Omit<AuditEvent, "id" | "createdAt">) {
  request.audit.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  });
}

export function listRequests(): PaymentRequest[] {
  return [...getStore()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getRequest(id: string): PaymentRequest | undefined {
  return getStore().find((r) => r.id === id);
}

export function createRequest(input: CreatePaymentRequestInput): PaymentRequest {
  const now = new Date().toISOString();
  const request: PaymentRequest = {
    id: randomUUID(),
    providerName: input.providerName,
    destinationWallet: input.destinationWallet,
    amount: input.amount,
    currency: input.currency,
    chain: input.chain,
    reason: input.reason,
    requestedBy: input.requestedBy || "Solicitante",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    audit: [],
  };
  addAudit(request, { event: "created", actor: request.requestedBy });
  getStore().push(request);
  return request;
}

export function updateStatus(
  id: string,
  status: PaymentRequestStatus,
  actor: string,
  detail?: string,
  vudyTxRef?: string
): PaymentRequest | undefined {
  const request = getRequest(id);
  if (!request) return undefined;
  request.status = status;
  request.updatedAt = new Date().toISOString();
  if (vudyTxRef) request.vudyTxRef = vudyTxRef;
  addAudit(request, { event: `status:${status}`, actor, detail });
  return request;
}
