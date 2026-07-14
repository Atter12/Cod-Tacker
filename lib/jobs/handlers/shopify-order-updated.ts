import { z } from "zod";
import { PermanentJobError, RetryableJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

const ORDER_STATUSES = [
  "created",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "rejected",
  "return_in_transit",
  "returned",
  "lost",
  "closed",
] as const;

export const shopifyOrderUpdatedPayloadSchema = z.object({
  external_order_id: z.string().min(1).max(200),
  order_status: z.enum(ORDER_STATUSES).optional(),
  total_amount: z.number().nonnegative().optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload del pedido no es un objeto válido.");
}

export const handleShopifyOrderUpdated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = shopifyOrderUpdatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de actualización Shopify inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de pedido requiere store_id.");
  }

  const data = parsed.data;
  const existing = await admin
    .from("orders")
    .select("id, order_status, metadata")
    .eq("store_id", job.store_id)
    .eq("external_order_id", data.external_order_id)
    .maybeSingle();
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo consultar el pedido.");
  }
  if (!existing.data) {
    throw new RetryableJobError(
      "ORDER_NOT_FOUND",
      "No existe el pedido a actualizar; se reintentará tras el create.",
    );
  }

  const meta =
    existing.data.metadata && typeof existing.data.metadata === "object"
      ? (existing.data.metadata as Record<string, unknown>)
      : {};
  if (
    data.demo_seed &&
    typeof meta.last_update_seed === "string" &&
    meta.last_update_seed === data.demo_seed
  ) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: existing.data.id,
      detail: "duplicate_demo_seed",
    };
  }

  const live = data.mode === "live" || job.job_type === "shopify.order.updated";
  const patch: {
    order_status?: (typeof ORDER_STATUSES)[number];
    total_amount?: number;
    expected_cod_amount?: number;
    metadata: Json;
  } = {
    metadata: {
      ...meta,
      last_update_seed: data.demo_seed ?? null,
      last_job_id: job.id,
      event: live ? "shopify.order.updated" : "shopify.order.updated.mock",
      mode: live ? "live" : "mock",
    } as Json,
  };
  if (data.order_status) patch.order_status = data.order_status;
  if (typeof data.total_amount === "number") {
    patch.total_amount = data.total_amount;
    patch.expected_cod_amount = data.total_amount;
  }

  const update = await admin
    .from("orders")
    .update(patch)
    .eq("id", existing.data.id)
    .eq("store_id", job.store_id)
    .select("id")
    .single();
  if (update.error || !update.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el pedido Shopify.");
  }

  if (data.order_status && data.order_status !== existing.data.order_status) {
    await admin.from("order_status_history").insert({
      store_id: job.store_id,
      order_id: existing.data.id,
      previous_status: existing.data.order_status,
      new_status: data.order_status,
      occurred_at: new Date().toISOString(),
      reason_code: live ? "jobs_shopify_update" : "jobs_mock_update",
      reason_detail: live
        ? "Actualización Shopify desde jobs processor"
        : "Actualización mock desde jobs processor",
      metadata: { job_id: job.id, demo: !live, mode: live ? "live" : "mock" } as Json,
    });
  }

  return {
    ok: true,
    action: "updated",
    entityType: "order",
    entityId: update.data.id,
  };
};
