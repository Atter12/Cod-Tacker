import Link from "next/link";
import { BarChart3, Bell, Boxes, Building2, Cable, FileText, Settings, Store } from "lucide-react";
import { adminNavigation, agencyNavigation, storeNavigation } from "@/config/navigation";
import type { Role } from "@/config/permissions";
import { routes } from "@/config/routes";
import { filterNavigationByPermission } from "@/lib/permissions/filter-navigation";
import { cn } from "@/lib/utils/cn";

const icons = [BarChart3, FileText, Boxes, BarChart3, Store, Boxes, FileText, Settings, Bell, Cable, Settings];

function storeHref(agencySlug: string, storeSlug: string, path: string): string {
  if (!path) return routes.store.dashboard(agencySlug, storeSlug);
  const key = path.replace(/^\//, "") as keyof typeof routes.store;
  const builder = routes.store[key];
  if (typeof builder === "function") return builder(agencySlug, storeSlug);
  return `${routes.store.dashboard(agencySlug, storeSlug).replace(/\/dashboard$/, "")}${path}`;
}

export function AppSidebar({
  agencySlug,
  storeSlug,
  scope = "store",
  mobile = false,
  roles = [],
}: {
  agencySlug: string;
  storeSlug?: string;
  scope?: "store" | "agency" | "admin";
  mobile?: boolean;
  roles?: readonly Role[];
}) {
  const raw = scope === "agency" ? agencyNavigation : scope === "admin" ? adminNavigation : storeNavigation;
  const items = scope === "agency" ? filterNavigationByPermission(raw, roles) : raw;

  return (
    <aside
      className={cn(
        "w-64 shrink-0 border-r border-border bg-sidebar",
        mobile ? "flex h-full flex-col" : "hidden lg:flex lg:flex-col",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border px-5 font-semibold">
        <div className="grid size-7 place-items-center rounded bg-brand-primary text-white">
          <BarChart3 className="size-4" />
        </div>
        CODTracked
      </div>
      <nav aria-label="Navegación principal" className="flex-1 space-y-1 p-3">
        {items.map((item, index) => {
          const Icon = icons[index] ?? Building2;
          const href =
            scope === "admin"
              ? item.href
              : scope === "agency"
                ? `${routes.agency.stores(agencySlug).replace(/\/stores$/, "")}${item.href}`
                : storeHref(agencySlug, storeSlug ?? "", item.href);
          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-muted hover:text-text-primary",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
