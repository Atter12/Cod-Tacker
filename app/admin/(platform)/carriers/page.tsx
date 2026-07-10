import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminCarriersPage() {
  const { carriers } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Transportistas" description="Catálogo de transportistas visible para la plataforma." />
      <Card>
        <CardContent className="p-0">
          <AdminTable
            rows={carriers}
            columns={[
              { key: "name", label: "Nombre" },
              { key: "code", label: "Código" },
              { key: "is_active", label: "Activo" },
              { key: "created_at", label: "Creado" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
