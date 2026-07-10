import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminIntegrationsPage() {
  const { integrations } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Integraciones" description="Solo estado y metadatos operativos; las credenciales no se muestran." />
      <Card>
        <CardContent className="p-0">
          <AdminTable
            rows={integrations}
            columns={[
              { key: "display_name", label: "Nombre" },
              { key: "provider", label: "Proveedor" },
              { key: "status", label: "Estado" },
              { key: "store_id", label: "Tienda" },
              { key: "connected_at", label: "Conectada" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
