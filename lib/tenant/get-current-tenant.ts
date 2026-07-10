import "server-only";
import { getUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/config/permissions";
import type { TenantMembership } from "@/lib/tenant/tenant-context";

export async function getCurrentTenant(): Promise<TenantMembership[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const [{ data: agencyMembers, error: agencyError }, { data: storeMembers, error: storeError }] = await Promise.all([
    supabase.from("agency_members").select("agency_id, role").eq("user_id", user.id).eq("status", "active"),
    supabase.from("store_members").select("store_id, role").eq("user_id", user.id).eq("status", "active"),
  ]);
  if (agencyError) throw agencyError;
  if (storeError) throw storeError;

  const agencyIds = agencyMembers.map((member) => member.agency_id);
  const storeIds = storeMembers.map((member) => member.store_id);
  const [{ data: agencies, error: agenciesError }, { data: stores, error: storesError }] = await Promise.all([
    agencyIds.length ? supabase.from("agencies").select("id, slug").in("id", agencyIds) : Promise.resolve({ data: [], error: null }),
    storeIds.length ? supabase.from("stores").select("id, agency_id, slug").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (agenciesError) throw agenciesError;
  if (storesError) throw storesError;

  const agencyById = new Map(agencies.map((agency) => [agency.id, agency]));
  const memberships: TenantMembership[] = agencyMembers.flatMap((member) => {
    const agency = agencyById.get(member.agency_id);
    const role = member.role as Role;
    return agency ? [{ agencyId: agency.id, agencySlug: agency.slug, roles: [role] }] : [];
  });

  for (const member of storeMembers) {
    const store = stores.find((candidate) => candidate.id === member.store_id);
    const role = member.role as Role;
    if (!store) continue;
    const agency = agencyById.get(store.agency_id);
    if (!agency) {
      const { data: storeAgency } = await supabase.from("agencies").select("id, slug").eq("id", store.agency_id).maybeSingle();
      if (!storeAgency) continue;
      memberships.push({ agencyId: storeAgency.id, agencySlug: storeAgency.slug, storeId: store.id, storeSlug: store.slug, roles: [role] });
      continue;
    }
    memberships.push({ agencyId: agency.id, agencySlug: agency.slug, storeId: store.id, storeSlug: store.slug, roles: [role] });
  }
  return memberships;
}
