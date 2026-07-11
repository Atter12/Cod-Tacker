import { throwQueryError, type DatabaseClient } from "./_shared";
import type { DataDeletionRequestRow, DataExportRequestRow } from "@/types/database";

export async function listDataExportRequests(
  client: DatabaseClient,
  agencyId: string,
): Promise<DataExportRequestRow[]> {
  const { data, error } = await client
    .from("data_export_requests")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(50);
  throwQueryError(error);
  return data ?? [];
}

export async function listDataDeletionRequests(
  client: DatabaseClient,
  agencyId: string,
): Promise<DataDeletionRequestRow[]> {
  const { data, error } = await client
    .from("data_deletion_requests")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(50);
  throwQueryError(error);
  return data ?? [];
}
