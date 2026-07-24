import "server-only";

import { writeAuditLog } from "@/lib/audit/write-audit";
import { assertCanImportCsvRows } from "@/lib/billing/limits";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Json, Tables } from "@/types/database.generated";
import {
  classifyEcartSyncOutcome,
  ECART_EMPTY_SYNC_MESSAGE,
  ECART_SYNC_INTERVAL_MS,
  isEcartSyncDue,
  lastEcartSyncAttemptAt,
  messageForEcartSyncOutcome,
  type EcartSyncOutcome,
} from "@/lib/integrations/ecart-pay/sync-outcome";

export const ECART_GATEWAY = "ecart_pay";
export { ECART_SYNC_INTERVAL_MS, isEcartSyncDue, lastEcartSyncAttemptAt };

export type EcartPayIntegrationRow = Pick<
  Tables<"integrations">,
  | "id"
  | "agency_id"
  | "store_id"
  | "status"
  | "secret_reference"
  | "settings"
  | "last_success_at"
  | "last_error_at"
>;

export type EcartSyncResult = {
  outcome: EcartSyncOutcome;
  rowCount: number;
  message: string;
  syncRunId: string | null;
  jobId?: string;
  rawEventId?: string;
  days: number;
};

function isEcartGateway(settings: Json | null): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return (settings as Record<string, unknown>).gateway === ECART_GATEWAY;
}

export function isConnectedEcartIntegration(
  row: Pick<Tables<"integrations">, "status" | "settings">,
): boolean {
  return row.status === "connected" && isEcartGateway(row.settings);
}

export async function findEcartPayIntegration(
  admin: DatabaseClient,
  storeId: string,
  agencyId: string,
): Promise<EcartPayIntegrationRow | null> {
  const result = await admin
    .from("integrations")
    .select(
      "id, agency_id, store_id, status, secret_reference, settings, last_success_at, last_error_at",
    )
    .eq("store_id", storeId)
    .eq("agency_id", agencyId)
    .eq("provider", "custom_payment")
    .limit(20);

  const match =
    result.data?.find((row) => isConnectedEcartIntegration(row)) ??
    result.data?.find((row) => isEcartGateway(row.settings)) ??
    null;
  return match;
}

async function startEcartSyncRun(
  admin: DatabaseClient,
  input: {
    agencyId: string;
    storeId: string;
    integrationId: string;
    triggerSource: "manual" | "scheduled";
    actorId?: string | null;
    days: number;
  },
): Promise<string> {
  const startedAt = new Date().toISOString();
  const insertRun = await admin
    .from("sync_runs")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId,
      integration_id: input.integrationId,
      provider: "custom_payment",
      sync_type: "incremental",
      trigger_source: input.triggerSource,
      status: "running",
      started_at: startedAt,
      created_by: input.actorId ?? null,
      metadata: {
        gateway: ECART_GATEWAY,
        days: input.days,
      } as Json,
    })
    .select("id")
    .single();

  if (insertRun.error || !insertRun.data) {
    throw new ValidationError("No se pudo iniciar el log de sincronización Ecart Pay.");
  }
  return insertRun.data.id;
}

async function finishEcartSyncRun(
  admin: DatabaseClient,
  input: {
    syncRunId: string;
    storeId: string;
    outcome: EcartSyncOutcome;
    rowCount: number;
    days: number;
    triggerSource: "manual" | "scheduled";
    jobId?: string;
    errorMessage?: string;
  },
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const status = input.outcome === "error" ? "failed" : "completed";
  await admin
    .from("sync_runs")
    .update({
      status,
      finished_at: finishedAt,
      received_total: input.rowCount,
      created_total: input.outcome === "ok" ? input.rowCount : 0,
      skipped_total: input.outcome === "empty" ? 1 : 0,
      failed_total: input.outcome === "error" ? 1 : 0,
      error_code: input.outcome === "error" ? "ECART_SYNC_FAILED" : null,
      error_message: input.outcome === "error" ? (input.errorMessage ?? null) : null,
      metadata: {
        gateway: ECART_GATEWAY,
        days: input.days,
        outcome: input.outcome,
        rowCount: input.rowCount,
        triggerSource: input.triggerSource,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.outcome === "empty" ? { emptyMessage: ECART_EMPTY_SYNC_MESSAGE } : {}),
      } as Json,
    })
    .eq("id", input.syncRunId)
    .eq("store_id", input.storeId);
}

