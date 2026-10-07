import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveConsoleBillingChrome } from "@/lib/billing/console-billing-mode";

describe("console billing chrome", () => {
  it("makes shopify mode read-only for local cancel and opens Shopify CTAs", () => {
    const chrome = resolveConsoleBillingChrome("shopify");
    assert.equal(chrome.hideLocalCancelControls, true);
    assert.equal(chrome.planCtaOpensShopify, true);
    assert.equal(chrome.planCtaLabel({ current: false, selfServe: true }), "Elegir en Shopify");
    assert.equal(chrome.manageLabel, "Administrar en Shopify");
    assert.match(chrome.banner, /factura de Shopify/);
    assert.equal(chrome.hideStripeInvoiceExpectation, true);
  });

  it("keeps stripe self-serve checkout labels", () => {
    const chrome = resolveConsoleBillingChrome("stripe");
    assert.equal(chrome.hideLocalCancelControls, false);
    assert.equal(chrome.planCtaOpensShopify, false);
    assert.equal(chrome.planCtaLabel({ current: false, selfServe: true }), "Comenzar ahora");
    assert.equal(chrome.manageLabel, "Portal de facturación");
  });
});
