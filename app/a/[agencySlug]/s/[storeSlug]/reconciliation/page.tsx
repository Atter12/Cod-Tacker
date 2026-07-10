import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listSettlementBatches } from "@/services/reconciliation.service";

export default async function ReconciliationPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const rows = await listSettlementBatches(await createClient(), { storeId: member.storeId!, from: "1970-01-01", to: new Date().toISOString() });
  return (
    <section className="space-y-5">
      <SectionHeader title="Conciliación" description="Lotes de liquidación registrados." />
      <DataTable
        data={rows}
        getRowId={(row) => row.id}
        columns={[
          { id: "referencia", header: "Referencia", cell: (row) => row.reference ?? row.external_batch_id ?? row.id },
          { id: "estado", header: "Estado", cell: (row) => row.status },
          { id: "neto", header: "Neto", cell: (row) => `${row.net_amount} ${row.currency_code}` },
        ]}
        emptyMessage="No hay liquidaciones para mostrar."
      />
    </section>
  );
}
