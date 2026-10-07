import { normalizeShopifyShopDomain } from "@/lib/integrations/shopify/domain";

/**
 * Shopify App Pricing hosted plan selection / manage URLs.
 * @see https://shopify.dev/docs/apps/launch/billing/managed-pricing
 *
 *   https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans
 */

export function shopifyStoreHandleFromDomain(shopDomain: string): string | null {
  const shop = normalizeShopifyShopDomain(shopDomain);
  if (!shop) return null;
  return shop.replace(/\.myshopify\.com$/i, "");
}

export function buildShopifyAppPricingPlansUrl(input: {
  storeHandle: string;
  appHandle: string;
}): string {
  const store = input.storeHandle.trim().toLowerCase();
  const app = input.appHandle.trim().toLowerCase();
  if (!store || !app) {
    throw new Error("Faltan storeHandle o appHandle para la página de planes de Shopify.");
  }
  if (store.includes("/") || app.includes("/")) {
    throw new Error("storeHandle y appHandle no pueden contener barras.");
  }
  return `https://admin.shopify.com/store/${store}/charges/${app}/pricing_plans`;
}

export function buildShopifyAppPricingPlansUrlFromShop(input: {
  shopDomain: string;
  appHandle: string;
}): string {
  const storeHandle = shopifyStoreHandleFromDomain(input.shopDomain);
  if (!storeHandle) {
    throw new Error("Dominio Shopify inválido para armar la URL de planes.");
  }
  return buildShopifyAppPricingPlansUrl({
    storeHandle,
    appHandle: input.appHandle,
  });
}
