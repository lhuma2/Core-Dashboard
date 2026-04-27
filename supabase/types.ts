export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          ref_number: string | null
          business_name: string
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          address: string | null
          suburb: string | null
          state: string | null
          postcode: string | null
          service_type: Database['public']['Enums']['service_type'][] | null
          frequency: Database['public']['Enums']['frequency_type'] | null
          rate_per_visit: number | null
          monthly_value: number | null
          annual_value: number | null
          start_date: string | null
          active: boolean | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          ref_number?: string | null
          business_name: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          service_type?: Database['public']['Enums']['service_type'][] | null
          frequency?: Database['public']['Enums']['frequency_type'] | null
          rate_per_visit?: number | null
          monthly_value?: number | null
          annual_value?: number | null
          start_date?: string | null
          active?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          ref_number?: string | null
          business_name?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          service_type?: Database['public']['Enums']['service_type'][] | null
          frequency?: Database['public']['Enums']['frequency_type'] | null
          rate_per_visit?: number | null
          monthly_value?: number | null
          annual_value?: number | null
          start_date?: string | null
          active?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          ref_number: string | null
          client_id: string | null
          document_type: Database['public']['Enums']['document_type']
          status: Database['public']['Enums']['document_status'] | null
          title: string | null
          content: Json | null
          parent_id: string | null
          version: number | null
          sent_at: string | null
          signed_at: string | null
          expires_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          ref_number?: string | null
          client_id?: string | null
          document_type: Database['public']['Enums']['document_type']
          status?: Database['public']['Enums']['document_status'] | null
          title?: string | null
          content?: Json | null
          parent_id?: string | null
          version?: number | null
          sent_at?: string | null
          signed_at?: string | null
          expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          ref_number?: string | null
          client_id?: string | null
          document_type?: Database['public']['Enums']['document_type']
          status?: Database['public']['Enums']['document_status'] | null
          title?: string | null
          content?: Json | null
          parent_id?: string | null
          version?: number | null
          sent_at?: string | null
          signed_at?: string | null
          expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'documents_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      financial_records: {
        Row: {
          id: string
          client_id: string | null
          record_date: string
          amount: number
          type: string | null
          category: string | null
          description: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          record_date: string
          amount: number
          type?: string | null
          category?: string | null
          description?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          record_date?: string
          amount?: number
          type?: string | null
          category?: string | null
          description?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'financial_records_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
      sops: {
        Row: {
          id: string
          title: string
          category: string | null
          content: string | null
          version: number | null
          active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          category?: string | null
          content?: string | null
          version?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          category?: string | null
          content?: string | null
          version?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      surveys: {
        Row: {
          id: string
          client_id: string | null
          submitted_at: string | null
          quality_score: number | null
          reliability_score: number | null
          communication_score: number | null
          value_score: number | null
          comments: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          submitted_at?: string | null
          quality_score?: number | null
          reliability_score?: number | null
          communication_score?: number | null
          value_score?: number | null
          comments?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          submitted_at?: string | null
          quality_score?: number | null
          reliability_score?: number | null
          communication_score?: number | null
          value_score?: number | null
          comments?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'surveys_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      document_status: 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled'
      document_type: 'proposal' | 'cleaning_agreement' | 'specialist_agreement'
      frequency_type: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual' | 'one_off'
      service_type: 'general_cleaning' | 'pressure_washing' | 'window_cleaning' | 'floor_care'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
