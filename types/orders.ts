import type { Enums, Tables } from "./database.generated";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;
export type ConfirmationStatus = Enums<"confirmation_status">;
export type OrderStatusHistory = Tables<"order_status_history">;

export type OrderSortField = "created_at_source" | "total_amount" | "order_status";
export type SortDirection = "asc" | "desc";

export type OrderFilters = {
  from?: string;
  to?: string;
  timezone?: string;
  storeIds?: string[];
  statuses?: OrderStatus[];
  paymentStatuses?: PaymentStatus[];
  confirmationStatuses?: ConfirmationStatus[];
  search?: string;
  city?: string;
  district?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: OrderSortField;
  sortDir?: SortDirection;
};

export type OrderNote = {
  id: string;
  agency_id: string;
  store_id: string;
  order_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type OrderTimelineItem = {
  id: string;
  kind:
    | "status"
    | "shipment"
    | "payment"
    | "confirmation"
    | "attribution"
    | "conversion"
    | "whatsapp"
    | "settlement"
    | "audit"
    | "note"
    | "alert"
    | "raw_event";
  title: string;
  description?: string;
  occurredAt: string;
  meta?: Record<string, unknown>;
};

export type OrderDetailBundle = {
  order: Order;
  items: OrderItem[];
  customer: Tables<"customers"> | null;
  statusHistory: OrderStatusHistory[];
  attributions: Tables<"order_attributions">[];
  shipments: Tables<"shipments">[];
  shipmentEvents: Tables<"shipment_events">[];
  whatsappConversations: Tables<"whatsapp_conversations">[];
  whatsappMessages: Tables<"whatsapp_messages">[];
  settlementItems: Tables<"settlement_items">[];
  settlementBatches: Tables<"settlement_batches">[];
  conversionEvents: Tables<"conversion_events">[];
  rawEvents: Tables<"raw_events">[];
  auditLogs: Tables<"audit_logs">[];
  notes: OrderNote[];
  alerts: Tables<"alerts">[];
  timeline: OrderTimelineItem[];
};

export type PaginatedOrders = {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
};

/** @deprecated Prefer OrderDetailBundle */
export type OrderDetail = Order & {
  items: OrderItem[];
  customer: Tables<"customers"> | null;
  shipments: Tables<"shipments">[];
};
