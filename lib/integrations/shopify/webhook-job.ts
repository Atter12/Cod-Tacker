/** Live job enqueued for a Shopify order webhook. Other topics do not enter the order pipeline. */
export type ShopifyOrderWebhookJobType = "shopify.order.created" | "shopify.order.updated";

/** Same Shopify webhook id always enqueues one job. Without an id, the order timestamp is the key. */
export function shopifyOrderWebhookIdempotencyKey(input: {
  shop: string;
  topic: string;
  webhookId: string | null;
  externalOrderId: string;
  occurredAt: string | null;
}): string {
  const webhookId = input.webhookId?.trim() ?? "";
  if (webhookId.length > 0) return `shopify:wh:${input.shop}:${webhookId}`;
  const occurredAt = input.occurredAt?.trim() || "na";
  return `shopify:wh:${input.shop}:${input.topic}:${input.externalOrderId}:${occurredAt}`;
}

export function shopifyOrderWebhookJobType(topic: string): ShopifyOrderWebhookJobType | null {
  const normalized = topic.trim().toLowerCase();
  if (normalized === "orders/create") return "shopify.order.created";
  if (normalized === "orders/updated") return "shopify.order.updated";
  return null;
}
