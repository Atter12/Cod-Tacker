import Link from "next/link";
import { Package } from "lucide-react";
import { OrderSourceBadge } from "@/components/orders/OrderSourceBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { routes } from "@/config/routes";
import { formatCurrency } from "@/lib/formatting/currency";
import { labelOrderCustomer } from "@/lib/orders/customer-label";
import { labelOrderStatus } from "@/lib/orders/labels";
import type { OrderListRow } from "@/types/orders";
import { cn } from "@/lib/utils/cn";

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(iso));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDeliveryLabel(order: OrderListRow): string {
  if (order.order_status === "returned" || order.order_status === "return_in_transit") {
    return order.returned_at ? formatShortDate(order.returned_at) : "Devuelto";
  }
  const raw = order.delivered_at;
  if (!raw) return "Pendiente";

  const delivered = startOfLocalDay(new Date(raw));
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round((delivered.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Hoy";
  if (diffDays === -1) return "Ayer";
  if (diffDays === 1) return "Mañana";
  return formatShortDate(raw);
}

function ContactCell({
  value,
  emptyLabel,
}: {
  value: string | null | undefined;
  emptyLabel: string;
}) {
  const trimmed = value?.trim();
  if (trimmed) {
    return <span className="text-text-secondary">{trimmed}</span>;
  }
  return <span className="italic text-text-secondary">{emptyLabel}</span>;
}

function compactStatusLabel(status: string): string {
  const label = labelOrderStatus(status);
  if (status === "pending_confirmation") return "Pendiente";
  if (status === "return_in_transit") return "Devuelto";
  if (status === "ready_to_ship" || status === "shipped" || status === "in_transit" || status === "out_for_delivery") {
    return "Confirmado";
  }
  if (status === "closed") return "Entregado";
  return label;
}

export function OrdersTable({
  orders,
  agencySlug,
  storeSlug,
}: {
  orders: OrderListRow[];
  agencySlug: string;
  storeSlug: string;
}) {
  return (
    <article className="overflow-hidden rounded-[10px] border border-border bg-surface-elevated shadow-[var(--card-shadow)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              {["Pedido", "Fecha", "Cliente", "Email", "Teléfono", "Estado", "Entrega", "Total", "Fuente"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wide text-text-secondary sm:px-5"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 sm:px-5">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-brand-softer text-brand-primary">
                      <Package className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-[13px] font-medium text-text-primary">
                      No hay pedidos en este período.
                    </p>
                    <p className="mt-1 text-[12px] text-text-secondary">
                      Prueba otro estado, rango o búsqueda.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const customer = labelOrderCustomer(order);
                return (
                  <tr
                    key={order.id}
                    className="border-b border-border/80 transition-colors last:border-b-0 hover:bg-muted/70"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={routes.store.orderDetail(agencySlug, storeSlug, order.id)}
                        className={cn(
                          "text-[12.5px] font-semibold text-text-primary hover:text-brand-primary hover:underline",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        {order.order_number ?? order.external_order_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-text-secondary sm:px-5">
                      {formatShortDate(order.created_at_source)}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-[12.5px] sm:px-5">
                      <span
                        className={cn(
                          customer.isEmpty ? "text-text-secondary italic" : "text-text-primary",
                        )}
                        title={
                          customer.isEmpty
                            ? "Cliente aún no vinculado (p. ej. sync pendiente)"
                            : customer.text
                        }
                      >
                        {customer.text}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[12.5px] sm:px-5">
                      <ContactCell value={order.customerEmail} emptyLabel="Sin email registrado" />
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-[12.5px] tabular-nums sm:px-5">
                      <ContactCell value={order.customerPhone} emptyLabel="Sin teléfono registrado" />
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <StatusBadge status={order.order_status} label={compactStatusLabel(order.order_status)} />
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-text-secondary sm:px-5">
                      {formatDeliveryLabel(order)}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] font-medium tabular-nums text-text-primary sm:px-5">
                      {formatCurrency(Number(order.total_amount), order.currency_code)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <OrderSourceBadge sourceName={order.source_name} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
