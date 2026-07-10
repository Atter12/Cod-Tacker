export type DateRange = {
  from: string
  to: string
  timezone?: string
}

export type DashboardFilters = DateRange & {
  agencyId?: string
  storeIds?: string[]
  channels?: string[]
  currencies?: string[]
}

export type Kpi = {
  value: number
  previousValue: number | null
  changePercent: number | null
}

export type DashboardKpis = {
  revenue: Kpi
  orders: Kpi
  averageOrderValue: Kpi
  adSpend: Kpi
  returnOnAdSpend: Kpi
  deliveredOrders: Kpi
}

export type TimeSeriesPoint = {
  date: string
  revenue: number
  orders: number
  adSpend: number
  conversions: number
}
