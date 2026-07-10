import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listAttributionPerformance } from "@/services/attribution.service";

export default async function AttributionPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  const rows = await listAttributionPerformance(await createClient(), {
    storeId: member.storeId!,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return (
    <section className="space-y-5">
      <SectionHeader title="Atribución" description="Rendimiento por plataforma en los últimos 30 días." />
      <DataTable
        data={rows}
        getRowId={(row) => row.platform}
        columns={[
          { id: "plataforma", header: "Plataforma", cell: (row) => row.platform },
          { id: "pedidos", header: "Pedidos", cell: (row) => String(row.orders) },
          { id: "revenue", header: "Valor atribuido", cell: (row) => row.revenue.toFixed(2) },
          { id: "roas", header: "ROAS", cell: (row) => row.roas !== null ? row.roas.toFixed(2) : "—" },
        ]}
        emptyMessage="No hay datos de atribución para este período."
      />
    </section>
  );
}
