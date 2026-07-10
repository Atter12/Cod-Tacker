import Link from "next/link";
import { BarChart3, Bell, Boxes, Building2, Cable, FileText, Settings, Store } from "lucide-react";
import { adminNavigation, agencyNavigation, storeNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

const icons = [BarChart3, FileText, Boxes, BarChart3, Store, Boxes, FileText, Settings, Bell, Cable, Settings];
export function AppSidebar({ agencySlug, storeSlug, scope = "store", mobile = false }: { agencySlug: string; storeSlug?: string; scope?: "store" | "agency" | "admin"; mobile?: boolean }) {
  const items = scope === "agency" ? agencyNavigation : scope === "admin" ? adminNavigation : storeNavigation;
  const base = storeSlug ? routes.store.dashboard(agencySlug, storeSlug) : routes.agency.stores(agencySlug).replace(/\/stores$/, "");
  return <aside className={cn("w-64 shrink-0 border-r border-border bg-sidebar", mobile ? "flex h-full flex-col" : "hidden lg:flex lg:flex-col")}><div className="flex h-16 items-center gap-2 border-b border-border px-5 font-semibold"><div className="grid size-7 place-items-center rounded bg-brand-primary text-white"><BarChart3 className="size-4" /></div>CODTracked</div><nav aria-label="Navegación principal" className="flex-1 space-y-1 p-3">{items.map((item, index) => { const Icon = icons[index] ?? Building2; const href = scope === "admin" ? item.href : `${base}${item.href}`; return <Link key={item.label} href={href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-muted hover:text-text-primary")}><Icon className="size-4" />{item.label}</Link>; })}</nav></aside>;
}
