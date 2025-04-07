import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Create a client with admin privileges that bypasses RLS
export const adminSupabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);