/** Pure schedule helpers for Shopify order reconcile (unit-test safe). */

export const SHOPIFY_SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8h webhook catch-up

export function lastShopifySyncAttemptAt(integration: {
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

export function isShopifySyncDue(
  integration: { last_success_at: string | null; last_error_at: string | null },
  nowMs = Date.now(),
  intervalMs = SHOPIFY_SYNC_INTERVAL_MS,
): boolean {
  const last = lastShopifySyncAttemptAt(integration);
  if (!last) return true;
  return nowMs - last.getTime() >= intervalMs;
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Live Shopify only (skip mock/demo rows). */
export function isLiveShopifyIntegration(integration: {
  provider: string;
  status: string;
  metadata?: unknown;
}): boolean {
  if (integration.provider !== "shopify") return false;
  if (integration.status !== "connected" && integration.status !== "error") return false;
  const meta = asMeta(integration.metadata);
  if (meta.demo === true) return false;
  if (meta.mode === "mock") return false;
  if (meta.mode != null && meta.mode !== "live") return false;
  return true;
}

/**
 * First successful pull should be historical (~90d capped) so onboarding
 * catches orders before webhooks were registered. Then cron stays incremental.
 */
export function needsShopifyInitialBackfill(integration: {
  last_success_at: string | null;
  metadata?: unknown;
}): boolean {
  const meta = asMeta(integration.metadata);
  if (meta.shopify_initial_backfill_done === true) return false;
  if (meta.shopify_initial_backfill_pending === true) return true;
  return integration.last_success_at == null;
}

export function resolveShopifyScheduledSyncType(
  integration: {
    last_success_at: string | null;
    metadata?: unknown;
  },
): "backfill" | "incremental" {
  return needsShopifyInitialBackfill(integration) ? "backfill" : "incremental";
}
