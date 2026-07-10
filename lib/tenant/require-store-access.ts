import "server-only";

import { redirect } from "next/navigation";
import { getAccessibleStores, accessibleStoreToMembership } from "@/lib/tenant/get-accessible-stores";
import type { TenantMembership } from "@/lib/tenant/tenant-context";

/**
 * Ensures the user can enter a store. Uses the same resolution as getAccessibleStores.
 */
export async function requireStoreAccess(agencySlug: string, storeSlug: string): Promise<TenantMembership> {
  const stores = await getAccessibleStores();
  const match = stores.find((store) => store.agencySlug === agencySlug && store.storeSlug === storeSlug);
  if (!match) redirect("/unauthorized");
  return accessibleStoreToMembership(match);
}

export async function requireStoreAccessById(storeId: string): Promise<TenantMembership> {
  const stores = await getAccessibleStores();
  const match = stores.find((store) => store.storeId === storeId);
  if (!match) redirect("/unauthorized");
  return accessibleStoreToMembership(match);
}
