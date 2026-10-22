import "server-only";

import {
  resolveBillingProviderMode,
  type BillingProviderMode,
  type StripeKeyMode,
} from "@/lib/billing/env";
import { isFreeShopifyConnectorSettings } from "@/lib/billing/connector-access";
import { decideAgencyBillingProvider } from "@/lib/billing/provider-id";
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
 * Agency-aware provider: Shopify App Pricing for every agency (demo only in a
 * demo environment). Stripe is never chosen.
 * See `decideAgencyBillingProvider`.
 */
export async function resolveAgencyBillingProviderId(
  agencyId: string,
): Promise<BillingProviderMode> {
  const admin = createAdminClient();
  const [subscription, agency, shopifyStore] = await Promise.all([
    admin
      .from("subscriptions")
      .select("billing_provider")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("agencies").select("settings").eq("id", agencyId).maybeSingle(),
    admin
      .from("stores")
      .select("id")
      .eq("agency_id", agencyId)
      .not("shopify_shop_domain", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);

  return decideAgencyBillingProvider({
    storedProvider: subscription.data?.billing_provider,
    envProvider: resolveBillingProviderMode(),
    cameFromShopify:
      isFreeShopifyConnectorSettings(agency.data?.settings) || Boolean(shopifyStore.data),
  });
}

export async function getBillingProviderForAgency(
  agencyId: string,
  stripeKeyMode: StripeKeyMode = "live",
): Promise<BillingProvider> {
  const providerId = await resolveAgencyBillingProviderId(agencyId);
  return getBillingProvider(stripeKeyMode, providerId);
}
