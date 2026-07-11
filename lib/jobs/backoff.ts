/**
 * Deterministic exponential backoff with seed-controlled jitter.
 * Never uses Math.random without a seed so retries are reproducible in tests.
 */

const DEFAULT_BASE_MS = 1_000;
const DEFAULT_MAX_MS = 15 * 60 * 1_000;

/** Stable 32-bit hash from a string seed. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Pseudo-random in [0, 1) derived from seed + attempt (no Math.random).
 */
export function seededUnit(seed: string, attempt: number): number {
  const h = hashSeed(`${seed}:${attempt}`);
  return h / 0x1_0000_0000;
}

/**
 * Returns the absolute Date when the next retry should run.
 * Delay grows as baseMs * 2^(attempt-1), capped at maxMs, with ±25% jitter from seed.
 */
export function computeRetryAt(
  attempt: number,
  baseMs: number = DEFAULT_BASE_MS,
  maxMs: number = DEFAULT_MAX_MS,
  seed = "codtracked-jobs",
): Date {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exp = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
  const jitterFactor = 0.75 + seededUnit(seed, safeAttempt) * 0.5; // [0.75, 1.25)
  const delayMs = Math.min(maxMs, Math.round(exp * jitterFactor));
  return new Date(Date.now() + delayMs);
}
