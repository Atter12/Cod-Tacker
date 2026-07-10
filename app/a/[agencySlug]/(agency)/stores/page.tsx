import { CreateStoreForm } from "@/components/agency/CreateStoreForm";
import { DataTable, SectionHeader } from "@/components/ui";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import Link from "next/link";
import { routes } from "@/config/routes";

export default async function AgencyStoresPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const canCreate = can(membership.roles, "store.create");
  const { data: stores } = await (await createClient())
    .from("stores")
    .select("id, name, slug, currency_code, is_active, created_at")
    .eq("agency_id", membership.agencyId)
    .order("name");

  return (
    <section className="space-y-6">
      <SectionHeader title="Tiendas" description="Tiendas registradas en esta agencia." />
      {canCreate ? <CreateStoreForm agencySlug={p.agencySlug} /> : null}
      <DataTable
        data={stores ?? []}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            cell: (row) => (
              <Link className="text-brand-primary" href={routes.store.dashboard(p.agencySlug, row.slug)}>
                {row.name}
              </Link>
            ),
          },
          { id: "slug", header: "Slug", cell: (row) => row.slug },
          { id: "moneda", header: "Moneda", cell: (row) => row.currency_code },
          { id: "estado", header: "Estado", cell: (row) => (row.is_active ? "Activa" : "Inactiva") },
        ]}
        emptyMessage="No hay tiendas registradas."
      />
    </section>
  );
}
