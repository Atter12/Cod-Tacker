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
  eyebrow,
  headerMeta,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Applied to the scrollable body under the title. */
  bodyClassName?: string;
  /** Small label above the title (wizard modals). */
  eyebrow?: string;
  /** Right side of header row (e.g. order meta). Close button follows. */
  headerMeta?: ReactNode;
  /** Sticky footer below scrollable body. */
  footer?: ReactNode;
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
        <div
          className={cn(
            "flex shrink-0 border-b border-border px-5 py-4 sm:px-6",
            eyebrow ? "flex-col gap-2" : "items-center justify-between gap-3",
          )}
        >
          {eyebrow ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {eyebrow}
                </p>
                <div className="flex items-center gap-3">
                  {headerMeta}
                  <button aria-label="Cerrar" onClick={() => onOpenChange(false)}>
                    <X className="size-5 text-text-secondary" />
                  </button>
                </div>
              </div>
              <h2 className="text-xl font-semibold leading-snug text-text-primary">{title}</h2>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold leading-snug">{title}</h2>
              <div className="flex items-center gap-3">
                {headerMeta}
                <button aria-label="Cerrar" onClick={() => onOpenChange(false)}>
                  <X className="size-5" />
                </button>
              </div>
            </>
          )}
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border bg-surface-elevated">{footer}</div>
        ) : null}
      </section>
    </div>
  );
}
