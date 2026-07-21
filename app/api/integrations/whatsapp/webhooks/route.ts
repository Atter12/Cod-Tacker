import { after } from "next/server";
import { getWhatsAppEnv } from "@/lib/integrations/whatsapp/env";
import { handleWhatsAppWebhookIngress } from "@/lib/integrations/whatsapp/webhook-ingress";
import { verifyWhatsAppWebhookChallenge } from "@/lib/integrations/whatsapp/webhook-auth";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhooks.
 * GET  — Meta hub.verify_token challenge
 * POST — signed ingress (X-Hub-Signature-256) → enqueue message/status jobs
 *
 * Register: {APP_URL}/api/integrations/whatsapp/webhooks
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const env = getWhatsAppEnv();

  const verified = verifyWhatsAppWebhookChallenge({
    mode,
    verifyToken: token,
    challenge,
    expectedVerifyToken: env.verifyToken,
  });

  if (!verified.ok) {
    logger.warn("whatsapp.webhook.verify_failed", {
      status: verified.status,
      error: verified.error,
    });
    return new Response(verified.error, { status: verified.status });
  }

  return new Response(verified.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWhatsAppWebhookIngress({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });

  if (result.status >= 400) {
    logger.warn("whatsapp.webhook.rejected", {
      status: result.status,
      error: result.body.error,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "whatsapp-webhook" }));
  }

  return Response.json(result.body, { status: result.status });
}
