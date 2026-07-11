"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CreateStoreEligibility } from "@/services/store-selector.service";

export function CreateStoreCard({
  eligibility,
  onOpen,
}: {
  eligibility: CreateStoreEligibility;
  onOpen: () => void;
}) {
  if (!eligibility.visible) return null;

  const atLimit = eligibility.reason === "at_limit";
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className="grid size-[42px] shrink-0 place-items-center rounded-full bg-cyan-500 text-slate-950 sm:size-11"
          aria-hidden
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug text-[#F8FAFC] sm:text-[16px]">
              Nueva tienda
            </p>
            <ArrowRight
              className={cn(
                "mt-0.5 size-4 shrink-0 transition-colors",
                atLimit ? "text-[#64748B]" : "text-[#64748B] group-hover:text-[#22D3EE]",
              )}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-[12px] leading-snug text-[#94A3B8] sm:text-[12.5px]">
            {atLimit ? "Tu plan no permite más tiendas." : "Conecta una tienda adicional"}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-medium sm:text-[11px]",
            atLimit
              ? "border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.1)] text-[#FCA5A5]"
              : "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)] text-[#67E8F9]",
          )}
        >
          {atLimit ? "Límite alcanzado" : "Disponible"}
        </span>
        {atLimit && eligibility.billingHref ? (
          <span className="text-[11px] text-[#22D3EE]">Ver planes</span>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "group flex min-h-[108px] w-full flex-col rounded-[16px] border border-[rgba(76,139,170,0.22)] bg-[#0A1729] p-[18px] text-left transition-colors duration-150 sm:min-h-[112px] sm:p-5",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]",
    !atLimit && "hover:border-[rgba(34,211,238,0.4)] hover:bg-[#0D1B30]",
  );

  if (atLimit && eligibility.billingHref) {
    return (
      <Link href={eligibility.billingHref} className={className}>
        {content}
      </Link>
    );
  }

  if (atLimit) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={className}>
      {content}
    </button>
  );
}
