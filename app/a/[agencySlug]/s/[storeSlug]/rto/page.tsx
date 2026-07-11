import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsFiltersForm } from "@/components/attribution/AnalyticsFiltersForm";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import {
  DataTable,
  ErrorState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { formatRate } from "@/lib/attribution/metrics";
import { parseDateParam, parseStringParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listRtoByDimension, listRtoShipments } from "@/services/rto.service";

export default async function RtoPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "shipments.view") && !can(member.roles, "attribution.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver RTO." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const to = parseDateParam(sp, "to") ?? new Date().toISOString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 90);
  const from = parseDateParam(sp, "from") ?? fromDefault.toISOString();
  const dimension = parseStringParam(sp, "dimension") ?? "city";

  const client = await createClient();
  const [shipments, breakdown] = await Promise.all([
    listRtoShipments(client, member.storeId, from, to),
    listRtoByDimension(client, member.storeId, from, to, dimension).catch(() => []),
  ]);

  const chartData = breakdown.slice(0, 12).map((b) => ({
    name: b.dimension_label.slice(0, 12),
    rto: Number(b.rto_count),
  }));

  return (
    <section className="space-y-5">
      <SectionHeader
        title="RTO analítico"
        description="Tasa de devolución segmentada. Tabla accesible siempre; gráfico opcional."
        action={
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              className="underline text-brand-primary"
              href={routes.store.rtoGeography(p.agencySlug, p.storeSlug)}
            >
              Geografía
            </Link>
            <Link
              className="underline text-brand-primary"
              href={routes.store.rtoProducts(p.agencySlug, p.storeSlug)}
            >
              Productos
            </Link>
            <Link
              className="underline text-brand-primary"
              href={routes.store.rtoCampaigns(p.agencySlug, p.storeSlug)}
            >
              Campañas
            </Link>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <AnalyticsFiltersForm showPlatform={false} showDimension />
      </Suspense>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-2">RTO por {dimension}</p>
          <SimpleBarChart data={chartData} xKey="name" yKey="rto" />
        </div>
      )}

      <DataTable
        data={breakdown}
        getRowId={(row) => row.dimension_key}
        columns={[
          { id: "dim", header: "Dimensión", cell: (row) => row.dimension_label },
          { id: "total", header: "Envíos", cell: (row) => String(row.shipments_total) },
          { id: "rto", header: "RTO", cell: (row) => String(row.rto_count) },
          {
            id: "rate",
            header: "Tasa",
            cell: (row) => formatRate(Number(row.rto_rate)),
          },
        ]}
        emptyMessage="Sin desglose RTO (aplica migración RPC o aún no hay envíos)."
      />

      <h3 className="text-sm font-semibold">Envíos RTO recientes</h3>
      <DataTable
        data={shipments}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "tracking",
            header: "Guía",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.shipmentDetail(p.agencySlug, p.storeSlug, row.id)}
              >
                {row.tracking_number ?? row.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            id: "estado",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            id: "fecha",
            header: "Creado",
            cell: (row) => new Date(row.created_at).toLocaleDateString("es-PE"),
          },
        ]}
        emptyMessage="No hay envíos RTO para mostrar."
      />
    </section>
  );
}
