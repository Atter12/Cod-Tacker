import type { Enums, Tables } from "./database.generated"
import type { DateRange } from "./dashboard"

export type Shipment = Tables<"shipments">
export type ShipmentEvent = Tables<"shipment_events">
export type ShipmentStatus = Enums<"shipment_status">

export type ShipmentFilters = DateRange & {
  storeIds?: string[]
  carrierIds?: string[]
  statuses?: ShipmentStatus[]
  search?: string
}

export type DeliveryKpis = {
  shipped: number
  inTransit: number
  delivered: number
  exceptions: number
  deliveryRate: number | null
  averageDeliveryDays: number | null
}
