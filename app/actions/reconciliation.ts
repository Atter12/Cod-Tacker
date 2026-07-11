"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { parseCsv, rowsToObjects } from "@/lib/reconciliation/csv";
import {
  applyCollectedPatch,
  applyReopenPatch,
  applySettledPatch,
  type OrderPaymentSnapshot,
} from "@/lib/reconciliation/effects";
import {
  ALLOWED_CSV_MIME,
  CARRIER_CSV_PRESETS,
  getPreset,
  MAX_CSV_BYTES,
  type ColumnMapping,
} from "@/lib/reconciliation/presets";
import { validateSettlementRows, type ValidatedSettlementRow } from "@/lib/reconciliation/validate-rows";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  exportSettlementItemsCsv,
  getSettlementBatchById,
  getSettlementItemById,
  listSettlementItemsPaginated,
} from "@/services/reconciliation.service";
import type { Enums, Json } from "@/types/database.generated";
import { rollupBatchStatus } from "@/lib/reconciliation/matching";
import { assertCanImportCsvRows } from "@/lib/billing/limits";

export type ReconciliationActionResult = ActionResult<{
  jobId?: string;
  rawEventId?: string;
  batchId?: string;
  preview?: {
    headers: string[];
    rows: ValidatedSettlementRow[];
    errors: { sourceRowNumber: number; code: string; message: string }[];
    duplicateKeys: string[];
  };
  csv?: string;
}>;

function assertReconciliationManage(roles: readonly Role[]) {
  if (!can(roles, "reconciliation.manage")) {
    throw new ValidationError("No tienes permiso para gestionar conciliación.");
  }
}

function assertReconciliationView(roles: readonly Role[]) {
  if (!can(roles, "reconciliation.view") && !can(roles, "reconciliation.manage")) {
    throw new ValidationError("No tienes permiso para ver conciliación.");
  }
}

function revalidateRecon(agencySlug: string, storeSlug: string, batchId?: string) {
  revalidatePath(routes.store.reconciliation(agencySlug, storeSlug));
  revalidatePath(routes.store.reconciliationImport(agencySlug, storeSlug));
  revalidatePath(routes.store.reconciliationDiscrepancies(agencySlug, storeSlug));
  if (batchId) {
    revalidatePath(routes.store.reconciliationBatch(agencySlug, storeSlug, batchId));
  }
}

function orderSnapshot(row: {
  id: string;
  expected_cod_amount: number | null;
  collected_cod_amount: number | null;
  settled_cod_amount: number | null;
  payment_status: Enums<"payment_status">;
  cost_of_goods_amount: number | null;
  shipping_cost_amount: number | null;
  return_cost_amount: number | null;
}): OrderPaymentSnapshot {
  return {
    id: row.id,
    expectedCodAmount: row.expected_cod_amount,
    collectedCodAmount: row.collected_cod_amount,
    settledCodAmount: row.settled_cod_amount,
    paymentStatus: row.payment_status,
    costOfGoodsAmount: row.cost_of_goods_amount,
    shippingCostAmount: row.shipping_cost_amount,
    returnCostAmount: row.return_cost_amount,
    feeAmount: null,
  };
}

/** Preview CSV without persisting. */
export async function previewSettlementCsv(
  agencySlug: string,
  storeSlug: string,
  formData: FormData,
): Promise<ReconciliationActionResult> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);

    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError("Debes subir un archivo CSV.");
    if (file.size > MAX_CSV_BYTES) {
      throw new ValidationError(`El archivo supera el límite de ${MAX_CSV_BYTES} bytes.`);
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !ALLOWED_CSV_MIME.has(file.type || "text/csv")) {
      throw new ValidationError("Solo se aceptan archivos .csv.");
    }

    const presetId = String(formData.get("presetId") ?? "generic_cod");
    const preset = getPreset(presetId) ?? CARRIER_CSV_PRESETS[0]!;
    let mapping: ColumnMapping = { ...preset.mapping };

    const mappingJson = formData.get("mappingJson");
    if (typeof mappingJson === "string" && mappingJson.trim()) {
      try {
        mapping = { ...mapping, ...(JSON.parse(mappingJson) as ColumnMapping) };
      } catch {
        throw new ValidationError("Mapping de columnas inválido.");
      }
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.length) throw new ValidationError("El CSV está vacío.");
    const objects = rowsToObjects(parsed.headers, parsed.rows);
    const validated = validateSettlementRows(objects, mapping, {
      defaultCurrency: "PEN",
    });

    // Mark in-file duplicates on rows for later job payload
    const dupSet = new Set(validated.duplicateKeys);
    const rows = validated.rows.map((r) => {
      const key =
        (r.trackingNumber && `t:${r.trackingNumber.toLowerCase()}`) ||
        (r.externalShipmentId && `s:${r.externalShipmentId.toLowerCase()}`) ||
        (r.externalOrderId && `o:${r.externalOrderId.toLowerCase()}`) ||
        (r.orderNumber && `n:${r.orderNumber.toLowerCase()}:${r.grossAmount}`) ||
        "";
      return {
        ...r,
        duplicateInFile: Boolean(key && dupSet.has(key) && validated.errors.some(
          (e) => e.sourceRowNumber === r.sourceRowNumber && e.code === "DUPLICATE_IN_FILE",
        )),
      };
    });

    return actionOk({
      preview: {
        headers: parsed.headers,
        rows,
        errors: validated.errors,
        duplicateKeys: validated.duplicateKeys,
      },
    });
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Confirm import: enqueue raw_event + job with sanitized rows (not full file blob).
 * Optional Storage path only when SETTLEMENT_CSV_BUCKET is set.
 */