/**
 * Pull paid Ecart Pay transactions and enqueue settlement import when there are rows.
 * Zero rows is a successful empty sync (not an error).
 */
export async function syncEcartPaySettlementsForIntegration(
  admin: DatabaseClient,
  input: {
    integration: EcartPayIntegrationRow;
    days?: number;
    triggerSource: "manual" | "scheduled";
    actorId?: string | null;
    /** Kick the job worker after enqueue (manual path). */
    kickWorker?: boolean;
  },
): Promise<EcartSyncResult> {
  const { integration } = input;
  const days = Math.min(Math.max(input.days ?? 30, 1), 90);
  const agencyId = integration.agency_id;
  const storeId = integration.store_id;

  if (!storeId) {
    throw new ValidationError("Integración Ecart Pay sin tienda asociada.");
  }
  if (!isConnectedEcartIntegration(integration)) {
    throw new ValidationError("Conecta Ecart Pay antes de sincronizar liquidaciones.");
  }

  let syncRunId: string | null = null;
  try {
    const runId = await startEcartSyncRun(admin, {
      agencyId,
      storeId,
      integrationId: integration.id,
      triggerSource: input.triggerSource,
      actorId: input.actorId,
      days,
    });
    syncRunId = runId;

    const { resolveEcartPayAccessTokenFromIntegration } = await import(
      "@/lib/integrations/ecart-pay/credentials"
    );
    const { fetchEcartPayTransactions } = await import("@/lib/integrations/ecart-pay/api");
    const { mapEcartTransactionsToSettlementRows } = await import(
      "@/lib/integrations/ecart-pay/map-transactions"
    );

    let access: { token: string; source: "api_keys" | "legacy_bearer" };
    try {
      const resolved = await resolveEcartPayAccessTokenFromIntegration(integration);
      if (!resolved) {
        throw new ValidationError(
          "Faltan claves Ecart Pay cifradas. Vuelve a conectar con public + private key.",
        );
      }
      access = resolved;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(
        `No se pudo obtener Bearer de Ecart Pay${
          error instanceof Error && error.message ? `: ${error.message.slice(0, 180)}` : "."
        }`,
      );
    }

    if (access.source === "legacy_bearer") {
      throw new ValidationError(
        "Esta conexión usa un Bearer antiguo (~1h). Actualiza con clave pública y privada de Ecart Pay.",
      );
    }

    const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const transactions = await fetchEcartPayTransactions({
      token: access.token,
      fromIso,
      status: "paid",
      limit: 250,
    });
    const rows = mapEcartTransactionsToSettlementRows(transactions);
    const outcome = classifyEcartSyncOutcome(rows.length);

    if (outcome === "empty") {
      const finishedAt = new Date().toISOString();
      await finishEcartSyncRun(admin, {
        syncRunId: runId,
        storeId,
        outcome: "empty",
        rowCount: 0,
        days,
        triggerSource: input.triggerSource,
      });
      await admin
        .from("integrations")
        .update({
          last_success_at: finishedAt,
          last_error_at: null,
          last_error_message: null,
          status: "connected",
          updated_at: finishedAt,
        })
        .eq("id", integration.id)
        .eq("store_id", storeId);

      await writeAuditLog({
        action: "settlement_ecart_sync_enqueued",
        entityType: "sync_run",
        entityId: runId,
        actorId: input.actorId ?? null,
        agencyId,
        storeId,
        newData: {
          outcome: "empty",
          rowCount: 0,
          days,
          triggerSource: input.triggerSource,
          syncRunId: runId,
        },
        useAdmin: true,
      });

      logger.info("ecart_pay.sync.complete", {
        outcome: "empty",
        storeId,
        agencyId,
        integrationId: integration.id,
        syncRunId: runId,
        days,
        triggerSource: input.triggerSource,
        rowCount: 0,
      });

      return {
        outcome: "empty",
        rowCount: 0,
        message: messageForEcartSyncOutcome("empty"),
        syncRunId: runId,
        days,
      };
    }

    await assertCanImportCsvRows(admin, agencyId, rows.length);

    const externalBatchId = `ecart-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `settlement-ecart:${storeId}:${externalBatchId}`;
    const currencyCode = rows[0]?.currencyCode ?? "PEN";

    const payload: Json = {
      external_batch_id: externalBatchId,
      reference: `Ecart Pay ${fromIso.slice(0, 10)} → sync`,
      currency_code: currencyCode,
      source_file_path: null,
      preset_id: "ecart_pay",
      rows,
      sync_run_id: runId,
    };

    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId,
      storeId,
      provider: "custom_payment",
      integrationId: integration.id,
      eventType: "settlement.ecart.synced",
      jobType: "settlement.ecart.synced",
      idempotencyKey,
      correlationId: runId,
      externalEventId: externalBatchId,
      payload,
    });

    if (input.kickWorker !== false && input.triggerSource === "manual") {
      const { kickJobProcessing } = await import("@/lib/jobs/kick");
      await kickJobProcessing({ limit: 8, reason: "settlement-ecart-sync" });
    }

    const finishedAt = new Date().toISOString();
    await finishEcartSyncRun(admin, {
      syncRunId: runId,
      storeId,
      outcome: "ok",
      rowCount: rows.length,
      days,
      triggerSource: input.triggerSource,
      jobId: enqueued.jobId,
    });
    await admin
      .from("integrations")
      .update({
        last_success_at: finishedAt,
        last_error_at: null,
        last_error_message: null,
        status: "connected",
        updated_at: finishedAt,
      })
      .eq("id", integration.id)
      .eq("store_id", storeId);

    await writeAuditLog({
      action: "settlement_ecart_sync_enqueued",
      entityType: "background_job",
      entityId: enqueued.jobId,
      actorId: input.actorId ?? null,
      agencyId,
      storeId,
      newData: {
        outcome: "ok",
        jobId: enqueued.jobId,
        externalBatchId,
        rowCount: rows.length,
        days,
        triggerSource: input.triggerSource,
        syncRunId: runId,
      },
      useAdmin: true,
    });

    logger.info("ecart_pay.sync.complete", {
      outcome: "ok",
      storeId,
      agencyId,
      integrationId: integration.id,
      syncRunId: runId,
      jobId: enqueued.jobId,
      days,
      triggerSource: input.triggerSource,
      rowCount: rows.length,
    });

    return {
      outcome: "ok",
      rowCount: rows.length,
      message: messageForEcartSyncOutcome("ok", {
        rowCount: rows.length,
        jobId: enqueued.jobId,
      }),
      syncRunId: runId,
      jobId: enqueued.jobId,
      rawEventId: enqueued.rawEventId,
      days,
    };
  } catch (error) {
    const safeMessage =
      error instanceof ValidationError
        ? error.safeMessage
        : error instanceof Error
          ? error.message.slice(0, 300)
          : "Falló la sincronización con Ecart Pay.";
    const finishedAt = new Date().toISOString();

    if (syncRunId) {
      await finishEcartSyncRun(admin, {
        syncRunId,
        storeId,
        outcome: "error",
        rowCount: 0,
        days,
        triggerSource: input.triggerSource,
        errorMessage: safeMessage,
      });
    }

    await admin
      .from("integrations")
      .update({
        last_error_at: finishedAt,
        last_error_message: safeMessage,
        updated_at: finishedAt,
      })
      .eq("id", integration.id)
      .eq("store_id", storeId);

    await writeAuditLog({
      action: "settlement_ecart_sync_enqueued",
      entityType: "sync_run",
      entityId: syncRunId ?? integration.id,
      actorId: input.actorId ?? null,
      agencyId,
      storeId,
      newData: {
        outcome: "error",
        rowCount: 0,
        days,
        triggerSource: input.triggerSource,
        syncRunId,
        error: safeMessage,
      },
      useAdmin: true,
    });

    logger.error("ecart_pay.sync.failed", {
      storeId,
      agencyId,
      integrationId: integration.id,
      syncRunId,
      days,
      triggerSource: input.triggerSource,
      error: safeMessage,
    });

    throw error instanceof ValidationError ? error : new ValidationError(safeMessage);
  }
}
