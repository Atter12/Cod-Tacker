import type { Enums, Tables } from "./database.generated"
import type { DateRange } from "./dashboard"

export type AttributionModel = Enums<"attribution_model">
export type AdPlatform = Enums<"ad_platform">
export type AttributionTouchpoint = Tables<"attribution_touchpoints">
export type OrderAttribution = Tables<"order_attributions">

export type AttributionFilters = DateRange & {
  storeIds?: string[]
  model?: AttributionModel
  platforms?: AdPlatform[]
}

export type ChannelAttribution = {
  platform: string
  revenue: number
  orders: number
  spend: number
  roas: number | null
}
