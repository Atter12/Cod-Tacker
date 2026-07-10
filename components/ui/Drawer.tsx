"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
export function Drawer({ open, onOpenChange, title, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; className?: string }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}><button className="absolute inset-0 bg-black/50" aria-label="Cerrar panel" onClick={() => onOpenChange(false)} /><aside className={cn("absolute inset-y-0 left-0 w-full max-w-sm bg-surface-elevated p-5 shadow-xl", className)}><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button aria-label="Cerrar" onClick={() => onOpenChange(false)}><X className="size-5" /></button></div>{children}</aside></div>;
}
