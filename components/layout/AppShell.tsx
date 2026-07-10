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
  storeReturn,
  agencyConsole,
  tenantSwitcher,
  user,
  roles = [],
  returnToStore,
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
}) {
  const scope = storeSlug ? "store" : "agency";
  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar
        agencySlug={agencySlug}
        storeSlug={storeSlug}
        scope={scope}
        roles={roles}
        returnToStore={returnToStore}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border bg-surface-elevated px-3 lg:hidden">
          <MobileNavigation
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            scope={scope}
            roles={roles}
            returnToStore={returnToStore}
          />
          <span className="ml-2 min-w-0 truncate text-sm font-semibold">
            {scope === "agency" ? "Consola de agencia" : "CODTracked"}
          </span>
        </div>
        <AppTopbar
          title={title}
          breadcrumbs={breadcrumbs}
          storeReturn={storeReturn}
          agencyConsole={agencyConsole}
          tenantSwitcher={tenantSwitcher}
          user={user}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
