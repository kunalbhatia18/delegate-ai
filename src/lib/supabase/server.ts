// src/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function createServerClient() {
  try {
    // Create a Supabase client without cookie handling for now
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false, // Don't try to use cookies
          autoRefreshToken: false,
        }
      }
    );
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    throw error;
  }
}