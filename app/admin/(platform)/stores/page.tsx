import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminStoresPage() {
  const { stores } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Tiendas" description="Primeros 100 registros visibles para la administración." />
      <Card>
        <CardContent className="p-0">
          <AdminTable
            rows={stores}
            columns={[
              { key: "name", label: "Nombre" },
              { key: "slug", label: "Slug" },
              { key: "agency_id", label: "Agencia" },
              { key: "created_at", label: "Creada" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
