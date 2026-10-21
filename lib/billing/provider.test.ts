import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAgencyBillingProvider, parseBillingProviderId } from "@/lib/billing/provider-id";
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

describe("agency billing provider (App Store 1.2.1)", () => {
  const base = {
    storedProvider: null,
    envProvider: "stripe" as const,
    shopifyAppPricingConfigured: true,
    cameFromShopify: false,
  };

  it("never sends a Shopify-origin agency without a subscription to Stripe", () => {
    assert.equal(decideAgencyBillingProvider({ ...base, cameFromShopify: true }), "shopify");
    assert.equal(
      decideAgencyBillingProvider({ ...base, storedProvider: "demo", cameFromShopify: true }),
      "shopify",
    );
  });

  it("fails closed to Shopify when App Pricing is not configured", () => {
    assert.equal(
      decideAgencyBillingProvider({
        ...base,
        cameFromShopify: true,
        shopifyAppPricingConfigured: false,
      }),
      "shopify",
    );
  });

  it("keeps a stored Stripe subscription (legacy agency)", () => {
    assert.equal(
      decideAgencyBillingProvider({ ...base, storedProvider: "stripe", cameFromShopify: true }),
      "stripe",
    );
  });

  it("uses BILLING_PROVIDER for console-only agencies", () => {
    assert.equal(decideAgencyBillingProvider(base), "stripe");
    assert.equal(
      decideAgencyBillingProvider({
        ...base,
        storedProvider: "shopify",
        shopifyAppPricingConfigured: false,
      }),
      "stripe",
    );
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
