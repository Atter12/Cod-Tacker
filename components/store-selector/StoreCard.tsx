"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StoreHealth, StoreSelectorCard } from "@/services/store-selector.service";

const healthLabel: Record<StoreHealth, string> = {
  healthy: "Activa",
  available: "Disponible",
  review: "Requiere revisión",
};

const healthClass: Record<StoreHealth, string> = {
  healthy: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.1)] text-[#86EFAC]",
  available: "border-[rgba(76,139,170,0.35)] bg-[rgba(76,139,170,0.12)] text-[#94A3B8]",
  review: "border-[rgba(251,146,60,0.4)] bg-[rgba(251,146,60,0.12)] text-[#FDBA74]",
};

export function StoreCard({
  store,
  pending,
  disabled,
  onSelect,
}: {
  store: StoreSelectorCard;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const initial = store.name.trim().slice(0, 1).toUpperCase() || "T";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-current={store.isLastUsed ? "true" : undefined}
      className={cn(
        "group flex min-h-[112px] w-full flex-col rounded-[16px] border bg-[#0A1729] p-5 text-left transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]",
        store.isLastUsed
          ? "border-[rgba(251,146,60,0.45)] shadow-[0_0_0_1px_rgba(251,146,60,0.12)]"
          : "border-[rgba(76,139,170,0.2)] hover:border-[rgba(34,211,238,0.4)] hover:bg-[#0D1B30]",
        disabled && !pending && "cursor-not-allowed opacity-60",
        pending && "border-[rgba(34,211,238,0.5)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[#19C7B5]/20 text-sm font-semibold text-[#22D3EE]"
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-semibold text-[#F8FAFC]">{store.name}</p>
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-[#22D3EE]" aria-hidden />
            ) : (
              <ArrowRight className="size-4 shrink-0 text-[#64748B] transition-colors group-hover:text-[#22D3EE]" aria-hidden />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#94A3B8]">
            {store.description}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", healthClass[store.health])}>
          {pending ? "Abriendo…" : healthLabel[store.health]}
        </span>
        {store.isLastUsed ? (
          <span className="rounded-full border border-[rgba(251,146,60,0.4)] bg-[rgba(251,146,60,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#FDBA74]">
            Última utilizada
          </span>
        ) : null}
      </div>
    </button>
  );
}
