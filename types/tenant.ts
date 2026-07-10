import type { Tables } from "./database.generated"
import type { AgencyRole, StoreRole } from "./auth"

export type Agency = Tables<"agencies">
export type Store = Tables<"stores">
export type AgencyMember = Tables<"agency_members">
export type StoreMember = Tables<"store_members">

export type TenantContext = {
  agency: Agency
  store: Store | null
  agencyRole: AgencyRole
  storeRole: StoreRole | null
}

export type TenantScope =
  | { kind: "agency"; agencyId: string }
  | { kind: "store"; agencyId: string; storeId: string }
