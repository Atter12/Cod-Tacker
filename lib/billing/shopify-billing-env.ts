import "server-only";

/**
 * Shopify App Pricing — server env (Partner Dashboard app handle + plan handles).
 *
 *   SHOPIFY_APP_HANDLE              — App Store / Admin handle (URL slug), not the display name
 *   SHOPIFY_PLAN_HANDLE_STARTER     — optional; default "starter"
 *   SHOPIFY_PLAN_HANDLE_GROWTH      — optional; default "growth"
 *   SHOPIFY_PLAN_HANDLE_SCALE       — optional; default "scale"
 *
 * Welcome link (Partner, per plan): https://app.codtracked.com/embed
 * Plan selection (hosted by Shopify):
 *   https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans
 */

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export function getShopifyAppHandle(): string | null {
  return readTrimmed("SHOPIFY_APP_HANDLE");
}

export function assertShopifyAppHandle(): string {
  const handle = getShopifyAppHandle();
  if (!handle) {
    throw new Error(
      "Falta SHOPIFY_APP_HANDLE. Pon el handle de la app (Partner Dashboard) en el entorno del servidor.",
    );
  }
  return handle;
}

export function isShopifyAppPricingConfigured(): boolean {
  return Boolean(getShopifyAppHandle());
}
