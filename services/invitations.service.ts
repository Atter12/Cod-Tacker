import type { DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced. */
export async function listPendingInvitations(client: DatabaseClient, agencyId: string) {
  const { data, error } = await client
    .from("agency_invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("agency_id", agencyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
