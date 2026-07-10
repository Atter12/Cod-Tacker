import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { getAccessState } from "@/lib/tenant/get-access-state";
import { routes } from "@/config/routes";

export default async function DashboardResolver() {
  await requireUser();
  const access = await getAccessState();

  if (access.kind === "onboarding") {
    redirect(routes.app.onboarding);
  }

  if (access.kind === "pending_invite") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <EmptyState
          title="Acceso pendiente"
          description="Tu cuenta está activa, pero un administrador aún debe activar tu invitación a una agencia o tienda."
        />
      </main>
    );
  }

  const stores = access.stores;
  const preferred = await getActiveTenantPreference();
  const preferredStore = stores.find(
    (store) => store.agencySlug === preferred.agencySlug && store.storeSlug === preferred.storeSlug,
  );
  if (preferredStore) {
    redirect(routes.store.dashboard(preferredStore.agencySlug, preferredStore.storeSlug));
  }
  if (stores.length === 1) {
    const only = stores[0];
    if (only) redirect(routes.store.dashboard(only.agencySlug, only.storeSlug));
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Selecciona una tienda</h1>
        <p className="mt-1 text-sm text-text-secondary">Elige el espacio de trabajo que quieres revisar.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {stores.map((store) => (
          <Link key={store.storeId} href={routes.store.dashboard(store.agencySlug, store.storeSlug)}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent>
                <p className="font-medium">{store.storeSlug}</p>
                <p className="mt-1 text-sm text-text-secondary">{store.agencySlug}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
