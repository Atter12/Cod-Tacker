import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapShopifyActiveSubscription,
  mapShopifyBillingPeriod,
  pickShopifyPlanHandle,
} from "@/lib/billing/shopify-subscription-map";
import { normalizeShopifyAppGid, normalizeShopifyShopGid } from "@/lib/billing/shopify-gids";

describe("shopify partner gids", () => {
  it("normalizes app and shop gids", () => {
    assert.equal(normalizeShopifyAppGid("1234"), "gid://shopify/App/1234");
    assert.equal(normalizeShopifyAppGid("gid://shopify/App/99"), "gid://shopify/App/99");
    assert.equal(normalizeShopifyShopGid("5678"), "gid://shopify/Shop/5678");
    assert.equal(normalizeShopifyShopGid("gid://shopify/Shop/1"), "gid://shopify/Shop/1");
    assert.equal(normalizeShopifyShopGid("nope"), null);
  });
});

describe("shopify subscription mapping", () => {
  it("maps billing periods", () => {
    assert.equal(mapShopifyBillingPeriod("EVERY_30_DAYS"), "month");
    assert.equal(mapShopifyBillingPeriod("ANNUAL"), "year");
    assert.equal(mapShopifyBillingPeriod("weird"), null);
  });

  it("picks plan handle from items then pending update", () => {
    assert.equal(
      pickShopifyPlanHandle({
        items: [{ handle: "growth" }],
        pendingUpdate: { items: [{ handle: "scale" }] },
      }),
      "growth",
    );
    assert.equal(
      pickShopifyPlanHandle({
        items: [{ handle: null }],
        pendingUpdate: { items: [{ handle: "starter" }] },
      }),
      "starter",
    );
  });

  it("maps active trial and paid contracts", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const trial = mapShopifyActiveSubscription(
      {
        billingPeriod: "EVERY_30_DAYS",
        cancelAtEndOfCycle: false,
        trialEndsAt: future,
        currentBillingCycle: null,
        items: [{ handle: "starter" }],
        pendingUpdate: null,
        legacySubscriptionId: "gid://shopify/AppSubscription/1",
      },
      { shopGid: "gid://shopify/Shop/9", now: new Date() },
    );
    assert.equal(trial.status, "trialing");
    assert.equal(trial.planCode, "starter");
    assert.equal(trial.billingInterval, "month");
    assert.equal(trial.providerSubscriptionId, "gid://shopify/AppSubscription/1");

    const paid = mapShopifyActiveSubscription(
      {
        billingPeriod: "ANNUAL",
        cancelAtEndOfCycle: true,
        trialEndsAt: null,
        currentBillingCycle: {
          startTime: "2026-01-01T00:00:00Z",
          endTime: "2027-01-01T00:00:00Z",
        },
        items: [{ handle: "scale" }],
        pendingUpdate: null,
        legacySubscriptionId: null,
      },
      { shopGid: "gid://shopify/Shop/9" },
    );
    assert.equal(paid.status, "active");
    assert.equal(paid.planCode, "scale");
    assert.equal(paid.billingInterval, "year");
    assert.equal(paid.cancelAtPeriodEnd, true);
    assert.equal(paid.providerSubscriptionId, "shopify-app-pricing:gid://shopify/Shop/9");
  });
});
