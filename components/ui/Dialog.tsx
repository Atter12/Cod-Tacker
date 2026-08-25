"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Applied to the scrollable body under the title. */
  bodyClassName?: string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar diálogo"
        onClick={() => onOpenChange(false)}
      />
      <section
        className={cn(
          "relative z-10 flex w-full max-w-lg max-h-[min(92vh,960px)] flex-col overflow-hidden rounded-lg bg-surface-elevated shadow-xl",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <button aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
