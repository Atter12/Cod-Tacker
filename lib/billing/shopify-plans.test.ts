import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getShopifyPlanHandleMap,
  isShopifyPlanMapConfigured,
  planCodeToShopifyHandle,
  shopifyHandleToPlanCode,
} from "@/lib/billing/shopify-plans";
import {
  buildShopifyAppPricingPlansUrl,
  buildShopifyAppPricingPlansUrlFromShop,
  shopifyStoreHandleFromDomain,
} from "@/lib/billing/shopify-pricing-url";

describe("shopify plan handle map", () => {
  it("defaults handles to local plan codes", () => {
    const map = getShopifyPlanHandleMap({});
    assert.deepEqual(map, {
      starter: "starter",
      growth: "growth",
      scale: "scale",
    });
    assert.equal(isShopifyPlanMapConfigured(map), true);
  });

  it("reads SHOPIFY_PLAN_HANDLE_* overrides", () => {
    const map = getShopifyPlanHandleMap({
      SHOPIFY_PLAN_HANDLE_STARTER: "codtracked-starter",
      SHOPIFY_PLAN_HANDLE_GROWTH: "codtracked-growth",
      SHOPIFY_PLAN_HANDLE_SCALE: "codtracked-scale",
    });
    assert.equal(planCodeToShopifyHandle("starter", map), "codtracked-starter");
    assert.equal(shopifyHandleToPlanCode("codtracked-growth", map), "growth");
    assert.equal(shopifyHandleToPlanCode("SCALE", map), "scale");
  });

  it("rejects agency/enterprise as self-serve shopify handles", () => {
    assert.equal(planCodeToShopifyHandle("agency"), null);
    assert.equal(shopifyHandleToPlanCode("enterprise"), null);
  });
});

describe("shopify pricing url", () => {
  it("strips myshopify domain to store handle", () => {
    assert.equal(shopifyStoreHandleFromDomain("Demo-Shop.myshopify.com"), "demo-shop");
    assert.equal(shopifyStoreHandleFromDomain("https://demo-shop.myshopify.com/admin"), "demo-shop");
    assert.equal(shopifyStoreHandleFromDomain("evil.example.com"), null);
    assert.equal(shopifyStoreHandleFromDomain("not a shop"), null);
  });

  it("builds the hosted App Pricing plans URL", () => {
    assert.equal(
      buildShopifyAppPricingPlansUrl({
        storeHandle: "demo-shop",
        appHandle: "codtracked",
      }),
      "https://admin.shopify.com/store/demo-shop/charges/codtracked/pricing_plans",
    );
    assert.equal(
      buildShopifyAppPricingPlansUrlFromShop({
        shopDomain: "demo-shop.myshopify.com",
        appHandle: "CODTracked",
      }),
      "https://admin.shopify.com/store/demo-shop/charges/codtracked/pricing_plans",
    );
  });
});
