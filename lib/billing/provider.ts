import "server-only";

import {
  resolveBillingProviderMode,
  type StripeKeyMode,
} from "@/lib/billing/env";
import type { BillingProvider } from "@/lib/integrations/contracts/billing";
import { createDemoBillingProvider } from "@/lib/integrations/mock/billing.mock";
import { createStripeBillingProvider } from "@/lib/integrations/stripe/live-billing";

/**
 * Resolves the active billing adapter.
 * Independent of INTEGRATION_MODE — use BILLING_PROVIDER=demo|stripe.
 * `stripeKeyMode` selects live vs test API keys (allowlisted toggle).
 */
export function getBillingProvider(
  stripeKeyMode: StripeKeyMode = "live",
): BillingProvider {
  const mode = resolveBillingProviderMode();
  if (mode === "stripe") {
    return createStripeBillingProvider(stripeKeyMode);
  }
  return createDemoBillingProvider();
}

export function isDemoBilling(): boolean {
  return resolveBillingProviderMode() === "demo";
}
