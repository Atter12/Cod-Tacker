import { DateRangePicker, MetricCard, SectionHeader, Card, CardContent, DataTable } from "@/components/ui";
import { formatCurrency } from "@/lib/formatting/currency";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getDashboardSummary } from "@/services/dashboard.service";

const percent = (value: number) => new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 }).format(value);

export default async function StoreDashboard({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const { agencySlug, storeSlug } = await params;
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  const summary = await getDashboardSummary(
    await createClient(),
    membership.agencyId,
    membership.storeId!,
    { from: from.toISOString(), to: to.toISOString() },
  );
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Resumen operativo</h1>
          <p className="text-sm text-text-secondary">Indicadores calculados con los datos disponibles.</p>
        </div>
        <DateRangePicker />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pedidos generados" value={String(summary.kpis.ordersGenerated)} />
        <MetricCard label="Confirmados" value={String(summary.kpis.ordersConfirmed)} />
        <MetricCard label="Entregados" value={String(summary.kpis.ordersDelivered)} />
        <MetricCard label="Devueltos" value={String(summary.kpis.ordersReturned)} />
        <MetricCard label="Tasa confirmación" value={percent(summary.kpis.confirmationRate)} />
        <MetricCard label="Tasa entrega" value={percent(summary.kpis.deliveryRate)} />
        <MetricCard label="RTO" value={percent(summary.kpis.rto)} />
        <MetricCard label="Efectivo esperado" value={formatCurrency(summary.kpis.cashExpected)} />
        <MetricCard label="Efectivo cobrado" value={formatCurrency(summary.kpis.cashCollected)} />
        <MetricCard label="Efectivo conciliado" value={formatCurrency(summary.kpis.cashSettled)} />
        <MetricCard label="ROAS checkout" value={summary.kpis.roasCheckout.toFixed(2)} />
        <MetricCard label="ROAS entregado" value={summary.kpis.roasDelivered.toFixed(2)} />
        <MetricCard label="ROAS cobrado" value={summary.kpis.roasCollected.toFixed(2)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <SectionHeader title="Embudo operativo" description="Generados, confirmados, entregados y devueltos." />
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-secondary">Entregados</dt>
                <dd className="text-xl font-semibold">{summary.kpis.ordersDelivered}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Devueltos</dt>
                <dd className="text-xl font-semibold">{summary.kpis.ordersReturned}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <SectionHeader title="Estado de integraciones" description="Conexiones registradas para esta tienda." />
            <p className="mt-4 text-sm text-text-secondary">
              {summary.integrations.length
                ? `${summary.integrations.length} integración(es) registrada(s).`
                : "No hay integraciones conectadas."}
            </p>
          </CardContent>
        </Card>
      </div>
      <div>
        <SectionHeader title="Pedidos recientes" />
        <DataTable
          data={summary.recentOrders}
          getRowId={(order) => order.id}
          columns={[
            { id: "number", header: "Pedido", cell: (order) => order.order_number ?? order.external_order_id },
            { id: "status", header: "Estado", cell: (order) => order.order_status },
            { id: "total", header: "Total", cell: (order) => `${order.total_amount} ${order.currency_code}` },
          ]}
          emptyMessage="No hay pedidos en este período."
        />
      </div>
    </section>
  );
}
