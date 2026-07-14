import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import { normalizeShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { shopifyGidToExternalId } from "@/lib/integrations/shopify/map-order";
import { verifyShopifyOAuthHmac, verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import {
  mapRestOrderToCreatedPayload,
  mapRestOrderToUpdatedPayload,
} from "@/lib/integrations/shopify/map-order";

describe("shopify domain", () => {
  it("normalizes myshopify domains", () => {
    assert.equal(normalizeShopifyShopDomain("Mi-Tienda"), "mi-tienda.myshopify.com");
    assert.equal(
      normalizeShopifyShopDomain("https://demo.myshopify.com/admin"),
      "demo.myshopify.com",
    );
    assert.equal(normalizeShopifyShopDomain("not a shop"), null);
  });
});

describe("shopify oauth hmac", () => {
  it("accepts a valid hmac", () => {
    const secret = "shpss_test_secret";
    const query = {
      code: "abc",
      shop: "demo.myshopify.com",
      state: "xyz",
      timestamp: "123",
    };
    const message = Object.keys(query)
      .sort()
      .map((k) => `${k}=${query[k as keyof typeof query]}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    assert.equal(verifyShopifyOAuthHmac({ ...query, hmac }, secret), true);
    assert.equal(verifyShopifyOAuthHmac({ ...query, hmac: "deadbeef" }, secret), false);
  });
});

describe("shopify webhook hmac", () => {
  it("accepts a valid base64 body hmac", () => {
    const secret = "shpss_test_secret";
    const body = '{"id":1}';
    const hmac = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verifyShopifyWebhookHmac(body, hmac, secret), true);
    assert.equal(verifyShopifyWebhookHmac(body, "bad", secret), false);
  });
});

describe("shopify order mapping", () => {
  it("maps REST create payloads", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 998877,
      name: "#1001",
      currency: "pen",
      total_price: "149.90",
      subtotal_price: "140.00",
    });
    assert.equal(payload.external_order_id, "998877");
    assert.equal(payload.order_number, "1001");
    assert.equal(payload.currency_code, "PEN");
    assert.equal(payload.total_amount, 149.9);
    assert.equal(payload.mode, "live");
  });

  it("maps cancelled updated payloads", () => {
    const payload = mapRestOrderToUpdatedPayload({
      id: 1,
      cancelled_at: "2026-07-14T00:00:00Z",
      currency: "USD",
      total_price: "10",
    });
    assert.equal(payload.order_status, "cancelled");
  });

  it("extracts numeric ids from GIDs", () => {
    assert.equal(shopifyGidToExternalId("gid://shopify/Order/12345"), "12345");
    assert.equal(shopifyGidToExternalId("99"), "99");
  });
});
