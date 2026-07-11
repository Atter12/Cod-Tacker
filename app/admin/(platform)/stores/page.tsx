import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRecords } from "@/services/admin.service";

export default async function AdminStoresPage() {
  const { stores } = await getPlatformRecords(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Tiendas" description="Tiendas visibles para administración." />
      <Card>
        <CardContent className="p-4">
          <ul className="divide-y divide-border text-sm">
            {stores.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <div>
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.admin.storeDetail(s.id)}
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {s.slug} · {s.is_active ? "Activa" : "Suspendida"}
                  </p>
                </div>
                <span className="text-xs text-text-secondary">
                  {new Date(s.created_at).toLocaleDateString("es")}
                </span>
              </li>
            ))}
            {!stores.length ? (
              <li className="py-8 text-center text-text-secondary">Sin tiendas</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
