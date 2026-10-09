import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import { mapRestOrderToCreatedPayload } from "@/lib/integrations/shopify/map-order";
import { shopifyOrderWebhookJobType } from "@/lib/integrations/shopify/webhook-job";
import { decideShopifyInstallEntry } from "@/lib/integrations/shopify/install-entry";
import { shopifyOrderCreatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-payload";
import { getJobHandler } from "@/lib/jobs/handlers/registry";

const SECRET = "shopify-test-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

/**
 * Strategic group 2 — Entrada.
 * A signed Shopify order becomes a store-scoped create job. COD and prepaid
 * stay distinct, and an install without a tenant never opens Facturación.
 */
describe("strategic · entrada", () => {
  it("rejects an unsigned order webhook before any job is chosen", () => {
    const body = JSON.stringify({ id: 1001 });
    assert.equal(verifyShopifyWebhookHmac(body, null, SECRET), false);
    assert.equal(verifyShopifyWebhookHmac(body, "not-a-signature", SECRET), false);
    assert.equal(verifyShopifyWebhookHmac(body, sign(body), SECRET), true);
    assert.equal(verifyShopifyWebhookHmac(`${body} `, sign(body), SECRET), false);
  });

  it("maps a COD order onto shopify.order.created for that order id", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 1001,
      name: "#1001",
      currency: "PEN",
      total_price: "149.90",
      financial_status: "pending",
      tags: "COD",
      payment_gateway_names: ["Cash on Delivery (COD)"],
    });

    assert.equal(payload.external_order_id, "1001");
    assert.equal(payload.payment_kind, "cod");
    assert.equal(payload.payment_status, "cash_expected");
    assert.equal(payload.expected_cod_amount, 149.9);
    assert.equal(shopifyOrderCreatedPayloadSchema.safeParse(payload).success, true);

    const jobType = shopifyOrderWebhookJobType("orders/create");
    assert.equal(jobType, "shopify.order.created");
    assert.equal(getJobHandler(jobType!), getJobHandler("shopify.order.created"));
    assert.notEqual(getJobHandler(jobType!), getJobHandler("whatsapp.confirmation.request"));
    assert.notEqual(getJobHandler(jobType!), getJobHandler("ads.spend.synced"));
    assert.notEqual(getJobHandler(jobType!), getJobHandler("flipy.auto_create.shipment"));
  });

  it("keeps a prepaid order on the same create job without a COD amount", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 1002,
      name: "#1002",
      currency: "PEN",
      total_price: "89.00",
      financial_status: "paid",
      tags: "prepaid",
      payment_gateway_names: ["shopify_payments"],
    });

    assert.equal(payload.external_order_id, "1002");
    assert.equal(payload.payment_kind, "prepaid");
    assert.equal(payload.payment_status, "unpaid");
    assert.equal(payload.expected_cod_amount, null);
    assert.equal(shopifyOrderWebhookJobType("orders/create"), "shopify.order.created");
    assert.equal(shopifyOrderWebhookJobType("ORDERS/UPDATED"), "shopify.order.updated");
    assert.equal(shopifyOrderWebhookJobType("customers/redact"), null);
  });

  it("sends an install without a tenant to /embed", () => {
    assert.equal(
      decideShopifyInstallEntry({ hasSession: false, agencySlug: "", storeSlug: "" }),
      "embed",
    );
    assert.equal(
      decideShopifyInstallEntry({ hasSession: true, agencySlug: "", storeSlug: "" }),
      "embed",
    );
    assert.equal(
      decideShopifyInstallEntry({ hasSession: true, agencySlug: "acme", storeSlug: "tienda" }),
      "oauth",
    );
  });
});
