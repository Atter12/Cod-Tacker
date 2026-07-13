import { AgencyStoresPanel } from "@/components/agency/AgencyStoresPanel";
import { SectionHeader } from "@/components/ui";
import {
  STARTER_DEFAULT_ORDER_LIMIT,
} from "@/lib/billing/limits";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getBillingOverview } from "@/services/billing.service";

export default async function AgencyStoresPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const canCreate = can(membership.roles, "store.create");
  const client = await createClient();
  const [storesRes, overview] = await Promise.all([
    client
      .from("stores")
      .select("id, name, slug, country_code, currency_code, timezone, is_active, created_at")
      .eq("agency_id", membership.agencyId)
      .order("name"),
    getBillingOverview(client, membership.agencyId),
  ]);

  const orderLimit = overview.limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Tiendas"
        description="Crea y administra todas las tiendas de tu agencia."
      />
      <AgencyStoresPanel
        agencySlug={p.agencySlug}
        canCreate={canCreate}
        orderLimit={orderLimit}
        stores={(storesRes.data ?? []).map((store) => ({
          ...store,
          orderCount: undefined,
          orderLimit,
        }))}
      />
    </section>
  );
}
