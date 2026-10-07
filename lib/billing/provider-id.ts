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
