import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermanentJobError } from "@/lib/jobs/errors";
import { decideJobFailureOutcome } from "@/lib/jobs/failure-outcome";
import { computeRetryAt } from "@/lib/jobs/backoff";
import { handleShopifyOrderCreated } from "@/lib/jobs/handlers/shopify-order-created";
import {
  automationIdempotencyKey,
  shouldSkipAutomationRun,
} from "@/lib/automations/idempotency";
import { isLoopTrigger } from "@/lib/automations/evaluate";
import { shouldNotifyAlert } from "@/lib/alerts/labels";
import type { BackgroundJobRow } from "@/types/database";

function fakeJob(): BackgroundJobRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    agency_id: "00000000-0000-4000-8000-000000000002",
    store_id: "00000000-0000-4000-8000-000000000003",
    raw_event_id: null,
    integration_id: null,
    queue: "default",
    job_type: "shopify.order.created",
    status: "processing",
    priority: 100,
    payload: {},
    idempotency_key: "strategic-platform",
    attempts: 1,
    max_attempts: 8,
    run_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    started_at: null,
    finished_at: null,
    last_error_code: null,
    last_error_message: null,
    correlation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Strategic group 7 — Plataforma.
 * A bad payload dead-letters instead of retrying forever. A rule runs once per
 * event. An acknowledged or silenced alert does not notify again.
 */
describe("strategic · plataforma", () => {
  it("dead-letters an invalid job payload instead of retrying it", async () => {
    await assert.rejects(
      () =>
        handleShopifyOrderCreated({
          admin: {} as never,
          job: fakeJob(),
          payload: "not-an-object" as never,
        }),
      (err: unknown) => err instanceof PermanentJobError && err.code === "INVALID_PAYLOAD",
    );
    assert.equal(
      decideJobFailureOutcome({ permanent: true, attempts: 1, maxAttempts: 8 }),
      "dead_letter",
    );
  });

  it("retries until max attempts and then dead-letters", () => {
    assert.equal(
      decideJobFailureOutcome({ permanent: false, attempts: 2, maxAttempts: 8 }),
      "retry",
    );
    const retryAt = computeRetryAt(2, 1_000, 60_000, "job-1:2");
    assert.ok(retryAt.getTime() > Date.now() - 1_000);

    assert.equal(
      decideJobFailureOutcome({ permanent: false, attempts: 8, maxAttempts: 8 }),
      "dead_letter",
    );
  });

  it("does not run the same automation twice for the same event", () => {
    const first = automationIdempotencyKey("rule-1", "order.confirmed", "order-1");
    const again = automationIdempotencyKey("rule-1", "order.confirmed", "order-1");
    assert.equal(again, first);
    assert.notEqual(
      automationIdempotencyKey("rule-1", "order.confirmed", "order-2"),
      first,
    );
    assert.equal(shouldSkipAutomationRun("run-1"), true);
    assert.equal(shouldSkipAutomationRun(null), false);
    assert.equal(
      isLoopTrigger({ source: "automation", __from_automation: true }),
      true,
    );
  });

  it("does not notify an alert that was acknowledged or silenced", () => {
    const now = Date.parse("2026-10-09T18:00:00.000Z");
    assert.equal(shouldNotifyAlert({ status: "open" }, now), true);
    assert.equal(
      shouldNotifyAlert({ status: "open", acknowledged_at: "2026-10-09T17:00:00.000Z" }, now),
      false,
    );
    assert.equal(
      shouldNotifyAlert(
        { status: "silenced", silenced_until: "2026-10-10T18:00:00.000Z" },
        now,
      ),
      false,
    );
    assert.equal(
      shouldNotifyAlert({ status: "reopened", resolved_at: null }, now),
      true,
    );
  });
});
