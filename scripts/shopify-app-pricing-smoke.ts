/**
 * Phase 5 smoke gate for Shopify App Pricing (static + env readiness).
 *
 *   npm run smoke:app-pricing
 *
 * Does not call Partner API or mutate data. Prints a Partner/manual checklist.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateAppStoreBillingGates } from "../lib/billing/app-store-gates";
import { buildShopifyAppPricingPlansUrl } from "../lib/billing/shopify-pricing-url";
import { isShopifyAppReviewMode } from "../lib/shopify/app-store-review";

function readTomlApplicationUrl(): string {
  try {
    const toml = readFileSync(resolve(process.cwd(), "shopify.app.toml"), "utf8");
    const match = toml.match(/application_url\s*=\s*"([^"]+)"/);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function envReady(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

const applicationUrl = readTomlApplicationUrl();
const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim() || "codtracked";
const embedPricingUrl = buildShopifyAppPricingPlansUrl({
  storeHandle: "demo-shop",
  appHandle,
});

const gates = evaluateAppStoreBillingGates({
  applicationUrl: applicationUrl || "https://app.codtracked.com/embed",
  oauthReturnSample: "/a/acme/s/tienda/integrations/shopify",
  embedPricingUrl,
  reviewMode: isShopifyAppReviewMode(),
});

const envChecks = [
  { id: "SHOPIFY_APP_HANDLE", ok: envReady("SHOPIFY_APP_HANDLE") },
  { id: "SHOPIFY_APP_GID", ok: envReady("SHOPIFY_APP_GID") },
  { id: "SHOPIFY_PARTNER_ORG_ID", ok: envReady("SHOPIFY_PARTNER_ORG_ID") },
  { id: "SHOPIFY_PARTNER_API_TOKEN", ok: envReady("SHOPIFY_PARTNER_API_TOKEN") },
  { id: "SHOPIFY_CLIENT_ID", ok: envReady("SHOPIFY_CLIENT_ID") },
  {
    id: "PRODUCT_APP_URL_or_fallback",
    ok: envReady("PRODUCT_APP_URL") || envReady("NEXT_PUBLIC_APP_URL"),
  },
];

console.log("\n=== Shopify App Pricing · phase 5 smoke ===\n");
console.log(`application_url (toml): ${applicationUrl || "(missing)"}`);
console.log(`review mode: ${isShopifyAppReviewMode() ? "ON" : "off"}`);
console.log("\n-- Product gates --");
for (const check of gates.checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.id}: ${check.detail}`);
}

console.log("\n-- Env readiness (ops) --");
for (const check of envChecks) {
  console.log(`${check.ok ? "PASS" : "WARN"}  ${check.id}`);
}

console.log(`
-- Manual Partner checklist --
[ ] Partner → Pricing = Shopify App Pricing; plans starter/growth/scale
[ ] Welcome link = https://app.codtracked.com/embed
[ ] Install / open app → /embed (orders) — no Stripe Checkout
[ ] Decline plan → re-approve → embed shows plan + sync subscriptions
[ ] Upgrade/downgrade in Admin → Sincronizar estado in Facturación (cod.*)
[ ] Uninstall + reinstall → embed reconnects without /billing
[ ] SHOPIFY_APP_REVIEW_MODE=true during review (hide Flipy wallet top-up)
[ ] Theme app embed onboarding steps in review notes
[ ] Host split: PRODUCT_APP_URL=https://cod.codtracked.com (Stripe legado off app host)

Docs: docs/SHOPIFY_APP_PRICING.md · docs/APP_STORE_BILLING_EXTERNAL.md
`);

const gateFailed = !gates.ok;
const tomlFailed = !applicationUrl.includes("/embed");
if (gateFailed || tomlFailed) {
  console.error("Smoke gates FAILED.");
  process.exit(1);
}

console.log("Smoke gates PASSED (manual Partner steps remain).");
