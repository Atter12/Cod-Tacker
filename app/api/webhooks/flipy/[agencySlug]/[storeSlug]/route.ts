import { after } from "next/server";
import { handleFlipyWebhookIngress } from "@/lib/integrations/flipy/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_BODY = {
  ok: true,
  service: "codtracked-flipy-webhook",
  message: "Store-scoped Flipy webhook. Register this URL via Flipy Partner API on connect.",
};

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
  const result = await handleFlipyWebhookIngress({
    rawBody,
    signatureHeader: request.headers.get("x-flipy-signature"),
    eventIdHeader: request.headers.get("x-flipy-event-id"),
    agencySlug,
    storeSlug,
  });

  if (result.status >= 400) {
    logger.warn("flipy.webhook.rejected", {
      status: result.status,
      error: result.body.error,
      agency_slug: agencySlug,
      store_slug: storeSlug,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "flipy-webhook-store" }));
  }

  return Response.json(result.body, { status: result.status });
}
