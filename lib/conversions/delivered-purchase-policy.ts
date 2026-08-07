import type { Enums } from "@/types/database.generated";

type PaymentStatus = Enums<"payment_status">;

/**
 * Delivered ≠ cash in hand for COD.
 * Purchase CAPI/Events fires from Cobrado manual or conciliación — not from door delivery.
 */
export function shouldFirePurchaseOnDelivered(_paymentStatus: PaymentStatus): boolean {
  return false;
}

/** Never auto-mark cash_collected on delivered; cash truth comes from ops or settlement. */
export function shouldMarkCashCollectedOnDelivered(_paymentStatus: PaymentStatus): boolean {
  return false;
}

/** True when this apply result newly reached delivered (not RTO, not skipped). */
export function isNewlyDeliveredTerminal(input: {
  skippedDuplicate: boolean;
  skipStatusUpdate: boolean;
  normalizedStatus: string;
}): boolean {
  return (
    !input.skippedDuplicate &&
    !input.skipStatusUpdate &&
    input.normalizedStatus === "delivered"
  );
}
