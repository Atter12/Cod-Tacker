import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { can } from "@/lib/permissions/can";
import { matchAccessibleStore } from "@/lib/tenant/match-accessible-store";
import { decideHostGate } from "@/lib/hosts/host-gate";
import {
  evaluateAppStoreBillingGates,
  isSafeEmbedPlanUrl,
  isSafeShopifyConnectReturnPath,
} from "@/lib/billing/app-store-gates";
import { buildShopifyAppPricingPlansUrl } from "@/lib/billing/shopify-pricing-url";

const shopify = "https://app.codtracked.com";
const product = "https://cod.codtracked.com";

const stores = [
  { agencySlug: "acme", storeSlug: "tienda", storeId: "store-acme" },
  { agencySlug: "other", storeSlug: "tienda", storeId: "store-other" },
] as const;

/**
 * Strategic group 1 — Acceso.
 * Tenancy, permissions, and the embed host stay in one scenario so a green
 * unit test in only one of those modules cannot hide a broken seam.
 */
describe("strategic · acceso", () => {
  it("does not resolve another agency's store, even when the store slug matches", () => {
    const own = matchAccessibleStore(stores, "acme", "tienda");
    assert.equal(own?.storeId, "store-acme");

    const foreign = matchAccessibleStore(stores, "acme", "missing");
    assert.equal(foreign, null);

    const sameSlugOtherAgency = matchAccessibleStore(stores, "other", "tienda");
    assert.equal(sameSlugOtherAgency?.storeId, "store-other");
    assert.notEqual(sameSlugOtherAgency?.storeId, own?.storeId);
  });

  it("blocks a viewer from creating a store, connecting an integration, or managing billing", () => {
    for (const permission of ["store.create", "integrations.manage", "billing.manage"] as const) {
      assert.equal(can(["viewer"], permission), false);
      assert.equal(can(["operator"], permission), false);
      assert.equal(can(["owner"], permission), true);
    }
    assert.equal(can(["viewer"], "orders.view"), true);
    assert.equal(can(["viewer"], "integrations.view"), false);
  });

  it("keeps the embed on the app host and sends Facturación to the product host", () => {
    const embed = decideHostGate({
      host: "app.codtracked.com",
      pathname: "/embed",
      search: "?shop=demo.myshopify.com",
      shopifyAppUrl: shopify,
      productAppUrl: product,
    });
    assert.deepEqual(embed, { kind: "next" });

    const billing = decideHostGate({
      host: "app.codtracked.com",
      pathname: "/a/acme/billing",
      shopifyAppUrl: shopify,
      productAppUrl: product,
    });
    assert.equal(billing.kind, "redirect");
    if (billing.kind === "redirect") {
      assert.equal(billing.location, "https://cod.codtracked.com/a/acme/billing");
    }

    const productEmbed = decideHostGate({
      host: "cod.codtracked.com",
      pathname: "/embed",
      shopifyAppUrl: shopify,
      productAppUrl: product,
    });
    assert.equal(productEmbed.kind, "redirect");
    if (productEmbed.kind === "redirect") {
      assert.match(productEmbed.location, /^https:\/\/app\.codtracked\.com\/embed/);
    }
  });

  it("opens plans in Shopify Admin and refuses OAuth returns into billing", () => {
    const pricing = buildShopifyAppPricingPlansUrl({
      storeHandle: "demo",
      appHandle: "codtracked",
    });
    assert.equal(isSafeEmbedPlanUrl(pricing), true);
    assert.equal(isSafeEmbedPlanUrl("https://checkout.stripe.com/c/pay/cs_test"), false);
    assert.equal(isSafeEmbedPlanUrl("https://cod.codtracked.com/a/acme/billing"), false);

    assert.equal(isSafeShopifyConnectReturnPath("/a/acme/s/tienda/integrations/shopify"), true);
    assert.equal(isSafeShopifyConnectReturnPath("/a/acme/billing"), false);

    const toml = readFileSync(resolve(process.cwd(), "shopify.app.toml"), "utf8");
    const applicationUrl = toml.match(/application_url\s*=\s*"([^"]+)"/)?.[1] ?? "";
    const report = evaluateAppStoreBillingGates({
      applicationUrl,
      oauthReturnSample: "/a/acme/s/tienda/integrations/shopify",
      embedPricingUrl: pricing,
      reviewMode: false,
    });
    assert.equal(report.checks.find((check) => check.id === "application_url_embed")?.ok, true);
    assert.equal(report.checks.find((check) => check.id === "oauth_return_not_billing")?.ok, true);
    assert.equal(report.checks.find((check) => check.id === "embed_plan_url_shopify_admin")?.ok, true);
  });
});
