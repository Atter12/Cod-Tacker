import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminUsersPage() {
  const { users } = await getPlatformRecords(await createClient());
  return <div className="space-y-6"><PageHeader title="Usuarios" description="Primeros 100 perfiles visibles para la administración." /><Card><CardContent className="p-0"><AdminTable rows={users} columns={[{ key: "full_name", label: "Nombre" }, { key: "email", label: "Correo" }, { key: "platform_role", label: "Rol plataforma" }, { key: "created_at", label: "Creado" }]} /></CardContent></Card></div>;
}
