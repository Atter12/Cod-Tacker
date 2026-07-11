import Link from "next/link";
import { Package } from "lucide-react";
import { OrderStatusBadge } from "@/components/ui/StatusBadge";
import { routes } from "@/config/routes";
import { formatCurrency } from "@/lib/formatting/currency";
import type { DashboardRecentOrder } from "@/types/dashboard";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function deliveryCell(order: DashboardRecentOrder): string {
  if (order.deliveredAt) return formatDate(order.deliveredAt);
  if (order.deliveryStatus) return order.deliveryStatus.replaceAll("_", " ");
  return "Pendiente";
}

function customerCell(order: DashboardRecentOrder): string {
  return order.customerName || order.customerEmail || "—";
}

export function RecentOrdersCard({
  orders,
  agencySlug,
  storeSlug,
}: {
  orders: DashboardRecentOrder[];
  agencySlug: string;
  storeSlug: string;
}) {
  return (
    <article className="rounded-[11px] border border-border bg-surface-elevated shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <h2 className="text-[13px] font-semibold text-text-primary">Pedidos recientes</h2>
        <Link
          href={routes.store.orders(agencySlug, storeSlug)}
          className="inline-flex h-9 items-center justify-center rounded-md border border-brand-primary px-3 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver todos los pedidos
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              {["Pedido", "Fecha", "Cliente", "Estado", "Entrega", "Total", "Fuente"].map((header) => (
                <th
                  key={header}
                  className="px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wide text-text-secondary sm:px-5"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 sm:px-5">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-brand-softer text-brand-primary">
                      <Package className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-[13px] font-medium text-text-primary">
                      No hay pedidos en este período.
                    </p>
                    <p className="mt-1 text-[12px] text-text-secondary">
                      Los pedidos aparecerán aquí cuando haya actividad.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/80 transition-colors last:border-b-0 hover:bg-muted/70"
                >
                  <td className="px-4 py-3 text-[12.5px] font-medium text-text-primary sm:px-5">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-text-secondary sm:px-5">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-[12.5px] text-text-primary sm:px-5">
                    {customerCell(order)}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-[12.5px] capitalize text-text-secondary sm:px-5">
                    {deliveryCell(order)}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] font-medium tabular-nums text-text-primary sm:px-5">
                    {formatCurrency(order.totalAmount, order.currencyCode)}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-text-secondary sm:px-5">
                    {order.sourceName ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
