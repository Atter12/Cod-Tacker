import { PermanentJobError } from "@/lib/jobs/errors";
import { runAutomationsForTrigger } from "@/lib/automations/runner";
import type { JobHandler } from "@/lib/jobs/types";
import { z } from "zod";

const payloadSchema = z.object({
  order_id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  external_shipment_id: z.string().nullable().optional(),
});

export const handleFlipyBidStaleCheck: JobHandler = async ({ admin, job, payload }) => {
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo Flipy requiere store_id.");
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de verificación Flipy inválido.");
  }

  const shipment = await admin
    .from("shipments")
    .select("id, status, is_terminal, carrier_id, external_shipment_id")
    .eq("id", parsed.data.shipment_id)
    .eq("store_id", job.store_id)
    .maybeSingle();

  if (!shipment.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "shipment",
      entityId: parsed.data.shipment_id,
      detail: "shipment_not_found",
    };
  }

  const carrier = shipment.data.carrier_id
    ? await admin.from("carriers").select("code").eq("id", shipment.data.carrier_id).maybeSingle()
    : { data: null };
  const carrierCode = carrier.data?.code ?? null;
  if (carrierCode !== "flipy") {
    return {
      ok: true,
      action: "skipped",
      entityType: "shipment",
      entityId: shipment.data.id,
      detail: "not_flipy_carrier",
    };
  }

  if (shipment.data.is_terminal || shipment.data.status !== "created") {
    return {
      ok: true,
      action: "skipped",
      entityType: "shipment",
      entityId: shipment.data.id,
      detail: `status=${shipment.data.status}`,
    };
  }

  await runAutomationsForTrigger({
    admin,
    trigger: "shipment.status_changed",
    agencyId: job.agency_id,
    storeId: job.store_id,
    ctx: {
      orderId: parsed.data.order_id,
      shipmentId: shipment.data.id,
      shipmentStatus: shipment.data.status,
      carrierCode: "flipy",
      staleBidAlert: true,
      externalShipmentId:
        parsed.data.external_shipment_id ?? shipment.data.external_shipment_id ?? null,
      source: "flipy_stale_bid_check",
    },
    entityType: "shipment",
    entityId: shipment.data.id,
  });

  return {
    ok: true,
    action: "updated",
    entityType: "shipment",
    entityId: shipment.data.id,
    detail: "stale_bid_alert_dispatched",
  };
};
