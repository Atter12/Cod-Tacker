import { PermanentJobError } from "@/lib/jobs/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { enqueueFlipyStaleBidCheck } from "@/lib/integrations/flipy/enqueue-stale-bid-check";
import type { FlipyLifecycleJobPayload } from "@/lib/integrations/flipy/map-lifecycle-webhook";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";
import { z } from "zod";

const assignedMotorizadoSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().nullable().optional(),
    etaMinutes: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const payloadSchema = z.object({
  event_type: z.enum([
    "shipment.created",
    "shipment.assigned",
    "shipment.smart_fallback_to_bid",
  ]),
  envio_id: z.string().min(1),
  external_order_id: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  tracking_token: z.string().nullable().optional(),
  tracking_url: z.string().nullable().optional(),
  fulfillment_mode: z.enum(["smart", "bid"]).nullable().optional(),
  escenario_pago: z.string().nullable().optional(),
  assigned_motorizado: assignedMotorizadoSchema,
  flete_quote: z.record(z.string(), z.unknown()).nullable().optional(),
  payment_breakdown: z.record(z.string(), z.unknown()).nullable().optional(),
  occurred_at: z.string().min(1),
  external_event_id: z.string().min(1),
  carrier_payload: z.record(z.string(), z.unknown()).nullable().optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "Payload lifecycle Flipy inválido.");
}

async function findOrderId(
  admin: Parameters<JobHandler>[0]["admin"],
  storeId: string,
  externalOrderId: string | null | undefined,
  envioId: string,
): Promise<string | null> {
  if (externalOrderId) {
    const byExternal = await admin
      .from("orders")
      .select("id")
      .eq("store_id", storeId)
      .eq("external_order_id", externalOrderId)
      .maybeSingle();
    if (byExternal.data?.id) return byExternal.data.id;
  }

  const byMeta = await admin
    .from("orders")
    .select("id, metadata")
    .eq("store_id", storeId)
    .contains("metadata", { flipy_envio_id: envioId })
    .maybeSingle();
  return byMeta.data?.id ?? null;
}

async function patchOrderFlipyLifecycleMeta(
  admin: Parameters<JobHandler>[0]["admin"],
  orderId: string,
  storeId: string,
  patch: Record<string, unknown>,
) {
  const orderRes = await admin
    .from("orders")
    .select("metadata")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!orderRes.data) return;

  const meta =
    orderRes.data.metadata && typeof orderRes.data.metadata === "object" && !Array.isArray(orderRes.data.metadata)
      ? (orderRes.data.metadata as Record<string, unknown>)
      : {};

  const paymentBag =
    meta.shopify_flipy_payment &&
    typeof meta.shopify_flipy_payment === "object" &&
    !Array.isArray(meta.shopify_flipy_payment)
      ? (meta.shopify_flipy_payment as Record<string, unknown>)
      : {};

  const now = new Date().toISOString();
  const paymentOverride =
    patch.shopify_flipy_payment &&
    typeof patch.shopify_flipy_payment === "object" &&
    !Array.isArray(patch.shopify_flipy_payment)
      ? (patch.shopify_flipy_payment as Record<string, unknown>)
      : {};

  const nextMeta = {
    ...meta,
    ...patch,
    shopify_flipy_payment: {
      ...paymentBag,
      ...paymentOverride,
      lastWebhookAt: now,
    },
    flipy_webhook: {
      ...(typeof meta.flipy_webhook === "object" &&
      meta.flipy_webhook &&
      !Array.isArray(meta.flipy_webhook)
        ? (meta.flipy_webhook as Record<string, unknown>)
        : {}),
      lastEventType: patch.lastEventType ?? null,
      lastEventAt: now,
    },
  };

  await admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", orderId)
    .eq("store_id", storeId);
}

async function createLifecycleAlert(input: {
  admin: Parameters<JobHandler>[0]["admin"];
  agencyId: string;
  storeId: string;
  orderId: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}) {
  await input.admin.from("alerts").insert({
    agency_id: input.agencyId,
    store_id: input.storeId,
    order_id: input.orderId,
    title: input.title,
    body: input.body,
    severity: input.severity,
    type: "flipy_shipment_lifecycle",
    status: "open",
    source_type: "flipy_webhook",
    data: (input.data ?? {}) as Json,
  });
}

