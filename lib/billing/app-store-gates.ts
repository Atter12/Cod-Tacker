/**
 * App Store product gates for Shopify App Pricing (phase 5).
 * Pure checks — used by unit tests and the smoke script.
 */

const BILLING_PATH_RE = /\/billing(\/|$|\?)/i;
const STRIPE_HOST_RE = /(^|\.)stripe\.com$/i;
const PRODUCT_CONSOLE_HINT_RE = /cod\.codtracked\.com/i;

/** OAuth / install error returns must never land on agency Facturación. */
export function isSafeShopifyConnectReturnPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (BILLING_PATH_RE.test(path)) return false;
  if (path.includes("checkout.stripe.com")) return false;
  return true;
}

/** Embed UI must not deep-link Stripe Checkout or the paid product host for plan choice. */
export function isSafeEmbedPlanUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  try {
    const parsed = new URL(url);
    if (STRIPE_HOST_RE.test(parsed.hostname)) return false;
    if (PRODUCT_CONSOLE_HINT_RE.test(parsed.hostname) && parsed.pathname.includes("/billing")) {
      return false;
    }
    if (parsed.hostname === "admin.shopify.com" && parsed.pathname.includes("/charges/")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type AppStoreGateReport = {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
};

/** Static gate matrix for smoke / CI (no network). */
export function evaluateAppStoreBillingGates(input: {
  applicationUrl: string;
  oauthReturnSample: string;
  embedPricingUrl: string | null;
  reviewMode: boolean;
}): AppStoreGateReport {
  const checks: AppStoreGateReport["checks"] = [];

  const appUrlOk =
    input.applicationUrl.includes("/embed") && !input.applicationUrl.includes("/billing");
  checks.push({
    id: "application_url_embed",
    ok: appUrlOk,
    detail: appUrlOk
      ? "application_url apunta a /embed"
      : "application_url debe ser …/embed (no /billing)",
  });

  const returnOk = isSafeShopifyConnectReturnPath(input.oauthReturnSample);
  checks.push({
    id: "oauth_return_not_billing",
    ok: returnOk,
    detail: returnOk
      ? "retorno OAuth fuera de Facturación"
      : "retorno OAuth no puede ser /billing",
  });

  const pricingOk = isSafeEmbedPlanUrl(input.embedPricingUrl);
  checks.push({
    id: "embed_plan_url_shopify_admin",
    ok: pricingOk,
    detail: pricingOk
      ? "URL de plan del embed es Admin Shopify o vacía"
      : "URL de plan del embed no puede ser Stripe ni Facturación en cod.*",
  });

  checks.push({
    id: "review_mode_flag_readable",
    ok: typeof input.reviewMode === "boolean",
    detail: input.reviewMode
      ? "SHOPIFY_APP_REVIEW_MODE activo (oculta Flipy wallet top-up)"
      : "SHOPIFY_APP_REVIEW_MODE inactivo (activar en deploy de review)",
  });

  return { ok: checks.every((c) => c.ok), checks };
}
