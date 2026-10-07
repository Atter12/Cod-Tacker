import { SectionHeader } from "@/components/ui";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { resolveStripeKeyModeForUser, canShowStripeTestModeToggle } from "@/lib/billing/stripe-test-mode";
import { resolveAgencyBillingProviderId } from "@/lib/billing/provider";
import { requireUser } from "@/lib/auth/require-user";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getBillingOverview } from "@/services/billing.service";

function billingDescription(mode: "demo" | "stripe" | "shopify"): string {
  if (mode === "shopify") {
    return "Plan de la plataforma COD-tracked para esta agencia. Los cargos self-serve se aprueban en Shopify (App Pricing) y aparecen en la factura del merchant.";
  }
  if (mode === "stripe") {
    return "Plan de la plataforma COD-tracked para esta agencia (Stripe). El cobro no usa Shopify Billing API.";
  }
  return "Plan de la plataforma COD-tracked para esta agencia (modo demo). Sin cargo real.";
}

export default async function AgencyBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const p = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const membership = await requireAgencyAccess(p.agencySlug);
  const client = await createClient();
  const overview = await getBillingOverview(client, membership.agencyId);
  const { data: stores } = await client
    .from("stores")
    .select("id, name")
    .eq("agency_id", membership.agencyId)
    .eq("is_active", true)
    .order("name");

  const canManage = can(membership.roles, "billing.manage");
  const billingMode = await resolveAgencyBillingProviderId(membership.agencyId);
  const stripeKeyMode = await resolveStripeKeyModeForUser(user.email);
  const canUseStripeTestMode =
    billingMode === "stripe" && canShowStripeTestModeToggle(user.email);
  const checkoutStatus =
    sp.checkout === "success" || sp.checkout === "cancel" ? sp.checkout : null;

  return (
    <section className="space-y-6">
      <SectionHeader title="Facturación" description={billingDescription(billingMode)} />
      <BillingPanel
        agencySlug={p.agencySlug}
        canManage={canManage}
        overview={overview}
        stores={stores ?? []}
        billingMode={billingMode}
        stripeKeyMode={stripeKeyMode}
        canUseStripeTestMode={canUseStripeTestMode}
        checkoutStatus={checkoutStatus}
      />
    </section>
  );
}
