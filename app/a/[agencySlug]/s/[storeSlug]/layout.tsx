import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { requireUser } from "@/lib/auth/require-user";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const { agencySlug, storeSlug } = await params;
  const [user, membership, memberships] = await Promise.all([requireUser(), requireStoreAccess(agencySlug, storeSlug), getCurrentTenant()]);
  const tenants = memberships.filter((item) => item.storeId && item.storeSlug).map((item) => ({ id: item.storeId!, name: item.storeSlug!, type: "store" as const }));
  return <AppShell agencySlug={agencySlug} storeSlug={storeSlug} title="CODTracked" breadcrumbs={[membership.agencySlug, storeSlug]} user={{ email: user.email ?? undefined }} tenantSwitcher={<TenantSwitcher tenants={tenants} currentTenantId={membership.storeId} />}>{children}</AppShell>;
}
