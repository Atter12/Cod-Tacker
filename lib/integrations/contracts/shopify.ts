export type ShopifyOrderWebhook = { id: string; name: string; createdAt: string; updatedAt: string; raw: unknown };
export type ShopifyProductWebhook = { id: string; title: string; updatedAt: string; raw: unknown };
export type ShopifyConnection = { shopDomain: string; accessToken: string };

/** Contract only: provider adapters live outside the UI/server-action path. */
export interface ShopifyAdapter {
  validateConnection(connection: ShopifyConnection): Promise<{ shopName: string; currency: string }>;
  listOrders(connection: ShopifyConnection, since?: string): Promise<ShopifyOrderWebhook[]>;
  listProducts(connection: ShopifyConnection, since?: string): Promise<ShopifyProductWebhook[]>;
}
