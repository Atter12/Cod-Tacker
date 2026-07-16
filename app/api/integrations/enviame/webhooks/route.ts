import { after } from "next/server";
import { handleEnviameWebhookIngress } from "@/lib/integrations/enviame/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enviame status-change webhook (S11).
 * Auth: x-enviame-webhook-secret (or Authorization: Bearer) == ENVIAME_WEBHOOK_SECRET
 * Optional: x-codtracked-store-id to pin tenant
 * Behavior: ack fast → enqueue carrier.shipment.updated → kick jobs (no tracking poll here)
 *
 * Configure in Enviame: POST {APP_URL}/api/integrations/enviame/webhooks
 * Docs: https://docs.enviame.io/docs/webhooks/
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleEnviameWebhookIngress({
    rawBody,
    secretHeader: request.headers.get("x-enviame-webhook-secret"),
    authorizationHeader: request.headers.get("authorization"),
    storeIdHeader: request.headers.get("x-codtracked-store-id"),
  });

  if (result.status >= 400) {
    logger.warn("enviame.webhook.rejected", {
      status: result.status,
      error: result.body.error,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "enviame-webhook" }));
  }

  return Response.json(result.body, { status: result.status });
}
