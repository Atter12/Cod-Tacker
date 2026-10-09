export type SettlementCollectedAction =
  | "apply"
  | "skip_already_applied"
  | "skip_unmatched"
  | "skip_already_collected";

/**
 * A settlement row marks cash collected once.
 * An unmatched row, a row already applied, or an order already collected/settled does not.
 */
export function decideSettlementCollectedAction(input: {
  collectedAppliedAt: string | null;
  matchStatus: string | null;
  orderId: string | null;
  paymentStatus: string | null;
}): SettlementCollectedAction {
  if (input.collectedAppliedAt) return "skip_already_applied";
  if (input.matchStatus !== "matched" || !input.orderId) return "skip_unmatched";
  if (
    input.paymentStatus === "cash_collected" ||
    input.paymentStatus === "settlement_pending" ||
    input.paymentStatus === "settled"
  ) {
    return "skip_already_collected";
  }
  return "apply";
}
