/**
 * Shopify Admin connector (App Store listing) vs paid agency extras.
 * Order sync for the installed shop does not consult the subscription.
 * Another store on the console is the paid extra.
 */

export function additionalStoreLimitMessage(input: {
  storeLimit: number;
  planName: string | null;
  shopifyConnectorIncluded: boolean;
}): string {
  if (input.shopifyConnectorIncluded && !input.planName) {
    return `La tienda conectada desde Shopify está incluida. Crear otra tienda es un extra de la consola (límite actual: ${input.storeLimit}).`;
  }
  const plan = input.planName ? ` (${input.planName})` : "";
  return `Has alcanzado el límite de ${input.storeLimit} tienda(s) de tu plan${plan}. Mejora el plan para crear más.`;
}

export function isFreeShopifyConnectorSettings(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return (settings as Record<string, unknown>).shopify_connector === "free";
}
