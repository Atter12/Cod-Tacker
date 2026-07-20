import type { AdsSpendSnapshot } from "@/lib/integrations/contracts/ads";
import type { TikTokAdsCredentials } from "@/lib/integrations/tiktok/env";

export type TikTokReportListItem = {
  dimensions?: { stat_time_day?: string };
  metrics?: {
    spend?: string;
    impressions?: string;
    clicks?: string;
    currency?: string;
  };
};

function asNumber(raw: string | undefined, fallback = 0): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Map TikTok integrated report rows into AdsSpendSnapshot (one per day). */
export function mapTikTokReportToSpendSnapshots(
  rows: TikTokReportListItem[],
  input: { advertiserId: string; currencyFallback: string },
): AdsSpendSnapshot[] {
  const out: AdsSpendSnapshot[] = [];
  for (const row of rows) {
    const rawDay = row.dimensions?.stat_time_day ?? "";
    const date = rawDay.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const spend = asNumber(row.metrics?.spend);
    const currency = (row.metrics?.currency ?? input.currencyFallback).slice(0, 3).toUpperCase();
    out.push({
      date,
      campaignExternalId: input.advertiserId,
      spend,
      impressions: Math.max(0, Math.round(asNumber(row.metrics?.impressions))),
      clicks: Math.max(0, Math.round(asNumber(row.metrics?.clicks))),
      currency,
    });
  }
  return out;
}

/**
 * Build GET URL for TikTok Marketing API integrated report (advertiser / day).
 * Docs: GET /open_api/{version}/report/integrated/get/
 */
export function buildTikTokIntegratedReportUrl(
  creds: TikTokAdsCredentials,
  dateRange: { from: string; to: string },
  page = 1,
): URL {
  const version = creds.apiVersion.replace(/^\/+|\/+$/g, "") || "v1.3";
  const url = new URL(
    `https://business-api.tiktok.com/open_api/${encodeURIComponent(version)}/report/integrated/get/`,
  );
  url.searchParams.set("advertiser_id", creds.advertiserId);
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_ADVERTISER");
  url.searchParams.set("dimensions", JSON.stringify(["stat_time_day"]));
  url.searchParams.set("metrics", JSON.stringify(["spend", "impressions", "clicks"]));
  url.searchParams.set("start_date", dateRange.from);
  url.searchParams.set("end_date", dateRange.to);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "100");
  return url;
}

/**
 * Fetch daily advertiser spend from TikTok Marketing integrated report.
 * Paginates until exhausted (cap pages for safety).
 */
export async function fetchTikTokAdsDailySpend(input: {
  creds: TikTokAdsCredentials;
  dateRange: { from: string; to: string };
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; rows: AdsSpendSnapshot[]; statusCode: number }
  | { ok: false; error: string; statusCode?: number; body?: unknown }
> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const collected: TikTokReportListItem[] = [];
  let lastStatus = 200;

  for (let page = 1; page <= 20; page += 1) {
    const url = buildTikTokIntegratedReportUrl(input.creds, input.dateRange, page);
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        "Access-Token": input.creds.accessToken,
        Accept: "application/json",
      },
    });
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
              (parsed as { message?: unknown }).message ?? `TikTok Ads HTTP ${res.status}`,
            )
          : `TikTok Ads HTTP ${res.status}`;
      return { ok: false, error: message, statusCode: res.status, body: parsed };
    }

    const envelope =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as {
            code?: number;
            message?: string;
            data?: {
              list?: unknown;
              page_info?: { total_page?: number; page?: number };
            };
          })
        : null;

    if (envelope && typeof envelope.code === "number" && envelope.code !== 0) {
      const httpLike =
        envelope.code === 40100 || envelope.code === 40001
          ? 401
          : envelope.code === 40105
            ? 403
            : 400;
      return {
        ok: false,
        error: (envelope.message || `TikTok Ads code ${envelope.code}`).slice(0, 240),
        statusCode: httpLike,
        body: parsed,
      };
    }

    const list = Array.isArray(envelope?.data?.list)
      ? (envelope!.data!.list as TikTokReportListItem[])
      : [];
    collected.push(...list);

    const totalPage = envelope?.data?.page_info?.total_page ?? 1;
    if (page >= totalPage || list.length === 0) break;
  }

  return {
    ok: true,
    statusCode: lastStatus,
    rows: mapTikTokReportToSpendSnapshots(collected, {
      advertiserId: input.creds.advertiserId,
      currencyFallback: input.creds.currencyFallback,
    }),
  };
}
