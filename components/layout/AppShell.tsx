import { type CSSProperties, type ReactNode } from "react";
import type { Role } from "@/config/permissions";
import { BrandFavicon } from "@/components/branding/BrandFavicon";
import {
  agencyBrandCssVars,
  type AgencyBrandTheme,
} from "@/lib/branding/theme";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar, type BreadcrumbItem } from "./AppTopbar";
import { MobileNavigation } from "./MobileNavigation";

export function AppShell({
  children,
  agencySlug,
  storeSlug,
  title,
  breadcrumbs,
  storeReturn,
  agencyConsole,
  tenantSwitcher,
  user,
  roles = [],
  returnToStore,
  activeAlertCount = 0,
  brand,
}: {
  children: ReactNode;
  agencySlug: string;
  storeSlug?: string;
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  storeReturn?: ReactNode;
  agencyConsole?: ReactNode;
  tenantSwitcher?: ReactNode;
  user?: { name?: string; email?: string };
  roles?: readonly Role[];
  returnToStore?: { href: string; storeName: string } | null;
  activeAlertCount?: number;
  brand?: AgencyBrandTheme | null;
}) {
  const scope = storeSlug ? "store" : "agency";
  const productName = brand?.productName?.trim() || "CODTracked";
  const mobileLabel = scope === "agency" ? "Consola de agencia" : productName;
  const brandStyle = brand ? (agencyBrandCssVars(brand) as CSSProperties) : undefined;

  return (
    <div className="flex min-h-screen bg-surface" style={brandStyle}>
      <BrandFavicon href={brand?.faviconUrl} />
      <AppSidebar
        agencySlug={agencySlug}
        storeSlug={storeSlug}
        scope={scope}
        roles={roles}
        returnToStore={returnToStore}
        activeAlertCount={activeAlertCount}
        brand={brand}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border bg-surface-elevated px-3 lg:hidden">
          <MobileNavigation
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            scope={scope}
            roles={roles}
            returnToStore={returnToStore}
            activeAlertCount={activeAlertCount}
            brand={brand}
          />
          <span className="ml-2 min-w-0 truncate text-sm font-semibold text-text-primary">
            {mobileLabel}
          </span>
        </div>
        <AppTopbar
          title={title}
          breadcrumbs={breadcrumbs}
          storeReturn={storeReturn}
          agencyConsole={agencyConsole}
          tenantSwitcher={tenantSwitcher}
          user={user}
          agencySlug={agencySlug}
          storeSlug={storeSlug}
          activeAlertCount={activeAlertCount}
          hideTitle={Boolean(storeSlug && tenantSwitcher)}
        />
        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-[22px]">{children}</main>
        {brand && !brand.hideCodtrackedBranding ? (
          <footer className="border-t border-border px-4 py-2 text-center text-[10.5px] text-text-secondary sm:px-6">
            Powered by CODTracked
          </footer>
        ) : null}
      </div>
    </div>
  );
}
