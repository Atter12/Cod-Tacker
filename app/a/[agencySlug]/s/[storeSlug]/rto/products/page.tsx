import { DataTable, ErrorState, SectionHeader } from "@/components/ui";
import { formatRate } from "@/lib/attribution/metrics";
import { parseDateParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listRtoByDimension } from "@/services/rto.service";

/** Product/variant RTO proxy: uses ticket bucket until line-item RTO RPC exists. */
export default async function RtoProductsPage({
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
    return <ErrorState title="Sin permiso" description="No puedes ver RTO de productos." />;
  }

  const to = parseDateParam(sp, "to") ?? new Date().toISOString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 90);
  const from = parseDateParam(sp, "from") ?? fromDefault.toISOString();

  const byTicket = await listRtoByDimension(
    await createClient(),
    member.storeId,
    from,
    to,
    "ticket",
  ).catch(() => []);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="RTO · Productos / ticket"
        description="Desglose por rango de ticket (proxy de producto hasta RPC por variante)."
      />
      <DataTable
        data={byTicket}
        getRowId={(r) => r.dimension_key}
        columns={[
          { id: "bucket", header: "Rango ticket", cell: (r) => r.dimension_label },
          { id: "total", header: "Envíos", cell: (r) => String(r.shipments_total) },
          { id: "rto", header: "RTO", cell: (r) => String(r.rto_count) },
          { id: "rate", header: "Tasa", cell: (r) => formatRate(Number(r.rto_rate)) },
        ]}
        emptyMessage="Sin datos."
      />
    </section>
  );
}
