import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  additionalStoreLimitMessage,
  isFreeShopifyConnectorSettings,
} from "@/lib/billing/connector-access";

describe("shopify connector access", () => {
  it("treats the installed shop as included and the next store as a console extra", () => {
    const message = additionalStoreLimitMessage({
      storeLimit: 1,
      planName: null,
      shopifyConnectorIncluded: true,
    });
    assert.match(message, /incluida/);
    assert.match(message, /extra de la consola/);
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
