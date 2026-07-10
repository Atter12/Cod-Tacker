import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-session";
import type { TenantMembership } from "@/lib/tenant/tenant-context";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export type AccessState =
  | { kind: "ready"; stores: Array<TenantMembership & { storeId: string; storeSlug: string }> }
  | { kind: "onboarding" }
  | { kind: "pending_invite" };

function withStores(memberships: TenantMembership[]) {
  return memberships.filter(
    (membership): membership is TenantMembership & { storeId: string; storeSlug: string } =>
      Boolean(membership.storeId && membership.storeSlug),
  );
}

/**
 * Resolves whether the signed-in user should enter a store, complete onboarding,
 * or wait for an invitation to be activated.
 */
export async function getAccessState(): Promise<AccessState> {
  const user = await getUser();
  if (!user) return { kind: "onboarding" };

  const memberships = await getCurrentTenant();
  let stores = withStores(memberships);

  // Agency owners/admins may access stores via agency membership without a store_members row.
  if (!stores.length) {
    const agencyOnly = memberships.filter((item) => !item.storeId);
    if (agencyOnly.length) {
      const supabase = await createClient();
      const agencyIds = agencyOnly.map((item) => item.agencyId);
      const { data: agencyStores } = await supabase
        .from("stores")
        .select("id, slug, agency_id")
        .in("agency_id", agencyIds)
        .eq("is_active", true);
      stores = (agencyStores ?? []).flatMap((store) => {
        const agency = agencyOnly.find((item) => item.agencyId === store.agency_id);
        if (!agency) return [];
        return [
          {
            agencyId: agency.agencyId,
            agencySlug: agency.agencySlug,
            storeId: store.id,
            storeSlug: store.slug,
            roles: agency.roles,
          },
        ];
      });
    }
  }

  if (stores.length) return { kind: "ready", stores };

  const supabase = await createClient();
  const { data: invited } = await supabase
    .from("agency_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "invited")
    .limit(1);

  if (invited?.length) return { kind: "pending_invite" };
  return { kind: "onboarding" };
}
