import "server-only";

import {
  ADS_SCHEDULED_PROVIDERS,
  ADS_SYNC_INTERVAL_MS,
  isAdsSyncDue,
  isLiveAdsIntegration,
  resolveAdsScheduledSyncType,
  type AdsScheduledProvider,
} from "@/lib/integrations/ads/sync-schedule";
import { logger } from "@/lib/observability/logger";
import {
  scheduledAdsSync,
} from "@/services/integrations.service";
import type { DatabaseClient } from "@/services/_shared";
import type { Json, Tables } from "@/types/database.generated";

export type AdsIntegrationRow = Pick<
  Tables<"integrations">,
  | "id"
  | "agency_id"
  | "store_id"
  | "provider"
  | "status"
  | "metadata"
  | "last_success_at"
  | "last_error_at"
>;

export type AdsScheduledSyncResult = {
  scanned: number;
  due: number;
  synced: number;
  backfills: number;
  incrementals: number;
  errors: number;
  skipped: number;
  results: Array<{
    integrationId: string;
    storeId: string;
    provider: string;
    syncType: "backfill" | "incremental";
    outcome: "ok" | "error" | "skipped";
    syncRunId?: string;
    message?: string;
  }>;
};

const DEFAULT_BATCH = 8;

/**
 * Periodic Meta/TikTok Ads sync for connected live stores.
 * Safe on the minute worker: only integrations past the interval (~24h) run.
 * First sync (or pending flag) uses historical backfill (~30d).
 */
export async function sweepAdsScheduledSyncs(
  admin: DatabaseClient,
  options: { limit?: number; intervalMs?: number } = {},
): Promise<AdsScheduledSyncResult> {
  const limit = options.limit ?? DEFAULT_BATCH;
  const intervalMs = options.intervalMs ?? ADS_SYNC_INTERVAL_MS;

  const result: AdsScheduledSyncResult = {
    scanned: 0,
    due: 0,
    synced: 0,
    backfills: 0,
    incrementals: 0,
    errors: 0,
    skipped: 0,
    results: [],
  };

  const query = await admin
    .from("integrations")
    .select(
      "id, agency_id, store_id, provider, status, metadata, last_success_at, last_error_at",
    )
    .in("provider", [...ADS_SCHEDULED_PROVIDERS])
    .in("status", ["connected", "error"])
    .order("last_success_at", { ascending: true, nullsFirst: true })
    .limit(100);

  if (query.error) {
    logger.error("ads.scheduled_sync.query_failed", { error: query.error.message });
    result.errors += 1;
    return result;
  }

  const live = (query.data ?? []).filter((row) => isLiveAdsIntegration(row)) as AdsIntegrationRow[];
  result.scanned = live.length;

  const due = live
    .filter((row) => isAdsSyncDue(row, Date.now(), intervalMs))
    .slice(0, limit);
  result.due = due.length;
  result.skipped = Math.max(0, live.length - due.length);

  for (const integration of due) {
    const storeId = integration.store_id;
    const provider = integration.provider as AdsScheduledProvider;
    if (!storeId) {
      result.errors += 1;
      result.results.push({
        integrationId: integration.id,
        storeId: "unknown",
        provider,
        syncType: "incremental",
        outcome: "error",
        message: "Integración sin store_id",
      });
      continue;
    }

    const syncType = resolveAdsScheduledSyncType(integration);
    try {
      const run = await scheduledAdsSync(admin, {
        agencyId: integration.agency_id,
        storeId,
        provider,
        syncType,
      });
      result.synced += 1;
      if (syncType === "backfill") result.backfills += 1;
      else result.incrementals += 1;

      if (syncType === "backfill" && run.status === "completed") {
        await markInitialBackfillDone(admin, integration);
      }

      result.results.push({
        integrationId: integration.id,
        storeId,
        provider,
        syncType,
        outcome: run.status === "completed" ? "ok" : "error",
        syncRunId: run.id,
        message: run.error_message ?? undefined,
      });
      if (run.status !== "completed") result.errors += 1;
    } catch (error) {
      result.errors += 1;
      result.results.push({
        integrationId: integration.id,
        storeId,
        provider,
        syncType,
        outcome: "error",
        message: error instanceof Error ? error.message.slice(0, 200) : String(error),
      });
    }
  }

  if (result.due > 0 || result.errors > 0) {
    logger.info("ads.scheduled_sync.complete", {
      intervalMs,
      ...result,
      results: result.results,
    });
  } else {
    logger.debug("ads.scheduled_sync.idle", {
      scanned: result.scanned,
      skipped: result.skipped,
      intervalMs,
    });
  }

  return result;
}

async function markInitialBackfillDone(
  admin: DatabaseClient,
  integration: AdsIntegrationRow,
): Promise<void> {
  const prev =
    integration.metadata && typeof integration.metadata === "object" && !Array.isArray(integration.metadata)
      ? (integration.metadata as Record<string, unknown>)
      : {};
  await admin
    .from("integrations")
    .update({
      metadata: {
        ...prev,
        ads_initial_backfill_pending: false,
        ads_initial_backfill_done: true,
      } as Json,
    })
    .eq("id", integration.id);
}
