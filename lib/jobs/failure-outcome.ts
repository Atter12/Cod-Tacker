export type JobFailureOutcome = "dead_letter" | "retry";

/**
 * A permanent error dead-letters immediately.
 * A retryable error dead-letters only after max_attempts. Otherwise it is scheduled again.
 */
export function decideJobFailureOutcome(input: {
  permanent: boolean;
  attempts: number;
  maxAttempts: number;
}): JobFailureOutcome {
  if (input.permanent || input.attempts >= input.maxAttempts) return "dead_letter";
  return "retry";
}
