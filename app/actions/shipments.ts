"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import {
  getScenario,
  occurredAtForStep,
  SCENARIO_DELIVERED,
} from "@/lib/logistics/mock-scenarios";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getShipmentById } from "@/services/shipments.service";
import type { Json } from "@/types/database.generated";

export type ShipmentActionResult = ActionResult<{
  jobId?: string;
  rawEventId?: string;
  alertId?: string;
}>;

function assertShipmentsManage(roles: readonly Role[]) {
  if (!can(roles, "shipments.manage") && !can(roles, "orders.manage")) {
    throw new ValidationError("No tienes permiso para gestionar envíos.");
  }
}

function revalidateShipment(agencySlug: string, storeSlug: string, shipmentId: string) {
  revalidatePath(routes.store.logistics(agencySlug, storeSlug));
  revalidatePath(routes.store.shipmentDetail(agencySlug, storeSlug, shipmentId));
}

/**
 * Simulate next mock carrier event for a shipment: enqueues raw_event + job.
 */
export async function simulateShipmentMockEvent(
  agencySlug: string,
  storeSlug: string,
  shipmentId: string,
  scenarioId = "delivered",
): Promise<ShipmentActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertShipmentsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }

    const client = await createClient();
    const shipment = await getShipmentById(client, membership.storeId, shipmentId);
    if (!shipment) throw new ValidationError("Envío no encontrado.");

    const scenario = getScenario(scenarioId) ?? SCENARIO_DELIVERED;
    const meta =
      shipment.metadata && typeof shipment.metadata === "object" && !Array.isArray(shipment.metadata)
        ? (shipment.metadata as Record<string, unknown>)
        : {};
    const currentIndex =
      typeof meta.mock_scenario_index === "number" ? meta.mock_scenario_index : 0;
    const step = scenario.steps[Math.min(currentIndex, scenario.steps.length - 1)];
    if (!step) throw new ValidationError("Escenario mock sin pasos.");

    const baseIso =
      typeof meta.mock_scenario_base === "string"
        ? meta.mock_scenario_base
        : shipment.created_at;
    const occurredAt = occurredAtForStep(baseIso, step);
    const idempotencyKey = `mock-carrier:${shipment.id}:${scenario.id}:${currentIndex}:${step.externalStatusCode}`;

    const admin = createAdminClient();
    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      provider: "custom_carrier",
      eventType: "carrier.shipment.updated.mock",
      jobType: "carrier.shipment.updated.mock",
      idempotencyKey,
      correlationId: crypto.randomUUID(),
      externalEventId: idempotencyKey,
      payload: {
        tracking_number: shipment.tracking_number ?? shipment.id,
        external_shipment_id: shipment.external_shipment_id,
        external_status_code: step.externalStatusCode,
        external_status_label: step.externalStatusLabel,
        occurred_at: occurredAt,
        demo_seed: idempotencyKey,
        scenario_id: scenario.id,
        scenario_step: currentIndex,
      } as Json,
    });

    await client
      .from("shipments")
      .update({
        metadata: {
          ...meta,
          mock_scenario_id: scenario.id,
          mock_scenario_base: baseIso,
          mock_scenario_index: Math.min(currentIndex + 1, scenario.steps.length),
        } as Json,
      })
      .eq("id", shipment.id)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "shipment_mock_event_enqueued",
      entityType: "shipment",
      entityId: shipment.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: {
        job_id: enqueued.jobId,
        raw_event_id: enqueued.rawEventId,
        scenario_id: scenario.id,
        step: step.externalStatusCode,
      },
    });

    revalidateShipment(agencySlug, storeSlug, shipmentId);
    return actionOk({ jobId: enqueued.jobId, rawEventId: enqueued.rawEventId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function createShipmentAlert(
  agencySlug: string,
  storeSlug: string,
  shipmentId: string,
  title: string,
  body?: string,
): Promise<ShipmentActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertShipmentsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }
    const trimmed = title.trim();
    if (!trimmed) throw new ValidationError("El título de la alerta es obligatorio.");

    const client = await createClient();
    const shipment = await getShipmentById(client, membership.storeId, shipmentId);
    if (!shipment) throw new ValidationError("Envío no encontrado.");

    const insert = await client
      .from("alerts")
      .insert({
        agency_id: membership.agencyId,
        store_id: membership.storeId,
        shipment_id: shipment.id,
        order_id: shipment.order_id,
        type: "shipment_review",
        severity: "warning",
        title: trimmed.slice(0, 200),
        body: body?.trim().slice(0, 2000) ?? null,
        data: { source: "manual" } as Json,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) {
      return actionFail(insert.error ?? new ValidationError("No se pudo crear la alerta."));
    }

    await writeAuditLog({
      action: "shipment_alert_created",
      entityType: "alert",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { title: trimmed, shipment_id: shipment.id },
    });

    revalidateShipment(agencySlug, storeSlug, shipmentId);
    return actionOk({ alertId: insert.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function markShipmentForReview(
  agencySlug: string,
  storeSlug: string,
  shipmentId: string,
  reason?: string,
): Promise<ShipmentActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertShipmentsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }

    const client = await createClient();
    const shipment = await getShipmentById(client, membership.storeId, shipmentId);
    if (!shipment) throw new ValidationError("Envío no encontrado.");

    const meta =
      shipment.metadata && typeof shipment.metadata === "object" && !Array.isArray(shipment.metadata)
        ? (shipment.metadata as Record<string, unknown>)
        : {};

    const { error } = await client
      .from("shipments")
      .update({
        metadata: {
          ...meta,
          needs_review: true,
          review_reason: reason?.trim().slice(0, 500) ?? "Marcado para revisión manual",
          reviewed_at: null,
          marked_for_review_at: new Date().toISOString(),
          marked_for_review_by: user.id,
        } as Json,
      })
      .eq("id", shipment.id)
      .eq("store_id", membership.storeId);
    if (error) return actionFail(error);

    await writeAuditLog({
      action: "shipment_marked_for_review",
      entityType: "shipment",
      entityId: shipment.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { reason: reason ?? null },
    });

    revalidateShipment(agencySlug, storeSlug, shipmentId);
    return actionOk({ });
  } catch (error) {
    return actionFail(error);
  }
}
