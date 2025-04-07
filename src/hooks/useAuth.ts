'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current user from the session
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      
      // If there's an error other than missing session, log it
      if (error && error.message !== 'Auth session missing!') {
        console.error('Error fetching user:', error.message);
      }
      
      // Set user to data.user or null
      setUser(data?.user || null);
      setLoading(false);
    };

    fetchUser();

    // Set up a subscription to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      // Clean up the subscription when the component unmounts
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}