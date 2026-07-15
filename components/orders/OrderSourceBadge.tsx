import { Badge } from "@/components/ui/Badge";
import { hasOrderSource, labelOrderSource } from "@/lib/orders/source-label";
import { cn } from "@/lib/utils/cn";

/** Clear origin chip for order lists/detail; ready for UTM when attribution lands. */
export function OrderSourceBadge({
  sourceName,
  className,
}: {
  sourceName: string | null | undefined;
  className?: string;
}) {
  if (!hasOrderSource(sourceName)) {
    return <span className={cn("text-[12.5px] text-text-secondary", className)}>Sin fuente</span>;
  }

  const label = labelOrderSource(sourceName);
  const isShopify = sourceName!.trim().toLowerCase() === "shopify";

  return (
    <Badge
      className={cn(
        isShopify ? "bg-brand-softer text-brand-primary" : "bg-muted text-text-secondary",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
