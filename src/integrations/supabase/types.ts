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
      book_catalog: {
        Row: {
          book_code: string
          created_at: string | null
          egw_book_id: number
          folder_id: number | null
          id: string
          is_active: boolean | null
          language: string | null
          last_validated: string | null
          title_es: string
          updated_at: string | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          book_code: string
          created_at?: string | null
          egw_book_id: number
          folder_id?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_validated?: string | null
          title_es: string
          updated_at?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          book_code?: string
          created_at?: string | null
          egw_book_id?: number
          folder_id?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_validated?: string | null
          title_es?: string
          updated_at?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: []
      }
      book_comparisons: {
        Row: {
          book_id: string
          changed_paragraphs: number
          chapters_affected: Json | null
          comparison_date: string
          comparison_type: string
          created_at: string
          id: string
          total_changes: number
          version_notes: string | null
        }
        Insert: {
          book_id: string
          changed_paragraphs?: number
          chapters_affected?: Json | null
          comparison_date?: string
          comparison_type: string
          created_at?: string
          id?: string
          total_changes?: number
          version_notes?: string | null
        }
        Update: {
          book_id?: string
          changed_paragraphs?: number
          chapters_affected?: Json | null
          comparison_date?: string
          comparison_type?: string
          created_at?: string
          id?: string
          total_changes?: number
          version_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_comparisons_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          book_code_api: string | null
          code: string
          created_at: string | null
          id: string
          imported_at: string | null
          is_test_seed: boolean | null
          language: string | null
          last_check_date: string | null
          title: string
          total_changes: number | null
          updated_at: string | null
        }
        Insert: {
          book_code_api?: string | null
          code: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          is_test_seed?: boolean | null
          language?: string | null
          last_check_date?: string | null
          title: string
          total_changes?: number | null
          updated_at?: string | null
        }
        Update: {
          book_code_api?: string | null
          code?: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          is_test_seed?: boolean | null
          language?: string | null
          last_check_date?: string | null
          title?: string
          total_changes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      catalog_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      chapters: {
        Row: {
          book_id: string
          change_count: number | null
          created_at: string | null
          id: string
          number: number
          title: string
          updated_at: string | null
        }
        Insert: {
          book_id: string
          change_count?: number | null
          created_at?: string | null
          id?: string
          number: number
          title: string
          updated_at?: string | null
        }
        Update: {
          book_id?: string
          change_count?: number | null
          created_at?: string | null
          id?: string
          number?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          chapter_id: string
          comment_text: string
          created_at: string
          id: string
          paragraph_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          comment_text: string
          created_at?: string
          id?: string
          paragraph_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          comment_text?: string
          created_at?: string
          id?: string
          paragraph_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "paragraphs"
            referencedColumns: ["id"]
          },
        ]
      }
      paragraphs: {
        Row: {
          base_text: string
          change_history: Json | null
          chapter_id: string
          created_at: string | null
          has_changed: boolean | null
          id: string
          latest_text: string
          paragraph_number: number
          refcode_short: string | null
          updated_at: string | null
        }
        Insert: {
          base_text: string
          change_history?: Json | null
          chapter_id: string
          created_at?: string | null
          has_changed?: boolean | null
          id?: string
          latest_text: string
          paragraph_number: number
          refcode_short?: string | null
          updated_at?: string | null
        }
        Update: {
          base_text?: string
          change_history?: Json | null
          chapter_id?: string
          created_at?: string | null
          has_changed?: boolean | null
          id?: string
          latest_text?: string
          paragraph_number?: number
          refcode_short?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paragraphs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
