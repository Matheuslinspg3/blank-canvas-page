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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          auth_payload: Json | null
          created_at: string
          external_account_id: string | null
          id: string
          is_active: boolean
          name: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["ad_provider"]
          status: string
          updated_at: string
        }
        Insert: {
          auth_payload?: Json | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string
          updated_at?: string
        }
        Update: {
          auth_payload?: Json | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_entities: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id: string
          name: string
          organization_id: string
          parent_external_id: string | null
          provider: Database["public"]["Enums"]["ad_provider"]
          status: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id?: string
          name: string
          organization_id: string
          parent_external_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id?: string
          id?: string
          name?: string
          organization_id?: string
          parent_external_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_insights_daily: {
        Row: {
          clicks: number
          cpc: number | null
          cpl: number | null
          created_at: string
          ctr: number | null
          date: string
          entity_type: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id: string
          impressions: number
          leads: number
          organization_id: string
          provider: Database["public"]["Enums"]["ad_provider"]
          spend: number
          updated_at: string
        }
        Insert: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id?: string
          impressions?: number
          leads?: number
          organization_id: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          spend?: number
          updated_at?: string
        }
        Update: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id?: string
          id?: string
          impressions?: number
          leads?: number
          organization_id?: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_insights_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_leads: {
        Row: {
          created_at: string
          created_time: string
          crm_record_id: string | null
          email: string | null
          external_ad_id: string
          external_form_id: string | null
          external_lead_id: string
          id: string
          name: string | null
          organization_id: string
          phone: string | null
          provider: Database["public"]["Enums"]["ad_provider"]
          raw_payload: Json | null
          status: Database["public"]["Enums"]["ad_lead_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_time?: string
          crm_record_id?: string | null
          email?: string | null
          external_ad_id: string
          external_form_id?: string | null
          external_lead_id: string
          id?: string
          name?: string | null
          organization_id: string
          phone?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["ad_lead_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_time?: string
          crm_record_id?: string | null
          email?: string | null
          external_ad_id?: string
          external_form_id?: string | null
          external_lead_id?: string
          id?: string
          name?: string | null
          organization_id?: string
          phone?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["ad_lead_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_settings: {
        Row: {
          auto_send_to_crm: boolean
          created_at: string
          crm_stage_id: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auto_send_to_crm?: boolean
          created_at?: string
          crm_stage_id?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auto_send_to_crm?: boolean
          created_at?: string
          crm_stage_id?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_settings_crm_stage_id_fkey"
            columns: ["crm_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      admin_allowlist: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      ai_billing_config: {
        Row: {
          billing_enabled: boolean
          default_currency: string
          default_markup_percentage: number
          id: string
          sandbox_mode: boolean
          stripe_test_mode: boolean
          stripe_webhook_secret: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_enabled?: boolean
          default_currency?: string
          default_markup_percentage?: number
          id?: string
          sandbox_mode?: boolean
          stripe_test_mode?: boolean
          stripe_webhook_secret?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_enabled?: boolean
          default_currency?: string
          default_markup_percentage?: number
          id?: string
          sandbox_mode?: boolean
          stripe_test_mode?: boolean
          stripe_webhook_secret?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_billing_invoices: {
        Row: {
          created_at: string
          currency: string
          id: string
          organization_id: string | null
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id: string | null
          total_billed_amount: number
          total_provider_cost: number
          total_requests: number
          total_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string | null
          period_end: string
          period_start: string
          status?: string
          stripe_invoice_id?: string | null
          total_billed_amount?: number
          total_provider_cost?: number
          total_requests?: number
          total_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_invoice_id?: string | null
          total_billed_amount?: number
          total_provider_cost?: number
          total_requests?: number
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_billing_pricing: {
        Row: {
          currency: string
          fixed_margin: number | null
          id: string
          is_active: boolean
          markup_percentage: number
          model: string
          price_per_1k_input_tokens: number
          price_per_1k_output_tokens: number
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          currency?: string
          fixed_margin?: number | null
          id?: string
          is_active?: boolean
          markup_percentage?: number
          model: string
          price_per_1k_input_tokens?: number
          price_per_1k_output_tokens?: number
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          currency?: string
          fixed_margin?: number | null
          id?: string
          is_active?: boolean
          markup_percentage?: number
          model?: string
          price_per_1k_input_tokens?: number
          price_per_1k_output_tokens?: number
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_credit_transactions: {
        Row: {
          amount_usd: number
          balance_after: number
          billed_cost_usd: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          model: string | null
          organization_id: string
          provider: string | null
          raw_cost_usd: number | null
          tokens_input: number | null
          tokens_output: number | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount_usd: number
          balance_after: number
          billed_cost_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id: string
          provider?: string | null
          raw_cost_usd?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          type: string
          wallet_id: string
        }
        Update: {
          amount_usd?: number
          balance_after?: number
          billed_cost_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id?: string
          provider?: string | null
          raw_cost_usd?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_wallets: {
        Row: {
          balance_usd: number
          created_at: string
          id: string
          last_plan_credit_at: string | null
          markup_multiplier: number
          organization_id: string
          plan_monthly_allowance_usd: number
          total_consumed_usd: number
          total_recharged_usd: number
          updated_at: string
        }
        Insert: {
          balance_usd?: number
          created_at?: string
          id?: string
          last_plan_credit_at?: string | null
          markup_multiplier?: number
          organization_id: string
          plan_monthly_allowance_usd?: number
          total_consumed_usd?: number
          total_recharged_usd?: number
          updated_at?: string
        }
        Update: {
          balance_usd?: number
          created_at?: string
          id?: string
          last_plan_credit_at?: string | null
          markup_multiplier?: number
          organization_id?: string
          plan_monthly_allowance_usd?: number
          total_consumed_usd?: number
          total_recharged_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_org_budgets: {
        Row: {
          action_on_limit: string
          alert_threshold_pct: number
          created_at: string
          current_month: string
          current_month_spend_usd: number
          id: string
          is_active: boolean
          last_alert_sent_at: string | null
          monthly_budget_usd: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          action_on_limit?: string
          alert_threshold_pct?: number
          created_at?: string
          current_month?: string
          current_month_spend_usd?: number
          id?: string
          is_active?: boolean
          last_alert_sent_at?: string | null
          monthly_budget_usd?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          action_on_limit?: string
          alert_threshold_pct?: number
          created_at?: string
          current_month?: string
          current_month_spend_usd?: number
          id?: string
          is_active?: boolean
          last_alert_sent_at?: string | null
          monthly_budget_usd?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_org_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_org_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_provider_config: {
        Row: {
          id: string
          image_flux_key: string | null
          image_leonardo_key: string | null
          image_openai_key: string | null
          image_provider: string
          image_stability_key: string | null
          lovable_fallback_enabled: boolean
          text_anthropic_key: string | null
          text_gemini_key: string | null
          text_groq_key: string | null
          text_openai_key: string | null
          text_openai_model: string | null
          text_provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          image_flux_key?: string | null
          image_leonardo_key?: string | null
          image_openai_key?: string | null
          image_provider?: string
          image_stability_key?: string | null
          lovable_fallback_enabled?: boolean
          text_anthropic_key?: string | null
          text_gemini_key?: string | null
          text_groq_key?: string | null
          text_openai_key?: string | null
          text_openai_model?: string | null
          text_provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          image_flux_key?: string | null
          image_leonardo_key?: string | null
          image_openai_key?: string | null
          image_provider?: string
          image_stability_key?: string | null
          lovable_fallback_enabled?: boolean
          text_anthropic_key?: string | null
          text_gemini_key?: string | null
          text_groq_key?: string | null
          text_openai_key?: string | null
          text_openai_model?: string | null
          text_provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_qualification_config: {
        Row: {
          auto_create_leads: boolean
          auto_qualify_leads: boolean
          auto_scoring: boolean
          broker_assignment_mode: string
          created_at: string
          default_lead_stage_id: string | null
          id: string
          organization_id: string
          prompt_create_leads: string | null
          prompt_qualify_leads: string | null
          prompt_schedule_visits: string | null
          required_fields: string[]
          schedule_visits: boolean
          scheduling_days: string[]
          scheduling_hour_end: string
          scheduling_hour_start: string
          score_criteria: Json
          temperature_thresholds: Json
          updated_at: string
        }
        Insert: {
          auto_create_leads?: boolean
          auto_qualify_leads?: boolean
          auto_scoring?: boolean
          broker_assignment_mode?: string
          created_at?: string
          default_lead_stage_id?: string | null
          id?: string
          organization_id: string
          prompt_create_leads?: string | null
          prompt_qualify_leads?: string | null
          prompt_schedule_visits?: string | null
          required_fields?: string[]
          schedule_visits?: boolean
          scheduling_days?: string[]
          scheduling_hour_end?: string
          scheduling_hour_start?: string
          score_criteria?: Json
          temperature_thresholds?: Json
          updated_at?: string
        }
        Update: {
          auto_create_leads?: boolean
          auto_qualify_leads?: boolean
          auto_scoring?: boolean
          broker_assignment_mode?: string
          created_at?: string
          default_lead_stage_id?: string | null
          id?: string
          organization_id?: string
          prompt_create_leads?: string | null
          prompt_qualify_leads?: string | null
          prompt_schedule_visits?: string | null
          required_fields?: string[]
          schedule_visits?: boolean
          scheduling_days?: string[]
          scheduling_hour_end?: string
          scheduling_hour_start?: string
          score_criteria?: Json
          temperature_thresholds?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_qualification_config_default_lead_stage_id_fkey"
            columns: ["default_lead_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_qualification_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_qualification_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_router_config: {
        Row: {
          complexity: string
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          max_tokens: number | null
          provider_chain: Json
          requires_image: boolean | null
          routing_mode: string | null
          system_prompt: string | null
          task_type: string
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          complexity?: string
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          provider_chain: Json
          requires_image?: boolean | null
          routing_mode?: string | null
          system_prompt?: string | null
          task_type: string
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          complexity?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          provider_chain?: Json
          requires_image?: boolean | null
          routing_mode?: string | null
          system_prompt?: string | null
          task_type?: string
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_router_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          is_free: boolean | null
          latency_ms: number | null
          model_used: string | null
          organization_id: string | null
          prompt_preview: string | null
          provider_used: string | null
          providers_attempted: string[] | null
          success: boolean | null
          task_type: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          is_free?: boolean | null
          latency_ms?: number | null
          model_used?: string | null
          organization_id?: string | null
          prompt_preview?: string | null
          provider_used?: string | null
          providers_attempted?: string[] | null
          success?: boolean | null
          task_type: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          is_free?: boolean | null
          latency_ms?: number | null
          model_used?: string | null
          organization_id?: string | null
          prompt_preview?: string | null
          provider_used?: string | null
          providers_attempted?: string[] | null
          success?: boolean | null
          task_type?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_router_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_router_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_router_provider_stats: {
        Row: {
          avg_latency_ms: number | null
          estimated_cost_usd: number | null
          failed_requests: number | null
          id: string
          max_latency_ms: number | null
          min_latency_ms: number | null
          period_date: string
          provider_key: string
          quality_score: number | null
          quality_votes: number | null
          rate_limit_hits: number | null
          requests_today: number | null
          successful_requests: number | null
          task_type: string | null
          total_latency_ms: number | null
          total_requests: number | null
          total_tokens_in: number | null
          total_tokens_out: number | null
          updated_at: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          estimated_cost_usd?: number | null
          failed_requests?: number | null
          id?: string
          max_latency_ms?: number | null
          min_latency_ms?: number | null
          period_date?: string
          provider_key: string
          quality_score?: number | null
          quality_votes?: number | null
          rate_limit_hits?: number | null
          requests_today?: number | null
          successful_requests?: number | null
          task_type?: string | null
          total_latency_ms?: number | null
          total_requests?: number | null
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          estimated_cost_usd?: number | null
          failed_requests?: number | null
          id?: string
          max_latency_ms?: number | null
          min_latency_ms?: number | null
          period_date?: string
          provider_key?: string
          quality_score?: number | null
          quality_votes?: number | null
          rate_limit_hits?: number | null
          requests_today?: number | null
          successful_requests?: number | null
          task_type?: string | null
          total_latency_ms?: number | null
          total_requests?: number | null
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_router_providers: {
        Row: {
          api_base_url: string
          api_key: string | null
          consecutive_errors: number | null
          created_at: string | null
          display_name: string
          env_secret_name: string
          id: string
          is_active: boolean | null
          is_free: boolean | null
          last_error_at: string | null
          model_id: string
          notes: string | null
          priority: number | null
          provider_key: string
          provider_type: string
          rate_limit_rpd: number | null
          rate_limit_rpm: number | null
          supports_image_input: boolean | null
          supports_image_output: boolean | null
        }
        Insert: {
          api_base_url: string
          api_key?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          display_name: string
          env_secret_name: string
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          last_error_at?: string | null
          model_id: string
          notes?: string | null
          priority?: number | null
          provider_key: string
          provider_type: string
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          supports_image_input?: boolean | null
          supports_image_output?: boolean | null
        }
        Update: {
          api_base_url?: string
          api_key?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          display_name?: string
          env_secret_name?: string
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          last_error_at?: string | null
          model_id?: string
          notes?: string | null
          priority?: number | null
          provider_key?: string
          provider_type?: string
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          supports_image_input?: boolean | null
          supports_image_output?: boolean | null
        }
        Relationships: []
      }
      ai_token_usage_events: {
        Row: {
          created_at: string
          currency: string
          error_message: string | null
          estimated_provider_cost: number
          function_name: string | null
          id: string
          input_tokens: number
          markup_percentage: number
          metadata: Json | null
          model: string
          organization_id: string | null
          output_tokens: number
          provider: string
          request_id: string
          request_status: string
          simulated_bill_amount: number | null
          stripe_meter_event_id: string | null
          stripe_sync_status: string | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          error_message?: string | null
          estimated_provider_cost?: number
          function_name?: string | null
          id?: string
          input_tokens?: number
          markup_percentage?: number
          metadata?: Json | null
          model: string
          organization_id?: string | null
          output_tokens?: number
          provider: string
          request_id?: string
          request_status?: string
          simulated_bill_amount?: number | null
          stripe_meter_event_id?: string | null
          stripe_sync_status?: string | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          error_message?: string | null
          estimated_provider_cost?: number
          function_name?: string | null
          id?: string
          input_tokens?: number
          markup_percentage?: number
          metadata?: Json | null
          model?: string
          organization_id?: string | null
          output_tokens?: number
          provider?: string
          request_id?: string
          request_status?: string
          simulated_bill_amount?: number | null
          stripe_meter_event_id?: string | null
          stripe_sync_status?: string | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_token_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          estimated_cost_usd: number | null
          function_name: string
          id: string
          model: string | null
          organization_id: string | null
          provider: string
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
          usage_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          model?: string | null
          organization_id?: string | null
          provider: string
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          usage_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          model?: string | null
          organization_id?: string | null
          provider?: string
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          usage_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      anuncios_gerados: {
        Row: {
          corretor_id: string
          created_at: string | null
          dados_formulario: Json
          id: string
          imagem_url: string | null
          organization_id: string
          property_id: string | null
          texto_instagram: string | null
          texto_portal: string | null
          texto_whatsapp: string | null
          tone: string | null
        }
        Insert: {
          corretor_id: string
          created_at?: string | null
          dados_formulario?: Json
          id?: string
          imagem_url?: string | null
          organization_id: string
          property_id?: string | null
          texto_instagram?: string | null
          texto_portal?: string | null
          texto_whatsapp?: string | null
          tone?: string | null
        }
        Update: {
          corretor_id?: string
          created_at?: string | null
          dados_formulario?: Json
          id?: string
          imagem_url?: string | null
          organization_id?: string
          property_id?: string | null
          texto_instagram?: string | null
          texto_portal?: string | null
          texto_whatsapp?: string | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_gerados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_gerados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "anuncios_gerados_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_gerados_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_gerados_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      app_runtime_config: {
        Row: {
          force_logout_at: string | null
          id: string
          maintenance_message: string
          maintenance_mode: boolean
          maintenance_started_at: string | null
          maintenance_started_by: string | null
          updated_at: string
        }
        Insert: {
          force_logout_at?: string | null
          id?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          maintenance_started_at?: string | null
          maintenance_started_by?: string | null
          updated_at?: string
        }
        Update: {
          force_logout_at?: string | null
          id?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          maintenance_started_at?: string | null
          maintenance_started_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string
          id: string
          interaction_id: string | null
          lead_id: string | null
          location: string | null
          organization_id: string
          property_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time: string
          id?: string
          interaction_id?: string | null
          lead_id?: string | null
          location?: string | null
          organization_id: string
          property_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string
          id?: string
          interaction_id?: string | null
          lead_id?: string | null
          location?: string | null
          organization_id?: string
          property_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "lead_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          acting_role: string | null
          action: string
          action_category: string
          changed_fields: string[] | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          parent_entity_id: string | null
          parent_entity_type: string | null
          request_id: string | null
          risk_level: string | null
          route: string | null
          session_id: string | null
          source: string | null
          status: string | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acting_role?: string | null
          action: string
          action_category: string
          changed_fields?: string[] | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          parent_entity_id?: string | null
          parent_entity_type?: string | null
          request_id?: string | null
          risk_level?: string | null
          route?: string | null
          session_id?: string | null
          source?: string | null
          status?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acting_role?: string | null
          action?: string
          action_category?: string
          changed_fields?: string[] | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          parent_entity_id?: string | null
          parent_entity_type?: string | null
          request_id?: string | null
          risk_level?: string | null
          route?: string | null
          session_id?: string | null
          source?: string | null
          status?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_ids: string[]
          entity_type: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_ids: string[]
          entity_type: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_ids?: string[]
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      automation_credit_transactions: {
        Row: {
          amount_brl: number
          balance_after: number
          billed_cost_brl: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          model: string | null
          organization_id: string
          provider: string | null
          raw_cost_usd: number | null
          tokens_input: number | null
          tokens_output: number | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount_brl: number
          balance_after: number
          billed_cost_brl?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id: string
          provider?: string | null
          raw_cost_usd?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          type: string
          wallet_id: string
        }
        Update: {
          amount_brl?: number
          balance_after?: number
          billed_cost_brl?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id?: string
          provider?: string | null
          raw_cost_usd?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "automation_credit_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "automation_credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_credit_wallets: {
        Row: {
          avg_cost_per_message_brl: number | null
          balance_brl: number
          created_at: string
          id: string
          last_plan_credit_at: string | null
          markup_multiplier: number
          organization_id: string
          plan_monthly_allowance_brl: number
          total_consumed_brl: number
          total_messages_processed: number | null
          total_recharged_brl: number
          updated_at: string
        }
        Insert: {
          avg_cost_per_message_brl?: number | null
          balance_brl?: number
          created_at?: string
          id?: string
          last_plan_credit_at?: string | null
          markup_multiplier?: number
          organization_id: string
          plan_monthly_allowance_brl?: number
          total_consumed_brl?: number
          total_messages_processed?: number | null
          total_recharged_brl?: number
          updated_at?: string
        }
        Update: {
          avg_cost_per_message_brl?: number | null
          balance_brl?: number
          created_at?: string
          id?: string
          last_plan_credit_at?: string | null
          markup_multiplier?: number
          organization_id?: string
          plan_monthly_allowance_brl?: number
          total_consumed_brl?: number
          total_messages_processed?: number | null
          total_recharged_brl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_credit_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_credit_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          action_type: string
          automation_id: string | null
          automation_name: string
          error_message: string | null
          executed_at: string
          id: string
          lead_name: string | null
          metadata: Json | null
          organization_id: string
          status: string
          trigger_type: string
        }
        Insert: {
          action_type: string
          automation_id?: string | null
          automation_name: string
          error_message?: string | null
          executed_at?: string
          id?: string
          lead_name?: string | null
          metadata?: Json | null
          organization_id: string
          status?: string
          trigger_type: string
        }
        Update: {
          action_type?: string
          automation_id?: string | null
          automation_name?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          lead_name?: string | null
          metadata?: Json | null
          organization_id?: string
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          created_at: string
          created_by: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          organization_id: string
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          created_by: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          organization_id: string
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          organization_id?: string
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          invoice_url: string | null
          method: string | null
          organization_id: string
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_payment_id: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          organization_id: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          organization_id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_status: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string | null
          processed: boolean
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_status?: string | null
          event_type: string
          id?: string
          payload: Json
          payload_hash?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_status?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          accent_color: string
          font_family: string | null
          id: string
          logo_dark_url: string | null
          logo_url: string | null
          organization_id: string
          primary_color: string
          secondary_color: string
          slogan: string | null
          tagline: string | null
          updated_at: string
          updated_by: string | null
          white_label_enabled: boolean
        }
        Insert: {
          accent_color?: string
          font_family?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          secondary_color?: string
          slogan?: string | null
          tagline?: string | null
          updated_at?: string
          updated_by?: string | null
          white_label_enabled?: boolean
        }
        Update: {
          accent_color?: string
          font_family?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          secondary_color?: string
          slogan?: string | null
          tagline?: string | null
          updated_at?: string
          updated_by?: string | null
          white_label_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      buildings: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          amenities: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          developer_name: string | null
          id: string
          images: string[] | null
          is_public: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          status: string
          total_floors: number | null
          total_units: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          amenities?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          developer_name?: string | null
          id?: string
          images?: string[] | null
          is_public?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          status?: string
          total_floors?: number | null
          total_units?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          amenities?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          developer_name?: string | null
          id?: string
          images?: string[] | null
          is_public?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          status?: string
          total_floors?: number | null
          total_units?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      channel_account_credentials: {
        Row: {
          access_token: string
          channel_account_id: string
          created_at: string
          expires_at: string | null
          external_business_id: string | null
          external_ig_user_id: string | null
          external_page_id: string | null
          last_refreshed_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          scopes: string[]
          token_type: string | null
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token: string
          channel_account_id: string
          created_at?: string
          expires_at?: string | null
          external_business_id?: string | null
          external_ig_user_id?: string | null
          external_page_id?: string | null
          last_refreshed_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          scopes?: string[]
          token_type?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string
          channel_account_id?: string
          created_at?: string
          expires_at?: string | null
          external_business_id?: string | null
          external_ig_user_id?: string | null
          external_page_id?: string | null
          last_refreshed_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          scopes?: string[]
          token_type?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_account_credentials_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: true
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_account_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_account_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      channel_accounts: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          display_name: string | null
          external_id: string
          id: string
          metadata: Json
          organization_id: string
          source_id: string | null
          source_table: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          display_name?: string | null
          external_id: string
          id?: string
          metadata?: Json
          organization_id: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          display_name?: string | null
          external_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      city_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          state: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          state?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          broker_id: string
          contract_id: string
          created_at: string
          id: string
          organization_id: string
          paid: boolean | null
          paid_at: string | null
          percentage: number
        }
        Insert: {
          amount: number
          broker_id: string
          contract_id: string
          created_at?: string
          id?: string
          organization_id: string
          paid?: boolean | null
          paid_at?: string | null
          percentage: number
        }
        Update: {
          amount?: number
          broker_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          paid?: boolean | null
          paid_at?: string | null
          percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      consumer_favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          name: string
          uploaded_by: string
          url: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          name: string
          uploaded_by: string
          url: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          name?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_html: string
          contract_type: string
          created_at: string
          created_by: string
          description: string | null
          field_positions: Json | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          pdf_url: string | null
          template_type: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body_html?: string
          contract_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          field_positions?: Json | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          pdf_url?: string | null
          template_type?: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body_html?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          field_positions?: Json | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          pdf_url?: string | null
          template_type?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      contracts: {
        Row: {
          broker_id: string | null
          code: string
          commission_percentage: number | null
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          payment_day: number | null
          property_id: string | null
          readjustment_index: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
          value: number
        }
        Insert: {
          broker_id?: string | null
          code: string
          commission_percentage?: number | null
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          payment_day?: number | null
          property_id?: string | null
          readjustment_index?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          value: number
        }
        Update: {
          broker_id?: string | null
          code?: string
          commission_percentage?: number | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_day?: number | null
          property_id?: string | null
          readjustment_index?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel_account_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          customer_display_name: string | null
          external_contact_id: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          lead_id: string | null
          metadata: Json
          organization_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
        }
        Insert: {
          channel_account_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          customer_display_name?: string | null
          external_contact_id: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          metadata?: Json
          organization_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Update: {
          channel_account_id?: string
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          customer_display_name?: string | null
          external_contact_id?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          metadata?: Json
          organization_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      crm_import_logs: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          import_type: string
          organization_id: string
          report: Json | null
          settings: Json | null
          total_duplicates: number
          total_errors: number
          total_imported: number
          total_processed: number
          total_updated: number
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          import_type: string
          organization_id: string
          report?: Json | null
          settings?: Json | null
          total_duplicates?: number
          total_errors?: number
          total_imported?: number
          total_processed?: number
          total_updated?: number
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          import_type?: string
          organization_id?: string
          report?: Json | null
          settings?: Json | null
          total_duplicates?: number
          total_errors?: number
          total_imported?: number
          total_processed?: number
          total_updated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      custom_plan_selections: {
        Row: {
          created_at: string
          id: string
          module_id: string
          organization_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          organization_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          organization_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_plan_selections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "plan_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_plan_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_plan_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      deleted_property_media: {
        Row: {
          cleaned_at: string | null
          cleanup_error: string | null
          cloudinary_public_id: string | null
          cloudinary_url: string
          deleted_at: string
          id: string
          organization_id: string
          original_property_id: string
          storage_path: string | null
        }
        Insert: {
          cleaned_at?: string | null
          cleanup_error?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url: string
          deleted_at?: string
          id?: string
          organization_id: string
          original_property_id: string
          storage_path?: string | null
        }
        Update: {
          cleaned_at?: string | null
          cleanup_error?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url?: string
          deleted_at?: string
          id?: string
          organization_id?: string
          original_property_id?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      external_listings: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_state: string | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          expires_at: string
          id: string
          images: string[] | null
          parking_spots: number | null
          rent_price: number | null
          sale_price: number | null
          source: string
          source_id: string | null
          source_url: string
          title: string
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          images?: string[] | null
          parking_spots?: number | null
          rent_price?: number | null
          sale_price?: number | null
          source: string
          source_id?: string | null
          source_url: string
          title: string
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          images?: string[] | null
          parking_spots?: number | null
          rent_price?: number | null
          sale_price?: number | null
          source?: string
          source_id?: string | null
          source_url?: string
          title?: string
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      external_search_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          filters_json: Json
          id: string
          listing_ids: string[] | null
          search_hash: string
        }
        Insert: {
          expires_at?: string
          fetched_at?: string
          filters_json: Json
          id?: string
          listing_ids?: string[] | null
          search_hash: string
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          filters_json?: Json
          id?: string
          listing_ids?: string[] | null
          search_hash?: string
        }
        Relationships: []
      }
      financing_bank_rates: {
        Row: {
          bank_code: string
          bank_name: string
          id: string
          is_active: boolean | null
          max_ltv: number | null
          max_term_months: number | null
          notes: string | null
          organization_id: string
          rate_max: number
          rate_min: number
          spread_over_selic: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bank_code: string
          bank_name: string
          id?: string
          is_active?: boolean | null
          max_ltv?: number | null
          max_term_months?: number | null
          notes?: string | null
          organization_id: string
          rate_max: number
          rate_min: number
          spread_over_selic?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bank_code?: string
          bank_name?: string
          id?: string
          is_active?: boolean | null
          max_ltv?: number | null
          max_term_months?: number | null
          notes?: string | null
          organization_id?: string
          rate_max?: number
          rate_min?: number
          spread_over_selic?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financing_bank_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financing_bank_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      follow_up_log: {
        Row: {
          attempt_number: number
          delivery_status: string | null
          id: string
          lead_phone: string
          message_sent: string
          message_source: string
          org_id: string
          queue_id: string
          sent_at: string
        }
        Insert: {
          attempt_number: number
          delivery_status?: string | null
          id?: string
          lead_phone: string
          message_sent: string
          message_source?: string
          org_id: string
          queue_id: string
          sent_at?: string
        }
        Update: {
          attempt_number?: number
          delivery_status?: string | null
          id?: string
          lead_phone?: string
          message_sent?: string
          message_source?: string
          org_id?: string
          queue_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "follow_up_log_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "follow_up_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_log_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts_followup_view"
            referencedColumns: ["followup_id"]
          },
        ]
      }
      follow_up_queue: {
        Row: {
          attempt_count: number
          conversation_context: string | null
          created_at: string | null
          id: string
          instance_name: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_name: string | null
          lead_phone: string
          next_followup_at: string
          opted_out: boolean
          org_id: string
          property_interest: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number
          conversation_context?: string | null
          created_at?: string | null
          id?: string
          instance_name: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_name?: string | null
          lead_phone: string
          next_followup_at: string
          opted_out?: boolean
          org_id: string
          property_interest?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number
          conversation_context?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_name?: string | null
          lead_phone?: string
          next_followup_at?: string
          opted_out?: boolean
          org_id?: string
          property_interest?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      generated_arts: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string
          id: string
          organization_id: string
          property_id: string | null
          url_banner: string | null
          url_feed: string | null
          url_story: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          property_id?: string | null
          url_banner?: string | null
          url_feed?: string | null
          url_story?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          property_id?: string | null
          url_banner?: string | null
          url_feed?: string | null
          url_story?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_arts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_arts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "generated_arts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_arts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_arts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      generated_videos: {
        Row: {
          created_at: string
          created_by: string
          duration_per_photo: number
          duration_seconds: number | null
          file_size_bytes: number | null
          final_text: string | null
          format: string
          has_narration: boolean
          id: string
          include_logo: boolean
          job_error: string | null
          job_id: string | null
          job_phase: string | null
          job_progress: number | null
          job_status: string
          music_style: string | null
          organization_id: string
          photo_urls: string[]
          property_id: string | null
          updated_at: string
          video_url: string | null
          voice_used: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_per_photo?: number
          duration_seconds?: number | null
          file_size_bytes?: number | null
          final_text?: string | null
          format?: string
          has_narration?: boolean
          id?: string
          include_logo?: boolean
          job_error?: string | null
          job_id?: string | null
          job_phase?: string | null
          job_progress?: number | null
          job_status?: string
          music_style?: string | null
          organization_id: string
          photo_urls?: string[]
          property_id?: string | null
          updated_at?: string
          video_url?: string | null
          voice_used?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_per_photo?: number
          duration_seconds?: number | null
          file_size_bytes?: number | null
          final_text?: string | null
          format?: string
          has_narration?: boolean
          id?: string
          include_logo?: boolean
          job_error?: string | null
          job_id?: string | null
          job_phase?: string | null
          job_progress?: number | null
          job_status?: string
          music_style?: string | null
          organization_id?: string
          photo_urls?: string[]
          property_id?: string | null
          updated_at?: string
          video_url?: string | null
          voice_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "generated_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      ibge_municipios: {
        Row: {
          capital: boolean
          created_at: string
          ibge_code: string
          name: string
          name_normalized: string
          uf: string
        }
        Insert: {
          capital?: boolean
          created_at?: string
          ibge_code: string
          name: string
          name_normalized: string
          uf: string
        }
        Update: {
          capital?: boolean
          created_at?: string
          ibge_code?: string
          name?: string
          name_normalized?: string
          uf?: string
        }
        Relationships: []
      }
      imobzi_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imobzi_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imobzi_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      imobzi_settings: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          last_cursor: string | null
          last_sync_at: string | null
          organization_id: string
          scrape_cache_ttl_hours: number | null
          scraper_concurrency: number | null
          scraping_enabled: boolean | null
          scraping_min_photos: number | null
          smart_list: string | null
          sync_mode: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          organization_id: string
          scrape_cache_ttl_hours?: number | null
          scraper_concurrency?: number | null
          scraping_enabled?: boolean | null
          scraping_min_photos?: number | null
          smart_list?: string | null
          sync_mode?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          organization_id?: string
          scrape_cache_ttl_hours?: number | null
          scraper_concurrency?: number | null
          scraping_enabled?: boolean | null
          scraping_min_photos?: number | null
          smart_list?: string | null
          sync_mode?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imobzi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imobzi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      import_run_items: {
        Row: {
          created_at: string
          detail_fetched: boolean | null
          error_message: string | null
          id: string
          photos_expected: number | null
          photos_fetched: boolean | null
          photos_imported: number | null
          property_id: string | null
          retry_count: number | null
          run_id: string
          scrape_attempted: boolean | null
          scrape_images_found: number | null
          source_property_id: string
          source_title: string | null
          status: string
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          detail_fetched?: boolean | null
          error_message?: string | null
          id?: string
          photos_expected?: number | null
          photos_fetched?: boolean | null
          photos_imported?: number | null
          property_id?: string | null
          retry_count?: number | null
          run_id: string
          scrape_attempted?: boolean | null
          scrape_images_found?: number | null
          source_property_id: string
          source_title?: string | null
          status?: string
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          detail_fetched?: boolean | null
          error_message?: string | null
          id?: string
          photos_expected?: number | null
          photos_fetched?: boolean | null
          photos_imported?: number | null
          property_id?: string | null
          retry_count?: number | null
          run_id?: string
          scrape_attempted?: boolean | null
          scrape_images_found?: number | null
          source_property_id?: string
          source_title?: string | null
          status?: string
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_run_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_run_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_run_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "import_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          created_at: string
          error_message: string | null
          errors: number | null
          finished_at: string | null
          id: string
          images_failed: number | null
          images_processed: number | null
          images_scraped: number | null
          imported: number | null
          marketplace_property_ids: string[] | null
          organization_id: string
          pending_property_ids: string[] | null
          scrape_failed: number | null
          skipped: number | null
          source_provider: string
          started_at: string
          status: string
          total_properties: number | null
          updated: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          errors?: number | null
          finished_at?: string | null
          id?: string
          images_failed?: number | null
          images_processed?: number | null
          images_scraped?: number | null
          imported?: number | null
          marketplace_property_ids?: string[] | null
          organization_id: string
          pending_property_ids?: string[] | null
          scrape_failed?: number | null
          skipped?: number | null
          source_provider?: string
          started_at?: string
          status?: string
          total_properties?: number | null
          updated?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          errors?: number | null
          finished_at?: string | null
          id?: string
          images_failed?: number | null
          images_processed?: number | null
          images_scraped?: number | null
          imported?: number | null
          marketplace_property_ids?: string[] | null
          organization_id?: string
          pending_property_ids?: string[] | null
          scrape_failed?: number | null
          skipped?: number | null
          source_provider?: string
          started_at?: string
          status?: string
          total_properties?: number | null
          updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      import_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          organization_id: string
          source_property_ids: string[]
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          organization_id: string
          source_property_ids: string[]
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          source_property_ids?: string[]
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      inbox_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_to: string
          conversation_id: string
          id: string
          organization_id: string
          role: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to: string
          conversation_id: string
          id?: string
          organization_id: string
          role?: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string
          conversation_id?: string
          id?: string
          organization_id?: string
          role?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      itbi_org_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          ibge_code: string
          id: string
          notes: string | null
          organization_id: string
          rule: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ibge_code: string
          id?: string
          notes?: string | null
          organization_id: string
          rule: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ibge_code?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itbi_org_overrides_ibge_code_fkey"
            columns: ["ibge_code"]
            isOneToOne: false
            referencedRelation: "ibge_municipios"
            referencedColumns: ["ibge_code"]
          },
          {
            foreignKeyName: "itbi_org_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itbi_org_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      itbi_rules: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          ibge_code: string | null
          id: string
          is_active: boolean
          notes: string | null
          rule: Json
          scope: string
          source_label: string | null
          source_url: string | null
          uf: string | null
          updated_at: string
          version: number
        }
        Insert: {
          confidence: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule: Json
          scope: string
          source_label?: string | null
          source_url?: string | null
          uf?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule?: Json
          scope?: string
          source_label?: string | null
          source_url?: string | null
          uf?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "itbi_rules_ibge_code_fkey"
            columns: ["ibge_code"]
            isOneToOne: false
            referencedRelation: "ibge_municipios"
            referencedColumns: ["ibge_code"]
          },
        ]
      }
      lead_document_template_items: {
        Row: {
          accepted_formats: string[]
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          max_size_mb: number
          name: string
          position: number
          template_id: string
        }
        Insert: {
          accepted_formats?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          max_size_mb?: number
          name: string
          position?: number
          template_id: string
        }
        Update: {
          accepted_formats?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          max_size_mb?: number
          name?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_document_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "lead_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_document_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          operation_type: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          operation_type: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          operation_type?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          ai_validation: Json | null
          created_at: string
          file_name: string
          file_size_bytes: number | null
          id: string
          lead_id: string
          mime_type: string | null
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          template_item_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          ai_validation?: Json | null
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          lead_id: string
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          template_item_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          ai_validation?: Json | null
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          lead_id?: string
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          template_item_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_documents_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "lead_document_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          lead_id: string
          occurred_at: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          lead_id: string
          occurred_at?: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          lead_id?: string
          occurred_at?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          lead_id: string
          metadata: Json | null
          organization_id: string
          score_delta: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          lead_id: string
          metadata?: Json | null
          organization_id: string
          score_delta?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          organization_id?: string
          score_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      lead_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          is_loss: boolean
          is_win: boolean
          name: string
          organization_id: string | null
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_loss?: boolean
          is_win?: boolean
          name: string
          organization_id?: string | null
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_loss?: boolean
          is_win?: boolean
          name?: string
          organization_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      lead_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          position: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          position?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      leads: {
        Row: {
          additional_requirements: string | null
          ai_summary: string | null
          ai_summary_at: string | null
          broker_id: string | null
          consent_voice_call: boolean
          conversion_identifier: string | null
          created_at: string
          created_by: string
          email: string | null
          estimated_value: number | null
          external_id: string | null
          external_source: string | null
          id: string
          imported_at: string | null
          inactivated_at: string | null
          inactivated_by: string | null
          inactivation_reason: string | null
          interested_property_type_id: string | null
          interested_property_type_ids: string[] | null
          is_active: boolean
          lead_stage_id: string | null
          lead_type_id: string | null
          max_area: number | null
          max_bathrooms: number | null
          max_bedrooms: number | null
          max_parking: number | null
          min_area: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_parking: number | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          position: number
          preferred_cities: string[] | null
          preferred_neighborhoods: string[] | null
          property_id: string | null
          score: number | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          temperature: string | null
          traffic_source: string | null
          transaction_interest: string | null
          updated_at: string
        }
        Insert: {
          additional_requirements?: string | null
          ai_summary?: string | null
          ai_summary_at?: string | null
          broker_id?: string | null
          consent_voice_call?: boolean
          conversion_identifier?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          estimated_value?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          imported_at?: string | null
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          interested_property_type_id?: string | null
          interested_property_type_ids?: string[] | null
          is_active?: boolean
          lead_stage_id?: string | null
          lead_type_id?: string | null
          max_area?: number | null
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_parking?: number | null
          min_area?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: number
          preferred_cities?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_id?: string | null
          score?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: string | null
          traffic_source?: string | null
          transaction_interest?: string | null
          updated_at?: string
        }
        Update: {
          additional_requirements?: string | null
          ai_summary?: string | null
          ai_summary_at?: string | null
          broker_id?: string | null
          consent_voice_call?: boolean
          conversion_identifier?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          estimated_value?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          imported_at?: string | null
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          interested_property_type_id?: string | null
          interested_property_type_ids?: string[] | null
          is_active?: boolean
          lead_stage_id?: string | null
          lead_type_id?: string | null
          max_area?: number | null
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_parking?: number | null
          min_area?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: number
          preferred_cities?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_id?: string | null
          score?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: string | null
          traffic_source?: string | null
          transaction_interest?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_interested_property_type_id_fkey"
            columns: ["interested_property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_stage_id_fkey"
            columns: ["lead_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_type_id_fkey"
            columns: ["lead_type_id"]
            isOneToOne: false
            referencedRelation: "lead_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      maintenance_audit_log: {
        Row: {
          action: string
          id: string
          ip_address: string | null
          maintenance_message: string | null
          new_value: boolean
          performed_at: string
          performed_by: string
          previous_value: boolean
          user_agent: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: string | null
          maintenance_message?: string | null
          new_value: boolean
          performed_at?: string
          performed_by: string
          previous_value: boolean
          user_agent?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: string | null
          maintenance_message?: string | null
          new_value?: boolean
          performed_at?: string
          performed_by?: string
          previous_value?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      marketplace_contact_access: {
        Row: {
          accessed_at: string
          id: string
          marketplace_property_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          marketplace_property_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          marketplace_property_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_contact_access_marketplace_property_id_fkey"
            columns: ["marketplace_property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contact_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contact_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      marketplace_contact_intents: {
        Row: {
          broker_name: string | null
          consumed_at: string | null
          consumer_phone: string | null
          contact_type: string
          created_at: string
          id: string
          org_name: string | null
          organization_id: string
          property_code: string | null
          property_id: string | null
          property_location: string | null
          property_price: number | null
          property_title: string | null
          property_transaction_type: string | null
          source_org_name: string | null
          target_phone: string
        }
        Insert: {
          broker_name?: string | null
          consumed_at?: string | null
          consumer_phone?: string | null
          contact_type?: string
          created_at?: string
          id?: string
          org_name?: string | null
          organization_id: string
          property_code?: string | null
          property_id?: string | null
          property_location?: string | null
          property_price?: number | null
          property_title?: string | null
          property_transaction_type?: string | null
          source_org_name?: string | null
          target_phone: string
        }
        Update: {
          broker_name?: string | null
          consumed_at?: string | null
          consumer_phone?: string | null
          contact_type?: string
          created_at?: string
          id?: string
          org_name?: string | null
          organization_id?: string
          property_code?: string | null
          property_id?: string | null
          property_location?: string | null
          property_price?: number | null
          property_title?: string | null
          property_transaction_type?: string | null
          source_org_name?: string | null
          target_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_contact_intents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contact_intents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      marketplace_properties: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          commission_percentage: number | null
          created_at: string
          description: string | null
          external_code: string | null
          id: string
          images: string[] | null
          is_featured: boolean
          marketplace_contact_phone: string | null
          organization_id: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          parking_spots: number | null
          payment_options: string[] | null
          property_type_id: string | null
          rent_price: number | null
          sale_price: number | null
          sale_price_financed: number | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean
          marketplace_contact_phone?: string | null
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spots?: number | null
          payment_options?: string[] | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean
          marketplace_contact_phone?: string | null
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spots?: number | null
          payment_options?: string[] | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "marketplace_properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_account_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          content_text: string | null
          content_type: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          id: string
          media_url: string | null
          metadata: Json
          organization_id: string
          sender_type: Database["public"]["Enums"]["message_sender_type"] | null
          sent_at: string
          source_id: string
          source_table: string
        }
        Insert: {
          channel_account_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          content_text?: string | null
          content_type?: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json
          organization_id: string
          sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          sent_at: string
          source_id: string
          source_table: string
        }
        Update: {
          channel_account_id?: string
          channel_type?: Database["public"]["Enums"]["channel_type"]
          content_text?: string | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json
          organization_id?: string
          sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          sent_at?: string
          source_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_webhook_events: {
        Row: {
          channel_type: string
          error: string | null
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          channel_type: string
          error?: string | null
          external_event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          channel_type?: string
          error?: string | null
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          organization_id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      omnichannel_feature_flags: {
        Row: {
          meta_messaging_enabled: boolean
          meta_messaging_notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          meta_messaging_enabled?: boolean
          meta_messaging_notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          meta_messaging_enabled?: boolean
          meta_messaging_notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnichannel_feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_custom_roles: {
        Row: {
          base_role: string
          color: string | null
          created_at: string
          id: string
          module_permissions: Json
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_role?: string
          color?: string | null
          created_at?: string
          id?: string
          module_permissions?: Json
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_role?: string
          color?: string | null
          created_at?: string
          id?: string
          module_permissions?: Json
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_member_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          performed_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          performed_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          performed_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          invite_code: string
          is_active: boolean
          lead_stages_seeded: boolean
          lead_types_seeded: boolean
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          trial_ends_at: string | null
          trial_started_at: string | null
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          lead_stages_seeded?: boolean
          lead_types_seeded?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          lead_stages_seeded?: boolean
          lead_types_seeded?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      owner_aliases: {
        Row: {
          created_at: string
          id: string
          name: string
          occurrence_count: number
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          occurrence_count?: number
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          occurrence_count?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_aliases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string
          primary_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phone: string
          primary_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          primary_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      pdf_extract_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          file_name: string | null
          id: string
          organization_id: string
          result: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          file_name?: string | null
          id?: string
          organization_id: string
          result?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          file_name?: string | null
          id?: string
          organization_id?: string
          result?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_extract_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_extract_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      plan_modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          feature_key: string
          feature_value: Json
          icon: string | null
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          feature_key: string
          feature_value?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          feature_key?: string
          feature_value?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
        }
        Relationships: []
      }
      platform_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invite_email: string | null
          name: string | null
          organization_id: string
          status: string
          used_at: string | null
          used_by_organization_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          name?: string | null
          organization_id: string
          status?: string
          used_at?: string | null
          used_by_organization_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          name?: string | null
          organization_id?: string
          status?: string
          used_at?: string | null
          used_by_organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "platform_invites_used_by_organization_id_fkey"
            columns: ["used_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_used_by_organization_id_fkey"
            columns: ["used_by_organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      portal_feed_logs: {
        Row: {
          duration_ms: number | null
          error_details: Json | null
          errors_count: number
          feed_id: string
          generated_at: string
          id: string
          properties_count: number
        }
        Insert: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number
          feed_id: string
          generated_at?: string
          id?: string
          properties_count?: number
        }
        Update: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number
          feed_id?: string
          generated_at?: string
          id?: string
          properties_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_feed_logs_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "portal_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feeds: {
        Row: {
          created_at: string
          feed_token: string
          feed_url: string | null
          id: string
          is_active: boolean
          last_generated_at: string | null
          organization_id: string
          portal_label: string
          portal_name: string
          property_filter: Json | null
          total_properties_exported: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feed_token?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          organization_id: string
          portal_label: string
          portal_name: string
          property_filter?: Json | null
          total_properties_exported?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feed_token?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          organization_id?: string
          portal_label?: string
          portal_name?: string
          property_filter?: Json | null
          total_properties_exported?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          creci: string | null
          creci_verified: boolean
          creci_verified_at: string | null
          creci_verified_name: string | null
          custom_role_id: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          onboarding_completed: boolean | null
          organization_id: string | null
          phone: string | null
          phone_verified: boolean | null
          removed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          creci_verified?: boolean
          creci_verified_at?: string | null
          creci_verified_name?: string | null
          custom_role_id?: string | null
          email_verified?: boolean | null
          full_name: string
          id?: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          removed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          creci_verified?: boolean
          creci_verified_at?: string | null
          creci_verified_name?: string | null
          custom_role_id?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          removed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "organization_custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      properties: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          ai_blacklist: boolean
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          area_useful: number | null
          availability_status: string
          availability_status_updated_at: string | null
          bathrooms: number | null
          beach_distance_meters: number | null
          bedrooms: number | null
          building_id: string | null
          captador_id: string | null
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          condominium_fee: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          description_generated: boolean | null
          development_name: string | null
          featured: boolean | null
          floor: number | null
          geocode_error: string | null
          geocode_hash: string | null
          geocode_precision: string | null
          geocode_provider: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string
          imobzi_updated_at: string | null
          import_status: string | null
          import_warnings: Json | null
          inspection_fee: number | null
          iptu: number | null
          iptu_monthly: number | null
          latitude: number | null
          launch_stage: Database["public"]["Enums"]["launch_stage"] | null
          longitude: number | null
          marketplace_contact_phone: string | null
          organization_id: string
          parking_spots: number | null
          payment_options: string[] | null
          property_code: string | null
          property_condition:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_group_id: string | null
          property_type_id: string | null
          raw_payload: Json | null
          rent_price: number | null
          sale_price: number | null
          sale_price_financed: number | null
          source_code: string | null
          source_key_id: string | null
          source_property_id: string | null
          source_provider: string | null
          source_status: string | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          ai_blacklist?: boolean
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          area_useful?: number | null
          availability_status?: string
          availability_status_updated_at?: string | null
          bathrooms?: number | null
          beach_distance_meters?: number | null
          bedrooms?: number | null
          building_id?: string | null
          captador_id?: string | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          condominium_fee?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          description_generated?: boolean | null
          development_name?: string | null
          featured?: boolean | null
          floor?: number | null
          geocode_error?: string | null
          geocode_hash?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          imobzi_updated_at?: string | null
          import_status?: string | null
          import_warnings?: Json | null
          inspection_fee?: number | null
          iptu?: number | null
          iptu_monthly?: number | null
          latitude?: number | null
          launch_stage?: Database["public"]["Enums"]["launch_stage"] | null
          longitude?: number | null
          marketplace_contact_phone?: string | null
          organization_id: string
          parking_spots?: number | null
          payment_options?: string[] | null
          property_code?: string | null
          property_condition?:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_group_id?: string | null
          property_type_id?: string | null
          raw_payload?: Json | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          source_code?: string | null
          source_key_id?: string | null
          source_property_id?: string | null
          source_provider?: string | null
          source_status?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          ai_blacklist?: boolean
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          area_useful?: number | null
          availability_status?: string
          availability_status_updated_at?: string | null
          bathrooms?: number | null
          beach_distance_meters?: number | null
          bedrooms?: number | null
          building_id?: string | null
          captador_id?: string | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          condominium_fee?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          description_generated?: boolean | null
          development_name?: string | null
          featured?: boolean | null
          floor?: number | null
          geocode_error?: string | null
          geocode_hash?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          imobzi_updated_at?: string | null
          import_status?: string | null
          import_warnings?: Json | null
          inspection_fee?: number | null
          iptu?: number | null
          iptu_monthly?: number | null
          latitude?: number | null
          launch_stage?: Database["public"]["Enums"]["launch_stage"] | null
          longitude?: number | null
          marketplace_contact_phone?: string | null
          organization_id?: string
          parking_spots?: number | null
          payment_options?: string[] | null
          property_code?: string | null
          property_condition?:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_group_id?: string | null
          property_type_id?: string | null
          raw_payload?: Json | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          source_code?: string | null
          source_key_id?: string | null
          source_property_id?: string | null
          source_provider?: string | null
          source_status?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "properties_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      property_groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          organization_id: string
          source_property_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id: string
          source_property_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          source_property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_groups_source_property_id_fkey"
            columns: ["source_property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_groups_source_property_id_fkey"
            columns: ["source_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_groups_source_property_id_fkey"
            columns: ["source_property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_images: {
        Row: {
          cache_status: string | null
          cached_thumbnail_url: string | null
          created_at: string
          display_order: number | null
          drive_file_id: string | null
          id: string
          image_type: Database["public"]["Enums"]["property_image_type"] | null
          is_cover: boolean | null
          phash: string | null
          property_id: string
          r2_key_full: string | null
          r2_key_thumb: string | null
          scraped_from_url: string | null
          source: string | null
          storage_provider: string
          url: string
        }
        Insert: {
          cache_status?: string | null
          cached_thumbnail_url?: string | null
          created_at?: string
          display_order?: number | null
          drive_file_id?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["property_image_type"] | null
          is_cover?: boolean | null
          phash?: string | null
          property_id: string
          r2_key_full?: string | null
          r2_key_thumb?: string | null
          scraped_from_url?: string | null
          source?: string | null
          storage_provider?: string
          url: string
        }
        Update: {
          cache_status?: string | null
          cached_thumbnail_url?: string | null
          created_at?: string
          display_order?: number | null
          drive_file_id?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["property_image_type"] | null
          is_cover?: boolean | null
          phash?: string | null
          property_id?: string
          r2_key_full?: string | null
          r2_key_thumb?: string | null
          scraped_from_url?: string | null
          source?: string | null
          storage_provider?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_landing_content: {
        Row: {
          created_at: string
          cta_primary: string
          cta_secondary: string | null
          description_persuasive: string
          generated_at: string
          headline: string
          id: string
          key_features: Json | null
          model_used: string | null
          property_id: string
          seo_description: string | null
          seo_title: string | null
          subheadline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_primary: string
          cta_secondary?: string | null
          description_persuasive: string
          generated_at?: string
          headline: string
          id?: string
          key_features?: Json | null
          model_used?: string | null
          property_id: string
          seo_description?: string | null
          seo_title?: string | null
          subheadline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_primary?: string
          cta_secondary?: string | null
          description_persuasive?: string
          generated_at?: string
          headline?: string
          id?: string
          key_features?: Json | null
          model_used?: string | null
          property_id?: string
          seo_description?: string | null
          seo_title?: string | null
          subheadline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_landing_content_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_content_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_content_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_landing_overrides: {
        Row: {
          created_at: string
          custom_cta_primary: string | null
          custom_cta_secondary: string | null
          custom_description: string | null
          custom_headline: string | null
          custom_key_features: Json | null
          custom_sections: Json | null
          custom_subheadline: string | null
          hide_exact_address: boolean
          id: string
          map_radius_meters: number
          organization_id: string
          property_id: string
          show_nearby_pois: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_cta_primary?: string | null
          custom_cta_secondary?: string | null
          custom_description?: string | null
          custom_headline?: string | null
          custom_key_features?: Json | null
          custom_sections?: Json | null
          custom_subheadline?: string | null
          hide_exact_address?: boolean
          id?: string
          map_radius_meters?: number
          organization_id: string
          property_id: string
          show_nearby_pois?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_cta_primary?: string | null
          custom_cta_secondary?: string | null
          custom_description?: string | null
          custom_headline?: string | null
          custom_key_features?: Json | null
          custom_sections?: Json | null
          custom_subheadline?: string | null
          hide_exact_address?: boolean
          id?: string
          map_radius_meters?: number
          organization_id?: string
          property_id?: string
          show_nearby_pois?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_landing_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_landing_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_media: {
        Row: {
          checksum: string | null
          created_at: string | null
          display_order: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          is_processed: boolean | null
          kind: string
          mime_type: string | null
          organization_id: string
          original_url: string
          phash: string | null
          processing_error: string | null
          property_id: string
          source_media_id: string | null
          storage_path: string | null
          storage_provider: string | null
          stored_url: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          display_order?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_processed?: boolean | null
          kind: string
          mime_type?: string | null
          organization_id: string
          original_url: string
          phash?: string | null
          processing_error?: string | null
          property_id: string
          source_media_id?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          stored_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          display_order?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_processed?: boolean | null
          kind?: string
          mime_type?: string | null
          organization_id?: string
          original_url?: string
          phash?: string | null
          processing_error?: string | null
          property_id?: string
          source_media_id?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          stored_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          phone: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_partnerships: {
        Row: {
          commission_split: number
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          owner_organization_id: string
          partner_organization_id: string | null
          property_id: string
          status: Database["public"]["Enums"]["partnership_status"]
          updated_at: string
        }
        Insert: {
          commission_split: number
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_organization_id: string
          partner_organization_id?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["partnership_status"]
          updated_at?: string
        }
        Update: {
          commission_split?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_organization_id?: string
          partner_organization_id?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["partnership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_partnerships_owner_organization_id_fkey"
            columns: ["owner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_owner_organization_id_fkey"
            columns: ["owner_organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_partnerships_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_partnerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_share_links: {
        Row: {
          active: boolean
          broker_id: string
          broker_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          property_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          broker_id: string
          broker_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          property_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          broker_id?: string
          broker_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          property_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_share_visits: {
        Row: {
          id: string
          ip_hash: string | null
          referrer: string | null
          share_link_id: string
          user_agent: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          share_link_id: string
          user_agent?: string | null
          visited_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          share_link_id?: string
          user_agent?: string | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_share_visits_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "property_share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_share_visits_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "vw_landing_links_without_contact"
            referencedColumns: ["share_link_id"]
          },
        ]
      }
      property_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          organization_id: string
          property_id: string
          reason: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          organization_id: string
          property_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          organization_id?: string
          property_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_status_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_type_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          property_type_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          property_type_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          property_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_type_codes_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      property_visibility: {
        Row: {
          created_at: string
          id: string
          partnership_commission: number | null
          property_id: string
          show_owner_contact: boolean
          updated_at: string
          visibility: Database["public"]["Enums"]["property_visibility_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          partnership_commission?: number | null
          property_id: string
          show_owner_contact?: boolean
          updated_at?: string
          visibility?: Database["public"]["Enums"]["property_visibility_type"]
        }
        Update: {
          created_at?: string
          id?: string
          partnership_commission?: number | null
          property_id?: string
          show_owner_contact?: boolean
          updated_at?: string
          visibility?: Database["public"]["Enums"]["property_visibility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "property_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_visits: {
        Row: {
          agent_id: string
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          feedback: string | null
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          property_id: string
          rating: number | null
          scheduled_at: string
          updated_at: string
          visit_status: Database["public"]["Enums"]["visit_status"]
        }
        Insert: {
          agent_id: string
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          feedback?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          property_id: string
          rating?: number | null
          scheduled_at: string
          updated_at?: string
          visit_status?: Database["public"]["Enums"]["visit_status"]
        }
        Update: {
          agent_id?: string
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          feedback?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          property_id?: string
          rating?: number | null
          scheduled_at?: string
          updated_at?: string
          visit_status?: Database["public"]["Enums"]["visit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "property_visits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "property_visits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "property_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_info: Json | null
          fcm_token: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          fcm_token: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          fcm_token?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      rd_station_settings: {
        Row: {
          api_private_key: string | null
          api_public_key: string | null
          auto_send_to_crm: boolean
          created_at: string
          default_source: string
          default_stage_id: string | null
          id: string
          is_active: boolean
          oauth_access_token: string | null
          oauth_client_id: string | null
          oauth_refresh_token: string | null
          oauth_token_expires_at: string | null
          organization_id: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          api_private_key?: string | null
          api_public_key?: string | null
          auto_send_to_crm?: boolean
          created_at?: string
          default_source?: string
          default_stage_id?: string | null
          id?: string
          is_active?: boolean
          oauth_access_token?: string | null
          oauth_client_id?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          organization_id: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          api_private_key?: string | null
          api_public_key?: string | null
          auto_send_to_crm?: boolean
          created_at?: string
          default_source?: string
          default_stage_id?: string | null
          id?: string
          is_active?: boolean
          oauth_access_token?: string | null
          oauth_client_id?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_station_settings_default_stage_id_fkey"
            columns: ["default_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_station_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_station_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      rd_station_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          payload: Json
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_station_webhook_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_station_webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_station_webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      retell_agent_config: {
        Row: {
          agent_id: string
          agent_name: string
          auto_create_leads: boolean | null
          auto_outbound_enabled: boolean
          auto_qualify_leads: boolean | null
          broker_assignment_mode: string | null
          conversation_flow_id: string | null
          created_at: string
          enabled: boolean | null
          id: string
          max_call_attempts: number
          max_call_duration_min: number | null
          min_minutes_between_attempts: number
          n8n_webhook_url: string | null
          notification_template_broker: string | null
          notification_template_client: string | null
          organization_id: string
          post_call_analysis_prompt: string | null
          qualification_prompt: string | null
          retell_from_number: string | null
          retell_phone_number_id: string | null
          score_criteria: Json | null
          transfer_keywords: string[] | null
          updated_at: string
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_id?: string
          agent_name?: string
          auto_create_leads?: boolean | null
          auto_outbound_enabled?: boolean
          auto_qualify_leads?: boolean | null
          broker_assignment_mode?: string | null
          conversation_flow_id?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          max_call_attempts?: number
          max_call_duration_min?: number | null
          min_minutes_between_attempts?: number
          n8n_webhook_url?: string | null
          notification_template_broker?: string | null
          notification_template_client?: string | null
          organization_id: string
          post_call_analysis_prompt?: string | null
          qualification_prompt?: string | null
          retell_from_number?: string | null
          retell_phone_number_id?: string | null
          score_criteria?: Json | null
          transfer_keywords?: string[] | null
          updated_at?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string
          auto_create_leads?: boolean | null
          auto_outbound_enabled?: boolean
          auto_qualify_leads?: boolean | null
          broker_assignment_mode?: string | null
          conversation_flow_id?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          max_call_attempts?: number
          max_call_duration_min?: number | null
          min_minutes_between_attempts?: number
          n8n_webhook_url?: string | null
          notification_template_broker?: string | null
          notification_template_client?: string | null
          organization_id?: string
          post_call_analysis_prompt?: string | null
          qualification_prompt?: string | null
          retell_from_number?: string | null
          retell_phone_number_id?: string | null
          score_criteria?: Json | null
          transfer_keywords?: string[] | null
          updated_at?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retell_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retell_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      retell_flow_steps: {
        Row: {
          created_at: string
          edges: Json | null
          id: string
          instruction_text: string
          is_global: boolean | null
          label: string
          node_id: string
          node_type: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: string
          instruction_text?: string
          is_global?: boolean | null
          label: string
          node_id: string
          node_type?: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: string
          instruction_text?: string
          is_global?: boolean | null
          label?: string
          node_id?: string
          node_type?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retell_flow_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retell_flow_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          notify_new_matches: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          notify_new_matches?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          notify_new_matches?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      scrape_cache: {
        Row: {
          error_message: string | null
          expires_at: string | null
          id: string
          images: Json | null
          scraped_at: string | null
          status: string | null
          url: string
          url_hash: string
        }
        Insert: {
          error_message?: string | null
          expires_at?: string | null
          id?: string
          images?: Json | null
          scraped_at?: string | null
          status?: string | null
          url: string
          url_hash: string
        }
        Update: {
          error_message?: string | null
          expires_at?: string | null
          id?: string
          images?: Json | null
          scraped_at?: string | null
          status?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          actor_org_id: string | null
          actor_type: string
          actor_user_id: string | null
          created_at: string
          decision: string
          endpoint: string | null
          event_hash: string | null
          event_type: string
          id: string
          ip: unknown
          metadata: Json | null
          prev_hash: string | null
          reason_code: string | null
          request_id: string | null
          severity: string
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          actor_org_id?: string | null
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          decision: string
          endpoint?: string | null
          event_hash?: string | null
          event_type: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          prev_hash?: string | null
          reason_code?: string | null
          request_id?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_org_id?: string | null
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          decision?: string
          endpoint?: string | null
          event_hash?: string | null
          event_type?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          prev_hash?: string | null
          reason_code?: string | null
          request_id?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      security_feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      signup_attempt_log: {
        Row: {
          created_at: string
          email: string | null
          id: string
          invite_id: string | null
          ip_address: string
          success: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          ip_address: string
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          ip_address?: string
          success?: boolean
        }
        Relationships: []
      }
      simulacoes_financiamento: {
        Row: {
          aprovado: boolean
          banco_id: string
          cet_anual_estimado: number
          comprometimento_renda: number
          corretor_id: string
          created_at: string | null
          id: string
          idade_comprador: number
          imovel_id: string | null
          itbi_confidence: string | null
          itbi_ibge_code: string | null
          itbi_rule_snapshot: Json | null
          itbi_rule_version: number | null
          itbi_value: number | null
          lead_id: string | null
          observacoes: string | null
          organization_id: string
          prazo_meses: number
          primeira_parcela: number
          renda_mensal: number
          sistema_amortizacao: string
          taxa_anual: number
          total_juros: number
          total_pago: number
          total_seguros: number
          tr_mensal: number
          ultima_parcela: number
          updated_at: string | null
          valor_entrada: number
          valor_fgts: number | null
          valor_financiado: number
          valor_imovel: number
        }
        Insert: {
          aprovado: boolean
          banco_id: string
          cet_anual_estimado: number
          comprometimento_renda: number
          corretor_id: string
          created_at?: string | null
          id?: string
          idade_comprador: number
          imovel_id?: string | null
          itbi_confidence?: string | null
          itbi_ibge_code?: string | null
          itbi_rule_snapshot?: Json | null
          itbi_rule_version?: number | null
          itbi_value?: number | null
          lead_id?: string | null
          observacoes?: string | null
          organization_id: string
          prazo_meses: number
          primeira_parcela: number
          renda_mensal: number
          sistema_amortizacao: string
          taxa_anual: number
          total_juros: number
          total_pago: number
          total_seguros: number
          tr_mensal: number
          ultima_parcela: number
          updated_at?: string | null
          valor_entrada: number
          valor_fgts?: number | null
          valor_financiado: number
          valor_imovel: number
        }
        Update: {
          aprovado?: boolean
          banco_id?: string
          cet_anual_estimado?: number
          comprometimento_renda?: number
          corretor_id?: string
          created_at?: string | null
          id?: string
          idade_comprador?: number
          imovel_id?: string | null
          itbi_confidence?: string | null
          itbi_ibge_code?: string | null
          itbi_rule_snapshot?: Json | null
          itbi_rule_version?: number | null
          itbi_value?: number | null
          lead_id?: string | null
          observacoes?: string | null
          organization_id?: string
          prazo_meses?: number
          primeira_parcela?: number
          renda_mensal?: number
          sistema_amortizacao?: string
          taxa_anual?: number
          total_juros?: number
          total_pago?: number
          total_seguros?: number
          tr_mensal?: number
          ultima_parcela?: number
          updated_at?: string | null
          valor_entrada?: number
          valor_fgts?: number | null
          valor_financiado?: number
          valor_imovel?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_financiamento_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_financiamento_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_financiamento_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "simulacoes_financiamento_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_financiamento_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_financiamento_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      site_documents: {
        Row: {
          created_at: string
          draft: Json
          draft_v2: Json | null
          editor_mode: string
          id: string
          last_published_at: string | null
          last_saved_at: string
          organization_id: string
          published: Json | null
          published_v2: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft?: Json
          draft_v2?: Json | null
          editor_mode?: string
          id?: string
          last_published_at?: string | null
          last_saved_at?: string
          organization_id: string
          published?: Json | null
          published_v2?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft?: Json
          draft_v2?: Json | null
          editor_mode?: string
          id?: string
          last_published_at?: string | null
          last_saved_at?: string
          organization_id?: string
          published?: Json | null
          published_v2?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          automation_allowance_brl: number
          created_at: string
          description: string | null
          discount_percent: number | null
          display_order: number
          features: Json | null
          id: string
          is_active: boolean
          marketplace_access: boolean
          marketplace_views_limit: number | null
          max_leads: number | null
          max_own_properties: number | null
          max_shared_properties: number | null
          max_users: number | null
          name: string
          partnership_access: boolean
          plan_type: string | null
          price_monthly: number
          price_yearly: number
          priority_support: boolean
          slug: string
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          automation_allowance_brl?: number
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          marketplace_access?: boolean
          marketplace_views_limit?: number | null
          max_leads?: number | null
          max_own_properties?: number | null
          max_shared_properties?: number | null
          max_users?: number | null
          name: string
          partnership_access?: boolean
          plan_type?: string | null
          price_monthly: number
          price_yearly: number
          priority_support?: boolean
          slug: string
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          automation_allowance_brl?: number
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          marketplace_access?: boolean
          marketplace_views_limit?: number | null
          max_leads?: number | null
          max_own_properties?: number | null
          max_shared_properties?: number | null
          max_users?: number | null
          name?: string
          partnership_access?: boolean
          plan_type?: string | null
          price_monthly?: number
          price_yearly?: number
          priority_support?: boolean
          slug?: string
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          legacy_stripe_customer_id: string | null
          legacy_stripe_subscription_id: string | null
          organization_id: string
          payment_method: string | null
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          legacy_stripe_customer_id?: string | null
          legacy_stripe_subscription_id?: string | null
          organization_id: string
          payment_method?: string | null
          plan_id: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          legacy_stripe_customer_id?: string | null
          legacy_stripe_subscription_id?: string | null
          organization_id?: string
          payment_method?: string | null
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          organization_id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          organization_id: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          cloudflare_hostname_id: string | null
          cloudflare_zone_id: string | null
          created_at: string
          created_by: string | null
          hostname: string
          id: string
          is_active: boolean
          nameservers: string[] | null
          organization_id: string
          ssl_status: string
          updated_at: string
          verification_status: string
          zone_mode: string
          zone_status: string | null
        }
        Insert: {
          cloudflare_hostname_id?: string | null
          cloudflare_zone_id?: string | null
          created_at?: string
          created_by?: string | null
          hostname: string
          id?: string
          is_active?: boolean
          nameservers?: string[] | null
          organization_id: string
          ssl_status?: string
          updated_at?: string
          verification_status?: string
          zone_mode?: string
          zone_status?: string | null
        }
        Update: {
          cloudflare_hostname_id?: string | null
          cloudflare_zone_id?: string | null
          created_at?: string
          created_by?: string | null
          hostname?: string
          id?: string
          is_active?: boolean
          nameservers?: string[] | null
          organization_id?: string
          ssl_status?: string
          updated_at?: string
          verification_status?: string
          zone_mode?: string
          zone_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          ticket_id?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          type?: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          notes: string | null
          organization_id: string
          paid: boolean | null
          paid_at: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          notes?: string | null
          organization_id: string
          paid?: boolean | null
          paid_at?: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          metadata: Json | null
          onesignal_id: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json | null
          onesignal_id: string
          platform?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json | null
          onesignal_id?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      user_passkeys: {
        Row: {
          aaguid: string | null
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[]
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[]
          user_id: string
        }
        Update: {
          aaguid?: string | null
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          device_type: string
          id: string
          ip_address: string | null
          last_seen_at: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          device_type?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          device_type?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          type: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          type: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          type?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      voice_call_queue: {
        Row: {
          attempt_count: number
          call_id: string | null
          created_at: string
          id: string
          last_error: string | null
          lead_id: string
          metadata: Json
          next_attempt_at: string
          organization_id: string
          phone_e164: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          call_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id: string
          metadata?: Json
          next_attempt_at?: string
          organization_id: string
          phone_e164: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          call_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id?: string
          metadata?: Json
          next_attempt_at?: string
          organization_id?: string
          phone_e164?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      voice_calls: {
        Row: {
          agent_id: string
          call_id: string
          call_status: string | null
          call_type: string | null
          created_at: string
          duration_ms: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          organization_id: string
          recording_url: string | null
          sentiment: string | null
          started_at: string | null
          transcript: string | null
        }
        Insert: {
          agent_id: string
          call_id: string
          call_status?: string | null
          call_type?: string | null
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id: string
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          transcript?: string | null
        }
        Update: {
          agent_id?: string
          call_id?: string
          call_status?: string | null
          call_type?: string | null
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id?: string
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          consumed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          consumed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          consumed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      website_settings: {
        Row: {
          about_text: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          custom_domain: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          organization_id: string
          redirect_to_custom_domain: boolean
          show_whatsapp_float: boolean | null
          site_template: string
          updated_at: string | null
          use_custom_domain_url: boolean
          use_subdomain_landing: boolean
          whatsapp_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          about_text?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_domain?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          organization_id: string
          redirect_to_custom_domain?: boolean
          show_whatsapp_float?: boolean | null
          site_template?: string
          updated_at?: string | null
          use_custom_domain_url?: boolean
          use_subdomain_landing?: boolean
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          about_text?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_domain?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          organization_id?: string
          redirect_to_custom_domain?: boolean
          show_whatsapp_float?: boolean | null
          site_template?: string
          updated_at?: string | null
          use_custom_domain_url?: boolean
          use_subdomain_landing?: boolean
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_agent_config: {
        Row: {
          agent_name: string
          ai_mode: string
          ai_model: string
          ai_provider: string
          auto_create_leads: boolean
          auto_qualify_leads: boolean
          away_message: string | null
          broker_assignment_mode: string
          byok_api_key: string | null
          cache_updated_at: string | null
          cached_bairros: Json | null
          cached_property_types: Json | null
          followup_ai_prompt: string
          followup_business_hours: Json
          followup_enabled: boolean
          followup_intervals: Json
          followup_max_attempts: number
          followup_template_1: string
          followup_template_3: string
          followup_templates: Json | null
          id: string
          instance_name: string | null
          instance_token: string | null
          is_property_db_enabled: boolean
          max_messages_before_transfer: number
          organization_id: string
          phone_number: string | null
          prompt_create_leads: string | null
          prompt_property_db: string | null
          prompt_qualify_leads: string | null
          prompt_schedule_visits: string | null
          qr_code: string | null
          schedule_visits: boolean
          scheduling_days: string[]
          scheduling_hour_end: string
          scheduling_hour_start: string
          status: string
          system_prompt: string | null
          tone: Database["public"]["Enums"]["agent_tone"]
          transfer_keywords: string[] | null
          transfer_message: string | null
          transfer_phone: string | null
          updated_at: string
          voice_enabled: boolean
          voice_id: string | null
          voice_percentage: number
          webhook_url: string | null
          welcome_ab_test: boolean | null
          welcome_delay_max: number | null
          welcome_delay_min: number | null
          welcome_message: string | null
          welcome_next_index: number
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_name?: string
          ai_mode?: string
          ai_model?: string
          ai_provider?: string
          auto_create_leads?: boolean
          auto_qualify_leads?: boolean
          away_message?: string | null
          broker_assignment_mode?: string
          byok_api_key?: string | null
          cache_updated_at?: string | null
          cached_bairros?: Json | null
          cached_property_types?: Json | null
          followup_ai_prompt?: string
          followup_business_hours?: Json
          followup_enabled?: boolean
          followup_intervals?: Json
          followup_max_attempts?: number
          followup_template_1?: string
          followup_template_3?: string
          followup_templates?: Json | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          is_property_db_enabled?: boolean
          max_messages_before_transfer?: number
          organization_id: string
          phone_number?: string | null
          prompt_create_leads?: string | null
          prompt_property_db?: string | null
          prompt_qualify_leads?: string | null
          prompt_schedule_visits?: string | null
          qr_code?: string | null
          schedule_visits?: boolean
          scheduling_days?: string[]
          scheduling_hour_end?: string
          scheduling_hour_start?: string
          status?: string
          system_prompt?: string | null
          tone?: Database["public"]["Enums"]["agent_tone"]
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_phone?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_id?: string | null
          voice_percentage?: number
          webhook_url?: string | null
          welcome_ab_test?: boolean | null
          welcome_delay_max?: number | null
          welcome_delay_min?: number | null
          welcome_message?: string | null
          welcome_next_index?: number
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_name?: string
          ai_mode?: string
          ai_model?: string
          ai_provider?: string
          auto_create_leads?: boolean
          auto_qualify_leads?: boolean
          away_message?: string | null
          broker_assignment_mode?: string
          byok_api_key?: string | null
          cache_updated_at?: string | null
          cached_bairros?: Json | null
          cached_property_types?: Json | null
          followup_ai_prompt?: string
          followup_business_hours?: Json
          followup_enabled?: boolean
          followup_intervals?: Json
          followup_max_attempts?: number
          followup_template_1?: string
          followup_template_3?: string
          followup_templates?: Json | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          is_property_db_enabled?: boolean
          max_messages_before_transfer?: number
          organization_id?: string
          phone_number?: string | null
          prompt_create_leads?: string | null
          prompt_property_db?: string | null
          prompt_qualify_leads?: string | null
          prompt_schedule_visits?: string | null
          qr_code?: string | null
          schedule_visits?: boolean
          scheduling_days?: string[]
          scheduling_hour_end?: string
          scheduling_hour_start?: string
          status?: string
          system_prompt?: string | null
          tone?: Database["public"]["Enums"]["agent_tone"]
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_phone?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_id?: string | null
          voice_percentage?: number
          webhook_url?: string | null
          welcome_ab_test?: boolean | null
          welcome_delay_max?: number | null
          welcome_delay_min?: number | null
          welcome_message?: string | null
          welcome_next_index?: number
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_ai_usage: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          message_id: string | null
          message_type: string
          organization_id: string
          processed_at: string
          remote_jid: string
          steps: Json
          total_cost_brl: number
          total_cost_usd: number
          total_input_tokens: number
          total_output_tokens: number
          voice_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          message_id?: string | null
          message_type?: string
          organization_id: string
          processed_at?: string
          remote_jid: string
          steps?: Json
          total_cost_brl?: number
          total_cost_usd?: number
          total_input_tokens?: number
          total_output_tokens?: number
          voice_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          message_id?: string | null
          message_type?: string
          organization_id?: string
          processed_at?: string
          remote_jid?: string
          steps?: Json
          total_cost_brl?: number
          total_cost_usd?: number
          total_input_tokens?: number
          total_output_tokens?: number
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          created_at: string
          estimated_cost_usd: number | null
          from_me: boolean
          id: string
          instance_name: string
          media_url: string | null
          message_id: string | null
          message_text: string | null
          message_type: string | null
          organization_id: string
          phone: string | null
          remote_jid: string
          sender_type: string
          timestamp: string
          tokens_input: number | null
          tokens_output: number | null
          tokens_total: number | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          from_me?: boolean
          id?: string
          instance_name: string
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          organization_id: string
          phone?: string | null
          remote_jid: string
          sender_type?: string
          timestamp?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          from_me?: boolean
          id?: string
          instance_name?: string
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          organization_id?: string
          phone?: string | null
          remote_jid?: string
          sender_type?: string
          timestamp?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_property_rules: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          property_id: string
          rule_type: Database["public"]["Enums"]["property_rule_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          property_id: string
          rule_type: Database["public"]["Enums"]["property_rule_type"]
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          rule_type?: Database["public"]["Enums"]["property_rule_type"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_property_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_property_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_property_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_property_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_property_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      whatsapp_welcome_log: {
        Row: {
          created_at: string
          had_dialogue: boolean
          id: string
          last_activity_at: string | null
          organization_id: string
          phone: string
          replied: boolean | null
          responded_at: string | null
          response_count: number
          sent_at: string
          welcome_message_id: string | null
        }
        Insert: {
          created_at?: string
          had_dialogue?: boolean
          id?: string
          last_activity_at?: string | null
          organization_id: string
          phone: string
          replied?: boolean | null
          responded_at?: string | null
          response_count?: number
          sent_at?: string
          welcome_message_id?: string | null
        }
        Update: {
          created_at?: string
          had_dialogue?: boolean
          id?: string
          last_activity_at?: string | null
          organization_id?: string
          phone?: string
          replied?: boolean | null
          responded_at?: string | null
          response_count?: number
          sent_at?: string
          welcome_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_welcome_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_welcome_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_welcome_log_welcome_message_id_fkey"
            columns: ["welcome_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_welcome_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_welcome_messages: {
        Row: {
          campaign_tag: string | null
          created_at: string
          id: string
          is_active: boolean
          media_type: string | null
          media_url: string | null
          message: string
          organization_id: string
          position: number
          reply_count: number | null
          reply_rate: number | null
          target_audience: string | null
          time_period: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          campaign_tag?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          message: string
          organization_id: string
          position?: number
          reply_count?: number | null
          reply_rate?: number | null
          target_audience?: string | null
          time_period?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          campaign_tag?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          message?: string
          organization_id?: string
          position?: number
          reply_count?: number | null
          reply_rate?: number | null
          target_audience?: string | null
          time_period?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_welcome_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_welcome_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      zone_codes: {
        Row: {
          city_code_id: string | null
          code: string
          created_at: string | null
          id: string
          name: string
          neighborhoods: string[] | null
          organization_id: string | null
        }
        Insert: {
          city_code_id?: string | null
          code: string
          created_at?: string | null
          id?: string
          name: string
          neighborhoods?: string[] | null
          organization_id?: string | null
        }
        Update: {
          city_code_id?: string | null
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          neighborhoods?: string[] | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_codes_city_code_id_fkey"
            columns: ["city_code_id"]
            isOneToOne: false
            referencedRelation: "city_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
    }
    Views: {
      ad_accounts_safe: {
        Row: {
          created_at: string | null
          external_account_id: string | null
          id: string | null
          is_active: boolean | null
          is_connected: boolean | null
          name: string | null
          organization_id: string | null
          provider: Database["public"]["Enums"]["ad_provider"] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_account_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_connected?: never
          name?: string | null
          organization_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_account_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_connected?: never
          name?: string | null
          organization_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_properties_view: {
        Row: {
          ai_blacklist: boolean | null
          area_total: number | null
          area_util: number | null
          bairro: string | null
          banheiros: number | null
          cidade: string | null
          codigo: string | null
          comodidades: string[] | null
          complemento: string | null
          condicao: Database["public"]["Enums"]["property_condition"] | null
          condominio: number | null
          descricao: string | null
          destaque: boolean | null
          disponibilidade: string | null
          distancia_praia_metros: number | null
          empreendimento: string | null
          estado: string | null
          fase_lancamento: Database["public"]["Enums"]["launch_stage"] | null
          id: string | null
          iptu_mensal: number | null
          numero: string | null
          opcoes_pagamento: string[] | null
          organization_id: string | null
          preco_aluguel: number | null
          preco_venda: number | null
          quartos: number | null
          rua: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          suites: number | null
          tipo_imovel: string | null
          tipo_transacao: Database["public"]["Enums"]["transaction_type"] | null
          titulo: string | null
          updated_at: string | null
          vagas: number | null
          video_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ai_router_providers_safe: {
        Row: {
          api_base_url: string | null
          consecutive_errors: number | null
          created_at: string | null
          display_name: string | null
          env_secret_name: string | null
          has_api_key: boolean | null
          id: string | null
          is_active: boolean | null
          is_free: boolean | null
          last_error_at: string | null
          model_id: string | null
          notes: string | null
          priority: number | null
          provider_key: string | null
          provider_type: string | null
          rate_limit_rpd: number | null
          rate_limit_rpm: number | null
          supports_image_input: boolean | null
          supports_image_output: boolean | null
        }
        Insert: {
          api_base_url?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          display_name?: string | null
          env_secret_name?: string | null
          has_api_key?: never
          id?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          last_error_at?: string | null
          model_id?: string | null
          notes?: string | null
          priority?: number | null
          provider_key?: string | null
          provider_type?: string | null
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          supports_image_input?: boolean | null
          supports_image_output?: boolean | null
        }
        Update: {
          api_base_url?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          display_name?: string | null
          env_secret_name?: string | null
          has_api_key?: never
          id?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          last_error_at?: string | null
          model_id?: string | null
          notes?: string | null
          priority?: number | null
          provider_key?: string | null
          provider_type?: string | null
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          supports_image_input?: boolean | null
          supports_image_output?: boolean | null
        }
        Relationships: []
      }
      marketplace_properties_public: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          description: string | null
          external_code: string | null
          id: string | null
          images: string[] | null
          is_featured: boolean | null
          marketplace_contact_phone: string | null
          organization_id: string | null
          parking_spots: number | null
          payment_options: string[] | null
          property_type_id: string | null
          rent_price: number | null
          sale_price: number | null
          sale_price_financed: number | null
          status: string | null
          suites: number | null
          title: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_whatsapp_ai_costs_daily: {
        Row: {
          audio_messages: number | null
          date: string | null
          image_messages: number | null
          organization_id: string | null
          total_cost_brl: number | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_messages: number | null
          total_output_tokens: number | null
          voice_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_whatsapp_ai_costs_monthly: {
        Row: {
          avg_cost_per_message: number | null
          month: string | null
          organization_id: string | null
          total_cost_brl: number | null
          total_cost_usd: number | null
          total_messages: number | null
          unique_contacts: number | null
          voice_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_whatsapp_ai_costs_per_conversation: {
        Row: {
          first_message_at: string | null
          instance_name: string | null
          last_message_at: string | null
          organization_id: string | null
          remote_jid: string | null
          total_cost_brl: number | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_messages: number | null
          total_output_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_whatsapp_ai_costs_per_message: {
        Row: {
          id: string | null
          instance_name: string | null
          message_type: string | null
          organization_id: string | null
          processed_at: string | null
          remote_jid: string | null
          steps: Json | null
          total_cost_brl: number | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          voice_enabled: boolean | null
        }
        Insert: {
          id?: string | null
          instance_name?: string | null
          message_type?: string | null
          organization_id?: string | null
          processed_at?: string | null
          remote_jid?: string | null
          steps?: Json | null
          total_cost_brl?: number | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          voice_enabled?: boolean | null
        }
        Update: {
          id?: string | null
          instance_name?: string | null
          message_type?: string | null
          organization_id?: string | null
          processed_at?: string | null
          remote_jid?: string | null
          steps?: Json | null
          total_cost_brl?: number | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          voice_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_whatsapp_ai_top_conversations: {
        Row: {
          last_activity: string | null
          organization_id: string | null
          remote_jid: string | null
          total_cost_brl: number | null
          total_cost_usd: number | null
          total_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      vw_landing_links_without_contact: {
        Row: {
          broker_id: string | null
          broker_name: string | null
          broker_phone: string | null
          broker_token: string | null
          org_name: string | null
          organization_id: string | null
          property_id: string | null
          share_link_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "ai_properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_share_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_status_drift"
            referencedColumns: ["property_id"]
          },
        ]
      }
      vw_marketplace_orgs_missing_contact: {
        Row: {
          has_profile_with_phone: boolean | null
          marketplace_properties_count: number | null
          org_phone: string | null
          organization_id: string | null
          organization_name: string | null
        }
        Relationships: []
      }
      vw_marketplace_status_drift: {
        Row: {
          marketplace_status:
            | Database["public"]["Enums"]["property_status"]
            | null
          marketplace_updated_at: string | null
          organization_id: string | null
          property_id: string | null
          property_status: Database["public"]["Enums"]["property_status"] | null
          property_updated_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_ai_cost_per_conversation: {
        Row: {
          ai_messages: number | null
          first_message: string | null
          last_message: string | null
          organization_id: string | null
          remote_jid: string | null
          total_cost_usd: number | null
          total_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_ai_cost_summary: {
        Row: {
          ai_messages: number | null
          ai_model: string | null
          ai_provider: string | null
          month: string | null
          organization_id: string | null
          total_cost_usd: number | null
          total_tokens: number | null
          total_tokens_input: number | null
          total_tokens_output: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      whatsapp_contacts_followup_view: {
        Row: {
          attempt_count: number | null
          conversation_context: string | null
          display_name: string | null
          followup_id: string | null
          followup_last_inbound: string | null
          followup_last_outbound: string | null
          followup_status: string | null
          last_from_me: boolean | null
          last_message_at: string | null
          last_message_text: string | null
          last_sender_type: string | null
          next_followup_at: string | null
          opted_out: boolean | null
          organization_id: string | null
          property_interest: string | null
          remote_jid: string | null
          total_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "vw_marketplace_orgs_missing_contact"
            referencedColumns: ["organization_id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_invite_id: string; p_user_email: string; p_user_id: string }
        Returns: Json
      }
      add_ai_credits: {
        Args: {
          p_amount_usd: number
          p_description?: string
          p_organization_id: string
        }
        Returns: Json
      }
      add_automation_credits: {
        Args: {
          p_amount_brl: number
          p_description?: string
          p_organization_id: string
          p_type?: string
        }
        Returns: Json
      }
      admin_get_growth_metrics: { Args: never; Returns: Json }
      admin_get_org_metrics: { Args: never; Returns: Json }
      admin_get_org_usage: { Args: never; Returns: Json }
      admin_get_properties_by_status: { Args: never; Returns: Json }
      admin_get_system_health: { Args: never; Returns: Json }
      admin_get_table_counts: { Args: never; Returns: Json }
      admin_get_table_sizes: { Args: never; Returns: Json }
      ai_buscar_imoveis: {
        Args: {
          area_min?: number
          bairro?: string
          limite?: number
          org_id: string
          preco_max?: number
          preco_min?: number
          quartos_min?: number
          tipo_imovel?: string
          transacao?: string
          vagas_min?: number
        }
        Returns: Json
      }
      ai_buscar_por_codigo: {
        Args: { codigo: string; org_id: string }
        Returns: Json
      }
      ai_detalhes_imovel: {
        Args: { imovel_id: string; org_id: string }
        Returns: Json
      }
      ai_listar_opcoes: { Args: { org_id: string }; Returns: Json }
      assert_import_run_access: {
        Args: { p_run_id: string; p_user_id: string }
        Returns: boolean
      }
      assign_conversation_owner: {
        Args: { p_assignee_id: string; p_conversation_id: string }
        Returns: string
      }
      backfill_omnichannel_from_whatsapp: {
        Args: { p_batch_size?: number; p_org_id?: string }
        Returns: Json
      }
      calculate_ai_cost: {
        Args: {
          p_model: string
          p_provider: string
          p_tokens_input: number
          p_tokens_output: number
        }
        Returns: number
      }
      can_access_marketplace: { Args: { org_id: string }; Returns: boolean }
      can_access_partnerships: { Args: { org_id: string }; Returns: boolean }
      check_ai_budget: {
        Args: { p_estimated_cost?: number; p_org_id: string }
        Returns: Json
      }
      check_signup_duplicates: {
        Args: { p_document: string; p_email: string; p_phone: string }
        Returns: Json
      }
      claim_import_chunk: {
        Args: { p_chunk_size: number; p_run_id: string }
        Returns: string[]
      }
      cleanup_expired_import_tokens: { Args: never; Returns: number }
      cleanup_expired_webauthn_challenges: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      cleanup_old_whatsapp_media: { Args: never; Returns: undefined }
      complete_onboarding: {
        Args: {
          p_account_type: string
          p_company_name: string
          p_phone: string
          p_plan_slug: string
        }
        Returns: Json
      }
      consume_import_token: {
        Args: { p_org_id: string; p_property_id: string; p_token: string }
        Returns: boolean
      }
      consume_marketplace_intent: {
        Args: {
          p_consumer_phone: string
          p_organization_id: string
          p_target_phone: string
        }
        Returns: Json
      }
      count_amenity_usage: { Args: { p_name: string }; Returns: number }
      count_new_ad_leads: {
        Args: { p_external_ad_id?: string; p_organization_id: string }
        Returns: number
      }
      create_default_document_templates: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      create_trial_subscription: { Args: { org_id: string }; Returns: string }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      deduct_ai_credits: {
        Args: {
          p_description?: string
          p_markup_multiplier?: number
          p_model: string
          p_organization_id: string
          p_provider: string
          p_raw_cost_usd: number
          p_tokens_input: number
          p_tokens_output: number
        }
        Returns: Json
      }
      deduct_automation_credits: {
        Args: {
          p_model: string
          p_organization_id: string
          p_provider: string
          p_raw_cost_usd?: number
          p_tokens_input?: number
          p_tokens_output?: number
          p_usd_to_brl_rate?: number
        }
        Returns: Json
      }
      delete_property_cascade: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      dev_force_publish_v2: { Args: { p_org_id: string }; Returns: undefined }
      dev_list_org_rollout_status: {
        Args: never
        Returns: {
          editor_mode: string
          has_draft_v2: boolean
          has_published_v1: boolean
          has_published_v2: boolean
          org_id: string
          org_name: string
          site_template: string
        }[]
      }
      dev_save_draft_v2: {
        Args: { p_layout: Json; p_org_id: string }
        Returns: undefined
      }
      dev_set_editor_mode: {
        Args: { p_mode: string; p_org_id: string }
        Returns: undefined
      }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      fix_user_without_organization: {
        Args: { p_email: string; p_full_name?: string; p_user_id: string }
        Returns: string
      }
      fn_agent_ranking: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: Json
      }
      fn_dashboard_stats: { Args: { p_org_id: string }; Returns: Json }
      fn_funnel_detail: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: Json
      }
      fn_kpi_metrics: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: Json
      }
      fn_pipeline_summary: { Args: { p_org_id: string }; Returns: Json }
      generate_contract_code: { Args: { p_org_id: string }; Returns: string }
      generate_property_code: {
        Args: {
          p_city?: string
          p_neighborhood?: string
          p_organization_id?: string
          p_property_type_id?: string
          p_state?: string
        }
        Returns: string
      }
      get_current_user_role: { Args: never; Returns: string }
      get_invite_for_acceptance: {
        Args: { p_invite_id: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          org_name: string
          organization_id: string
          role: string
          status: string
        }[]
      }
      get_landing_contact: {
        Args: { p_broker_token?: string; p_property_id: string }
        Returns: {
          attribution_source: string
          broker_avatar: string
          broker_email: string
          broker_name: string
          broker_phone: string
          org_logo: string
          org_name: string
          org_phone: string
        }[]
      }
      get_marketplace_contact: {
        Args: { p_property_id: string }
        Returns: Json
      }
      get_marketplace_properties_public: {
        Args: never
        Returns: {
          address_city: string
          address_complement: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          address_zipcode: string
          amenities: string[]
          area_built: number
          area_total: number
          bathrooms: number
          bedrooms: number
          created_at: string
          description: string
          external_code: string
          id: string
          images: string[]
          is_featured: boolean
          marketplace_contact_phone: string
          organization_id: string
          parking_spots: number
          payment_options: string[]
          property_type_id: string
          rent_price: number
          sale_price: number
          sale_price_financed: number
          status: string
          suites: number
          title: string
          transaction_type: string
          updated_at: string
        }[]
      }
      get_marketplace_properties_safe: {
        Args: { p_organization_id: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          address_zipcode: string
          amenities: string[]
          area_built: number
          area_total: number
          bathrooms: number
          bedrooms: number
          commission_percentage: number
          created_at: string
          description: string
          external_code: string
          id: string
          images: string[]
          is_featured: boolean
          organization_id: string
          parking_spots: number
          property_type_id: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          suites: number
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }[]
      }
      get_org_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          id: string
          invite_code: string
          name: string
        }[]
      }
      get_org_member_emails: {
        Args: { org_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_org_name_for_invite: {
        Args: { p_invite_id: string }
        Returns: string
      }
      get_platform_invite: {
        Args: { p_invite_id: string }
        Returns: {
          expires_at: string
          id: string
          invite_email: string
          name: string
          status: string
        }[]
      }
      get_property_cities: {
        Args: { p_organization_id: string }
        Returns: {
          city: string
          count: number
          state: string
        }[]
      }
      get_property_id_by_org_code: {
        Args: { p_code: string; p_org_slug: string }
        Returns: string
      }
      get_property_neighborhoods: {
        Args: { p_organization_id: string }
        Returns: {
          city: string
          count: number
          neighborhood: string
        }[]
      }
      get_property_type_name: { Args: { p_type_id: string }; Returns: string }
      get_public_brand_settings: {
        Args: { p_org_id: string }
        Returns: {
          accent_color: string
          font_family: string
          logo_dark_url: string
          logo_url: string
          primary_color: string
          secondary_color: string
          slogan: string
          tagline: string
        }[]
      }
      get_public_org_by_id: {
        Args: { p_org_id: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      get_public_org_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      get_public_property: {
        Args: { p_id: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          address_state: string
          amenities: string[]
          area_built: number
          area_total: number
          area_useful: number
          bathrooms: number
          bedrooms: number
          condominium_fee: number
          created_at: string
          description: string
          development_name: string
          featured: boolean
          floor: number
          id: string
          iptu: number
          iptu_monthly: number
          latitude: number
          launch_stage: Database["public"]["Enums"]["launch_stage"]
          longitude: number
          organization_id: string
          parking_spots: number
          payment_options: string[]
          property_condition: Database["public"]["Enums"]["property_condition"]
          property_type_id: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          suites: number
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          youtube_url: string
        }[]
      }
      get_public_property_by_org_code: {
        Args: { p_org_slug: string; p_property_code: string }
        Returns: Json
      }
      get_public_property_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_public_property_images: {
        Args: { p_property_id: string }
        Returns: {
          cached_thumbnail_url: string
          display_order: number
          id: string
          image_type: Database["public"]["Enums"]["property_image_type"]
          is_cover: boolean
          r2_key_full: string
          r2_key_thumb: string
          source: string
          storage_provider: string
          url: string
        }[]
      }
      get_public_property_media: {
        Args: { p_property_id: string }
        Returns: {
          display_order: number
          id: string
          kind: string
          original_url: string
          stored_url: string
        }[]
      }
      get_public_site_document: { Args: { p_org_id: string }; Returns: Json }
      get_public_site_document_full: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_public_tenant_by_domain: {
        Args: { p_hostname: string }
        Returns: Json
      }
      get_public_tenant_redirect: { Args: { p_org_id: string }; Returns: Json }
      get_schema_column_types: {
        Args: never
        Returns: {
          column_name: string
          table_name: string
          udt_name: string
        }[]
      }
      get_schema_enums: {
        Args: never
        Returns: {
          enum_name: string
          enum_values: string[]
        }[]
      }
      get_schema_fk_constraints: {
        Args: never
        Returns: {
          constraint_sql: string
          source_table: string
          target_table: string
        }[]
      }
      get_schema_functions: {
        Args: never
        Returns: {
          func_def: string
          func_name: string
        }[]
      }
      get_schema_indexes: {
        Args: never
        Returns: {
          index_def: string
        }[]
      }
      get_schema_policies: {
        Args: never
        Returns: {
          policy_def: string
        }[]
      }
      get_schema_rls_tables: {
        Args: never
        Returns: {
          rls_enabled: boolean
          table_name: string
        }[]
      }
      get_schema_tables_ddl: {
        Args: never
        Returns: {
          ddl: string
          table_name: string
        }[]
      }
      get_schema_triggers: {
        Args: never
        Returns: {
          trigger_def: string
        }[]
      }
      get_subscription_plan_id: { Args: { org_id: string }; Returns: string }
      get_subscription_plan_slug: { Args: { org_id: string }; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_whatsapp_ai_cost_summary: {
        Args: { p_organization_id: string; p_period?: string }
        Returns: Json
      }
      has_active_subscription: { Args: { org_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_import_run_progress: {
        Args: {
          p_errors?: number
          p_images_processed?: number
          p_imported?: number
          p_run_id: string
        }
        Returns: undefined
      }
      insert_audit_event: {
        Args: {
          p_acting_role?: string
          p_action?: string
          p_action_category?: string
          p_changed_fields?: string[]
          p_description?: string
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_module?: string
          p_new_values?: Json
          p_old_values?: Json
          p_organization_id?: string
          p_parent_entity_id?: string
          p_parent_entity_type?: string
          p_request_id?: string
          p_risk_level?: string
          p_route?: string
          p_session_id?: string
          p_source?: string
          p_status?: string
          p_target_user_id?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      insert_notification: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_organization_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_maintenance_blocked: { Args: never; Returns: boolean }
      is_member_of_org: { Args: { _org_id: string }; Returns: boolean }
      is_org_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_manager: { Args: { _user_id: string }; Returns: boolean }
      is_org_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_phone_available: { Args: { p_phone: string }; Returns: boolean }
      is_session_valid: { Args: { p_session_token: string }; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
      log_bulk_operation: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_ids: string[]
          p_entity_type: string
          p_org_id: string
        }
        Returns: string
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_read_at?: string }
        Returns: undefined
      }
      normalize_location_text: { Args: { val: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      normalize_phone_br_e164: { Args: { p: string }; Returns: string }
      notify_marketplace_interest: {
        Args: {
          p_consumer_name?: string
          p_consumer_phone?: string
          p_message?: string
          p_property_id: string
        }
        Returns: Json
      }
      org_has_active_subscription: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      rebuild_provider_chains: { Args: never; Returns: undefined }
      refresh_agent_config_cache: {
        Args: { org_id: string }
        Returns: undefined
      }
      register_session: {
        Args: {
          p_device_info?: string
          p_device_type?: string
          p_ip_address?: string
          p_session_token: string
        }
        Returns: Json
      }
      remove_amenity_from_properties: {
        Args: { p_name: string }
        Returns: number
      }
      resolve_itbi: {
        Args: { p_ibge: string; p_org: string; p_uf: string }
        Returns: {
          confidence: string
          ibge_code: string
          rule: Json
          rule_version: number
          source: string
          source_label: string
          source_url: string
          uf: string
        }[]
      }
      search_properties_advanced:
        | {
            Args: {
              p_amenities?: string[]
              p_cities?: string[]
              p_city?: string
              p_launch_stage?: string
              p_limit?: number
              p_max_area?: number
              p_max_beach_distance?: number
              p_max_condominium?: number
              p_max_price?: number
              p_min_area?: number
              p_min_bedrooms?: number
              p_min_condominium?: number
              p_min_parking?: number
              p_min_price?: number
              p_min_suites?: number
              p_neighborhood?: string
              p_neighborhoods?: string[]
              p_offset?: number
              p_organization_id: string
              p_property_code?: string
              p_property_condition?: string
              p_property_type_id?: string
              p_search_text?: string
              p_status?: string
              p_transaction_type?: string
            }
            Returns: {
              address_city: string
              address_neighborhood: string
              address_state: string
              area_built: number
              area_total: number
              bathrooms: number
              beach_distance_meters: number
              bedrooms: number
              cover_image_url: string
              created_at: string
              description: string
              id: string
              parking_spots: number
              property_code: string
              property_type_id: string
              rent_price: number
              sale_price: number
              status: Database["public"]["Enums"]["property_status"]
              title: string
              transaction_type: Database["public"]["Enums"]["transaction_type"]
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_amenities?: string[]
              p_cities?: string[]
              p_city?: string
              p_launch_stage?: string
              p_limit?: number
              p_max_area?: number
              p_max_beach_distance?: number
              p_max_condominium?: number
              p_max_price?: number
              p_min_area?: number
              p_min_bedrooms?: number
              p_min_condominium?: number
              p_min_parking?: number
              p_min_price?: number
              p_min_suites?: number
              p_neighborhood?: string
              p_neighborhoods?: string[]
              p_offset?: number
              p_organization_id: string
              p_property_code?: string
              p_property_condition?: string
              p_property_type_id?: string
              p_search_text?: string
              p_sort_by?: string
              p_status?: string
              p_transaction_type?: string
            }
            Returns: {
              address_city: string
              address_neighborhood: string
              address_state: string
              area_built: number
              area_total: number
              bathrooms: number
              beach_distance_meters: number
              bedrooms: number
              cover_image_url: string
              created_at: string
              description: string
              id: string
              parking_spots: number
              property_code: string
              property_type_id: string
              rent_price: number
              sale_price: number
              status: string
              title: string
              total_count: number
              transaction_type: string
              updated_at: string
            }[]
          }
      search_properties_by_code: {
        Args: {
          p_code_prefix: string
          p_limit?: number
          p_organization_id: string
        }
        Returns: {
          address_city: string
          address_neighborhood: string
          cover_image_url: string
          id: string
          property_code: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          title: string
        }[]
      }
      search_properties_fuzzy: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          id: string
          property_code: string
          similarity_score: number
          title: string
        }[]
      }
      search_properties_nearby: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_organization_id: string
          p_radius_km?: number
        }
        Returns: {
          cover_image_url: string
          distance_km: number
          id: string
          latitude: number
          longitude: number
          property_code: string
          rent_price: number
          sale_price: number
          title: string
        }[]
      }
      seed_default_amenities: { Args: { org_id: string }; Returns: undefined }
      seed_org_lead_stages: { Args: { p_org_id: string }; Returns: undefined }
      seed_org_lead_types: { Args: { p_org_id: string }; Returns: undefined }
      session_heartbeat: { Args: { p_session_token: string }; Returns: boolean }
      slugify: { Args: { val: string }; Returns: string }
      track_ai_spend: {
        Args: { p_cost_usd: number; p_org_id: string }
        Returns: undefined
      }
      upsert_ai_router_stats: {
        Args: {
          p_cost_usd: number
          p_is_429: boolean
          p_latency_ms: number
          p_provider_key: string
          p_success: boolean
          p_task_type: string
          p_tokens_in: number
          p_tokens_out: number
        }
        Returns: undefined
      }
      validate_invite_org_code: {
        Args: { p_code: string; p_org_id: string }
        Returns: boolean
      }
      validate_sync_queue: {
        Args: { p_organization_id: string; p_source_provider?: string }
        Returns: Json
      }
    }
    Enums: {
      ad_entity_type: "campaign" | "adset" | "ad"
      ad_lead_status:
        | "new"
        | "read"
        | "sent_to_crm"
        | "send_failed"
        | "archived"
      ad_provider: "meta" | "google"
      agent_tone: "formal" | "informal" | "tecnico"
      app_role:
        | "admin"
        | "corretor"
        | "assistente"
        | "developer"
        | "leader"
        | "sub_admin"
        | "atendente"
        | "desenvolvedor"
      billing_cycle: "monthly" | "yearly"
      channel_type:
        | "whatsapp"
        | "instagram"
        | "messenger"
        | "facebook_comments"
        | "sms"
        | "email"
        | "webchat"
      commission_type: "valor" | "percentual"
      contract_status: "rascunho" | "ativo" | "encerrado" | "cancelado"
      contract_type: "venda" | "locacao"
      conversation_status:
        | "open"
        | "pending"
        | "assigned"
        | "snoozed"
        | "closed"
      financial_transaction_type: "receita" | "despesa"
      interaction_type:
        | "ligacao"
        | "email"
        | "visita"
        | "whatsapp"
        | "reuniao"
        | "nota"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invoice_status: "pendente" | "pago" | "atrasado" | "cancelado"
      launch_stage: "nenhum" | "em_construcao" | "pronto" | "futuro"
      lead_stage:
        | "novo"
        | "contato"
        | "visita"
        | "proposta"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      message_direction: "inbound" | "outbound"
      message_sender_type: "customer" | "agent" | "ai" | "system"
      organization_type: "imobiliaria" | "corretor_individual"
      partnership_status: "pending" | "active" | "rejected" | "expired"
      property_condition: "novo" | "usado"
      property_image_type: "photo" | "floor_plan" | "floor_plan_secondary"
      property_rule_type: "whitelist" | "blacklist" | "highlight"
      property_status:
        | "disponivel"
        | "reservado"
        | "vendido"
        | "alugado"
        | "inativo"
        | "com_proposta"
        | "suspenso"
      property_visibility_type: "private" | "partners_only" | "public"
      subscription_status:
        | "trial"
        | "active"
        | "cancelled"
        | "suspended"
        | "expired"
        | "overdue"
        | "pending"
      transaction_type: "venda" | "aluguel" | "ambos"
      visit_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
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
      ad_entity_type: ["campaign", "adset", "ad"],
      ad_lead_status: ["new", "read", "sent_to_crm", "send_failed", "archived"],
      ad_provider: ["meta", "google"],
      agent_tone: ["formal", "informal", "tecnico"],
      app_role: [
        "admin",
        "corretor",
        "assistente",
        "developer",
        "leader",
        "sub_admin",
        "atendente",
        "desenvolvedor",
      ],
      billing_cycle: ["monthly", "yearly"],
      channel_type: [
        "whatsapp",
        "instagram",
        "messenger",
        "facebook_comments",
        "sms",
        "email",
        "webchat",
      ],
      commission_type: ["valor", "percentual"],
      contract_status: ["rascunho", "ativo", "encerrado", "cancelado"],
      contract_type: ["venda", "locacao"],
      conversation_status: ["open", "pending", "assigned", "snoozed", "closed"],
      financial_transaction_type: ["receita", "despesa"],
      interaction_type: [
        "ligacao",
        "email",
        "visita",
        "whatsapp",
        "reuniao",
        "nota",
      ],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invoice_status: ["pendente", "pago", "atrasado", "cancelado"],
      launch_stage: ["nenhum", "em_construcao", "pronto", "futuro"],
      lead_stage: [
        "novo",
        "contato",
        "visita",
        "proposta",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      message_direction: ["inbound", "outbound"],
      message_sender_type: ["customer", "agent", "ai", "system"],
      organization_type: ["imobiliaria", "corretor_individual"],
      partnership_status: ["pending", "active", "rejected", "expired"],
      property_condition: ["novo", "usado"],
      property_image_type: ["photo", "floor_plan", "floor_plan_secondary"],
      property_rule_type: ["whitelist", "blacklist", "highlight"],
      property_status: [
        "disponivel",
        "reservado",
        "vendido",
        "alugado",
        "inativo",
        "com_proposta",
        "suspenso",
      ],
      property_visibility_type: ["private", "partners_only", "public"],
      subscription_status: [
        "trial",
        "active",
        "cancelled",
        "suspended",
        "expired",
        "overdue",
        "pending",
      ],
      transaction_type: ["venda", "aluguel", "ambos"],
      visit_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
    },
  },
} as const
