/**
 * Thin client around the Vudy API (https://docs.vudy.services).
 *
 * Two endpoints are wired here:
 *
 *  - GET  /v1/wallet/portfolio   (Auth Pattern A — api key only)
 *  - POST /channel/vudy/send/create  (Auth Pattern B — api key + profile + team)
 *
 * `VUDY_MOCK_MODE=true` (or missing credentials) makes every call return a
 * realistic fake response instead of hitting the real API. This exists
 * because Pattern B needs `x-profile-id` / `x-team-id`, which are not
 * documented at the time of writing (docs.vudy.services still has several
 * "coming soon" pages) — see README for the full note to the Vudy team.
 * Flip the env var once those values are confirmed to hit the real endpoint.
 */

const VUDY_BASE_URL = process.env.VUDY_BASE_URL || "https://api.vudy.app";
const VUDY_API_KEY = process.env.VUDY_API_KEY;
const VUDY_PROFILE_ID = process.env.VUDY_PROFILE_ID;
const VUDY_TEAM_ID = process.env.VUDY_TEAM_ID;

const FORCE_MOCK = process.env.VUDY_MOCK_MODE === "true";

// Pattern A (portfolio/balance) only needs the API key.
const MOCK_PORTFOLIO = FORCE_MOCK || !VUDY_API_KEY;

// Pattern B (send/create) needs the API key *and* the team context.
const MOCK_SEND = FORCE_MOCK || !VUDY_API_KEY || !VUDY_PROFILE_ID || !VUDY_TEAM_ID;

export interface PortfolioToken {
  totalUsdBalance: number;
  totalBalance: number;
}

export interface PortfolioResult {
  wallet: string;
  totalUsdBalance: number;
  tokens: Record<string, PortfolioToken>;
  mock: boolean;
}

export interface SendRecipient {
  address: string;
  amount: number;
}

export interface CreateSendInput {
  chain: string;
  token: string;
  recipients: SendRecipient[];
  note?: string;
  sendWallet?: string;
}

export interface CreateSendResult {
  sendId: string;
  status: string;
  mock: boolean;
  raw?: unknown;
}

function patternAHeaders(): HeadersInit {
  return { "x-api-key": VUDY_API_KEY ?? "" };
}

function patternBHeaders(): HeadersInit {
  return {
    "x-api-key": VUDY_API_KEY ?? "",
    "x-profile-id": VUDY_PROFILE_ID ?? "",
    "x-team-id": VUDY_TEAM_ID ?? "",
    "Content-Type": "application/json",
  };
}

/** GET /v1/wallet/portfolio?wallets={address} */
export async function getPortfolio(walletAddress: string): Promise<PortfolioResult> {
  if (MOCK_PORTFOLIO) {
    return {
      wallet: walletAddress,
      totalUsdBalance: 6.04,
      tokens: {
        USDT: { totalUsdBalance: 5, totalBalance: 5 },
        POL: { totalUsdBalance: 1.04, totalBalance: 1.04 },
      },
      mock: true,
    };
  }

  const url = `${VUDY_BASE_URL}/v1/wallet/portfolio?wallets=${encodeURIComponent(
    walletAddress
  )}`;
  const res = await fetch(url, { headers: patternAHeaders(), cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Vudy portfolio request failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const entry = body?.data?.[0];
  return {
    wallet: walletAddress,
    totalUsdBalance: entry?.totalUsdBalance ?? 0,
    tokens: entry?.tokens ?? {},
    mock: false,
  };
}

/** POST /channel/vudy/send/create */
export async function createSend(input: CreateSendInput): Promise<CreateSendResult> {
  if (MOCK_SEND) {
    return {
      sendId: `mock-send-${Date.now()}`,
      status: "simulated",
      mock: true,
    };
  }

  const res = await fetch(`${VUDY_BASE_URL}/channel/vudy/send/create`, {
    method: "POST",
    headers: patternBHeaders(),
    body: JSON.stringify({
      sendWallet: input.sendWallet,
      chain: input.chain,
      token: input.token,
      recipients: input.recipients,
      note: input.note,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Vudy send/create failed: ${res.status} ${JSON.stringify(body)}`);
  }

  return {
    sendId: body?.sendId ?? body?.id ?? "unknown",
    status: body?.status ?? "created",
    mock: false,
    raw: body,
  };
}

export const vudyConfig = {
  mockPortfolio: MOCK_PORTFOLIO,
  mockSend: MOCK_SEND,
  baseUrl: VUDY_BASE_URL,
};
