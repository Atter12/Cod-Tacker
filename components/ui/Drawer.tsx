"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  className,
  hideHeader = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar panel"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex h-dvh w-full max-w-[min(100%,280px)] flex-col overflow-hidden bg-surface-elevated shadow-xl",
          className,
        )}
      >
        {!hideHeader ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Cerrar"
              className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </button>
          </div>
        ) : (
          <div className="absolute right-2 top-2 z-10">
            <button
              type="button"
              aria-label="Cerrar"
              className="grid size-9 place-items-center rounded-md bg-surface-elevated/90 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </div>
  );
}
