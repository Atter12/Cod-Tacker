import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyApiKeysPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const { data: keys } = await (await createClient())
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, last_used_at, expires_at, created_at")
    .eq("agency_id", membership.agencyId)
    .order("created_at", { ascending: false });
  return (
    <section className="space-y-5">
      <SectionHeader title="API Keys" description="Claves de acceso programático a la API de esta agencia." />
      <DataTable
        data={keys ?? []}
        getRowId={(row) => row.id}
        columns={[
          { id: "nombre", header: "Nombre", cell: (row) => row.name },
          { id: "prefijo", header: "Prefijo", cell: (row) => row.key_prefix },
          { id: "estado", header: "Estado", cell: (row) => row.status },
          { id: "ultimo_uso", header: "Último uso", cell: (row) => row.last_used_at ? new Date(row.last_used_at).toLocaleDateString("es") : "—" },
          { id: "vence", header: "Vence", cell: (row) => row.expires_at ? new Date(row.expires_at).toLocaleDateString("es") : "Sin vencimiento" },
        ]}
        emptyMessage="No hay API keys para esta agencia."
      />
    </section>
  );
}
