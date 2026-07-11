"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import type { Json } from "@/types/database";
import type { Enums } from "@/types/database.generated";

export type BillingActionResult = ActionResult<{ planCode?: string }>;

function assertBillingManage(roles: readonly Role[]) {
  if (!can(roles, "billing.manage")) {
    throw new ValidationError("No tienes permiso para gestionar la facturación.");
  }
}

async function ensureMockInvoice(
  client: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  subscriptionId: string,
  planCode: string,
  amountCents: number,
) {
  const invoiceNumber = `DEMO-${planCode.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  await client.from("invoice_records").insert({
    agency_id: agencyId,
    subscription_id: subscriptionId,
    invoice_number: invoiceNumber,
    status: "paid",
    currency_code: "USD",
    amount_cents: amountCents,
    period_start: new Date().toISOString(),
    period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    issued_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    metadata: { demo: true, note: "Facturación de demostración" } as Json,
  });
}

export async function changePlanMock(
  agencySlug: string,
  planCode: string,
): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const client = await createClient();
    const { data: plan } = await client
      .from("plans")
      .select("id, code, name, monthly_price")
      .eq("code", planCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) throw new ValidationError("Plan no encontrado.");

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400000);
    const { data: existing } = await client
      .from("subscriptions")
      .select("id, plan_id, status")
      .eq("agency_id", membership.agencyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId: string;
    if (existing) {
      const { error } = await client
        .from("subscriptions")
        .update({
          plan_id: plan.id,
          status: "active" as Enums<"subscription_status">,
          billing_provider: "demo",
          cancel_at_period_end: false,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          metadata: { demo: true, changed_by: user.id } as Json,
          updated_at: now.toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;
      subscriptionId = existing.id;
    } else {
      const { data: created, error } = await client
        .from("subscriptions")
        .insert({
          agency_id: membership.agencyId,
          plan_id: plan.id,
          status: "active" as Enums<"subscription_status">,
          billing_provider: "demo",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          metadata: { demo: true } as Json,
        })
        .select("id")
        .single();
      if (error || !created) throw error ?? new ValidationError("No se pudo crear la suscripción.");
      subscriptionId = created.id;
    }

    await ensureMockInvoice(
      client,
      membership.agencyId,
      subscriptionId,
      plan.code,
      Math.round(Number(plan.monthly_price) * 100),
    );

    await writeAuditLog({
      action: "billing_plan_changed",
      entityType: "subscription",
      entityId: subscriptionId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { planCode: plan.code, planName: plan.name },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    revalidatePath(routes.agency.branding(agencySlug));
    return actionOk({ planCode: plan.code });
  } catch (error) {
    return actionFail(error);
  }
}

export async function scheduleCancelAtPeriodEnd(agencySlug: string): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const client = await createClient();
    const { data: sub } = await client
      .from("subscriptions")
      .select("id, current_period_end")
      .eq("agency_id", membership.agencyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new ValidationError("No hay suscripción activa.");

    const grace = new Date(
      (sub.current_period_end ? new Date(sub.current_period_end).getTime() : Date.now()) + 7 * 86400000,
    );

    const { error } = await client
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        metadata: {
          demo: true,
          grace_period_ends_at: grace.toISOString(),
          cancel_requested_at: new Date().toISOString(),
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (error) throw error;

    await writeAuditLog({
      action: "billing_cancel_scheduled",
      entityType: "subscription",
      entityId: sub.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { gracePeriodEndsAt: grace.toISOString() },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function reactivateSubscriptionMock(agencySlug: string): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const client = await createClient();
    const { data: sub } = await client
      .from("subscriptions")
      .select("id")
      .eq("agency_id", membership.agencyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new ValidationError("No hay suscripción.");

    const { error } = await client
      .from("subscriptions")
      .update({
        status: "active" as Enums<"subscription_status">,
        cancel_at_period_end: false,
        metadata: { demo: true, reactivated_at: new Date().toISOString() } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (error) throw error;

    await writeAuditLog({
      action: "billing_reactivated",
      entityType: "subscription",
      entityId: sub.id,
      actorId: user.id,
      agencyId: membership.agencyId,
    });

    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}
