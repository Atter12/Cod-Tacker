import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapRestOrderToCreatedPayload } from "@/lib/integrations/shopify/map-order";
import { shopifyOrderWebhookJobType } from "@/lib/integrations/shopify/webhook-job";
import { decideWhatsappCodConfirmationEnqueue } from "@/lib/integrations/whatsapp/confirmation-gate";
import { inferConfirmationFromBody } from "@/lib/whatsapp/templates";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import { handleWhatsappConfirmationRequest } from "@/lib/jobs/handlers/whatsapp-confirmation-request";

/**
 * Strategic cross 2 — Entrada → Confirmación.
 * A COD Shopify order queues the WhatsApp template. The reply confirms or
 * rejects. A prepaid order never queues that template.
 */
describe("strategic · entrada → confirmación", () => {
  it("queues WhatsApp confirmation for a COD order and applies the reply", () => {
    const cod = mapRestOrderToCreatedPayload({
      id: 2001,
      name: "#2001",
      currency: "PEN",
      total_price: "120.00",
      financial_status: "pending",
      tags: "COD",
      payment_gateway_names: ["Cash on Delivery (COD)"],
    });
    assert.equal(cod.payment_status, "cash_expected");
    assert.equal(shopifyOrderWebhookJobType("orders/create"), "shopify.order.created");

    const queued = decideWhatsappCodConfirmationEnqueue({
      paymentStatus: cod.payment_status ?? null,
      confirmationStatus: "not_requested",
    });
    assert.deepEqual(queued, { enqueue: true });
    assert.equal(
      getJobHandler("whatsapp.confirmation.request"),
      handleWhatsappConfirmationRequest,
    );

    assert.equal(inferConfirmationFromBody("SI confirmo el pedido"), "confirmed");
    assert.equal(inferConfirmationFromBody("NO quiero el pedido"), "rejected");
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: "cash_expected",
        confirmationStatus: "confirmed",
      }),
      { enqueue: false, skipped: "confirmation_terminal" },
    );
  });

  it("does not queue the template for a prepaid order", () => {
    const prepaid = mapRestOrderToCreatedPayload({
      id: 2002,
      name: "#2002",
      currency: "PEN",
      total_price: "89.00",
      financial_status: "paid",
      tags: "prepaid",
      payment_gateway_names: ["shopify_payments"],
    });
    assert.equal(prepaid.payment_kind, "prepaid");
    assert.equal(prepaid.payment_status, "unpaid");
    assert.equal(prepaid.expected_cod_amount, null);
    assert.deepEqual(
      decideWhatsappCodConfirmationEnqueue({
        paymentStatus: prepaid.payment_status ?? null,
        confirmationStatus: "not_requested",
      }),
      { enqueue: false, skipped: "not_cash_expected" },
    );
    assert.notEqual(
      getJobHandler("shopify.order.created"),
      getJobHandler("whatsapp.confirmation.request"),
    );
  });
});
