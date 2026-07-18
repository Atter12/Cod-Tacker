import {
  evaluatePurchaseRelease,
  type ConversionReleaseDecision,
  type PurchaseReleaseInput,
} from "@/lib/conversions/release-policy";

/**
 * Sweep policy for the periodic release-gate worker.
 *
 * Re-evaluates held (`pending_review`) Purchase candidates against the live
 * order state and maps the filter decision to a sweep action:
 * - `release`: the order became eligible → label released and send.
 * - `reject`: the order reached a terminal negative outcome → never send.
 * - `hold`: still undecided → keep in the review queue, recheck later.
 */

export type SweepAction = "release" | "reject" | "hold";

export type SweepDecision = {
  action: SweepAction;
  decision: ConversionReleaseDecision;
};

/**
 * Hold reasons that can never recover on their own: the order/payment reached
 * a terminal negative state, so the candidate is auto-rejected to keep the
 * review queue clean. An operator can still reverse this while unsent.
 * `non_positive_value` and `awaiting_collection` stay held — order edits or a
 * later collection can flip them.
 */
const AUTO_REJECT_HOLD_REASONS: ReadonlySet<string> = new Set([
  "order_terminal_negative",
  "confirmation_rejected",
  "payment_refunded_or_written_off",
]);

/** How long a still-held candidate waits before the sweep rechecks it. */
export const HELD_RECHECK_INTERVAL_MS = 10 * 60 * 1_000;

export function decideSweepAction(input: PurchaseReleaseInput): SweepDecision {
  const decision = evaluatePurchaseRelease(input);
  if (decision.release) {
    return { action: "release", decision };
  }
  return {
    action: AUTO_REJECT_HOLD_REASONS.has(decision.reason) ? "reject" : "hold",
    decision,
  };
}

export function nextHeldRecheckAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + HELD_RECHECK_INTERVAL_MS);
}
