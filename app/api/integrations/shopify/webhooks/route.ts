import { handleShopifyWebhookIngress } from "@/lib/integrations/shopify/webhook-ingress";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify HTTPS webhook receiver.
 * Topics handled: orders/create, orders/updated.
 * Auth: X-Shopify-Hmac-Sha256 over raw body using SHOPIFY_CLIENT_SECRET.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleShopifyWebhookIngress({
    rawBody,
    hmacHeader: request.headers.get("x-shopify-hmac-sha256"),
    shopHeader: request.headers.get("x-shopify-shop-domain"),
    topicHeader: request.headers.get("x-shopify-topic"),
    webhookIdHeader: request.headers.get("x-shopify-webhook-id"),
  });

  if (result.status >= 400) {
    logger.warn("shopify.webhook.rejected", {
      status: result.status,
      error: result.body.error,
      shop: request.headers.get("x-shopify-shop-domain"),
      topic: request.headers.get("x-shopify-topic"),
    });
  }

  return Response.json(result.body, { status: result.status });
}
