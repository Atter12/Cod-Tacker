import { after } from "next/server";
import { handleShopifyWebhookIngress } from "@/lib/integrations/shopify/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify HTTPS webhook receiver.
 * Topics:
 * - orders/create, orders/updated (enqueue jobs)
 * - customers/data_request, customers/redact, shop/redact (GDPR: HMAC + 200 + log)
 * Auth: X-Shopify-Hmac-Sha256 over raw body using SHOPIFY_CLIENT_SECRET.
 * After a successful order enqueue, drains a small job batch so orders land without waiting for cron.
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
  } else if (result.body.ok && !result.body.skipped && !result.body.privacy) {
    after(() => kickJobProcessing({ limit: 8, reason: "shopify-webhook" }));
  }

  return Response.json(result.body, { status: result.status });
}
