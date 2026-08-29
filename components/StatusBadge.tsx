import type { PaymentRequestStatus } from "@/lib/types";

const STYLES: Record<PaymentRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  settled: "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejected: "bg-zinc-200 text-zinc-700 border-zinc-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

const LABELS: Record<PaymentRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  settled: "Liquidado",
  rejected: "Rechazado",
  failed: "Error",
};

export function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
