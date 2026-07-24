import { z } from "zod";
import { mergeSubscriptionBillingMetadata } from "@/lib/billing/subscription-metadata";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";
import type { Enums } from "@/types/database.generated";

export const billingSubscriptionUpdatedPayloadSchema = z.object({
  agencyId: z.string().uuid(),
  planCode: z.string().min(1).max(64).nullable(),
  status: z.enum(["trialing", "active", "past_due", "paused", "cancelled", "expired"]),
  providerCustomerId: z.string().min(1).max(200).nullable(),
  providerSubscriptionId: z.string().min(1).max(200),
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  billingInterval: z.enum(["month", "year"]).nullable().optional(),
  source_event: z.string().optional(),
  stripe_event_id: z.string().optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError(
    "INVALID_PAYLOAD",
    "El payload de billing.subscription.updated no es un objeto válido.",
  );
}

export const handleBillingSubscriptionUpdated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = billingSubscriptionUpdatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError(
      "INVALID_PAYLOAD",
      "Payload de billing.subscription.updated inválido.",
    );
  }

  const data = parsed.data;
  if (job.agency_id !== data.agencyId) {
    throw new PermanentJobError(
      "AGENCY_MISMATCH",
      "agency_id del job no coincide con el payload de billing.",
    );
  }

  let planId: string | null = null;
  if (data.planCode) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq("code", data.planCode)
      .maybeSingle();
    planId = plan?.id ?? null;
    if (!planId) {
      throw new PermanentJobError(
        "UNKNOWN_PLAN",
        `Plan code desconocido: ${data.planCode}`,
      );
    }
  }

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan_id, metadata")
    .eq("agency_id", data.agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevMeta =
    existing?.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  if (!planId && !existing?.plan_id) {
    throw new PermanentJobError(
      "MISSING_PLAN",
      "No se pudo resolver plan_id para la suscripción.",
    );
  }

  const resolvedPlanId = planId ?? existing!.plan_id;

  const metadata = mergeSubscriptionBillingMetadata({
    previous: prevMeta,
    status: data.status,
    billingInterval: data.billingInterval,
    stripeEventId: data.stripe_event_id,
    sourceEvent: data.source_event,
    currentPeriodEnd: data.currentPeriodEnd,
  });

  const row = {
    agency_id: data.agencyId,
    plan_id: resolvedPlanId,
    status: data.status as Enums<"subscription_status">,
    billing_provider: "stripe",
    provider_customer_id: data.providerCustomerId,
    provider_subscription_id: data.providerSubscriptionId,
    cancel_at_period_end: data.cancelAtPeriodEnd,
    current_period_start: data.currentPeriodStart,
    current_period_end: data.currentPeriodEnd,
    trial_ends_at: data.trialEndsAt,
    metadata: metadata as Json,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("subscriptions").update(row).eq("id", existing.id);
    if (error) throw error;
    return {
      ok: true,
      action: "updated",
      entityType: "subscription",
      entityId: existing.id,
    };
  }

  const { data: created, error } = await admin
    .from("subscriptions")
    .insert(row)
    .select("id")
    .single();
  if (error || !created) {
    throw error ?? new PermanentJobError("INSERT_FAILED", "No se pudo crear la suscripción.");
  }

  return {
    ok: true,
    action: "created",
    entityType: "subscription",
    entityId: created.id,
  };
};
