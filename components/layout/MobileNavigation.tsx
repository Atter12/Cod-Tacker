"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { AppSidebar } from "./AppSidebar";
export function MobileNavigation({ agencySlug, storeSlug }: { agencySlug: string; storeSlug?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="lg:hidden"><button className="grid size-9 place-items-center rounded-md hover:bg-muted" aria-label="Abrir navegación" onClick={() => setOpen(true)}><Menu className="size-5" /></button><Drawer open={open} onOpenChange={setOpen} title="CODTracked"><AppSidebar agencySlug={agencySlug} storeSlug={storeSlug} mobile /></Drawer></div>;
}
