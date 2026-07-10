import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listAlerts } from "@/services/alerts.service";

export default async function AlertsPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const rows = await listAlerts(await createClient(), member.storeId!);
  return (
    <section className="space-y-5">
      <SectionHeader title="Alertas" description="Incidencias operativas abiertas." />
      <DataTable
        data={rows}
        getRowId={(row) => row.id}
        columns={[
          { id: "tipo", header: "Tipo", cell: (row) => row.type },
          { id: "titulo", header: "Alerta", cell: (row) => row.title },
          { id: "severidad", header: "Severidad", cell: (row) => row.severity },
          { id: "fecha", header: "Creada", cell: (row) => new Date(row.created_at).toLocaleDateString("es") },
        ]}
        emptyMessage="No hay alertas activas."
      />
    </section>
  );
}
