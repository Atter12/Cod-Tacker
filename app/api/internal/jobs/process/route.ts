import { getServerEnv } from "@/config/env";
import {
  sweepConversionReleases,
  type ReleaseSweepResult,
} from "@/lib/conversions/release-sweep";
import { processJobBatch, recoverStuckJobs } from "@/lib/jobs/processor";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestContext } from "@/lib/observability/request-context";
import { logger } from "@/lib/observability/logger";
import { checkMemoryRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const env = getServerEnv();
  const secret = env.CRON_SECRET || env.INTERNAL_JOB_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice("Bearer ".length) === secret) {
    return true;
  }
  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader && cronHeader === secret) return true;
  if (env.CRON_SECRET && cronHeader === env.CRON_SECRET) return true;
  if (env.INTERNAL_JOB_SECRET && cronHeader === env.INTERNAL_JOB_SECRET) return true;
  return false;
}

/**
 * Internal cron/worker endpoint. Authenticate with:
 *   Authorization: Bearer <CRON_SECRET|INTERNAL_JOB_SECRET>
 *   or x-cron-secret: <CRON_SECRET|INTERNAL_JOB_SECRET>
 *
 * Uses the Supabase service role to claim and process jobs.
 * Rate-limited in-memory: 30 requests / minute per secret fingerprint.
 * Vercel Cron invokes GET; manual ops can POST with a JSON body.
 */
export async function GET(request: Request) {
  return processJobsRequest(request, { recover: true, sweepConversions: true });
}

export async function POST(request: Request) {
  let limit = 10;
  let queue = "default";
  let recover = false;
  let sweepConversions = false;
  try {
    const body = (await request.json().catch(() => null)) as {
      limit?: number;
      queue?: string;
      recover?: boolean;
      sweepConversions?: boolean;
    } | null;
    if (body?.limit && Number.isFinite(body.limit)) {
      limit = Math.min(Math.max(Math.floor(body.limit), 1), 50);
    }
    if (typeof body?.queue === "string" && body.queue.trim()) {
      queue = body.queue.trim();
    }
    recover = Boolean(body?.recover);
    sweepConversions = Boolean(body?.sweepConversions);
  } catch {
    // empty body is fine
  }
  return processJobsRequest(request, { limit, queue, recover, sweepConversions });
}

async function processJobsRequest(
  request: Request,
  options: {
    limit?: number;
    queue?: string;
    recover?: boolean;
    sweepConversions?: boolean;
  },
) {
  const ctx = createRequestContext({
    request_id: request.headers.get("x-request-id") ?? undefined,
  });

  if (!authorize(request)) {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically when CRON_SECRET is set.
    logger.warn("jobs.process.unauthorized", { ...ctx });
    return Response.json({ error: "Unauthorized", request_id: ctx.request_id }, { status: 401 });
  }

  const rl = checkMemoryRateLimit(
    `jobs-process:${request.headers.get("authorization")?.slice(0, 24) ?? "x"}`,
    { limit: 30, windowMs: 60_000 },
  );
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", request_id: ctx.request_id },
      {
        status: 429,
        headers: {
          "retry-after": String(rl.retryAfterSec),
          "x-request-id": ctx.request_id,
        },
      },
    );
  }

  const limit = options.limit ?? 10;
  const queue = options.queue ?? "default";
  const recover = Boolean(options.recover);

  const admin = createAdminClient();
  const workerId = `http:${Date.now()}`;

  let recovered = 0;
  if (recover) {
    recovered = await recoverStuckJobs(admin);
  }

  const result = await processJobBatch(admin, { workerId, limit, queue });

  // Release-gate sweep: re-evaluates held conversions and retries failed
  // sends to Meta/TikTok. Errors are contained so job processing still reports.
  let conversionSweep: ReleaseSweepResult | null = null;
  if (options.sweepConversions) {
    try {
      conversionSweep = await sweepConversionReleases(admin);
    } catch (error) {
      logger.error("jobs.process.conversion_sweep_failed", {
        ...ctx,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("jobs.process.complete", {
    ...ctx,
    workerId,
    recovered,
    claimed: result.claimed,
    completed: result.completed,
    conversion_sweep: conversionSweep ? { ...conversionSweep } : null,
  });
  return Response.json(
    {
      workerId,
      recovered,
      request_id: ctx.request_id,
      ...result,
      conversionSweep,
    },
    { headers: { "x-request-id": ctx.request_id } },
  );
}
