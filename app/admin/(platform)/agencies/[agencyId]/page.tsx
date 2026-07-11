import Link from "next/link";
import { AdminEntityActions } from "@/components/admin/AdminEntityActions";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAgencyDetail } from "@/services/admin.service";

export default async function AdminAgencyDetailPage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const detail = await getPlatformAgencyDetail(await createClient(), agencyId);
  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Agencia" description="No encontrada." />
      </div>
    );
  }

  const { agency, stores, members, subscription, integrations } = detail;
  const plan = subscription?.plans ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={agency.name}
        description={`Slug ${agency.slug} · ${agency.is_active ? "Activa" : "Suspendida"}`}
      />
      <p className="text-sm">
        <Link href={routes.admin.agencies} className="text-brand-primary hover:underline">
          ← Agencias
        </Link>
      </p>
      <AdminEntityActions
        kind="agency"
        entityId={agency.id}
        isActive={agency.is_active}
        agencyIdForSupport={agency.id}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Suscripción / plan</h3>
            <p>Estado: {subscription?.status ?? "—"}</p>
            <p>Plan: {plan?.name ?? "—"} ({plan?.code ?? "—"})</p>
            <p>
              Límites: {plan?.store_limit ?? "—"} tiendas / {plan?.order_limit ?? "—"} pedidos
            </p>
            <p>Cancel at period end: {subscription?.cancel_at_period_end ? "Sí" : "No"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Tiendas ({stores.length})</h3>
            <ul className="space-y-1">
              {stores.map((s) => (
                <li key={s.id}>
                  <Link
                    className="text-brand-primary hover:underline"
                    href={routes.admin.storeDetail(s.id)}
                  >
                    {s.name}
                  </Link>{" "}
                  <span className="text-xs text-text-secondary">
                    {s.is_active ? "activa" : "suspendida"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Miembros</h3>
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    className="text-brand-primary hover:underline"
                    href={routes.admin.userDetail(m.user_id)}
                  >
                    {m.user_id.slice(0, 8)}…
                  </Link>{" "}
                  · {m.role} · {m.status}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Integraciones</h3>
            <ul className="space-y-1">
              {integrations.map((i) => (
                <li key={i.id}>
                  {i.provider} · {i.status} · {i.display_name ?? "—"}
                </li>
              ))}
              {!integrations.length ? <li className="text-text-secondary">Sin integraciones</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
