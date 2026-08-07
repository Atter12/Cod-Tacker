import { getServerEnv } from "@/config/env";
import {
  sweepAdsScheduledSyncs,
  type AdsScheduledSyncResult,
} from "@/lib/integrations/ads/scheduled-sync";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { createRequestContext } from "@/lib/observability/request-context";
import { logger } from "@/lib/observability/logger";
import { checkMemoryRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * Dedicated Meta/TikTok Ads spend cron (daily via vercel.json).
 * Safe if invoked more often: sweep skips stores still inside the 24h interval.
 * First sync for a store uses historical backfill (~30d).
 *
 * Auth: Authorization Bearer CRON_SECRET|INTERNAL_JOB_SECRET or x-cron-secret.
 */
export async function GET(request: Request) {
  return runAdsCron(request);
}

export async function POST(request: Request) {
  return runAdsCron(request);
}

async function runAdsCron(request: Request) {
  const ctx = createRequestContext({
    request_id: request.headers.get("x-request-id") ?? undefined,
  });

  if (!authorize(request)) {
    logger.warn("ads.cron.unauthorized", { ...ctx });
    return Response.json({ error: "Unauthorized", request_id: ctx.request_id }, { status: 401 });
  }

  const rl = checkMemoryRateLimit(
    `ads-sync:${request.headers.get("authorization")?.slice(0, 24) ?? "x"}`,
    { limit: 10, windowMs: 60_000 },
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

  const admin = createAdminClient();
  let sweep: AdsScheduledSyncResult;
  try {
    sweep = await sweepAdsScheduledSyncs(admin);
  } catch (error) {
    logger.error("ads.cron.failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: "Ads sync sweep failed",
        request_id: ctx.request_id,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { "x-request-id": ctx.request_id } },
    );
  }

  if (sweep.synced > 0) {
    await kickJobProcessing({ limit: 40, reason: "ads-scheduled-sync" });
  }

  logger.info("ads.cron.complete", {
    ...ctx,
    scanned: sweep.scanned,
    due: sweep.due,
    synced: sweep.synced,
    backfills: sweep.backfills,
    incrementals: sweep.incrementals,
    errors: sweep.errors,
  });

  return Response.json(
    { request_id: ctx.request_id, ...sweep },
    { headers: { "x-request-id": ctx.request_id } },
  );
}
