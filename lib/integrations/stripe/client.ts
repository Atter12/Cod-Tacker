import "server-only";

import Stripe from "stripe";
import {
  getStripeBillingEnvForMode,
  type StripeKeyMode,
} from "@/lib/billing/env";

const cached = new Map<StripeKeyMode, Stripe>();

export function getStripeClient(mode: StripeKeyMode = "live"): Stripe {
  const hit = cached.get(mode);
  if (hit) return hit;

  const env = getStripeBillingEnvForMode(mode);
  const keyName = mode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
  if (!env.secretKey) {
    throw new Error(
      `${keyName} is required when BILLING_PROVIDER=stripe${mode === "test" ? " (test mode)" : ""}. Set it in the server environment.`,
    );
  }
  const client = new Stripe(env.secretKey, {
    apiVersion: env.apiVersion as Stripe.LatestApiVersion,
  });
  cached.set(mode, client);
  return client;
}
