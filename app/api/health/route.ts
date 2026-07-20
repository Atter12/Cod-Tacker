import { createClient } from "@/lib/supabase/server";
import { createRequestContext } from "@/lib/observability/request-context";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DepStatus = { name: string; ok: boolean; latencyMs: number; detail?: string };

/**
 * Health with internal dependency probes.
 * Does not expose secrets or connection strings.
 */
export async function GET(request: Request) {
  const ctx = createRequestContext({
    request_id: request.headers.get("x-request-id") ?? undefined,
  });
  const started = Date.now();
  const deps: DepStatus[] = [];

  // Supabase (anon/request client) — validates network + project reachability
  {
    const t0 = Date.now();
    try {
      const client = await createClient();
      const { error } = await client.from("plans").select("id").limit(1);
      deps.push({
        name: "supabase",
        ok: !error,
        latencyMs: Date.now() - t0,
        detail: error ? "query_failed" : "ok",
      });
    } catch {
      deps.push({
        name: "supabase",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "unreachable",
      });
    }
  }

  // Job queue depth (best-effort; may fail under RLS for anon — treat as degraded not down)
  {
    const t0 = Date.now();
    try {
      const client = await createClient();
      const { count, error } = await client
        .from("background_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["queued", "retry_scheduled"]);
      deps.push({
        name: "job_queue",
        ok: !error,
        latencyMs: Date.now() - t0,
        detail: error ? "unavailable" : `pending=${count ?? 0}`,
      });
    } catch {
      deps.push({
        name: "job_queue",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "unreachable",
      });
    }
  }

  const criticalOk = deps.find((d) => d.name === "supabase")?.ok ?? false;
  const status = criticalOk ? (deps.every((d) => d.ok) ? "ok" : "degraded") : "down";
  const httpStatus = status === "down" ? 503 : 200;

  const payload = {
    ...ctx,
    status,
    duration_ms: Date.now() - started,
    deps: deps.map((d) => ({ name: d.name, ok: d.ok, latencyMs: d.latencyMs })),
  };
  if (status === "ok") {
    logger.debug("health.check", payload);
  } else if (status === "degraded") {
    logger.warn("health.check", payload);
  } else {
    logger.error("health.check", payload);
  }

  return Response.json(
    {
      status,
      service: "codtracked",
      version: "integration-ready-v1",
      request_id: ctx.request_id,
      checked_at: new Date().toISOString(),
      dependencies: deps,
    },
    {
      status: httpStatus,
      headers: { "x-request-id": ctx.request_id, "cache-control": "no-store" },
    },
  );
}
