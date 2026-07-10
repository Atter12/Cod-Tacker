"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Store } from "lucide-react";
import { setActiveStore } from "@/app/actions/stores";
import { routes } from "@/config/routes";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils/cn";

export interface Tenant {
  id: string;
  name: string;
  type: "agency" | "store";
  agencySlug: string;
  storeSlug: string;
}

export function TenantSwitcher({
  tenants,
  currentTenantId,
  agencySlug,
  agencyName,
  showAgencyConsole = false,
}: {
  tenants: Tenant[];
  currentTenantId?: string;
  agencySlug?: string;
  agencyName?: string;
  showAgencyConsole?: boolean;
}) {
  const router = useRouter();
  const current = tenants.find((tenant) => tenant.id === currentTenantId) ?? tenants[0];
  const consoleHref = agencySlug ? routes.agency.stores(agencySlug) : null;

  async function select(tenant: Tenant) {
    if (tenant.id === current?.id) return;
    const result = await setActiveStore(tenant.agencySlug, tenant.storeSlug);
    if (result.error) return;
    router.push(routes.store.dashboard(tenant.agencySlug, tenant.storeSlug));
  }

  return (
    <Dropdown
      className="min-w-56"
      trigger={
        <span
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-text-primary",
            "transition-colors hover:bg-muted",
          )}
        >
          <Store className="size-4 shrink-0 text-text-secondary" aria-hidden />
          <span className="hidden max-w-40 truncate md:inline">{current?.name ?? "Seleccionar tienda"}</span>
          <span className="sr-only md:hidden">Cambiar tienda</span>
          <ChevronDown className="size-3.5 shrink-0 text-text-secondary" aria-hidden />
        </span>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Cambiar tienda</p>
      </div>
      {tenants.map((tenant) => {
        const active = tenant.id === current?.id;
        return (
          <DropdownItem key={tenant.id} onClick={() => void select(tenant)}>
            <span className="flex w-full items-center justify-between gap-3">
              <span className={cn("truncate", active && "font-semibold text-brand-primary")}>{tenant.name}</span>
              <span className="shrink-0 text-xs text-text-secondary">Tienda</span>
            </span>
          </DropdownItem>
        );
      })}
      {showAgencyConsole && consoleHref ? (
        <div className="mt-1 border-t border-border pt-1">
          <Link
            href={consoleHref}
            role="menuitem"
            className="flex items-center gap-2 rounded px-3 py-2 text-sm text-text-primary transition-colors hover:bg-muted"
          >
            <Building2 className="size-4 text-brand-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block font-medium">Consola de agencia</span>
              {agencyName ? <span className="block truncate text-xs text-text-secondary">{agencyName}</span> : null}
            </span>
          </Link>
        </div>
      ) : null}
    </Dropdown>
  );
}
