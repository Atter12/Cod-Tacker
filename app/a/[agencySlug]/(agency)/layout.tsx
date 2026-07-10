import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export default async function AgencyConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const [user, , memberships, profile, preferred] = await Promise.all([
    requireUser(),
    requireAgencyAccess(agencySlug),
    getCurrentTenant(),
    getProfile(),
    getActiveTenantPreference(),
  ]);
  const tenants = memberships
    .filter((item) => item.agencySlug === agencySlug && item.storeId && item.storeSlug)
    .map((item) => ({
      id: item.storeId!,
      name: item.storeSlug!,
      type: "store" as const,
      agencySlug: item.agencySlug,
      storeSlug: item.storeSlug!,
    }));
  const currentTenantId =
    tenants.find((tenant) => tenant.agencySlug === preferred.agencySlug && tenant.storeSlug === preferred.storeSlug)
      ?.id ?? tenants[0]?.id;

  return (
    <AppShell
      agencySlug={agencySlug}
      title="CODTracked"
      breadcrumbs={[agencySlug]}
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
