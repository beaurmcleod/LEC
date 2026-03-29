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
      affirmations: {
        Row: {
          artwork_url: string | null
          audio_data: string | null
          audio_url: string | null
          created_at: string
          id: string
          site: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          artwork_url?: string | null
          audio_data?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          site?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          artwork_url?: string | null
          audio_data?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          site?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_content: {
        Row: {
          ai_model_id: string
          content_type: string
          cost_credits: number
          created_at: string
          id: string
          media_url: string | null
          metadata: Json | null
          prompt: string | null
          requested_by: string | null
          status: string
          thumbnail_url: string | null
        }
        Insert: {
          ai_model_id: string
          content_type?: string
          cost_credits?: number
          created_at?: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          prompt?: string | null
          requested_by?: string | null
          status?: string
          thumbnail_url?: string | null
        }
        Update: {
          ai_model_id?: string
          content_type?: string
          cost_credits?: number
          created_at?: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          prompt?: string | null
          requested_by?: string | null
          status?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_ai_model_id_fkey"
            columns: ["ai_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          avatar_url: string | null
          created_at: string
          creator_id: string
          generation_config: Json
          id: string
          is_active: boolean
          model_type: string
          name: string
          persona: string | null
          style_prompt: string | null
          total_generations: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creator_id: string
          generation_config?: Json
          id?: string
          is_active?: boolean
          model_type?: string
          name: string
          persona?: string | null
          style_prompt?: string | null
          total_generations?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creator_id?: string
          generation_config?: Json
          id?: string
          is_active?: boolean
          model_type?: string
          name?: string
          persona?: string | null
          style_prompt?: string | null
          total_generations?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "ai_models_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content: string
          created_at: string
          excerpt: string
          id: string
          meta_description: string
          published_at: string
          read_time: string
          slug: string
          tags: string[]
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          excerpt: string
          id?: string
          meta_description: string
          published_at?: string
          read_time?: string
          slug: string
          tags?: string[]
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          meta_description?: string
          published_at?: string
          read_time?: string
          slug?: string
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      content_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_hidden: boolean
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "content_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_media: {
        Row: {
          blur_hash: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          media_type: string
          media_url: string
          post_id: string
          sort_order: number
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          blur_hash?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          media_type?: string
          media_url: string
          post_id: string
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          blur_hash?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          media_type?: string
          media_url?: string
          post_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_posts: {
        Row: {
          caption: string | null
          comment_count: number
          created_at: string
          creator_id: string
          id: string
          is_free: boolean
          is_pinned: boolean
          is_ppv: boolean
          is_published: boolean
          like_count: number
          min_tier_id: string | null
          post_type: string
          ppv_price_cents: number | null
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          comment_count?: number
          created_at?: string
          creator_id: string
          id?: string
          is_free?: boolean
          is_pinned?: boolean
          is_ppv?: boolean
          is_published?: boolean
          like_count?: number
          min_tier_id?: string | null
          post_type?: string
          ppv_price_cents?: number | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          comment_count?: number
          created_at?: string
          creator_id?: string
          id?: string
          is_free?: boolean
          is_pinned?: boolean
          is_ppv?: boolean
          is_published?: boolean
          like_count?: number
          min_tier_id?: string | null
          post_type?: string
          ppv_price_cents?: number | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "content_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_min_tier_id_fkey"
            columns: ["min_tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      creator_subscribers: {
        Row: {
          cancelled_at: string | null
          created_at: string
          creator_id: string
          expires_at: string | null
          fan_id: string
          id: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          tier_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          creator_id: string
          expires_at?: string | null
          fan_id: string
          id?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          tier_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          fan_id?: string
          id?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          tier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscribers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "creator_subscribers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_subscribers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          commission_rate: number
          created_at: string
          display_name: string | null
          handle: string
          id: string
          is_active: boolean
          payout_info: Json | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          handle: string
          id?: string
          is_active?: boolean
          payout_info?: Json | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          is_active?: boolean
          payout_info?: Json | null
          updated_at?: string
          user_id?: string
          verification_status?: string
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
      lesson_bookings: {
        Row: {
          amount_paid: number
          cancellation_token: string
          cancelled_at: string | null
          created_at: string
          customer_email: string
          customer_first_name: string | null
          customer_last_name: string | null
          duration_minutes: number
          id: string
          lesson_date: string
          lesson_time: string
          product_id: string | null
          product_title: string
          status: string
          stripe_payment_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancellation_token: string
          cancelled_at?: string | null
          created_at?: string
          customer_email: string
          customer_first_name?: string | null
          customer_last_name?: string | null
          duration_minutes?: number
          id?: string
          lesson_date: string
          lesson_time: string
          product_id?: string | null
          product_title: string
          status?: string
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancellation_token?: string
          cancelled_at?: string | null
          created_at?: string
          customer_email?: string
          customer_first_name?: string | null
          customer_last_name?: string | null
          duration_minutes?: number
          id?: string
          lesson_date?: string
          lesson_time?: string
          product_id?: string | null
          product_title?: string
          status?: string
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
      license_dashboard: {
        Row: {
          customer_email: string | null
          customer_name: string | null
          daily_limit: number | null
          last_used_at: string | null
          license_key: string | null
          requests_today: number | null
          site: string
          status: string | null
          total_requests: number | null
        }
        Insert: {
          customer_email?: string | null
          customer_name?: string | null
          daily_limit?: number | null
          last_used_at?: string | null
          license_key?: string | null
          requests_today?: number | null
          site?: string
          status?: string | null
          total_requests?: number | null
        }
        Update: {
          customer_email?: string | null
          customer_name?: string | null
          daily_limit?: number | null
          last_used_at?: string | null
          license_key?: string | null
          requests_today?: number | null
          site?: string
          status?: string | null
          total_requests?: number | null
        }
        Relationships: []
      }
      licenses: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          daily_limit: number | null
          device_id: string | null
          expires_at: string | null
          id: string
          last_reset_date: string | null
          last_used_at: string | null
          license_key: string
          product: string | null
          requests_today: number | null
          site: string
          status: string | null
          subscription_id: string | null
          total_requests: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          daily_limit?: number | null
          device_id?: string | null
          expires_at?: string | null
          id?: string
          last_reset_date?: string | null
          last_used_at?: string | null
          license_key: string
          product?: string | null
          requests_today?: number | null
          site?: string
          status?: string | null
          subscription_id?: string | null
          total_requests?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          daily_limit?: number | null
          device_id?: string | null
          expires_at?: string | null
          id?: string
          last_reset_date?: string | null
          last_used_at?: string | null
          license_key?: string
          product?: string | null
          requests_today?: number | null
          site?: string
          status?: string | null
          subscription_id?: string | null
          total_requests?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      link_analytics: {
        Row: {
          clicked_at: string
          id: string
          ip_address: string | null
          link_name: string
          link_url: string | null
          page_url: string | null
          referrer: string | null
          session_id: string | null
          site: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          link_name: string
          link_url?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          site?: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          link_name?: string
          link_url?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          site?: string
          user_agent?: string | null
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
      messages: {
        Row: {
          body: string | null
          id: string
          is_paid: boolean
          is_read: boolean
          media_type: string | null
          media_url: string | null
          ppv_price_cents: number | null
          ppv_unlocked: boolean
          read_at: string | null
          receiver_id: string
          sender_id: string
          sent_at: string
          tip_amount_cents: number | null
        }
        Insert: {
          body?: string | null
          id?: string
          is_paid?: boolean
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          ppv_price_cents?: number | null
          ppv_unlocked?: boolean
          read_at?: string | null
          receiver_id: string
          sender_id: string
          sent_at?: string
          tip_amount_cents?: number | null
        }
        Update: {
          body?: string | null
          id?: string
          is_paid?: boolean
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          ppv_price_cents?: number | null
          ppv_unlocked?: boolean
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          sent_at?: string
          tip_amount_cents?: number | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_cents: number
          completed_at: string | null
          creator_id: string
          id: string
          net_amount_cents: number
          notes: string | null
          payout_method: string
          period_end: string | null
          period_start: string | null
          platform_fee_cents: number
          processed_at: string | null
          requested_at: string
          status: string
          stripe_transfer_id: string | null
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          creator_id: string
          id?: string
          net_amount_cents: number
          notes?: string | null
          payout_method?: string
          period_end?: string | null
          period_start?: string | null
          platform_fee_cents?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          creator_id?: string
          id?: string
          net_amount_cents?: number
          notes?: string | null
          payout_method?: string
          period_end?: string | null
          period_start?: string | null
          platform_fee_cents?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_products: {
        Row: {
          billing_period: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          site: string
          slug: string
          stripe_price_id: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          site?: string
          slug: string
          stripe_price_id?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          site?: string
          slug?: string
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      ppv_unlocks: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          post_id: string
          stripe_payment_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          post_id: string
          stripe_payment_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          post_id?: string
          stripe_payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppv_unlocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
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
          site: string
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
          site?: string
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
          site?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          site: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          site?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          site?: string | null
          stripe_customer_id?: string | null
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
          site: string
          site_product_slug: string | null
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
          site?: string
          site_product_slug?: string | null
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
          site?: string
          site_product_slug?: string | null
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
            foreignKeyName: "purchases_site_product_slug_fkey"
            columns: ["site_product_slug"]
            isOneToOne: false
            referencedRelation: "site_products"
            referencedColumns: ["slug"]
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
      reviews: {
        Row: {
          created_at: string
          id: string
          rating: number
          review_date: string | null
          review_text: string | null
          reviewer_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review_date?: string | null
          review_text?: string | null
          reviewer_name: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review_date?: string | null
          review_text?: string | null
          reviewer_name?: string
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
      site_products: {
        Row: {
          billing_period: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          site: string
          slug: string
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          site: string
          slug: string
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          site?: string
          slug?: string
        }
        Relationships: []
      }
      stripe_connect_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          creator_id: string
          id: string
          onboarding_complete: boolean
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          creator_id: string
          id?: string
          onboarding_complete?: boolean
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          creator_id?: string
          id?: string
          onboarding_complete?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "stripe_connect_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string
          id: string
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type: string
          id: string
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string | null
          email: string | null
          free_credits: number | null
          id: string
          paid_credits: number | null
          site: string
          stripe_customer_id: string | null
          subscribed: boolean | null
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          free_credits?: number | null
          id?: string
          paid_credits?: number | null
          site?: string
          stripe_customer_id?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          free_credits?: number | null
          id?: string
          paid_credits?: number | null
          site?: string
          stripe_customer_id?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_tiers: {
        Row: {
          billing_period: string
          created_at: string
          creator_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          perks: string[] | null
          price_cents: number
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          perks?: string[] | null
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          perks?: string[] | null
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_tiers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "subscription_tiers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          product_slug: string | null
          site: string
          site_product_slug: string | null
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
          product_slug?: string | null
          site?: string
          site_product_slug?: string | null
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
          product_slug?: string | null
          site?: string
          site_product_slug?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_site_product_slug_fkey"
            columns: ["site_product_slug"]
            isOneToOne: false
            referencedRelation: "site_products"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_cents: number
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          post_id: string | null
          status: string
          stripe_payment_id: string | null
          to_creator_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          post_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          to_creator_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          post_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          to_creator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tips_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_to_creator_id_fkey"
            columns: ["to_creator_id"]
            isOneToOne: false
            referencedRelation: "creator_earnings"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "tips_to_creator_id_fkey"
            columns: ["to_creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist: string
          artwork_url: string | null
          audio_url: string
          created_at: string
          duration_seconds: number | null
          genre: string | null
          id: string
          release_year: number | null
          sort_order: number
          title: string
        }
        Insert: {
          artist?: string
          artwork_url?: string | null
          audio_url: string
          created_at?: string
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          release_year?: number | null
          sort_order?: number
          title: string
        }
        Update: {
          artist?: string
          artwork_url?: string | null
          audio_url?: string
          created_at?: string
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          release_year?: number | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          site: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          site?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          site?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      creator_earnings: {
        Row: {
          active_subscribers: number | null
          creator_id: string | null
          handle: string | null
          ppv_earnings_cents: number | null
          subscription_earnings_cents: number | null
          tip_earnings_cents: number | null
          total_earnings_cents: number | null
          total_posts: number | null
        }
        Relationships: []
      }
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
      generate_license_key: { Args: never; Returns: string }
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
      reset_daily_counts: { Args: never; Returns: undefined }
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
