"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { AppSidebar } from "./AppSidebar";
import type { Role } from "@/config/permissions";

export function MobileNavigation({
  agencySlug,
  storeSlug,
  scope = "store",
  roles = [],
  returnToStore,
  activeAlertCount = 0,
}: {
  agencySlug: string;
  storeSlug?: string;
  scope?: "store" | "agency" | "admin";
  roles?: readonly Role[];
  returnToStore?: { href: string; storeName: string } | null;
  activeAlertCount?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        className="grid size-9 place-items-center rounded-md hover:bg-muted"
        aria-label="Abrir navegación"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </button>
      <Drawer open={open} onOpenChange={setOpen} title="CODTracked">
        <AppSidebar
          agencySlug={agencySlug}
          storeSlug={storeSlug}
          scope={scope}
          roles={roles}
          returnToStore={returnToStore}
          activeAlertCount={activeAlertCount}
          mobile
        />
      </Drawer>
    </div>
  );
}
