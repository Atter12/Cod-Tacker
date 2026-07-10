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
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agency_id: string
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
          store_id: string | null
          title: string
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id: string
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
          store_id?: string | null
          title: string
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id?: string
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
          store_id?: string | null
          title?: string
          type?: string
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
      automation_rules: {
        Row: {
          actions: Json
          agency_id: string
          conditions: Json
          cooldown_minutes: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
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
          id?: string
          is_active?: boolean
          name: string
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
          id?: string
          is_active?: boolean
          name?: string
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
      automation_runs: {
        Row: {
          action_results: Json
          agency_id: string
          attempts: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          order_id: string | null
          rule_id: string
          shipment_id: string | null
          started_at: string | null
          status: string
          store_id: string | null
          trigger_payload: Json
        }
        Insert: {
          action_results?: Json
          agency_id: string
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          order_id?: string | null
          rule_id: string
          shipment_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          trigger_payload?: Json
        }
        Update: {
          action_results?: Json
          agency_id?: string
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          order_id?: string | null
          rule_id?: string
          shipment_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          trigger_payload?: Json
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
          id: string
          integration_id: string
          last_error_message: string | null
          max_attempts: number
          next_retry_at: string | null
          order_id: string
          platform: Database["public"]["Enums"]["ad_platform"]
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
          id?: string
          integration_id: string
          last_error_message?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id: string
          platform: Database["public"]["Enums"]["ad_platform"]
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
          id?: string
          integration_id?: string
          last_error_message?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
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
      raw_events: {
        Row: {
          agency_id: string
          attempts: number
          created_at: string
          event_type: string
          external_event_id: string | null
          id: string
          idempotency_key: string
          integration_id: string | null
          last_error: string | null
          next_retry_at: string | null
          occurred_at: string | null
          payload: Json
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
          created_at?: string
          event_type: string
          external_event_id?: string | null
          id?: string
          idempotency_key: string
          integration_id?: string | null
          last_error?: string | null
          next_retry_at?: string | null
          occurred_at?: string | null
          payload: Json
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
          created_at?: string
          event_type?: string
          external_event_id?: string | null
          id?: string
          idempotency_key?: string
          integration_id?: string | null
          last_error?: string | null
          next_retry_at?: string | null
          occurred_at?: string | null
          payload?: Json
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
      settlement_batches: {
        Row: {
          adjustments_amount: number
          agency_id: string
          carrier_id: string | null
          created_at: string
          currency_code: string
          external_batch_id: string | null
          fees_amount: number
          gross_amount: number
          id: string
          metadata: Json
          net_amount: number
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          reference: string | null
          source_file_path: string | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          adjustments_amount?: number
          agency_id: string
          carrier_id?: string | null
          created_at?: string
          currency_code: string
          external_batch_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          adjustments_amount?: number
          agency_id?: string
          carrier_id?: string | null
          created_at?: string
          currency_code?: string
          external_batch_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
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
      settlement_items: {
        Row: {
          agency_id: string
          batch_id: string
          created_at: string
          difference_amount: number | null
          expected_amount: number | null
          fee_amount: number
          id: string
          matched_at: string | null
          matched_by: string | null
          metadata: Json
          notes: string | null
          order_id: string | null
          settled_amount: number
          shipment_id: string | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          batch_id: string
          created_at?: string
          difference_amount?: number | null
          expected_amount?: number | null
          fee_amount?: number
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string | null
          settled_amount: number
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          store_id: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          batch_id?: string
          created_at?: string
          difference_amount?: number | null
          expected_amount?: number | null
          fee_amount?: number
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string | null
          settled_amount?: number
          shipment_id?: string | null
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
          metadata: Json
          order_id: string | null
          phone: string
          started_at: string
          store_id: string
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
          metadata?: Json
          order_id?: string | null
          phone: string
          started_at?: string
          store_id: string
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
          metadata?: Json
          order_id?: string | null
          phone?: string
          started_at?: string
          store_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_agency_access: {
        Args: { target_agency_id: string }
        Returns: boolean
      }
      has_agency_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["agency_role"][]
          target_agency_id: string
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
    }
    Enums: {
      ad_platform: "meta" | "tiktok" | "google" | "organic" | "direct" | "other"
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
