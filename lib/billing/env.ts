import "server-only";

/**
 * Agency billing — server env.
 *
 *   BILLING_PROVIDER=demo|stripe   — default demo (mock plan changes)
 *   STRIPE_SECRET_KEY              — sk_live_… (or sk_test_… if only testing)
 *   STRIPE_WEBHOOK_SECRET          — whsec_… (live endpoint)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — pk_… (optional until Elements/UI needs it)
 *
 * Optional live Price ID fallbacks when `plan_provider_prices` row is missing:
 *   STRIPE_PRICE_STARTER_MONTH / STRIPE_PRICE_STARTER_YEAR
 *   STRIPE_PRICE_GROWTH_MONTH / STRIPE_PRICE_GROWTH_YEAR
 *   STRIPE_PRICE_SCALE_MONTH / STRIPE_PRICE_SCALE_YEAR
 *
 * Stripe test mode (toggle UI; allowlisted emails only):
 *   STRIPE_TEST_SECRET_KEY / STRIPE_TEST_WEBHOOK_SECRET
 *   STRIPE_TEST_PRICE_STARTER_MONTH / _YEAR (also GROWTH, SCALE)
 *   STRIPE_TEST_MODE_ALLOWED_EMAILS — comma list; default sandrowonmer@gmail.com
 *
 * Webhook URL (Stripe Dashboard → Developers → Webhooks):
 *   {NEXT_PUBLIC_APP_URL}/api/billing/webhooks/stripe
 * Register the same URL in both Live and Test mode dashboards.
 */

export type BillingProviderMode = "demo" | "stripe";
export type StripeKeyMode = "live" | "test";

const DEFAULT_TEST_MODE_EMAILS = ["sandrowonmer@gmail.com"];

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
  return getStripeBillingEnvForMode("live");
}

export function getStripeBillingEnvForMode(mode: StripeKeyMode): StripeBillingEnv {
  const apiVersion = readTrimmed("STRIPE_API_VERSION") ?? "2026-06-24.dahlia";
  if (mode === "test") {
    return {
      secretKey: readTrimmed("STRIPE_TEST_SECRET_KEY"),
      webhookSecret: readTrimmed("STRIPE_TEST_WEBHOOK_SECRET"),
      publishableKey: readTrimmed("NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY"),
      apiVersion,
    };
  }
  return {
    secretKey: readTrimmed("STRIPE_SECRET_KEY"),
    webhookSecret: readTrimmed("STRIPE_WEBHOOK_SECRET"),
    publishableKey: readTrimmed("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    apiVersion,
  };
}

export function stripePriceEnvKey(
  planCode: string,
  interval: "month" | "year",
  mode: StripeKeyMode = "live",
): string {
  const code = planCode.trim().toUpperCase();
  const suffix = interval === "year" ? "YEAR" : "MONTH";
  const prefix = mode === "test" ? "STRIPE_TEST_PRICE" : "STRIPE_PRICE";
  return `${prefix}_${code}_${suffix}`;
}

export function readStripePriceIdFromEnv(
  planCode: string,
  interval: "month" | "year",
  mode: StripeKeyMode = "live",
): string | null {
  return readTrimmed(stripePriceEnvKey(planCode, interval, mode));
}

/** Emails that may enable Stripe test mode via the Facturación toggle. */
export function getStripeTestModeAllowedEmails(): string[] {
  const raw = readTrimmed("STRIPE_TEST_MODE_ALLOWED_EMAILS");
  if (!raw) return [...DEFAULT_TEST_MODE_EMAILS];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isStripeTestModeEmailAllowed(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return getStripeTestModeAllowedEmails().includes(normalized);
}

export function isStripeTestModeConfigured(): boolean {
  const env = getStripeBillingEnvForMode("test");
  return Boolean(env.secretKey);
}
