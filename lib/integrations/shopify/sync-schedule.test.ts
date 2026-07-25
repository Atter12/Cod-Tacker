import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHOPIFY_SYNC_INTERVAL_MS,
  isLiveShopifyIntegration,
  isShopifySyncDue,
  lastShopifySyncAttemptAt,
  needsShopifyInitialBackfill,
  resolveShopifyScheduledSyncType,
} from "@/lib/integrations/shopify/sync-schedule";

describe("shopify sync due watermark", () => {
  const interval = SHOPIFY_SYNC_INTERVAL_MS;

  it("is due when never attempted", () => {
    assert.equal(
      isShopifySyncDue({ last_success_at: null, last_error_at: null }, Date.now(), interval),
      true,
    );
  });

  it("is not due inside the interval after success", () => {
    const now = Date.now();
    const recent = new Date(now - interval / 2).toISOString();
    assert.equal(
      isShopifySyncDue({ last_success_at: recent, last_error_at: null }, now, interval),
      false,
    );
  });

  it("is due after the interval", () => {
    const now = Date.now();
    const old = new Date(now - interval - 1000).toISOString();
    assert.equal(
      isShopifySyncDue({ last_success_at: old, last_error_at: null }, now, interval),
      true,
    );
  });

  it("uses the newer of success/error as last attempt", () => {
    const success = "2026-07-24T10:00:00.000Z";
    const error = "2026-07-24T12:00:00.000Z";
    const last = lastShopifySyncAttemptAt({ last_success_at: success, last_error_at: error });
    assert.equal(last?.toISOString(), error);
  });
});

describe("shopify live filter + initial backfill", () => {
  it("accepts connected live shopify only", () => {
    assert.equal(
      isLiveShopifyIntegration({
        provider: "shopify",
        status: "connected",
        metadata: { mode: "live", demo: false },
      }),
      true,
    );
    assert.equal(
      isLiveShopifyIntegration({
        provider: "shopify",
        status: "connected",
        metadata: { mode: "mock", demo: true },
      }),
      false,
    );
    assert.equal(
      isLiveShopifyIntegration({
        provider: "meta",
        status: "connected",
        metadata: { mode: "live" },
      }),
      false,
    );
  });

  it("requires initial backfill until done flag or first success", () => {
    assert.equal(needsShopifyInitialBackfill({ last_success_at: null, metadata: {} }), true);
    assert.equal(
      needsShopifyInitialBackfill({
        last_success_at: null,
        metadata: { shopify_initial_backfill_pending: true },
      }),
      true,
    );
    assert.equal(
      needsShopifyInitialBackfill({
        last_success_at: "2026-07-25T00:00:00.000Z",
        metadata: { shopify_initial_backfill_done: true },
      }),
      false,
    );
    assert.equal(
      resolveShopifyScheduledSyncType({
        last_success_at: null,
        metadata: { shopify_initial_backfill_pending: true },
      }),
      "backfill",
    );
    assert.equal(
      resolveShopifyScheduledSyncType({
        last_success_at: "2026-07-25T00:00:00.000Z",
        metadata: { shopify_initial_backfill_done: true },
      }),
      "incremental",
    );
  });
});
