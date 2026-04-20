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
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          barber_id: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          contact_preference: string | null
          created_at: string
          id: string
          notes: string | null
          service_id: string | null
          status: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          barber_id: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          contact_preference?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          time_slot: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          barber_id?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          contact_preference?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "public_barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          bio: string | null
          commission_rate: number
          created_at: string
          email: string
          id: string
          name: string
          photo_url: string | null
          role: Database["public"]["Enums"]["barber_role"]
          user_id: string
        }
        Insert: {
          bio?: string | null
          commission_rate?: number
          created_at?: string
          email: string
          id?: string
          name: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["barber_role"]
          user_id: string
        }
        Update: {
          bio?: string | null
          commission_rate?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["barber_role"]
          user_id?: string
        }
        Relationships: []
      }
      booking_attempts: {
        Row: {
          client_email: string | null
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          client_email?: string | null
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          client_email?: string | null
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      contact_logs: {
        Row: {
          appointment_id: string | null
          client_contact: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          message_content: string | null
          method: string
          status: string
          subject: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          method: string
          status?: string
          subject?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          method?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      owner_settings: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author: string
          created_at: string
          id: string
          rating: number
          text: string
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          rating?: number
          text: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          rating?: number
          text?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      shop_schedule: {
        Row: {
          breaks: Json
          close_time: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string
          updated_at: string
        }
        Insert: {
          breaks?: Json
          close_time?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string
          updated_at?: string
        }
        Update: {
          breaks?: Json
          close_time?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          appointment_date: string
          barber_id: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          notified_at: string | null
          response_token: string
          status: string
          time_slot: string
        }
        Insert: {
          appointment_date: string
          barber_id: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          response_token?: string
          status?: string
          time_slot: string
        }
        Update: {
          appointment_date?: string
          barber_id?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          response_token?: string
          status?: string
          time_slot?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_barbers: {
        Row: {
          bio: string | null
          id: string | null
          name: string | null
          photo_url: string | null
        }
        Insert: {
          bio?: string | null
          id?: string | null
          name?: string | null
          photo_url?: string | null
        }
        Update: {
          bio?: string | null
          id?: string | null
          name?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      book_appointment_tx: {
        Args: {
          p_appointment_date: string
          p_barber_id: string
          p_client_email?: string
          p_client_name: string
          p_client_phone?: string
          p_contact_preference?: string
          p_service_id: string
          p_time_slot: string
        }
        Returns: string
      }
      get_barber_id: { Args: { _user_id: string }; Returns: string }
      get_barber_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["barber_role"]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_daily_break: {
        Args: {
          p_appointment_date: string
          p_barber_id: string
          p_break_id: string
          p_new_time_slot: string
        }
        Returns: {
          appointment_date: string
          barber_id: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          contact_preference: string | null
          created_at: string
          id: string
          notes: string | null
          service_id: string | null
          status: string
          time_slot: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_future_breaks: { Args: { p_new_time: string }; Returns: undefined }
    }
    Enums: {
      barber_role: "owner" | "employee"
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
      barber_role: ["owner", "employee"],
    },
  },
} as const
