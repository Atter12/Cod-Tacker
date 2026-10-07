import { getServerEnv } from "@/config/env";
import { isShopifyPartnerApiConfigured } from "@/lib/billing/shopify-partner-env";
import { sweepShopifyAppPricingSubscriptions } from "@/lib/billing/shopify-subscription-sync";
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
 * Reconcile Shopify App Pricing → local subscriptions.
 * Auth: Authorization Bearer CRON_SECRET|INTERNAL_JOB_SECRET or x-cron-secret.
 */
export async function GET(request: Request) {
  return runBillingSync(request);
}

export async function POST(request: Request) {
  return runBillingSync(request);
}

async function runBillingSync(request: Request) {
  const ctx = createRequestContext({
    request_id: request.headers.get("x-request-id") ?? undefined,
  });

  if (!authorize(request)) {
    logger.warn("shopify.billing.cron.unauthorized", { ...ctx });
    return Response.json({ error: "Unauthorized", request_id: ctx.request_id }, { status: 401 });
  }

  const rl = checkMemoryRateLimit(
    `shopify-billing-sync:${request.headers.get("authorization")?.slice(0, 24) ?? "x"}`,
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

  if (!isShopifyPartnerApiConfigured()) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "partner_api_not_configured",
      request_id: ctx.request_id,
    });
  }

  try {
    const sweep = await sweepShopifyAppPricingSubscriptions(createAdminClient());
    logger.info("shopify.billing.cron.ok", {
      ...ctx,
      scanned: sweep.scanned,
      synced: sweep.synced,
      cleared: sweep.cleared,
      skipped: sweep.skipped,
      errors: sweep.errors,
    });
    return Response.json({ ok: true, ...sweep, request_id: ctx.request_id });
  } catch (error) {
    logger.error("shopify.billing.cron.failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: error instanceof Error ? error.message : "billing sync failed",
        request_id: ctx.request_id,
      },
      { status: 500 },
    );
  }
}
