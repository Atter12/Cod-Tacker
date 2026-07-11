import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adsSpendSyncedPayloadSchema } from "@/lib/jobs/handlers/ads-spend-synced";
import { carrierShipmentUpdatedPayloadSchema } from "@/lib/jobs/handlers/carrier-shipment-updated";
import { settlementBatchReceivedPayloadSchema } from "@/lib/jobs/handlers/settlement-batch-received";
import { shopifyOrderCreatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-created";
import { shopifyOrderUpdatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-updated";
import { whatsappMessageReceivedPayloadSchema } from "@/lib/jobs/handlers/whatsapp-message-received";
import { PermanentJobError } from "@/lib/jobs/errors";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import type { BackgroundJobRow } from "@/types/database";

function fakeJob(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    agency_id: "00000000-0000-4000-8000-000000000002",
    store_id: "00000000-0000-4000-8000-000000000003",
    raw_event_id: null,
    integration_id: "00000000-0000-4000-8000-000000000004",
    queue: "default",
    job_type: "shopify.order.created.mock",
    status: "processing",
    priority: 100,
    payload: {},
    idempotency_key: "test",
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
    ...overrides,
  };
}

describe("handler payload validation", () => {
  it("rejects invalid shopify.order.created.mock payload", () => {
    const result = shopifyOrderCreatedPayloadSchema.safeParse({ total_amount: -1 });
    assert.equal(result.success, false);
  });

  it("rejects invalid shopify.order.updated.mock payload", () => {
    const result = shopifyOrderUpdatedPayloadSchema.safeParse({ order_status: "nope" });
    assert.equal(result.success, false);
  });

  it("rejects invalid ads.spend.synced.mock payload", () => {
    const result = adsSpendSyncedPayloadSchema.safeParse({
      platform: "meta",
      external_account_id: "x",
      metric_date: "not-a-date",
      spend: 1,
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid carrier.shipment.updated.mock payload", () => {
    const result = carrierShipmentUpdatedPayloadSchema.safeParse({ tracking_number: "" });
    assert.equal(result.success, false);
  });

  it("rejects invalid whatsapp.message.received.mock payload", () => {
    const result = whatsappMessageReceivedPayloadSchema.safeParse({
      phone: "1",
      external_message_id: "m1",
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid settlement.batch.received.mock payload", () => {
    const result = settlementBatchReceivedPayloadSchema.safeParse({
      external_batch_id: "b1",
      gross_amount: -5,
    });
    assert.equal(result.success, false);
  });

  it("handler throws PermanentJobError for invalid object payload", async () => {
    const handler = getJobHandler("shopify.order.created.mock");
    assert.ok(handler);
    await assert.rejects(
      () =>
        handler!({
          admin: {} as never,
          job: fakeJob(),
          payload: "not-an-object" as never,
        }),
      (err: unknown) => err instanceof PermanentJobError && err.code === "INVALID_PAYLOAD",
    );
  });
});
