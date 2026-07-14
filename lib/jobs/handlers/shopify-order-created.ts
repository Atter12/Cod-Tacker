import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const shopifyOrderCreatedPayloadSchema = z.object({
  external_order_id: z.string().min(1).max(200),
  order_number: z.string().min(1).max(100).optional(),
  currency_code: z.string().length(3).default("PEN"),
  total_amount: z.number().nonnegative().default(0),
  subtotal_amount: z.number().nonnegative().optional(),
  order_status: z
    .enum([
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
    ])
    .optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload del pedido no es un objeto válido.");
}

export const handleShopifyOrderCreated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = shopifyOrderCreatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de pedido Shopify inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de pedido requiere store_id.");
  }

  const data = parsed.data;
  const existing = await admin
    .from("orders")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("external_order_id", data.external_order_id)
    .maybeSingle();
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo consultar el pedido existente.");
  }
  if (existing.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: existing.data.id,
      detail: "duplicate_external_order_id",
    };
  }

  if (data.demo_seed) {
    const bySeed = await admin
      .from("orders")
      .select("id")
      .eq("store_id", job.store_id)
      .contains("metadata", { demo_seed: data.demo_seed })
      .maybeSingle();
    if (bySeed.data) {
      return {
        ok: true,
        action: "skipped",
        entityType: "order",
        entityId: bySeed.data.id,
        detail: "duplicate_demo_seed",
      };
    }
  }

  const now = new Date().toISOString();
  const total = data.total_amount;
  const live = data.mode === "live" || job.job_type === "shopify.order.created";
  const insert = await admin
    .from("orders")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      external_order_id: data.external_order_id,
      order_number: data.order_number ?? data.external_order_id,
      created_at_source: now,
      currency_code: data.currency_code,
      subtotal_amount: data.subtotal_amount ?? total,
      total_amount: total,
      shipping_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      order_status: data.order_status ?? "created",
      confirmation_status: "not_requested",
      payment_status: "cash_expected",
      expected_cod_amount: total,
      source_name: live ? "shopify" : "shopify.mock",
      metadata: {
        demo: !live,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
        event: live ? "shopify.order.created" : "shopify.order.created.mock",
        mode: live ? "live" : "mock",
      } as Json,
      tags: live ? ["jobs", "shopify", "live"] : ["jobs", "shopify", "mock"],
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") {
      const again = await admin
        .from("orders")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("external_order_id", data.external_order_id)
        .maybeSingle();
      if (again.data) {
        return {
          ok: true,
          action: "skipped",
          entityType: "order",
          entityId: again.data.id,
          detail: "race_duplicate",
        };
      }
    }
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el pedido Shopify.");
  }

  return {
    ok: true,
    action: "created",
    entityType: "order",
    entityId: insert.data.id,
  };
};
