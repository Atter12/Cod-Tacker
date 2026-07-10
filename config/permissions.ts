/**
 * Application-level roles and coarse-grained permission map.
 *
 * Platform roles use their full enum values to stay distinct.
 * Agency and store roles use the plain DB enum values (owner, admin, etc.).
 * Fine-grained row-level checks use the Supabase RPC helpers
 * (has_agency_role / has_store_role) in server actions and services.
 */
export const platformRoles = ["platform_owner", "platform_admin", "support", "analyst", "user"] as const;
export const agencyRoles = ["owner", "admin", "manager", "analyst", "viewer"] as const;
export const storeRoles = ["owner", "admin", "operator", "analyst", "viewer"] as const;

export type PlatformRole = (typeof platformRoles)[number];
export type AgencyRole = (typeof agencyRoles)[number];
export type StoreRoleValue = (typeof storeRoles)[number];
export type Role = PlatformRole | AgencyRole | StoreRoleValue;

/** Roles that may be assigned via agency invitation (never owner). */
export const invitableAgencyRoles = ["admin", "analyst", "viewer"] as const;
export type InvitableAgencyRole = (typeof invitableAgencyRoles)[number];

export const permissions = {
  "platform.manage": ["platform_owner", "platform_admin"],
  "agency.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "agency.view": [...platformRoles, ...agencyRoles],
  "agency.team.view": ["platform_owner", "platform_admin", "owner", "admin", "manager"],
  "agency.team.invite": ["platform_owner", "platform_admin", "owner", "admin"],
  "agency.team.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "store.create": ["platform_owner", "platform_admin", "owner", "admin"],
  "store.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "store.view": [...platformRoles, ...agencyRoles, ...storeRoles],
  "orders.manage": ["platform_owner", "platform_admin", "owner", "admin", "operator"],
  "orders.view": [...platformRoles, ...agencyRoles, ...storeRoles],
  "billing.view": ["platform_owner", "platform_admin", "owner", "admin", "manager"],
  "billing.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "api_keys.view": ["platform_owner", "platform_admin", "owner", "admin"],
  "api_keys.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "branding.manage": ["platform_owner", "platform_admin", "owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;
