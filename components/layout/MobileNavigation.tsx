"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import type { AgencyBrandTheme } from "@/lib/branding/theme";
import type { Role } from "@/config/permissions";
import { AppSidebar } from "./AppSidebar";

export function MobileNavigation({
  agencySlug,
  storeSlug,
  scope = "store",
  roles = [],
  returnToStore,
  activeAlertCount = 0,
  brand,
}: {
  agencySlug: string;
  storeSlug?: string;
  scope?: "store" | "agency" | "admin";
  roles?: readonly Role[];
  returnToStore?: { href: string; storeName: string } | null;
  activeAlertCount?: number;
  brand?: AgencyBrandTheme | null;
}) {
  const [open, setOpen] = useState(false);
  const drawerTitle = brand?.productName?.trim() || "CODTracked";

  return (
    <div className="shrink-0 lg:hidden">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir navegación"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </button>
      <Drawer open={open} onOpenChange={setOpen} title={drawerTitle}>
        <div id="mobile-nav-drawer" className="flex h-full min-h-0 flex-col">
          <AppSidebar
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            scope={scope}
            roles={roles}
            returnToStore={returnToStore}
            activeAlertCount={activeAlertCount}
            brand={brand}
            mobile
            onNavigate={() => setOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  );
}
