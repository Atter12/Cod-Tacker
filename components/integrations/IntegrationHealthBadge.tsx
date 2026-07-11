import { cn } from "@/lib/utils/cn";
import { labelOverviewStatus } from "@/lib/integrations/overview";
import type { IntegrationOverviewStatus } from "@/types/integrations";

const STATUS_STYLES: Record<IntegrationOverviewStatus, string> = {
  active: "bg-success/10 text-success",
  review: "bg-warning/10 text-warning",
  pending: "bg-brand-primary/10 text-brand-primary",
  disconnected: "bg-muted text-text-secondary",
  revoked: "bg-danger/10 text-danger",
};

export function IntegrationHealthBadge({
  status,
  className,
}: {
  status: IntegrationOverviewStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[21px] items-center rounded-full px-2.5 text-[10px] font-medium leading-none",
        STATUS_STYLES[status],
        className,
      )}
    >
      {labelOverviewStatus(status)}
    </span>
  );
}
