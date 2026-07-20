import "server-only";

import type { AdsProvider } from "@/lib/integrations/contracts/ads";
import { providerError } from "@/lib/integrations/contracts/common";
import {
  META_ADS_MISSING_CREDENTIALS_ERROR,
  type MetaAdsCredentials,
} from "@/lib/integrations/meta/env";
import { fetchMetaAdsDailySpend } from "@/lib/integrations/meta/insights";

export type LiveMetaAdsCredentials = MetaAdsCredentials;

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
 * Live Meta Ads adapter (S16).
 * sync() pulls Marketing Insights (account / day) and returns enqueue specs for ads.spend.synced.
 */
export function createLiveMetaAdsProvider(
  providerId: AdsProvider["providerId"] = "meta",
  creds: LiveMetaAdsCredentials,
): AdsProvider {
  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.adAccountId,
        displayName: `Meta Ads · ${creds.adAccountId}`,
        credentialRef: input.credentialRef || "meta-ads-live",
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.accessToken || !creds.adAccountId) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: META_ADS_MISSING_CREDENTIALS_ERROR,
          demo: false,
        };
      }
      // Minimal range probe (today) — 401/403 = bad token; empty data is fine.
      const probe = await fetchMetaAdsDailySpend({
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
          message: "Meta Marketing Insights reachable",
          demo: false,
        };
      }
      if (probe.statusCode === 401 || probe.statusCode === 403) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: "Meta Ads unauthorized — check META_ADS_ACCESS_TOKEN / ads_read",
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
      if (!creds.accessToken || !creds.adAccountId) {
        return {
          ok: false,
          mode: "live",
          demo: false,
          error: providerError("META_ADS_CREDENTIALS", META_ADS_MISSING_CREDENTIALS_ERROR),
        };
      }

      const dateRange =
        input.from && input.to
          ? { from: input.from.slice(0, 10), to: input.to.slice(0, 10) }
          : defaultDateRange(input.kind);

      const fetched = await fetchMetaAdsDailySpend({ creds, dateRange });
      if (!fetched.ok) {
        return {
          ok: false,
          mode: "live",
          demo: false,
          error: providerError("META_INSIGHTS_FAILED", fetched.error.slice(0, 240), {
            retryable: fetched.statusCode === 429 || (fetched.statusCode ?? 0) >= 500,
          }),
        };
      }

      const enqueues = fetched.rows.map((row) => ({
        externalId: `${creds.adAccountId}:${row.date}`,
        action: "updated" as const,
        eventType: "ads.spend.synced",
        jobType: "ads.spend.synced",
        payload: {
          platform: "meta" as const,
          external_account_id: creds.adAccountId,
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
      const fetched = await fetchMetaAdsDailySpend({ creds, dateRange });
      if (!fetched.ok) return [];
      return fetched.rows;
    },
  };
}
