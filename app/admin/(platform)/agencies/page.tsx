import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminAgenciesPage() {
  const { agencies } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Agencias" description="Primeros 100 registros visibles para la administración." />
      <Card>
        <CardContent className="p-0">
          <AdminTable
            rows={agencies}
            columns={[
              { key: "name", label: "Nombre" },
              { key: "slug", label: "Slug" },
              { key: "created_by", label: "Creada por" },
              { key: "created_at", label: "Creada" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
