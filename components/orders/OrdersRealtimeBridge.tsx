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
    case "polling":
      return "Auto 30s";
    case "connecting":
      return "Conectando…";
    case "error":
      return "Sin tiempo real";
    default:
      return "Pausa";
  }
}

function titleFor(status: OrdersRealtimeStatus): string {
  switch (status) {
    case "live":
      return "Pedidos se refrescan al instante vía Supabase Realtime.";
    case "polling":
      return "Realtime no conectó; la lista se refresca cada 30s mientras la pestaña está visible. Los pedidos nuevos aún necesitan webhook o Sincronizar ahora.";
    case "connecting":
      return "Conectando a Supabase Realtime…";
    case "error":
      return "No hay sesión o falló Realtime. Usa Sincronizar ahora e Intenta recargar.";
    default:
      return "Actualización en pausa.";
  }
}

/**
 * Keeps order list/detail RSCs fresh via Realtime, with a 30s refresh fallback.
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
      title={titleFor(status)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "live" && "border-success/40 bg-success/10 text-success",
        status === "polling" && "border-warning/40 bg-warning/10 text-warning",
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
          status === "polling" && "bg-warning animate-pulse",
          status === "connecting" && "bg-text-secondary",
          status === "error" && "bg-danger",
          status === "idle" && "bg-text-secondary",
        )}
      />
      {labelFor(status)}
    </span>
  );
}
