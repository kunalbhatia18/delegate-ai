'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';

export default function ProfileForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { user, error } = await getCurrentUser();
      
      if (error || !user) {
        console.error('Error loading user:', error);
        router.push('/login');
        return;
      }
      
      setUserId(user.id);
      setEmail(user.email || '');
      
      // Try to fetch user profile from our database
      const { data, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        // If profile not found, create one
        if (profileError.code === 'PGRST116') { // row not found
          const { error: createError } = await supabase
            .from('users')
            .upsert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || '',
            });
            
          if (createError) {
            console.error('Error creating user profile:', createError);
          } else {
            // If created successfully, set the name from metadata
            setFullName(user.user_metadata?.full_name || '');
          }
        } else {
          console.error('Error loading profile:', profileError);
        }
      } else if (data) {
        setFullName(data.full_name || '');
      }
      
      setLoading(false);
    }
    
    loadProfile();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) return;
    
    setUpdating(true);
    setError(null);
    setMessage(null);
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
        })
        .eq('id', userId);
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Profile updated successfully!');
        // Force refresh
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Update profile error:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading profile...</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Your Profile</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {message}
        </div>
      )}
      
      <form onSubmit={handleUpdateProfile}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Email cannot be changed
          </p>
        </div>
        
        <div className="mb-6">
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          type="submit"
          disabled={updating}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {updating ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
}