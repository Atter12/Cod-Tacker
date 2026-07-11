import type { AlertNoteRow, AlertRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";
import type { Enums } from "@/types/database.generated";

export type ListAlertsOptions = {
  storeId: string;
  page?: number;
  pageSize?: number;
  severities?: Enums<"alert_severity">[];
  statuses?: string[];
  includeResolved?: boolean;
  assignedTo?: string | null;
  type?: string;
};

export async function listAlerts(
  client: DatabaseClient,
  storeId: string,
  includeResolved = false,
): Promise<AlertRow[]> {
  const result = await listAlertsPaginated(client, { storeId, includeResolved, page: 1, pageSize: 100 });
  return result.rows;
}

export async function listAlertsPaginated(
  client: DatabaseClient,
  options: ListAlertsOptions,
): Promise<{ rows: AlertRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("alerts")
    .select("*", { count: "exact" })
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));

  if (options.severities?.length) query = query.in("severity", options.severities);
  if (options.statuses?.length) query = query.in("status", options.statuses);
  else if (!options.includeResolved) query = query.neq("status", "resolved");
  if (options.assignedTo) query = query.eq("assigned_to", options.assignedTo);
  if (options.type) query = query.eq("type", options.type);

  const result = await query.order("created_at", { ascending: false }).range(from, to);
  throwQueryError(result.error);
  return { rows: result.data ?? [], total: result.count ?? 0, page, pageSize };
}

export async function getAlertById(
  client: DatabaseClient,
  storeId: string,
  alertId: string,
): Promise<AlertRow | null> {
  const result = await client
    .from("alerts")
    .select()
    .eq("store_id", storeId)
    .eq("id", alertId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listAlertNotes(
  client: DatabaseClient,
  alertId: string,
): Promise<AlertNoteRow[]> {
  const result = await client
    .from("alert_notes")
    .select()
    .eq("alert_id", alertId)
    .order("created_at", { ascending: true });
  throwQueryError(result.error);
  return result.data ?? [];
}
