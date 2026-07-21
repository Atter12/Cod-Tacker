import "server-only";

import type { AdsProvider } from "@/lib/integrations/contracts/ads";
import { providerError } from "@/lib/integrations/contracts/common";
import {
  TIKTOK_ADS_MISSING_CREDENTIALS_ERROR,
  type TikTokAdsCredentials,
} from "@/lib/integrations/tiktok/env";
import { fetchTikTokAdsDailySpend } from "@/lib/integrations/tiktok/insights";

export type LiveTikTokAdsCredentials = TikTokAdsCredentials;

function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(kind: "incremental" | "historical"): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (kind === "historical" ? 30 : 7));
  return { from: isoDateUtc(from), to: isoDateUtc(to) };
}

/**
 * Live TikTok Ads adapter (S17).
 * sync() pulls Marketing integrated report (advertiser / day) and enqueues ads.spend.synced.
 */
export function createLiveTikTokAdsProvider(
  providerId: AdsProvider["providerId"] = "tiktok",
  creds: LiveTikTokAdsCredentials,
): AdsProvider {
  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.advertiserId,
        displayName: `TikTok Ads · ${creds.advertiserId}`,
        credentialRef: input.credentialRef || "tiktok-ads-live",
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.accessToken || !creds.advertiserId) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: TIKTOK_ADS_MISSING_CREDENTIALS_ERROR,
          demo: false,
        };
      }
      const probe = await fetchTikTokAdsDailySpend({
        creds,
        dateRange: { from: isoDateUtc(new Date()), to: isoDateUtc(new Date()) },
      });
      const latencyMs = Date.now() - started;
      if (probe.ok) {
        return {
          status: "healthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: "TikTok Ads Reporting reachable",
          demo: false,
        };
      }
      if (probe.statusCode === 401 || probe.statusCode === 403) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: "TikTok Ads unauthorized — check TIKTOK_ADS_ACCESS_TOKEN / advertiser scopes",
          demo: false,
        };
      }
      return {
        status: "degraded",
        mode: "live",
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: probe.error.slice(0, 200),
        demo: false,
      };
    },
    async sync(input) {
      const started = Date.now();
      if (!creds.accessToken || !creds.advertiserId) {
        return {
          ok: false,
          mode: "live",
          demo: false,
          error: providerError("TIKTOK_ADS_CREDENTIALS", TIKTOK_ADS_MISSING_CREDENTIALS_ERROR),
        };
      }

      const dateRange =
        input.from && input.to
          ? { from: input.from.slice(0, 10), to: input.to.slice(0, 10) }
          : defaultDateRange(input.kind);

      const fetched = await fetchTikTokAdsDailySpend({ creds, dateRange });
      if (!fetched.ok) {
        return {
          ok: false,
          mode: "live",
          demo: false,
          error: providerError("TIKTOK_REPORT_FAILED", fetched.error.slice(0, 240), {
            retryable: fetched.statusCode === 429 || (fetched.statusCode ?? 0) >= 500,
          }),
        };
      }

      const enqueues = fetched.rows.map((row) => ({
        externalId: `${creds.advertiserId}:${row.date}`,
        action: "updated" as const,
        eventType: "ads.spend.synced",
        jobType: "ads.spend.synced",
        payload: {
          platform: "tiktok" as const,
          external_account_id: creds.advertiserId,
          metric_date: row.date,
          spend: row.spend,
          currency_code: row.currency,
          impressions: row.impressions,
          clicks: row.clicks,
          mode: "live" as const,
        },
      }));

      const withSpend = enqueues.filter((e) => e.payload.spend > 0).length;

      return {
        ok: true,
        mode: "live",
        demo: false,
        processed: enqueues.length,
        inserted: withSpend,
        updated: enqueues.length,
        duplicates: 0,
        nextCursor: dateRange.to,
        durationMs: Date.now() - started,
        enqueues,
      };
    },
    async listSpend(dateRange) {
      const fetched = await fetchTikTokAdsDailySpend({ creds, dateRange });
      if (!fetched.ok) return [];
      return fetched.rows;
    },
  };
}
