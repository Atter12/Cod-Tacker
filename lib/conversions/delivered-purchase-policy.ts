import type { Enums } from "@/types/database.generated";

type PaymentStatus = Enums<"payment_status">;

/** COD states where door delivery implies cash for S11 terminal CAPI. */
const COD_DELIVERED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "cash_expected",
  "partially_collected",
  "cash_collected",
];

export function shouldFirePurchaseOnDelivered(paymentStatus: PaymentStatus): boolean {
  return (COD_DELIVERED_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus);
}

export function shouldMarkCashCollectedOnDelivered(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === "cash_expected" || paymentStatus === "partially_collected";
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
