import type { BillingProviderId } from "@/lib/integrations/contracts/billing";

const KNOWN_PROVIDERS = new Set<BillingProviderId>(["demo", "stripe", "shopify"]);

/** Parse a stored/env billing provider id used by the agency router. */
export function parseBillingProviderId(
  raw: string | null | undefined,
): BillingProviderId | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().toLowerCase() as BillingProviderId;
  return KNOWN_PROVIDERS.has(value) ? value : null;
}

/**
 * Provider for an agency's console charges.
 *
 * Stripe is no longer offered: every agency pays through Shopify App Pricing
 * (App Store 1.2.1), including agencies with an old Stripe row. Only a demo
 * environment (BILLING_PROVIDER=demo) keeps demo billing for agencies that did
 * not come from Shopify. Without App Pricing configured the Shopify adapter
 * fails closed; it never falls back to Stripe.
 */
export type AgencyBillingProvider = Extract<BillingProviderId, "demo" | "shopify">;

export function decideAgencyBillingProvider(input: {
  storedProvider: string | null | undefined;
  envProvider: BillingProviderId;
  cameFromShopify: boolean;
}): AgencyBillingProvider {
  const stored = parseBillingProviderId(input.storedProvider);
  if (input.cameFromShopify || stored === "shopify") return "shopify";
  return input.envProvider === "demo" ? "demo" : "shopify";
}
