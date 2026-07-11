import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsFiltersForm } from "@/components/attribution/AnalyticsFiltersForm";
import { AttributionSeedButton } from "@/components/attribution/AttributionSeedButton";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import {
  DataTable,
  ErrorState,
  MetricCard,
  SectionHeader,
  Skeleton,
  Tooltip,
  DemoModeBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { formatRate, formatRoas } from "@/lib/attribution/metrics";
import { parseDateParam, parseStringParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getAdsDailyTrend,
  getStoreFunnel,
  listAdAccounts,
  listAttributionPerformance,
} from "@/services/attribution.service";

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default async function AttributionPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver atribución." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const defaults = defaultRange();
  const from = parseDateParam(sp, "from") ?? defaults.from;
  const to = parseDateParam(sp, "to") ?? defaults.to;
  const platform = parseStringParam(sp, "platform");
  const client = await createClient();

  const [rows, funnel, trend, accounts] = await Promise.all([
    listAttributionPerformance(client, {
      storeId: member.storeId,
      from,
      to,
      platforms: platform ? [platform] : undefined,
    }),
    getStoreFunnel(client, member.storeId, from, to).catch(() => null),
    getAdsDailyTrend(client, member.storeId, from.slice(0, 10), to.slice(0, 10)).catch(() => []),
    listAdAccounts(client, member.storeId),
  ]);

  const canManage = can(member.roles, "attribution.manage");
  const chartData = trend.map((t) => ({
    name: t.metric_date.slice(5),
    spend: Number(t.spend),
    revenue: Number(t.attributed_revenue),
  }));

  return (
    <section className="space-y-5">
      <DemoModeBadge />
      <SectionHeader
        title="Atribución"
        description="Modelo last_click (mock). Unattributed es categoría explícita. ROAS generado usa revenue atribuido ÷ spend."
        action={
          <div className="flex flex-wrap gap-2 items-center">
            {canManage && (
              <AttributionSeedButton agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
            )}
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <AnalyticsFiltersForm />
      </Suspense>

      {funnel && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pedidos" value={String(funnel.orders_total)} />
          <MetricCard label="Entregados" value={String(funnel.delivered)} />
          <MetricCard
            label="Cobrado"
            value={Number(funnel.collected_value).toFixed(2)}
            hint="collected_cod_amount"
          />
          <MetricCard
            label="Liquidado"
            value={Number(funnel.settled_value).toFixed(2)}
            hint="settled_cod_amount"
          />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-2">Tendencia diaria de spend</p>
          <SimpleBarChart data={chartData} xKey="name" yKey="spend" />
        </div>
      )}

      <DataTable
        data={rows}
        getRowId={(row) => row.platform}
        columns={[
          {
            id: "plataforma",
            header: "Plataforma",
            cell: (row) => (
              <Tooltip content="Incluye 'other' / unattributed cuando no hay touchpoint primario.">
                <span>{row.platform}</span>
              </Tooltip>
            ),
          },
          { id: "pedidos", header: "Pedidos", cell: (row) => String(row.orders) },
          { id: "revenue", header: "Valor atribuido", cell: (row) => row.revenue.toFixed(2) },
          { id: "spend", header: "Spend", cell: (row) => row.spend.toFixed(2) },
          {
            id: "roas",
            header: "ROAS gen.",
            cell: (row) => formatRoas(row.roas),
          },
        ]}
        emptyMessage="No hay datos de atribución. Siembra mock o sincroniza ads."
      />

      <div>
        <h3 className="text-sm font-semibold mb-2">Cuentas publicitarias</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-text-secondary">Sin cuentas. Usa “Recalcular mock”.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.attributionAccount(p.agencySlug, p.storeSlug, a.id)}
                >
                  {a.name ?? a.external_account_id} ({a.platform})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {funnel && (
        <p className="text-xs text-text-secondary">
          Tasa confirmación aprox.{" "}
          {formatRate(
            funnel.orders_total > 0 ? Number(funnel.confirmed) / Number(funnel.orders_total) : null,
          )}{" "}
          · RTO pedidos{" "}
          {formatRate(
            funnel.orders_total > 0 ? Number(funnel.returned) / Number(funnel.orders_total) : null,
          )}
        </p>
      )}
    </section>
  );
}
