import { AgencyConsoleMenu } from "@/components/layout/AgencyConsoleMenu";
import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { routes } from "@/config/routes";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getStoreActiveAlertCount } from "@/services/dashboard.service";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  const [user, membership, stores, profile] = await Promise.all([
    requireUser(),
    requireStoreAccess(agencySlug, storeSlug),
    getAccessibleStores(),
    getProfile(),
  ]);
  const currentStore = stores.find((store) => store.storeId === membership.storeId);
  const agencyName = currentStore?.agencyName ?? agencySlug;
  const storeName = currentStore?.storeName ?? storeSlug;
  const tenants = stores.map((store) => ({
    id: store.storeId,
    name: store.storeName,
    type: "store" as const,
    agencySlug: store.agencySlug,
    storeSlug: store.storeSlug,
  }));

  const activeAlertCount = await getStoreActiveAlertCount(
    await createClient(),
    membership.agencyId,
    membership.storeId!,
  );

  return (
    <AppShell
      agencySlug={agencySlug}
      storeSlug={storeSlug}
      title="CODTracked"
      breadcrumbs={[
        { label: agencyName, href: routes.agency.stores(agencySlug) },
        { label: storeName },
      ]}
      roles={membership.roles}
      user={{
        name: profile?.full_name ?? undefined,
        email: user.email ?? profile?.email ?? undefined,
      }}
      activeAlertCount={activeAlertCount}
      agencyConsole={
        <AgencyConsoleMenu agencySlug={agencySlug} agencyName={agencyName} roles={membership.roles} />
      }
      tenantSwitcher={
        <TenantSwitcher
          tenants={tenants}
          currentTenantId={membership.storeId}
          agencySlug={agencySlug}
          agencyName={agencyName}
          showAgencyConsole
          scope="store"
        />
      }
    >
      {children}
    </AppShell>
  );
}
