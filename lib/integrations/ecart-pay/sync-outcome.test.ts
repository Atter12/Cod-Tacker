import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEcartSyncOutcome,
  ECART_EMPTY_SYNC_MESSAGE,
  isEcartSyncDue,
  lastEcartSyncAttemptAt,
  messageForEcartSyncOutcome,
} from "@/lib/integrations/ecart-pay/sync-outcome";

describe("ecart-pay sync outcome", () => {
  it("classifies zero rows as empty and positive as ok", () => {
    assert.equal(classifyEcartSyncOutcome(0), "empty");
    assert.equal(classifyEcartSyncOutcome(3), "ok");
  });

  it("uses a clear empty message that is not an error", () => {
    const msg = messageForEcartSyncOutcome("empty");
    assert.equal(msg, ECART_EMPTY_SYNC_MESSAGE);
    assert.match(msg, /0 transacciones/i);
    assert.match(msg, /no es error/i);
  });

  it("formats ok and error messages", () => {
    assert.match(messageForEcartSyncOutcome("ok", { rowCount: 2, jobId: "abcdef12-xxxx" }), /2/);
    assert.match(messageForEcartSyncOutcome("error", { errorMessage: "boom" }), /boom/);
  });
});

describe("ecart-pay sync due watermark", () => {
  const interval = 8 * 60 * 60 * 1000;

  it("is due when never attempted", () => {
    assert.equal(
      isEcartSyncDue({ last_success_at: null, last_error_at: null }, Date.now(), interval),
      true,
    );
  });

  it("is not due inside the interval after success", () => {
    const now = Date.now();
    const recent = new Date(now - interval / 2).toISOString();
    assert.equal(
      isEcartSyncDue({ last_success_at: recent, last_error_at: null }, now, interval),
      false,
    );
  });

  it("is due after the interval", () => {
    const now = Date.now();
    const old = new Date(now - interval - 1000).toISOString();
    assert.equal(
      isEcartSyncDue({ last_success_at: old, last_error_at: null }, now, interval),
      true,
    );
  });

  it("uses the newer of success/error as last attempt", () => {
    const success = "2026-07-24T10:00:00.000Z";
    const error = "2026-07-24T12:00:00.000Z";
    const last = lastEcartSyncAttemptAt({ last_success_at: success, last_error_at: error });
    assert.equal(last?.toISOString(), error);
  });
});
