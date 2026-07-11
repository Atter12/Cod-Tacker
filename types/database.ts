/**
 * Stable app-facing database types.
 * Row/Insert/Update aliases survive `supabase gen types` regenerations of
 * `database.generated.ts`.
 */
export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.generated";

import type { Tables, TablesInsert, TablesUpdate } from "./database.generated";

export type AgencyRow = Tables<"agencies">;
export type AgencyInvitationRow = Tables<"agency_invitations">;
export type WhiteLabelSettingsRow = Tables<"white_label_settings">;
export type StoreRow = Tables<"stores">;
export type StoreMemberRow = Tables<"store_members">;
export type ProfileRow = Tables<"profiles">;
export type PlanRow = Tables<"plans">;
export type SubscriptionRow = Tables<"subscriptions">;
export type IntegrationRow = Tables<"integrations">;
export type SyncRunRow = Tables<"sync_runs">;
export type SyncRunItemRow = Tables<"sync_run_items">;
export type IntegrationHealthCheckRow = Tables<"integration_health_checks">;
export type RawEventRow = Tables<"raw_events">;
export type BackgroundJobRow = Tables<"background_jobs">;
export type JobAttemptRow = Tables<"job_attempts">;
export type CustomerRow = Tables<"customers">;
export type ProductRow = Tables<"products">;
export type ProductVariantRow = Tables<"product_variants">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type OrderStatusHistoryRow = Tables<"order_status_history">;
export type AdAccountRow = Tables<"ad_accounts">;
export type AdCampaignRow = Tables<"ad_campaigns">;
export type AdSetRow = Tables<"ad_sets">;
export type AdRow = Tables<"ads">;
export type AdSpendDailyRow = Tables<"ad_spend_daily">;
export type AttributionTouchpointRow = Tables<"attribution_touchpoints">;
export type OrderAttributionRow = Tables<"order_attributions">;
export type CarrierRow = Tables<"carriers">;
export type CarrierConnectionRow = Tables<"carrier_connections">;
export type CarrierStatusMappingRow = Tables<"carrier_status_mappings">;
export type CarrierStatusMappingVersionRow = Tables<"carrier_status_mapping_versions">;
export type UnmappedCarrierStatusRow = Tables<"unmapped_carrier_statuses">;
export type ShipmentRow = Tables<"shipments">;
export type ShipmentEventRow = Tables<"shipment_events">;
export type WhatsappConversationRow = Tables<"whatsapp_conversations">;
export type WhatsappMessageRow = Tables<"whatsapp_messages">;
export type WhatsappTemplateRow = Tables<"whatsapp_templates">;
export type SettlementBatchRow = Tables<"settlement_batches">;
export type SettlementItemRow = Tables<"settlement_items">;
export type ConversionEventRow = Tables<"conversion_events">;
export type AutomationRuleRow = Tables<"automation_rules">;
export type AutomationRunRow = Tables<"automation_runs">;
export type AlertRow = Tables<"alerts">;
export type AlertNoteRow = Tables<"alert_notes">;
export type ApiKeyRow = Tables<"api_keys">;
export type AuditLogRow = Tables<"audit_logs">;
export type InvoiceRecordRow = Tables<"invoice_records">;
export type UsageCounterRow = Tables<"usage_counters">;
export type ApiKeyRateLimitRow = Tables<"api_key_rate_limits">;
export type DataExportRequestRow = Tables<"data_export_requests">;
export type DataDeletionRequestRow = Tables<"data_deletion_requests">;

export type AgencyInsert = TablesInsert<"agencies">;
export type StoreInsert = TablesInsert<"stores">;
export type OrderInsert = TablesInsert<"orders">;

export type AgencyUpdate = TablesUpdate<"agencies">;
export type StoreUpdate = TablesUpdate<"stores">;
export type ProfileUpdate = TablesUpdate<"profiles">;
