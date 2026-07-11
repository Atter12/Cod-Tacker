import "server-only";

import { createRequestContext, type RequestContext } from "@/lib/observability/request-context";
import { logger } from "@/lib/observability/logger";

/**
 * Attach request context to a server action / route handler and emit a structured log.
 * Does not log PII (emails, phones, full payloads).
 */
export function withActionContext(
  actionName: string,
  values: Partial<RequestContext> = {},
): RequestContext {
  const ctx = createRequestContext(values);
  logger.info("action.start", { ...ctx, action: actionName });
  return ctx;
}

export function logActionComplete(
  ctx: RequestContext,
  actionName: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (/(email|phone|password|secret|token|key_hash|plaintext)/i.test(k)) continue;
    if (typeof v === "string" && v.length > 200) {
      safe[k] = `${v.slice(0, 200)}…`;
      continue;
    }
    safe[k] = v;
  }
  logger.info("action.complete", { ...ctx, action: actionName, ...safe });
}
