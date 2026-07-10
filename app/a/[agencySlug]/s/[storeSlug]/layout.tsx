import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

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
  const tenants = stores.map((store) => ({
    id: store.storeId,
    name: store.storeName,
    type: "store" as const,
    agencySlug: store.agencySlug,
    storeSlug: store.storeSlug,
  }));

  return (
    <AppShell
      agencySlug={agencySlug}
      storeSlug={storeSlug}
      title="CODTracked"
      breadcrumbs={[membership.agencySlug, storeSlug]}
      roles={membership.roles}
      user={{
        name: profile?.full_name ?? undefined,
        email: user.email ?? profile?.email ?? undefined,
      }}
      tenantSwitcher={<TenantSwitcher tenants={tenants} currentTenantId={membership.storeId} />}
    >
      {children}
    </AppShell>
  );
}
