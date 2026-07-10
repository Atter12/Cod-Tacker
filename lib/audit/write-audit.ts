import "server-only";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "agency_created"
  | "store_created"
  | "invitation_created"
  | "invitation_accepted"
  | "invitation_revoked"
  | "member_suspended"
  | "member_reactivated"
  | "member_role_changed"
  | "demo_seed_created"
  | "demo_seed_cleared";

type WriteAuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  agencyId?: string | null;
  storeId?: string | null;
  oldData?: Json;
  newData?: Json;
  /** Use service role when the caller has no insert policy (e.g. onboarding bootstrap). */
  useAdmin?: boolean;
};

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const client = input.useAdmin ? createAdminClient() : await createClient();
  const { error } = await client.from("audit_logs").insert({
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    actor_id: input.actorId ?? null,
    agency_id: input.agencyId ?? null,
    store_id: input.storeId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
  });
  if (error) {
    // Audit must not break primary flows; surface in logs only.
    console.error("audit_logs.insert_failed", error.message);
  }
}
