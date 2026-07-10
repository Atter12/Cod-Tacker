"use client";

import { ChevronDown } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
export interface Tenant { id: string; name: string; type: "agency" | "store"; }
export function TenantSwitcher({ tenants, currentTenantId, onSelect }: { tenants: Tenant[]; currentTenantId?: string; onSelect?: (tenant: Tenant) => void }) {
  const current = tenants.find((tenant) => tenant.id === currentTenantId) ?? tenants[0];
  return <Dropdown trigger={<span className="flex items-center gap-2 text-sm font-medium">{current?.name ?? "Seleccionar tenant"}<ChevronDown className="size-4 text-text-secondary" /></span>}>{tenants.map((tenant) => <DropdownItem key={tenant.id} onClick={() => onSelect?.(tenant)}>{tenant.name}<span className="ml-2 text-xs text-text-secondary">{tenant.type === "agency" ? "Agencia" : "Tienda"}</span></DropdownItem>)}</Dropdown>;
}
