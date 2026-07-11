"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { isStoreIntegrationProvider } from "@/lib/integrations/catalog";
import { PermissionError, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  backfill as backfillIntegration,
  connectMock,
  disconnect as disconnectIntegration,
  reconnect as reconnectIntegration,
  syncNow,
  testConnection,
} from "@/services/integrations.service";

export type IntegrationActionResult = ActionResult<{ id?: string; runId?: string }>;

async function loadManagedStore(agencySlug: string, storeSlug: string) {
  const user = await requireUser();
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  if (!membership.storeId) throw new ValidationError("Tienda inválida.");
  if (!can(membership.roles, "integrations.manage")) {
    throw new PermissionError("No tienes permiso para gestionar integraciones.");
  }
  const client = await createClient();
  return { user, membership, client, storeId: membership.storeId };
}

function assertProvider(provider: string) {
  if (!isStoreIntegrationProvider(provider)) {
    throw new ValidationError("Proveedor de integración no soportado.");
  }
  return provider;
}

function revalidateIntegrationPaths(agencySlug: string, storeSlug: string, provider: string) {
  revalidatePath(routes.store.integrations(agencySlug, storeSlug));
  revalidatePath(routes.store.integrationDetail(agencySlug, storeSlug, provider));
  revalidatePath(routes.store.operations(agencySlug, storeSlug));
}

export async function connectIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const row = await connectMock(client, {
      agencyId: membership.agencyId,
      storeId,
      provider: safeProvider,
      userId: user.id,
    });
    await writeAuditLog({
      action: "integration_connected",
      entityType: "integration",
      entityId: row.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: row.status, demo: true },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function disconnectIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const row = await disconnectIntegration(client, membership.agencyId, storeId, safeProvider);
    await writeAuditLog({
      action: "integration_disconnected",
      entityType: "integration",
      entityId: row.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: row.status },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function reconnectIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const row = await reconnectIntegration(client, {
      agencyId: membership.agencyId,
      storeId,
      provider: safeProvider,
      userId: user.id,
    });
    await writeAuditLog({
      action: "integration_reconnected",
      entityType: "integration",
      entityId: row.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: row.status, demo: true },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function testIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const health = await testConnection(client, membership.agencyId, storeId, safeProvider);
    await writeAuditLog({
      action: "integration_tested",
      entityType: "integration",
      entityId: health.integration_id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: health.status, latency_ms: health.latency_ms },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    return actionOk({ id: health.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function syncIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const run = await syncNow(client, {
      agencyId: membership.agencyId,
      storeId,
      provider: safeProvider,
      userId: user.id,
    });
    await writeAuditLog({
      action: "integration_synced",
      entityType: "sync_run",
      entityId: run.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: run.status, sync_type: run.sync_type },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    revalidatePath(routes.store.syncRunDetail(agencySlug, storeSlug, run.id));
    return actionOk({ id: run.integration_id, runId: run.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function backfillIntegrationAction(
  agencySlug: string,
  storeSlug: string,
  provider: string,
): Promise<IntegrationActionResult> {
  try {
    const { user, membership, client, storeId } = await loadManagedStore(agencySlug, storeSlug);
    const safeProvider = assertProvider(provider);
    const run = await backfillIntegration(client, {
      agencyId: membership.agencyId,
      storeId,
      provider: safeProvider,
      userId: user.id,
    });
    await writeAuditLog({
      action: "integration_backfill",
      entityType: "sync_run",
      entityId: run.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId,
      newData: { provider: safeProvider, status: run.status, sync_type: run.sync_type },
    });
    revalidateIntegrationPaths(agencySlug, storeSlug, safeProvider);
    revalidatePath(routes.store.syncRunDetail(agencySlug, storeSlug, run.id));
    return actionOk({ id: run.integration_id, runId: run.id });
  } catch (error) {
    return actionFail(error);
  }
}
