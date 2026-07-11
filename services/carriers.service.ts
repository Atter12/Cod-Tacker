import type {
  CarrierConnectionRow,
  CarrierRow,
  CarrierStatusMappingRow,
} from "@/types/database";
import type { Json, TablesUpdate } from "@/types/database.generated";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listCarriers(client: DatabaseClient): Promise<CarrierRow[]> {
  const result = await client.from("carriers").select().eq("is_active", true).order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getCarrier(
  client: DatabaseClient,
  carrierId: string,
): Promise<CarrierRow | null> {
  const result = await client
    .from("carriers")
    .select()
    .eq("id", requireValue(carrierId, "Transportista inválido."))
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listCarrierConnections(
  client: DatabaseClient,
  storeId: string,
): Promise<CarrierConnectionRow[]> {
  const result = await client
    .from("carrier_connections")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function listCarrierConnectionsByCarrier(
  client: DatabaseClient,
  carrierId: string,
): Promise<CarrierConnectionRow[]> {
  const result = await client
    .from("carrier_connections")
    .select()
    .eq("carrier_id", requireValue(carrierId, "Transportista inválido."))
    .order("created_at", { ascending: false })
    .limit(100);
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function listCarrierMappings(
  client: DatabaseClient,
  carrierId: string,
): Promise<CarrierStatusMappingRow[]> {
  const result = await client
    .from("carrier_status_mappings")
    .select()
    .eq("carrier_id", requireValue(carrierId, "Transportista inválido."))
    .order("priority", { ascending: false })
    .order("external_status_code");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getCarrierMapping(
  client: DatabaseClient,
  mappingId: string,
): Promise<CarrierStatusMappingRow | null> {
  const result = await client
    .from("carrier_status_mappings")
    .select()
    .eq("id", requireValue(mappingId, "Mapeo inválido."))
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export type UpsertCarrierMappingInput = {
  carrierId: string;
  externalStatusCode: string;
  externalStatusLabel?: string | null;
  normalizedStatus: CarrierStatusMappingRow["normalized_status"];
  isRto?: boolean;
  isTerminal?: boolean;
  priority?: number;
  isActive?: boolean;
  notes?: string | null;
  createdBy?: string | null;
};

export async function createCarrierMapping(
  client: DatabaseClient,
  input: UpsertCarrierMappingInput,
): Promise<CarrierStatusMappingRow> {
  const result = await client
    .from("carrier_status_mappings")
    .insert({
      carrier_id: requireValue(input.carrierId, "Transportista inválido."),
      external_status_code: requireValue(input.externalStatusCode, "Código externo requerido."),
      external_status_label: input.externalStatusLabel ?? null,
      normalized_status: input.normalizedStatus,
      is_rto: input.isRto ?? false,
      is_terminal: input.isTerminal ?? false,
      priority: input.priority ?? 0,
      is_active: input.isActive ?? true,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();
  throwQueryError(result.error);
  if (!result.data) throwQueryError({ message: "empty" });
  return result.data!;
}

export async function updateCarrierMapping(
  client: DatabaseClient,
  mappingId: string,
  patch: Partial<{
    external_status_code: string;
    external_status_label: string | null;
    normalized_status: CarrierStatusMappingRow["normalized_status"];
    is_rto: boolean;
    is_terminal: boolean;
    priority: number;
    is_active: boolean;
    notes: string | null;
  }>,
): Promise<CarrierStatusMappingRow> {
  const updatePayload: TablesUpdate<"carrier_status_mappings"> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.external_status_code !== undefined) {
    updatePayload.external_status_code = patch.external_status_code;
  }
  if (patch.external_status_label !== undefined) {
    updatePayload.external_status_label = patch.external_status_label;
  }
  if (patch.normalized_status !== undefined) {
    updatePayload.normalized_status = patch.normalized_status;
  }
  if (patch.is_rto !== undefined) updatePayload.is_rto = patch.is_rto;
  if (patch.is_terminal !== undefined) updatePayload.is_terminal = patch.is_terminal;
  if (patch.priority !== undefined) updatePayload.priority = patch.priority;
  if (patch.is_active !== undefined) updatePayload.is_active = patch.is_active;
  if (patch.notes !== undefined) updatePayload.notes = patch.notes;

  const result = await client
    .from("carrier_status_mappings")
    .update(updatePayload)
    .eq("id", requireValue(mappingId, "Mapeo inválido."))
    .select()
    .single();
  throwQueryError(result.error);
  if (!result.data) throwQueryError({ message: "empty" });
  return result.data!;
}

export async function deleteCarrierMapping(
  client: DatabaseClient,
  mappingId: string,
): Promise<void> {
  const result = await client
    .from("carrier_status_mappings")
    .delete()
    .eq("id", requireValue(mappingId, "Mapeo inválido."));
  throwQueryError(result.error);
}

export type UnmappedCarrierStatusRow = {
  id: string;
  agency_id: string | null;
  carrier_id: string;
  external_status_code: string;
  external_status_label: string | null;
  sample_payload: Json;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

export async function listUnmapped(
  client: DatabaseClient,
  carrierId: string,
): Promise<UnmappedCarrierStatusRow[]> {
  const result = await client
    .from("unmapped_carrier_statuses")
    .select()
    .eq("carrier_id", requireValue(carrierId, "Transportista inválido."))
    .order("last_seen_at", { ascending: false })
    .limit(200);
  throwQueryError(result.error);
  return (result.data ?? []) as UnmappedCarrierStatusRow[];
}

export async function upsertUnmapped(
  client: DatabaseClient,
  input: {
    carrierId: string;
    agencyId?: string | null;
    externalStatusCode: string;
    externalStatusLabel?: string | null;
    samplePayload?: Json;
  },
): Promise<UnmappedCarrierStatusRow> {
  const code = requireValue(input.externalStatusCode, "Código externo requerido.");
  const existing = await client
    .from("unmapped_carrier_statuses")
    .select()
    .eq("carrier_id", input.carrierId)
    .eq("external_status_code", code)
    .maybeSingle();
  throwQueryError(existing.error);

  const now = new Date().toISOString();
  if (existing.data) {
    const updated = await client
      .from("unmapped_carrier_statuses")
      .update({
        occurrence_count: (existing.data.occurrence_count ?? 1) + 1,
        last_seen_at: now,
        external_status_label: input.externalStatusLabel ?? existing.data.external_status_label,
        sample_payload: input.samplePayload ?? existing.data.sample_payload,
        agency_id: input.agencyId ?? existing.data.agency_id,
      })
      .eq("id", existing.data.id)
      .select()
      .single();
    throwQueryError(updated.error);
    return updated.data as UnmappedCarrierStatusRow;
  }

  const inserted = await client
    .from("unmapped_carrier_statuses")
    .insert({
      carrier_id: requireValue(input.carrierId, "Transportista inválido."),
      agency_id: input.agencyId ?? null,
      external_status_code: code,
      external_status_label: input.externalStatusLabel ?? null,
      sample_payload: input.samplePayload ?? {},
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now,
    })
    .select()
    .single();
  throwQueryError(inserted.error);
  return inserted.data as UnmappedCarrierStatusRow;
}

export type MappingVersionRow = {
  id: string;
  mapping_id: string;
  snapshot: Json;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

export async function listMappingVersions(
  client: DatabaseClient,
  mappingId: string,
): Promise<MappingVersionRow[]> {
  const result = await client
    .from("carrier_status_mapping_versions")
    .select()
    .eq("mapping_id", requireValue(mappingId, "Mapeo inválido."))
    .order("created_at", { ascending: false })
    .limit(50);
  throwQueryError(result.error);
  return (result.data ?? []) as MappingVersionRow[];
}

export async function insertMappingVersion(
  client: DatabaseClient,
  input: {
    mappingId: string;
    snapshot: Json;
    changedBy?: string | null;
    changeReason?: string | null;
  },
): Promise<void> {
  const result = await client.from("carrier_status_mapping_versions").insert({
    mapping_id: requireValue(input.mappingId, "Mapeo inválido."),
    snapshot: input.snapshot,
    changed_by: input.changedBy ?? null,
    change_reason: input.changeReason ?? null,
  });
  throwQueryError(result.error);
}
