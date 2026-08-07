"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
export function Dropdown({ trigger, children, className, align = "right" }: { trigger: ReactNode; children: ReactNode; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function onPointerDown(event: MouseEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false); } document.addEventListener("mousedown", onPointerDown); return () => document.removeEventListener("mousedown", onPointerDown); }, []);
  return <div ref={ref} className="relative inline-block"><button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{trigger}</button>{open && <div role="menu" className={cn("absolute z-50 mt-2 min-w-44 rounded-md border border-border bg-surface-elevated p-1 shadow-lg", align === "left" ? "left-0" : "right-0", className)} onClick={() => setOpen(false)}>{children}</div>}</div>;
}
export function DropdownItem({ children, onClick }: { children: ReactNode; onClick?: () => void }) { return <button role="menuitem" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={onClick}>{children}</button>; }
