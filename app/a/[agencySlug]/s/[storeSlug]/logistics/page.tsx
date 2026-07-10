import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listShipments } from "@/services/shipments.service";

export default async function LogisticsPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const rows = await listShipments(await createClient(), { storeId: member.storeId!, from: "1970-01-01", to: new Date().toISOString() });
  return (
    <section className="space-y-5">
      <SectionHeader title="Logística" description="Seguimiento de envíos de la tienda." />
      <DataTable
        data={rows}
        getRowId={(row) => row.id}
        columns={[
          { id: "tracking", header: "Guía", cell: (row) => row.tracking_number },
          { id: "estado", header: "Estado", cell: (row) => row.status },
          { id: "destino", header: "Destino", cell: (row) => row.destination_country_code ?? "—" },
        ]}
        emptyMessage="No hay envíos para mostrar."
      />
    </section>
  );
}
