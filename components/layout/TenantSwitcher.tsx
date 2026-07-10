"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { setActiveStore } from "@/app/actions/stores";
import { routes } from "@/config/routes";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";

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
}: {
  tenants: Tenant[];
  currentTenantId?: string;
}) {
  const router = useRouter();
  const current = tenants.find((tenant) => tenant.id === currentTenantId) ?? tenants[0];

  async function select(tenant: Tenant) {
    if (tenant.id === current?.id) return;
    const result = await setActiveStore(tenant.agencySlug, tenant.storeSlug);
    if (result.error) return;
    router.push(routes.store.dashboard(tenant.agencySlug, tenant.storeSlug));
  }

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 text-sm font-medium">
          {current?.name ?? "Seleccionar tenant"}
          <ChevronDown className="size-4 text-text-secondary" />
        </span>
      }
    >
      {tenants.map((tenant) => (
        <DropdownItem key={tenant.id} onClick={() => void select(tenant)}>
          {tenant.name}
          <span className="ml-2 text-xs text-text-secondary">
            {tenant.type === "agency" ? "Agencia" : "Tienda"}
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
