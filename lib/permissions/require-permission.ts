import "server-only";
import { PermissionError } from "@/lib/errors";
import { can } from "@/lib/permissions/can";
import type { Permission, Role } from "@/config/permissions";
export function requirePermission(roles: readonly Role[], permission: Permission): void { if (!can(roles, permission)) throw new PermissionError(); }
