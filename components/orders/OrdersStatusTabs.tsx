"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ORDER_LIST_VIEWS } from "@/lib/orders/list-view";
import type { OrderListView } from "@/types/orders";
import { cn } from "@/lib/utils/cn";

export function OrdersStatusTabs({ activeView }: { activeView: OrderListView }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(view: OrderListView): string {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "all") params.delete("view");
    else params.set("view", view);
    params.delete("page");
    params.delete("status");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav
      aria-label="Filtrar por estado"
      className="-mx-1 flex gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ORDER_LIST_VIEWS.map((tab) => {
        const active = tab.value === activeView;
        return (
          <Link
            key={tab.value}
            href={hrefFor(tab.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-[33px] shrink-0 items-center rounded-[7px] border px-5 text-[12px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-brand-primary bg-brand-soft text-brand-primary shadow-[0_1px_4px_rgba(244,122,50,0.18)]"
                : "border-border bg-surface-elevated text-text-primary hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
