export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          agency_id: string
          created_at: string
          currency_code: string | null
          external_account_id: string
          id: string
          integration_id: string
          is_active: boolean
          metadata: Json
          name: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          store_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          currency_code?: string | null
          external_account_id: string
          id?: string
          integration_id: string
          is_active?: boolean
          metadata?: Json
          name?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          store_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          currency_code?: string | null
          external_account_id?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          metadata?: Json
          name?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          store_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          ad_account_id: string
          agency_id: string
          created_at: string
          external_campaign_id: string
          id: string
          metadata: Json
          name: string
          objective: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          agency_id: string
          created_at?: string
          external_campaign_id: string
          id?: string
          metadata?: Json
          name: string
          objective?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          agency_id?: string
          created_at?: string
          external_campaign_id?: string
          id?: string
          metadata?: Json
          name?: string
          objective?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          agency_id: string
          campaign_id: string
          created_at: string
          external_ad_set_id: string
          id: string
          metadata: Json
          name: string
          platform: Database["public"]["Enums"]["ad_platform"]
          status: string | null
          store_id: string | null
          targeting: Json
          updated_at: string
        }
        Insert: {
          agency_id: string
          campaign_id: string
          created_at?: string
          external_ad_set_id: string
          id?: string
          metadata?: Json
          name: string
          platform: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          targeting?: Json
          updated_at?: string
        }
        Update: {
          agency_id?: string
          campaign_id?: string
          created_at?: string
          external_ad_set_id?: string
          id?: string
          metadata?: Json
          name?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          targeting?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_daily: {
        Row: {
          ad_account_id: string
          ad_id: string | null
          ad_set_id: string | null
          agency_id: string
          campaign_id: string | null
          clicks: number
          currency_code: string
          id: string
          imported_at: string
          impressions: number
          metric_date: string
          platform: Database["public"]["Enums"]["ad_platform"]
          platform_conversion_value: number
          platform_conversions: number
          raw_metrics: Json
          spend: number
          store_id: string | null
        }
        Insert: {
          ad_account_id: string
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id: string
          campaign_id?: string | null
          clicks?: number
          currency_code: string
          id?: string
          imported_at?: string
          impressions?: number
          metric_date: string
          platform: Database["public"]["Enums"]["ad_platform"]
          platform_conversion_value?: number
          platform_conversions?: number
          raw_metrics?: Json
          spend?: number
          store_id?: string | null
        }
        Update: {
          ad_account_id?: string
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id?: string
          campaign_id?: string | null
          clicks?: number
          currency_code?: string
          id?: string
          imported_at?: string
          impressions?: number
          metric_date?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          platform_conversion_value?: number
          platform_conversions?: number
          raw_metrics?: Json
          spend?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_set_id: string
          agency_id: string
          campaign_id: string
          created_at: string
          creative_id: string | null
          destination_url: string | null
          external_ad_id: string
          id: string
          metadata: Json
          name: string
          platform: Database["public"]["Enums"]["ad_platform"]
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          ad_set_id: string
          agency_id: string
          campaign_id: string
          created_at?: string
          creative_id?: string | null
          destination_url?: string | null
          external_ad_id: string
          id?: string
          metadata?: Json
          name: string
          platform: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_set_id?: string
          agency_id?: string
          campaign_id?: string
          created_at?: string
          creative_id?: string | null
          destination_url?: string | null
          external_ad_id?: string
          id?: string
          metadata?: Json
          name?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          currency_code: string
          custom_domain: string | null
          id: string
          is_active: boolean
          is_white_label_enabled: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          is_white_label_enabled?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          is_white_label_enabled?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["agency_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["agency_role"]
          status: Database["public"]["Enums"]["agency_invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["agency_invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["agency_invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711180000_alerts_automations.sql
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agency_id: string
          assigned_to: string | null
          body: string | null
          campaign_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          shipment_id: string | null
          silenced_until: string | null
          source_id: string | null
          source_type: string | null
          status: string
          store_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id: string
          assigned_to?: string | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          shipment_id?: string | null
          silenced_until?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          store_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id?: string
          assigned_to?: string | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          shipment_id?: string | null
          silenced_until?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          store_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — 20260711180000_alerts_automations.sql
      alert_notes: {
        Row: {
          agency_id: string
          alert_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          store_id: string | null
        }
        Insert: {
          agency_id: string
          alert_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          store_id?: string | null
        }
        Update: {
          agency_id?: string
          alert_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_notes_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          status: string
          store_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          store_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_touchpoints: {
        Row: {
          ad_id: string | null
          ad_set_id: string | null
          agency_id: string
          anonymous_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          click_id: string | null
          content: string | null
          created_at: string
          customer_id: string | null
          fbclid: string | null
          id: string
          ip_hash: string | null
          landing_url: string | null
          medium: string | null
          metadata: Json
          occurred_at: string
          platform: Database["public"]["Enums"]["ad_platform"]
          referrer_url: string | null
          session_id: string | null
          source: string | null
          store_id: string
          term: string | null
          ttclid: string | null
          user_agent_hash: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id: string
          anonymous_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          click_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          fbclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_url?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          store_id: string
          term?: string | null
          ttclid?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id?: string
          anonymous_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          click_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          fbclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_url?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          store_id?: string
          term?: string | null
          ttclid?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_touchpoints_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_hash: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          store_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — 20260711180000_alerts_automations.sql
      automation_rules: {
        Row: {
          actions: Json
          agency_id: string
          conditions: Json
          cooldown_minutes: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          priority: number
          requires_manual_approval: boolean
          store_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          agency_id: string
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          priority?: number
          requires_manual_approval?: boolean
          store_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          agency_id?: string
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          priority?: number
          requires_manual_approval?: boolean
          store_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — 20260711180000_alerts_automations.sql
      automation_runs: {
        Row: {
          action_results: Json
          agency_id: string
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          rule_id: string
          shipment_id: string | null
          started_at: string | null
          status: string
          store_id: string | null
          trigger_payload: Json
          updated_at: string
        }
        Insert: {
          action_results?: Json
          agency_id: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          rule_id: string
          shipment_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          trigger_payload?: Json
          updated_at?: string
        }
        Update: {
          action_results?: Json
          agency_id?: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          rule_id?: string
          shipment_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          trigger_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711140000_background_jobs_pipeline.sql
      background_jobs: {
        Row: {
          agency_id: string
          attempts: number
          correlation_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string
          integration_id: string | null
          job_type: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          queue: string
          raw_event_id: string | null
          run_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["background_job_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key: string
          integration_id?: string | null
          job_type: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          queue?: string
          raw_event_id?: string | null
          run_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["background_job_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          integration_id?: string | null
          job_type?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          queue?: string
          raw_event_id?: string | null
          run_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["background_job_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711140000_background_jobs_pipeline.sql
      job_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_id: string
          result: Json | null
          started_at: string
          status: Database["public"]["Enums"]["job_attempt_status"]
        }
        Insert: {
          attempt_number: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          result?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_attempt_status"]
        }
        Update: {
          attempt_number?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          result?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_attempt_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_connections: {
        Row: {
          agency_id: string
          carrier_id: string
          created_at: string
          external_account_id: string | null
          id: string
          integration_id: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_polled_at: string | null
          last_success_at: string | null
          polling_enabled: boolean
          polling_interval_minutes: number
          secret_reference: string | null
          settings: Json
          status: Database["public"]["Enums"]["integration_status"]
          store_id: string | null
          updated_at: string
          webhook_enabled: boolean
        }
        Insert: {
          agency_id: string
          carrier_id: string
          created_at?: string
          external_account_id?: string | null
          id?: string
          integration_id?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_polled_at?: string | null
          last_success_at?: string | null
          polling_enabled?: boolean
          polling_interval_minutes?: number
          secret_reference?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          store_id?: string | null
          updated_at?: string
          webhook_enabled?: boolean
        }
        Update: {
          agency_id?: string
          carrier_id?: string
          created_at?: string
          external_account_id?: string | null
          id?: string
          integration_id?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_polled_at?: string | null
          last_success_at?: string | null
          polling_enabled?: boolean
          polling_interval_minutes?: number
          secret_reference?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          store_id?: string | null
          updated_at?: string
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carrier_connections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_connections_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_connections_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_status_mappings: {
        Row: {
          carrier_id: string
          created_at: string
          created_by: string | null
          external_status_code: string
          external_status_label: string | null
          id: string
          is_active: boolean
          is_rto: boolean
          is_terminal: boolean
          normalized_status: Database["public"]["Enums"]["shipment_status"]
          notes: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          carrier_id: string
          created_at?: string
          created_by?: string | null
          external_status_code: string
          external_status_label?: string | null
          id?: string
          is_active?: boolean
          is_rto?: boolean
          is_terminal?: boolean
          normalized_status: Database["public"]["Enums"]["shipment_status"]
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          created_at?: string
          created_by?: string | null
          external_status_code?: string
          external_status_label?: string | null
          id?: string
          is_active?: boolean
          is_rto?: boolean
          is_terminal?: boolean
          normalized_status?: Database["public"]["Enums"]["shipment_status"]
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_status_mappings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711150000_logistics_unmapped_and_mapping_versions.sql
      carrier_status_mapping_versions: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          mapping_id: string
          snapshot: Json
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          mapping_id: string
          snapshot?: Json
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          mapping_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "carrier_status_mapping_versions_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "carrier_status_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711150000_logistics_unmapped_and_mapping_versions.sql
      unmapped_carrier_statuses: {
        Row: {
          agency_id: string | null
          carrier_id: string
          external_status_code: string
          external_status_label: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          occurrence_count: number
          sample_payload: Json
        }
        Insert: {
          agency_id?: string | null
          carrier_id: string
          external_status_code: string
          external_status_label?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          sample_payload?: Json
        }
        Update: {
          agency_id?: string | null
          carrier_id?: string
          external_status_code?: string
          external_status_label?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          sample_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "unmapped_carrier_statuses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmapped_carrier_statuses_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          code: string
          country_codes: string[]
          created_at: string
          id: string
          is_active: boolean
          is_aggregator: boolean
          metadata: Json
          name: string
          supports_polling: boolean
          supports_webhooks: boolean
          updated_at: string
        }
        Insert: {
          code: string
          country_codes?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          is_aggregator?: boolean
          metadata?: Json
          name: string
          supports_polling?: boolean
          supports_webhooks?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          country_codes?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          is_aggregator?: boolean
          metadata?: Json
          name?: string
          supports_polling?: boolean
          supports_webhooks?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          acknowledged_at: string | null
          agency_id: string
          attempts: number
          created_at: string
          currency_code: string | null
          custom_data: Json
          event_id: string
          event_name: string
          event_time: string
          hold_reason: string | null
          id: string
          integration_id: string | null
          last_error_message: string | null
          max_attempts: number
          next_retry_at: string | null
          order_id: string
          platform: Database["public"]["Enums"]["ad_platform"]
          release_status: string
          released_at: string | null
          released_by: string | null
          response_payload: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at: string
          user_data: Json
          value: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          agency_id: string
          attempts?: number
          created_at?: string
          currency_code?: string | null
          custom_data?: Json
          event_id: string
          event_name: string
          event_time: string
          hold_reason?: string | null
          id?: string
          integration_id?: string | null
          last_error_message?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id: string
          platform: Database["public"]["Enums"]["ad_platform"]
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          response_payload?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at?: string
          user_data?: Json
          value?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          agency_id?: string
          attempts?: number
          created_at?: string
          currency_code?: string | null
          custom_data?: Json
          event_id?: string
          event_name?: string
          event_time?: string
          hold_reason?: string | null
          id?: string
          integration_id?: string | null
          last_error_message?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          response_payload?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          updated_at?: string
          user_data?: Json
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          delivered_orders: number
          email: string | null
          external_customer_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          phone: string | null
          postal_code: string | null
          region: string | null
          returned_orders: number
          risk_score: number | null
          store_id: string
          total_orders: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          delivered_orders?: number
          email?: string | null
          external_customer_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          returned_orders?: number
          risk_score?: number | null
          store_id: string
          total_orders?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          delivered_orders?: number
          email?: string | null
          external_customer_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          returned_orders?: number
          risk_score?: number | null
          store_id?: string
          total_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          agency_id: string
          connected_at: string | null
          connected_by: string | null
          created_at: string
          display_name: string | null
          external_account_id: string | null
          external_account_name: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[]
          secret_reference: string | null
          settings: Json
          status: Database["public"]["Enums"]["integration_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          secret_reference?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          secret_reference?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attributions: {
        Row: {
          ad_id: string | null
          ad_set_id: string | null
          agency_id: string
          attributed_value: number
          attribution_reason: string | null
          calculated_at: string
          campaign_id: string | null
          confidence_score: number | null
          credit: number
          id: string
          is_primary: boolean
          metadata: Json
          model: Database["public"]["Enums"]["attribution_model"]
          order_id: string
          platform: Database["public"]["Enums"]["ad_platform"]
          store_id: string
          touchpoint_id: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id: string
          attributed_value?: number
          attribution_reason?: string | null
          calculated_at?: string
          campaign_id?: string | null
          confidence_score?: number | null
          credit?: number
          id?: string
          is_primary?: boolean
          metadata?: Json
          model: Database["public"]["Enums"]["attribution_model"]
          order_id: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          store_id: string
          touchpoint_id?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_set_id?: string | null
          agency_id?: string
          attributed_value?: number
          attribution_reason?: string | null
          calculated_at?: string
          campaign_id?: string | null
          confidence_score?: number | null
          credit?: number
          id?: string
          is_primary?: boolean
          metadata?: Json
          model?: Database["public"]["Enums"]["attribution_model"]
          order_id?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          store_id?: string
          touchpoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attributions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_touchpoint_id_fkey"
            columns: ["touchpoint_id"]
            isOneToOne: false
            referencedRelation: "attribution_touchpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          external_line_item_id: string | null
          id: string
          metadata: Json
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          store_id: string
          title: string
          total_discount: number
          total_price: number
          unit_cost: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          external_line_item_id?: string | null
          id?: string
          metadata?: Json
          order_id: string
          product_id?: string | null
          quantity: number
          sku?: string | null
          store_id: string
          title: string
          total_discount?: number
          total_price: number
          unit_cost?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          external_line_item_id?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          store_id?: string
          title?: string
          total_discount?: number
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711120000_order_notes.sql
      order_notes: {
        Row: {
          agency_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          order_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          order_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711130000_sync_runs_and_health.sql
      integration_health_checks: {
        Row: {
          agency_id: string
          checked_at: string
          details: Json
          id: string
          integration_id: string
          latency_ms: number | null
          safe_message: string | null
          status: string
          store_id: string
        }
        Insert: {
          agency_id: string
          checked_at?: string
          details?: Json
          id?: string
          integration_id: string
          latency_ms?: number | null
          safe_message?: string | null
          status: string
          store_id: string
        }
        Update: {
          agency_id?: string
          checked_at?: string
          details?: Json
          id?: string
          integration_id?: string
          latency_ms?: number | null
          safe_message?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_checks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_health_checks_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_health_checks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711130000_sync_runs_and_health.sql
      sync_run_items: {
        Row: {
          action: string | null
          created_at: string
          entity_type: string
          error: string | null
          external_id: string | null
          id: string
          metadata: Json
          status: string
          sync_run_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          entity_type: string
          error?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          status: string
          sync_run_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          entity_type?: string
          error?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_run_items_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711130000_sync_runs_and_health.sql
      sync_runs: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          created_total: number
          cursor_after: string | null
          cursor_before: string | null
          error_code: string | null
          error_message: string | null
          failed_total: number
          finished_at: string | null
          id: string
          integration_id: string
          metadata: Json
          provider: string
          received_total: number
          skipped_total: number
          started_at: string | null
          status: string
          store_id: string
          sync_type: string
          trigger_source: string
          updated_total: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          created_total?: number
          cursor_after?: string | null
          cursor_before?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_total?: number
          finished_at?: string | null
          id?: string
          integration_id: string
          metadata?: Json
          provider: string
          received_total?: number
          skipped_total?: number
          started_at?: string | null
          status?: string
          store_id: string
          sync_type: string
          trigger_source: string
          updated_total?: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          created_total?: number
          cursor_after?: string | null
          cursor_before?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_total?: number
          finished_at?: string | null
          id?: string
          integration_id?: string
          metadata?: Json
          provider?: string
          received_total?: number
          skipped_total?: number
          started_at?: string | null
          status?: string
          store_id?: string
          sync_type?: string
          trigger_source?: string
          updated_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["order_status"]
          occurred_at: string
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
          reason_code: string | null
          reason_detail: string | null
          source_event_id: string | null
          source_provider:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          new_status: Database["public"]["Enums"]["order_status"]
          occurred_at: string
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          reason_code?: string | null
          reason_detail?: string | null
          source_event_id?: string | null
          source_provider?:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["order_status"]
          occurred_at?: string
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          reason_code?: string | null
          reason_detail?: string | null
          source_event_id?: string | null
          source_provider?:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agency_id: string
          browser_user_agent: string | null
          cancelled_at: string | null
          cart_token: string | null
          cash_collected_at: string | null
          checkout_token: string | null
          collected_cod_amount: number | null
          confirmation_status: Database["public"]["Enums"]["confirmation_status"]
          confirmed_at: string | null
          contribution_margin_amount: number | null
          cost_of_goods_amount: number | null
          created_at: string
          created_at_source: string
          currency_code: string
          customer_id: string | null
          customer_ip: unknown
          delivered_at: string | null
          discount_amount: number
          expected_cod_amount: number | null
          external_order_id: string
          id: string
          imported_at: string
          landing_site: string | null
          metadata: Json
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          referring_site: string | null
          return_cost_amount: number | null
          returned_at: string | null
          settled_at: string | null
          settled_cod_amount: number | null
          shipping_amount: number
          shipping_city: string | null
          shipping_cost_amount: number | null
          shipping_country_code: string | null
          shipping_district: string | null
          shipping_latitude: number | null
          shipping_longitude: number | null
          shipping_postal_code: string | null
          shipping_region: string | null
          source_name: string | null
          store_id: string
          subtotal_amount: number
          tags: string[]
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          browser_user_agent?: string | null
          cancelled_at?: string | null
          cart_token?: string | null
          cash_collected_at?: string | null
          checkout_token?: string | null
          collected_cod_amount?: number | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          confirmed_at?: string | null
          contribution_margin_amount?: number | null
          cost_of_goods_amount?: number | null
          created_at?: string
          created_at_source: string
          currency_code: string
          customer_id?: string | null
          customer_ip?: unknown
          delivered_at?: string | null
          discount_amount?: number
          expected_cod_amount?: number | null
          external_order_id: string
          id?: string
          imported_at?: string
          landing_site?: string | null
          metadata?: Json
          order_number?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          referring_site?: string | null
          return_cost_amount?: number | null
          returned_at?: string | null
          settled_at?: string | null
          settled_cod_amount?: number | null
          shipping_amount?: number
          shipping_city?: string | null
          shipping_cost_amount?: number | null
          shipping_country_code?: string | null
          shipping_district?: string | null
          shipping_latitude?: number | null
          shipping_longitude?: number | null
          shipping_postal_code?: string | null
          shipping_region?: string | null
          source_name?: string | null
          store_id: string
          subtotal_amount?: number
          tags?: string[]
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          browser_user_agent?: string | null
          cancelled_at?: string | null
          cart_token?: string | null
          cash_collected_at?: string | null
          checkout_token?: string | null
          collected_cod_amount?: number | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          confirmed_at?: string | null
          contribution_margin_amount?: number | null
          cost_of_goods_amount?: number | null
          created_at?: string
          created_at_source?: string
          currency_code?: string
          customer_id?: string | null
          customer_ip?: unknown
          delivered_at?: string | null
          discount_amount?: number
          expected_cod_amount?: number | null
          external_order_id?: string
          id?: string
          imported_at?: string
          landing_site?: string | null
          metadata?: Json
          order_number?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          referring_site?: string | null
          return_cost_amount?: number | null
          returned_at?: string | null
          settled_at?: string | null
          settled_cod_amount?: number | null
          shipping_amount?: number
          shipping_city?: string | null
          shipping_cost_amount?: number | null
          shipping_country_code?: string | null
          shipping_district?: string | null
          shipping_latitude?: number | null
          shipping_longitude?: number | null
          shipping_postal_code?: string | null
          shipping_region?: string | null
          source_name?: string | null
          store_id?: string
          subtotal_amount?: number
          tags?: string[]
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          annual_price: number | null
          code: string
          created_at: string
          currency_code: string
          features: Json
          id: string
          is_active: boolean
          is_public: boolean
          monthly_price: number
          name: string
          order_limit: number | null
          store_limit: number | null
          updated_at: string
        }
        Insert: {
          annual_price?: number | null
          code: string
          created_at?: string
          currency_code?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          monthly_price?: number
          name: string
          order_limit?: number | null
          store_limit?: number | null
          updated_at?: string
        }
        Update: {
          annual_price?: number | null
          code?: string
          created_at?: string
          currency_code?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          monthly_price?: number
          name?: string
          order_limit?: number | null
          store_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          cost: number | null
          created_at: string
          external_variant_id: string
          id: string
          metadata: Json
          price: number | null
          product_id: string
          sku: string | null
          store_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          external_variant_id: string
          id?: string
          metadata?: Json
          price?: number | null
          product_id: string
          sku?: string | null
          store_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          external_variant_id?: string
          id?: string
          metadata?: Json
          price?: number | null
          product_id?: string
          sku?: string | null
          store_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          external_product_id: string
          id: string
          image_url: string | null
          metadata: Json
          product_type: string | null
          store_id: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          external_product_id: string
          id?: string
          image_url?: string | null
          metadata?: Json
          product_type?: string | null
          store_id: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          external_product_id?: string
          id?: string
          image_url?: string | null
          metadata?: Json
          product_type?: string | null
          store_id?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_active_at: string | null
          locale: string
          metadata: Json
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_active_at?: string | null
          locale?: string
          metadata?: Json
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          locale?: string
          metadata?: Json
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      // TEMPORARY FALLBACK — raw_events columns from 20260711140000_background_jobs_pipeline.sql
      // (correlation_id, locked_at, locked_by, dead_lettered_at, max_attempts, error_code, payload_hash)
      raw_events: {
        Row: {
          agency_id: string
          attempts: number
          correlation_id: string | null
          created_at: string
          dead_lettered_at: string | null
          error_code: string | null
          event_type: string
          external_event_id: string | null
          id: string
          idempotency_key: string
          integration_id: string | null
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_retry_at: string | null
          occurred_at: string | null
          payload: Json
          payload_hash: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          received_at: string
          signature_valid: boolean | null
          status: Database["public"]["Enums"]["event_status"]
          store_id: string | null
        }
        Insert: {
          agency_id: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          error_code?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          idempotency_key: string
          integration_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          occurred_at?: string | null
          payload: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          received_at?: string
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["event_status"]
          store_id?: string | null
        }
        Update: {
          agency_id?: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          error_code?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          idempotency_key?: string
          integration_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          occurred_at?: string | null
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          received_at?: string
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["event_status"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711160000_reconciliation_csv_matching.sql
      settlement_batches: {
        Row: {
          adjustments_amount: number
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          carrier_id: string | null
          created_at: string
          currency_code: string
          external_batch_id: string | null
          fees_amount: number
          gross_amount: number
          id: string
          import_error_count: number | null
          import_row_count: number | null
          metadata: Json
          net_amount: number
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processing_finished_at: string | null
          processing_started_at: string | null
          reference: string | null
          source_file_path: string | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          adjustments_amount?: number
          agency_id: string
          approved_at?: string | null
          approved_by?: string | null
          carrier_id?: string | null
          created_at?: string
          currency_code: string
          external_batch_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          import_error_count?: number | null
          import_row_count?: number | null
          metadata?: Json
          net_amount?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          reference?: string | null
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          adjustments_amount?: number
          agency_id?: string
          approved_at?: string | null
          approved_by?: string | null
          carrier_id?: string | null
          created_at?: string
          currency_code?: string
          external_batch_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          import_error_count?: number | null
          import_row_count?: number | null
          metadata?: Json
          net_amount?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          reference?: string | null
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_batches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batches_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711160000_reconciliation_csv_matching.sql
      settlement_items: {
        Row: {
          agency_id: string
          batch_id: string
          collected_applied_at: string | null
          created_at: string
          currency_code: string | null
          difference_amount: number | null
          discrepancy_reason: string | null
          expected_amount: number | null
          external_order_id: string | null
          external_shipment_id: string | null
          fee_amount: number
          id: string
          match_confidence: number | null
          match_method: Database["public"]["Enums"]["settlement_match_method"] | null
          match_status: Database["public"]["Enums"]["settlement_match_status"]
          matched_at: string | null
          matched_by: string | null
          metadata: Json
          notes: string | null
          order_id: string | null
          order_number: string | null
          raw_row: Json
          resolution_status: Database["public"]["Enums"]["settlement_match_status"] | null
          resolved_at: string | null
          resolved_by: string | null
          row_occurred_at: string | null
          settled_amount: number
          settled_applied_at: string | null
          shipment_id: string | null
          source_row_number: number | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          batch_id: string
          collected_applied_at?: string | null
          created_at?: string
          currency_code?: string | null
          difference_amount?: number | null
          discrepancy_reason?: string | null
          expected_amount?: number | null
          external_order_id?: string | null
          external_shipment_id?: string | null
          fee_amount?: number
          id?: string
          match_confidence?: number | null
          match_method?: Database["public"]["Enums"]["settlement_match_method"] | null
          match_status?: Database["public"]["Enums"]["settlement_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          raw_row?: Json
          resolution_status?: Database["public"]["Enums"]["settlement_match_status"] | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_occurred_at?: string | null
          settled_amount: number
          settled_applied_at?: string | null
          shipment_id?: string | null
          source_row_number?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          batch_id?: string
          collected_applied_at?: string | null
          created_at?: string
          currency_code?: string | null
          difference_amount?: number | null
          discrepancy_reason?: string | null
          expected_amount?: number | null
          external_order_id?: string | null
          external_shipment_id?: string | null
          fee_amount?: number
          id?: string
          match_confidence?: number | null
          match_method?: Database["public"]["Enums"]["settlement_match_method"] | null
          match_status?: Database["public"]["Enums"]["settlement_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          raw_row?: Json
          resolution_status?: Database["public"]["Enums"]["settlement_match_status"] | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_occurred_at?: string | null
          settled_amount?: number
          settled_applied_at?: string | null
          shipment_id?: string | null
          source_row_number?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "settlement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          agency_id: string
          carrier_id: string
          created_at: string
          external_event_id: string | null
          external_status_code: string | null
          external_status_label: string | null
          id: string
          location_text: string | null
          normalized_status: Database["public"]["Enums"]["shipment_status"]
          occurred_at: string
          payload: Json
          raw_event_id: string | null
          received_at: string
          shipment_id: string
          store_id: string
        }
        Insert: {
          agency_id: string
          carrier_id: string
          created_at?: string
          external_event_id?: string | null
          external_status_code?: string | null
          external_status_label?: string | null
          id?: string
          location_text?: string | null
          normalized_status: Database["public"]["Enums"]["shipment_status"]
          occurred_at: string
          payload?: Json
          raw_event_id?: string | null
          received_at?: string
          shipment_id: string
          store_id: string
        }
        Update: {
          agency_id?: string
          carrier_id?: string
          created_at?: string
          external_event_id?: string | null
          external_status_code?: string | null
          external_status_label?: string | null
          id?: string
          location_text?: string | null
          normalized_status?: Database["public"]["Enums"]["shipment_status"]
          occurred_at?: string
          payload?: Json
          raw_event_id?: string | null
          received_at?: string
          shipment_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          agency_id: string
          carrier_connection_id: string | null
          carrier_id: string
          cod_collected_amount: number | null
          cod_expected_amount: number | null
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          destination_city: string | null
          destination_country_code: string | null
          destination_district: string | null
          destination_region: string | null
          external_shipment_id: string | null
          first_attempt_at: string | null
          id: string
          is_rto: boolean
          is_terminal: boolean
          last_event_at: string | null
          metadata: Json
          order_id: string
          pickup_at: string | null
          return_cost_amount: number | null
          returned_at: string | null
          shipping_cost_amount: number | null
          status: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          carrier_connection_id?: string | null
          carrier_id: string
          cod_collected_amount?: number | null
          cod_expected_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          destination_city?: string | null
          destination_country_code?: string | null
          destination_district?: string | null
          destination_region?: string | null
          external_shipment_id?: string | null
          first_attempt_at?: string | null
          id?: string
          is_rto?: boolean
          is_terminal?: boolean
          last_event_at?: string | null
          metadata?: Json
          order_id: string
          pickup_at?: string | null
          return_cost_amount?: number | null
          returned_at?: string | null
          shipping_cost_amount?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          carrier_connection_id?: string | null
          carrier_id?: string
          cod_collected_amount?: number | null
          cod_expected_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          destination_city?: string | null
          destination_country_code?: string | null
          destination_district?: string | null
          destination_region?: string | null
          external_shipment_id?: string | null
          first_attempt_at?: string | null
          id?: string
          is_rto?: boolean
          is_terminal?: boolean
          last_event_at?: string | null
          metadata?: Json
          order_id?: string
          pickup_at?: string | null
          return_cost_amount?: number | null
          returned_at?: string | null
          shipping_cost_amount?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_carrier_connection_id_fkey"
            columns: ["carrier_connection_id"]
            isOneToOne: false
            referencedRelation: "carrier_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["store_role"]
          status: Database["public"]["Enums"]["member_status"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          status?: Database["public"]["Enums"]["member_status"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          status?: Database["public"]["Enums"]["member_status"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          agency_id: string
          attribution_window_days: number
          country_code: string
          created_at: string
          created_by: string | null
          currency_code: string
          default_attribution_model: Database["public"]["Enums"]["attribution_model"]
          id: string
          is_active: boolean
          name: string
          settings: Json
          shopify_shop_domain: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          attribution_window_days?: number
          country_code: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          default_attribution_model?: Database["public"]["Enums"]["attribution_model"]
          id?: string
          is_active?: boolean
          name: string
          settings?: Json
          shopify_shop_domain?: string | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attribution_window_days?: number
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          default_attribution_model?: Database["public"]["Enums"]["attribution_model"]
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json
          shopify_shop_domain?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          agency_id: string
          billing_provider: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711190000_whatsapp_templates.sql
      whatsapp_templates: {
        Row: {
          agency_id: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          language: string
          metadata: Json
          name: string
          status: string
          store_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          agency_id: string
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          metadata?: Json
          name: string
          status?: string
          store_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          metadata?: Json
          name?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          agency_id: string
          closed_at: string | null
          confirmation_status: Database["public"]["Enums"]["confirmation_status"]
          created_at: string
          customer_id: string | null
          id: string
          integration_id: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json
          order_id: string | null
          phone: string
          started_at: string
          store_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          closed_at?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          customer_id?: string | null
          id?: string
          integration_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          order_id?: string | null
          phone: string
          started_at?: string
          store_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          closed_at?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          customer_id?: string | null
          id?: string
          integration_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          order_id?: string | null
          phone?: string
          started_at?: string
          store_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          agency_id: string
          body: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          message_type: string
          order_id: string | null
          payload: Json
          read_at: string | null
          received_at: string | null
          sent_at: string | null
          status: string
          store_id: string
          template_id: string | null
        }
        Insert: {
          agency_id: string
          body?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_type?: string
          order_id?: string | null
          payload?: Json
          read_at?: string | null
          received_at?: string | null
          sent_at?: string | null
          status: string
          store_id: string
          template_id?: string | null
        }
        Update: {
          agency_id?: string
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_type?: string
          order_id?: string | null
          payload?: Json
          read_at?: string | null
          received_at?: string | null
          sent_at?: string | null
          status?: string
          store_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      white_label_settings: {
        Row: {
          agency_id: string
          favicon_url: string | null
          hide_codtracked_branding: boolean
          login_background_url: string | null
          logo_url: string | null
          metadata: Json
          primary_color: string | null
          product_name: string | null
          secondary_color: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          favicon_url?: string | null
          hide_codtracked_branding?: boolean
          login_background_url?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string | null
          product_name?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          favicon_url?: string | null
          hide_codtracked_branding?: boolean
          login_background_url?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string | null
          product_name?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "white_label_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711200000_sprint9_settings_billing_privacy.sql
      invoice_records: {
        Row: {
          id: string
          agency_id: string
          subscription_id: string | null
          invoice_number: string
          status: string
          currency_code: string
          amount_cents: number
          period_start: string | null
          period_end: string | null
          issued_at: string
          paid_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          subscription_id?: string | null
          invoice_number: string
          status?: string
          currency_code?: string
          amount_cents?: number
          period_start?: string | null
          period_end?: string | null
          issued_at?: string
          paid_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          subscription_id?: string | null
          invoice_number?: string
          status?: string
          currency_code?: string
          amount_cents?: number
          period_start?: string | null
          period_end?: string | null
          issued_at?: string
          paid_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          id: string
          agency_id: string
          store_id: string | null
          metric: string
          period_key: string
          quantity: number
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          agency_id: string
          store_id?: string | null
          metric: string
          period_key: string
          quantity?: number
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          agency_id?: string
          store_id?: string | null
          metric?: string
          period_key?: string
          quantity?: number
          updated_at?: string
          metadata?: Json
        }
        Relationships: []
      }
      api_key_rate_limits: {
        Row: {
          id: string
          api_key_id: string
          agency_id: string
          window_start: string
          window_seconds: number
          request_count: number
          updated_at: string
        }
        Insert: {
          id?: string
          api_key_id: string
          agency_id: string
          window_start: string
          window_seconds?: number
          request_count?: number
          updated_at?: string
        }
        Update: {
          id?: string
          api_key_id?: string
          agency_id?: string
          window_start?: string
          window_seconds?: number
          request_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          id: string
          agency_id: string
          store_id: string | null
          requested_by: string | null
          scope: string
          status: string
          job_id: string | null
          artifact_summary: Json
          error_message: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          store_id?: string | null
          requested_by?: string | null
          scope?: string
          status?: string
          job_id?: string | null
          artifact_summary?: Json
          error_message?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          store_id?: string | null
          requested_by?: string | null
          scope?: string
          status?: string
          job_id?: string | null
          artifact_summary?: Json
          error_message?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          id: string
          agency_id: string
          store_id: string | null
          requested_by: string | null
          scope: string
          reason: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          store_id?: string | null
          requested_by?: string | null
          scope?: string
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          store_id?: string | null
          requested_by?: string | null
          scope?: string
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_agency_invitation: {
        Args: { p_token_hash: string }
        Returns: string
      }
      // TEMPORARY FALLBACK — regenerate via `supabase gen types` after applying 20260711140000_background_jobs_pipeline.sql
      // setof background_jobs — supabase-js surfaces the result as an array of rows.
      claim_background_jobs: {
        Args: {
          p_worker_id: string
          p_limit?: number
          p_queue?: string
        }
        Returns: Database["public"]["Tables"]["background_jobs"]["Row"][]
      }
      has_agency_access: {
        Args: { target_agency_id: string }
        Returns: boolean
      }
      has_agency_role: {
        Args: {
          target_agency_id: string
          allowed_roles: Database["public"]["Enums"]["agency_role"][]
        }
        Returns: boolean
      }
      has_store_access: { Args: { target_store_id: string }; Returns: boolean }
      has_store_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["store_role"][]
          target_store_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      // TEMPORARY FALLBACK — 20260711170000_attribution_analytics_rpcs.sql
      rpc_store_order_funnel: {
        Args: { p_store_id: string; p_from: string; p_to: string }
        Returns: {
          orders_total: number
          confirmed: number
          shipped: number
          delivered: number
          rejected: number
          returned: number
          revenue_generated: number
          delivered_value: number
          collected_value: number
          settled_value: number
        }[]
      }
      rpc_store_campaign_performance: {
        Args: { p_store_id: string; p_from: string; p_to: string }
        Returns: {
          campaign_id: string
          campaign_name: string
          platform: Database["public"]["Enums"]["ad_platform"]
          spend: number
          impressions: number
          clicks: number
          orders_attributed: number
          revenue_generated: number
          delivered_value: number
          collected_value: number
          settled_value: number
          avg_confidence: number
        }[]
      }
      rpc_store_rto_breakdown: {
        Args: {
          p_store_id: string
          p_from: string
          p_to: string
          p_dimension?: string
        }
        Returns: {
          dimension_key: string
          dimension_label: string
          shipments_total: number
          rto_count: number
          delivered_count: number
          rto_rate: number
        }[]
      }
      rpc_store_ads_daily_trend: {
        Args: { p_store_id: string; p_from: string; p_to: string }
        Returns: {
          metric_date: string
          spend: number
          attributed_revenue: number
          orders_attributed: number
        }[]
      }
    }
    Enums: {
      ad_platform: "meta" | "tiktok" | "google" | "organic" | "direct" | "other"
      agency_invitation_status: "pending" | "accepted" | "expired" | "revoked"
      agency_role: "owner" | "admin" | "manager" | "analyst" | "viewer"
      alert_severity: "info" | "warning" | "critical"
      attribution_model:
        | "utm_last_touch"
        | "last_click"
        | "first_click"
        | "linear"
        | "position_based"
        | "time_decay"
        | "manual"
        | "unattributed"
      // TEMPORARY FALLBACK — 20260711140000_background_jobs_pipeline.sql
      background_job_status:
        | "queued"
        | "processing"
        | "completed"
        | "retry_scheduled"
        | "failed"
        | "dead_letter"
        | "cancelled"
      confirmation_status:
        | "not_requested"
        | "pending"
        | "confirmed"
        | "rejected"
        | "expired"
        | "manual_review"
      delivery_status:
        | "queued"
        | "sending"
        | "sent"
        | "acknowledged"
        | "rejected"
        | "retrying"
        | "failed"
        | "cancelled"
      event_status:
        | "received"
        | "validated"
        | "processing"
        | "processed"
        | "ignored"
        | "retrying"
        | "failed"
        | "dead_letter"
      integration_provider:
        | "shopify"
        | "meta"
        | "tiktok"
        | "whatsapp"
        | "enviame"
        | "envia_com"
        | "custom_carrier"
        | "custom_erp"
        | "custom_call_center"
        | "custom_payment"
        | "other"
      integration_status:
        | "pending"
        | "connected"
        | "degraded"
        | "error"
        | "disconnected"
        | "revoked"
      // TEMPORARY FALLBACK — 20260711140000_background_jobs_pipeline.sql
      job_attempt_status: "started" | "completed" | "failed" | "cancelled"
      member_status: "invited" | "active" | "suspended" | "revoked"
      order_status:
        | "created"
        | "pending_confirmation"
        | "confirmed"
        | "cancelled"
        | "ready_to_ship"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "delivery_failed"
        | "rejected"
        | "return_in_transit"
        | "returned"
        | "lost"
        | "closed"
      payment_status:
        | "unpaid"
        | "cash_expected"
        | "cash_collected"
        | "partially_collected"
        | "settlement_pending"
        | "settled"
        | "disputed"
        | "refunded"
        | "written_off"
      platform_role:
        | "platform_owner"
        | "platform_admin"
        | "support"
        | "analyst"
        | "user"
      reconciliation_status:
        | "open"
        | "partially_matched"
        | "matched"
        | "disputed"
        | "closed"
      // TEMPORARY FALLBACK — 20260711160000_reconciliation_csv_matching.sql
      settlement_match_method:
        | "tracking"
        | "external_shipment_id"
        | "external_order_id"
        | "order_number"
        | "amount_time_suggestion"
        | "manual"
      settlement_match_status:
        | "matched"
        | "unmatched"
        | "difference"
        | "duplicate"
        | "disputed"
        | "resolved"
      shipment_status:
        | "created"
        | "label_generated"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "delivery_failed"
        | "rejected"
        | "return_in_transit"
        | "returned"
        | "lost"
        | "cancelled"
        | "unknown"
      store_role: "owner" | "admin" | "operator" | "analyst" | "viewer"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "cancelled"
        | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ad_platform: ["meta", "tiktok", "google", "organic", "direct", "other"],
      agency_invitation_status: ["pending", "accepted", "expired", "revoked"],
      agency_role: ["owner", "admin", "manager", "analyst", "viewer"],
      alert_severity: ["info", "warning", "critical"],
      attribution_model: [
        "utm_last_touch",
        "last_click",
        "first_click",
        "linear",
        "position_based",
        "time_decay",
        "manual",
        "unattributed",
      ],
      // TEMPORARY FALLBACK — 20260711140000_background_jobs_pipeline.sql
      background_job_status: [
        "queued",
        "processing",
        "completed",
        "retry_scheduled",
        "failed",
        "dead_letter",
        "cancelled",
      ],
      confirmation_status: [
        "not_requested",
        "pending",
        "confirmed",
        "rejected",
        "expired",
        "manual_review",
      ],
      delivery_status: [
        "queued",
        "sending",
        "sent",
        "acknowledged",
        "rejected",
        "retrying",
        "failed",
        "cancelled",
      ],
      event_status: [
        "received",
        "validated",
        "processing",
        "processed",
        "ignored",
        "retrying",
        "failed",
        "dead_letter",
      ],
      integration_provider: [
        "shopify",
        "meta",
        "tiktok",
        "whatsapp",
        "enviame",
        "envia_com",
        "custom_carrier",
        "custom_erp",
        "custom_call_center",
        "custom_payment",
        "other",
      ],
      integration_status: [
        "pending",
        "connected",
        "degraded",
        "error",
        "disconnected",
        "revoked",
      ],
      // TEMPORARY FALLBACK — 20260711140000_background_jobs_pipeline.sql
      job_attempt_status: ["started", "completed", "failed", "cancelled"],
      member_status: ["invited", "active", "suspended", "revoked"],
      order_status: [
        "created",
        "pending_confirmation",
        "confirmed",
        "cancelled",
        "ready_to_ship",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "rejected",
        "return_in_transit",
        "returned",
        "lost",
        "closed",
      ],
      payment_status: [
        "unpaid",
        "cash_expected",
        "cash_collected",
        "partially_collected",
        "settlement_pending",
        "settled",
        "disputed",
        "refunded",
        "written_off",
      ],
      platform_role: [
        "platform_owner",
        "platform_admin",
        "support",
        "analyst",
        "user",
      ],
      reconciliation_status: [
        "open",
        "partially_matched",
        "matched",
        "disputed",
        "closed",
      ],
      // TEMPORARY FALLBACK — 20260711160000_reconciliation_csv_matching.sql
      settlement_match_method: [
        "tracking",
        "external_shipment_id",
        "external_order_id",
        "order_number",
        "amount_time_suggestion",
        "manual",
      ],
      settlement_match_status: [
        "matched",
        "unmatched",
        "difference",
        "duplicate",
        "disputed",
        "resolved",
      ],
      shipment_status: [
        "created",
        "label_generated",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "rejected",
        "return_in_transit",
        "returned",
        "lost",
        "cancelled",
        "unknown",
      ],
      store_role: ["owner", "admin", "operator", "analyst", "viewer"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "paused",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
