"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ChainInfo } from "@/lib/vudy";

export default function NewRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [chainsMock, setChainsMock] = useState(true);
  const [chainsLoading, setChainsLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");

  // GET /api/config/chains -> Vudy's GET /v1/config/chains (Auth Pattern A).
  // Populates the pickers below with real supported chains/tokens instead
  // of hardcoded options.
  useEffect(() => {
    fetch("/api/config/chains")
      .then((res) => res.json())
      .then((data: { chains: ChainInfo[]; mock: boolean }) => {
        setChains(data.chains ?? []);
        setChainsMock(Boolean(data.mock));
        const firstChain = data.chains?.[0];
        if (firstChain) {
          setSelectedChain(firstChain.slug);
          setSelectedToken(firstChain.tokens[0]?.symbol ?? "");
        }
      })
      .catch(() => setChainsMock(true))
      .finally(() => setChainsLoading(false));
  }, []);

  const tokensForSelectedChain = useMemo(
    () => chains.find((c) => c.slug === selectedChain)?.tokens ?? [],
    [chains, selectedChain]
  );

  function onChainChange(slug: string) {
    setSelectedChain(slug);
    const tokens = chains.find((c) => c.slug === slug)?.tokens ?? [];
    setSelectedToken(tokens[0]?.symbol ?? "");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      providerName: formData.get("providerName"),
      destinationWallet: formData.get("destinationWallet"),
      amount: Number(formData.get("amount")),
      currency: selectedToken,
      chain: selectedChain,
      reason: formData.get("reason"),
      requestedBy: formData.get("requestedBy"),
    };

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la solicitud");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Nueva solicitud de pago
      </h1>
      <p className="mb-1 text-sm text-zinc-500">
        Al aprobarla, el backend llama a la API de Vudy para liquidar el pago.
      </p>
      <p className="mb-6 text-xs text-zinc-400">
        Chain y token vienen de <code className="font-mono">GET /v1/config/chains</code> de Vudy
        {chainsMock ? " (simulado — falta VUDY_API_KEY)" : " (datos reales)"}.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Proveedor" name="providerName" required placeholder="Distribuidora Andina SAC" />
        <Field
          label="Wallet de destino"
          name="destinationWallet"
          required
          placeholder="0x..."
          mono
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monto" name="amount" type="number" step="0.01" required placeholder="25" />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Moneda</span>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              disabled={chainsLoading || tokensForSelectedChain.length === 0}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {tokensForSelectedChain.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} {t.type === "native" ? "(nativo)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Chain</span>
          <select
            value={selectedChain}
            onChange={(e) => onChainChange(e.target.value)}
            disabled={chainsLoading || chains.length === 0}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {chains.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </label>

        <Field label="Motivo" name="reason" placeholder="Pago de factura #..." />
        <Field
          label="Solicitado por"
          name="requestedBy"
          placeholder="Tu nombre"
          defaultValue="Elizabeth Huanca (Solicitante)"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || chainsLoading}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "Creando..." : "Crear solicitud"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
  defaultValue,
  type = "text",
  step,
  mono,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  step?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
