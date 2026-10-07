import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateAppStoreBillingGates,
  isSafeEmbedPlanUrl,
  isSafeShopifyConnectReturnPath,
} from "@/lib/billing/app-store-gates";
import { buildShopifyAppPricingPlansUrl } from "@/lib/billing/shopify-pricing-url";

describe("app store billing gates", () => {
  it("rejects billing paths as OAuth returns", () => {
    assert.equal(isSafeShopifyConnectReturnPath("/a/acme/billing"), false);
    assert.equal(isSafeShopifyConnectReturnPath("/a/acme/billing?x=1"), false);
    assert.equal(
      isSafeShopifyConnectReturnPath(
        "/a/acme/s/tienda/integrations/shopify?shopify_error=x",
      ),
      true,
    );
  });

  it("only allows Shopify Admin charge URLs in the embed", () => {
    assert.equal(isSafeEmbedPlanUrl(null), true);
    assert.equal(
      isSafeEmbedPlanUrl(
        buildShopifyAppPricingPlansUrl({ storeHandle: "demo", appHandle: "codtracked" }),
      ),
      true,
    );
    assert.equal(isSafeEmbedPlanUrl("https://checkout.stripe.com/c/pay/cs_test"), false);
    assert.equal(
      isSafeEmbedPlanUrl("https://cod.codtracked.com/a/acme/billing"),
      false,
    );
  });

  it("passes the static gate matrix for the App Pricing setup", () => {
    const report = evaluateAppStoreBillingGates({
      applicationUrl: "https://app.codtracked.com/embed",
      oauthReturnSample: "/a/acme/s/tienda/integrations/shopify",
      embedPricingUrl: buildShopifyAppPricingPlansUrl({
        storeHandle: "demo",
        appHandle: "codtracked",
      }),
      reviewMode: true,
    });
    assert.equal(report.ok, true);
    assert.equal(report.checks.length >= 4, true);
  });
});
