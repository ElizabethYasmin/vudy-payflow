"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      providerName: formData.get("providerName"),
      destinationWallet: formData.get("destinationWallet"),
      amount: Number(formData.get("amount")),
      currency: formData.get("currency"),
      chain: formData.get("chain"),
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
      <p className="mb-6 text-sm text-zinc-500">
        Al aprobarla, el backend llama a la API de Vudy para liquidar el pago.
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
          <Field label="Moneda" name="currency" required placeholder="USDT" defaultValue="USDT" />
        </div>
        <Field label="Chain" name="chain" required placeholder="polygon" defaultValue="polygon" />
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
          disabled={submitting}
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
