import { SectionHeader } from "@/components/ui";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { resolveAgencyBillingProviderId } from "@/lib/billing/provider";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getBillingOverview } from "@/services/billing.service";

function billingDescription(mode: "demo" | "shopify"): string {
  if (mode === "shopify") {
    return "Plan de CODTracked para esta agencia. Se elige y se cobra en Shopify, en la factura de la tienda.";
  }
  return "Plan de CODTracked para esta agencia (modo demo). Sin cargo real.";
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
  const resolvedMode = await resolveAgencyBillingProviderId(membership.agencyId);
  const billingMode = resolvedMode === "demo" ? "demo" : "shopify";
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
        checkoutStatus={checkoutStatus}
      />
    </section>
  );
}
