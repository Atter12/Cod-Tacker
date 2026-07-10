import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
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
  const tenants = stores
    .filter((store) => store.agencySlug === agencySlug)
    .map((store) => ({
      id: store.storeId,
      name: store.storeName,
      type: "store" as const,
      agencySlug: store.agencySlug,
      storeSlug: store.storeSlug,
    }));
  const currentTenantId =
    tenants.find((tenant) => tenant.agencySlug === preferred.agencySlug && tenant.storeSlug === preferred.storeSlug)
      ?.id ?? tenants[0]?.id;

  return (
    <AppShell
      agencySlug={agencySlug}
      title="CODTracked"
      breadcrumbs={[agencySlug]}
      roles={membership.roles}
      user={{
        name: profile?.full_name ?? undefined,
        email: user.email ?? profile?.email ?? undefined,
      }}
      tenantSwitcher={<TenantSwitcher tenants={tenants} currentTenantId={currentTenantId} />}
    >
      {children}
    </AppShell>
  );
}
