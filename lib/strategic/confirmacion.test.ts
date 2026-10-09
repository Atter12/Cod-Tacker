import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapShopifyPayment } from "@/lib/integrations/shopify/map-payment";
import { decideWhatsappCodConfirmationEnqueue } from "@/lib/integrations/whatsapp/confirmation-gate";
import { inferConfirmationFromBody } from "@/lib/whatsapp/templates";
import { PermanentJobError } from "@/lib/jobs/errors";
import {
  handleWhatsappConfirmationRequest,
  whatsappConfirmationRequestPayloadSchema,
} from "@/lib/jobs/handlers/whatsapp-confirmation-request";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import type { BackgroundJobRow } from "@/types/database";

const ORDER_ID = "00000000-0000-4000-8000-000000000099";

function fakeJob(): BackgroundJobRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    agency_id: "00000000-0000-4000-8000-000000000002",
    store_id: "00000000-0000-4000-8000-000000000003",
    raw_event_id: null,
    integration_id: null,
    queue: "default",
    job_type: "whatsapp.confirmation.request",
    status: "processing",
    priority: 100,
    payload: {},
    idempotency_key: "wa-confirm:strategic",
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
 * Strategic group 3 — Confirmación.
 * A COD order is the only one that queues the WhatsApp template.
 * The reply confirms or rejects; a broken payload does not retry forever.
 */
describe("strategic · confirmación", () => {
  it("queues the confirmation template only for a COD order still waiting", () => {
    const cod = mapShopifyPayment({
      financialStatus: "pending",
      tags: "COD",
      totalAmount: 120,
    });
    assert.equal(cod.payment_status, "cash_expected");
    const queued = decideWhatsappCodConfirmationEnqueue({
      paymentStatus: cod.payment_status,
      confirmationStatus: "not_requested",
    });
    assert.deepEqual(queued, { enqueue: true });
    assert.equal(
      getJobHandler("whatsapp.confirmation.request"),
      handleWhatsappConfirmationRequest,
    );
    assert.notEqual(
      getJobHandler("whatsapp.confirmation.request"),
      getJobHandler("shopify.order.created"),
    );

    const prepaid = mapShopifyPayment({
      financialStatus: "paid",
      paymentGatewayNames: ["shopify_payments"],
      totalAmount: 120,
    });
    assert.equal(prepaid.payment_kind, "prepaid");
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: prepaid.payment_status,
        confirmationStatus: "not_requested",
      }),
      { enqueue: false, skipped: "not_cash_expected" },
    );
  });

  it("does not send again after the customer already confirmed or rejected", () => {
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: "cash_expected",
        confirmationStatus: "confirmed",
      }),
      { enqueue: false, skipped: "confirmation_terminal" },
    );
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: "cash_expected",
        confirmationStatus: "rejected",
      }),
      { enqueue: false, skipped: "confirmation_terminal" },
    );
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: "cash_expected",
        confirmationStatus: "pending",
      }),
      { enqueue: false, skipped: "already_pending" },
    );
  });

  it("confirms or rejects from the template reply and leaves an ambiguous reply pending", () => {
    assert.equal(inferConfirmationFromBody("SI confirmo el pedido"), "confirmed");
    assert.equal(inferConfirmationFromBody("NO quiero el pedido"), "rejected");
    assert.equal(inferConfirmationFromBody("tal vez mañana"), "pending");
    assert.equal(inferConfirmationFromBody("   "), null);
  });

  it("treats a broken confirmation payload as a permanent job error", async () => {
    assert.equal(
      whatsappConfirmationRequestPayloadSchema.safeParse({ order_id: ORDER_ID }).success,
      true,
    );
    assert.equal(
      whatsappConfirmationRequestPayloadSchema.safeParse({ order_id: "not-a-uuid" }).success,
      false,
    );
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
});
