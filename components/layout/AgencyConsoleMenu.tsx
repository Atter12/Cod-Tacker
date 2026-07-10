"use client";

import Link from "next/link";
import { Building2, ChevronDown, CreditCard, KeyRound, Palette, Store, Users } from "lucide-react";
import { agencyNavigation } from "@/config/navigation";
import type { Role } from "@/config/permissions";
import { routes } from "@/config/routes";
import { filterNavigationByPermission } from "@/lib/permissions/filter-navigation";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils/cn";

const itemMeta: Record<
  string,
  { icon: typeof Store; description: string; href: (agencySlug: string) => string }
> = {
  "/stores": {
    icon: Store,
    description: "Crear y administrar tiendas",
    href: routes.agency.stores,
  },
  "/team": {
    icon: Users,
    description: "Invitar y gestionar el equipo",
    href: routes.agency.team,
  },
  "/branding": {
    icon: Palette,
    description: "Personalizar la marca",
    href: routes.agency.branding,
  },
  "/billing": {
    icon: CreditCard,
    description: "Planes y facturación",
    href: routes.agency.billing,
  },
  "/api-keys": {
    icon: KeyRound,
    description: "Claves e integraciones API",
    href: routes.agency.apiKeys,
  },
};

export function AgencyConsoleMenu({
  agencySlug,
  agencyName,
  roles = [],
}: {
  agencySlug: string;
  agencyName: string;
  roles?: readonly Role[];
}) {
  const items = filterNavigationByPermission(agencyNavigation, roles).filter((item) => itemMeta[item.href]);
  if (items.length === 0) return null;

  return (
    <Dropdown
      className="min-w-64 p-1.5"
      trigger={
        <span
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-text-primary",
            "transition-colors hover:bg-muted",
          )}
        >
          <Building2 className="size-4 shrink-0 text-brand-primary" aria-hidden />
          <span className="hidden max-w-36 truncate sm:inline">{agencyName}</span>
          <span className="sr-only sm:hidden">Agencia</span>
          <ChevronDown className="size-3.5 shrink-0 text-text-secondary" aria-hidden />
        </span>
      }
    >
      <div className="border-b border-border px-3 pb-2.5 pt-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Consola de agencia</p>
        <p className="truncate text-sm font-semibold text-text-primary">{agencyName}</p>
      </div>
      <div className="mt-1 space-y-0.5">
        {items.map((item) => {
          const meta = itemMeta[item.href];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <Link
              key={item.href}
              href={meta.href(agencySlug)}
              role="menuitem"
              className="flex items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-brand-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">{item.label}</span>
                <span className="block text-xs text-text-secondary">{meta.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </Dropdown>
  );
}
