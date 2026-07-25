/** Pure outcome helpers for Ecart Pay settlement sync (unit-test safe). */

export type EcartSyncOutcome = "ok" | "empty" | "error";

export const ECART_EMPTY_SYNC_MESSAGE =
  "0 transacciones, no es error. Ecart Pay no tiene cobros conciliables en el rango.";

export const ECART_SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8h (within 6–12h)

export function classifyEcartSyncOutcome(rowCount: number): Exclude<EcartSyncOutcome, "error"> {
  return rowCount > 0 ? "ok" : "empty";
}

export function messageForEcartSyncOutcome(
  outcome: EcartSyncOutcome,
  input?: { rowCount?: number; errorMessage?: string; jobId?: string },
): string {
  if (outcome === "empty") return ECART_EMPTY_SYNC_MESSAGE;
  if (outcome === "error") {
    return input?.errorMessage?.trim() || "Falló la sincronización con Ecart Pay.";
  }
  const n = input?.rowCount ?? 0;
  const jobBit = input?.jobId ? ` (job ${input.jobId.slice(0, 8)}…)` : "";
  return `Sync encolado: ${n} transacción${n === 1 ? "" : "es"}${jobBit}.`;
}

/** Last attempt watermark: success or error, whichever is newer. */
export function lastEcartSyncAttemptAt(integration: {
  last_success_at: string | null;
  last_error_at: string | null;
}): Date | null {
  const times = [integration.last_success_at, integration.last_error_at]
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime())
    .filter((n) => Number.isFinite(n));
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

export function isEcartSyncDue(
  integration: { last_success_at: string | null; last_error_at: string | null },
  nowMs = Date.now(),
  intervalMs = ECART_SYNC_INTERVAL_MS,
): boolean {
  const last = lastEcartSyncAttemptAt(integration);
  if (!last) return true;
  return nowMs - last.getTime() >= intervalMs;
}
