import "server-only";

import Stripe from "stripe";
import {
  getStripeBillingEnvForMode,
  type StripeKeyMode,
} from "@/lib/billing/env";

export type StripeWebhookAuthResult =
  | { ok: true; event: Stripe.Event; mode: StripeKeyMode }
  | { ok: false; status: number; error: string };

/**
 * Verify Stripe signature against live and/or test webhook secrets.
 * Same URL can receive both Dashboard modes.
 */
export function constructStripeWebhookEvent(input: {
  rawBody: string;
  signatureHeader: string | null;
}): StripeWebhookAuthResult {
  if (!input.signatureHeader) {
    return { ok: false, status: 400, error: "Falta Stripe-Signature" };
  }

  const live = getStripeBillingEnvForMode("live");
  const test = getStripeBillingEnvForMode("test");
  if (!live.webhookSecret && !test.webhookSecret) {
    return {
      ok: false,
      status: 503,
      error: "STRIPE_WEBHOOK_SECRET / STRIPE_TEST_WEBHOOK_SECRET no configurado",
    };
  }

  const attempts: Array<{ mode: StripeKeyMode; secret: string }> = [];
  if (live.webhookSecret) attempts.push({ mode: "live", secret: live.webhookSecret });
  if (test.webhookSecret) attempts.push({ mode: "test", secret: test.webhookSecret });

  let lastError = "firma inválida";
  for (const attempt of attempts) {
    try {
      const event = Stripe.webhooks.constructEvent(
        input.rawBody,
        input.signatureHeader,
        attempt.secret,
      );
      const mode: StripeKeyMode = event.livemode ? "live" : "test";
      return { ok: true, event, mode };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "firma inválida";
    }
  }

  return { ok: false, status: 400, error: `Webhook inválido: ${lastError}` };
}
