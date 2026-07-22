import "server-only";

import type Stripe from "stripe";
import {
  mapStripeInvoiceStatus,
  unixToIso as invoiceUnixToIso,
  type NormalizedBillingInvoice,
} from "@/lib/integrations/stripe/map-invoice";
import {
  mapStripeSubscriptionStatus,
  unixToIso as subUnixToIso,
  type NormalizedBillingSubscription,
} from "@/lib/integrations/stripe/map-subscription";
import { resolvePlanCodeByStripePriceId } from "@/lib/integrations/stripe/prices";
import { createAdminClient } from "@/lib/supabase/admin";

function metaString(
  meta: Stripe.Metadata | null | undefined,
  key: string,
): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function subscriptionPeriod(sub: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  // Stripe SDK shapes vary; prefer items[0] period when top-level missing.
  const anySub = sub as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;
  return {
    start: anySub.current_period_start ?? item?.current_period_start ?? null,
    end: anySub.current_period_end ?? item?.current_period_end ?? null,
  };
}

function primaryPriceId(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

export async function normalizeStripeSubscription(
  sub: Stripe.Subscription,
  agencyIdFallback: string | null,
): Promise<NormalizedBillingSubscription | null> {
  const agencyId =
    metaString(sub.metadata, "agency_id") ??
    agencyIdFallback ??
    (typeof sub.customer === "object" && sub.customer && !("deleted" in sub.customer)
      ? metaString(sub.customer.metadata, "agency_id")
      : null);
  if (!agencyId) return null;

  const admin = createAdminClient();
  const priceId = primaryPriceId(sub);
  const planFromMeta = metaString(sub.metadata, "plan_code");
  const planCode =
    planFromMeta ?? (priceId ? await resolvePlanCodeByStripePriceId(admin, priceId) : null);

  const period = subscriptionPeriod(sub);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const intervalFromMeta = metaString(sub.metadata, "billing_interval");
  const priceObj = sub.items?.data?.[0]?.price;
  const recurringInterval =
    priceObj && typeof priceObj !== "string" ? priceObj.recurring?.interval : null;
  const billingInterval: "month" | "year" | null =
    intervalFromMeta === "year" || intervalFromMeta === "month"
      ? intervalFromMeta
      : recurringInterval === "year" || recurringInterval === "month"
        ? recurringInterval
        : null;

  return {
    agencyId,
    planCode,
    status: mapStripeSubscriptionStatus(sub.status),
    providerCustomerId: customerId,
    providerSubscriptionId: sub.id,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodStart: subUnixToIso(period.start),
    currentPeriodEnd: subUnixToIso(period.end),
    trialEndsAt: subUnixToIso(sub.trial_end),
    billingInterval,
  };
}

export async function normalizeStripeInvoice(
  invoice: Stripe.Invoice,
  agencyIdFallback: string | null,
): Promise<NormalizedBillingInvoice | null> {
  const agencyId =
    metaString(invoice.metadata, "agency_id") ??
    agencyIdFallback ??
    (typeof invoice.customer === "object" &&
    invoice.customer &&
    !("deleted" in invoice.customer)
      ? metaString(invoice.customer.metadata, "agency_id")
      : null);
  if (!agencyId) return null;

  const subRef = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null })
    .subscription;
  const providerSubscriptionId =
    typeof subRef === "string" ? subRef : subRef && typeof subRef === "object" ? subRef.id : null;

  const number = invoice.number?.trim() || invoice.id;
  return {
    agencyId,
    providerInvoiceId: invoice.id,
    invoiceNumber: number,
    status: mapStripeInvoiceStatus(invoice.status),
    currencyCode: (invoice.currency ?? "usd").toUpperCase(),
    amountCents: invoice.amount_paid || invoice.amount_due || 0,
    periodStart: invoiceUnixToIso(invoice.period_start),
    periodEnd: invoiceUnixToIso(invoice.period_end),
    issuedAt: invoiceUnixToIso(invoice.created) ?? new Date().toISOString(),
    paidAt: invoice.status === "paid" ? invoiceUnixToIso(invoice.status_transitions?.paid_at) : null,
    providerSubscriptionId,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  };
}

export function extractAgencyIdFromCheckoutSession(
  session: Stripe.Checkout.Session,
): string | null {
  return metaString(session.metadata, "agency_id");
}
