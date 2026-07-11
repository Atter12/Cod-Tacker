import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import {
  matchSettlementRows,
  rollupBatchStatus,
  type MatchCandidateOrder,
  type MatchCandidateShipment,
  type MatchInputRow,
} from "@/lib/reconciliation/matching";
import type { Json } from "@/types/database.generated";

const rowSchema = z.object({
  sourceRowNumber: z.number().int().positive(),
  trackingNumber: z.string().nullable(),
  externalShipmentId: z.string().nullable(),
  externalOrderId: z.string().nullable(),
  orderNumber: z.string().nullable(),
  grossAmount: z.number(),
  feeAmount: z.number(),
  netAmount: z.number(),
  currencyCode: z.string().length(3),
  occurredAt: z.string().nullable(),
  reference: z.string().nullable(),
  rawRow: z.record(z.string(), z.string()),
  duplicateInFile: z.boolean().optional(),
});

export const settlementCsvImportedPayloadSchema = z.object({
  external_batch_id: z.string().min(1).max(200),
  reference: z.string().max(200).optional(),
  currency_code: z.string().length(3).default("PEN"),
  source_file_path: z.string().max(500).nullable().optional(),
  preset_id: z.string().max(80).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  rows: z.array(rowSchema).min(1).max(500),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de settlement CSV no es un objeto válido.");
}

function toBatchReconciliationStatus(
  matchStatus: string,
): "open" | "partially_matched" | "matched" | "disputed" | "closed" {
  switch (matchStatus) {
    case "matched":
    case "resolved":
      return "matched";
    case "difference":
      return "partially_matched";
    case "disputed":
    case "duplicate":
      return "disputed";
    default:
      return "open";
  }
}

/**
 * Creates a settlement batch + items from sanitized CSV rows and runs matching.
 */
export const handleSettlementCsvImported: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = settlementCsvImportedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de settlement.csv.imported.mock inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de conciliación CSV requiere store_id.");
  }

  const data = parsed.data;
  const existing = await admin
    .from("settlement_batches")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("external_batch_id", data.external_batch_id)
    .maybeSingle();
  if (existing.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "settlement_batch",
      entityId: existing.data.id,
      detail: "duplicate_external_batch_id",
    };
  }

  const now = new Date().toISOString();
  const gross = data.rows.reduce((s, r) => s + r.grossAmount, 0);
  const fees = data.rows.reduce((s, r) => s + r.feeAmount, 0);
  const net = data.rows.reduce((s, r) => s + r.netAmount, 0);

  const batchInsert = await admin
    .from("settlement_batches")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      external_batch_id: data.external_batch_id,
      currency_code: data.currency_code,
      gross_amount: gross,
      fees_amount: fees,
      adjustments_amount: 0,
      net_amount: net,
      reference: data.reference ?? data.external_batch_id,
      source_file_path: data.source_file_path ?? null,
      status: "open",
      processing_started_at: now,
      import_row_count: data.rows.length,
      import_error_count: 0,
      metadata: {
        demo: true,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
        preset_id: data.preset_id ?? null,
        import_kind: "csv",
      } as Json,
    })
    .select("id")
    .single();

  if (batchInsert.error || !batchInsert.data) {
    if (batchInsert.error?.code === "23505") {
      return { ok: true, action: "skipped", entityType: "settlement_batch", detail: "race_duplicate" };
    }
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el lote de conciliación CSV.");
  }

  const batchId = batchInsert.data.id;

  const [ordersRes, shipmentsRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_number, external_order_id, expected_cod_amount, collected_cod_amount, currency_code, created_at, delivered_at",
      )
      .eq("store_id", job.store_id),
    admin
      .from("shipments")
      .select("id, order_id, tracking_number, external_shipment_id")
      .eq("store_id", job.store_id),
  ]);

  if (ordersRes.error || shipmentsRes.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudieron cargar pedidos/envíos para matching.");
  }

  const orders: MatchCandidateOrder[] = (ordersRes.data ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    externalOrderId: o.external_order_id,
    expectedCodAmount: o.expected_cod_amount,
    collectedCodAmount: o.collected_cod_amount,
    currencyCode: o.currency_code,
    createdAt: o.created_at,
    deliveredAt: o.delivered_at,
  }));

  const shipments: MatchCandidateShipment[] = (shipmentsRes.data ?? []).map((s) => ({
    id: s.id,
    orderId: s.order_id,
    trackingNumber: s.tracking_number,
    externalShipmentId: s.external_shipment_id,
  }));

  const matchInputs: MatchInputRow[] = data.rows.map((r) => ({
    sourceRowNumber: r.sourceRowNumber,
    trackingNumber: r.trackingNumber,
    externalShipmentId: r.externalShipmentId,
    externalOrderId: r.externalOrderId,
    orderNumber: r.orderNumber,
    grossAmount: r.grossAmount,
    feeAmount: r.feeAmount,
    currencyCode: r.currencyCode,
    occurredAt: r.occurredAt,
    duplicateInFile: r.duplicateInFile,
  }));

  const matches = matchSettlementRows(matchInputs, orders, shipments);
  const matchByRow = new Map(matches.map((m) => [m.sourceRowNumber, m]));

  const itemRows = data.rows.map((r) => {
    const m = matchByRow.get(r.sourceRowNumber)!;
    return {
      agency_id: job.agency_id,
      store_id: job.store_id!,
      batch_id: batchId,
      source_row_number: r.sourceRowNumber,
      raw_row: r.rawRow as Json,
      tracking_number: r.trackingNumber,
      external_shipment_id: r.externalShipmentId,
      external_order_id: r.externalOrderId,
      order_number: r.orderNumber,
      currency_code: r.currencyCode,
      row_occurred_at: r.occurredAt,
      settled_amount: r.netAmount,
      fee_amount: r.feeAmount,
      expected_amount: m.expectedAmount,
      difference_amount: m.differenceAmount,
      order_id: m.orderId,
      shipment_id: m.shipmentId,
      match_method: m.matchMethod,
      match_confidence: m.matchConfidence,
      match_status: m.matchStatus,
      discrepancy_reason: m.discrepancyReason,
      matched_at: m.matchStatus === "matched" || m.matchStatus === "difference" ? now : null,
      status: toBatchReconciliationStatus(m.matchStatus),
      notes: r.reference,
      metadata: { import_kind: "csv" } as Json,
    };
  });

  const itemsInsert = await admin.from("settlement_items").insert(itemRows);
  if (itemsInsert.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudieron insertar ítems de conciliación.");
  }

  const batchStatus = rollupBatchStatus(matches.map((m) => m.matchStatus));
  await admin
    .from("settlement_batches")
    .update({
      status: batchStatus,
      processing_finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return {
    ok: true,
    action: "created",
    entityType: "settlement_batch",
    entityId: batchId,
    detail: `items=${itemRows.length};status=${batchStatus}`,
  };
};
