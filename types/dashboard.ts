export type DateRange = {
  from: string;
  to: string;
  timezone?: string;
};

export type DashboardFilters = DateRange & {
  agencyId?: string;
  storeIds?: string[];
  channels?: string[];
  currencies?: string[];
};

export type MetricComparison = {
  value: number;
  previousValue: number;
  changePercent: number | null;
};

export type DashboardTimeSeriesPoint = {
  date: string;
  ordersGenerated: number;
  ordersConfirmed: number;
  ordersDelivered: number;
  ordersReturned: number;
  /** Provisional door cash (cash_collected). */
  cashCollected: number;
  /** Reconciled cash after Conciliación (settled). Primary product cash. */
  cashSettled: number;
  adSpend: number;
  checkoutRevenue: number;
  deliveredRevenue: number;
  rto: number;
  roasCheckout: number;
  /** Estimated from delivery mix — not cash at door. Prefer roasCollected for confirmed ROAS. */
  roasDelivered: number;
  /** Provisional door cash / ad spend. */
  roasCollected: number;
  /** Reconciled settled cash / ad spend — CODTracked ROAS truth. */
  roasSettled: number;
};

export type DashboardIntegrationHealth = {
  state: "healthy" | "warning" | "error" | "empty";
  activeCount: number;
  totalCount: number;
  lastSyncAt: string | null;
  errorCount: number;
};

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  totalAmount: number;
  currencyCode: string;
  sourceName: string | null;
};

export type DashboardKpiBundle = {
  ordersGenerated: MetricComparison;
  ordersConfirmed: MetricComparison;
  ordersDelivered: MetricComparison;
  ordersReturned: MetricComparison;
  /** Provisional door cash. */
  cashCollected: MetricComparison;
  /** Reconciled cash (Conciliación approved). Primary cash KPI. */
  cashSettled: MetricComparison;
  confirmationRate: MetricComparison;
  deliveryRate: MetricComparison;
  rto: MetricComparison;
  roasCheckout: MetricComparison;
  roasDelivered: MetricComparison;
  /** Provisional ROAS on door cash. */
  roasCollected: MetricComparison;
  /** ROAS on reconciled settled cash — product effectiveness metric. */
  roasSettled: MetricComparison;
};

export type DashboardFunnel = {
  generated: number;
  confirmed: number;
  delivered: number;
  returned: number;
};

export type DashboardSummary = {
  currencyCode: string;
  rangeLabel: string;
  /** Current-period ad spend (ROAS denominator). When 0, ROAS KPIs should show "—". */
  adSpend: number;
  kpis: DashboardKpiBundle;
  funnel: DashboardFunnel;
  timeSeries: DashboardTimeSeriesPoint[];
  integrationHealth: DashboardIntegrationHealth;
  recentOrders: DashboardRecentOrder[];
  activeAlertCount: number;
};

/** @deprecated Prefer MetricComparison / DashboardSummary from the redesigned contract. */
export type Kpi = {
  value: number;
  previousValue: number | null;
  changePercent: number | null;
};

/** @deprecated Legacy shape kept for compatibility. */
export type DashboardKpis = {
  revenue: Kpi;
  orders: Kpi;
  averageOrderValue: Kpi;
  adSpend: Kpi;
  returnOnAdSpend: Kpi;
  deliveredOrders: Kpi;
};

/** @deprecated Prefer DashboardTimeSeriesPoint. */
export type TimeSeriesPoint = {
  date: string;
  revenue: number;
  orders: number;
  adSpend: number;
  conversions: number;
};
