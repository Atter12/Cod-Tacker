import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, PageHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminCarriersPage() {
  const { carriers } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Transportistas" description="Catálogo de transportistas visible para la plataforma." />
      <Card>
        <CardContent className="p-0">
          <DataTable
            data={carriers}
            getRowId={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "Nombre",
                cell: (row) => (
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.admin.carrierDetail(row.id)}
                  >
                    {row.name}
                  </Link>
                ),
              },
              { id: "code", header: "Código", cell: (row) => row.code },
              {
                id: "active",
                header: "Activo",
                cell: (row) => (row.is_active ? "Sí" : "No"),
              },
              {
                id: "created",
                header: "Creado",
                cell: (row) =>
                  new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(
                    new Date(row.created_at),
                  ),
              },
              {
                id: "actions",
                header: "",
                cell: (row) => (
                  <Link
                    className="text-sm text-brand-primary hover:underline"
                    href={routes.admin.carrierMappings(row.id)}
                  >
                    Mapeos
                  </Link>
                ),
              },
            ]}
            emptyMessage="No hay transportistas."
          />
        </CardContent>
      </Card>
    </div>
  );
}