export async function confirmSettlementCsvImport(
  agencySlug: string,
  storeSlug: string,
  input: {
    rows: ValidatedSettlementRow[];
    presetId?: string;
    reference?: string;
    currencyCode?: string;
    sourceFileName?: string;
  },
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }
    if (!input.rows?.length) throw new ValidationError("No hay filas válidas para importar.");

    await assertCanImportCsvRows(
      await createClient(),
      membership.agencyId,
      input.rows.length,
    );

    const externalBatchId = `csv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `settlement-csv:${membership.storeId}:${externalBatchId}`;

    // Storage is optional — without SETTLEMENT_CSV_BUCKET we process server-side only.
    let sourceFilePath: string | null = null;
    const bucket = process.env.SETTLEMENT_CSV_BUCKET?.trim();
    if (bucket && input.sourceFileName) {
      sourceFilePath = `${membership.agencyId}/${membership.storeId}/${externalBatchId}/${input.sourceFileName.replace(/[^\w.\-]+/g, "_")}`;
      // Path recorded for audit; upload can be wired when Storage is provisioned.
    }

    const admin = createAdminClient();
    const payload: Json = {
      external_batch_id: externalBatchId,
      reference: input.reference ?? input.sourceFileName ?? externalBatchId,
      currency_code: input.currencyCode ?? "PEN",
      source_file_path: sourceFilePath,
      preset_id: input.presetId ?? "generic_cod",
      demo_seed: idempotencyKey,
      rows: input.rows.map((r) => {
        const withDup = r as ValidatedSettlementRow & { duplicateInFile?: boolean };
        return {
          sourceRowNumber: r.sourceRowNumber,
          trackingNumber: r.trackingNumber,
          externalShipmentId: r.externalShipmentId,
          externalOrderId: r.externalOrderId,
          orderNumber: r.orderNumber,
          grossAmount: r.grossAmount,
          feeAmount: r.feeAmount,
          netAmount: r.netAmount,
          currencyCode: r.currencyCode,
          occurredAt: r.occurredAt,
          reference: r.reference,
          rawRow: r.rawRow,
          duplicateInFile: Boolean(withDup.duplicateInFile),
        };
      }),
    };
    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      provider: "custom_payment",
      eventType: "settlement.csv.imported.mock",
      jobType: "settlement.csv.imported.mock",
      idempotencyKey,
      correlationId: crypto.randomUUID(),
      externalEventId: externalBatchId,
      payload,
    });

    await writeAuditLog({
      action: "settlement_csv_import_enqueued",
      entityType: "settlement_batch",
      entityId: externalBatchId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: {
        jobId: enqueued.jobId,
        rawEventId: enqueued.rawEventId,
        rowCount: input.rows.length,
        sourceFilePath,
        storageConfigured: Boolean(bucket),
      },
    });

    revalidateRecon(agencySlug, storeSlug);
    return actionOk({
      jobId: enqueued.jobId,
      rawEventId: enqueued.rawEventId,
    });
  } catch (error) {
    return actionFail(error);
  }
}

/** Mark collected COD for a matched item (does not settle/liquidate). */
export async function confirmCollectedMatch(
  agencySlug: string,
  storeSlug: string,
  itemId: string,
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const item = await getSettlementItemById(client, membership.storeId, itemId);
    if (!item) throw new ValidationError("Ítem no encontrado.");
    if (!item.order_id) throw new ValidationError("El ítem no tiene pedido emparejado.");
    if (item.match_status !== "matched" && item.match_status !== "difference") {
      throw new ValidationError("Solo se puede confirmar cobro en ítems emparejados o con diferencia.");
    }

    const orderRes = await client
      .from("orders")
      .select(
        "id, expected_cod_amount, collected_cod_amount, settled_cod_amount, payment_status, cost_of_goods_amount, shipping_cost_amount, return_cost_amount",
      )
      .eq("id", item.order_id)
      .eq("store_id", membership.storeId)
      .single();
    if (orderRes.error || !orderRes.data) throw new ValidationError("Pedido no encontrado.");

    const collectedAmount = item.settled_amount + item.fee_amount;
    const patch = applyCollectedPatch({
      order: orderSnapshot(orderRes.data),
      collectedAmount,
    });

    const upd = await client.from("orders").update(patch).eq("id", orderRes.data.id).eq("store_id", membership.storeId);
    if (upd.error) throw new ValidationError("No se pudo actualizar el cobro del pedido.");

    await client
      .from("settlement_items")
      .update({ collected_applied_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "settlement_item_collected_confirmed",
      entityType: "settlement_item",
      entityId: item.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { orderId: item.order_id, ...patch },
    });

    revalidateRecon(agencySlug, storeSlug, item.batch_id);
    return actionOk({ batchId: item.batch_id });
  } catch (error) {
    return actionFail(error);
  }
}

/** Approve/liquidate batch: apply settled COD to matched items. */
export async function approveSettlementBatch(
  agencySlug: string,
  storeSlug: string,
  batchId: string,
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const batch = await getSettlementBatchById(client, membership.storeId, batchId);
    if (!batch) throw new ValidationError("Lote no encontrado.");
    if (batch.approved_at) throw new ValidationError("El lote ya está aprobado.");
    if (batch.status === "closed") throw new ValidationError("El lote está cerrado.");

    const items = await listSettlementItemsPaginated(client, {
      storeId: membership.storeId,
      batchId,
      page: 1,
      pageSize: 500,
    });

    const approvable = items.rows.filter(
      (i) =>
        i.order_id &&
        (i.match_status === "matched" || i.match_status === "resolved") &&
        !i.settled_applied_at,
    );

    for (const item of approvable) {
      const orderRes = await client
        .from("orders")
        .select(
          "id, expected_cod_amount, collected_cod_amount, settled_cod_amount, payment_status, cost_of_goods_amount, shipping_cost_amount, return_cost_amount",
        )
        .eq("id", item.order_id!)
        .eq("store_id", membership.storeId)
        .single();
      if (orderRes.error || !orderRes.data) continue;

      const snap = orderSnapshot(orderRes.data);
      // Ensure collected is set if not yet
      if (snap.collectedCodAmount == null) {
        const collectedPatch = applyCollectedPatch({
          order: snap,
          collectedAmount: item.settled_amount + item.fee_amount,
        });
        await client.from("orders").update(collectedPatch).eq("id", snap.id).eq("store_id", membership.storeId);
        snap.collectedCodAmount = collectedPatch.collected_cod_amount ?? null;
        snap.paymentStatus = collectedPatch.payment_status;
      }

      const settledPatch = applySettledPatch({
        order: snap,
        settledAmount: item.settled_amount,
      });
      await client.from("orders").update(settledPatch).eq("id", snap.id).eq("store_id", membership.storeId);
      await client
        .from("settlement_items")
        .update({
          settled_applied_at: new Date().toISOString(),
          collected_applied_at: item.collected_applied_at ?? new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("store_id", membership.storeId);
    }

    const now = new Date().toISOString();
    await client
      .from("settlement_batches")
      .update({
        approved_at: now,
        approved_by: user.id,
        paid_at: now,
        status: "closed",
      })
      .eq("id", batchId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "settlement_batch_approved",
      entityType: "settlement_batch",
      entityId: batchId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { settledItemCount: approvable.length },
    });

    revalidateRecon(agencySlug, storeSlug, batchId);
    return actionOk({ batchId });
  } catch (error) {
    return actionFail(error);
  }
}

/** Controlled reopen of an approved batch (reverts settled, keeps collected by default). */
export async function reopenSettlementBatch(
  agencySlug: string,
  storeSlug: string,
  batchId: string,
  clearCollected = false,
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const batch = await getSettlementBatchById(client, membership.storeId, batchId);
    if (!batch) throw new ValidationError("Lote no encontrado.");
    if (!batch.approved_at) throw new ValidationError("Solo se pueden reabrir lotes aprobados.");

    const items = await listSettlementItemsPaginated(client, {
      storeId: membership.storeId,
      batchId,
      page: 1,
      pageSize: 500,
    });

    for (const item of items.rows.filter((i) => i.order_id && i.settled_applied_at)) {
      const orderRes = await client
        .from("orders")
        .select(
          "id, expected_cod_amount, collected_cod_amount, settled_cod_amount, payment_status, cost_of_goods_amount, shipping_cost_amount, return_cost_amount",
        )
        .eq("id", item.order_id!)
        .eq("store_id", membership.storeId)
        .single();
      if (orderRes.error || !orderRes.data) continue;

      const patch = applyReopenPatch(orderSnapshot(orderRes.data), { clearCollected });
      await client.from("orders").update(patch).eq("id", orderRes.data.id).eq("store_id", membership.storeId);
      await client
        .from("settlement_items")
        .update({
          settled_applied_at: null,
          ...(clearCollected ? { collected_applied_at: null } : {}),
        })
        .eq("id", item.id)
        .eq("store_id", membership.storeId);
    }

    await client
      .from("settlement_batches")
      .update({
        approved_at: null,
        approved_by: null,
        paid_at: null,
        status: "partially_matched",
      })
      .eq("id", batchId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "settlement_batch_reopened",
      entityType: "settlement_batch",
      entityId: batchId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { clearCollected },
    });

    revalidateRecon(agencySlug, storeSlug, batchId);
    return actionOk({ batchId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function manualMatchSettlementItem(
  agencySlug: string,
  storeSlug: string,
  itemId: string,
  orderId: string,
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const item = await getSettlementItemById(client, membership.storeId, itemId);
    if (!item) throw new ValidationError("Ítem no encontrado.");

    const orderRes = await client
      .from("orders")
      .select("id, expected_cod_amount")
      .eq("id", orderId)
      .eq("store_id", membership.storeId)
      .maybeSingle();
    if (!orderRes.data) throw new ValidationError("Pedido no encontrado en esta tienda.");

    const expected = orderRes.data.expected_cod_amount;
    const gross = item.settled_amount + item.fee_amount;
    const diff = expected != null ? Math.round((gross - expected) * 100) / 100 : null;
    const matchStatus: Enums<"settlement_match_status"> =
      diff != null && Math.abs(diff) > 0.01 ? "difference" : "matched";

    await client
      .from("settlement_items")
      .update({
        order_id: orderId,
        match_method: "manual",
        match_confidence: 1,
        match_status: matchStatus,
        expected_amount: expected,
        difference_amount: diff,
        discrepancy_reason: matchStatus === "difference" ? "manual_amount_difference" : null,
        matched_at: new Date().toISOString(),
        matched_by: user.id,
        status: matchStatus === "matched" ? "matched" : "partially_matched",
      })
      .eq("id", itemId)
      .eq("store_id", membership.storeId);

    const all = await listSettlementItemsPaginated(client, {
      storeId: membership.storeId,
      batchId: item.batch_id,
      page: 1,
      pageSize: 500,
    });
    const status = rollupBatchStatus(all.rows.map((r) => r.match_status));
    await client
      .from("settlement_batches")
      .update({ status })
      .eq("id", item.batch_id)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "settlement_item_manual_match",
      entityType: "settlement_item",
      entityId: itemId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { orderId, matchStatus },
    });

    revalidateRecon(agencySlug, storeSlug, item.batch_id);
    return actionOk({ batchId: item.batch_id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function resolveSettlementDiscrepancy(
  agencySlug: string,
  storeSlug: string,
  itemId: string,
  input: { note?: string; acceptDifference?: boolean },
): Promise<ReconciliationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const item = await getSettlementItemById(client, membership.storeId, itemId);
    if (!item) throw new ValidationError("Ítem no encontrado.");

    const now = new Date().toISOString();
    await client
      .from("settlement_items")
      .update({
        match_status: "resolved",
        resolution_status: "resolved",
        resolved_at: now,
        resolved_by: user.id,
        notes: input.note ?? item.notes,
        discrepancy_reason: input.acceptDifference
          ? item.discrepancy_reason ?? "accepted_difference"
          : item.discrepancy_reason,
        status: "matched",
      })
      .eq("id", itemId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "settlement_item_discrepancy_resolved",
      entityType: "settlement_item",
      entityId: itemId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: input,
    });

    revalidateRecon(agencySlug, storeSlug, item.batch_id);
    return actionOk({ batchId: item.batch_id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function exportBatchResultsCsv(
  agencySlug: string,
  storeSlug: string,
  batchId: string,
): Promise<ReconciliationActionResult> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertReconciliationView(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const batch = await getSettlementBatchById(client, membership.storeId, batchId);
    if (!batch) throw new ValidationError("Lote no encontrado.");

    const items = await listSettlementItemsPaginated(client, {
      storeId: membership.storeId,
      batchId,
      page: 1,
      pageSize: 500,
    });

    return actionOk({ csv: exportSettlementItemsCsv(items.rows), batchId });
  } catch (error) {
    return actionFail(error);
  }
}
