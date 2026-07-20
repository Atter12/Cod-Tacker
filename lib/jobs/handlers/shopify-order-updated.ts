import { PermanentJobError, RetryableJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import {
  ORDER_STATUSES,
  shopifyOrderUpdatedPayloadSchema,
} from "@/lib/jobs/handlers/shopify-order-payload";
import { syncShopifyOrderItems } from "@/lib/jobs/handlers/shopify-sync-order-items";
import { upsertShopifyCustomer } from "@/lib/jobs/handlers/shopify-upsert-customer";
import { upsertShopifyOrderAttribution } from "@/lib/jobs/handlers/shopify-upsert-attribution";
import { shouldApplyShopifyPaymentSync } from "@/lib/integrations/shopify/map-payment";
import { orderContactMetadataPatch } from "@/lib/conversions/resolve-order-contact";
import type { Json } from "@/types/database.generated";

export { shopifyOrderUpdatedPayloadSchema };

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
    .select("id, order_status, customer_id, payment_status, expected_cod_amount, metadata")
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

  const customerId = data.customer
    ? await upsertShopifyCustomer({
        admin,
        storeId: job.store_id,
        customer: data.customer,
      })
    : null;

  const live = data.mode === "live" || job.job_type === "shopify.order.updated";
  const shipping = data.shipping;
  const canSyncPayment = shouldApplyShopifyPaymentSync(existing.data.payment_status);
  const patch: {
    order_status?: (typeof ORDER_STATUSES)[number];
    total_amount?: number;
    subtotal_amount?: number;
    shipping_amount?: number;
    expected_cod_amount?: number | null;
    payment_status?: "cash_expected" | "unpaid" | "refunded";
    customer_id?: string;
    shipping_country_code?: string;
    shipping_region?: string;
    shipping_city?: string;
    shipping_district?: string;
    shipping_postal_code?: string;
    metadata: Json;
  } = {
    metadata: {
      ...meta,
      last_update_seed: data.demo_seed ?? null,
      last_job_id: job.id,
      event: live ? "shopify.order.updated" : "shopify.order.updated.mock",
      mode: live ? "live" : "mock",
      ...(data.payment_kind ? { shopify_payment_kind: data.payment_kind } : {}),
      ...orderContactMetadataPatch(data.customer),
    } as Json,
  };
  if (data.order_status) patch.order_status = data.order_status;
  if (typeof data.total_amount === "number") {
    patch.total_amount = data.total_amount;
  }
  if (typeof data.subtotal_amount === "number") {
    patch.subtotal_amount = data.subtotal_amount;
  }
  if (typeof data.shipping_amount === "number") {
    patch.shipping_amount = data.shipping_amount;
  }

  if (canSyncPayment) {
    if (data.payment_status) {
      patch.payment_status = data.payment_status;
    }
    if (data.expected_cod_amount !== undefined) {
      patch.expected_cod_amount = data.expected_cod_amount;
    } else if (typeof data.total_amount === "number") {
      // Only refresh COD expected when still in a Shopify-owned payment state and kind is COD.
      const kind =
        data.payment_kind ??
        (typeof meta.shopify_payment_kind === "string" ? meta.shopify_payment_kind : null);
      const treatsAsCod =
        kind === "cod" ||
        (!kind &&
          (existing.data.payment_status === "cash_expected" ||
            (existing.data.expected_cod_amount != null &&
              Number(existing.data.expected_cod_amount) > 0)));
      patch.expected_cod_amount = treatsAsCod ? data.total_amount : null;
    }
  }

  if (customerId && (!existing.data.customer_id || existing.data.customer_id !== customerId)) {
    patch.customer_id = customerId;
  }
  if (shipping?.country_code) patch.shipping_country_code = shipping.country_code;
  if (shipping?.region) patch.shipping_region = shipping.region;
  if (shipping?.city) patch.shipping_city = shipping.city;
  if (shipping?.district) patch.shipping_district = shipping.district;
  if (shipping?.postal_code) patch.shipping_postal_code = shipping.postal_code;

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

  if (data.line_items) {
    await syncShopifyOrderItems({
      admin,
      storeId: job.store_id,
      orderId: existing.data.id,
      lineItems: data.line_items,
    });
  }

  if (data.attribution) {
    await upsertShopifyOrderAttribution({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId: existing.data.id,
      customerId: customerId ?? existing.data.customer_id,
      attributedValue:
        typeof data.total_amount === "number" ? data.total_amount : undefined,
      attribution: data.attribution,
    });
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
