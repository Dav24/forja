export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      async_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          result: Json | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          result?: Json | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          result?: Json | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "async_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_data: {
        Row: {
          activity_level: string | null
          age: number | null
          body_fat_pct: number | null
          bone_density: number | null
          gender: string | null
          height_cm: number | null
          id: string
          muscle_mass_kg: number | null
          recorded_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          body_fat_pct?: number | null
          bone_density?: number | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          muscle_mass_kg?: number | null
          recorded_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          body_fat_pct?: number | null
          bone_density?: number | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          muscle_mass_kg?: number | null
          recorded_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          model_used: string | null
          role: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          model_used?: string | null
          role: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          model_used?: string | null
          role?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json
          related_job_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json
          related_job_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json
          related_job_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "async_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_message_count: {
        Row: {
          count: number
          date: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_message_count_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_catalog: {
        Row: {
          created_at: string
          difficulty: string
          equipment: string
          instructions_es: string[]
          movement_pattern: string
          name_en: string
          name_es: string
          poster_url: string
          primary_muscle: string
          slug: string
          video_url: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          equipment: string
          instructions_es: string[]
          movement_pattern: string
          name_en: string
          name_es: string
          poster_url: string
          primary_muscle: string
          slug: string
          video_url: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          equipment?: string
          instructions_es?: string[]
          movement_pattern?: string
          name_en?: string
          name_es?: string
          poster_url?: string
          primary_muscle?: string
          slug?: string
          video_url?: string
        }
        Relationships: []
      }
      exercise_feedback: {
        Row: {
          created_at: string
          day_number: number
          exercise_order: number
          flag: string
          id: string
          log_date: string
          user_id: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          day_number: number
          exercise_order: number
          flag: string
          id?: string
          log_date: string
          user_id: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          exercise_order?: number
          flag?: string
          id?: string
          log_date?: string
          user_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_feedback_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          bodyweight_lastre_kg: number | null
          day_number: number
          exercise_order: number
          exercise_slug: string | null
          id: string
          kg: number | null
          log_date: string
          recorded_at: string
          reps: number | null
          set_number: number
          user_id: string
          workout_plan_id: string
        }
        Insert: {
          bodyweight_lastre_kg?: number | null
          day_number: number
          exercise_order: number
          exercise_slug?: string | null
          id?: string
          kg?: number | null
          log_date?: string
          recorded_at?: string
          reps?: number | null
          set_number: number
          user_id: string
          workout_plan_id: string
        }
        Update: {
          bodyweight_lastre_kg?: number | null
          day_number?: number
          exercise_order?: number
          exercise_slug?: string | null
          id?: string
          kg?: number | null
          log_date?: string
          recorded_at?: string
          reps?: number | null
          set_number?: number
          user_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_slug_fkey"
            columns: ["exercise_slug"]
            isOneToOne: false
            referencedRelation: "exercise_catalog"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "exercise_logs_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      food_preferences: {
        Row: {
          created_at: string
          id: string
          item: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          athletic_background: string | null
          created_at: string
          fitness_level: string
          id: string
          is_active: boolean
          modality: string | null
          modality_goal_notes: string | null
          modality_orientation: string | null
          mode: string
          secondary_goal_notes: string | null
          secondary_modalities: string[]
          sport_type: string | null
          target_date: string | null
          target_weight_kg: number | null
          type: string
          user_id: string
        }
        Insert: {
          athletic_background?: string | null
          created_at?: string
          fitness_level: string
          id?: string
          is_active?: boolean
          modality?: string | null
          modality_goal_notes?: string | null
          modality_orientation?: string | null
          mode?: string
          secondary_goal_notes?: string | null
          secondary_modalities?: string[]
          sport_type?: string | null
          target_date?: string | null
          target_weight_kg?: number | null
          type: string
          user_id: string
        }
        Update: {
          athletic_background?: string | null
          created_at?: string
          fitness_level?: string
          id?: string
          is_active?: boolean
          modality?: string | null
          modality_goal_notes?: string | null
          modality_orientation?: string | null
          mode?: string
          secondary_goal_notes?: string | null
          secondary_modalities?: string[]
          sport_type?: string | null
          target_date?: string | null
          target_weight_kg?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          daily_calories: number | null
          generated_by: string
          id: string
          is_active: boolean
          macros: Json
          meals: Json
          source_language: string
          title: string
          translations: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_calories?: number | null
          generated_by?: string
          id?: string
          is_active?: boolean
          macros?: Json
          meals?: Json
          source_language?: string
          title: string
          translations?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          daily_calories?: number | null
          generated_by?: string
          id?: string
          is_active?: boolean
          macros?: Json
          meals?: Json
          source_language?: string
          title?: string
          translations?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_swaps: {
        Row: {
          created_at: string
          day_number: number
          id: string
          meal_index: number
          meal_plan_id: string
          new_meal_name: string
          old_meal_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          meal_index: number
          meal_plan_id: string
          new_meal_name: string
          old_meal_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          meal_index?: number
          meal_plan_id?: string
          new_meal_name?: string
          old_meal_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_swaps_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_swaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          id: string
          read: boolean
          sent_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          id?: string
          read?: boolean
          sent_at?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          id?: string
          read?: boolean
          sent_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_adjustments: {
        Row: {
          after_snapshot: Json
          applied_by: string
          before_snapshot: Json
          created_at: string
          day_number: number
          exercise_order: number | null
          id: string
          reason_tag: string
          source: string
          user_id: string
          workout_plan_id: string
        }
        Insert: {
          after_snapshot: Json
          applied_by: string
          before_snapshot: Json
          created_at?: string
          day_number: number
          exercise_order?: number | null
          id?: string
          reason_tag: string
          source: string
          user_id: string
          workout_plan_id: string
        }
        Update: {
          after_snapshot?: Json
          applied_by?: string
          before_snapshot?: Json
          created_at?: string
          day_number?: number
          exercise_order?: number | null
          id?: string
          reason_tag?: string
          source?: string
          user_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_adjustments_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_adjust_enabled: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          expo_push_token: string | null
          id: string
          language: string
          notif_reminders: boolean
          notif_updates: boolean
          onboarding_completed: boolean
          supplements: string[]
          supplements_other: string | null
          updated_at: string
        }
        Insert: {
          auto_adjust_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expo_push_token?: string | null
          id: string
          language?: string
          notif_reminders?: boolean
          notif_updates?: boolean
          onboarding_completed?: boolean
          supplements?: string[]
          supplements_other?: string | null
          updated_at?: string
        }
        Update: {
          auto_adjust_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expo_push_token?: string | null
          id?: string
          language?: string
          notif_reminders?: boolean
          notif_updates?: boolean
          onboarding_completed?: boolean
          supplements?: string[]
          supplements_other?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_feedback: {
        Row: {
          comment: string | null
          created_at: string
          day_number: number
          difficulty_rating: string
          id: string
          log_date: string
          problem_tags: string[]
          user_id: string
          workout_plan_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          day_number: number
          difficulty_rating: string
          id?: string
          log_date: string
          problem_tags?: string[]
          user_id: string
          workout_plan_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          day_number?: number
          difficulty_rating?: string
          id?: string
          log_date?: string
          problem_tags?: string[]
          user_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          description: string | null
          generated_by: string
          id: string
          is_active: boolean
          modifications_count: number
          plan_month: string
          schedule: Json
          source_language: string
          title: string
          translations: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          generated_by?: string
          id?: string
          is_active?: boolean
          modifications_count?: number
          plan_month?: string
          schedule?: Json
          source_language?: string
          title: string
          translations?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          generated_by?: string
          id?: string
          is_active?: boolean
          modifications_count?: number
          plan_month?: string
          schedule?: Json
          source_language?: string
          title?: string
          translations?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credit: {
        Args: { p_action: string; p_related_job_id: string; p_user_id: string }
        Returns: number
      }
      get_credit_balance: { Args: { p_user_id: string }; Returns: number }
      get_daily_message_count: { Args: { p_user_id: string }; Returns: number }
      get_notification_targets: {
        Args: never
        Returns: {
          current_period_end: string
          current_weight: number
          expo_push_token: string
          first_weight: number
          goal_type: string
          last_activity: string
          notif_reminders: boolean
          notif_updates: boolean
          plan: string
          sub_status: string
          target_date: string
          target_weight_kg: number
          user_id: string
        }[]
      }
      grant_credit: {
        Args: {
          p_amount: number
          p_related_job_id?: string
          p_stripe_payment_intent_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      increment_daily_message_count: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      ts_to_utc_date: { Args: { ts: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

