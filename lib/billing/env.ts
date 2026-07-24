import "server-only";

/**
 * Agency billing — server env.
 *
 *   BILLING_PROVIDER=demo|stripe   — default demo (mock plan changes)
 *   STRIPE_SECRET_KEY              — sk_test_… / sk_live_…
 *   STRIPE_WEBHOOK_SECRET          — whsec_… (required to accept webhooks)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — pk_… (optional until Elements/UI needs it)
 *
 * Optional Price ID fallbacks when `plan_provider_prices` row is missing:
 *   STRIPE_PRICE_STARTER_MONTH / STRIPE_PRICE_STARTER_YEAR
 *   STRIPE_PRICE_GROWTH_MONTH / STRIPE_PRICE_GROWTH_YEAR
 *   STRIPE_PRICE_SCALE_MONTH / STRIPE_PRICE_SCALE_YEAR
 *
 * Webhook URL (Stripe Dashboard → Developers → Webhooks):
 *   {NEXT_PUBLIC_APP_URL}/api/billing/webhooks/stripe
 */

export type BillingProviderMode = "demo" | "stripe";

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export function resolveBillingProviderMode(): BillingProviderMode {
  const raw = (readTrimmed("BILLING_PROVIDER") ?? "demo").toLowerCase();
  if (raw === "stripe") return "stripe";
  return "demo";
}

export type StripeBillingEnv = {
  secretKey: string | null;
  webhookSecret: string | null;
  publishableKey: string | null;
  apiVersion: string;
};

export function getStripeBillingEnv(): StripeBillingEnv {
  return {
    secretKey: readTrimmed("STRIPE_SECRET_KEY"),
    webhookSecret: readTrimmed("STRIPE_WEBHOOK_SECRET"),
    publishableKey: readTrimmed("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    /** Defaults to the SDK-pinned version when unset. */
    apiVersion: readTrimmed("STRIPE_API_VERSION") ?? "2026-06-24.dahlia",
  };
}

export function stripePriceEnvKey(planCode: string, interval: "month" | "year"): string {
  const code = planCode.trim().toUpperCase();
  const suffix = interval === "year" ? "YEAR" : "MONTH";
  return `STRIPE_PRICE_${code}_${suffix}`;
}

export function readStripePriceIdFromEnv(
  planCode: string,
  interval: "month" | "year",
): string | null {
  return readTrimmed(stripePriceEnvKey(planCode, interval));
}
