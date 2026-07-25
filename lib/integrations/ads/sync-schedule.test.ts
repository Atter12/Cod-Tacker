import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADS_SYNC_INTERVAL_MS,
  isAdsSyncDue,
  isLiveAdsIntegration,
  lastAdsSyncAttemptAt,
  needsAdsInitialBackfill,
  resolveAdsScheduledSyncType,
} from "@/lib/integrations/ads/sync-schedule";

describe("ads sync due watermark", () => {
  const interval = ADS_SYNC_INTERVAL_MS;

  it("is due when never attempted", () => {
    assert.equal(
      isAdsSyncDue({ last_success_at: null, last_error_at: null }, Date.now(), interval),
      true,
    );
  });

  it("is not due inside the interval after success", () => {
    const now = Date.now();
    const recent = new Date(now - interval / 2).toISOString();
    assert.equal(
      isAdsSyncDue({ last_success_at: recent, last_error_at: null }, now, interval),
      false,
    );
  });

  it("is due after the interval", () => {
    const now = Date.now();
    const old = new Date(now - interval - 1000).toISOString();
    assert.equal(
      isAdsSyncDue({ last_success_at: old, last_error_at: null }, now, interval),
      true,
    );
  });

  it("uses the newer of success/error as last attempt", () => {
    const success = "2026-07-24T10:00:00.000Z";
    const error = "2026-07-24T12:00:00.000Z";
    const last = lastAdsSyncAttemptAt({ last_success_at: success, last_error_at: error });
    assert.equal(last?.toISOString(), error);
  });
});

describe("ads live filter + initial backfill", () => {
  it("accepts connected live meta/tiktok only", () => {
    assert.equal(
      isLiveAdsIntegration({
        provider: "meta",
        status: "connected",
        metadata: { mode: "live", demo: false },
      }),
      true,
    );
    assert.equal(
      isLiveAdsIntegration({
        provider: "meta",
        status: "connected",
        metadata: { mode: "mock", demo: true },
      }),
      false,
    );
    assert.equal(
      isLiveAdsIntegration({
        provider: "shopify",
        status: "connected",
        metadata: { mode: "live" },
      }),
      false,
    );
  });

  it("requires initial backfill until done flag or first success", () => {
    assert.equal(
      needsAdsInitialBackfill({ last_success_at: null, metadata: {} }),
      true,
    );
    assert.equal(
      needsAdsInitialBackfill({
        last_success_at: null,
        metadata: { ads_initial_backfill_pending: true },
      }),
      true,
    );
    assert.equal(
      needsAdsInitialBackfill({
        last_success_at: "2026-07-25T00:00:00.000Z",
        metadata: { ads_initial_backfill_done: true },
      }),
      false,
    );
    assert.equal(
      resolveAdsScheduledSyncType({
        last_success_at: null,
        metadata: { ads_initial_backfill_pending: true },
      }),
      "backfill",
    );
    assert.equal(
      resolveAdsScheduledSyncType({
        last_success_at: "2026-07-25T00:00:00.000Z",
        metadata: { ads_initial_backfill_done: true },
      }),
      "incremental",
    );
  });
});
