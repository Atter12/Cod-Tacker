"use client";

import { useState } from "react";
import { OrdersFiltersForm } from "@/components/orders/OrdersFiltersForm";
import { OrdersSearchBar } from "@/components/orders/OrdersSearchBar";

export function OrdersToolbar({
  initial,
  advancedActive,
}: {
  initial: {
    q?: string;
    payment?: string;
    confirmation?: string;
    city?: string;
    district?: string;
    minAmount?: string;
    maxAmount?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: string;
  };
  advancedActive: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(advancedActive);

  return (
    <div className="space-y-3">
      <OrdersSearchBar
        key={initial.q ?? ""}
        initialQuery={initial.q}
        advancedOpen={advancedOpen}
        advancedActive={advancedActive}
        onToggleAdvanced={() => setAdvancedOpen((open) => !open)}
      />
      {advancedOpen ? <OrdersFiltersForm initial={initial} /> : null}
    </div>
  );
}
