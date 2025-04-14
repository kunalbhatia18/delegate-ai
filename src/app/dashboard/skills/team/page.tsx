'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import RouteGuard from '@/components/auth/RouteGuard';
import TeamSkillsManagement from '@/components/skills/TeamSkillsManagement';

export default function TeamSkillsPage() {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get the user's team
  useEffect(() => {
    async function fetchUserTeam() {
      if (!user) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/team?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          setTeamId(data[0].team_id);
        }
      } catch (err) {
        console.error('Error fetching team:', err);
        setError('Failed to load team data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserTeam();
  }, [user]);
  
  return (
    <RouteGuard>
      <div>
        <h1 className="text-3xl font-bold mb-6">Team Skills Management</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading team data...</div>
            </div>
          </div>
        ) : teamId ? (
          <TeamSkillsManagement teamId={teamId} />
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center py-8 text-gray-500">
              You need to be part of a team to manage team skills. Please create or join a team first.
            </p>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}