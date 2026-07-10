import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { resolveTenantRedirect } from "@/lib/tenant/resolve-tenant-redirect";
import { routes } from "@/config/routes";

export default async function DashboardResolver() {
  await requireUser();
  const memberships = await getCurrentTenant();
  const stores = memberships.filter((membership): membership is typeof membership & { storeId: string; storeSlug: string } => Boolean(membership.storeId && membership.storeSlug));
  if (!stores.length) return <EmptyState title="Acceso pendiente" description="Tu cuenta está activa, pero aún no tiene acceso a una tienda. Contacta al administrador de tu agencia." />;
  const preferred = await getActiveTenantPreference();
  const preferredStore = stores.find((store) => store.agencySlug === preferred.agencySlug && store.storeSlug === preferred.storeSlug);
  if (preferredStore) redirect(routes.store.dashboard(preferredStore.agencySlug, preferredStore.storeSlug));
  if (stores.length === 1) redirect(resolveTenantRedirect(stores));
  return <section className="mx-auto max-w-3xl space-y-5 py-10"><div><h1 className="text-2xl font-semibold">Selecciona una tienda</h1><p className="mt-1 text-sm text-text-secondary">Elige el espacio de trabajo que quieres revisar.</p></div><div className="grid gap-3 sm:grid-cols-2">{stores.map((store) => <Link key={store.storeId} href={routes.store.dashboard(store.agencySlug, store.storeSlug)}><Card className="transition-shadow hover:shadow-md"><CardContent><p className="font-medium">{store.storeSlug}</p><p className="mt-1 text-sm text-text-secondary">{store.agencySlug}</p></CardContent></Card></Link>)}</div></section>;
}
