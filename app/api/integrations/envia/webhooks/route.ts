import { after } from "next/server";
import { handleEnviaWebhookIngress } from "@/lib/integrations/envia/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envia.com shipment status webhook.
 *
 * Register in Envia UI (Desarrolladores → Webhooks):
 *   POST {APP_URL}/api/integrations/envia/webhooks
 *   Tipo: onShipmentStatusUpdate
 *
 * Optional auth: ENVIA_WEBHOOK_SECRET (Bearer or X-Webhook-Signature).
 * Optional tenant pin: ENVIA_DEFAULT_STORE_ID or header x-codtracked-store-id
 *
 * Docs: https://docs.envia.com/docs/webhooks
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleEnviaWebhookIngress({
    rawBody,
    authorizationHeader: request.headers.get("authorization"),
    signatureHeader: request.headers.get("x-webhook-signature"),
    timestampHeader: request.headers.get("x-webhook-timestamp"),
    eventHeader: request.headers.get("x-webhook-event"),
    webhookIdHeader: request.headers.get("x-webhook-id"),
    storeIdHeader: request.headers.get("x-codtracked-store-id"),
  });

  if (result.status >= 400) {
    logger.warn("envia.webhook.rejected", {
      status: result.status,
      error: result.body.error,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "envia-webhook" }));
  }

  return Response.json(result.body, { status: result.status });
}
