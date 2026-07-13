import "server-only";

import { cache } from "react";
import { getUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/config/permissions";
import type { TenantMembership } from "@/lib/tenant/tenant-context";
import { accessibleStoreToMembership, getAccessibleStores } from "@/lib/tenant/get-accessible-stores";

/**
 * Agency memberships (with or without store) plus accessible stores.
 * Store rows always come from getAccessibleStores (single access rule).
 * Request-scoped via React cache() to dedupe nested layout/page guards.
 */
export const getCurrentTenant = cache(async (): Promise<TenantMembership[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data: agencyMembers, error: agencyError } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (agencyError) throw agencyError;

  const agencyIds = (agencyMembers ?? []).map((member) => member.agency_id);
  const { data: agencies, error: agenciesError } = agencyIds.length
    ? await supabase.from("agencies").select("id, slug").in("id", agencyIds)
    : { data: [], error: null };
  if (agenciesError) throw agenciesError;

  const agencyById = new Map((agencies ?? []).map((agency) => [agency.id, agency]));
  const memberships: TenantMembership[] = (agencyMembers ?? []).flatMap((member) => {
    const agency = agencyById.get(member.agency_id);
    return agency
      ? [{ agencyId: agency.id, agencySlug: agency.slug, roles: [member.role as Role] }]
      : [];
  });

  // Same cache key as layout callers (`getAccessibleStores()` with no args).
  const stores = await getAccessibleStores();
  for (const store of stores) {
    memberships.push(accessibleStoreToMembership(store));
  }

  return memberships;
});
