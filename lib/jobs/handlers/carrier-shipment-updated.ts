import { z } from "zod";
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
  occurred_at: z.string().min(1).max(40).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de carrier no es un objeto válido.");
}

async function ensureCarrier(admin: JobsAdminClient): Promise<string> {
  const existing = await admin.from("carriers").select("id").eq("code", "mock_carrier").maybeSingle();
  if (existing.data) return existing.data.id;
  const created = await admin
    .from("carriers")
    .insert({
      code: "mock_carrier",
      name: "Mock Carrier",
      country_codes: ["PE"],
      is_active: true,
      is_aggregator: false,
      supports_polling: true,
      metadata: { demo: true } as Json,
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo asegurar el carrier mock.");
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
      "Payload de carrier.shipment.updated.mock inválido.",
    );
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de envío requiere store_id.");
  }

  const data = parsed.data;
  const carrierId = await ensureCarrier(admin);
  const mappings = await loadMappings(admin, carrierId);

  // If no DB mappings yet, synthesize identity mappings from known enum statuses
  // so mock payloads with `status` continue to work.
  const effectiveMappings: CarrierMappingRule[] =
    mappings.length > 0
      ? mappings
      : SHIPMENT_STATUSES.map((status) => ({
          external_status_code: status,
          normalized_status: status,
          is_rto: status === "returned" || status === "return_in_transit",
          is_terminal: ["delivered", "returned", "lost", "cancelled"].includes(status),
          priority: 0,
          is_active: true,
        }));

  const externalCode = data.external_status_code ?? data.status ?? "unknown";

  let orderId: string | null = null;
  if (data.order_external_id) {
    const order = await admin
      .from("orders")
      .select("id")
      .eq("store_id", job.store_id)
      .eq("external_order_id", data.order_external_id)
      .maybeSingle();
    orderId = order.data?.id ?? null;
  }
  if (!orderId) {
    const anyOrder = await admin
      .from("orders")
      .select("id")
      .eq("store_id", job.store_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    orderId = anyOrder.data?.id ?? null;
  }
  if (!orderId) {
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

  let shipment = (
    await admin
      .from("shipments")
      .select()
      .eq("store_id", job.store_id)
      .eq("tracking_number", data.tracking_number)
      .maybeSingle()
  ).data;

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
          demo: true,
          demo_seed: data.demo_seed ?? null,
          job_id: job.id,
        } as Json,
      })
      .select()
      .single();
    if (insert.error || !insert.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el envío mock.");
    }
    shipment = insert.data;
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
      demo: true,
      demo_seed: data.demo_seed ?? null,
      job_id: job.id,
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

  return {
    ok: true,
    action: "updated",
    entityType: "shipment",
    entityId: applied.shipmentId,
    detail: applied.plan.conflict
      ? `event:${applied.eventId}:terminal_conflict`
      : `event:${applied.eventId}`,
  };
};
