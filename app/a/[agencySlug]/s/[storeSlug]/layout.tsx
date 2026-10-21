import type { Metadata } from "next";
import { AgencyConsoleMenu } from "@/components/layout/AgencyConsoleMenu";
import { AppShell } from "@/components/layout/AppShell";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { Alert } from "@/components/ui";
import { storeNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { getProfile } from "@/lib/auth/get-profile";
import { lockedStoreNavHrefs } from "@/lib/billing/entitlements";
import { getAgencyEntitlements, getMonthlyOrderUsage } from "@/lib/billing/plan-gate";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { brandFaviconMetadata } from "@/lib/branding/theme";
import { getAgencyBrandTheme } from "@/services/branding.service";
import { getStoreActiveAlertCount } from "@/services/dashboard.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}): Promise<Metadata> {
  const { agencySlug } = await params;
  const client = await createClient();
  const { data: agency } = await client
    .from("agencies")
    .select("id")
    .eq("slug", agencySlug)
    .maybeSingle();
  if (!agency) return { title: "CODTracked" };
  const brand = await getAgencyBrandTheme(client, agency.id);
  return {
    title: {
      default: brand.productName,
      template: `%s · ${brand.productName}`,
    },
    icons: brandFaviconMetadata(brand.faviconUrl),
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  const [user, membership, stores, profile, client] = await Promise.all([
    requireUser(),
    requireStoreAccess(agencySlug, storeSlug),
    getAccessibleStores(),
    getProfile(),
    createClient(),
  ]);
  const brand = await getAgencyBrandTheme(client, membership.agencyId);
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

  const [activeAlertCount, { entitlements, limits }] = await Promise.all([
    getStoreActiveAlertCount(client, membership.agencyId, membership.storeId!),
    getAgencyEntitlements(membership.agencyId),
  ]);
  const orderUsage = await getMonthlyOrderUsage(membership.agencyId, entitlements, limits);
  const lockedNavHrefs = lockedStoreNavHrefs(
    entitlements,
    storeNavigation.map((item) => item.href),
  );

  return (
    <AppShell
      agencySlug={agencySlug}
      storeSlug={storeSlug}
      title={brand.productName}
      brand={brand}
      breadcrumbs={[
        { label: agencyName, href: routes.agency.overview(agencySlug) },
        { label: storeName },
      ]}
      roles={membership.roles}
      user={{
        name: profile?.full_name ?? undefined,
        email: user.email ?? profile?.email ?? undefined,
      }}
      activeAlertCount={activeAlertCount}
      lockedNavHrefs={lockedNavHrefs}
      notice={
        orderUsage.overLimit ? (
          <div className="mb-4">
            <Alert variant="warning" title="Límite de pedidos del plan superado">
              Este mes van {orderUsage.used} pedidos y el plan {entitlements.planName} incluye{" "}
              {orderUsage.limit}. Los pedidos siguen sincronizando; mejora el plan en Facturación.
            </Alert>
          </div>
        ) : null
      }
      agencyConsole={
        <AgencyConsoleMenu
          agencySlug={agencySlug}
          agencyName={agencyName}
          roles={membership.roles}
        />
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
