"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  Boxes,
  Cable,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  Palette,
  Route,
  Settings,
  ShoppingCart,
  Store,
  Target,
  Truck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { adminNavigation, agencyNavigation, storeNavigation } from "@/config/navigation";
import type { Role } from "@/config/permissions";
import { routes } from "@/config/routes";
import { filterNavigationByPermission } from "@/lib/permissions/filter-navigation";
import {
  brandInitialLetter,
  type AgencyBrandTheme,
} from "@/lib/branding/theme";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

const SIDEBAR_KEY = "codtracked.sidebar.collapsed";
const SIDEBAR_EVENT = "codtracked-sidebar";

function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_EVENT, onStoreChange);
  };
}

function getSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function setSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

const PRIMARY_STORE_LABELS = new Set([
  "Resumen",
  "Pedidos",
  "Atribución",
  "Campañas",
  "Logística",
  "RTO",
  "Conciliación",
  "Automatizaciones",
  "Alertas",
  "Integraciones",
  "Configuración",
]);

const storeIcons: Record<string, LucideIcon> = {
  "": LayoutDashboard,
  "/orders": ShoppingCart,
  "/attribution": Target,
  "/campaigns": Boxes,
  "/logistics": Truck,
  "/rto": Route,
  "/reconciliation": FileText,
  "/automations": Workflow,
  "/alerts": Bell,
  "/whatsapp": MessageCircle,
  "/integrations": Cable,
  "/operations": Activity,
  "/settings": Settings,
};

const agencyIcons: Record<string, LucideIcon> = {
  "/overview": LayoutDashboard,
  "/stores": Store,
  "/team": Users,
  "/branding": Palette,
  "/billing": CreditCard,
  "/api-keys": KeyRound,
};

const storeNavBuilders: Record<string, (agencySlug: string, storeSlug: string) => string> = {
  orders: routes.store.orders,
  attribution: routes.store.attribution,
  campaigns: routes.store.campaigns,
  logistics: routes.store.logistics,
  rto: routes.store.rto,
  reconciliation: routes.store.reconciliation,
  automations: routes.store.automations,
  alerts: routes.store.alerts,
  whatsapp: routes.store.whatsapp,
  integrations: routes.store.integrations,
  operations: routes.store.operations,
  settings: routes.store.settings,
};

