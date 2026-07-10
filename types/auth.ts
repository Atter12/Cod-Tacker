import type { Enums, Tables } from "./database.generated"

export type PlatformRole = Enums<"platform_role">
export type AgencyRole = Enums<"agency_role">
export type StoreRole = Enums<"store_role">
export type MemberStatus = Enums<"member_status">

export type AuthenticatedUser = Pick<Tables<"profiles">, "id" | "email" | "full_name" | "avatar_url" | "platform_role">

export type AuthSession = {
  user: AuthenticatedUser
  accessToken: string
  expiresAt: number | null
}

export type PermissionContext = {
  userId: string
  platformRole: PlatformRole
  agencyIds: string[]
  storeIds: string[]
}
