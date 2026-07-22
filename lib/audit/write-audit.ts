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
  | "demo_seed_cleared"
  | "order_confirmed"
  | "order_cancelled"
  | "order_rejected"
  | "order_status_changed"
  | "order_payment_status_changed"
  | "order_marked_for_review"
  | "order_note_added"
  | "order_alert_created"
  | "integration_connected"
  | "integration_disconnected"
  | "integration_reconnected"
  | "integration_tested"
  | "integration_synced"
  | "integration_backfill"
  | "carrier_mapping_created"
  | "carrier_mapping_updated"
  | "carrier_mapping_deleted"
  | "shipment_alert_created"
  | "shipment_marked_for_review"
  | "shipment_mock_event_enqueued"
  | "settlement_csv_import_enqueued"
  | "settlement_item_collected_confirmed"
  | "settlement_batch_approved"
  | "settlement_batch_reopened"
  | "settlement_item_manual_match"
  | "settlement_item_discrepancy_resolved"
  | "ads_hierarchy_seed_enqueued"
  | "conversion_released"
  | "conversion_rejected"
  | "alert_acknowledged"
  | "alert_assigned"
  | "alert_resolved"
  | "alert_reopened"
  | "alert_silenced"
  | "alert_note_added"
  | "alert_bulk_resolved"
  | "automation_rule_created"
  | "automation_rule_updated"
  | "automation_rule_activated"
  | "automation_rule_deactivated"
  | "automation_run_approved"
  | "automation_trigger_fired"
  | "whatsapp_message_sent"
  | "whatsapp_reply_simulated"
  | "whatsapp_order_confirmed"
  | "whatsapp_order_rejected"
  | "whatsapp_conversation_closed"
  | "whatsapp_confirmation_requested"
  | "whatsapp_template_created"
  | "whatsapp_template_updated"
  | "whatsapp_template_duplicated"
  | "store_settings_updated"
  | "branding_updated"
  | "branding_defaults_restored"
  | "branding_asset_uploaded"
  | "api_key_created"
  | "api_key_rotated"
  | "api_key_revoked"
  | "billing_plan_changed"
  | "billing_cancel_scheduled"
  | "billing_reactivated"
  | "agency_suspended"
  | "agency_reactivated"
  | "store_suspended"
  | "store_reactivated"
  | "user_suspended"
  | "user_reactivated"
  | "support_access_granted"
  | "support_access_revoked"
  | "data_export_requested"
  | "data_deletion_requested"
  | "data_deletion_reviewed";

type WriteAuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  agencyId?: string | null;
  storeId?: string | null;
  oldData?: Json;
  newData?: Json;
  requestId?: string | null;
  /** Use service role when the caller has no insert policy (e.g. onboarding bootstrap). */
  useAdmin?: boolean;
};

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  // Prefer service role: audit_logs typically has no authenticated INSERT policy.
  const client = input.useAdmin === false ? await createClient() : createAdminClient();
  const { error } = await client.from("audit_logs").insert({
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    actor_id: input.actorId ?? null,
    agency_id: input.agencyId ?? null,
    store_id: input.storeId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    request_id: input.requestId ?? null,
  });
  if (error) {
    // Audit must not break primary flows; surface in logs only.
    console.error("audit_logs.insert_failed", error.message);
  }
}
