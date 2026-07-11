import "server-only";

import { normalizePagination, toPaginatedResult, type PaginatedResult } from "@/lib/http/pagination";
import { requireValue, throwQueryError, type DatabaseClient } from "@/services/_shared";
import type { BackgroundJobRow, JobAttemptRow, RawEventRow } from "@/types/database";
import type { Enums } from "@/types/database.generated";

export type ListJobsFilters = {
  agencyId?: string;
  storeId?: string;
  status?: Enums<"background_job_status"> | Enums<"background_job_status">[];
  jobType?: string;
  queue?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ListRawEventsFilters = {
  agencyId?: string;
  storeId?: string;
  status?: Enums<"event_status"> | Enums<"event_status">[];
  provider?: string;
  eventType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

function applySearchOr(
  search: string | undefined,
  columns: string[],
): string | undefined {
  const q = search?.trim();
  if (!q) return undefined;
  const escaped = q.replace(/[%_,]/g, "").slice(0, 100);
  if (!escaped) return undefined;
  return columns.map((col) => `${col}.ilike.%${escaped}%`).join(",");
}

/** Request-scoped reads for admin/ops UI (RLS enforced). */
export async function listJobs(
  client: DatabaseClient,
  filters: ListJobsFilters = {},
): Promise<PaginatedResult<BackgroundJobRow>> {
  const { page, pageSize, offset, limit } = normalizePagination(filters.page, filters.pageSize);
  let query = client.from("background_jobs").select("*", { count: "exact" });

  if (filters.agencyId) query = query.eq("agency_id", requireValue(filters.agencyId, "Agencia inválida."));
  if (filters.storeId) query = query.eq("store_id", requireValue(filters.storeId, "Tienda inválida."));
  if (filters.jobType?.trim()) query = query.eq("job_type", filters.jobType.trim());
  if (filters.queue?.trim()) query = query.eq("queue", filters.queue.trim());
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length) query = query.in("status", statuses);
  }
  const searchOr = applySearchOr(filters.search, [
    "job_type",
    "idempotency_key",
    "last_error_message",
    "correlation_id",
    "queue",
  ]);
  if (searchOr) query = query.or(searchOr);

  const result = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  throwQueryError(result.error);
  return toPaginatedResult(result.data ?? [], result.count ?? 0, page, pageSize);
}

export async function getJob(
  client: DatabaseClient,
  jobId: string,
): Promise<BackgroundJobRow | null> {
  const result = await client
    .from("background_jobs")
    .select()
    .eq("id", requireValue(jobId, "Trabajo inválido."))
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listJobAttempts(
  client: DatabaseClient,
  jobId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<PaginatedResult<JobAttemptRow>> {
  const { page, pageSize, offset, limit } = normalizePagination(options.page, options.pageSize, {
    pageSize: 50,
  });
  const result = await client
    .from("job_attempts")
    .select("*", { count: "exact" })
    .eq("job_id", requireValue(jobId, "Trabajo inválido."))
    .order("attempt_number", { ascending: false })
    .range(offset, offset + limit - 1);
  throwQueryError(result.error);
  return toPaginatedResult(result.data ?? [], result.count ?? 0, page, pageSize);
}

export async function listRawEvents(
  client: DatabaseClient,
  filters: ListRawEventsFilters = {},
): Promise<PaginatedResult<RawEventRow>> {
  const { page, pageSize, offset, limit } = normalizePagination(filters.page, filters.pageSize);
  let query = client.from("raw_events").select("*", { count: "exact" });

  if (filters.agencyId) query = query.eq("agency_id", requireValue(filters.agencyId, "Agencia inválida."));
  if (filters.storeId) query = query.eq("store_id", requireValue(filters.storeId, "Tienda inválida."));
  if (filters.provider?.trim()) query = query.eq("provider", filters.provider.trim() as never);
  if (filters.eventType?.trim()) query = query.eq("event_type", filters.eventType.trim());
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length) query = query.in("status", statuses);
  }
  const searchOr = applySearchOr(filters.search, [
    "event_type",
    "idempotency_key",
    "external_event_id",
    "correlation_id",
    "last_error",
  ]);
  if (searchOr) query = query.or(searchOr);

  const result = await query
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);
  throwQueryError(result.error);
  return toPaginatedResult(result.data ?? [], result.count ?? 0, page, pageSize);
}

export async function getRawEvent(
  client: DatabaseClient,
  rawEventId: string,
): Promise<RawEventRow | null> {
  const result = await client
    .from("raw_events")
    .select()
    .eq("id", requireValue(rawEventId, "Evento inválido."))
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listJobsForRawEvent(
  client: DatabaseClient,
  rawEventId: string,
): Promise<BackgroundJobRow[]> {
  const result = await client
    .from("background_jobs")
    .select()
    .eq("raw_event_id", requireValue(rawEventId, "Evento inválido."))
    .order("created_at", { ascending: false })
    .limit(50);
  throwQueryError(result.error);
  return result.data ?? [];
}

export type DeadLetterItem =
  | { kind: "job"; id: string; createdAt: string; row: BackgroundJobRow }
  | { kind: "event"; id: string; createdAt: string; row: RawEventRow };

/** Combined dead-letter inbox (jobs + raw_events). Sorted by newest first. */
export async function listDeadLetter(
  client: DatabaseClient,
  options: { page?: number; pageSize?: number; kind?: "job" | "event" | "all" } = {},
): Promise<PaginatedResult<DeadLetterItem>> {
  const { page, pageSize } = normalizePagination(options.page, options.pageSize);
  const kind = options.kind ?? "all";
  const fetchSize = Math.min(page * pageSize + pageSize, 200);

  const [jobsResult, eventsResult] = await Promise.all([
    kind === "event"
      ? Promise.resolve({ data: [] as BackgroundJobRow[], error: null, count: 0 })
      : client
          .from("background_jobs")
          .select("*", { count: "exact" })
          .eq("status", "dead_letter")
          .order("created_at", { ascending: false })
          .limit(fetchSize),
    kind === "job"
      ? Promise.resolve({ data: [] as RawEventRow[], error: null, count: 0 })
      : client
          .from("raw_events")
          .select("*", { count: "exact" })
          .eq("status", "dead_letter")
          .order("received_at", { ascending: false })
          .limit(fetchSize),
  ]);

  throwQueryError(jobsResult.error);
  throwQueryError(eventsResult.error);

  const items: DeadLetterItem[] = [
    ...(jobsResult.data ?? []).map((row) => ({
      kind: "job" as const,
      id: row.id,
      createdAt: row.created_at,
      row,
    })),
    ...(eventsResult.data ?? []).map((row) => ({
      kind: "event" as const,
      id: row.id,
      createdAt: row.received_at,
      row,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const total =
    kind === "job"
      ? (jobsResult.count ?? 0)
      : kind === "event"
        ? (eventsResult.count ?? 0)
        : (jobsResult.count ?? 0) + (eventsResult.count ?? 0);

  const offset = (page - 1) * pageSize;
  return toPaginatedResult(items.slice(offset, offset + pageSize), total, page, pageSize);
}
