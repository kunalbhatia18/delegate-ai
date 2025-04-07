'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AuthTestPage() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
      
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
      
      setLoading(false);
    }
    
    checkAuth();
    
    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session);
        setSession(session);
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold mb-2">Status: {loading ? 'Loading...' : (user ? 'Logged In' : 'Not Logged In')}</h2>
      </div>
      
      {user && (
        <div className="bg-white p-4 shadow rounded mb-4">
          <h2 className="font-semibold mb-2">User Info</h2>
          <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      )}
      
      {session && (
        <div className="bg-white p-4 shadow rounded mb-4">
          <h2 className="font-semibold mb-2">Session Info</h2>
          <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="flex gap-4 mt-4">
        {user ? (
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        ) : (
          <a
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </a>
        )}
        
        <a
          href="/"
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Home
        </a>
      </div>
    </div>
  );
}