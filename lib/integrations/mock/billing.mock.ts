import "server-only";

import { defaultCancelGraceEndsAt } from "@/lib/billing/access-policy";
import type {
  BillingCancelInput,
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingPortalInput,
  BillingProvider,
  BillingReactivateInput,
} from "@/lib/integrations/contracts/billing";
import { isSelfServePlanCode } from "@/lib/integrations/contracts/billing";
import { ValidationError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { Enums } from "@/types/database.generated";

/**
 * Demo billing — local plan changes / invoices without a payment gateway.
 * Used when BILLING_PROVIDER=demo (default).
 */
export function createDemoBillingProvider(): BillingProvider {
  return {
    providerId: "demo",
    mode: "mock",

    async createCheckoutSession(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
      if (!isSelfServePlanCode(input.planCode)) {
        throw new ValidationError(
          "Este plan requiere contacto con ventas (Agency / Enterprise).",
        );
      }

      const admin = createAdminClient();
      const { data: plan } = await admin
        .from("plans")
        .select("id, code, name, monthly_price, annual_price")
        .eq("code", input.planCode)
        .eq("is_active", true)
        .maybeSingle();
      if (!plan) throw new ValidationError("Plan no encontrado.");

      const now = new Date();
      const periodMs = input.interval === "year" ? 365 * 86400000 : 30 * 86400000;
      const periodEnd = new Date(now.getTime() + periodMs);
      const amountCents = Math.round(
        Number(input.interval === "year" ? plan.annual_price ?? plan.monthly_price * 12 : plan.monthly_price) *
          100,
      );

      const { data: existing } = await admin
        .from("subscriptions")
        .select("id")
        .eq("agency_id", input.agencyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let subscriptionId: string;
      if (existing) {
        const { error } = await admin
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active" as Enums<"subscription_status">,
            billing_provider: "demo",
            cancel_at_period_end: false,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            metadata: {
              demo: true,
              billing_interval: input.interval,
              changed_by: input.actorUserId ?? null,
            } as Json,
            updated_at: now.toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        subscriptionId = existing.id;
      } else {
        const { data: created, error } = await admin
          .from("subscriptions")
          .insert({
            agency_id: input.agencyId,
            plan_id: plan.id,
            status: "active" as Enums<"subscription_status">,
            billing_provider: "demo",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
            metadata: { demo: true, billing_interval: input.interval } as Json,
          })
          .select("id")
          .single();
        if (error || !created) {
          throw error ?? new ValidationError("No se pudo crear la suscripción.");
        }
        subscriptionId = created.id;
      }

      const invoiceNumber = `DEMO-${plan.code.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      await admin.from("invoice_records").insert({
        agency_id: input.agencyId,
        subscription_id: subscriptionId,
        invoice_number: invoiceNumber,
        status: "paid",
        currency_code: "USD",
        amount_cents: amountCents,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        issued_at: now.toISOString(),
        paid_at: now.toISOString(),
        metadata: {
          demo: true,
          note: "Facturación de demostración",
          billing_interval: input.interval,
        } as Json,
      });

      return { kind: "applied", planCode: plan.code };
    },

    async createPortalSession(_input: BillingPortalInput): Promise<{ url: string }> {
      void _input;
      throw new ValidationError(
        "El portal de cliente no está disponible en modo demo. Usa cancelar / reactivar en Facturación.",
      );
    },

    async cancelAtPeriodEnd(input: BillingCancelInput): Promise<void> {
      const admin = createAdminClient();
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, current_period_end, metadata")
        .eq("agency_id", input.agencyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) throw new ValidationError("No hay suscripción activa.");

      const graceIso = defaultCancelGraceEndsAt(sub.current_period_end);
      const prevMeta =
        sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
          ? (sub.metadata as Record<string, unknown>)
          : {};

      const { error } = await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          billing_provider: "demo",
          metadata: {
            ...prevMeta,
            demo: true,
            grace_period_ends_at: graceIso,
            cancel_requested_at: new Date().toISOString(),
            cancel_requested_by: input.actorUserId ?? null,
          } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (error) throw error;
    },

    async reactivate(input: BillingReactivateInput): Promise<void> {
      const admin = createAdminClient();
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, metadata")
        .eq("agency_id", input.agencyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) throw new ValidationError("No hay suscripción.");

      const prevMeta =
        sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
          ? (sub.metadata as Record<string, unknown>)
          : {};

      const { error } = await admin
        .from("subscriptions")
        .update({
          status: "active" as Enums<"subscription_status">,
          cancel_at_period_end: false,
          billing_provider: "demo",
          metadata: {
            ...prevMeta,
            demo: true,
            reactivated_at: new Date().toISOString(),
            reactivated_by: input.actorUserId ?? null,
          } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (error) throw error;
    },
  };
}
