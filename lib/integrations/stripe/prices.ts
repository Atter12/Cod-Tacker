import "server-only";

import type { BillingInterval } from "@/lib/integrations/contracts/billing";
import { readStripePriceIdFromEnv } from "@/lib/billing/env";
import { ValidationError } from "@/lib/errors";
import type { DatabaseClient } from "@/services/_shared";

export async function resolveStripePriceId(
  client: DatabaseClient,
  planCode: string,
  interval: BillingInterval,
): Promise<{ planId: string; priceId: string; productId: string | null }> {
  const { data: plan, error } = await client
    .from("plans")
    .select("id, code")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new ValidationError("Plan no encontrado.");

  const { data: mapped } = await client
    .from("plan_provider_prices")
    .select("provider_price_id, provider_product_id")
    .eq("plan_id", plan.id)
    .eq("provider", "stripe")
    .eq("interval", interval)
    .eq("is_active", true)
    .maybeSingle();

  const fromDb = mapped?.provider_price_id?.trim() || null;
  const fromEnv = readStripePriceIdFromEnv(planCode, interval);
  const priceId = fromDb ?? fromEnv;
  if (!priceId) {
    throw new ValidationError(
      `No hay Price ID de Stripe para ${planCode}/${interval}. Configura plan_provider_prices o STRIPE_PRICE_${planCode.toUpperCase()}_${interval === "year" ? "YEAR" : "MONTH"}.`,
    );
  }

  return {
    planId: plan.id,
    priceId,
    productId: mapped?.provider_product_id ?? null,
  };
}

export async function resolvePlanCodeByStripePriceId(
  client: DatabaseClient,
  priceId: string,
): Promise<string | null> {
  const { data: mapped } = await client
    .from("plan_provider_prices")
    .select("plan_id")
    .eq("provider", "stripe")
    .eq("provider_price_id", priceId)
    .eq("is_active", true)
    .maybeSingle();

  if (mapped?.plan_id) {
    const { data: plan } = await client
      .from("plans")
      .select("code")
      .eq("id", mapped.plan_id)
      .maybeSingle();
    if (plan?.code) return plan.code;
  }

  for (const code of ["starter", "growth", "scale"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (readStripePriceIdFromEnv(code, interval) === priceId) return code;
    }
  }
  return null;
}
