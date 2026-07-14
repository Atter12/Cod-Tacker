import "server-only";

import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "@/lib/integrations/contracts/common";
import {
  getCatalogEntry,
  INTEGRATION_CATALOG,
  isStoreIntegrationProvider,
  type HealthCheckStatus,
  type StoreIntegrationProvider,
  type SyncType,
} from "@/lib/integrations/catalog";
import {
  compareOverviewItems,
  deriveIntegrationOverviewStatus,
  getIntegrationCredentialExpiry,
  getIntegrationOperationalMessage,
  normalizeHealthStatus,
} from "@/lib/integrations/overview";
import {
  getAdsProvider,
  getCarrierProvider,
  getCommerceProvider,
  getMessagingProvider,
  getSettlementProvider,
  getIntegrationRuntimeMode,
  isDemoIntegrationMode,
} from "@/lib/integrations/registry";
import { AppError, IntegrationError, ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { buildSyncEnqueueSpecs } from "@/lib/jobs/sync-enqueue-map";
import { decryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  IntegrationHealthCheckRow,
  IntegrationRow,
  SyncRunItemRow,
  SyncRunRow,
} from "@/types/database";
import type { Enums, Json } from "@/types/database.generated";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

type SyncAdapter = {
  sync: (input: ProviderSyncInput) => Promise<ProviderSyncResult>;
  health: () => Promise<ProviderHealthResult>;
  connectMock: () => Promise<ProviderConnectionResult>;
};

function assertStoreScope(agencyId: string, storeId: string) {
  return {
    agencyId: requireValue(agencyId, "Agencia inválida."),
    storeId: requireValue(storeId, "Tienda inválida."),
  };
}

function shopDomainFromIntegration(integration: IntegrationRow): string | null {
  const settings = integration.settings as { shop_domain?: string } | null;
  const meta = integration.metadata as { shop_domain?: string } | null;
  return (
    settings?.shop_domain ||
    meta?.shop_domain ||
    integration.external_account_name ||
    null
  );
}

export function resolveStoreProvider(provider: string): SyncAdapter {
  if (!isStoreIntegrationProvider(provider)) {
    throw new ValidationError("Proveedor de integración no soportado.");
  }
  const credentialRef = `mock:ref:${provider}`;

  switch (provider) {
    case "shopify": {
      const adapter = getCommerceProvider("shopify");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () =>
          adapter.connect({ shopDomain: "demo-shop.myshopify.com", credentialRef }),
      };
    }
    case "meta": {
      const adapter = getAdsProvider("meta");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () =>
          adapter.connect({ accountExternalId: "mock-account-meta", credentialRef }),
      };
    }
    case "tiktok": {
      const adapter = getAdsProvider("tiktok");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () =>
          adapter.connect({ accountExternalId: "mock-account-tiktok", credentialRef }),
      };
    }
    case "whatsapp": {
      const adapter = getMessagingProvider("whatsapp");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () => adapter.connect({ phoneNumberId: "mock-phone-001", credentialRef }),
      };
    }
    case "enviame": {
      const adapter = getCarrierProvider("enviame");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () => adapter.connect({ credentialRef }),
      };
    }
    case "custom_carrier": {
      const adapter = getCarrierProvider("custom_carrier");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () => adapter.connect({ credentialRef }),
      };
    }
    case "custom_payment": {
      const adapter = getSettlementProvider("custom_payment");
      return {
        sync: (input) => adapter.sync(input),
        health: () => adapter.health(),
        connectMock: () => adapter.connect({ credentialRef }),
      };
    }
    default:
      throw new ValidationError("Proveedor de integración no soportado.");
  }
}

