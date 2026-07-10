import { permissions, type Permission, type Role } from "@/config/permissions";
export function can(roles: readonly Role[], permission: Permission): boolean { return roles.some((role) => (permissions[permission] as readonly Role[]).includes(role)); }
