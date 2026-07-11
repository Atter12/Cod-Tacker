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
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgba(34,211,238,0.15)] text-[#22D3EE]"
          aria-hidden
        >
          <Plus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-[#F8FAFC]">Nueva tienda</p>
            <ArrowRight className="size-4 shrink-0 text-[#64748B]" aria-hidden />
          </div>
          <p className="mt-1 text-[12.5px] text-[#94A3B8]">
            {atLimit ? "Tu plan no permite más tiendas." : "Conecta una tienda adicional"}
          </p>
        </div>
      </div>
      <div className="mt-auto pt-3">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            atLimit
              ? "border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.1)] text-[#FCA5A5]"
              : "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)] text-[#67E8F9]",
          )}
        >
          {atLimit ? "Límite alcanzado" : "Disponible"}
        </span>
        {atLimit && eligibility.billingHref ? (
          <span className="ml-2 text-[11px] text-[#22D3EE]">Ver planes</span>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "flex min-h-[112px] w-full flex-col rounded-[16px] border border-dashed border-[rgba(76,139,170,0.35)] bg-[#0A1729]/70 p-5 text-left transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]",
    !atLimit && "hover:border-[rgba(34,211,238,0.45)] hover:bg-[#0D1B30]",
    atLimit && "opacity-90",
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