async function enqueueCarrierSync(
  admin: Parameters<JobHandler>[0]["admin"],
  input: {
    agencyId: string;
    storeId: string;
    integrationId: string | null;
    carrierPayload: Record<string, unknown>;
    externalEventId: string;
  },
) {
  const idempotencyKey = `flipy:wh:carrier:${input.externalEventId}`;
  await enqueueRawEventAndJob(admin, {
    agencyId: input.agencyId,
    storeId: input.storeId,
    integrationId: input.integrationId,
    provider: "flipy",
    eventType: "carrier.shipment.updated",
    jobType: "carrier.shipment.updated",
    idempotencyKey,
    externalEventId: input.externalEventId,
    payload: input.carrierPayload as Json,
  });
}

export const handleFlipyShipmentLifecycle: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo lifecycle Flipy requiere store_id.");
  }

  const parsed = payloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload lifecycle Flipy inválido.");
  }

  const data = parsed.data as FlipyLifecycleJobPayload;
  const orderId = await findOrderId(admin, job.store_id, data.external_order_id, data.envio_id);

  if (!orderId) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: data.envio_id,
      detail: "order_not_found",
    };
  }

  const metaPatch: Record<string, unknown> = {
    lastEventType: data.event_type,
    flipy_envio_id: data.envio_id,
  };
  if (data.estado) metaPatch.flipy_estado = data.estado;
  if (data.tracking_url) metaPatch.flipy_tracking_url = data.tracking_url;
  if (data.tracking_token) metaPatch.flipy_tracking_token = data.tracking_token;

  const paymentPatch: Record<string, unknown> = {};
  if (data.fulfillment_mode) paymentPatch.fulfillmentMode = data.fulfillment_mode;
  if (data.flete_quote) paymentPatch.fleteQuote = data.flete_quote;
  if (data.escenario_pago) paymentPatch.confirmedEscenario = data.escenario_pago;
  if (data.payment_breakdown) paymentPatch.paymentBreakdown = data.payment_breakdown;

  if (data.event_type === "shipment.created") {
    await patchOrderFlipyLifecycleMeta(admin, orderId, job.store_id, {
      ...metaPatch,
      shopify_flipy_payment: paymentPatch,
    });
  }

  if (data.event_type === "shipment.assigned") {
    if (data.assigned_motorizado) {
      metaPatch.flipy_assigned_motorizado = data.assigned_motorizado;
      paymentPatch.assignedMotorizado = data.assigned_motorizado;
    }
    await patchOrderFlipyLifecycleMeta(admin, orderId, job.store_id, {
      ...metaPatch,
      shopify_flipy_payment: paymentPatch,
    });
  }

  if (data.event_type === "shipment.smart_fallback_to_bid") {
    paymentPatch.fulfillmentMode = "bid";
    paymentPatch.smartFallbackToBid = true;
    await patchOrderFlipyLifecycleMeta(admin, orderId, job.store_id, {
      ...metaPatch,
      shopify_flipy_payment: paymentPatch,
    });
    await createLifecycleAlert({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId,
      title: "Flipy: sin motorizado — modo puja",
      body:
        "La asignación automática no encontró motorizado. El envío pasó a PENDIENTE_PUJAS — revisa pujas en Flipy.",
      severity: "warning",
      data: {
        envioId: data.envio_id,
        eventType: data.event_type,
        fulfillmentMode: "bid",
      },
    });
  }

  if (data.carrier_payload) {
    await enqueueCarrierSync(admin, {
      agencyId: job.agency_id,
      storeId: job.store_id,
      integrationId: job.integration_id,
      carrierPayload: data.carrier_payload as Record<string, unknown>,
      externalEventId: `${data.external_event_id}:carrier`,
    });
  }

  if (
    data.event_type === "shipment.smart_fallback_to_bid" &&
    data.estado === "PENDIENTE_PUJAS"
  ) {
    const shipment = await admin
      .from("shipments")
      .select("id")
      .eq("store_id", job.store_id)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (shipment.data?.id) {
      try {
        await enqueueFlipyStaleBidCheck({
          admin,
          agencyId: job.agency_id,
          storeId: job.store_id,
          orderId,
          shipmentId: shipment.data.id,
          externalShipmentId: data.envio_id,
          integrationId: job.integration_id,
        });
      } catch {
        // Non-blocking.
      }
    }
  }

  return {
    ok: true,
    action: "updated",
    entityType: "order",
    entityId: orderId,
    detail: `${data.event_type}:${data.envio_id}`,
  };
};
