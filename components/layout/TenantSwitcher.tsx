"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ChevronDown, Store } from "lucide-react";
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
  scope = "store",
}: {
  tenants: Tenant[];
  currentTenantId?: string;
  agencySlug?: string;
  agencyName?: string;
  showAgencyConsole?: boolean;
  scope?: "store" | "agency";
}) {
  const router = useRouter();
  const current = tenants.find((tenant) => tenant.id === currentTenantId) ?? tenants[0];
  const consoleHref = agencySlug ? routes.agency.overview(agencySlug) : null;
  const inAgency = scope === "agency";

  async function openStore(tenant: Tenant) {
    if (scope === "store" && tenant.id === current?.id) return;
    const result = await setActiveStore(tenant.agencySlug, tenant.storeSlug);
    if (result.error) return;
    router.push(routes.store.dashboard(tenant.agencySlug, tenant.storeSlug));
  }

  return (
    <Dropdown
      className="min-w-60"
      trigger={
        <span
          className={cn(
            "inline-flex h-[38px] min-w-0 items-center gap-2 rounded-[9px] border border-border bg-surface-elevated px-3 text-[12.5px] font-medium text-text-primary",
            "transition-colors hover:bg-muted sm:min-w-[180px]",
          )}
        >
          <Store className="size-4 shrink-0 text-text-secondary" aria-hidden />
          <span className="hidden max-w-[160px] truncate md:inline">
            {inAgency ? "Abrir tienda" : (current?.name ?? "Seleccionar tienda")}
          </span>
          <span className="sr-only md:hidden">{inAgency ? "Abrir tienda" : "Cambiar tienda"}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-text-secondary" aria-hidden />
        </span>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          {inAgency ? "Ir al dashboard de tienda" : "Cambiar tienda"}
        </p>
        {inAgency && current ? (
          <p className="mt-0.5 truncate text-xs text-text-secondary">Última: {current.name}</p>
        ) : null}
      </div>
      {tenants.length === 0 ? (
        <p className="px-3 py-2 text-sm text-text-secondary">No hay tiendas todavía.</p>
      ) : (
        tenants.map((tenant) => {
          const preferred = tenant.id === current?.id;
          return (
            <DropdownItem key={tenant.id} onClick={() => void openStore(tenant)}>
              <span className="flex w-full items-center justify-between gap-3">
                <span className={cn("truncate", preferred && "font-semibold text-brand-primary")}>{tenant.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                  {inAgency ? "Abrir" : "Tienda"}
                  {inAgency ? <ArrowRight className="size-3" aria-hidden /> : null}
                </span>
              </span>
            </DropdownItem>
          );
        })
      )}
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
