export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string | null
          status: 'pending' | 'assigned' | 'accepted' | 'completed' | 'declined'
          delegator_id: string
          assignee_id: string | null
          team_id: string
          due_date: string | null
          slack_ts: string | null
          slack_channel: string | null
          completion_date: string | null
          estimated_time: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          description?: string | null
          status?: 'pending' | 'assigned' | 'accepted' | 'completed' | 'declined'
          delegator_id: string
          assignee_id?: string | null
          team_id: string
          due_date?: string | null
          slack_ts?: string | null
          slack_channel?: string | null
          completion_date?: string | null
          estimated_time?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          description?: string | null
          status?: 'pending' | 'assigned' | 'accepted' | 'completed' | 'declined'
          delegator_id?: string
          assignee_id?: string | null
          team_id?: string
          due_date?: string | null
          slack_ts?: string | null
          slack_channel?: string | null
          completion_date?: string | null
          estimated_time?: number | null
        }
      }
      teams: {
        Row: {
          id: string
          created_at: string
          name: string
          slack_team_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          slack_team_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          slack_team_id?: string | null
        }
      }
      users: {
        Row: {
          id: string
          created_at: string
          email: string
          full_name: string | null
          avatar_url: string | null
          slack_user_id: string | null
          last_active: string | null
          role: 'admin' | 'member' | null
        }
        Insert: {
          id?: string
          created_at?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          slack_user_id?: string | null
          last_active?: string | null
          role?: 'admin' | 'member' | null
        }
        Update: {
          id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          slack_user_id?: string | null
          last_active?: string | null
          role?: 'admin' | 'member' | null
        }
      }
      team_members: {
        Row: {
          id: string
          created_at: string
          user_id: string
          team_id: string
          role: 'owner' | 'admin' | 'member'
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          team_id: string
          role?: 'owner' | 'admin' | 'member'
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          team_id?: string
          role?: 'owner' | 'admin' | 'member'
        }
      }
      skills: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
        }
      }
      user_skills: {
        Row: {
          id: string
          created_at: string
          user_id: string
          skill_id: string
          proficiency_level: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          skill_id: string
          proficiency_level?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          skill_id?: string
          proficiency_level?: number | null
        }
      }
      slack_workspaces: {
        Row: {
          id: string
          created_at: string
          team_id: string
          slack_team_id: string
          slack_access_token: string
          slack_bot_id: string
          slack_app_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          team_id: string
          slack_team_id: string
          slack_access_token: string
          slack_bot_id: string
          slack_app_id: string
        }
        Update: {
          id?: string
          created_at?: string
          team_id?: string
          slack_team_id?: string
          slack_access_token?: string
          slack_bot_id?: string
          slack_app_id?: string
        }
      }
      task_skills: {
        Row: {
          id: string
          created_at: string
          task_id: string
          skill_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          task_id: string
          skill_id: string
        }
        Update: {
          id?: string
          created_at?: string
          task_id?: string
          skill_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}