import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-session";
import type { TenantMembership } from "@/lib/tenant/tenant-context";
import { accessibleStoreToMembership, getAccessibleStores } from "@/lib/tenant/get-accessible-stores";

export type AccessState =
  | { kind: "ready"; stores: Array<TenantMembership & { storeId: string; storeSlug: string }> }
  | { kind: "onboarding" }
  | { kind: "pending_invite" };

/**
 * Resolves whether the signed-in user should enter a store, complete onboarding,
 * or accept a pending agency invitation.
 */
export async function getAccessState(): Promise<AccessState> {
  const user = await getUser();
  if (!user) return { kind: "onboarding" };

  const stores = await getAccessibleStores(user.id);
  if (stores.length) {
    return {
      kind: "ready",
      stores: stores.map((store) => accessibleStoreToMembership(store) as TenantMembership & { storeId: string; storeSlug: string }),
    };
  }

  const supabase = await createClient();
  const email = user.email?.trim().toLowerCase();
  if (email) {
    const { data: invitations } = await supabase
      .from("agency_invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (invitations?.length) return { kind: "pending_invite" };
  }

  const { data: agencyMembership } = await supabase
    .from("agency_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (agencyMembership?.length) {
    return { kind: "ready", stores: [] };
  }

  return { kind: "onboarding" };
}
