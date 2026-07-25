import Link from "next/link";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

type SettlementItemRef = {
  tracking_number: string | null;
  order_id: string | null;
  order_number: string | null;
  /** Real pedido.order_number when joined — preferred over CSV order_number. */
  linked_order_number?: string | null;
  match_method: string | null;
};

/** Tracking from CSV, or linked order ref when tracking is missing (e.g. manual match). */
export function SettlementItemRefCell({
  agencySlug,
  storeSlug,
  item,
}: {
  agencySlug: string;
  storeSlug: string;
  item: SettlementItemRef;
}) {
  if (item.tracking_number) {
    return <span className="font-mono text-sm">{item.tracking_number}</span>;
  }

  if (item.order_id) {
    const isManual = item.match_method === "manual";
    // Prefer linked pedido number; CSV order_number can be stale/wrong after manual match.
    const label =
      item.linked_order_number?.trim() ||
      (isManual ? null : item.order_number?.trim()) ||
      item.order_id.slice(0, 8);
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Link
          href={routes.store.orderDetail(agencySlug, storeSlug, item.order_id)}
          className={cn(
            "text-sm text-brand-primary underline-offset-2 hover:underline",
            isManual && "italic",
          )}
          title={isManual ? "Pedido vinculado por match manual (subsanado)" : "Pedido vinculado"}
        >
          #{label}
        </Link>
        {isManual ? (
          <span className="text-[11px] italic text-text-secondary">subsanado · manual</span>
        ) : null}
      </span>
    );
  }

  if (item.order_number?.trim()) {
    return <span className="text-sm text-text-secondary">{item.order_number.trim()}</span>;
  }

  return <span className="text-text-secondary">—</span>;
}
