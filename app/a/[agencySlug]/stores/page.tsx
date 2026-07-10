import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyStoresPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const { data: stores } = await (await createClient())
    .from("stores")
    .select("id, name, slug, currency_code, is_active, created_at")
    .eq("agency_id", membership.agencyId)
    .order("name");
  return (
    <section className="space-y-5">
      <SectionHeader title="Tiendas" description="Tiendas registradas en esta agencia." />
      <DataTable
        data={stores ?? []}
        getRowId={(row) => row.id}
        columns={[
          { id: "nombre", header: "Nombre", cell: (row) => row.name },
          { id: "slug", header: "Slug", cell: (row) => row.slug },
          { id: "moneda", header: "Moneda", cell: (row) => row.currency_code },
          { id: "estado", header: "Estado", cell: (row) => row.is_active ? "Activa" : "Inactiva" },
        ]}
        emptyMessage="No hay tiendas registradas."
      />
    </section>
  );
}
