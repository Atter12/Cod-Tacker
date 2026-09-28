import "server-only";

import type { ShopifyEmbedHome } from "@/lib/integrations/shopify/embed-types";
import { labelOrderStatus } from "@/lib/orders/labels";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ShopifyEmbedHome, ShopifyEmbedOrder } from "@/lib/integrations/shopify/embed-types";

/** App Store surface: linked shop + recent orders. No billing payload. */
export async function loadShopifyEmbedHome(shop: string): Promise<ShopifyEmbedHome> {
  const admin = createAdminClient();
  const storeLookup = await admin
    .from("stores")
    .select("id, name")
    .eq("shopify_shop_domain", shop)
    .limit(1)
    .maybeSingle();

  if (storeLookup.error) {
    throw new Error("No se pudo leer la tienda vinculada.");
  }
  if (!storeLookup.data) {
    return { linked: false, storeName: null, lastSyncedAt: null, orders: [] };
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
  };
}
