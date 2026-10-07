import "server-only";

import { assertShopifyAppHandle } from "@/lib/billing/shopify-billing-env";
import { buildShopifyAppPricingPlansUrlFromShop } from "@/lib/billing/shopify-pricing-url";
import type {
  BillingCancelInput,
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingPortalInput,
  BillingProvider,
  BillingReactivateInput,
} from "@/lib/integrations/contracts/billing";
import { isSelfServePlanCode } from "@/lib/integrations/contracts/billing";
import { ValidationError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveAgencyShopifyShopDomain(agencyId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("shopify_shop_domain")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .not("shopify_shop_domain", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const shop = data?.shopify_shop_domain?.trim();
  if (!shop) {
    throw new ValidationError(
      "Conecta una tienda Shopify antes de elegir un plan. El cobro se hace en la factura de Shopify.",
    );
  }
  return shop;
}

async function pricingPlansUrlForAgency(agencyId: string): Promise<string> {
  const appHandle = assertShopifyAppHandle();
  const shopDomain = await resolveAgencyShopifyShopDomain(agencyId);
  return buildShopifyAppPricingPlansUrlFromShop({ shopDomain, appHandle });
}

/**
 * Shopify App Pricing adapter.
 * Does not create charges in code — redirects to Shopify's hosted plan page.
 * Subscription sync (Partner API) lands in a later phase.
 */
export function createShopifyBillingProvider(): BillingProvider {
  return {
    providerId: "shopify",
    mode: "live",

    async createCheckoutSession(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
      if (!isSelfServePlanCode(input.planCode)) {
        throw new ValidationError(
          "Este plan requiere contacto con ventas. Agency / Enterprise no se cobran por App Pricing self-serve.",
        );
      }
      const url = await pricingPlansUrlForAgency(input.agencyId);
      return { kind: "redirect", url };
    },

    async createPortalSession(input: BillingPortalInput): Promise<{ url: string }> {
      const url = await pricingPlansUrlForAgency(input.agencyId);
      return { url };
    },

    async cancelAtPeriodEnd(_input: BillingCancelInput): Promise<void> {
      throw new ValidationError(
        "El plan se administra en Shopify. Abre Administrar facturación para cancelar o cambiar el plan en tu Admin.",
      );
    },

    async reactivate(_input: BillingReactivateInput): Promise<void> {
      throw new ValidationError(
        "El plan se administra en Shopify. Abre Administrar facturación para reactivar o elegir un plan en tu Admin.",
      );
    },
  };
}
