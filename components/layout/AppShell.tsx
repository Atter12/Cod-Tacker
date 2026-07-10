import { type ReactNode } from "react";
import type { Role } from "@/config/permissions";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar, type BreadcrumbItem } from "./AppTopbar";
import { MobileNavigation } from "./MobileNavigation";

export function AppShell({
  children,
  agencySlug,
  storeSlug,
  title,
  breadcrumbs,
  agencyConsole,
  tenantSwitcher,
  user,
  roles = [],
}: {
  children: ReactNode;
  agencySlug: string;
  storeSlug?: string;
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  agencyConsole?: ReactNode;
  tenantSwitcher?: ReactNode;
  user?: { name?: string; email?: string };
  roles?: readonly Role[];
}) {
  const scope = storeSlug ? "store" : "agency";
  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar agencySlug={agencySlug} storeSlug={storeSlug} scope={scope} roles={roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border bg-surface-elevated px-3 lg:hidden">
          <MobileNavigation agencySlug={agencySlug} storeSlug={storeSlug} scope={scope} roles={roles} />
          <span className="ml-2 text-sm font-semibold">CODTracked</span>
        </div>
        <AppTopbar
          title={title}
          breadcrumbs={breadcrumbs}
          agencyConsole={agencyConsole}
          tenantSwitcher={tenantSwitcher}
          user={user}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
