import "server-only";

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
