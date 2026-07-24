import { getServerEnv } from "@/config/env";
import {
  sweepEcartPayScheduledSyncs,
  type EcartScheduledSyncResult,
} from "@/lib/integrations/ecart-pay/scheduled-sync";
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
 * Dedicated Ecart Pay settlement cron (every ~8h via vercel.json).
 * Also safe if invoked more often: sweep skips stores still inside the interval.
 *
 * Auth: Authorization Bearer CRON_SECRET|INTERNAL_JOB_SECRET or x-cron-secret.
 */
export async function GET(request: Request) {
  return runEcartCron(request);
}

export async function POST(request: Request) {
  return runEcartCron(request);
}

async function runEcartCron(request: Request) {
  const ctx = createRequestContext({
    request_id: request.headers.get("x-request-id") ?? undefined,
  });

  if (!authorize(request)) {
    logger.warn("ecart_pay.cron.unauthorized", { ...ctx });
    return Response.json({ error: "Unauthorized", request_id: ctx.request_id }, { status: 401 });
  }

  const rl = checkMemoryRateLimit(
    `ecart-sync:${request.headers.get("authorization")?.slice(0, 24) ?? "x"}`,
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
  let sweep: EcartScheduledSyncResult;
  try {
    sweep = await sweepEcartPayScheduledSyncs(admin);
  } catch (error) {
    logger.error("ecart_pay.cron.failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: "Ecart Pay sync sweep failed",
        request_id: ctx.request_id,
      },
      { status: 500, headers: { "x-request-id": ctx.request_id } },
    );
  }

  logger.info("ecart_pay.cron.complete", {
    ...ctx,
    scanned: sweep.scanned,
    due: sweep.due,
    synced: sweep.synced,
    empty: sweep.empty,
    ok: sweep.ok,
    errors: sweep.errors,
    skipped: sweep.skipped,
  });

  return Response.json(
    {
      request_id: ctx.request_id,
      ...sweep,
    },
    { headers: { "x-request-id": ctx.request_id } },
  );
}
