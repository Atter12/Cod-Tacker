import { type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { MobileNavigation } from "./MobileNavigation";
export function AppShell({ children, agencySlug, storeSlug, title, breadcrumbs, tenantSwitcher, user }: { children: ReactNode; agencySlug: string; storeSlug?: string; title: string; breadcrumbs?: string[]; tenantSwitcher?: ReactNode; user?: { name?: string; email?: string; onLogout?: () => void } }) {
  return <div className="flex min-h-screen bg-surface"><AppSidebar agencySlug={agencySlug} storeSlug={storeSlug} /><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-center border-b border-border bg-surface-elevated px-3 lg:hidden"><MobileNavigation agencySlug={agencySlug} storeSlug={storeSlug} /><span className="ml-2 text-sm font-semibold">CODTracked</span></div><AppTopbar title={title} breadcrumbs={breadcrumbs} tenantSwitcher={tenantSwitcher} user={user} /><main className="flex-1 p-4 sm:p-6">{children}</main></div></div>;
}
