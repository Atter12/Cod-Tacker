import { z } from "zod";
import { runAutomationsForTrigger } from "@/lib/automations/runner";
import { isNewlyDeliveredTerminal } from "@/lib/conversions/delivered-purchase-policy";
import { ENVIAME_DEFAULT_MAPPINGS } from "@/lib/integrations/enviame/map-status";
import { ENVIA_DEFAULT_MAPPINGS } from "@/lib/integrations/envia/map-status";
import { FLIPY_DEFAULT_MAPPINGS } from "@/lib/integrations/flipy/map-status";
import { normalizeFlipyOrderExternalId } from "@/lib/integrations/flipy/map-webhook";
import { enqueueFlipyStaleBidCheck } from "@/lib/integrations/flipy/enqueue-stale-bid-check";
import { patchOrderFlipyEnvioMeta } from "@/lib/integrations/flipy/order-flipy-meta";
import type { FlipyDevolucionInfo } from "@/lib/integrations/flipy/partner-contract";
import { revalidateFlipyWalletIntegrationPages } from "@/lib/integrations/flipy/revalidate-wallet-pages";
import { PermanentJobError } from "@/lib/jobs/errors";
import { applyShipmentEvent } from "@/lib/logistics/apply-shipment-event";
import type { CarrierMappingRule } from "@/lib/logistics/normalize";
import type { JobHandler, JobHandlerResult, JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

const SHIPMENT_STATUSES = [
  "created",
  "label_generated",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "rejected",
  "return_in_transit",
  "returned",
  "lost",
  "cancelled",
  "unknown",
] as const;

export const carrierShipmentUpdatedPayloadSchema = z.object({
  tracking_number: z.string().min(1).max(200),
  external_shipment_id: z.string().min(1).max(200).optional(),
  /** Preferred: raw carrier code for mapping. Fallback: already-normalized status. */
  external_status_code: z.string().min(1).max(200).optional(),
  external_status_label: z.string().min(1).max(200).optional(),
  status: z.enum(SHIPMENT_STATUSES).optional(),
  order_external_id: z.string().min(1).max(200).optional(),
  external_event_id: z.string().min(1).max(200).optional(),
  occurred_at: z.string().min(1).max(80).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  /** DB carriers.code — enviame / envia_com for live, mock_carrier for demos. */
  carrier_code: z.enum(["enviame", "envia_com", "flipy", "mock_carrier", "custom_carrier"]).optional(),
  mode: z.enum(["live", "mock"]).optional(),
  source: z.string().min(1).max(80).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de carrier no es un objeto válido.");
}

async function ensureCarrier(
  admin: JobsAdminClient,
  code: "enviame" | "envia_com" | "flipy" | "mock_carrier" | "custom_carrier",
): Promise<string> {
  const existing = await admin.from("carriers").select("id").eq("code", code).maybeSingle();
  if (existing.data) return existing.data.id;

  const isEnviame = code === "enviame";
  const isEnvia = code === "envia_com";
  const isFlipy = code === "flipy";
  const created = await admin
    .from("carriers")
    .insert({
      code,
      name: isEnviame
        ? "Enviame"
        : isEnvia
          ? "Envia.com"
          : isFlipy
            ? "Flipy"
            : code === "custom_carrier"
              ? "Custom Carrier"
              : "Mock Carrier",
      country_codes: isEnviame || isEnvia ? ["CL", "PE", "MX"] : ["PE"],
      is_active: true,
      is_aggregator: isEnviame || isEnvia,
      supports_polling: isEnviame || isEnvia,
      supports_webhooks: isEnviame || isEnvia || isFlipy,
      metadata: (isEnviame
        ? { live: true, docs: "https://docs.enviame.io/docs/webhooks/" }
        : isEnvia
          ? { live: true, docs: "https://docs.envia.com/docs/webhooks" }
          : isFlipy
            ? { live: true, partner: "codtracked" }
            : { demo: true }) as Json,
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new PermanentJobError("DATABASE_ERROR", `No se pudo asegurar el carrier ${code}.`);
  }
  return created.data.id;
}

async function loadMappings(admin: JobsAdminClient, carrierId: string): Promise<CarrierMappingRule[]> {
  const result = await admin
    .from("carrier_status_mappings")
    .select()
    .eq("carrier_id", carrierId)
    .eq("is_active", true);
  if (result.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudieron cargar los mapeos del transportista.");
  }
  return (result.data ?? []).map((row) => ({
    external_status_code: row.external_status_code,
    external_status_label: row.external_status_label,
    normalized_status: row.normalized_status,
    is_rto: row.is_rto,
    is_terminal: row.is_terminal,
    priority: row.priority,
    is_active: row.is_active,
  }));
}

async function upsertUnmappedStatus(
  admin: JobsAdminClient,
  input: {
    carrierId: string;
    agencyId: string;
    code: string;
    label?: string | null;
    payload: Json;
  },
) {
  const existing = await admin
    .from("unmapped_carrier_statuses")
    .select("id, occurrence_count")
    .eq("carrier_id", input.carrierId)
    .eq("external_status_code", input.code)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing.data) {
    await admin
      .from("unmapped_carrier_statuses")
      .update({
        occurrence_count: (existing.data.occurrence_count ?? 1) + 1,
        last_seen_at: now,
        external_status_label: input.label ?? null,
        sample_payload: input.payload,
        agency_id: input.agencyId,
      })
      .eq("id", existing.data.id);
    return;
  }

  await admin.from("unmapped_carrier_statuses").insert({
    carrier_id: input.carrierId,
    agency_id: input.agencyId,
    external_status_code: input.code,
    external_status_label: input.label ?? null,
    sample_payload: input.payload,
    occurrence_count: 1,
    first_seen_at: now,
    last_seen_at: now,
  });
}

export const handleCarrierShipmentUpdated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = carrierShipmentUpdatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError(
      "INVALID_PAYLOAD",
      "Payload de carrier.shipment.updated inválido.",
    );
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de envío requiere store_id.");
  }

  const data = parsed.data;
  const isLive =
    data.mode === "live" ||
    data.carrier_code === "enviame" ||
    data.carrier_code === "envia_com" ||
    data.carrier_code === "flipy" ||
    !job.job_type.endsWith(".mock");
  const carrierCode =
    data.carrier_code ?? (isLive ? "enviame" : "mock_carrier");
  const carrierId = await ensureCarrier(admin, carrierCode);
  const mappings = await loadMappings(admin, carrierId);

  // Prefer DB mappings; Enviame/Envia fall back to documented status codes; mock uses identity enums.
  const effectiveMappings: CarrierMappingRule[] =
    mappings.length > 0
      ? mappings
      : carrierCode === "enviame"
        ? [...ENVIAME_DEFAULT_MAPPINGS]
        : carrierCode === "envia_com"
          ? [...ENVIA_DEFAULT_MAPPINGS]
          : carrierCode === "flipy"
            ? [...FLIPY_DEFAULT_MAPPINGS]
            : SHIPMENT_STATUSES.map((status) => ({
              external_status_code: status,
              normalized_status: status,
              is_rto: status === "returned" || status === "return_in_transit",
              is_terminal: ["delivered", "returned", "lost", "cancelled"].includes(status),
              priority: 0,
              is_active: true,
            }));

  const externalCode = data.external_status_code ?? data.status ?? "unknown";

  let shipment = (
    await admin
      .from("shipments")
      .select()
      .eq("store_id", job.store_id)
      .eq("tracking_number", data.tracking_number)
      .maybeSingle()
  ).data;

  let orderId: string | null = shipment?.order_id ?? null;

  if (data.order_external_id) {
    const normalizedExternalId =
      carrierCode === "flipy"
        ? normalizeFlipyOrderExternalId(data.order_external_id) ?? data.order_external_id
        : data.order_external_id;
    const order = await admin
      .from("orders")
      .select("id")
      .eq("store_id", job.store_id)
      .eq("external_order_id", normalizedExternalId)
      .maybeSingle();
    if (order.data?.id) {
      // Prefer explicit external id; reject if it conflicts with an existing shipment link.
      if (orderId && orderId !== order.data.id) {
        throw new PermanentJobError(
          "ORDER_MISMATCH",
          "Carrier: order_external_id no coincide con el pedido del tracking existente.",
        );
      }
      orderId = order.data.id;
    } else if (isLive && !shipment) {
      throw new PermanentJobError(
        "ORDER_NOT_FOUND",
        "Carrier live: order_external_id no existe en la tienda. Crea el pedido o corrige el id.",
      );
    }
  }

  if (!shipment && !orderId && isLive) {
    throw new PermanentJobError(
      "ORDER_NOT_FOUND",
      "Carrier live: sin pedido/shipment para este tracking. Requiere order_external_id o un envío previo con el mismo tracking.",
    );
  }

  if (!orderId && !isLive) {
    const createdOrder = await admin
      .from("orders")
      .insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        external_order_id: data.order_external_id ?? `carrier-orphan-${data.tracking_number}`,
        order_number: data.tracking_number,
        created_at_source: new Date().toISOString(),
        currency_code: "PEN",
        subtotal_amount: 0,
        total_amount: 0,
        shipping_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        order_status: "shipped",
        confirmation_status: "confirmed",
        payment_status: "cash_expected",
        source_name: "carrier.mock",
        metadata: { demo: true, from_carrier_job: true } as Json,
        tags: ["jobs", "carrier", "mock"],
      })
      .select("id")
      .single();
    if (createdOrder.error || !createdOrder.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear pedido ancla para el envío.");
    }
    orderId = createdOrder.data.id;
  }

  if (!orderId) {
    throw new PermanentJobError(
      "ORDER_NOT_FOUND",
      "No se encontró pedido para el envío (sin fallback a último pedido).",
    );
  }

  if (!shipment) {
    const insert = await admin
      .from("shipments")
      .insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        order_id: orderId,
        carrier_id: carrierId,
        tracking_number: data.tracking_number,
        external_shipment_id: data.external_shipment_id ?? data.tracking_number,
        status: "created",
        is_rto: false,
        is_terminal: false,
        metadata: {
          demo: !isLive,
          demo_seed: data.demo_seed ?? null,
          job_id: job.id,
          source: data.source ?? (isLive ? (carrierCode === "flipy" ? "flipy" : "enviame") : "carrier.mock"),
        } as Json,
      })
      .select()
      .single();
    if (insert.error || !insert.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el envío.");
    }
    shipment = insert.data;

    if (
      isLive &&
      carrierCode === "flipy" &&
      (externalCode === "PENDIENTE_PUJAS" || externalCode === "BORRADOR")
    ) {
      try {
        await enqueueFlipyStaleBidCheck({
          admin,
          agencyId: job.agency_id,
          storeId: job.store_id,
          orderId,
          shipmentId: shipment.id,
          externalShipmentId: shipment.external_shipment_id,
          integrationId: job.integration_id,
        });
      } catch {
        // Non-blocking scheduling for stale-bid alert.
      }
    }
  }

  const occurredAt = data.occurred_at ?? new Date().toISOString();
  const eventExternalId =
    data.external_event_id ?? data.demo_seed ?? `${data.tracking_number}:${externalCode}:${occurredAt}`;

  const applied = await applyShipmentEvent({
    admin,
    shipment,
    externalStatusCode: externalCode,
    externalStatusLabel: data.external_status_label ?? data.status ?? null,
    externalEventId: eventExternalId,
    occurredAt,
    rawEventId: job.raw_event_id,
    payload: {
      demo: !isLive,
      demo_seed: data.demo_seed ?? null,
      job_id: job.id,
      source: data.source ?? null,
      mode: isLive ? "live" : "mock",
    } as Json,
    mappings: effectiveMappings,
  });

  if (applied.plan.unmapped) {
    await upsertUnmappedStatus(admin, {
      carrierId,
      agencyId: job.agency_id,
      code: externalCode,
      label: data.external_status_label ?? null,
      payload: payload,
    });
  }

  if (applied.skippedDuplicate) {
    return {
      ok: true,
      action: "skipped",
      entityType: "shipment_event",
      entityId: applied.eventId,
      detail: "duplicate_external_event_id",
    };
  }

  if (isLive && carrierCode === "flipy" && orderId) {
    try {
      const metadata = asObject(payload).metadata;
      const metadataBag =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)
          : {};
      const devolucionRaw = metadataBag.devolucion;
      const devolucion =
        devolucionRaw &&
        typeof devolucionRaw === "object" &&
        !Array.isArray(devolucionRaw)
          ? (devolucionRaw as FlipyDevolucionInfo)
          : undefined;
      await patchOrderFlipyEnvioMeta(admin, {
        orderId,
        storeId: job.store_id,
        estado: externalCode,
        envioId: data.external_shipment_id ?? data.tracking_number,
        trackingUrl:
          typeof metadataBag.tracking_url === "string" ? metadataBag.tracking_url : null,
        devolucion,
      });
    } catch {
      // Non-blocking metadata sync from carrier webhook.
    }
  }

  if (!applied.plan.skipStatusUpdate) {
    try {
      await runAutomationsForTrigger({
        admin,
        trigger: "shipment.status_changed",
        agencyId: job.agency_id,
        storeId: job.store_id,
        ctx: {
          orderId,
          shipmentId: applied.shipmentId,
          shipmentStatus: applied.plan.nextShipment.status,
          isRto: applied.plan.nextShipment.is_rto,
          source: "carrier",
        },
        entityType: "shipment",
        entityId: applied.shipmentId,
      });
      if (applied.plan.nextShipment.is_rto) {
        await runAutomationsForTrigger({
          admin,
          trigger: "shipment.rto",
          agencyId: job.agency_id,
          storeId: job.store_id,
          ctx: {
            orderId,
            shipmentId: applied.shipmentId,
            shipmentStatus: applied.plan.nextShipment.status,
            isRto: true,
            source: "carrier",
          },
          entityType: "shipment",
          entityId: applied.shipmentId,
        });
      }
    } catch {
      // Automations must not fail the carrier path.
    }
  }

  let capiDetail = "";
  if (
    isNewlyDeliveredTerminal({
      skippedDuplicate: false,
      skipStatusUpdate: applied.plan.skipStatusUpdate,
      normalizedStatus: applied.plan.normalize.normalizedStatus,
    })
  ) {
    // Dynamic import keeps this handler loadable in unit tests (server-only CAPI module).
    const { maybeRecordPurchaseOnDelivered } = await import(
      "@/lib/conversions/delivered-purchase"
    );
    const purchase = await maybeRecordPurchaseOnDelivered({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId,
      deliveredAt: occurredAt,
      shipmentId: applied.shipmentId,
      jobId: job.id,
    });
    if (purchase.attempted && purchase.conversion) {
      capiDetail = `:capi:${purchase.conversion.deliveryStatus}:${purchase.conversion.eventId}`;
    } else if (purchase.skippedReason) {
      capiDetail = `:capi_skip:${purchase.skippedReason}`;
    }

    if (isLive && carrierCode === "flipy") {
      await revalidateFlipyWalletIntegrationPages(admin, job.agency_id, job.store_id);
    }
  }

  return {
    ok: true,
    action: "updated",
    entityType: "shipment",
    entityId: applied.shipmentId,
    detail: applied.plan.conflict
      ? `event:${applied.eventId}:terminal_conflict${capiDetail}`
      : `event:${applied.eventId}${capiDetail}`,
  };
};
