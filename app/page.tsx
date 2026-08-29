"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { PaymentRequest } from "@/lib/types";

interface Portfolio {
  totalUsdBalance: number;
  mock: boolean;
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [balance, setBalance] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, balRes] = await Promise.all([
      fetch("/api/requests"),
      fetch("/api/balance"),
    ]);
    const reqBody = await reqRes.json();
    const balBody = await balRes.json();
    setRequests(reqBody.requests ?? []);
    setBalance(balBody.error ? null : balBody);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setActingOn(id);
    await fetch(`/api/requests/${id}/${action}`, { method: "POST" });
    await load();
    setActingOn(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Solicitudes de pago B2B
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Se liquidan en Vudy solo cuando quedan aprobadas.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Balance de la wallet (Vudy)
          </p>
          {balance ? (
            <p className="text-xl font-semibold">
              ${balance.totalUsdBalance.toFixed(2)}{" "}
              {balance.mock && (
                <span className="align-middle text-xs font-normal text-amber-600">
                  (simulado)
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">No se pudo consultar</p>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No hay solicitudes todavía. Crea la primera desde &quot;+ Nueva
          solicitud&quot;.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.providerName}</p>
                  <p className="text-sm text-zinc-500">{r.reason}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    → {r.destinationWallet} · {r.chain}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {r.amount} {r.currency}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>

              {r.vudyTxRef && (
                <p className="mt-2 font-mono text-xs text-zinc-400">
                  ref: {r.vudyTxRef}
                </p>
              )}

              {r.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => act(r.id, "approve")}
                    disabled={actingOn === r.id}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actingOn === r.id ? "Procesando..." : "Aprobar y liquidar"}
                  </button>
                  <button
                    onClick={() => act(r.id, "reject")}
                    disabled={actingOn === r.id}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-zinc-400">
                  Auditoría ({r.audit.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                  {r.audit.map((event) => (
                    <li key={event.id}>
                      <span className="font-mono">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>{" "}
                      — {event.event} por {event.actor}
                      {event.detail ? ` (${event.detail})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
