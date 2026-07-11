/**
 * Basic in-memory rate limiter for sensitive HTTP routes (cron, internal APIs).
 * For multi-instance production, prefer Redis / Edge rate limits — documented in OPERATIONS_RUNBOOK.
 *
 * API keys use persistent `api_key_rate_limits` instead (see lib/api-keys/validate.ts).
 * Pure module (no server-only) so unit tests can import it.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

export function checkMemoryRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}

/** Test helper — clears buckets between unit tests. */
export function resetMemoryRateLimitsForTests(): void {
  buckets.clear();
}
