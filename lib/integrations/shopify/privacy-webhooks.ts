import { logger } from "@/lib/observability/logger";

/** App Store / GDPR mandatory compliance topics (registered in Partner Dashboard, not Admin API). */
export const SHOPIFY_PRIVACY_TOPICS = [
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export type ShopifyPrivacyTopic = (typeof SHOPIFY_PRIVACY_TOPICS)[number];

export function isShopifyPrivacyTopic(topic: string): topic is ShopifyPrivacyTopic {
  return (SHOPIFY_PRIVACY_TOPICS as readonly string[]).includes(topic);
}

export type ShopifyPrivacyPayloadSummary = {
  shop_id: string | null;
  customer_id: string | null;
  orders_to_redact: number | null;
  data_request_id: string | null;
};

/** Extract safe identifiers only — never log emails/phones/addresses. */
export function summarizeShopifyPrivacyPayload(rawBody: string): ShopifyPrivacyPayloadSummary {
  const empty: ShopifyPrivacyPayloadSummary = {
    shop_id: null,
    customer_id: null,
    orders_to_redact: null,
    data_request_id: null,
  };
  try {
    const json = JSON.parse(rawBody) as Record<string, unknown>;
    const shopId = json.shop_id ?? json.shopId;
    const customer = json.customer;
    let customerId: string | null = null;
    if (customer && typeof customer === "object" && !Array.isArray(customer)) {
      const id = (customer as { id?: unknown }).id;
      if (id != null) customerId = String(id);
    } else if (json.customer_id != null) {
      customerId = String(json.customer_id);
    }
    const orders = json.orders_to_redact;
    const ordersCount = Array.isArray(orders) ? orders.length : null;
    const dataRequestId = json.data_request?.id ?? json.data_request_id;
    return {
      shop_id: shopId != null ? String(shopId) : null,
      customer_id: customerId,
      orders_to_redact: ordersCount,
      data_request_id: dataRequestId != null ? String(dataRequestId) : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Acknowledge GDPR compliance webhook: HMAC already verified by caller.
 * Always returns 200. Logs safe metadata for Partner/Vercel proof.
 */
export function acknowledgeShopifyPrivacyWebhook(input: {
  topic: string;
  shop: string | null;
  webhookId: string | null;
  rawBody: string;
}): { status: 200; body: Record<string, unknown> } {
  const summary = summarizeShopifyPrivacyPayload(input.rawBody);
  logger.info("shopify.webhook.privacy", {
    topic: input.topic,
    shop: input.shop,
    webhook_id: input.webhookId,
    shop_id: summary.shop_id,
    customer_id: summary.customer_id,
    orders_to_redact: summary.orders_to_redact,
    data_request_id: summary.data_request_id,
  });
  return {
    status: 200,
    body: {
      ok: true,
      privacy: true,
      topic: input.topic,
    },
  };
}
