import { PermanentJobError } from "@/lib/jobs/errors";
import {
  planShipmentEventApply,
  type CarrierMappingRule,
  type ShipmentEventApplyPlan,
} from "@/lib/logistics/normalize";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";
import type { ShipmentRow } from "@/types/database";

export type ApplyShipmentEventInput = {
  admin: JobsAdminClient;
  shipment: ShipmentRow;
  externalStatusCode: string;
  externalStatusLabel?: string | null;
  externalEventId?: string | null;
  occurredAt: string;
  receivedAt?: string;
  rawEventId?: string | null;
  payload?: Json;
  mappings: CarrierMappingRule[];
};

export type ApplyShipmentEventResult = {
  plan: ShipmentEventApplyPlan;
  eventId: string;
  skippedDuplicate: boolean;
  shipmentId: string;
};

/**
 * Idempotent apply: insert shipment_event (by external_event_id), update shipment,
 * optionally patch order. Never sets payment settled on deliver.
 */
export async function applyShipmentEvent(
  input: ApplyShipmentEventInput,
): Promise<ApplyShipmentEventResult> {
  const { admin, shipment } = input;
  const plan = planShipmentEventApply({
    shipment: {
      id: shipment.id,
      status: shipment.status,
      is_terminal: shipment.is_terminal,
      is_rto: shipment.is_rto,
      delivery_attempts: shipment.delivery_attempts,
      last_event_at: shipment.last_event_at,
      metadata: shipment.metadata,
      order_id: shipment.order_id,
      store_id: shipment.store_id,
      agency_id: shipment.agency_id,
      carrier_id: shipment.carrier_id,
    },
    externalStatusCode: input.externalStatusCode,
    externalStatusLabel: input.externalStatusLabel,
    externalEventId: input.externalEventId,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    rawEventId: input.rawEventId,
    payload: input.payload,
    mappings: input.mappings,
  });

  if (input.externalEventId) {
    const existing = await admin
      .from("shipment_events")
      .select("id")
      .eq("store_id", shipment.store_id)
      .eq("shipment_id", shipment.id)
      .eq("external_event_id", input.externalEventId)
      .maybeSingle();
    if (existing.data) {
      return {
        plan,
        eventId: existing.data.id,
        skippedDuplicate: true,
        shipmentId: shipment.id,
      };
    }
  }

  const eventInsert = await admin
    .from("shipment_events")
    .insert({
      agency_id: shipment.agency_id,
      store_id: shipment.store_id,
      shipment_id: shipment.id,
      carrier_id: shipment.carrier_id,
      external_event_id: plan.eventInsert.external_event_id,
      external_status_code: plan.eventInsert.external_status_code,
      external_status_label: plan.eventInsert.external_status_label,
      normalized_status: plan.eventInsert.normalized_status,
      occurred_at: plan.eventInsert.occurred_at,
      received_at: plan.eventInsert.received_at,
      raw_event_id: plan.eventInsert.raw_event_id,
      payload: plan.eventInsert.payload,
    })
    .select("id")
    .single();
  if (eventInsert.error || !eventInsert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo registrar el evento de envío.");
  }

  const shipmentUpdate = {
    status: plan.nextShipment.status,
    is_terminal: plan.nextShipment.is_terminal,
    is_rto: plan.nextShipment.is_rto,
    delivery_attempts: plan.nextShipment.delivery_attempts,
    last_event_at: plan.nextShipment.last_event_at,
    metadata: plan.nextShipment.metadata,
    ...(plan.nextShipment.delivered_at ? { delivered_at: plan.nextShipment.delivered_at } : {}),
    ...(plan.nextShipment.returned_at ? { returned_at: plan.nextShipment.returned_at } : {}),
    ...(plan.nextShipment.first_attempt_at
      ? { first_attempt_at: plan.nextShipment.first_attempt_at }
      : {}),
  };

  const updated = await admin
    .from("shipments")
    .update(shipmentUpdate)
    .eq("id", shipment.id)
    .eq("store_id", shipment.store_id);
  if (updated.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el envío.");
  }

  if (plan.orderPatch) {
    // Never touch payment_status / settled_* on deliver — orderPatch type forbids it.
    const patch = { ...plan.orderPatch };
    const orderUpdate = await admin
      .from("orders")
      .update(patch)
      .eq("id", shipment.order_id)
      .eq("store_id", shipment.store_id);
    if (orderUpdate.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el pedido vinculado.");
    }
  }

  return {
    plan,
    eventId: eventInsert.data.id,
    skippedDuplicate: false,
    shipmentId: shipment.id,
  };
}
