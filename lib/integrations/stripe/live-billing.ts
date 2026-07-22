import "server-only";

import type {
  BillingCancelInput,
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingPortalInput,
  BillingProvider,
  BillingReactivateInput,
} from "@/lib/integrations/contracts/billing";
import { isSelfServePlanCode } from "@/lib/integrations/contracts/billing";
import { getStripeClient } from "@/lib/integrations/stripe/client";
import { resolveStripePriceId } from "@/lib/integrations/stripe/prices";
import { ValidationError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

async function loadAgencySubscription(agencyId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("id, provider_customer_id, provider_subscription_id, plan_id, status, metadata")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function ensureStripeCustomer(input: {
  agencyId: string;
  email?: string | null;
  existingCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripeClient();
  if (input.existingCustomerId) {
    return input.existingCustomerId;
  }

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, name, slug")
    .eq("id", input.agencyId)
    .maybeSingle();

  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    name: agency?.name,
    metadata: {
      agency_id: input.agencyId,
      agency_slug: agency?.slug ?? "",
    },
  });

  const existing = await loadAgencySubscription(input.agencyId);
  if (existing) {
    await admin
      .from("subscriptions")
      .update({
        provider_customer_id: customer.id,
        billing_provider: "stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  return customer.id;
}

export function createStripeBillingProvider(): BillingProvider {
  return {
    providerId: "stripe",
    mode: "live",

    async createCheckoutSession(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
      if (!isSelfServePlanCode(input.planCode)) {
        throw new ValidationError(
          "Este plan requiere contacto con ventas. Usa Agency / Enterprise vía el equipo comercial.",
        );
      }

      const admin = createAdminClient();
      const { planId: _planId, priceId } = await resolveStripePriceId(
        admin,
        input.planCode,
        input.interval,
      );
      void _planId;

      const existing = await loadAgencySubscription(input.agencyId);
      const customerId = await ensureStripeCustomer({
        agencyId: input.agencyId,
        email: input.customerEmail,
        existingCustomerId: existing?.provider_customer_id,
      });

      const stripe = getStripeClient();

      // Existing Stripe subscription → swap price (proration); webhook syncs DB.
      if (existing?.provider_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(existing.provider_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (!itemId) {
          throw new ValidationError("La suscripción de Stripe no tiene ítems facturables.");
        }
        await stripe.subscriptions.update(existing.provider_subscription_id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: {
            agency_id: input.agencyId,
            plan_code: input.planCode,
            billing_interval: input.interval,
            changed_by: input.actorUserId ?? "",
          },
          cancel_at_period_end: false,
        });
        return { kind: "applied", planCode: input.planCode };
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: input.agencyId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          agency_id: input.agencyId,
          agency_slug: input.agencySlug,
          plan_code: input.planCode,
          billing_interval: input.interval,
        },
        subscription_data: {
          metadata: {
            agency_id: input.agencyId,
            plan_code: input.planCode,
            billing_interval: input.interval,
          },
        },
        allow_promotion_codes: true,
      });

      if (!session.url) {
        throw new ValidationError("Stripe no devolvió URL de Checkout.");
      }
      return { kind: "redirect", url: session.url };
    },

    async createPortalSession(input: BillingPortalInput): Promise<{ url: string }> {
      const existing = await loadAgencySubscription(input.agencyId);
      if (!existing?.provider_customer_id) {
        throw new ValidationError(
          "No hay cliente de Stripe vinculado. Selecciona un plan self-serve primero.",
        );
      }
      const stripe = getStripeClient();
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.provider_customer_id,
        return_url: input.returnUrl,
      });
      return { url: portal.url };
    },

    async cancelAtPeriodEnd(input: BillingCancelInput): Promise<void> {
      const existing = await loadAgencySubscription(input.agencyId);
      if (!existing?.provider_subscription_id) {
        throw new ValidationError("No hay suscripción de Stripe activa.");
      }
      const stripe = getStripeClient();
      await stripe.subscriptions.update(existing.provider_subscription_id, {
        cancel_at_period_end: true,
        metadata: {
          agency_id: input.agencyId,
          cancel_requested_by: input.actorUserId ?? "",
        },
      });

      const admin = createAdminClient();
      const grace = new Date(Date.now() + 7 * 86400000).toISOString();
      const prevMeta =
        existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          billing_provider: "stripe",
          metadata: {
            ...prevMeta,
            grace_period_ends_at: grace,
            cancel_requested_at: new Date().toISOString(),
          } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    },

    async reactivate(input: BillingReactivateInput): Promise<void> {
      const existing = await loadAgencySubscription(input.agencyId);
      if (!existing?.provider_subscription_id) {
        throw new ValidationError("No hay suscripción de Stripe.");
      }
      const stripe = getStripeClient();
      await stripe.subscriptions.update(existing.provider_subscription_id, {
        cancel_at_period_end: false,
        metadata: {
          agency_id: input.agencyId,
          reactivated_by: input.actorUserId ?? "",
        },
      });

      const admin = createAdminClient();
      const prevMeta =
        existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          cancel_at_period_end: false,
          billing_provider: "stripe",
          metadata: {
            ...prevMeta,
            reactivated_at: new Date().toISOString(),
          } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    },
  };
}
