import type { Enums, Tables } from "./database.generated"

export type Shipment = Tables<"shipments">
export type ShipmentEvent = Tables<"shipment_events">
export type ShipmentStatus = Enums<"shipment_status">

export type ShipmentFilters = {
  from?: string
  to?: string
  timezone?: string
  storeIds?: string[]
  carrierIds?: string[]
  statuses?: ShipmentStatus[]
  search?: string
  isRto?: boolean
  isTerminal?: boolean
}

export type DeliveryKpis = {
  shipped: number
  inTransit: number
  delivered: number
  exceptions: number
  deliveryRate: number | null
  averageDeliveryDays: number | null
}