/** Resolve adapter using stored credentials when INTEGRATION_MODE=live (Shopify). */
export function resolveStoreProviderForIntegration(
  provider: string,
  integration: IntegrationRow,
): SyncAdapter {
  if (provider === "shopify" && getIntegrationRuntimeMode() === "live") {
    const shop = shopDomainFromIntegration(integration);
    if (!shop || !isEncryptedSecretRef(integration.secret_reference)) {
      throw new IntegrationError(
        "Shopify live requiere OAuth con token cifrado. Usa Conectar Shopify.",
      );
    }
    const accessToken = decryptSecret(integration.secret_reference!);
    const adapter = getCommerceProvider("shopify", { shopDomain: shop, accessToken });
    return {
      sync: (input) => adapter.sync(input),
      health: () => adapter.health(),
      connectMock: async () => {
        throw new IntegrationError("Conexión mock deshabilitada en modo live.");
      },
    };
  }
  return resolveStoreProvider(provider);
}

function mapHealthStatus(status: ProviderHealthResult["status"]): HealthCheckStatus {
  if (status === "healthy") return "healthy";
  if (status === "degraded") return "degraded";
  return "down";
}

/**
 * Returns integrations for the given agency, optionally filtered by store.
 * agency_id is required on all integrations; store_id is nullable (agency-wide integrations have no store).
 */
export async function listIntegrations(
  client: DatabaseClient,
  agencyId: string,
  storeId?: string | null,
): Promise<IntegrationRow[]> {
  let query = client.from("integrations").select().eq("agency_id", requireValue(agencyId, "Agencia inválida."));
  if (storeId) query = query.eq("store_id", storeId);
  const result = await query.order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}

/**
 * Builds catalog + store integration overviews with a single health-check batch query (no N+1).
 */
export async function listIntegrationOverviews(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  options?: { timeZone?: string; now?: Date },
): Promise<IntegrationOverviewItem[]> {
  const scope = assertStoreScope(agencyId, storeId);
  const timeZone = options?.timeZone?.trim() || "America/Lima";
  const now = options?.now ?? new Date();

  const integrations = await listIntegrations(client, scope.agencyId, scope.storeId);
  const byProvider = new Map<StoreIntegrationProvider, IntegrationRow>();
  for (const row of integrations) {
    if (!isStoreIntegrationProvider(row.provider)) continue;
    const existing = byProvider.get(row.provider);
    if (!existing) {
      byProvider.set(row.provider, row);
      continue;
    }
    // Prefer the newest non-disconnected row when duplicates exist.
    if (existing.status === "disconnected" && row.status !== "disconnected") {
      byProvider.set(row.provider, row);
    }
  }

  const integrationIds = [...byProvider.values()].map((row) => row.id);
  const latestHealthByIntegrationId = new Map<string, IntegrationHealthCheckRow>();

  if (integrationIds.length > 0) {
    const healthResult = await client
      .from("integration_health_checks")
      .select()
      .eq("agency_id", scope.agencyId)
      .eq("store_id", scope.storeId)
      .in("integration_id", integrationIds)
      .order("checked_at", { ascending: false });
    throwQueryError(healthResult.error);

    for (const health of healthResult.data ?? []) {
      if (!latestHealthByIntegrationId.has(health.integration_id)) {
        latestHealthByIntegrationId.set(health.integration_id, health);
      }
    }
  }

  const catalogOrder = INTEGRATION_CATALOG.map((entry) => entry.provider);
  const items: IntegrationOverviewItem[] = INTEGRATION_CATALOG.map((entry) => {
    const row = byProvider.get(entry.provider) ?? null;
    const healthRow = row ? latestHealthByIntegrationId.get(row.id) ?? null : null;
    const healthStatus = normalizeHealthStatus(healthRow?.status ?? null);
    const credentialExpiresAt = row
      ? getIntegrationCredentialExpiry(row.metadata, row.settings)
      : null;
    const persistedStatus = row?.status ?? null;
    const overviewStatus = deriveIntegrationOverviewStatus({
      persistedStatus,
      lastSuccessAt: row?.last_success_at ?? null,
      lastErrorAt: row?.last_error_at ?? null,
      latestHealthStatus: healthStatus,
    });

    const latestHealth =
      healthRow && healthStatus
        ? {
            status: healthStatus,
            checkedAt: healthRow.checked_at,
            latencyMs: healthRow.latency_ms,
            safeMessage: healthRow.safe_message,
          }
        : null;

    const demo =
      isDemoIntegrationMode() ||
      Boolean(
        row &&
          typeof row.metadata === "object" &&
          row.metadata !== null &&
          !Array.isArray(row.metadata) &&
          row.metadata.demo === true,
      );

    const base: IntegrationOverviewItem = {
      id: row?.id ?? null,
      provider: entry.provider,
      name: row?.display_name?.trim() || entry.name,
      kind: entry.kind,
      description: entry.description,
      connected:
        !!row && row.status !== "disconnected" && row.status !== "revoked",
      persistedStatus,
      overviewStatus,
      operationalMessage: "",
      lastSuccessAt: row?.last_success_at ?? null,
      lastErrorAt: row?.last_error_at ?? null,
      lastErrorMessage: row?.last_error_message ?? null,
      latestHealth,
      credentialExpiresAt,
      demo,
    };

    return {
      ...base,
      operationalMessage: getIntegrationOperationalMessage(
        { ...base, timeZone },
        now,
      ),
    };
  });

  return items.sort((a, b) => compareOverviewItems(a, b, catalogOrder));
}

