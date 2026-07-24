import "server-only";

import Stripe from "stripe";
import { getStripeBillingEnv } from "@/lib/billing/env";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;
  const env = getStripeBillingEnv();
  if (!env.secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe. Set it in the server environment.",
    );
  }
  cached = new Stripe(env.secretKey, {
    // Keep in sync with stripe package default when STRIPE_API_VERSION unset.
    apiVersion: env.apiVersion as Stripe.LatestApiVersion,
  });
  return cached;
}