function storeHref(agencySlug: string, storeSlug: string, path: string): string {
  if (!path) return routes.store.dashboard(agencySlug, storeSlug);
  const key = path.replace(/^\//, "");
  const builder = storeNavBuilders[key];
  if (builder) return builder(agencySlug, storeSlug);
  return `${routes.store.dashboard(agencySlug, storeSlug).replace(/\/dashboard$/, "")}${path}`;
}

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href.endsWith("/dashboard")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark({
  collapsed,
  brand,
}: {
  collapsed: boolean;
  brand?: AgencyBrandTheme | null;
}) {
  const productName = brand?.productName?.trim() || "CODTracked";
  const logoUrl = brand?.logoUrl?.trim() || null;
  const initial = brandInitialLetter(productName);

  if (collapsed) {
    return (
      <div className="flex h-[76px] items-center justify-center border-b border-border px-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="max-h-8 max-w-8 object-contain" />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-primary">
            {initial}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[76px] items-center gap-2.5 border-b border-border px-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="max-h-9 max-w-[36px] shrink-0 object-contain" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-[13px] font-bold text-brand-primary">
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold leading-tight tracking-tight text-brand-primary">
          {productName}
        </p>
        {!brand?.hideCodtrackedBranding && productName.toLowerCase() !== "codtracked" ? (
          <p className="mt-0.5 truncate text-[10px] text-text-secondary">by CODTracked</p>
        ) : null}
      </div>
    </div>
  );
}

export function AppSidebar({
  agencySlug,
  storeSlug,
  scope = "store",
  mobile = false,
  roles = [],
  returnToStore,
  activeAlertCount = 0,
  brand,
}: {
  agencySlug: string;
  storeSlug?: string;
  scope?: "store" | "agency" | "admin";
  mobile?: boolean;
  roles?: readonly Role[];
  returnToStore?: { href: string; storeName: string } | null;
  activeAlertCount?: number;
  brand?: AgencyBrandTheme | null;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarCollapsed, () => false);
  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);

  const raw = scope === "agency" ? agencyNavigation : scope === "admin" ? adminNavigation : storeNavigation;
  const items = scope === "agency" ? filterNavigationByPermission(raw, roles) : raw;
  const primaryItems =
    scope === "store" ? items.filter((item) => PRIMARY_STORE_LABELS.has(item.label)) : items;
  const secondaryItems =
    scope === "store" ? items.filter((item) => !PRIMARY_STORE_LABELS.has(item.label)) : [];

  const compact = !mobile && collapsed;

  function renderItem(item: (typeof items)[number]) {
    const href =
      scope === "admin"
        ? item.href
        : scope === "agency"
          ? `${routes.agency.stores(agencySlug).replace(/\/stores$/, "")}${item.href}`
          : storeHref(agencySlug, storeSlug ?? "", item.href);
    const Icon =
      scope === "store"
        ? storeIcons[item.href] ?? Store
        : scope === "agency"
          ? agencyIcons[item.href] ?? Store
          : Store;
    const active = isActivePath(pathname, href);
    const showAlertBadge = item.label === "Alertas" && activeAlertCount > 0;
    const link = (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-[41px] items-center gap-3 px-[18px] text-[12.5px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active
            ? "bg-brand-soft font-semibold text-brand-primary"
            : "text-sidebar-foreground hover:bg-muted",
          compact && "justify-center px-0",
        )}
      >
        {active ? (
          <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-brand-primary" aria-hidden />
        ) : null}
        <Icon className={cn("size-[16px] shrink-0", active && "text-brand-primary")} aria-hidden />
        {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
        {!compact && showAlertBadge ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {activeAlertCount > 99 ? "99+" : activeAlertCount}
          </span>
        ) : null}
        {compact && showAlertBadge ? (
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-primary" aria-hidden />
        ) : null}
      </Link>
    );

    if (compact) {
      return (
        <Tooltip key={item.label} content={item.label}>
          {link}
        </Tooltip>
      );
    }
    return <div key={item.label}>{link}</div>;
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border bg-sidebar transition-[width] duration-200",
        mobile ? "flex h-full w-full flex-col" : "hidden lg:flex lg:flex-col",
        !mobile && (compact ? "w-[68px]" : scope === "agency" ? "w-[220px]" : "w-[180px]"),
      )}
    >
      <BrandMark collapsed={compact} brand={brand} />
      <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 overflow-y-auto py-3">
        {primaryItems.map(renderItem)}
        {secondaryItems.length > 0 ? (
          <>
            {!compact ? (
              <p className="px-[18px] pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Más
              </p>
            ) : (
              <div className="mx-3 my-2 border-t border-border" />
            )}
            {secondaryItems.map(renderItem)}
          </>
        ) : null}
      </nav>

      {scope === "agency" && returnToStore ? (
        <div className="border-t border-border p-3">
          <Link
            href={returnToStore.href}
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4 shrink-0 text-brand-primary" aria-hidden />
            {!compact ? (
              <span className="min-w-0">
                <span className="block leading-tight">Volver al dashboard</span>
                <span className="block truncate text-xs font-normal text-text-secondary">
                  {returnToStore.storeName}
                </span>
              </span>
            ) : null}
          </Link>
        </div>
      ) : null}

      {!mobile ? (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md px-3 text-[12.5px] text-text-secondary transition-colors hover:bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact && "justify-center px-0",
            )}
            aria-label={compact ? "Abrir menú" : "Cerrar menú"}
          >
            {compact ? <ArrowRight className="size-4" aria-hidden /> : <ArrowLeft className="size-4" aria-hidden />}
            {!compact ? <span>Cerrar menú</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
