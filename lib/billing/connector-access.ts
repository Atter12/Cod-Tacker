/**
 * Shopify Admin connector (App Store listing). Order sync for the installed shop
 * does not consult the subscription; using CODTracked needs a paid plan.
 */

export function additionalStoreLimitMessage(input: {
  storeLimit: number;
  planName: string | null;
  shopifyConnectorIncluded: boolean;
}): string {
  if (input.shopifyConnectorIncluded && !input.planName) {
    return `Elige un plan para usar CODTracked y crear más tiendas (límite sin plan: ${input.storeLimit}).`;
  }
  const plan = input.planName ? ` (${input.planName})` : "";
  return `Has alcanzado el límite de ${input.storeLimit} tienda(s) de tu plan${plan}. Mejora el plan para crear más.`;
}

export function isFreeShopifyConnectorSettings(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return (settings as Record<string, unknown>).shopify_connector === "free";
}
