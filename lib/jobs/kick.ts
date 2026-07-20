import "server-only";

import { processJobBatch } from "@/lib/jobs/processor";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";

/**
 * Drain a small job batch immediately (post-webhook / post-sync).
 * Safe to call from `after()` so the HTTP response is not delayed.
 */
export async function kickJobProcessing(input?: {
  limit?: number;
  reason?: string;
}): Promise<void> {
  const limit = Math.min(Math.max(input?.limit ?? 8, 1), 20);
  const workerId = `kick:${input?.reason ?? "adhoc"}:${Date.now()}`;
  try {
    const admin = createAdminClient();
    const result = await processJobBatch(admin, { workerId, limit, queue: "default" });
    const fields = {
      workerId,
      reason: input?.reason ?? null,
      claimed: result.claimed,
      completed: result.completed,
    };
    // Idle kicks are routine; only surface work in production audits.
    if (result.claimed > 0 || result.completed > 0) {
      logger.info("jobs.kick.complete", fields);
    } else {
      logger.debug("jobs.kick.complete", fields);
    }
  } catch (error) {
    logger.error("jobs.kick.failed", {
      workerId,
      reason: input?.reason ?? null,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
