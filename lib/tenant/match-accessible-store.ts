/** Store identity used to decide if a session may enter a tenant URL. */
export type StoreAccessRef = {
  agencySlug: string;
  storeSlug: string;
};

/**
 * A session only enters a store when both the agency slug and the store slug
 * match. The same store slug under another agency is a different tenant.
 */
export function matchAccessibleStore<T extends StoreAccessRef>(
  stores: readonly T[],
  agencySlug: string,
  storeSlug: string,
): T | null {
  return (
    stores.find((store) => store.agencySlug === agencySlug && store.storeSlug === storeSlug) ??
    null
  );
}
