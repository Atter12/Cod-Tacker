import { after } from "next/server";
import { handleStripeBillingWebhookIngress } from "@/lib/integrations/stripe/webhook-ingress";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe billing webhooks (Checkout / Subscriptions / Invoices).
 * Dashboard → Developers → Webhooks →
 *   {NEXT_PUBLIC_APP_URL}/api/billing/webhooks/stripe
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleStripeBillingWebhookIngress({
    rawBody,
    signatureHeader: request.headers.get("stripe-signature"),
  });

  if (result.status >= 400) {
    logger.warn("stripe.billing.webhook.http_error", {
      status: result.status,
      error: result.body.error,
    });
  } else if (result.enqueued) {
    after(() => kickJobProcessing({ limit: 8, reason: "stripe-billing-webhook" }));
  }

  return Response.json(result.body, { status: result.status });
}
