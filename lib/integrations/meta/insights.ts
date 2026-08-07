import type { AdsSpendSnapshot } from "@/lib/integrations/contracts/ads";
import type { MetaAdsCredentials } from "@/lib/integrations/meta/env";

export type MetaInsightsDayRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  account_currency?: string;
  date_start?: string;
  date_stop?: string;
};

function asNumber(raw: string | undefined, fallback = 0): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Map Graph Insights campaign-level rows into AdsSpendSnapshot (one per campaign/day). */
export function mapMetaInsightsToSpendSnapshots(
  rows: MetaInsightsDayRow[],
  input: { currencyFallback: string },
): AdsSpendSnapshot[] {
  const out: AdsSpendSnapshot[] = [];
  for (const row of rows) {
    const date = (row.date_start ?? row.date_stop ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const campaignExternalId = (row.campaign_id ?? "").trim();
    if (!campaignExternalId) continue;
    const spend = asNumber(row.spend);
    const currency = (row.account_currency ?? input.currencyFallback).slice(0, 3).toUpperCase();
    const campaignName = (row.campaign_name ?? "").trim() || undefined;
    out.push({
      date,
      campaignExternalId,
      campaignName,
      spend,
      impressions: Math.max(0, Math.round(asNumber(row.impressions))),
      clicks: Math.max(0, Math.round(asNumber(row.clicks))),
      currency,
    });
  }
  return out;
}

export function buildMetaInsightsUrl(
  creds: MetaAdsCredentials,
  dateRange: { from: string; to: string },
  after?: string | null,
): URL {
  const url = new URL(
    `https://graph.facebook.com/${encodeURIComponent(creds.apiVersion)}/${encodeURIComponent(creds.adAccountId)}/insights`,
  );
  url.searchParams.set(
    "fields",
    "campaign_id,campaign_name,spend,impressions,clicks,account_currency,date_start,date_stop",
  );
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since: dateRange.from, until: dateRange.to }),
  );
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", creds.accessToken);
  if (after) url.searchParams.set("after", after);
  return url;
}

/**
 * Fetch daily campaign spend from Meta Marketing Insights API.
 * Paginates with cursors until exhausted (cap pages for safety).
 */
export async function fetchMetaAdsDailySpend(input: {
  creds: MetaAdsCredentials;
  dateRange: { from: string; to: string };
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; rows: AdsSpendSnapshot[]; statusCode: number }
  | { ok: false; error: string; statusCode?: number; body?: unknown }
> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const collected: MetaInsightsDayRow[] = [];
  let after: string | null = null;
  let lastStatus = 200;

  for (let page = 0; page < 40; page += 1) {
    const url = buildMetaInsightsUrl(input.creds, input.dateRange, after);
    const res = await fetchImpl(url.toString(), { method: "GET" });
    lastStatus = res.status;
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }

    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? String(
              (parsed as { error?: { message?: unknown } }).error?.message ??
                `Meta Insights HTTP ${res.status}`,
            )
          : `Meta Insights HTTP ${res.status}`;
      return { ok: false, error: message, statusCode: res.status, body: parsed };
    }

    const data =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { data?: unknown; paging?: { cursors?: { after?: string } } })
        : null;
    const rows = Array.isArray(data?.data) ? (data!.data as MetaInsightsDayRow[]) : [];
    collected.push(...rows);

    const next = data?.paging?.cursors?.after?.trim() || null;
    if (!next || rows.length === 0) break;
    after = next;
  }

  return {
    ok: true,
    statusCode: lastStatus,
    rows: mapMetaInsightsToSpendSnapshots(collected, {
      currencyFallback: input.creds.currencyFallback,
    }),
  };
}
