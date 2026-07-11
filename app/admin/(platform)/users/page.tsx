import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminUsersPage() {
  const { users } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" description="Perfiles visibles para administración." />
      <Card>
        <CardContent className="p-4">
          <ul className="divide-y divide-border text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex justify-between py-2">
                <div>
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.admin.userDetail(u.id)}
                  >
                    {u.full_name || u.email || u.id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {u.email} · {u.platform_role ?? "user"} · {u.is_active ? "Activo" : "Suspendido"}
                  </p>
                </div>
              </li>
            ))}
            {!users.length ? (
              <li className="py-8 text-center text-text-secondary">Sin usuarios</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
