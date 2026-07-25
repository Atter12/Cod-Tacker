import "server-only";

import {
  ECART_GATEWAY,
  ECART_SYNC_INTERVAL_MS,
  isConnectedEcartIntegration,
  isEcartSyncDue,
  syncEcartPaySettlementsForIntegration,
  type EcartPayIntegrationRow,
  type EcartSyncResult,
} from "@/lib/integrations/ecart-pay/sync";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";

export type EcartScheduledSyncResult = {
  scanned: number;
  due: number;
  synced: number;
  empty: number;
  ok: number;
  errors: number;
  skipped: number;
  results: Array<{
    integrationId: string;
    storeId: string;
    outcome: EcartSyncResult["outcome"] | "skipped";
    rowCount?: number;
    message?: string;
  }>;
};

const DEFAULT_BATCH = 10;

/**
 * Periodic Ecart Pay settlement sync for all connected stores.
 * Safe to call every minute: only integrations past the interval (~8h) run.
 */
export async function sweepEcartPayScheduledSyncs(
  admin: DatabaseClient,
  options: { limit?: number; intervalMs?: number; days?: number } = {},
): Promise<EcartScheduledSyncResult> {
  const limit = options.limit ?? DEFAULT_BATCH;
  const intervalMs = options.intervalMs ?? ECART_SYNC_INTERVAL_MS;
  const days = options.days ?? 30;

  const result: EcartScheduledSyncResult = {
    scanned: 0,
    due: 0,
    synced: 0,
    empty: 0,
    ok: 0,
    errors: 0,
    skipped: 0,
    results: [],
  };

  const query = await admin
    .from("integrations")
    .select(
      "id, agency_id, store_id, status, secret_reference, settings, last_success_at, last_error_at",
    )
    .eq("provider", "custom_payment")
    .eq("status", "connected")
    .order("last_success_at", { ascending: true, nullsFirst: true })
    .limit(100);

  if (query.error) {
    logger.error("ecart_pay.scheduled_sync.query_failed", { error: query.error.message });
    result.errors += 1;
    return result;
  }

  const connected = (query.data ?? []).filter((row) =>
    isConnectedEcartIntegration(row),
  ) as EcartPayIntegrationRow[];
  result.scanned = connected.length;

  const due = connected.filter((row) => isEcartSyncDue(row, Date.now(), intervalMs)).slice(0, limit);
  result.due = due.length;
  result.skipped = Math.max(0, connected.length - due.length);

  for (const integration of due) {
    const storeId = integration.store_id;
    if (!storeId) {
      result.errors += 1;
      result.results.push({
        integrationId: integration.id,
        storeId: "unknown",
        outcome: "error",
        message: "Integración sin store_id",
      });
      continue;
    }
    try {
      const syncResult = await syncEcartPaySettlementsForIntegration(admin, {
        integration,
        days,
        triggerSource: "scheduled",
        actorId: null,
        kickWorker: false,
      });
      result.synced += 1;
      if (syncResult.outcome === "empty") result.empty += 1;
      if (syncResult.outcome === "ok") result.ok += 1;
      result.results.push({
        integrationId: integration.id,
        storeId,
        outcome: syncResult.outcome,
        rowCount: syncResult.rowCount,
        message: syncResult.message,
      });
    } catch (error) {
      result.errors += 1;
      result.results.push({
        integrationId: integration.id,
        storeId,
        outcome: "error",
        message: error instanceof Error ? error.message.slice(0, 200) : String(error),
      });
    }
  }

  if (result.due > 0 || result.errors > 0) {
    logger.info("ecart_pay.scheduled_sync.complete", {
      gateway: ECART_GATEWAY,
      intervalMs,
      ...result,
      results: result.results,
    });
  } else {
    logger.debug("ecart_pay.scheduled_sync.idle", {
      scanned: result.scanned,
      skipped: result.skipped,
      intervalMs,
    });
  }

  return result;
}
