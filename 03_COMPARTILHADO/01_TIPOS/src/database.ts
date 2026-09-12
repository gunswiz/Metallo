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
      asset_movements: {
        Row: {
          asset_id: string
          occurred_at: string
          created_at: string
          destination_team_id: string | null
          id: string
          movement_type: string
          new_status: string
          note: string | null
          origin_team_id: string | null
          performed_by: string
          previous_status: string
        }
        Insert: {
          asset_id: string
          occurred_at?: string
          created_at?: string
          destination_team_id?: string | null
          id?: string
          movement_type: string
          new_status: string
          note?: string | null
          origin_team_id?: string | null
          performed_by: string
          previous_status: string
        }
        Update: {
          asset_id?: string
          occurred_at?: string
          created_at?: string
          destination_team_id?: string | null
          id?: string
          movement_type?: string
          new_status?: string
          note?: string | null
          origin_team_id?: string | null
          performed_by?: string
          previous_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_destination_team_id_fkey"
            columns: ["destination_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_origin_team_id_fkey"
            columns: ["origin_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          active: boolean
          asset_code: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          ownership_type: string
          rental_company: string | null
          rental_end_date: string | null
          rental_start_date: string | null
          serial_number: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_notes: string | null
        }
        Insert: {
          active?: boolean
          asset_code: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          ownership_type?: string
          rental_company?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          serial_number?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Update: {
          active?: boolean
          asset_code?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          ownership_type?: string
          rental_company?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          serial_number?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_deliveries: {
        Row: {
          brand_model_snapshot: string | null
          ca_snapshot: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          current_status: string
          delivered_at: string
          delivered_by: string
          delivery_group_id: string | null
          delivery_reason: string
          employee_id: string
          id: string
          item_id: string
          lot_snapshot: string | null
          note: string | null
          quantity: number
          stock_batch_id: string | null
          team_id: string
          variant_snapshot: string | null
        }
        Insert: {
          brand_model_snapshot?: string | null
          ca_snapshot?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_status?: string
          delivered_at?: string
          delivered_by?: string
          delivery_group_id?: string | null
          delivery_reason?: string
          employee_id: string
          id?: string
          item_id: string
          lot_snapshot?: string | null
          note?: string | null
          quantity: number
          stock_batch_id?: string | null
          team_id: string
          variant_snapshot?: string | null
        }
        Update: {
          brand_model_snapshot?: string | null
          ca_snapshot?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_status?: string
          delivered_at?: string
          delivered_by?: string
          delivery_group_id?: string | null
          delivery_reason?: string
          employee_id?: string
          id?: string
          item_id?: string
          lot_snapshot?: string | null
          note?: string | null
          quantity?: number
          stock_batch_id?: string | null
          team_id?: string
          variant_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "epi_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_stock_batch_id_fkey"
            columns: ["stock_batch_id"]
            isOneToOne: false
            referencedRelation: "epi_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_employee_item_sets: {
        Row: {
          employee_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          employee_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          employee_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_employee_item_sets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "epi_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_employee_items: {
        Row: {
          employee_id: string
          item_id: string
          required_quantity: number
        }
        Insert: {
          employee_id: string
          item_id: string
          required_quantity?: number
        }
        Update: {
          employee_id?: string
          item_id?: string
          required_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "epi_employee_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "epi_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_employees: {
        Row: {
          active: boolean
          aso_exam_date: string | null
          aso_expiry_date: string | null
          created_at: string
          created_by: string
          full_name: string
          id: string
          pants_size: string | null
          profession: string
          registration_code: string | null
          shirt_size: string | null
          shoe_size: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aso_exam_date?: string | null
          aso_expiry_date?: string | null
          created_at?: string
          created_by?: string
          full_name: string
          id?: string
          pants_size?: string | null
          profession: string
          registration_code?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aso_exam_date?: string | null
          aso_expiry_date?: string | null
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          pants_size?: string | null
          profession?: string
          registration_code?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_item_variants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          item_id: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          item_id: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          item_id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_items: {
        Row: {
          active: boolean
          brand_model: string | null
          ca_number: string | null
          code: string
          created_at: string
          created_by: string
          id: string
          item_kind: string
          minimum_stock: number
          name: string
          replacement_days: number | null
          requires_note_on_close: boolean
          return_policy: string
          system_key: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_model?: string | null
          ca_number?: string | null
          code: string
          created_at?: string
          created_by?: string
          id?: string
          item_kind: string
          minimum_stock?: number
          name: string
          replacement_days?: number | null
          requires_note_on_close?: boolean
          return_policy?: string
          system_key?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_model?: string | null
          ca_number?: string | null
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          item_kind?: string
          minimum_stock?: number
          name?: string
          replacement_days?: number | null
          requires_note_on_close?: boolean
          return_policy?: string
          system_key?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      epi_monthly_acknowledgements: {
        Row: {
          confirmed_by: string | null
          created_at: string
          employee_id: string
          id: string
          reference_month: string
          signed_at: string | null
          signed_name: string | null
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          reference_month: string
          signed_at?: string | null
          signed_name?: string | null
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          reference_month?: string
          signed_at?: string | null
          signed_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_monthly_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "epi_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_profession_items: {
        Row: {
          item_id: string
          profession_code: string
          recommended_quantity: number
        }
        Insert: {
          item_id: string
          profession_code: string
          recommended_quantity?: number
        }
        Update: {
          item_id?: string
          profession_code?: string
          recommended_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "epi_profession_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_profession_items_profession_code_fkey"
            columns: ["profession_code"]
            isOneToOne: false
            referencedRelation: "epi_professions"
            referencedColumns: ["code"]
          },
        ]
      }
      epi_professions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          name: string
          sort_order: number
          uniform_color: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          name: string
          sort_order?: number
          uniform_color?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          name?: string
          sort_order?: number
          uniform_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      epi_requests: {
        Row: {
          created_at: string
          employee_id: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          item_id: string
          quantity: number
          requested_by: string | null
          requested_variant: string | null
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id: string
          quantity?: number
          requested_by?: string | null
          requested_variant?: string | null
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id?: string
          quantity?: number
          requested_by?: string | null
          requested_variant?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "epi_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_stock_batches: {
        Row: {
          brand_model: string | null
          ca_number: string | null
          created_at: string
          created_by: string
          expires_on: string | null
          id: string
          item_id: string
          lot_number: string | null
          quantity: number
          received_at: string
          variant: string | null
        }
        Insert: {
          brand_model?: string | null
          ca_number?: string | null
          created_at?: string
          created_by?: string
          expires_on?: string | null
          id?: string
          item_id: string
          lot_number?: string | null
          quantity: number
          received_at?: string
          variant?: string | null
        }
        Update: {
          brand_model?: string | null
          ca_number?: string | null
          created_at?: string
          created_by?: string
          expires_on?: string | null
          id?: string
          item_id?: string
          lot_number?: string | null
          quantity?: number
          received_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_stock_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "epi_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity?: number
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          item_type: string
          minimum_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          minimum_stock?: number
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          minimum_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          origin_stock_team_id: string | null
          destination_stock_team_id: string | null
          occurred_at: string
          created_at: string
          destination_team_id: string | null
          id: string
          item_id: string
          movement_type: string
          note: string | null
          origin_team_id: string | null
          performed_by: string
          quantity: number
        }
        Insert: {
          origin_stock_team_id?: string | null
          destination_stock_team_id?: string | null
          occurred_at?: string
          created_at?: string
          destination_team_id?: string | null
          id?: string
          item_id: string
          movement_type: string
          note?: string | null
          origin_team_id?: string | null
          performed_by: string
          quantity: number
        }
        Update: {
          origin_stock_team_id?: string | null
          destination_stock_team_id?: string | null
          occurred_at?: string
          created_at?: string
          destination_team_id?: string | null
          id?: string
          item_id?: string
          movement_type?: string
          note?: string | null
          origin_team_id?: string | null
          performed_by?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "movements_destination_team_id_fkey"
            columns: ["destination_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_origin_team_id_fkey"
            columns: ["origin_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_reasons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string
          scope: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          scope: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          operation_permissions: string[] | null
          operation_team_ids: string[] | null
          active: boolean
          created_at: string
          full_name: string
          id: string
          role: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          operation_permissions?: string[] | null
          operation_team_ids?: string[] | null
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          role?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          operation_permissions?: string[] | null
          operation_team_ids?: string[] | null
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          role?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          location_type: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          location_type?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          location_type?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_locations: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          location_type: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          location_type?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          location_type?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
        add_epi_stock_batch: {
          Args: {
            p_brand_model?: string
            p_ca_number?: string
            p_item_id: string
            p_lot_number?: string
            p_quantity: number
            p_variant?: string
          }
          Returns: string
        }
      admin_delete_asset_movement: {
        Args: { p_movement_id: string }
        Returns: undefined
      }
      admin_delete_material_movement: {
        Args: { p_movement_id: string }
        Returns: undefined
      }
      admin_update_asset_movement: {
        Args: {
          p_destination_team_id: string
          p_movement_id: string
          p_new_status: string
          p_note?: string
        }
        Returns: undefined
      }
      admin_update_material_movement: {
        Args: {
          p_destination_team_id: string
          p_movement_id: string
          p_note?: string
          p_origin_team_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      can_operate: { Args: { p_permission: string; p_team_id?: string | null }; Returns: boolean }
      site_dashboard: { Args: never; Returns: Json }
      run_site_operation: { Args: { p_command: string; p_data: Json; p_operation_id: string; p_occurred_at: string }; Returns: Json }
      admin_update_profile_access: {
        Args: { p_user_id: string; p_full_name: string; p_role: string; p_team_id: string | null; p_active: boolean; p_operation_permissions: string[] | null; p_operation_team_ids: string[] | null }
        Returns: undefined
      }
      admin_update_profile: {
        Args: {
          p_active: boolean
          p_full_name: string
          p_role: string
          p_team_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      asset_legacy_decode: { Args: { p_value: string }; Returns: string }
      asset_legacy_encode: { Args: { p_value: string }; Returns: string }
      asset_visible_notes: { Args: { p_notes: string }; Returns: string }
      claim_initial_admin: { Args: never; Returns: boolean }
      close_epi_delivery_quantity: {
        Args: {
          p_delivery_id: string
          p_quantity: number
          p_status: string
        }
        Returns: string
      }
      consume_material: {
        Args: {
          p_item_id: string
          p_note?: string
          p_quantity: number
          p_team_id: string
        }
        Returns: undefined
      }
      create_equipment_for_team: {
        Args: {
          p_asset_code: string
          p_category?: string
          p_code: string
          p_description?: string
          p_name: string
          p_notes?: string
          p_serial_number?: string
          p_team_id?: string
        }
        Returns: string
      }
      create_epi_item_with_stock: {
        Args: {
          p_brand_model?: string
          p_ca_number?: string
          p_code: string
          p_initial_quantity?: number
          p_item_kind: string
          p_lot_number?: string
          p_minimum_stock?: number
          p_name: string
          p_return_policy?: string
          p_unit: string
          p_variant?: string
        }
        Returns: string
      }
      create_equipment_for_team_v2: {
        Args: {
          p_asset_code: string
          p_category?: string
          p_code: string
          p_description?: string
          p_name: string
          p_ownership_type?: string
          p_rental_company?: string
          p_rental_end_date?: string
          p_rental_start_date?: string
          p_serial_number?: string
          p_team_id?: string
          p_user_notes?: string
        }
        Returns: string
      }
      create_material_for_team: {
        Args: {
          p_category?: string
          p_code: string
          p_description?: string
          p_minimum_stock?: number
          p_name: string
          p_quantity?: number
          p_team_id?: string
          p_unit?: string
        }
        Returns: string
      }
      create_team_admin:
        | { Args: { p_description?: string; p_name: string }; Returns: string }
        | {
            Args: {
              p_description?: string
              p_location_type?: string
              p_name: string
            }
            Returns: string
          }
      deactivate_asset_admin: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
      deactivate_item_admin: { Args: { p_item_id: string }; Returns: undefined }
      delete_team_admin: { Args: { p_team_id: string }; Returns: undefined }
      fulfill_epi_request: {
        Args: { p_request_id: string; p_stock_batch_id: string }
        Returns: string
      }
      is_active_admin: { Args: never; Returns: boolean }
      register_asset_movement: {
        Args: {
          p_asset_id: string
          p_destination_team_id?: string
          p_movement_type: string
          p_new_status?: string
          p_note?: string
        }
        Returns: string
      }
      register_epi_delivery: {
        Args: {
          p_delivery_reason?: string
          p_employee_id: string
          p_item_id: string
          p_note?: string
          p_quantity: number
          p_stock_batch_id: string
        }
        Returns: string
      }
      register_epi_delivery_batch: {
        Args: {
          p_delivery_reason?: string
          p_employee_id: string
          p_lines: Json
          p_note?: string
        }
        Returns: string
      }
      register_movement: {
        Args: {
          p_destination_team_id?: string
          p_item_id: string
          p_movement_type: string
          p_note?: string
          p_origin_team_id?: string
          p_quantity: number
        }
        Returns: string
      }
      replenish_material: {
        Args: {
          p_destination_team_id: string
          p_item_id: string
          p_note?: string
          p_origin_team_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      request_epi_item: {
        Args: {
          p_employee_id: string
          p_item_id: string
          p_quantity: number
          p_requested_variant?: string
        }
        Returns: string
      }
      return_rented_equipment: {
        Args: { p_asset_id: string; p_note?: string }
        Returns: undefined
      }
      set_epi_employee_items: {
        Args: { p_employee_id: string; p_lines: Json }
        Returns: undefined
      }
      update_asset_admin: {
        Args: {
          p_active?: boolean
          p_asset_code: string
          p_asset_id: string
          p_notes: string
          p_serial_number: string
          p_status: string
          p_team_id: string
        }
        Returns: undefined
      }
      update_equipment_admin: {
        Args: {
          p_active?: boolean
          p_asset_code: string
          p_asset_id: string
          p_item_code: string
          p_item_id: string
          p_item_name: string
          p_notes: string
          p_serial_number: string
          p_status: string
          p_team_id: string
        }
        Returns: undefined
      }
      update_equipment_admin_v2: {
        Args: {
          p_active?: boolean
          p_asset_code: string
          p_asset_id: string
          p_item_code: string
          p_item_id: string
          p_item_name: string
          p_ownership_type: string
          p_rental_company?: string
          p_rental_end_date?: string
          p_rental_start_date?: string
          p_serial_number: string
          p_status: string
          p_team_id: string
          p_user_notes: string
        }
        Returns: undefined
      }
      update_item_admin: {
        Args: {
          p_active?: boolean
          p_category: string
          p_code: string
          p_description: string
          p_item_id: string
          p_minimum_stock: number
          p_name: string
          p_unit: string
        }
        Returns: undefined
      }
      update_team_admin: {
        Args: { p_description?: string; p_name: string; p_team_id: string }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
