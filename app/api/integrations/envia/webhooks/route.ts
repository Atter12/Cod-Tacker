import { after } from "next/server";
import { handleEnviaWebhookIngress } from "@/lib/integrations/envia/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_BODY = {
  ok: true,
  service: "codtracked-envia-webhook",
  message: "Webhook reachable. Use POST with tracking payload for events.",
};

/**
 * Envia.com shipment status webhook (alias of /api/webhooks/envia).
 *
 * Prefer:
 *   {APP_URL}/api/webhooks/envia/{agencySlug}/{storeSlug}  (per-store)
 *   {APP_URL}/api/webhooks/envia                           (global resolve)
 *
 * Tipo en Envia UI: onShipmentStatusUpdate
 */
export async function GET() {
  return Response.json(PROBE_BODY, { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

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
