export type SettlementBatch = { externalId: string; provider: string; currency: string; grossAmount: number; feeAmount: number; netAmount: number; periodStart: string | null; periodEnd: string | null; settledAt: string | null };
export type SettlementItem = { externalId: string; batchExternalId: string; orderExternalId?: string; itemType: string; grossAmount: number; feeAmount: number; netAmount: number; currency: string; occurredAt: string | null };

/** Contract only: settlement ingestion is run by integration jobs, not UI requests. */
export interface SettlementAdapter {
  validateConnection(): Promise<void>;
  listBatches(dateRange: { from: string; to: string }): Promise<SettlementBatch[]>;
  listItems(batchExternalId: string): Promise<SettlementItem[]>;
}
