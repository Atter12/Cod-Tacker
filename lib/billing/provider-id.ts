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
 * A stored subscription row wins (legacy Stripe agencies keep Stripe). Without one,
 * an agency that came from Shopify (embed install or a connected shop) must use
 * Shopify App Pricing (App Store 1.2.1), even when App Pricing is not configured:
 * the Shopify adapter then fails closed instead of opening Stripe Checkout.
 */
export type AgencyBillingProvider = Extract<BillingProviderId, "demo" | "stripe" | "shopify">;

export function decideAgencyBillingProvider(input: {
  storedProvider: string | null | undefined;
  envProvider: AgencyBillingProvider;
  shopifyAppPricingConfigured: boolean;
  cameFromShopify: boolean;
}): AgencyBillingProvider {
  const parsed = parseBillingProviderId(input.storedProvider);
  const stored =
    parsed === "demo" || parsed === "stripe" || parsed === "shopify" ? parsed : null;
  if (stored === "stripe") return "stripe";
  if (input.cameFromShopify) return "shopify";
  if (stored === "shopify" && !input.shopifyAppPricingConfigured) return input.envProvider;
  return stored ?? input.envProvider;
}
