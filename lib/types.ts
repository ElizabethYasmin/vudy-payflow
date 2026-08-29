/**
 * Domain types for the B2B payment approval flow.
 *
 * Deliberately simple for a 1-day prototype: a payment request moves through
 * a small state machine (pending -> approved -> settled, or rejected) and
 * carries an audit trail of every decision made on it.
 */

export type PaymentRequestStatus =
  | "pending"
  | "approved"
  | "settled"
  | "rejected"
  | "failed";

export interface AuditEvent {
  id: string;
  event: string;
  actor: string;
  createdAt: string;
  detail?: string;
}

export interface PaymentRequest {
  id: string;
  providerName: string;
  destinationWallet: string;
  amount: number;
  currency: string; // token symbol, e.g. "USDT"
  chain: string; // e.g. "ethereum", "polygon"
  reason: string;
  requestedBy: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
  /** Reference returned by Vudy once the send has been created/settled. */
  vudyTxRef?: string;
  audit: AuditEvent[];
}

export interface CreatePaymentRequestInput {
  providerName: string;
  destinationWallet: string;
  amount: number;
  currency: string;
  chain: string;
  reason: string;
  requestedBy: string;
}
