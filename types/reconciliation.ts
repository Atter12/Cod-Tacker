import type { Enums, Tables } from "./database.generated"
import type { DateRange } from "./dashboard"

export type ReconciliationStatus = Enums<"reconciliation_status">
export type SettlementMatchStatus = Enums<"settlement_match_status">
export type SettlementMatchMethod = Enums<"settlement_match_method">
export type SettlementBatch = Tables<"settlement_batches">
export type SettlementItem = Tables<"settlement_items">

export type ReconciliationFilters = DateRange & {
  storeIds?: string[]
  statuses?: ReconciliationStatus[]
  matchStatuses?: SettlementMatchStatus[]
}

export type ReconciliationSummary = {
  expectedRevenue: number
  settledRevenue: number
  outstandingAmount: number
  matchedItems: number
  unmatchedItems: number
  differenceItems: number
  duplicateItems: number
}