export async function getByProvider(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  provider: string,
): Promise<IntegrationRow | null> {
  const scope = assertStoreScope(agencyId, storeId);
  if (!isStoreIntegrationProvider(provider)) return null;
  const result = await client
    .from("integrations")
    .select()
    .eq("agency_id", scope.agencyId)
    .eq("store_id", scope.storeId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function connectMock(
  client: DatabaseClient,
  input: {
    agencyId: string;
    storeId: string;
    provider: string;
    userId: string;
  },
): Promise<IntegrationRow> {
  const scope = assertStoreScope(input.agencyId, input.storeId);
  if (!isStoreIntegrationProvider(input.provider)) {
    throw new ValidationError("Proveedor de integración no soportado.");
  }
  if (!isDemoIntegrationMode()) {
    throw new IntegrationError("Las integraciones mock no están habilitadas en este entorno.");
  }

  const provider = resolveStoreProvider(input.provider);
  const connection = await provider.connectMock();
  if (!connection.ok) {
    throw new IntegrationError(connection.error.safeMessage);
  }

  const catalog = getCatalogEntry(input.provider);
  const now = new Date().toISOString();
  const existing = await getByProvider(client, scope.agencyId, scope.storeId, input.provider);
  const payload = {
    agency_id: scope.agencyId,
    store_id: scope.storeId,
    provider: input.provider as Enums<"integration_provider">,
    status: "connected" as const,
    display_name: connection.displayName || catalog?.name || input.provider,
    external_account_id: connection.externalAccountId,
    external_account_name: connection.displayName,
    secret_reference: connection.credentialRef.startsWith("mock:")
      ? connection.credentialRef
      : `mock:ref:${input.provider}`,
    scopes: ["mock"],
    metadata: { demo: true, mode: "mock" } as Json,
    settings: {} as Json,
    connected_at: now,
    connected_by: input.userId,
    last_error_at: null,
    last_error_message: null,
  };

  if (existing) {
    const result = await client
      .from("integrations")
      .update(payload)
      .eq("id", existing.id)
      .eq("store_id", scope.storeId)
      .eq("agency_id", scope.agencyId)
      .select()
      .single();
    throwQueryError(result.error);
    if (!result.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo conectar la integración.");
    return result.data;
  }

  const result = await client.from("integrations").insert(payload).select().single();
  throwQueryError(result.error);
  if (!result.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo conectar la integración.");
  return result.data;
}

export async function disconnect(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  provider: string,
): Promise<IntegrationRow> {
  const existing = await getByProvider(client, agencyId, storeId, provider);
  if (!existing) throw new ValidationError("Integración no encontrada.");
  const result = await client
    .from("integrations")
    .update({
      status: "disconnected",
      secret_reference: null,
      last_error_at: null,
      last_error_message: null,
    })
    .eq("id", existing.id)
    .eq("store_id", storeId)
    .eq("agency_id", agencyId)
    .select()
    .single();
  throwQueryError(result.error);
  if (!result.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo desconectar la integración.");
  return result.data;
}

export async function reconnect(
  client: DatabaseClient,
  input: {
    agencyId: string;
    storeId: string;
    provider: string;
    userId: string;
  },
): Promise<IntegrationRow> {
  return connectMock(client, input);
}

export async function testConnection(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  provider: string,
): Promise<IntegrationHealthCheckRow> {
  const scope = assertStoreScope(agencyId, storeId);
  const integration = await getByProvider(client, scope.agencyId, scope.storeId, provider);
  if (!integration) throw new ValidationError("Integración no encontrada.");
  if (integration.status === "disconnected" || integration.status === "revoked") {
    throw new ValidationError("La integración está desconectada.");
  }

  const adapter = resolveStoreProviderForIntegration(provider, integration);
  const health = await adapter.health();
  const status = mapHealthStatus(health.status);
  // Writes via service role after caller already authorized integrations.manage.
  const admin = createAdminClient();
  const result = await admin
    .from("integration_health_checks")
    .insert({
      agency_id: scope.agencyId,
      store_id: scope.storeId,
      integration_id: integration.id,
      status,
      latency_ms: health.latencyMs,
      checked_at: health.checkedAt,
      safe_message: health.message,
      details: { demo: health.demo, mode: health.mode } as Json,
    })
    .select()
    .single();
  throwQueryError(result.error);
  if (!result.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo registrar la prueba de conexión.");

  const integrationPatch =
    status === "healthy"
      ? {
          status: "connected" as const,
          last_success_at: health.checkedAt,
          last_error_at: null,
          last_error_message: null,
        }
      : {
          status: (status === "degraded" ? "degraded" : "error") as Enums<"integration_status">,
          last_error_at: health.checkedAt,
          last_error_message: health.message,
        };

  await admin
    .from("integrations")
    .update(integrationPatch)
    .eq("id", integration.id)
    .eq("store_id", scope.storeId);

  return result.data;
}

async function runSync(
  client: DatabaseClient,
  input: {
    agencyId: string;
    storeId: string;
    provider: string;
    userId: string;
    syncType: SyncType;
  },
): Promise<SyncRunRow> {
  const scope = assertStoreScope(input.agencyId, input.storeId);
  const integration = await getByProvider(client, scope.agencyId, scope.storeId, input.provider);
  if (!integration) throw new ValidationError("Integración no encontrada.");
  if (integration.status === "disconnected" || integration.status === "revoked") {
    throw new ValidationError("La integración está desconectada.");
  }

  // Sync row/item writes use service role after the caller authorized integrations.manage.
  const db = createAdminClient();
  const startedAt = new Date().toISOString();
  const runtimeMode = getIntegrationRuntimeMode();
  const insertRun = await db
    .from("sync_runs")
    .insert({
      agency_id: scope.agencyId,
      store_id: scope.storeId,
      integration_id: integration.id,
      provider: input.provider,
      sync_type: input.syncType,
      trigger_source: "manual",
      status: "running",
      started_at: startedAt,
      created_by: input.userId,
      metadata: {
        demo: runtimeMode === "mock",
        mode: runtimeMode,
      } as Json,
    })
    .select()
    .single();
  throwQueryError(insertRun.error);
  if (!insertRun.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo iniciar la sincronización.");

  const run = insertRun.data;
  const syncKind = input.syncType === "backfill" ? "historical" : "incremental";

  try {
    const adapter = resolveStoreProviderForIntegration(input.provider, integration);
    const syncResult = await adapter.sync({ kind: syncKind });
    const finishedAt = new Date().toISOString();

    if (!syncResult.ok) {
      const failed = await db
        .from("sync_runs")
        .update({
          status: "failed",
          finished_at: finishedAt,
          error_code: syncResult.error.code,
          error_message: syncResult.error.safeMessage,
          failed_total: 1,
        })
        .eq("id", run.id)
        .eq("store_id", scope.storeId)
        .select()
        .single();
      throwQueryError(failed.error);

      await db
        .from("integrations")
        .update({
          status: "error",
          last_error_at: finishedAt,
          last_error_message: syncResult.error.safeMessage,
        })
        .eq("id", integration.id)
        .eq("store_id", scope.storeId);

      if (!failed.data) throw new IntegrationError(syncResult.error.safeMessage);
      return failed.data;
    }

    const liveEnqueues = syncResult.enqueues ?? [];
    const items: Array<{
      sync_run_id: string;
      entity_type: string;
      external_id: string;
      status: string;
      action: string;
      metadata: Json;
    }> = [];
    const entityType = getCatalogEntry(input.provider)?.kind ?? "integration";
    // sync_run_items.status CHECK: created | updated | skipped | failed | processed
    if (liveEnqueues.length) {
      for (const item of liveEnqueues.slice(0, 40)) {
        const itemStatus =
          item.action === "created" || item.action === "updated" || item.action === "skipped"
            ? item.action
            : "processed";
        items.push({
          sync_run_id: run.id,
          entity_type: entityType,
          external_id: item.externalId,
          status: itemStatus,
          action: item.action,
          metadata: { demo: false, mode: "live" } as Json,
        });
      }
    } else {
      for (let i = 0; i < Math.min(syncResult.inserted, 5); i += 1) {
        items.push({
          sync_run_id: run.id,
          entity_type: entityType,
          external_id: `mock-${input.provider}-${i + 1}`,
          status: "created",
          action: "created",
          metadata: { demo: true } as Json,
        });
      }
      for (let i = 0; i < Math.min(syncResult.updated, 3); i += 1) {
        items.push({
          sync_run_id: run.id,
          entity_type: entityType,
          external_id: `mock-${input.provider}-upd-${i + 1}`,
          status: "updated",
          action: "updated",
          metadata: { demo: true } as Json,
        });
      }
      for (let i = 0; i < Math.min(syncResult.duplicates, 2); i += 1) {
        items.push({
          sync_run_id: run.id,
          entity_type: entityType,
          external_id: `mock-${input.provider}-dup-${i + 1}`,
          status: "skipped",
          action: "skipped",
          metadata: { demo: true, reason: "duplicate" } as Json,
        });
      }
    }
    if (items.length) {
      const itemsResult = await db.from("sync_run_items").insert(items);
      throwQueryError(itemsResult.error);
    }

    // Enqueue domain jobs via service role (processor claim/write path).
    const enqueueSpecs = liveEnqueues.length
      ? liveEnqueues.map((e) => ({
          eventType: e.eventType,
          jobType: e.jobType,
          action: e.action,
          payload: e.payload as Json,
        }))
      : buildSyncEnqueueSpecs({
          provider: input.provider,
          syncRunId: run.id,
          inserted: syncResult.inserted,
          updated: syncResult.updated,
        });
    if (enqueueSpecs.length) {
      for (let i = 0; i < enqueueSpecs.length; i += 1) {
        const spec = enqueueSpecs[i]!;
        await enqueueRawEventAndJob(db, {
          agencyId: scope.agencyId,
          storeId: scope.storeId,
          provider: input.provider as Enums<"integration_provider">,
          integrationId: integration.id,
          eventType: spec.eventType,
          jobType: spec.jobType,
          idempotencyKey: `${run.id}:${spec.jobType}:${i + 1}`,
          correlationId: run.id,
          externalEventId: `${run.id}:${i + 1}`,
          payload: {
            ...(typeof spec.payload === "object" && spec.payload && !Array.isArray(spec.payload)
              ? spec.payload
              : {}),
            sync_run_id: run.id,
          } as Json,
        });
      }
    }

    const completed = await db
      .from("sync_runs")
      .update({
        status: "completed",
        finished_at: finishedAt,
        cursor_after: syncResult.nextCursor,
        received_total: syncResult.processed,
        created_total: syncResult.inserted,
        updated_total: syncResult.updated,
        skipped_total: syncResult.duplicates,
        failed_total: 0,
        metadata: {
          demo: syncResult.demo,
          mode: syncResult.mode,
          durationMs: syncResult.durationMs,
          enqueuedJobs: enqueueSpecs.length,
        } as Json,
      })
      .eq("id", run.id)
      .eq("store_id", scope.storeId)
      .select()
      .single();
    throwQueryError(completed.error);

    await db
      .from("integrations")
      .update({
        status: "connected",
        last_success_at: finishedAt,
        last_error_at: null,
        last_error_message: null,
      })
      .eq("id", integration.id)
      .eq("store_id", scope.storeId);

    if (!completed.data) throw new AppError("DATABASE_ERROR", 500, "No se pudo completar la sincronización.");
    return completed.data;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const safeMessage =
      error instanceof AppError
        ? error.safeMessage
        : error instanceof Error
          ? error.message.slice(0, 300)
          : "No se pudo completar la sincronización.";
    await db
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: finishedAt,
        error_code: error instanceof AppError ? error.code : "SYNC_FAILED",
        error_message: safeMessage,
        failed_total: 1,
      })
      .eq("id", run.id)
      .eq("store_id", scope.storeId);
    await db
      .from("integrations")
      .update({
        status: "error",
        last_error_at: finishedAt,
        last_error_message: safeMessage,
      })
      .eq("id", integration.id)
      .eq("store_id", scope.storeId);
    if (error instanceof AppError) throw error;
    throw new IntegrationError(safeMessage);
  }
}

export async function syncNow(
  client: DatabaseClient,
  input: { agencyId: string; storeId: string; provider: string; userId: string },
): Promise<SyncRunRow> {
  return runSync(client, { ...input, syncType: "incremental" });
}

export async function backfill(
  client: DatabaseClient,
  input: { agencyId: string; storeId: string; provider: string; userId: string },
): Promise<SyncRunRow> {
  return runSync(client, { ...input, syncType: "backfill" });
}

export async function listSyncRuns(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  options: { integrationId?: string; provider?: string; limit?: number } = {},
): Promise<SyncRunRow[]> {
  const scope = assertStoreScope(agencyId, storeId);
  let query = client
    .from("sync_runs")
    .select()
    .eq("agency_id", scope.agencyId)
    .eq("store_id", scope.storeId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);
  if (options.integrationId) query = query.eq("integration_id", options.integrationId);
  if (options.provider) query = query.eq("provider", options.provider);
  const result = await query;
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getSyncRun(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  runId: string,
): Promise<{ run: SyncRunRow; items: SyncRunItemRow[] } | null> {
  const scope = assertStoreScope(agencyId, storeId);
  const runResult = await client
    .from("sync_runs")
    .select()
    .eq("id", requireValue(runId, "Ejecución inválida."))
    .eq("agency_id", scope.agencyId)
    .eq("store_id", scope.storeId)
    .maybeSingle();
  throwQueryError(runResult.error);
  if (!runResult.data) return null;

  const itemsResult = await client
    .from("sync_run_items")
    .select()
    .eq("sync_run_id", runResult.data.id)
    .order("created_at", { ascending: true });
  throwQueryError(itemsResult.error);

  return { run: runResult.data, items: itemsResult.data ?? [] };
}

export async function latestHealth(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  integrationId: string,
): Promise<IntegrationHealthCheckRow | null> {
  const scope = assertStoreScope(agencyId, storeId);
  const result = await client
    .from("integration_health_checks")
    .select()
    .eq("agency_id", scope.agencyId)
    .eq("store_id", scope.storeId)
    .eq("integration_id", requireValue(integrationId, "Integración inválida."))
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}
