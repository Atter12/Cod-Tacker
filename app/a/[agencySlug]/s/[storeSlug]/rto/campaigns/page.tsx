import Link from "next/link";
import { DataTable, ErrorState, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { formatRate } from "@/lib/attribution/metrics";
import { parseDateParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listRtoByDimension } from "@/services/rto.service";

export default async function RtoCampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if ((!can(member.roles, "shipments.view") && !can(member.roles, "attribution.view")) || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver RTO por campaña." />;
  }

  const to = parseDateParam(sp, "to") ?? new Date().toISOString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 90);
  const from = parseDateParam(sp, "from") ?? fromDefault.toISOString();

  const rows = await listRtoByDimension(
    await createClient(),
    member.storeId,
    from,
    to,
    "campaign",
  ).catch(() => []);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="RTO · Campañas"
        description="RTO de envíos cuya atribución primaria apunta a una campaña."
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.campaigns(p.agencySlug, p.storeSlug)}
          >
            Ver campañas
          </Link>
        }
      />
      <DataTable
        data={rows}
        getRowId={(r) => r.dimension_key}
        columns={[
          {
            id: "camp",
            header: "Campaña",
            cell: (r) =>
              r.dimension_key === "unattributed" ? (
                "unattributed"
              ) : (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, r.dimension_key)}
                >
                  {r.dimension_label.slice(0, 8)}…
                </Link>
              ),
          },
          { id: "total", header: "Envíos", cell: (r) => String(r.shipments_total) },
          { id: "rto", header: "RTO", cell: (r) => String(r.rto_count) },
          { id: "rate", header: "Tasa", cell: (r) => formatRate(Number(r.rto_rate)) },
        ]}
        emptyMessage="Sin datos de campaña."
      />
    </section>
  );
}
