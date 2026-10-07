import "server-only";

import { getShopifyAppHandle } from "@/lib/billing/shopify-billing-env";
import { resolveEmbedPlanState } from "@/lib/billing/embed-plan-state";
import { buildShopifyAppPricingPlansUrlFromShop } from "@/lib/billing/shopify-pricing-url";
import type { ShopifyEmbedHome } from "@/lib/integrations/shopify/embed-types";
import { labelOrderStatus } from "@/lib/orders/labels";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ShopifyEmbedHome, ShopifyEmbedOrder } from "@/lib/integrations/shopify/embed-types";

function emptyBilling(shop: string): ShopifyEmbedHome["billing"] {
  const appHandle = getShopifyAppHandle();
  let pricingPlansUrl: string | null = null;
  if (appHandle) {
    try {
      pricingPlansUrl = buildShopifyAppPricingPlansUrlFromShop({
        shopDomain: shop,
        appHandle,
      });
    } catch {
      pricingPlansUrl = null;
    }
  }
  return resolveEmbedPlanState({
    subscriptionStatus: null,
    planName: null,
    planCode: null,
    pricingPlansUrl,
  });
}

/** App Store surface: linked shop + recent orders + App Pricing CTA (no Stripe). */
export async function loadShopifyEmbedHome(shop: string): Promise<ShopifyEmbedHome> {
  const admin = createAdminClient();
  const storeLookup = await admin
    .from("stores")
    .select("id, name, agency_id")
    .eq("shopify_shop_domain", shop)
    .limit(1)
    .maybeSingle();

  if (storeLookup.error) {
    throw new Error("No se pudo leer la tienda vinculada.");
  }
  if (!storeLookup.data) {
    return {
      linked: false,
      storeName: null,
      lastSyncedAt: null,
      orders: [],
      billing: emptyBilling(shop),
    };
  }

  const integrationLookup = await admin
    .from("integrations")
    .select("last_success_at, status")
    .eq("store_id", storeLookup.data.id)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (integrationLookup.error) {
    throw new Error("No se pudo leer la conexión Shopify.");
  }

  const ordersLookup = await admin
    .from("orders")
    .select("id, order_number, external_order_id, total_amount, currency_code, order_status, created_at_source")
    .eq("store_id", storeLookup.data.id)
    .order("created_at_source", { ascending: false })
    .limit(8);

  if (ordersLookup.error) {
    throw new Error("No se pudieron leer los pedidos de la tienda.");
  }

  let subscriptionStatus: string | null = null;
  let planName: string | null = null;
  let planCode: string | null = null;

  if (storeLookup.data.agency_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, plan_id")
      .eq("agency_id", storeLookup.data.agency_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionStatus = sub?.status ?? null;
    if (sub?.plan_id) {
      const { data: plan } = await admin
        .from("plans")
        .select("name, code")
        .eq("id", sub.plan_id)
        .maybeSingle();
      planName = plan?.name ?? null;
      planCode = plan?.code ?? null;
    }
  }

  const appHandle = getShopifyAppHandle();
  let pricingPlansUrl: string | null = null;
  if (appHandle) {
    try {
      pricingPlansUrl = buildShopifyAppPricingPlansUrlFromShop({
        shopDomain: shop,
        appHandle,
      });
    } catch {
      pricingPlansUrl = null;
    }
  }

  return {
    linked: true,
    storeName: storeLookup.data.name,
    lastSyncedAt: integrationLookup.data?.last_success_at ?? null,
    orders: (ordersLookup.data ?? []).map((row) => ({
      id: row.id,
      orderNumber: row.order_number?.trim() || row.external_order_id,
      totalAmount: row.total_amount,
      currencyCode: row.currency_code,
      statusLabel: labelOrderStatus(row.order_status),
      createdAt: row.created_at_source,
    })),
    billing: resolveEmbedPlanState({
      subscriptionStatus,
      planName,
      planCode,
      pricingPlansUrl,
    }),
  };
}
