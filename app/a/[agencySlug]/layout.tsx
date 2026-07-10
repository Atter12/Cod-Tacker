import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { requireUser } from "@/lib/auth/require-user";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export default async function AgencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const [user, membership, memberships] = await Promise.all([requireUser(), requireAgencyAccess(agencySlug), getCurrentTenant()]);
  const tenants = memberships
    .filter((item) => item.agencySlug === agencySlug && item.storeId && item.storeSlug)
    .map((item) => ({ id: item.storeId!, name: item.storeSlug!, type: "store" as const }));
  return (
    <AppShell
      agencySlug={agencySlug}
      title="CODTracked"
      breadcrumbs={[agencySlug]}
      user={{ email: user.email ?? undefined }}
      tenantSwitcher={<TenantSwitcher tenants={tenants} currentTenantId={membership.agencyId} />}
    >
      {children}
    </AppShell>
  );
}
