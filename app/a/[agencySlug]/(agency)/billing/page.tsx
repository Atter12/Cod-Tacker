import { SectionHeader } from "@/components/ui";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getBillingOverview } from "@/services/billing.service";

export default async function AgencyBillingPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const p = await params;
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

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Facturación"
        description="Planes, límites de uso e historial de facturación de la agencia."
      />
      <BillingPanel
        agencySlug={p.agencySlug}
        canManage={canManage}
        overview={overview}
        stores={stores ?? []}
      />
    </section>
  );
}
