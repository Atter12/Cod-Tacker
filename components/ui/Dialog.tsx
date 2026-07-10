"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
export function Dialog({ open, onOpenChange, title, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; className?: string }) {
  useEffect(() => { function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onOpenChange(false); } if (open) window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}><button className="absolute inset-0 bg-black/50" aria-label="Cerrar diálogo" onClick={() => onOpenChange(false)} /><section className={cn("relative z-10 w-full max-w-lg rounded-lg bg-surface-elevated p-6 shadow-xl", className)}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Cerrar" onClick={() => onOpenChange(false)}><X className="size-5" /></button></div>{children}</section></div>;
}
