import type { Enums, Tables } from "./database.generated"
import type { DateRange } from "./dashboard"

export type Order = Tables<"orders">
export type OrderItem = Tables<"order_items">
export type OrderStatus = Enums<"order_status">
export type PaymentStatus = Enums<"payment_status">

export type OrderFilters = DateRange & {
  storeIds?: string[]
  statuses?: OrderStatus[]
  paymentStatuses?: PaymentStatus[]
  search?: string
}

export type OrderDetail = Order & {
  items: OrderItem[]
  customer: Tables<"customers"> | null
  shipments: Tables<"shipments">[]
}

export type PaginatedOrders = {
  data: Order[]
  total: number
  page: number
  pageSize: number
}
