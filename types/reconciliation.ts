import type { Enums, Tables } from "./database.generated"
import type { DateRange } from "./dashboard"

export type ReconciliationStatus = Enums<"reconciliation_status">
export type SettlementBatch = Tables<"settlement_batches">
export type SettlementItem = Tables<"settlement_items">

export type ReconciliationFilters = DateRange & {
  storeIds?: string[]
  statuses?: ReconciliationStatus[]
}

export type ReconciliationSummary = {
  expectedRevenue: number
  settledRevenue: number
  outstandingAmount: number
  matchedItems: number
  unmatchedItems: number
}
