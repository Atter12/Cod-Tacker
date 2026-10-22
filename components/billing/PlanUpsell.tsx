import Link from "next/link";
import { Sparkles } from "lucide-react";
import { routes } from "@/config/routes";
import { PLAN_SECTION_MIN_PLAN, type PlanSection } from "@/lib/billing/entitlements";
import { PLAN_SECTION_COPY } from "@/lib/billing/plan-catalog";
import { cn } from "@/lib/utils/cn";

/** Small "Growth" pill used next to locked features and nav items. */
export function PlanBadge({ section, className }: { section: PlanSection; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-brand-softer px-1.5 py-0.5 text-[10px] font-semibold text-brand-primary",
        className,
      )}
    >
      {PLAN_SECTION_MIN_PLAN[section]}
    </span>
  );
}

/**
 * Whole-section notice (PlanGate): what the section does, the plan that unlocks
 * it, and a link to Facturación. Calm card, no blocking modal.
 */
export function PlanUpsellCard({
  agencySlug,
  section,
  backHref,
  backLabel = "Volver al resumen",
}: {
  agencySlug: string;
  section: PlanSection;
  backHref?: string;
  backLabel?: string;
}) {
  const copy = PLAN_SECTION_COPY[section];
  const plan = PLAN_SECTION_MIN_PLAN[section];
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-[12px] border border-border bg-surface-elevated p-6 shadow-[var(--card-shadow)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-softer text-brand-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-primary">
            {section === "console" ? "Planes" : `Plan ${plan}`}
          </span>
        </div>
        <h2 className="mt-3 text-[16px] font-semibold text-text-primary">{copy.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{copy.benefit}</p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          {section === "console"
            ? "Tus pedidos de Shopify ya se están sincronizando y aparecerán aquí con el plan activo."
            : `Disponible desde el plan ${plan}.`}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={routes.agency.billing(agencySlug)}
            className="inline-flex h-9 items-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {section === "console" ? "Ver planes" : `Ver plan ${plan}`}
          </Link>
          {backHref ? (
            <Link href={backHref} className="text-sm font-medium text-text-secondary hover:text-text-primary">
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One-line hint inside an unlocked page for a feature of a higher plan. */
export function PlanUpsellInline({
  agencySlug,
  section,
  className,
}: {
  agencySlug: string;
  section: PlanSection;
  className?: string;
}) {
  const copy = PLAN_SECTION_COPY[section];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-[12.5px] text-text-secondary",
        className,
      )}
    >
      <PlanBadge section={section} />
      <span className="min-w-0 flex-1">{copy.benefit}</span>
      <Link
        href={routes.agency.billing(agencySlug)}
        className="shrink-0 font-medium text-brand-primary hover:underline"
      >
        Ver planes
      </Link>
    </div>
  );
}
