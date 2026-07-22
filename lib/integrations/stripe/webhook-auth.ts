import "server-only";

import { getStripeClient } from "@/lib/integrations/stripe/client";
import { getStripeBillingEnv } from "@/lib/billing/env";

export function constructStripeWebhookEvent(input: {
  rawBody: string;
  signatureHeader: string | null;
}):
  | { ok: true; event: import("stripe").Stripe.Event }
  | { ok: false; status: number; error: string } {
  const env = getStripeBillingEnv();
  if (!env.webhookSecret) {
    return {
      ok: false,
      status: 503,
      error: "STRIPE_WEBHOOK_SECRET no configurado",
    };
  }
  if (!input.signatureHeader) {
    return { ok: false, status: 400, error: "Falta Stripe-Signature" };
  }

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(
      input.rawBody,
      input.signatureHeader,
      env.webhookSecret,
    );
    return { ok: true, event };
  } catch (error) {
    const message = error instanceof Error ? error.message : "firma inválida";
    return { ok: false, status: 400, error: `Webhook inválido: ${message}` };
  }
}
