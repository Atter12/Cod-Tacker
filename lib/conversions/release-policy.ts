import type { Enums } from "@/types/database.generated";

/**
 * Release gate for Purchase conversions.
 *
 * Candidates are queued first (`conversion_events.status = queued`) and only
 * sent to Meta/TikTok after this filter labels them `released` — or after a
 * manual release from the review queue. Nothing is sent on `pending_review`
 * or `rejected`.
 */

export type ConversionReleaseStatus = "pending_review" | "released" | "rejected";

export type ConversionReleaseDecision =
  | { release: true; reason: ReleaseReason }
  | { release: false; reason: HoldReason };

export type ReleaseReason = "payment_collected" | "delivered_cod";

export type HoldReason =
  | "non_positive_value"
  | "order_terminal_negative"
  | "confirmation_rejected"
  | "payment_refunded_or_written_off"
  | "awaiting_collection";

type OrderStatus = Enums<"order_status">;
type PaymentStatus = Enums<"payment_status">;
type ConfirmationStatus = Enums<"confirmation_status">;

/** Order outcomes where a Purchase must never be released automatically. */
const NEGATIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "cancelled",
  "rejected",
  "return_in_transit",
  "returned",
  "lost",
];

/** Cash truly in hand (or on its way through settlement). */
const COLLECTED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "cash_collected",
  "partially_collected",
  "settlement_pending",
  "settled",
];

const BLOCKED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "refunded",
  "written_off",
];

export type PurchaseReleaseInput = {
  value: number;
  orderStatus: OrderStatus | null;
  paymentStatus: PaymentStatus | null;
  confirmationStatus: ConfirmationStatus | null;
};

/**
 * Decide whether a Purchase candidate passes the filter (auto-release) or
 * stays held for manual review. Deterministic and side-effect free.
 */
export function evaluatePurchaseRelease(
  input: PurchaseReleaseInput,
): ConversionReleaseDecision {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { release: false, reason: "non_positive_value" };
  }
  if (input.orderStatus && NEGATIVE_ORDER_STATUSES.includes(input.orderStatus)) {
    return { release: false, reason: "order_terminal_negative" };
  }
  if (input.confirmationStatus === "rejected") {
    return { release: false, reason: "confirmation_rejected" };
  }
  if (input.paymentStatus && BLOCKED_PAYMENT_STATUSES.includes(input.paymentStatus)) {
    return { release: false, reason: "payment_refunded_or_written_off" };
  }
  if (input.paymentStatus && COLLECTED_PAYMENT_STATUSES.includes(input.paymentStatus)) {
    return { release: true, reason: "payment_collected" };
  }
  if (input.orderStatus === "delivered" && input.paymentStatus === "cash_expected") {
    return { release: true, reason: "delivered_cod" };
  }
  return { release: false, reason: "awaiting_collection" };
}

export function labelReleaseStatus(status: ConversionReleaseStatus): string {
  switch (status) {
    case "pending_review":
      return "En revisión";
    case "released":
      return "Liberada";
    case "rejected":
      return "Rechazada";
  }
}

export function labelHoldReason(reason: string | null | undefined): string | null {
  switch (reason) {
    case "non_positive_value":
      return "Monto inválido (≤ 0)";
    case "order_terminal_negative":
      return "Pedido cancelado / rechazado / devuelto";
    case "confirmation_rejected":
      return "Confirmación rechazada";
    case "payment_refunded_or_written_off":
      return "Pago reembolsado o castigado";
    case "awaiting_collection":
      return "A la espera de cobro/entrega confirmada";
    case "manual_reject":
      return "Rechazada manualmente";
    default:
      return reason ?? null;
  }
}
