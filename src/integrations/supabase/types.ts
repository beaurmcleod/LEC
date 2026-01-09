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
      coupons: {
        Row: {
          applies_to_all: boolean
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          product_ids: string[] | null
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          product_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          product_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      download_tokens: {
        Row: {
          created_at: string | null
          customer_email: string
          download_count: number
          expires_at: string
          id: string
          max_downloads: number
          product_id: string
          token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          download_count?: number
          expires_at: string
          id?: string
          max_downloads?: number
          product_id: string
          token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          product_id?: string
          token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reminders: {
        Row: {
          created_at: string
          customer_email: string
          duration_minutes: number
          id: string
          lesson_date: string
          lesson_start_utc: string
          lesson_time: string
          lesson_title: string
          reminder_sent: boolean
          reminder_time: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          duration_minutes: number
          id?: string
          lesson_date: string
          lesson_start_utc: string
          lesson_time: string
          lesson_title: string
          reminder_sent?: boolean
          reminder_time: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          duration_minutes?: number
          id?: string
          lesson_date?: string
          lesson_start_utc?: string
          lesson_time?: string
          lesson_title?: string
          reminder_sent?: boolean
          reminder_time?: string
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          clicked_at: string
          created_at: string
          id: string
          link_title: string
          link_url: string
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          created_at?: string
          id?: string
          link_title: string
          link_url: string
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          created_at?: string
          id?: string
          link_title?: string
          link_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_downloads: {
        Row: {
          created_at: string | null
          download_path: string | null
          download_url: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          download_path?: string | null
          download_url: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          download_path?: string | null
          download_url?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bpm: string | null
          category: string
          created_at: string | null
          features: string[] | null
          full_description: string | null
          id: string
          image: string
          is_on_sale: boolean | null
          key: string | null
          original_price: string | null
          price: string
          short_description: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bpm?: string | null
          category: string
          created_at?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          image: string
          is_on_sale?: boolean | null
          key?: string | null
          original_price?: string | null
          price: string
          short_description?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bpm?: string | null
          category?: string
          created_at?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          image?: string
          is_on_sale?: boolean | null
          key?: string | null
          original_price?: string | null
          price?: string
          short_description?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_paid: number
          created_at: string | null
          customer_email: string
          id: string
          product_id: string
          purchased_at: string | null
          stripe_payment_id: string
          user_id: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          customer_email: string
          id?: string
          product_id: string
          purchased_at?: string | null
          stripe_payment_id: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          customer_email?: string
          id?: string
          product_id?: string
          purchased_at?: string | null
          stripe_payment_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      products_public: {
        Row: {
          bpm: string | null
          category: string | null
          created_at: string | null
          features: string[] | null
          full_description: string | null
          id: string | null
          image: string | null
          is_on_sale: boolean | null
          key: string | null
          original_price: string | null
          price: string | null
          short_description: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          bpm?: string | null
          category?: string | null
          created_at?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string | null
          image?: string | null
          is_on_sale?: boolean | null
          key?: string | null
          original_price?: string | null
          price?: string | null
          short_description?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          bpm?: string | null
          category?: string | null
          created_at?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string | null
          image?: string | null
          is_on_sale?: boolean | null
          key?: string | null
          original_price?: string | null
          price?: string | null
          short_description?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      get_download_url: { Args: { product_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_own_profile: { Args: { profile_id: string }; Returns: boolean }
      owns_download_token: { Args: { token_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
