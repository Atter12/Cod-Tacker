import { createHash } from "node:crypto";

/** Same rule + trigger + entity always maps to the same run key. */
export function automationIdempotencyKey(
  ruleId: string,
  trigger: string,
  entityId: string,
): string {
  return createHash("sha256").update(`${ruleId}:${trigger}:${entityId}`).digest("hex").slice(0, 40);
}

/** A run that already exists for that key must not execute the rule again. */
export function shouldSkipAutomationRun(existingRunId: string | null | undefined): boolean {
  return Boolean(existingRunId);
}
