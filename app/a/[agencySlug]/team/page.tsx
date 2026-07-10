import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyTeamPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const { data: members } = await (await createClient())
    .from("agency_members")
    .select("id, user_id, role, status, joined_at, created_at")
    .eq("agency_id", membership.agencyId)
    .order("created_at");
  return (
    <section className="space-y-5">
      <SectionHeader title="Equipo" description="Miembros con acceso a esta agencia." />
      <DataTable
        data={members ?? []}
        getRowId={(row) => row.id}
        columns={[
          { id: "user", header: "Usuario", cell: (row) => row.user_id },
          { id: "rol", header: "Rol", cell: (row) => row.role },
          { id: "estado", header: "Estado", cell: (row) => row.status },
          { id: "desde", header: "Desde", cell: (row) => row.joined_at ? new Date(row.joined_at).toLocaleDateString("es") : "—" },
        ]}
        emptyMessage="No hay miembros en esta agencia."
      />
    </section>
  );
}
