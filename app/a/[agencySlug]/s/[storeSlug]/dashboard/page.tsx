import {
  Check,
  DollarSign,
  Gauge,
  Route,
  ShoppingCart,
  TrendingUp,
  Truck,
  Undo2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { IntegrationHealthCard } from "@/components/dashboard/IntegrationHealthCard";
import { OperationalFunnel } from "@/components/dashboard/OperationalFunnel";
import { PrimaryMetricCard } from "@/components/dashboard/PrimaryMetricCard";
import { RecentOrdersCard } from "@/components/dashboard/RecentOrdersCard";
import { SecondaryMetricCard } from "@/components/dashboard/SecondaryMetricCard";
import { formatCurrency } from "@/lib/formatting/currency";
import { dateRangeToBounds, parseDateRangePreset, type DateRangePreset } from "@/lib/formatting/date-range";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getDashboardSummary } from "@/services/dashboard.service";

const RevenuePerformanceChart = dynamic(
  () =>
    import("@/components/dashboard/RevenuePerformanceChart").then((mod) => mod.RevenuePerformanceChart),
  {
    loading: () => (
      <div
        className="min-h-[320px] animate-pulse rounded-[11px] border border-border bg-muted/40"
        aria-hidden
      />
    ),
  },
);

function previousPeriodLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "today":
      return "día anterior";
    case "7d":
      return "7 días anteriores";
    case "month":
      return "mes anterior";
    case "30d":
    default:
      return "30 días anteriores";
  }
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRoas(value: number, adSpend: number): string {
  if (adSpend <= 0) return "—";
  return value.toFixed(2);
}

export default async function StoreDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  const { range } = await searchParams;
  const preset = parseDateRangePreset(range);
  const { from, to } = dateRangeToBounds(preset);
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  const summary = await getDashboardSummary(
    await createClient(),
    membership.agencyId,
    membership.storeId!,
    { from: from.toISOString(), to: to.toISOString() },
    { rangePreset: preset },
  );

  const comparisonLabel = previousPeriodLabel(preset);
  const series = summary.timeSeries;
  const spark = {
    generated: series.map((point) => point.ordersGenerated),
    confirmed: series.map((point) => point.ordersConfirmed),
    delivered: series.map((point) => point.ordersDelivered),
    cash: series.map((point) => point.cashCollected),
    returned: series.map((point) => point.ordersReturned),
    rto: series.map((point) => point.rto),
    roasCheckout: series.map((point) => point.roasCheckout),
    roasCollected: series.map((point) => point.roasCollected),
  };

  return (
    <section className="min-w-0 space-y-3">
      <header className="pb-1">
        <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-text-primary">
          Resumen operativo
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Lo provisional no es cobro en puerta; carriers pueden tardar.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PrimaryMetricCard
          label="Pedidos generados"
          value={summary.kpis.ordersGenerated.value.toLocaleString("es-PE")}
          metric={summary.kpis.ordersGenerated}
          sparkline={spark.generated}
          icon={ShoppingCart}
          comparisonLabel={comparisonLabel}
        />
        <PrimaryMetricCard
          label="Confirmados"
          value={summary.kpis.ordersConfirmed.value.toLocaleString("es-PE")}
          metric={summary.kpis.ordersConfirmed}
          sparkline={spark.confirmed}
          icon={Check}
          comparisonLabel={comparisonLabel}
        />
        <PrimaryMetricCard
          label="Entregados"
          value={summary.kpis.ordersDelivered.value.toLocaleString("es-PE")}
          metric={summary.kpis.ordersDelivered}
          sparkline={spark.delivered}
          icon={Truck}
          comparisonLabel={comparisonLabel}
        />
        <PrimaryMetricCard
          label="Efectivo cobrado"
          value={formatCurrency(summary.kpis.cashCollected.value, summary.currencyCode)}
          metric={summary.kpis.cashCollected}
          sparkline={spark.cash}
          icon={DollarSign}
          comparisonLabel={comparisonLabel}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.37fr)_minmax(0,0.63fr)]">
        <OperationalFunnel
          funnel={summary.funnel}
          confirmationRate={summary.kpis.confirmationRate}
          deliveryRate={summary.kpis.deliveryRate}
        />
        <RevenuePerformanceChart
          timeSeries={summary.timeSeries}
          currencyCode={summary.currencyCode}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="md:col-span-2 xl:col-span-2">
          <IntegrationHealthCard
            health={summary.integrationHealth}
            agencySlug={agencySlug}
            storeSlug={storeSlug}
          />
        </div>
        <SecondaryMetricCard
          label="RTO"
          value={percent(summary.kpis.rto.value)}
          metric={summary.kpis.rto}
          sparkline={spark.rto}
          icon={Route}
          increaseIsGood={false}
          comparisonLabel={comparisonLabel}
          changeMode="pp"
        />
        <SecondaryMetricCard
          label="Devueltos"
          value={summary.kpis.ordersReturned.value.toLocaleString("es-PE")}
          metric={summary.kpis.ordersReturned}
          sparkline={spark.returned}
          icon={Undo2}
          increaseIsGood={false}
          comparisonLabel={comparisonLabel}
        />
        <SecondaryMetricCard
          label="ROAS checkout"
          value={formatRoas(summary.kpis.roasCheckout.value, summary.adSpend)}
          metric={summary.kpis.roasCheckout}
          sparkline={spark.roasCheckout}
          icon={TrendingUp}
          comparisonLabel={comparisonLabel}
          changeMode="absolute"
          confidence="provisional"
          hint="Solo ventas en checkout ÷ ads. No es plata cobrada en puerta."
        />
        <SecondaryMetricCard
          label="ROAS cobrado"
          value={formatRoas(summary.kpis.roasCollected.value, summary.adSpend)}
          metric={summary.kpis.roasCollected}
          sparkline={spark.roasCollected}
          icon={Gauge}
          comparisonLabel={comparisonLabel}
          changeMode="absolute"
          confidence="confirmed"
          confidenceLabel="Cobrado"
          hint="Efectivo cobrado en puerta ÷ ads. No uses el ROAS de checkout como si fuera esto."
        />
      </div>

      <RecentOrdersCard
        orders={summary.recentOrders}
        agencySlug={agencySlug}
        storeSlug={storeSlug}
      />
    </section>
  );
}
