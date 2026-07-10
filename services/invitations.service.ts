import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listPendingInvitations(agencyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("agency_id", agencyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
