import type { ConfirmationStatus, OrderStatus, PaymentStatus } from "@/types/orders";
import { PermissionError, ValidationError } from "@/lib/errors";

/** Allowed order_status transitions for manual operator actions. */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  created: ["pending_confirmation", "confirmed", "cancelled", "rejected"],
  pending_confirmation: ["confirmed", "cancelled", "rejected"],
  confirmed: ["ready_to_ship", "cancelled", "rejected"],
  cancelled: [],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["in_transit", "out_for_delivery", "delivered", "delivery_failed", "cancelled"],
  in_transit: ["out_for_delivery", "delivered", "delivery_failed", "return_in_transit", "lost"],
  out_for_delivery: ["delivered", "delivery_failed", "rejected", "return_in_transit"],
  delivered: ["return_in_transit", "closed"],
  delivery_failed: ["out_for_delivery", "return_in_transit", "rejected", "cancelled"],
  rejected: ["closed"],
  return_in_transit: ["returned", "lost"],
  returned: ["closed"],
  lost: ["closed"],
  closed: [],
};

/**
 * Payment transitions.
 * `settled` is only reachable from `settlement_pending` unless adminOverride is explicit and audited.
 */
export const PAYMENT_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  unpaid: ["cash_expected", "refunded", "written_off"],
  cash_expected: ["cash_collected", "partially_collected", "unpaid", "disputed"],
  cash_collected: ["settlement_pending", "disputed", "refunded"],
  partially_collected: ["cash_collected", "settlement_pending", "disputed"],
  settlement_pending: ["settled", "disputed"],
  settled: ["disputed", "refunded"],
  disputed: ["cash_collected", "settlement_pending", "refunded", "written_off"],
  refunded: ["written_off"],
  written_off: [],
};

export const CONFIRMATION_STATUS_TRANSITIONS: Readonly<
  Record<ConfirmationStatus, readonly ConfirmationStatus[]>
> = {
  not_requested: ["pending", "confirmed", "manual_review"],
  pending: ["confirmed", "rejected", "expired", "manual_review"],
  confirmed: ["manual_review"],
  rejected: ["manual_review", "pending"],
  expired: ["pending", "manual_review"],
  manual_review: ["confirmed", "rejected", "pending"],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
  options: { adminOverride?: boolean } = {},
): boolean {
  if (to === "settled") {
    if (from === "settlement_pending") return true;
    return Boolean(options.adminOverride);
  }
  return (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionConfirmationStatus(from: ConfirmationStatus, to: ConfirmationStatus): boolean {
  return (CONFIRMATION_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new ValidationError(`Transición de estado no permitida: ${from} → ${to}.`);
  }
}

export function assertPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus,
  options: { adminOverride?: boolean } = {},
): void {
  if (!canTransitionPaymentStatus(from, to, options)) {
    throw new ValidationError(`Transición de pago no permitida: ${from} → ${to}.`);
  }
}

export function assertConfirmationTransition(from: ConfirmationStatus, to: ConfirmationStatus): void {
  if (!canTransitionConfirmationStatus(from, to)) {
    throw new ValidationError(`Transición de confirmación no permitida: ${from} → ${to}.`);
  }
}

export function assertCanManageOrders(canManage: boolean): void {
  if (!canManage) throw new PermissionError("No tienes permiso para modificar pedidos.");
}
