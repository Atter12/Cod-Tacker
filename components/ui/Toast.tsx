"use client";

import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
export function Toast({ message, variant = "info", onDismiss, duration = 4000 }: { message: ReactNode; variant?: "info" | "success" | "danger"; onDismiss: () => void; duration?: number }) {
  useEffect(() => { const timeout = window.setTimeout(onDismiss, duration); return () => window.clearTimeout(timeout); }, [duration, onDismiss]);
  return <div role="status" className={cn("fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-4 rounded-md px-4 py-3 text-sm text-white shadow-lg", variant === "success" ? "bg-success" : variant === "danger" ? "bg-danger" : "bg-brand-secondary")}><span>{message}</span><button aria-label="Cerrar notificación" onClick={onDismiss}><X className="size-4" /></button></div>;
}
