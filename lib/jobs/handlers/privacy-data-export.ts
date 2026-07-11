import type { JobHandler, JobHandlerContext } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

/**
 * Builds a privacy export artifact summary (counts + redacted samples).
 * Does not dump full PII payloads to the client.
 */
export const handlePrivacyDataExport: JobHandler = async (ctx: JobHandlerContext) => {
  const payload = (ctx.payload ?? {}) as Record<string, unknown>;
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  if (!requestId) {
    return { ok: true, action: "skipped", detail: "missing_request_id" };
  }

  const { data: request } = await ctx.admin
    .from("data_export_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return { ok: true, action: "skipped", detail: "request_not_found" };
  }

  await ctx.admin
    .from("data_export_requests")
    .update({ status: "processing", updated_at: new Date().toISOString(), job_id: ctx.job.id })
    .eq("id", requestId);

  try {
    const agencyId = request.agency_id;
    const storeId = request.store_id;

    const storeFilter = storeId
      ? await ctx.admin.from("stores").select("id, name, slug").eq("id", storeId)
      : await ctx.admin.from("stores").select("id, name, slug").eq("agency_id", agencyId);

    const stores = storeFilter.data ?? [];
    const storeIds = stores.map((s) => s.id);

    let orderCount = 0;
    let customerCount = 0;
    let shipmentCount = 0;
    if (storeIds.length) {
      const [orders, customers, shipments] = await Promise.all([
        ctx.admin.from("orders").select("*", { count: "exact", head: true }).in("store_id", storeIds),
        ctx.admin.from("customers").select("*", { count: "exact", head: true }).in("store_id", storeIds),
        ctx.admin.from("shipments").select("*", { count: "exact", head: true }).in("store_id", storeIds),
      ]);
      orderCount = orders.count ?? 0;
      customerCount = customers.count ?? 0;
      shipmentCount = shipments.count ?? 0;
    }

    const summary: Json = {
      exported_at: new Date().toISOString(),
      scope: request.scope,
      stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      counts: {
        orders: orderCount,
        customers: customerCount,
        shipments: shipmentCount,
      },
      note: "Resumen de exportación mock. PII completa no se incluye en el artefacto.",
    };

    await ctx.admin
      .from("data_export_requests")
      .update({
        status: "completed",
        artifact_summary: summary,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", requestId);

    return {
      ok: true,
      action: "updated",
      entityType: "data_export_request",
      entityId: requestId,
      detail: "export_completed",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "export_failed";
    await ctx.admin
      .from("data_export_requests")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    throw err;
  }
};
