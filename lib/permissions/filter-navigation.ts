import { can } from "@/lib/permissions/can";
import type { Permission, Role } from "@/config/permissions";
import type { NavigationItem } from "@/config/navigation";

export function filterNavigationByPermission(
  items: NavigationItem[],
  roles: readonly Role[],
): NavigationItem[] {
  return items.filter((item) => {
    if (!item.permission) return true;
    return can(roles, item.permission as Permission);
  });
}
