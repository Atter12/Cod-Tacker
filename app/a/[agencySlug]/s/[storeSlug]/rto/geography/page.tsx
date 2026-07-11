import { Suspense } from "react";
import { AnalyticsFiltersForm } from "@/components/attribution/AnalyticsFiltersForm";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { DataTable, ErrorState, SectionHeader, Skeleton } from "@/components/ui";
import { formatRate } from "@/lib/attribution/metrics";
import { parseDateParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listRtoByDimension } from "@/services/rto.service";

/** Geography view: accessible table + bar chart (no heavy map dependency). */
export default async function RtoGeographyPage({
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
    return <ErrorState title="Sin permiso" description="No puedes ver geografía RTO." />;
  }

  const to = parseDateParam(sp, "to") ?? new Date().toISOString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 90);
  const from = parseDateParam(sp, "from") ?? fromDefault.toISOString();

  const [byCity, byDistrict] = await Promise.all([
    listRtoByDimension(await createClient(), member.storeId, from, to, "city").catch(() => []),
    listRtoByDimension(await createClient(), member.storeId, from, to, "district").catch(() => []),
  ]);

  const chartData = byCity.slice(0, 15).map((b) => ({
    name: b.dimension_label.slice(0, 14),
    rto: Number(b.rto_count),
  }));

  return (
    <section className="space-y-5">
      <SectionHeader
        title="RTO · Geografía"
        description="Sin librería de mapas (peso). Tabla accesible + barras por ciudad/distrito."
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <AnalyticsFiltersForm showPlatform={false} />
      </Suspense>
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <SimpleBarChart data={chartData} xKey="name" yKey="rto" />
        </div>
      )}
      <h3 className="text-sm font-semibold">Por ciudad</h3>
      <DataTable
        data={byCity}
        getRowId={(r) => `c-${r.dimension_key}`}
        columns={[
          { id: "city", header: "Ciudad", cell: (r) => r.dimension_label },
          { id: "rto", header: "RTO", cell: (r) => String(r.rto_count) },
          { id: "rate", header: "Tasa", cell: (r) => formatRate(Number(r.rto_rate)) },
        ]}
        emptyMessage="Sin datos de ciudad."
      />
      <h3 className="text-sm font-semibold">Por distrito</h3>
      <DataTable
        data={byDistrict}
        getRowId={(r) => `d-${r.dimension_key}`}
        columns={[
          { id: "d", header: "Distrito", cell: (r) => r.dimension_label },
          { id: "rto", header: "RTO", cell: (r) => String(r.rto_count) },
          { id: "rate", header: "Tasa", cell: (r) => formatRate(Number(r.rto_rate)) },
        ]}
        emptyMessage="Sin datos de distrito."
      />
    </section>
  );
}
