import "server-only";

import {
  SHOPIFY_SYNC_INTERVAL_MS,
  isLiveShopifyIntegration,
  isShopifySyncDue,
  resolveShopifyScheduledSyncType,
} from "@/lib/integrations/shopify/sync-schedule";
import { logger } from "@/lib/observability/logger";
import { scheduledShopifySync } from "@/services/integrations.service";
import type { DatabaseClient } from "@/services/_shared";
import type { Json, Tables } from "@/types/database.generated";

export type ShopifyIntegrationRow = Pick<
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

export type ShopifyScheduledSyncResult = {
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
    syncType: "backfill" | "incremental";
    outcome: "ok" | "error" | "skipped";
    syncRunId?: string;
    message?: string;
  }>;
};

const DEFAULT_BATCH = 6;

/**
 * Periodic Shopify order reconcile for connected live stores.
 * Webhooks remain primary; this catches missed updates (~every 8h).
 * First sync uses historical backfill (~90d capped).
 */
export async function sweepShopifyScheduledSyncs(
  admin: DatabaseClient,
  options: { limit?: number; intervalMs?: number } = {},
): Promise<ShopifyScheduledSyncResult> {
  const limit = options.limit ?? DEFAULT_BATCH;
  const intervalMs = options.intervalMs ?? SHOPIFY_SYNC_INTERVAL_MS;

  const result: ShopifyScheduledSyncResult = {
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
    .eq("provider", "shopify")
    .in("status", ["connected", "error"])
    .order("last_success_at", { ascending: true, nullsFirst: true })
    .limit(100);

  if (query.error) {
    logger.error("shopify.scheduled_sync.query_failed", { error: query.error.message });
    result.errors += 1;
    return result;
  }

  const live = (query.data ?? []).filter((row) =>
    isLiveShopifyIntegration(row),
  ) as ShopifyIntegrationRow[];
  result.scanned = live.length;

  const due = live
    .filter((row) => isShopifySyncDue(row, Date.now(), intervalMs))
    .slice(0, limit);
  result.due = due.length;
  result.skipped = Math.max(0, live.length - due.length);

  for (const integration of due) {
    const storeId = integration.store_id;
    if (!storeId) {
      result.errors += 1;
      result.results.push({
        integrationId: integration.id,
        storeId: "unknown",
        syncType: "incremental",
        outcome: "error",
        message: "Integración sin store_id",
      });
      continue;
    }

    const syncType = resolveShopifyScheduledSyncType(integration);
    try {
      const run = await scheduledShopifySync(admin, {
        agencyId: integration.agency_id,
        storeId,
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
        syncType,
        outcome: "error",
        message: error instanceof Error ? error.message.slice(0, 200) : String(error),
      });
    }
  }

  if (result.due > 0 || result.errors > 0) {
    logger.info("shopify.scheduled_sync.complete", {
      intervalMs,
      ...result,
      results: result.results,
    });
  } else {
    logger.debug("shopify.scheduled_sync.idle", {
      scanned: result.scanned,
      skipped: result.skipped,
      intervalMs,
    });
  }

  return result;
}

async function markInitialBackfillDone(
  admin: DatabaseClient,
  integration: ShopifyIntegrationRow,
): Promise<void> {
  const prev =
    integration.metadata &&
    typeof integration.metadata === "object" &&
    !Array.isArray(integration.metadata)
      ? (integration.metadata as Record<string, unknown>)
      : {};
  await admin
    .from("integrations")
    .update({
      metadata: {
        ...prev,
        shopify_initial_backfill_pending: false,
        shopify_initial_backfill_done: true,
      } as Json,
    })
    .eq("id", integration.id);
}
