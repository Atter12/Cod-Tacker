import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-session";
import type { AgencyRole, Role, StoreRoleValue } from "@/config/permissions";

/** Agency roles that grant access to every active store in the agency. */
export const AGENCY_WIDE_STORE_ROLES: readonly AgencyRole[] = ["owner", "admin", "manager"];

export type AccessibleStore = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  effectiveRole: Extract<Role, "owner" | "admin" | "manager" | "operator" | "analyst" | "viewer">;
  accessSource: "agency" | "store";
};

function isAgencyWideRole(role: string): role is AgencyRole {
  return (AGENCY_WIDE_STORE_ROLES as readonly string[]).includes(role);
}

/**
 * Canonical list of stores the signed-in user may enter.
 * owner/admin/manager → all active stores of their agencies;
 * analyst/viewer (and store-only members) → only active store_members rows.
 * Request-scoped via React cache() to dedupe layout + page lookups.
 */
export const getAccessibleStores = cache(async (userId?: string): Promise<AccessibleStore[]> => {
  const user = userId ? { id: userId } : await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const [{ data: agencyMembers, error: agencyError }, { data: storeMembers, error: storeError }] = await Promise.all([
    supabase.from("agency_members").select("agency_id, role").eq("user_id", user.id).eq("status", "active"),
    supabase.from("store_members").select("store_id, role").eq("user_id", user.id).eq("status", "active"),
  ]);
  if (agencyError) throw agencyError;
  if (storeError) throw storeError;

  const byStoreId = new Map<string, AccessibleStore>();

  const wideAgencyIds = (agencyMembers ?? [])
    .filter((member) => isAgencyWideRole(member.role))
    .map((member) => member.agency_id);

  if (wideAgencyIds.length) {
    const { data: agencies, error: agenciesError } = await supabase
      .from("agencies")
      .select("id, name, slug")
      .in("id", wideAgencyIds)
      .eq("is_active", true);
    if (agenciesError) throw agenciesError;

    const { data: agencyStores, error: storesError } = await supabase
      .from("stores")
      .select("id, name, slug, agency_id")
      .in("agency_id", wideAgencyIds)
      .eq("is_active", true);
    if (storesError) throw storesError;

    for (const store of agencyStores ?? []) {
      const agency = (agencies ?? []).find((item) => item.id === store.agency_id);
      const membership = (agencyMembers ?? []).find((item) => item.agency_id === store.agency_id);
      if (!agency || !membership || !isAgencyWideRole(membership.role)) continue;
      byStoreId.set(store.id, {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        agencyId: agency.id,
        agencyName: agency.name,
        agencySlug: agency.slug,
        effectiveRole: membership.role,
        accessSource: "agency",
      });
    }
  }

  const storeIds = (storeMembers ?? []).map((member) => member.store_id);
  if (storeIds.length) {
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, name, slug, agency_id")
      .in("id", storeIds)
      .eq("is_active", true);
    if (storesError) throw storesError;

    const agencyIds = [...new Set((stores ?? []).map((store) => store.agency_id))];
    const { data: agencies, error: agenciesError } = agencyIds.length
      ? await supabase.from("agencies").select("id, name, slug").in("id", agencyIds)
      : { data: [], error: null };
    if (agenciesError) throw agenciesError;

    for (const member of storeMembers ?? []) {
      if (byStoreId.has(member.store_id)) continue;
      const store = (stores ?? []).find((item) => item.id === member.store_id);
      if (!store) continue;
      const agency = (agencies ?? []).find((item) => item.id === store.agency_id);
      if (!agency) continue;
      byStoreId.set(store.id, {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        agencyId: agency.id,
        agencyName: agency.name,
        agencySlug: agency.slug,
        effectiveRole: member.role as StoreRoleValue,
        accessSource: "store",
      });
    }
  }

  return [...byStoreId.values()].sort((a, b) => a.storeName.localeCompare(b.storeName, "es"));
});

export async function getEffectiveStoreRole(
  storeId: string,
  userId?: string,
): Promise<AccessibleStore["effectiveRole"] | null> {
  const stores = await getAccessibleStores(userId);
  return stores.find((store) => store.storeId === storeId)?.effectiveRole ?? null;
}

export function accessibleStoreToMembership(store: AccessibleStore) {
  return {
    agencyId: store.agencyId,
    agencySlug: store.agencySlug,
    storeId: store.storeId,
    storeSlug: store.storeSlug,
    roles: [store.effectiveRole] as Role[],
  };
}
