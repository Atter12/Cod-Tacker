import "server-only";

import { writeAuditLog } from "@/lib/audit/write-audit";
import { assertCanImportCsvRows } from "@/lib/billing/limits";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { mapFlipySettlementCsvToImportRows } from "@/lib/integrations/flipy/map-settlement";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { kickJobProcessing } from "@/lib/jobs/kick";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Json } from "@/types/database.generated";

export type FlipySettlementSyncResult = {
  outcome: "enqueued" | "empty";
  rowCount: number;
  message: string;
  syncRunId: string | null;
  jobId?: string;
  externalBatchId?: string;
  from: string;
  to: string;
};

function defaultDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function startSyncRun(
  admin: DatabaseClient,
  input: {
    agencyId: string;
    storeId: string;
    integrationId: string;
    actorId?: string | null;
    from: string;
    to: string;
  },
): Promise<string> {
  const startedAt = new Date().toISOString();
  const insertRun = await admin
    .from("sync_runs")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId,
      integration_id: input.integrationId,
      provider: "flipy",
      sync_type: "incremental",
      trigger_source: "manual",
      status: "running",
      started_at: startedAt,
      created_by: input.actorId ?? null,
      metadata: {
        kind: "flipy_settlement_sync",
        from: input.from,
        to: input.to,
        actor_id: input.actorId ?? null,
      } as Json,
    })
    .select("id")
    .single();
  if (insertRun.error || !insertRun.data) {
    throw new IntegrationError(
      `No se pudo crear sync_run Flipy: ${insertRun.error?.message ?? "unknown"}`,
    );
  }
  return insertRun.data.id;
}

async function finishSyncRun(
  admin: DatabaseClient,
  input: {
    syncRunId: string;
    storeId: string;
    status: "completed" | "failed";
    rowCount: number;
    errorMessage?: string | null;
  },
) {
  const finishedAt = new Date().toISOString();
  await admin
    .from("sync_runs")
    .update({
      status: input.status,
      finished_at: finishedAt,
      received_total: input.rowCount,
      created_total: input.status === "completed" ? input.rowCount : 0,
      failed_total: input.status === "failed" ? 1 : 0,
      skipped_total: input.status === "completed" && input.rowCount === 0 ? 1 : 0,
      metadata: {
        kind: "flipy_settlement_sync",
        rowCount: input.rowCount,
        error: input.errorMessage ?? null,
      } as Json,
    })
    .eq("id", input.syncRunId)
    .eq("store_id", input.storeId);
}

export async function syncFlipySettlementsForStore(input: {
  admin: DatabaseClient;
  agencyId: string;
  storeId: string;
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
  days?: number;
}): Promise<FlipySettlementSyncResult> {
  if (getIntegrationRuntimeMode() !== "live") {
    throw new ValidationError("Sincronizar conciliación Flipy requiere INTEGRATION_MODE=live.");
  }

  const range =
    input.from?.trim() && input.to?.trim()
      ? { from: input.from.trim().slice(0, 10), to: input.to.trim().slice(0, 10) }
      : defaultDateRange(input.days ?? 14);

  const integration = await resolveFlipyIntegrationForStore(
    input.admin,
    input.agencyId,
    input.storeId,
  );
  if (!integration || integration.status === "disconnected" || integration.status === "revoked") {
    throw new ValidationError("Conecta Flipy en Integraciones antes de sincronizar conciliación.");
  }
  if (!resolveFlipyPartnerKeyFromIntegration(integration)) {
    throw new ValidationError("FLIPY_PARTNER_API_KEY no configurada.");
  }
  const tiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  if (!tiendaId) {
    throw new ValidationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
  }

  const syncRunId = await startSyncRun(input.admin, {
    agencyId: input.agencyId,
    storeId: input.storeId,
    integrationId: integration.id,
    actorId: input.actorId,
    from: range.from,
    to: range.to,
  });

  try {
    const client = await getFlipyClientForStore(input.agencyId, input.storeId);
    const csvText = await client.exportConciliacionSettlement({
      tiendaId,
      from: range.from,
      to: range.to,
    });
    const rows = mapFlipySettlementCsvToImportRows(csvText);

    if (!rows.length) {
      await finishSyncRun(input.admin, {
        syncRunId,
        storeId: input.storeId,
        status: "completed",
        rowCount: 0,
      });
      await writeAuditLog({
        action: "settlement_flipy_sync_enqueued",
        entityType: "sync_run",
        entityId: syncRunId,
        actorId: input.actorId ?? null,
        agencyId: input.agencyId,
        storeId: input.storeId,
        newData: { outcome: "empty", from: range.from, to: range.to, rowCount: 0 },
        useAdmin: true,
      });
      return {
        outcome: "empty",
        rowCount: 0,
        message: "Flipy no devolvió cobros en el rango. Prueba ampliar las fechas.",
        syncRunId,
        from: range.from,
        to: range.to,
      };
    }

    await assertCanImportCsvRows(input.admin, input.agencyId, rows.length);

    const externalBatchId = `flipy-pull-${range.from}_${range.to}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `settlement-flipy:${input.storeId}:${externalBatchId}`;
    const currencyCode = rows[0]?.currencyCode ?? "PEN";

    const payload: Json = {
      external_batch_id: externalBatchId,
      reference: `Flipy sync ${range.from} → ${range.to}`,
      currency_code: currencyCode,
      source_file_path: null,
      preset_id: "flipy_cod",
      rows,
      sync_run_id: syncRunId,
    };

    const enqueued = await enqueueRawEventAndJob(input.admin, {
      agencyId: input.agencyId,
      storeId: input.storeId,
      provider: "flipy",
      integrationId: integration.id,
      eventType: "settlement.flipy.synced",
      jobType: "settlement.flipy.synced",
      idempotencyKey,
      externalEventId: externalBatchId,
      payload,
    });

    await kickJobProcessing().catch(() => undefined);

    await finishSyncRun(input.admin, {
      syncRunId,
      storeId: input.storeId,
      status: "completed",
      rowCount: rows.length,
    });

    await writeAuditLog({
      action: "settlement_flipy_sync_enqueued",
      entityType: "sync_run",
      entityId: syncRunId,
      actorId: input.actorId ?? null,
      agencyId: input.agencyId,
      storeId: input.storeId,
      newData: {
        outcome: "enqueued",
        rowCount: rows.length,
        from: range.from,
        to: range.to,
        jobId: enqueued.jobId,
        externalBatchId,
      },
      useAdmin: true,
    });

    logger.info("flipy.settlement.sync.enqueued", {
      store_id: input.storeId,
      sync_run_id: syncRunId,
      job_id: enqueued.jobId,
      rows: rows.length,
    });

    return {
      outcome: "enqueued",
      rowCount: rows.length,
      message: `Sincronizados ${rows.length} cobros Flipy. Los matched pasan a Cobrado; liquida el lote en Conciliación.`,
      syncRunId,
      jobId: enqueued.jobId,
      externalBatchId,
      from: range.from,
      to: range.to,
    };
  } catch (error) {
    await finishSyncRun(input.admin, {
      syncRunId,
      storeId: input.storeId,
      status: "failed",
      rowCount: 0,
      errorMessage: error instanceof Error ? error.message : "sync_failed",
    });
    throw error;
  }
}
