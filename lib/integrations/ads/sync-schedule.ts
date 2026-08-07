/** Pure schedule helpers for Meta/TikTok Ads sync (unit-test safe). */

export const ADS_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
export const ADS_SCHEDULED_PROVIDERS = ["meta", "tiktok"] as const;
export type AdsScheduledProvider = (typeof ADS_SCHEDULED_PROVIDERS)[number];

export function lastAdsSyncAttemptAt(integration: {
  last_success_at: string | null;
  last_error_at: string | null;
}): Date | null {
  const times = [integration.last_success_at, integration.last_error_at]
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime())
    .filter((n) => Number.isFinite(n));
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

export function isAdsSyncDue(
  integration: { last_success_at: string | null; last_error_at: string | null },
  nowMs = Date.now(),
  intervalMs = ADS_SYNC_INTERVAL_MS,
): boolean {
  const last = lastAdsSyncAttemptAt(integration);
  if (!last) return true;
  return nowMs - last.getTime() >= intervalMs;
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Live Ads integrations only (skip mock/demo rows). */
export function isLiveAdsIntegration(integration: {
  provider: string;
  status: string;
  metadata?: unknown;
}): boolean {
  if (integration.status !== "connected" && integration.status !== "error") return false;
  if (!ADS_SCHEDULED_PROVIDERS.includes(integration.provider as AdsScheduledProvider)) {
    return false;
  }
  const meta = asMeta(integration.metadata);
  if (meta.demo === true) return false;
  if (meta.mode === "mock") return false;
  // Prefer explicit live; allow missing mode for older rows that still look live.
  if (meta.mode != null && meta.mode !== "live") return false;
  return true;
}

/**
 * First successful sync should be historical (~30d).
 * Cleared when ads_initial_backfill_done is set after a backfill run.
 */
export function needsAdsInitialBackfill(integration: {
  last_success_at: string | null;
  metadata?: unknown;
}): boolean {
  const meta = asMeta(integration.metadata);
  if (meta.ads_initial_backfill_done === true) return false;
  if (meta.ads_initial_backfill_pending === true) return true;
  return integration.last_success_at == null;
}

export function resolveAdsScheduledSyncType(
  integration: {
    last_success_at: string | null;
    metadata?: unknown;
  },
): "backfill" | "incremental" {
  return needsAdsInitialBackfill(integration) ? "backfill" : "incremental";
}
