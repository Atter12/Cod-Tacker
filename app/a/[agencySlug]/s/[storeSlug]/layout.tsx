import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  const [user, membership, memberships, profile] = await Promise.all([
    requireUser(),
    requireStoreAccess(agencySlug, storeSlug),
    getCurrentTenant(),
    getProfile(),
  ]);
  const tenants = memberships
    .filter((item) => item.storeId && item.storeSlug)
    .map((item) => ({
      id: item.storeId!,
      name: item.storeSlug!,
      type: "store" as const,
      agencySlug: item.agencySlug,
      storeSlug: item.storeSlug!,
    }));

  return (
    <AppShell
      agencySlug={agencySlug}
      storeSlug={storeSlug}
      title="CODTracked"
      breadcrumbs={[membership.agencySlug, storeSlug]}
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
