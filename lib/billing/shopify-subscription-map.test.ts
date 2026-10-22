import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  mapShopifyAppSubscription,
  mapShopifyBillingPeriod,
  pickCurrentAppSubscription,
  shopifyPlanNameToPlanCode,
  type ShopifyAppSubscriptionSnapshot,
} from "@/lib/billing/shopify-subscription-map";
import { normalizeShopifyShopGid } from "@/lib/billing/shopify-gids";

function sub(overrides: Partial<ShopifyAppSubscriptionSnapshot> = {}): ShopifyAppSubscriptionSnapshot {
  return {
    id: "gid://shopify/AppSubscription/1",
    name: "Growth",
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    currentPeriodEnd: "2026-11-01T00:00:00.000Z",
    trialDays: 0,
    interval: "EVERY_30_DAYS",
    ...overrides,
  };
}

describe("shopify gids", () => {
  it("normalizes shop gids", () => {
    assert.equal(normalizeShopifyShopGid("5678"), "gid://shopify/Shop/5678");
    assert.equal(normalizeShopifyShopGid("gid://shopify/Shop/1"), "gid://shopify/Shop/1");
    assert.equal(normalizeShopifyShopGid("nope"), null);
  });
});

describe("shopify App Pricing subscription (Admin API)", () => {
  it("maps billing periods", () => {
    assert.equal(mapShopifyBillingPeriod("EVERY_30_DAYS"), "month");
    assert.equal(mapShopifyBillingPeriod("ANNUAL"), "year");
    assert.equal(mapShopifyBillingPeriod("weird"), null);
  });

  it("maps plan display names to plan codes", () => {
    assert.equal(shopifyPlanNameToPlanCode("Starter"), "starter");
    assert.equal(shopifyPlanNameToPlanCode(" growth "), "growth");
    assert.equal(shopifyPlanNameToPlanCode("Plan Scale"), "scale");
    assert.equal(shopifyPlanNameToPlanCode("Conector"), null);
    assert.equal(shopifyPlanNameToPlanCode(""), null);
  });

  it("picks the active subscription, then a frozen one", () => {
    assert.equal(pickCurrentAppSubscription([]), null);
    assert.equal(
      pickCurrentAppSubscription([sub({ id: "a", status: "FROZEN" }), sub({ id: "b" })])?.id,
      "b",
    );
    assert.equal(pickCurrentAppSubscription([sub({ id: "c", status: "FROZEN" })])?.id, "c");
    assert.equal(pickCurrentAppSubscription([sub({ status: "PENDING" })]), null);
  });

  it("maps a paid monthly plan", () => {
    const mapped = mapShopifyAppSubscription(sub(), { now: new Date("2026-10-15T00:00:00Z") });
    assert.equal(mapped.status, "active");
    assert.equal(mapped.planCode, "growth");
    assert.equal(mapped.billingInterval, "month");
    assert.equal(mapped.currentPeriodEnd, "2026-11-01T00:00:00.000Z");
    assert.equal(mapped.providerSubscriptionId, "gid://shopify/AppSubscription/1");
    assert.equal(mapped.trialEndsAt, null);
  });

  it("maps an annual plan in trial", () => {
    const mapped = mapShopifyAppSubscription(
      sub({ name: "Scale", interval: "ANNUAL", trialDays: 14 }),
      { now: new Date("2026-10-05T00:00:00Z") },
    );
    assert.equal(mapped.status, "trialing");
    assert.equal(mapped.planCode, "scale");
    assert.equal(mapped.billingInterval, "year");
    assert.equal(mapped.trialEndsAt, "2026-10-15T00:00:00.000Z");
  });

  it("maps a frozen subscription to past_due", () => {
    assert.equal(mapShopifyAppSubscription(sub({ status: "FROZEN" })).status, "past_due");
  });
});

describe("plan sync without the Partner API", () => {
  const ROOT = process.cwd();

  it("reads the plan with the shop token (Admin API)", () => {
    const sync = readFileSync(resolve(ROOT, "lib/billing/shopify-subscription-sync.ts"), "utf8");
    assert.match(sync, /fetchShopifyAppSubscriptions\(/);
    assert.match(sync, /ensureShopifyAccessToken\(/);
    assert.doesNotMatch(sync, /partner/i);
    const fetcher = readFileSync(resolve(ROOT, "lib/integrations/shopify/app-subscription.ts"), "utf8");
    assert.match(fetcher, /currentAppInstallation\s*\{\s*activeSubscriptions/);
  });

  it("re-syncs on the app_subscriptions/update webhook", () => {
    const ingress = readFileSync(resolve(ROOT, "lib/integrations/shopify/webhook-ingress.ts"), "utf8");
    assert.match(ingress, /SHOPIFY_APP_SUBSCRIPTIONS_UPDATE_TOPIC = "app_subscriptions\/update"/);
    assert.match(ingress, /syncShopifyAppPricingForShop\(/);
    // HMAC is checked before any topic is handled.
    assert.ok(
      ingress.indexOf("verifyShopifyWebhookHmac(") < ingress.indexOf("SHOPIFY_APP_SUBSCRIPTIONS_UPDATE_TOPIC) {"),
    );
    const toml = readFileSync(resolve(ROOT, "shopify.app.toml"), "utf8");
    assert.match(
      toml,
      /topics = \["app_subscriptions\/update"\]\r?\nuri = "https:\/\/app\.codtracked\.com\/api\/integrations\/shopify\/webhooks"/,
    );
  });

  it("declares absolute webhook URIs (a relative path would land under /embed and 404)", () => {
    const toml = readFileSync(resolve(ROOT, "shopify.app.toml"), "utf8");
    const uris = [...toml.matchAll(/^uri = "([^"]+)"/gm)].map((m) => m[1]);
    assert.equal(uris.length >= 2, true);
    for (const uri of uris) {
      assert.equal(uri, "https://app.codtracked.com/api/integrations/shopify/webhooks");
    }
  });
});
