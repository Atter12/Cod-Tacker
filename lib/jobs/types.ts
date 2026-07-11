import type { SupabaseClient } from "@supabase/supabase-js";
import type { BackgroundJobRow } from "@/types/database";
import type { Database, Json } from "@/types/database.generated";

/** Service-role (or equivalent) client used by the worker / enqueue path. */
export type JobsAdminClient = SupabaseClient<Database>;

export type JobHandlerResult = {
  ok: true;
  action: "created" | "updated" | "skipped" | "noop";
  entityType?: string;
  entityId?: string;
  detail?: string;
};

export type JobHandlerContext = {
  admin: JobsAdminClient;
  job: BackgroundJobRow;
  payload: Json;
};

export type JobHandler = (ctx: JobHandlerContext) => Promise<JobHandlerResult>;

export type EnqueueInput = {
  agencyId: string;
  storeId?: string | null;
  provider: Database["public"]["Enums"]["integration_provider"];
  eventType: string;
  jobType: string;
  idempotencyKey: string;
  payload: Json;
  integrationId?: string | null;
  correlationId?: string | null;
  externalEventId?: string | null;
  queue?: string;
  priority?: number;
  maxAttempts?: number;
};

export type EnqueueResult = {
  rawEventId: string;
  jobId: string;
  created: boolean;
};

export type ProcessBatchResult = {
  claimed: number;
  completed: number;
  retried: number;
  deadLetter: number;
  failed: number;
  jobIds: string[];
};
