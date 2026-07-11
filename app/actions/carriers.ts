"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { applyMapping, type CarrierMappingRule } from "@/lib/logistics/normalize";
import { createClient } from "@/lib/supabase/server";
import {
  createCarrierMapping,
  deleteCarrierMapping,
  getCarrierMapping,
  insertMappingVersion,
  listCarrierMappings,
  updateCarrierMapping,
} from "@/services/carriers.service";
import type { Enums, Json } from "@/types/database.generated";

export type CarrierActionResult = ActionResult<{
  id?: string;
  normalize?: {
    mapped: boolean;
    normalizedStatus: string;
    isRto: boolean;
    isTerminal: boolean;
  };
}>;

const SHIPMENT_STATUSES: Enums<"shipment_status">[] = [
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
];

function revalidateCarrier(carrierId: string) {
  revalidatePath(routes.admin.carriers);
  revalidatePath(routes.admin.carrierDetail(carrierId));
  revalidatePath(routes.admin.carrierMappings(carrierId));
}

export async function createMappingAction(input: {
  carrierId: string;
  externalStatusCode: string;
  externalStatusLabel?: string;
  normalizedStatus: string;
  isRto?: boolean;
  isTerminal?: boolean;
  priority?: number;
  notes?: string;
}): Promise<CarrierActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    if (!SHIPMENT_STATUSES.includes(input.normalizedStatus as Enums<"shipment_status">)) {
      throw new ValidationError("Estado normalizado inválido.");
    }
    const client = await createClient();
    const row = await createCarrierMapping(client, {
      carrierId: input.carrierId,
      externalStatusCode: input.externalStatusCode,
      externalStatusLabel: input.externalStatusLabel,
      normalizedStatus: input.normalizedStatus as Enums<"shipment_status">,
      isRto: input.isRto,
      isTerminal: input.isTerminal,
      priority: input.priority,
      notes: input.notes,
      createdBy: admin.id,
    });
    await insertMappingVersion(client, {
      mappingId: row.id,
      snapshot: row as unknown as Json,
      changedBy: admin.id,
      changeReason: "create",
    });
    await writeAuditLog({
      action: "carrier_mapping_created",
      entityType: "carrier_status_mapping",
      entityId: row.id,
      actorId: admin.id,
      newData: row as unknown as Json,
    });
    revalidateCarrier(input.carrierId);
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateMappingAction(input: {
  carrierId: string;
  mappingId: string;
  externalStatusCode?: string;
  externalStatusLabel?: string | null;
  normalizedStatus?: string;
  isRto?: boolean;
  isTerminal?: boolean;
  priority?: number;
  isActive?: boolean;
  notes?: string | null;
  changeReason?: string;
}): Promise<CarrierActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    if (
      input.normalizedStatus &&
      !SHIPMENT_STATUSES.includes(input.normalizedStatus as Enums<"shipment_status">)
    ) {
      throw new ValidationError("Estado normalizado inválido.");
    }
    const client = await createClient();
    const existing = await getCarrierMapping(client, input.mappingId);
    if (!existing || existing.carrier_id !== input.carrierId) {
      throw new ValidationError("Mapeo no encontrado.");
    }

    await insertMappingVersion(client, {
      mappingId: existing.id,
      snapshot: existing as unknown as Json,
      changedBy: admin.id,
      changeReason: input.changeReason ?? "update",
    });

    const row = await updateCarrierMapping(client, input.mappingId, {
      external_status_code: input.externalStatusCode,
      external_status_label: input.externalStatusLabel,
      normalized_status: input.normalizedStatus as Enums<"shipment_status"> | undefined,
      is_rto: input.isRto,
      is_terminal: input.isTerminal,
      priority: input.priority,
      is_active: input.isActive,
      notes: input.notes,
    });

    await writeAuditLog({
      action: "carrier_mapping_updated",
      entityType: "carrier_status_mapping",
      entityId: row.id,
      actorId: admin.id,
      oldData: existing as unknown as Json,
      newData: row as unknown as Json,
    });
    revalidateCarrier(input.carrierId);
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteMappingAction(
  carrierId: string,
  mappingId: string,
): Promise<CarrierActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const client = await createClient();
    const existing = await getCarrierMapping(client, mappingId);
    if (!existing || existing.carrier_id !== carrierId) {
      throw new ValidationError("Mapeo no encontrado.");
    }
    await insertMappingVersion(client, {
      mappingId: existing.id,
      snapshot: existing as unknown as Json,
      changedBy: admin.id,
      changeReason: "delete",
    });
    await deleteCarrierMapping(client, mappingId);
    await writeAuditLog({
      action: "carrier_mapping_deleted",
      entityType: "carrier_status_mapping",
      entityId: mappingId,
      actorId: admin.id,
      oldData: existing as unknown as Json,
    });
    revalidateCarrier(carrierId);
    return actionOk({ id: mappingId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function testNormalizeAction(
  carrierId: string,
  externalStatusCode: string,
): Promise<CarrierActionResult> {
  try {
    await requirePlatformAdmin();
    const client = await createClient();
    const mappings = await listCarrierMappings(client, carrierId);
    const rules: CarrierMappingRule[] = mappings.map((m) => ({
      external_status_code: m.external_status_code,
      external_status_label: m.external_status_label,
      normalized_status: m.normalized_status,
      is_rto: m.is_rto,
      is_terminal: m.is_terminal,
      priority: m.priority,
      is_active: m.is_active,
    }));
    const result = applyMapping(externalStatusCode, rules);
    return actionOk({
      normalize: {
        mapped: result.mapped,
        normalizedStatus: result.normalizedStatus,
        isRto: result.isRto,
        isTerminal: result.isTerminal,
      },
    });
  } catch (error) {
    return actionFail(error);
  }
}
