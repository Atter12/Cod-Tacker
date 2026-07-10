import "server-only";

import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import type { TenantMembership } from "@/lib/tenant/tenant-context";

/**
 * Ensures the user can enter a store. Uses the same membership resolution as
 * getAccessState (including agency-level access without store_members).
 */
export async function requireStoreAccess(agencySlug: string, storeSlug: string): Promise<TenantMembership> {
  const membership = (await getCurrentTenant()).find(
    (item) => item.agencySlug === agencySlug && item.storeSlug === storeSlug,
  );
  if (!membership?.storeId) redirect("/unauthorized");
  return membership;
}
