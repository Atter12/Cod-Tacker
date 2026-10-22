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
  const base = { storedProvider: null, envProvider: "stripe" as const, cameFromShopify: false };

  it("never chooses Stripe, even with BILLING_PROVIDER=stripe or an old Stripe row", () => {
    assert.equal(decideAgencyBillingProvider(base), "shopify");
    assert.equal(decideAgencyBillingProvider({ ...base, storedProvider: "stripe" }), "shopify");
    assert.equal(
      decideAgencyBillingProvider({ ...base, storedProvider: "stripe", cameFromShopify: true }),
      "shopify",
    );
  });

  it("uses Shopify App Pricing for agencies that came from Shopify", () => {
    assert.equal(decideAgencyBillingProvider({ ...base, cameFromShopify: true }), "shopify");
    assert.equal(
      decideAgencyBillingProvider({ ...base, envProvider: "demo", cameFromShopify: true }),
      "shopify",
    );
  });

  it("keeps demo billing only in a demo environment", () => {
    assert.equal(decideAgencyBillingProvider({ ...base, envProvider: "demo" }), "demo");
    assert.equal(
      decideAgencyBillingProvider({ ...base, envProvider: "demo", storedProvider: "shopify" }),
      "shopify",
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
