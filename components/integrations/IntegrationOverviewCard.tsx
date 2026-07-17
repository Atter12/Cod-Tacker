import Link from "next/link";
import { routes } from "@/config/routes";
import { labelProviderKind } from "@/lib/integrations/catalog";
import { labelOverviewStatus } from "@/lib/integrations/overview";
import { cn } from "@/lib/utils/cn";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationHealthBadge } from "./IntegrationHealthBadge";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

export function IntegrationOverviewCard({
  item,
  agencySlug,
  storeSlug,
}: {
  item: IntegrationOverviewItem;
  agencySlug: string;
  storeSlug: string;
}) {
  const href = routes.store.integrationDetail(agencySlug, storeSlug, item.provider);
  const statusLabel = labelOverviewStatus(item.overviewStatus);

  return (
    <Link
      href={href}
      aria-label={`${item.name}. ${statusLabel}. ${item.operationalMessage}`}
      className={cn(
        "flex min-h-[104px] items-start gap-3.5 rounded-[12px] border border-border bg-surface-elevated p-5",
        "shadow-[var(--card-shadow)]",
        "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
        "hover:-translate-y-px hover:border-brand-primary/25 hover:bg-brand-softer/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <IntegrationProviderIcon provider={item.provider} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-snug text-text-primary">
          {item.name}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
          {labelProviderKind(item.kind)}
        </span>
        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-text-secondary">
          {item.operationalMessage}
        </span>
        <span className="mt-2.5 block">
          <IntegrationHealthBadge status={item.overviewStatus} />
        </span>
      </span>
    </Link>
  );
}
