import Link from "next/link";
import { AdminEntityActions } from "@/components/admin/AdminEntityActions";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformStoreDetail } from "@/services/admin.service";

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const detail = await getPlatformStoreDetail(await createClient(), storeId);
  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tienda" description="No encontrada." />
      </div>
    );
  }

  const { store, agency, integrations, orderCount } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.name}
        description={`${store.slug} · ${store.is_active ? "Activa" : "Suspendida"}`}
      />
      <p className="text-sm">
        <Link href={routes.admin.stores} className="text-brand-primary hover:underline">
          ← Tiendas
        </Link>
      </p>
      <AdminEntityActions kind="store" entityId={store.id} isActive={store.is_active} />
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-text-secondary">Agencia</p>
            {agency ? (
              <Link
                className="text-brand-primary hover:underline"
                href={routes.admin.agencyDetail(agency.id)}
              >
                {agency.name}
              </Link>
            ) : (
              "—"
            )}
          </div>
          <div>
            <p className="text-text-secondary">Pedidos</p>
            <p>{orderCount}</p>
          </div>
          <div>
            <p className="text-text-secondary">Moneda / país</p>
            <p>
              {store.currency_code} / {store.country_code}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Zona horaria</p>
            <p>{store.timezone}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <h3 className="font-semibold">Integraciones</h3>
          <ul>
            {integrations.map((i) => (
              <li key={i.id}>
                {i.provider} · {i.status}
              </li>
            ))}
            {!integrations.length ? <li className="text-text-secondary">Sin integraciones</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
