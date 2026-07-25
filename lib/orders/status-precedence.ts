import type { OrderStatus } from "@/types/orders";
import type { Enums } from "@/types/database.generated";

type ShipmentStatus = Enums<"shipment_status">;

/**
 * Logistics progression rank. Higher = further along / more terminal.
 * Used so Shopify updates never regress carrier-advanced statuses, and
 * carrier mid-funnel mirrors never regress a later order_status.
 */
const ORDER_STATUS_RANK: Readonly<Record<OrderStatus, number>> = {
  created: 0,
  pending_confirmation: 1,
  confirmed: 2,
  ready_to_ship: 3,
  shipped: 4,
  in_transit: 5,
  out_for_delivery: 6,
  delivery_failed: 6,
  delivered: 7,
  rejected: 7,
  return_in_transit: 8,
  returned: 9,
  lost: 9,
  cancelled: -1,
  closed: 10,
};

/** Statuses owned by logistics after the package left the merchant. */
const LOGISTICS_OWNED: ReadonlySet<OrderStatus> = new Set([
  "in_transit",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "rejected",
  "return_in_transit",
  "returned",
  "lost",
  "closed",
]);

export function orderStatusRank(status: OrderStatus): number {
  return ORDER_STATUS_RANK[status] ?? 0;
}

/**
 * Shopify may advance fulfillment-derived statuses, but must not overwrite
 * logistics-owned terminal/mid-funnel states (e.g. delivered → shipped).
 * Cancel is allowed only before delivered/returned/lost/closed.
 */
export function shouldApplyShopifyOrderStatus(
  current: OrderStatus,
  incoming: OrderStatus,
): boolean {
  if (current === incoming) return true;
  if (incoming === "cancelled") {
    return !["delivered", "returned", "lost", "closed"].includes(current);
  }
  if (LOGISTICS_OWNED.has(current)) {
    return false;
  }
  return orderStatusRank(incoming) >= orderStatusRank(current);
}

/** Map normalized shipment status → order_status (null = no order patch). */
export function orderStatusFromShipmentStatus(
  shipmentStatus: ShipmentStatus,
): OrderStatus | null {
  switch (shipmentStatus) {
    case "label_generated":
    case "created":
      return "ready_to_ship";
    case "picked_up":
    case "in_transit":
      return "in_transit";
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "delivery_failed":
      return "delivery_failed";
    case "rejected":
      return "rejected";
    case "return_in_transit":
      return "return_in_transit";
    case "returned":
      return "returned";
    case "lost":
      return "lost";
    case "cancelled":
      return "cancelled";
    case "unknown":
      return null;
    default:
      return null;
  }
}

/**
 * Carrier may advance order_status to match shipment, but never regress.
 * Cancelled/closed on the order stay unless incoming is a later logistics status.
 */
export function shouldApplyCarrierOrderStatus(
  current: OrderStatus | null | undefined,
  incoming: OrderStatus,
): boolean {
  if (!current) return true;
  if (current === incoming) return true;
  if (current === "closed") return false;
  if (current === "cancelled" && incoming !== "cancelled") {
    return orderStatusRank(incoming) >= orderStatusRank("shipped");
  }
  return orderStatusRank(incoming) >= orderStatusRank(current);
}
