import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBillingProviderId } from "@/lib/billing/provider-id";
import {
  buildShopifyAppPricingPlansUrlFromShop,
  shopifyStoreHandleFromDomain,
} from "@/lib/billing/shopify-pricing-url";

describe("billing provider id parse", () => {
  it("accepts demo, stripe, and shopify", () => {
    assert.equal(parseBillingProviderId("demo"), "demo");
    assert.equal(parseBillingProviderId("stripe"), "stripe");
    assert.equal(parseBillingProviderId("SHOPIFY"), "shopify");
    assert.equal(parseBillingProviderId("paddle"), null);
    assert.equal(parseBillingProviderId(""), null);
  });
});

describe("shopify billing redirect target", () => {
  it("builds a stable Admin pricing URL for an agency shop", () => {
    assert.equal(shopifyStoreHandleFromDomain("acme.myshopify.com"), "acme");
    assert.equal(
      buildShopifyAppPricingPlansUrlFromShop({
        shopDomain: "acme.myshopify.com",
        appHandle: "codtracked",
      }),
      "https://admin.shopify.com/store/acme/charges/codtracked/pricing_plans",
    );
  });
});
