import Link from "next/link";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { labelOverviewStatus } from "@/lib/integrations/overview";
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
        "flex min-h-[95px] items-start gap-3.5 rounded-[10px] border border-border bg-surface-elevated p-4",
        "shadow-[0_3px_10px_rgba(36,27,20,0.05)] dark:shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
        "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
        "hover:-translate-y-px hover:border-brand-primary/25 hover:bg-brand-softer/60 hover:shadow-[0_4px_14px_rgba(36,27,20,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:shadow-[0_2px_6px_rgba(36,27,20,0.04)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <IntegrationProviderIcon provider={item.provider} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-snug text-text-primary">
          {item.name}
        </span>
        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-text-secondary">
          {item.operationalMessage}
        </span>
        <span className="mt-2 block">
          <IntegrationHealthBadge status={item.overviewStatus} />
        </span>
      </span>
    </Link>
  );
}
