import {
  readFlipySettlementWebhookPayload,
  type FlipySettlementBatch,
} from "@/lib/integrations/flipy/partner-contract";
import { mapFlipySettlementBatchToImportRows } from "@/lib/integrations/flipy/map-settlement";
import type { FlipySettlementImportRow } from "@/lib/integrations/flipy/map-settlement";

export const FLIPY_SETTLEMENT_EVENT_TYPES = [
  "settlement.batch.ready",
  "settlement.batch.created",
  "cod.collected",
  "settlement.cod.collected",
] as const;

export type FlipySettlementEventType = (typeof FLIPY_SETTLEMENT_EVENT_TYPES)[number];

export function isFlipySettlementWebhookEvent(
  type: string | null,
): type is FlipySettlementEventType {
  if (!type) return false;
  return (FLIPY_SETTLEMENT_EVENT_TYPES as readonly string[]).includes(type);
}

export type FlipySettlementJobPayload = {
  external_batch_id: string;
  reference?: string;
  currency_code: string;
  source_file_path: null;
  preset_id: "flipy_cod";
  rows: FlipySettlementImportRow[];
  flipy_event_type: string;
  external_event_id: string;
};

export function mapFlipySettlementWebhookToJobPayload(
  raw: unknown,
  opts?: { eventId?: string | null },
):
  | { ok: true; payload: FlipySettlementJobPayload; batch: FlipySettlementBatch }
  | { ok: false; error: string } {
  const batch = readFlipySettlementWebhookPayload(raw);
  if (!batch) {
    return { ok: false, error: "invalid_settlement_batch_payload" };
  }
  const rows = mapFlipySettlementBatchToImportRows(batch);
  if (!rows.length) {
    return { ok: false, error: "settlement_batch_empty_items" };
  }
  const eventId =
    (typeof opts?.eventId === "string" && opts.eventId.trim()) ||
    batch.batchId;
  return {
    ok: true,
    batch,
    payload: {
      external_batch_id: batch.batchId,
      reference: `Flipy settlement ${batch.batchId}`,
      currency_code: batch.currency,
      source_file_path: null,
      preset_id: "flipy_cod",
      rows,
      flipy_event_type: "settlement.batch.ready",
      external_event_id: eventId,
    },
  };
}
