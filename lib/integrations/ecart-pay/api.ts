import "server-only";

import {
  buildEcartPayBasicAuthHeader,
  extractEcartPayTokenFromAuthResponse,
} from "@/lib/integrations/ecart-pay/auth-helpers";
import { getEcartPayApiBaseUrl } from "@/lib/integrations/ecart-pay/env";

export type EcartPayTransaction = {
  id?: string;
  _id?: string;
  amount?: number | string;
  total?: number | string;
  fee?: number | string;
  fees?: number | string;
  currency?: string;
  status?: string;
  type?: string;
  created_at?: string;
  createdAt?: string;
  order_id?: string;
  orderId?: string;
  reference?: string;
  description?: string;
  tracking_number?: string;
  trackingNumber?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type EcartPayTransactionsResponse = {
  data?: EcartPayTransaction[];
  items?: EcartPayTransaction[];
  transactions?: EcartPayTransaction[];
  next_token?: string | null;
  next?: string | null;
  count?: number;
};

/**
 * Mint a short-lived Bearer token (~1h) from API keys.
 * @see https://docs.ecartpay.com/docs/authorization-token
 */
export async function createEcartPayAuthorizationToken(input: {
  publicKey: string;
  privateKey: string;
}): Promise<string> {
  const base = getEcartPayApiBaseUrl();
  const url = `${base}/api/authorizations/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildEcartPayBasicAuthHeader(input.publicKey, input.privateKey),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `Ecart Pay token mint failed (${res.status}): ${bodyText.slice(0, 300) || res.statusText}`,
    );
  }

  let json: unknown = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error("Ecart Pay token mint returned invalid JSON.");
  }

  const token = extractEcartPayTokenFromAuthResponse(json);
  if (!token) {
    throw new Error("Ecart Pay token mint response missing token.");
  }
  return token;
}

export async function fetchEcartPayTransactions(input: {
  token: string;
  fromIso?: string;
  toIso?: string;
  status?: string;
  limit?: number;
}): Promise<EcartPayTransaction[]> {
  const base = getEcartPayApiBaseUrl();
  const params = new URLSearchParams();
  if (input.fromIso) params.set("created_at[from]", input.fromIso);
  if (input.toIso) params.set("created_at[to]", input.toIso);
  if (input.status) params.set("status", input.status);
  params.set("limit", String(Math.min(input.limit ?? 100, 250)));

  const url = `${base}/api/transactions?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ecart Pay transactions failed (${res.status}): ${body.slice(0, 300) || res.statusText}`,
    );
  }

  const json = (await res.json()) as EcartPayTransactionsResponse | EcartPayTransaction[];
  if (Array.isArray(json)) return json;
  return json.data ?? json.items ?? json.transactions ?? [];
}

/** Validate keys by minting a Bearer and probing transactions. */
export async function probeEcartPayApiKeys(input: {
  publicKey: string;
  privateKey: string;
}): Promise<{ ok: boolean; detail?: string }> {
  try {
    const token = await createEcartPayAuthorizationToken(input);
    await fetchEcartPayTransactions({
      token,
      limit: 1,
      fromIso: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 240) : "probe_failed",
    };
  }
}

/** @deprecated Prefer probeEcartPayApiKeys — Bearer tokens expire ~1h. */
export async function probeEcartPayToken(token: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    await fetchEcartPayTransactions({
      token,
      limit: 1,
      fromIso: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 200) : "probe_failed",
    };
  }
}
