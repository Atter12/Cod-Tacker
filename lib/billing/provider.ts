import "server-only";

import {
  resolveBillingProviderMode,
  type BillingProviderMode,
  type StripeKeyMode,
} from "@/lib/billing/env";
import { parseBillingProviderId } from "@/lib/billing/provider-id";
import { isShopifyAppPricingConfigured } from "@/lib/billing/shopify-billing-env";
import type { BillingProvider, BillingProviderId } from "@/lib/integrations/contracts/billing";
import { createDemoBillingProvider } from "@/lib/integrations/mock/billing.mock";
import { createShopifyBillingProvider } from "@/lib/integrations/shopify/live-billing";
import { createStripeBillingProvider } from "@/lib/integrations/stripe/live-billing";
import { createAdminClient } from "@/lib/supabase/admin";

export { parseBillingProviderId } from "@/lib/billing/provider-id";

/**
 * Default billing adapter from env (`BILLING_PROVIDER=demo|stripe|shopify`).
 * Prefer `getBillingProviderForAgency` when the agency already has a subscription row.
 */
export function getBillingProvider(
  stripeKeyMode: StripeKeyMode = "live",
  providerId: BillingProviderId = resolveBillingProviderMode(),
): BillingProvider {
  if (providerId === "shopify") {
    return createShopifyBillingProvider();
  }
  if (providerId === "stripe") {
    return createStripeBillingProvider(stripeKeyMode);
  }
  return createDemoBillingProvider();
}

export function isDemoBilling(): boolean {
  return resolveBillingProviderMode() === "demo";
}

export function isShopifyBillingMode(mode: BillingProviderMode = resolveBillingProviderMode()): boolean {
  return mode === "shopify";
}

/**
 * Agency-aware provider: latest subscription.billing_provider wins;
 * otherwise falls back to BILLING_PROVIDER. Shopify only when configured.
 */
export async function resolveAgencyBillingProviderId(
  agencyId: string,
): Promise<BillingProviderMode> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("billing_provider")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromRow = parseBillingProviderId(data?.billing_provider);
  if (fromRow === "shopify" && !isShopifyAppPricingConfigured()) {
    return resolveBillingProviderMode();
  }
  if (fromRow === "demo" || fromRow === "stripe" || fromRow === "shopify") {
    return fromRow;
  }
  return resolveBillingProviderMode();
}

export async function getBillingProviderForAgency(
  agencyId: string,
  stripeKeyMode: StripeKeyMode = "live",
): Promise<BillingProvider> {
  const providerId = await resolveAgencyBillingProviderId(agencyId);
  return getBillingProvider(stripeKeyMode, providerId);
}
