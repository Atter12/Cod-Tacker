/**
 * Application-level roles and coarse-grained permission map.
 *
 * Platform roles use their full enum values to stay distinct.
 * Agency and store roles use the plain DB enum values (owner, admin, etc.).
 * Fine-grained row-level checks use the Supabase RPC helpers
 * (has_agency_role / has_store_role) in server actions and services.
 *
 * Module permissions prepared for upcoming sprints (integrations, operations,
 * shipments, reconciliation, attribution, automations, alerts, WhatsApp).
 * Hiding UI is not authorization — always re-check on the server.
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

const opsManage: Role[] = ["platform_owner", "platform_admin", "owner", "admin", "operator"];
const opsView: Role[] = [...platformRoles, ...agencyRoles, ...storeRoles];
const analyticsView: Role[] = [...platformRoles, ...agencyRoles, ...storeRoles];
const configManage: Role[] = ["platform_owner", "platform_admin", "owner", "admin"];
const configView: Role[] = ["platform_owner", "platform_admin", "owner", "admin", "manager", "analyst"];

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
  "orders.manage": opsManage,
  "orders.view": opsView,
  "billing.view": ["platform_owner", "platform_admin", "owner", "admin", "manager"],
  "billing.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "api_keys.view": ["platform_owner", "platform_admin", "owner", "admin"],
  "api_keys.manage": ["platform_owner", "platform_admin", "owner", "admin"],
  "branding.manage": ["platform_owner", "platform_admin", "owner", "admin"],

  // --- Sprint-ready module permissions (UI + server checks in later sprints) ---
  "integrations.view": configView,
  "integrations.manage": configManage,
  "operations.view": opsView,
  "operations.manage": opsManage,
  "shipments.view": opsView,
  "shipments.manage": opsManage,
  "reconciliation.view": ["platform_owner", "platform_admin", "owner", "admin", "manager", "analyst"],
  "reconciliation.manage": ["platform_owner", "platform_admin", "owner", "admin", "manager"],
  "attribution.view": analyticsView,
  "attribution.manage": ["platform_owner", "platform_admin", "owner", "admin", "manager"],
  "automations.view": configView,
  "automations.manage": configManage,
  "alerts.view": opsView,
  "alerts.manage": ["platform_owner", "platform_admin", "owner", "admin", "manager", "operator"],
  "whatsapp.view": configView,
  "whatsapp.manage": configManage,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;
