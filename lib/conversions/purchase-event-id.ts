/** Stable dedupe key for Purchase conversion events (Meta CAPI event_id). */
export function purchaseConversionEventId(orderId: string): string {
  return `purchase:${orderId}`;
}
