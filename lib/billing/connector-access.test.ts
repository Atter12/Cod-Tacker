import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  additionalStoreLimitMessage,
  isFreeShopifyConnectorSettings,
} from "@/lib/billing/connector-access";

describe("shopify connector access", () => {
  it("asks a Shopify install without a plan to pick one before adding stores", () => {
    const message = additionalStoreLimitMessage({
      storeLimit: 1,
      planName: null,
      shopifyConnectorIncluded: true,
    });
    assert.match(message, /Elige un plan/);
    assert.doesNotMatch(message, /incluida/);
  });

  it("keeps the plan message when the agency already pays", () => {
    const message = additionalStoreLimitMessage({
      storeLimit: 1,
      planName: "Starter",
      shopifyConnectorIncluded: true,
    });
    assert.match(message, /Starter/);
    assert.match(message, /Mejora el plan/);
  });

  it("reads the free connector flag from agency settings", () => {
    assert.equal(isFreeShopifyConnectorSettings({ shopify_connector: "free" }), true);
    assert.equal(isFreeShopifyConnectorSettings({}), false);
    assert.equal(isFreeShopifyConnectorSettings(null), false);
  });
});
