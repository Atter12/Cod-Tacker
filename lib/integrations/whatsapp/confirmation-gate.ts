export type WhatsappCodConfirmationSkip =
  | "not_cash_expected"
  | "confirmation_terminal"
  | "already_pending";

export type WhatsappCodConfirmationDecision =
  | { enqueue: true }
  | { enqueue: false; skipped: WhatsappCodConfirmationSkip };

/**
 * Only a COD order still waiting for a reply gets a confirmation template.
 * Prepaid, and an already confirmed or rejected order, do not.
 */
export function decideWhatsappCodConfirmationEnqueue(input: {
  paymentStatus: string | null;
  confirmationStatus: string | null;
  allowPendingResend?: boolean;
}): WhatsappCodConfirmationDecision {
  if (input.paymentStatus !== "cash_expected") {
    return { enqueue: false, skipped: "not_cash_expected" };
  }
  if (input.confirmationStatus === "confirmed" || input.confirmationStatus === "rejected") {
    return { enqueue: false, skipped: "confirmation_terminal" };
  }
  if (input.confirmationStatus === "pending" && !input.allowPendingResend) {
    return { enqueue: false, skipped: "already_pending" };
  }
  return { enqueue: true };
}
