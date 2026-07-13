import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { verifyShopifyOAuthHmac } from "@/lib/integrations/shopify/hmac";
import { createHmac } from "node:crypto";

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
