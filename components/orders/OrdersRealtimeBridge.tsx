"use client";

import {
  useStoreOrdersRealtime,
  type OrdersRealtimeStatus,
} from "@/lib/realtime/use-store-orders-realtime";
import { cn } from "@/lib/utils/cn";

function labelFor(status: OrdersRealtimeStatus): string {
  switch (status) {
    case "live":
      return "En vivo";
    case "connecting":
      return "Conectando…";
    case "error":
      return "Sin tiempo real";
    default:
      return "Pausa";
  }
}

/**
 * Invisible bridge + compact status chip. Keeps order list/detail RSCs fresh
 * via Supabase Realtime without client-side list state.
 */
export function OrdersRealtimeBridge({
  storeId,
  orderId,
  className,
}: {
  storeId: string;
  orderId?: string;
  className?: string;
}) {
  const status = useStoreOrdersRealtime(storeId, { orderId });

  return (
    <span
      role="status"
      title="Actualización en tiempo real de pedidos (Supabase Realtime)"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "live" && "border-success/40 bg-success/10 text-success",
        status === "connecting" && "border-border bg-muted text-text-secondary",
        status === "error" && "border-danger/40 bg-danger/10 text-danger",
        status === "idle" && "border-border bg-muted text-text-secondary",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "live" && "bg-success animate-pulse",
          status === "connecting" && "bg-text-secondary",
          status === "error" && "bg-danger",
          status === "idle" && "bg-text-secondary",
        )}
      />
      {labelFor(status)}
    </span>
  );
}
