import { after } from "next/server";
import { handleEnviaWebhookIngress } from "@/lib/integrations/envia/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_BODY = {
  ok: true,
  service: "codtracked-envia-webhook",
  message:
    "Store-scoped Envia webhook. Register this URL in Envia for this store, or use /api/webhooks/envia for global resolve.",
};

/**
 * Per-store Envia webhook (Option A safety net).
 * Register in Envia UI: {APP_URL}/api/webhooks/envia/{agencySlug}/{storeSlug}
 */
export async function GET() {
  return Response.json(PROBE_BODY, { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ agencySlug: string; storeSlug: string }> },
) {
  const { agencySlug, storeSlug } = await context.params;
  const rawBody = await request.text();
  const result = await handleEnviaWebhookIngress({
    rawBody,
    authorizationHeader: request.headers.get("authorization"),
    signatureHeader: request.headers.get("x-webhook-signature"),
    timestampHeader: request.headers.get("x-webhook-timestamp"),
    eventHeader: request.headers.get("x-webhook-event"),
    webhookIdHeader: request.headers.get("x-webhook-id"),
    storeIdHeader: request.headers.get("x-codtracked-store-id"),
    agencySlug,
    storeSlug,
  });

  if (result.status >= 400) {
    logger.warn("envia.webhook.rejected", {
      status: result.status,
      error: result.body.error,
      agency_slug: agencySlug,
      store_slug: storeSlug,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "envia-webhook-store" }));
  }

  return Response.json(result.body, { status: result.status });
}
