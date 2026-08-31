import { Pool } from "pg";

/**
 * Postgres connection (Vercel Storage / Neon). Falls back across the env
 * var names different Vercel Postgres integrations use, so this works
 * whether the project was provisioned via the native "Postgres" storage
 * product or a direct Neon integration.
 */
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.warn(
    "[db] No Postgres connection string found (POSTGRES_URL / DATABASE_URL). " +
      "Set one in .env.local for local dev or in Vercel's Environment Variables."
  );
}

const isLocalhost = connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Neon/Vercel Postgres require TLS; local Docker Postgres typically doesn't.
      ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
      max: 5, // small pool — serverless functions should hold few connections each
    })
  : null;

function requirePool(): Pool {
  if (!pool) {
    throw new Error(
      "Postgres is not configured. Set POSTGRES_URL (or DATABASE_URL) in your environment."
    );
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY,
    provider_name TEXT NOT NULL,
    destination_wallet TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL,
    vudy_tx_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log (request_id);
`;

/**
 * Creates the tables if they don't exist yet, and seeds one demo request the
 * first time the table is empty. Safe to call on every cold start — cheap
 * and idempotent (CREATE TABLE IF NOT EXISTS + a COUNT check).
 */
export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = requirePool();
      await db.query(SCHEMA_SQL);

      const { rows } = await db.query("SELECT COUNT(*)::int AS count FROM payment_requests");
      if (rows[0].count === 0) {
        const { randomUUID } = await import("crypto");
        const requestId = randomUUID();
        await db.query(
          `INSERT INTO payment_requests
             (id, provider_name, destination_wallet, amount, currency, chain, reason, requested_by, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            requestId,
            "Distribuidora Andina SAC",
            "0x000000000000000000000000000000000000dE",
            25,
            "USDT",
            "polygon",
            "Pago de factura #A-1042 (materia prima)",
            "Elizabeth Huanca (Solicitante)",
            "pending",
          ]
        );
        await db.query(
          `INSERT INTO audit_log (id, request_id, event, actor) VALUES ($1,$2,'created',$3)`,
          [randomUUID(), requestId, "Elizabeth Huanca (Solicitante)"]
        );
      }
    })();
  }
  return schemaReady;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  await ensureSchema();
  const db = requirePool();
  const { rows } = await db.query(text, params);
  return rows as T[];
}
