import Link from "next/link";
import { AdminEntityActions } from "@/components/admin/AdminEntityActions";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { getPlatformUserDetail } from "@/services/admin.service";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const detail = await getPlatformUserDetail(await createClient(), userId);
  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Usuario" description="No encontrado." />
      </div>
    );
  }

  const { profile, agencyMemberships, storeMemberships } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.full_name || profile.email || "Usuario"}
        description={`${profile.platform_role ?? "user"} · ${profile.is_active ? "Activo" : "Suspendido"}`}
      />
      <p className="text-sm">
        <Link href={routes.admin.users} className="text-brand-primary hover:underline">
          ← Usuarios
        </Link>
      </p>
      <AdminEntityActions kind="user" entityId={profile.id} isActive={profile.is_active} />
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <p>Email: {profile.email ?? "—"}</p>
          <p>ID: <span className="font-mono text-xs">{profile.id}</span></p>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Membresías de agencia</h3>
            <ul>
              {agencyMemberships.map((m) => {
                const ag = Array.isArray(m.agencies) ? m.agencies[0] : m.agencies;
                return (
                  <li key={m.id}>
                    {ag?.name ?? m.agency_id} · {m.role} · {m.status}
                  </li>
                );
              })}
              {!agencyMemberships.length ? (
                <li className="text-text-secondary">Ninguna</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Membresías de tienda</h3>
            <ul>
              {storeMemberships.map((m) => {
                const st = Array.isArray(m.stores) ? m.stores[0] : m.stores;
                return (
                  <li key={m.id}>
                    {st?.name ?? m.store_id} · {m.role} · {m.status}
                  </li>
                );
              })}
              {!storeMemberships.length ? (
                <li className="text-text-secondary">Ninguna</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
