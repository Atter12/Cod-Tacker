import "server-only";

import {
  decideSweepAction,
  nextHeldRecheckAt,
} from "@/lib/conversions/release-sweep-policy";
import { sendQueuedPurchaseConversion } from "@/lib/conversions/record-purchase-conversion";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Enums } from "@/types/database.generated";

/**
 * Periodic release-gate worker (runs from the jobs cron, cross-store).
 *
 * Closes the two gaps the synchronous gate leaves open:
 * 1. Held candidates (`pending_review`) whose order later became eligible are
 *    auto-released and sent; terminally-negative ones are auto-rejected so the
 *    review queue only shows candidates a human can still act on.
 * 2. Released candidates whose send failed (or stayed queued waiting for
 *    credentials) are retried until `max_attempts`, honoring `next_retry_at`.
 */

export type ReleaseSweepResult = {
  scannedHeld: number;
  released: number;
  rejected: number;
  stillHeld: number;
  scannedRetries: number;
  retried: number;
  sent: number;
  errors: number;
};

const DEFAULT_BATCH = 25;

type OrderState = {
  order_status: Enums<"order_status"> | null;
  payment_status: Enums<"payment_status"> | null;
  confirmation_status: Enums<"confirmation_status"> | null;
};

async function loadOrderStates(
  admin: DatabaseClient,
  orderIds: string[],
): Promise<Map<string, OrderState>> {
  const map = new Map<string, OrderState>();
  if (orderIds.length === 0) return map;
  const res = await admin
    .from("orders")
    .select("id, order_status, payment_status, confirmation_status")
    .in("id", orderIds);
  for (const row of res.data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

async function sweepHeldCandidates(
  admin: DatabaseClient,
  limit: number,
  result: ReleaseSweepResult,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const held = await admin
    .from("conversion_events")
    .select("id, agency_id, store_id, order_id, value")
    .eq("release_status", "pending_review")
    .is("sent_at", null)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (held.error) {
    logger.error("conversion.release_sweep.held_query_failed", {
      error: held.error.message,
    });
    result.errors += 1;
    return;
  }

  const rows = held.data ?? [];
  result.scannedHeld = rows.length;
  if (rows.length === 0) return;

  const orders = await loadOrderStates(
    admin,
    rows.map((r) => r.order_id),
  );

  for (const row of rows) {
    const order = orders.get(row.order_id);
    const { action, decision } = decideSweepAction({
      value: Number(row.value ?? 0),
      orderStatus: order?.order_status ?? null,
      paymentStatus: order?.payment_status ?? null,
      confirmationStatus: order?.confirmation_status ?? null,
    });

    if (action === "release") {
      // released_by stays null: the automatic filter decided (column contract).
      const upd = await admin
        .from("conversion_events")
        .update({
          release_status: "released",
          released_at: new Date().toISOString(),
          hold_reason: null,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("release_status", "pending_review");
      if (upd.error) {
        result.errors += 1;
        continue;
      }
      result.released += 1;
      logger.info("conversion.release_sweep.auto_released", {
        conversion_event_id: row.id,
        order_id: row.order_id,
        release_reason: decision.reason,
      });
      const sendResult = await sendQueuedPurchaseConversion({
        admin,
        agencyId: row.agency_id,
        storeId: row.store_id,
        conversionEventRowId: row.id,
      });
      if (sendResult.deliveryStatus === "sent") result.sent += 1;
      continue;
    }

    if (action === "reject") {
      const upd = await admin
        .from("conversion_events")
        .update({
          release_status: "rejected",
          status: "cancelled",
          hold_reason: decision.reason,
          released_at: new Date().toISOString(),
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("release_status", "pending_review");
      if (upd.error) {
        result.errors += 1;
        continue;
      }
      result.rejected += 1;
      logger.info("conversion.release_sweep.auto_rejected", {
        conversion_event_id: row.id,
        order_id: row.order_id,
        hold_reason: decision.reason,
      });
      continue;
    }

    // Still held: refresh the reason and schedule the next recheck so each
    // sweep run scans a rotating window instead of the same rows forever.
    const upd = await admin
      .from("conversion_events")
      .update({
        hold_reason: decision.reason,
        next_retry_at: nextHeldRecheckAt().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("release_status", "pending_review");
    if (upd.error) result.errors += 1;
    else result.stillHeld += 1;
  }
}

async function sweepFailedSends(
  admin: DatabaseClient,
  limit: number,
  result: ReleaseSweepResult,
): Promise<void> {
  const nowIso = new Date().toISOString();
  // Only rows with a due next_retry_at: the send path schedules it after every
  // non-sent attempt and clears it once attempts are exhausted, so exhausted
  // candidates drop out of this query (manual retry remains available).
  const due = await admin
    .from("conversion_events")
    .select("id, agency_id, store_id, order_id, attempts, max_attempts")
    .eq("release_status", "released")
    .is("sent_at", null)
    .in("status", ["queued", "failed"])
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (due.error) {
    logger.error("conversion.release_sweep.retry_query_failed", {
      error: due.error.message,
    });
    result.errors += 1;
    return;
  }

  const rows = due.data ?? [];
  result.scannedRetries = rows.length;

  for (const row of rows) {
    if (row.attempts >= row.max_attempts) {
      // Defensive: exhausted rows should already have next_retry_at cleared.
      await admin
        .from("conversion_events")
        .update({ next_retry_at: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }
    result.retried += 1;
    const sendResult = await sendQueuedPurchaseConversion({
      admin,
      agencyId: row.agency_id,
      storeId: row.store_id,
      conversionEventRowId: row.id,
    });
    if (sendResult.deliveryStatus === "sent") result.sent += 1;
  }
}

/**
 * One sweep pass. Safe to run every minute: batches are small, retries honor
 * `next_retry_at` backoff, and held rechecks are spaced by the sweep policy.
 */
export async function sweepConversionReleases(
  admin: DatabaseClient,
  options: { heldLimit?: number; retryLimit?: number } = {},
): Promise<ReleaseSweepResult> {
  const result: ReleaseSweepResult = {
    scannedHeld: 0,
    released: 0,
    rejected: 0,
    stillHeld: 0,
    scannedRetries: 0,
    retried: 0,
    sent: 0,
    errors: 0,
  };

  await sweepHeldCandidates(admin, options.heldLimit ?? DEFAULT_BATCH, result);
  await sweepFailedSends(admin, options.retryLimit ?? DEFAULT_BATCH, result);

  if (
    result.scannedHeld > 0 ||
    result.scannedRetries > 0 ||
    result.errors > 0
  ) {
    logger.info("conversion.release_sweep.complete", { ...result });
  }
  return result;
}
