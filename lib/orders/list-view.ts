import type { OrderListView, OrderStatus } from "@/types/orders";

export const ORDER_LIST_VIEWS: readonly {
  value: OrderListView;
  label: string;
}[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "delivered", label: "Entregados" },
  { value: "returned", label: "Devueltos" },
] as const;

export function parseOrderListView(value: string | null | undefined): OrderListView {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "delivered" ||
    value === "returned" ||
    value === "all"
  ) {
    return value;
  }
  return "all";
}

/** Maps semantic list tabs to concrete order_status values. */
export function statusesForOrderListView(view: OrderListView): OrderStatus[] | undefined {
  switch (view) {
    case "pending":
      return ["created", "pending_confirmation"];
    case "confirmed":
      return ["confirmed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery"];
    case "delivered":
      return ["delivered", "closed"];
    case "returned":
      return ["returned", "return_in_transit"];
    case "all":
    default:
      return undefined;
  }
}
