import Link from "next/link";
import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminAgenciesPage() {
  const { agencies } = await getPlatformRecords(await createClient());
  const rows = agencies.map((a) => ({
    ...a,
    detail: a.id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Agencias" description="Gestión de agencias de la plataforma." />
      <Card>
        <CardContent className="space-y-3 p-4">
          <ul className="divide-y divide-border text-sm">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.admin.agencyDetail(a.id)}
                  >
                    {a.name}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {a.slug} · {a.is_active ? "Activa" : "Suspendida"}
                  </p>
                </div>
                <span className="text-xs text-text-secondary">
                  {new Date(a.created_at).toLocaleDateString("es")}
                </span>
              </li>
            ))}
          </ul>
          {!rows.length ? (
            <AdminTable rows={[]} columns={[{ key: "name", label: "Nombre" }]} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
