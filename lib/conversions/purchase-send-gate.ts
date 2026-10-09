export type PurchaseResendDecision =
  | { send: false; reason: "already_sent" | "rejected" }
  | { send: true };

/**
 * A Purchase row that already left for Meta/TikTok is not sent again.
 * A rejected candidate stays rejected. The event_id stays `purchase:{orderId}`.
 */
export function decidePurchaseResend(existing: {
  id: string | null;
  sentAt: string | null;
  releaseStatus: string | null;
} | null): PurchaseResendDecision {
  if (existing?.id && existing.sentAt) return { send: false, reason: "already_sent" };
  if (existing?.releaseStatus === "rejected") return { send: false, reason: "rejected" };
  return { send: true };
}
