import { AppShell } from "@/components/layout/AppShell";
import { BackToStoreButton } from "@/components/layout/BackToStoreButton";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { routes } from "@/config/routes";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const [user, membership, stores, profile, preferred] = await Promise.all([
    requireUser(),
    requireAgencyAccess(agencySlug),
    getAccessibleStores(),
    getProfile(),
    getActiveTenantPreference(),
  ]);
  const agencyStores = stores.filter((store) => store.agencySlug === agencySlug);
  const agencyName = agencyStores[0]?.agencyName ?? agencySlug;
  const tenants = agencyStores.map((store) => ({
    id: store.storeId,
    name: store.storeName,
    type: "store" as const,
    agencySlug: store.agencySlug,
    storeSlug: store.storeSlug,
  }));
  const currentTenant =
    tenants.find((tenant) => tenant.agencySlug === preferred.agencySlug && tenant.storeSlug === preferred.storeSlug) ??
    tenants[0];
  const returnToStore = currentTenant
    ? {
        href: routes.store.dashboard(currentTenant.agencySlug, currentTenant.storeSlug),
        storeName: currentTenant.name,
      }
    : null;

  return (
    <AppShell
      agencySlug={agencySlug}
      title="Consola de agencia"
      breadcrumbs={[{ label: agencyName, href: routes.agency.stores(agencySlug) }]}
      roles={membership.roles}
      user={{
        name: profile?.full_name ?? undefined,
        email: user.email ?? profile?.email ?? undefined,
      }}
      returnToStore={returnToStore}
      storeReturn={
        returnToStore ? <BackToStoreButton href={returnToStore.href} storeName={returnToStore.storeName} /> : null
      }
      tenantSwitcher={
        <TenantSwitcher tenants={tenants} currentTenantId={currentTenant?.id} scope="agency" />
      }
    >
      {children}
    </AppShell>
  );
}
