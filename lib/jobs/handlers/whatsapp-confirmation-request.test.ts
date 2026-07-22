import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermanentJobError } from "@/lib/jobs/errors";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import {
  handleWhatsappConfirmationRequest,
  whatsappConfirmationRequestPayloadSchema,
} from "@/lib/jobs/handlers/whatsapp-confirmation-request";
import { mapShopifyPayment } from "@/lib/integrations/shopify/map-payment";
import type { BackgroundJobRow } from "@/types/database";

function fakeJob(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    agency_id: "00000000-0000-4000-8000-000000000002",
    store_id: "00000000-0000-4000-8000-000000000003",
    raw_event_id: null,
    integration_id: "00000000-0000-4000-8000-000000000004",
    queue: "default",
    job_type: "whatsapp.confirmation.request",
    status: "processing",
    priority: 100,
    payload: {},
    idempotency_key: "wa-confirm:test",
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

describe("whatsapp.confirmation.request job", () => {
  it("is registered in the job handler registry", () => {
    const handler = getJobHandler("whatsapp.confirmation.request");
    assert.equal(handler, handleWhatsappConfirmationRequest);
  });

  it("accepts a valid order_id payload", () => {
    const parsed = whatsappConfirmationRequestPayloadSchema.safeParse({
      order_id: "00000000-0000-4000-8000-000000000099",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid order_id payload", () => {
    const parsed = whatsappConfirmationRequestPayloadSchema.safeParse({
      order_id: "not-a-uuid",
    });
    assert.equal(parsed.success, false);
  });

  it("throws PermanentJobError for non-object payload", async () => {
    await assert.rejects(
      () =>
        handleWhatsappConfirmationRequest({
          admin: {} as never,
          job: fakeJob(),
          payload: "not-an-object" as never,
        }),
      (err: unknown) => err instanceof PermanentJobError && err.code === "INVALID_PAYLOAD",
    );
  });

  it("COD tag maps to cash_expected (enqueue gate for this job)", () => {
    const mapped = mapShopifyPayment({
      financialStatus: "pending",
      tags: "COD",
      totalAmount: 100,
    });
    assert.equal(mapped.payment_status, "cash_expected");
    assert.equal(mapped.payment_kind, "cod");
  });

  it("prepaid card does not map to cash_expected (no WA confirmation enqueue)", () => {
    const mapped = mapShopifyPayment({
      financialStatus: "paid",
      paymentGatewayNames: ["Shopify Payments"],
      totalAmount: 100,
    });
    assert.equal(mapped.payment_status, "unpaid");
    assert.equal(mapped.payment_kind, "prepaid");
  });
});
