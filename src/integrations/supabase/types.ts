// =====================================================
// Solar Panel Comparison App - TypeScript Types Export (Regenerated)
// =====================================================
// This file contains TypeScript type definitions for the database schema
// Generated from Supabase migrations (offline regeneration)
// =====================================================

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      asin_staging: {
        Row: {
          asin: string
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          ingested_at: string | null
          last_attempt_at: string | null
          max_attempts: number | null
          panel_id: string | null
          priority: number | null
          search_id: string | null
          source: string
          source_keyword: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asin: string
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ingested_at?: string | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          panel_id?: string | null
          priority?: number | null
          search_id?: string | null
          source: string
          source_keyword?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asin?: string
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ingested_at?: string | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          panel_id?: string | null
          priority?: number | null
          search_id?: string | null
          source?: string
          source_keyword?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asin_staging_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asin_staging_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "search_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_checks: {
        Row: {
          check_type: string
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          panel_id: string | null
          status: string
        }
        Insert: {
          check_type: string
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          panel_id?: string | null
          status: string
        }
        Update: {
          check_type?: string
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          panel_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_checks_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      filtered_asins: {
        Row: {
          asin: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          filter_reason: string
          filter_stage: string
          id: string
          product_name: string | null
          product_url: string | null
          wattage: number | null
        }
        Insert: {
          asin: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          filter_reason: string
          filter_stage: string
          id?: string
          product_name?: string | null
          product_url?: string | null
          wattage?: number | null
        }
        Update: {
          asin?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          filter_reason?: string
          filter_stage?: string
          id?: string
          product_name?: string | null
          product_url?: string | null
          wattage?: number | null
        }
        Relationships: []
      }
      flagged_panels: {
        Row: {
          admin_note: string | null
          created_at: string | null
          details: string | null
          id: string
          panel_id: string
          reason: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          panel_id: string
          reason: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          panel_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flagged_panels_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string | null
          id: string
          new_price: number
          old_price: number | null
          panel_id: string
          source: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_price: number
          old_price?: number | null
          panel_id: string
          source?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          new_price?: number
          old_price?: number | null
          panel_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_scraper_data: {
        Row: {
          asin: string
          created_at: string | null
          id: string
          panel_id: string | null
          processing_metadata: Json | null
          response_size_bytes: number | null
          scraper_response: Json
          scraper_version: string | null
          updated_at: string | null
        }
        Insert: {
          asin: string
          created_at?: string | null
          id?: string
          panel_id?: string | null
          processing_metadata?: Json | null
          response_size_bytes?: number | null
          scraper_response: Json
          scraper_version?: string | null
          updated_at?: string | null
        }
        Update: {
          asin?: string
          created_at?: string | null
          id?: string
          panel_id?: string | null
          processing_metadata?: Json | null
          response_size_bytes?: number | null
          scraper_response?: Json
          scraper_version?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_scraper_data_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_usage: {
        Row: {
          asin: string | null
          created_at: string | null
          error_message: string | null
          id: string
          response_time_ms: number | null
          script_name: string
          success: boolean
          url: string | null
        }
        Insert: {
          asin?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          script_name: string
          success: boolean
          url?: string | null
        }
        Update: {
          asin?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          script_name?: string
          success?: boolean
          url?: string | null
        }
        Relationships: []
      }
      script_logs: {
        Row: {
          created_at: string | null
          execution_id: string
          id: string
          level: string
          message: string
          metadata: Json | null
          script_name: string
        }
        Insert: {
          created_at?: string | null
          execution_id: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
          script_name: string
        }
        Update: {
          created_at?: string | null
          execution_id?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          script_name?: string
        }
        Relationships: []
      }
      search_keywords: {
        Row: {
          asins_found: string[] | null
          created_at: string | null
          id: string
          keyword: string
          results_count: number | null
          script_name: string | null
          search_metadata: Json | null
          search_type: string | null
        }
        Insert: {
          asins_found?: string[] | null
          created_at?: string | null
          id?: string
          keyword: string
          results_count?: number | null
          script_name?: string | null
          search_metadata?: Json | null
          search_type?: string | null
        }
        Update: {
          asins_found?: string[] | null
          created_at?: string | null
          id?: string
          keyword?: string
          results_count?: number | null
          script_name?: string | null
          search_metadata?: Json | null
          search_type?: string | null
        }
        Relationships: []
      }
      solar_panels: {
        Row: {
          asin: string | null
          created_at: string
          description: string | null
          flag_count: number | null
          id: string
          image_url: string | null
          length_cm: number | null
          manufacturer: string
          manual_overrides: Json | null
          missing_fields: Json | null
          name: string
          pending_flags: number | null
          piece_count: number
          price_usd: number | null
          updated_at: string
          user_verified_overrides: Json | null
          voltage: number | null
          wattage: number | null
          web_url: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          asin?: string | null
          created_at?: string
          description?: string | null
          flag_count?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          manufacturer: string
          manual_overrides?: Json | null
          missing_fields?: Json | null
          name: string
          pending_flags?: number | null
          piece_count?: number
          price_usd?: number | null
          updated_at?: string
          user_verified_overrides?: Json | null
          voltage?: number | null
          wattage?: number | null
          web_url?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          asin?: string | null
          created_at?: string
          description?: string | null
          flag_count?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          manufacturer?: string
          manual_overrides?: Json | null
          missing_fields?: Json | null
          name?: string
          pending_flags?: number | null
          piece_count?: number
          price_usd?: number | null
          updated_at?: string
          user_verified_overrides?: Json | null
          voltage?: number | null
          wattage?: number | null
          web_url?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string | null
          id: string
          is_favorite: boolean | null
          panel_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          panel_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          panel_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flags: {
        Row: {
          admin_note: string | null
          created_at: string | null
          deletion_other_reason: string | null
          deletion_reason: string | null
          flag_type: string | null
          flagged_fields: Json
          id: string
          panel_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          suggested_corrections: Json | null
          updated_at: string | null
          user_comment: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          deletion_other_reason?: string | null
          deletion_reason?: string | null
          flag_type?: string | null
          flagged_fields?: Json
          id?: string
          panel_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_corrections?: Json | null
          updated_at?: string | null
          user_comment?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          deletion_other_reason?: string | null
          deletion_reason?: string | null
          flag_type?: string | null
          flagged_fields?: Json
          id?: string
          panel_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_corrections?: Json | null
          updated_at?: string | null
          user_comment?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_flags_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_panel_preferences: {
        Row: {
          created_at: string | null
          id: string
          is_hidden: boolean | null
          panel_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          panel_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          panel_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_panel_preferences_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "solar_panels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_flag_queue: {
        Row: {
          admin_note: string | null
          created_at: string | null
          deletion_other_reason: string | null
          deletion_reason: string | null
          flag_type: string | null
          flagged_fields: Json | null
          id: string | null
          manufacturer: string | null
          panel_id: string | null
          panel_name: string | null
          price_usd: number | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_email: string | null
          status: string | null
          suggested_corrections: Json | null
          updated_at: string | null
          user_comment: string | null
          user_email: string | null
          user_id: string | null
          wattage: number | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: {
      admin_get_flag_queue: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Views"]["admin_flag_queue"]["Row"][]
      }
      asin_exists: {
        Args: {
          check_asin: string
        }
        Returns: boolean
      }
      extract_asin_from_url: {
        Args: {
          url: string
        }
        Returns: string | null
      }
      get_pending_asins: {
        Args: {
          batch_limit?: number
        }
        Returns: {
          id: string
          asin: string
          source: string
          source_keyword: string | null
          priority: number | null
          attempts: number | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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

// =====================================================
// CONVENIENCE TYPE ALIASES
// =====================================================

// Main table types
export type SolarPanel = Tables<'solar_panels'>
export type SolarPanelInsert = TablesInsert<'solar_panels'>
export type SolarPanelUpdate = TablesUpdate<'solar_panels'>

export type UserFavorite = Tables<'user_favorites'>
export type UserFavoriteInsert = TablesInsert<'user_favorites'>
export type UserFavoriteUpdate = TablesUpdate<'user_favorites'>

export type UserPanelPreference = Tables<'user_panel_preferences'>
export type UserPanelPreferenceInsert = TablesInsert<'user_panel_preferences'>
export type UserPanelPreferenceUpdate = TablesUpdate<'user_panel_preferences'>

export type UserFlag = Tables<'user_flags'>
export type UserFlagInsert = TablesInsert<'user_flags'>
export type UserFlagUpdate = TablesUpdate<'user_flags'>

export type SearchKeyword = Tables<'search_keywords'>
export type SearchKeywordInsert = TablesInsert<'search_keywords'>
export type SearchKeywordUpdate = TablesUpdate<'search_keywords'>

export type AsinStaging = Tables<'asin_staging'>
export type AsinStagingInsert = TablesInsert<'asin_staging'>
export type AsinStagingUpdate = TablesUpdate<'asin_staging'>

export type FilteredAsin = Tables<'filtered_asins'>
export type FilteredAsinInsert = TablesInsert<'filtered_asins'>
export type FilteredAsinUpdate = TablesUpdate<'filtered_asins'>

export type RawScraperData = Tables<'raw_scraper_data'>
export type RawScraperDataInsert = TablesInsert<'raw_scraper_data'>
export type RawScraperDataUpdate = TablesUpdate<'raw_scraper_data'>

export type PriceHistory = Tables<'price_history'>
export type PriceHistoryInsert = TablesInsert<'price_history'>
export type PriceHistoryUpdate = TablesUpdate<'price_history'>

export type FlaggedPanel = Tables<'flagged_panels'>
export type FlaggedPanelInsert = TablesInsert<'flagged_panels'>
export type FlaggedPanelUpdate = TablesUpdate<'flagged_panels'>

export type ScriptLog = Tables<'script_logs'>
export type ScriptLogInsert = TablesInsert<'script_logs'>
export type ScriptLogUpdate = TablesUpdate<'script_logs'>

export type DataQualityCheck = Tables<'data_quality_checks'>
export type DataQualityCheckInsert = TablesInsert<'data_quality_checks'>
export type DataQualityCheckUpdate = TablesUpdate<'data_quality_checks'>

export type ScraperUsage = Tables<'scraper_usage'>
export type ScraperUsageInsert = TablesInsert<'scraper_usage'>
export type ScraperUsageUpdate = TablesUpdate<'scraper_usage'>

export type AdminFlagQueue = Tables<'admin_flag_queue'>

// =====================================================
// UTILITY TYPES
// =====================================================

// Type for solar panel with calculated metrics
export interface SolarPanelWithMetrics extends SolarPanel {
  area_sqm: number
  watts_per_sqm: number
  watts_per_kg: number
  price_per_watt: number
}

// Type for solar panel comparison data
export interface SolarPanelComparison {
  panel: SolarPanel
  metrics: {
    area_sqm: number
    watts_per_sqm: number
    watts_per_kg: number
    price_per_watt: number
  }
}

// Type for user preferences with panel data
export interface UserFavoriteWithPanel extends UserFavorite {
  solar_panel: SolarPanel
}

export interface UserPanelPreferenceWithPanel extends UserPanelPreference {
  solar_panel: SolarPanel
}
