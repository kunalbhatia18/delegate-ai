'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import RouteGuard from '@/components/auth/RouteGuard';

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  users: {
    id: string;
    full_name: string | null;
    email: string;
    slack_user_id: string | null;
    last_active: string | null;
  };
}

interface Team {
  id: string;
  name: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New team form state
  const [showNewTeamForm, setShowNewTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  
  // Invite member form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Get user's teams
  useEffect(() => {
    async function fetchTeams() {
      if (!user) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/team?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch teams data');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          const teamsData = data.map((item: any) => ({
            id: item.team_id,
            name: item.teams?.name || 'Unnamed Team'
          }));
          
          setTeams(teamsData);
          setSelectedTeam(teamsData[0]);
        } else {
          // No teams, show create team form
          setShowNewTeamForm(true);
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Failed to load teams data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTeams();
  }, [user]);
  
  // Get team members when selected team changes
  useEffect(() => {
    async function fetchTeamMembers() {
      if (!selectedTeam) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/team-members?teamId=${selectedTeam.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }
        
        const data = await response.json();
        setTeamMembers(data || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
        setError('Failed to load team members');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTeamMembers();
  }, [selectedTeam]);
  
  // Handle creating a new team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !newTeamName.trim()) return;
    
    try {
      setCreatingTeam(true);
      
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newTeamName.trim(),
          userId: user.id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create team');
      }
      
      const newTeam = await response.json();
      
      // Add to teams list and select it
      const updatedTeams = [...teams, { id: newTeam.id, name: newTeam.name }];
      setTeams(updatedTeams);
      setSelectedTeam({ id: newTeam.id, name: newTeam.name });
      
      // Reset form
      setNewTeamName('');
      setShowNewTeamForm(false);
      
      // Fetch the new team members (which will just be the creator)
      const membersResponse = await fetch(`/api/team-members?teamId=${newTeam.id}`);
      const membersData = await membersResponse.json();
      setTeamMembers(membersData || []);
      
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team. Please try again.');
    } finally {
      setCreatingTeam(false);
    }
  };
  
  // Handle sending an invitation
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeam || !inviteEmail.trim()) return;
    
    try {
      setSendingInvite(true);
      
      // In a real app, this would send an invitation email
      // For now, we'll simulate by creating a placeholder user and adding them to the team
      
      // First check if user exists
      const checkResponse = await fetch(`/api/users?email=${inviteEmail.trim()}`);
      const existingUsers = await checkResponse.json();
      
      let userId;
      
      if (existingUsers && existingUsers.length > 0) {
        // Use existing user
        userId = existingUsers[0].id;
      } else {
        // Create a placeholder user
        const createUserResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            email: inviteEmail.trim(),
            full_name: inviteEmail.split('@')[0] // Use part before @ as name
          })
        });
        
        if (!createUserResponse.ok) {
          throw new Error('Failed to create user');
        }
        
        const newUser = await createUserResponse.json();
        userId = newUser.id;
      }
      
      // Add user to team
      const addMemberResponse = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_member',
          teamId: selectedTeam.id,
          userId: userId,
          role: inviteRole
        })
      });
      
      if (!addMemberResponse.ok) {
        throw new Error('Failed to add team member');
      }
      
      // Refresh team members
      const membersResponse = await fetch(`/api/team-members?teamId=${selectedTeam.id}`);
      const membersData = await membersResponse.json();
      setTeamMembers(membersData || []);
      
      // Reset form
      setInviteEmail('');
      setShowInviteForm(false);
      
    } catch (err) {
      console.error('Error inviting team member:', err);
      setError('Failed to invite team member. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };
  
  // Handle removing a team member
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam || !window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }
    
    try {
      const member = teamMembers.find(m => m.id === memberId);
      
      if (!member) return;
      
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          teamId: selectedTeam.id,
          userId: member.user_id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove team member');
      }
      
      // Update the UI
      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
      
    } catch (err) {
      console.error('Error removing team member:', err);
      setError('Failed to remove team member. Please try again.');
    }
  };
  
  // Handle changing a member's role
  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!selectedTeam) return;
    
    try {
      const member = teamMembers.find(m => m.id === memberId);
      
      if (!member) return;
      
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_role',
          teamId: selectedTeam.id,
          userId: member.user_id,
          role: newRole
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update member role');
      }
      
      // Update the UI
      setTeamMembers(teamMembers.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
      
    } catch (err) {
      console.error('Error updating member role:', err);
      setError('Failed to update member role. Please try again.');
    }
  };
  
  // Format the "last active" timestamp
  const formatLastActive = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} hour${Math.floor(diffHours) === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  if (loading && teams.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Team Management</h1>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading team data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Team Management</h1>
            
            {teams.length > 0 && (
              <button
                onClick={() => setShowNewTeamForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create New Team
              </button>
            )}
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {/* New Team Form */}
          {showNewTeamForm && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
              
              <form onSubmit={handleCreateTeam}>
                <div className="mb-4">
                  <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name
                  </label>
                  <input
                    id="teamName"
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowNewTeamForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={creatingTeam}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={creatingTeam || !newTeamName.trim()}
                  >
                    {creatingTeam ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Team Selection */}
          {teams.length > 1 && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex items-center">
                <label htmlFor="teamSelect" className="block text-sm font-medium text-gray-700 mr-3">
                  Select Team:
                </label>
                <select
                  id="teamSelect"
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const team = teams.find(t => t.id === e.target.value);
                    if (team) setSelectedTeam(team);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          {/* Team Members */}
          {selectedTeam && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{selectedTeam.name} - Team Members</h2>
                  <button
                    onClick={() => setShowInviteForm(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add Team Member
                  </button>
                </div>
              </div>
              
              {/* Invite Form */}
              {showInviteForm && (
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-medium mb-3">Invite Team Member</h3>
                  
                  <form onSubmit={handleInviteMember}>
                    <div className="grid gap-4 mb-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          id="inviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          id="inviteRole"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        disabled={sendingInvite}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        disabled={sendingInvite || !inviteEmail.trim()}
                      >
                        {sendingInvite ? 'Sending...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {/* Team Members List */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slack Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Active
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teamMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No team members yet. Add your first team member using the button above.
                        </td>
                      </tr>
                    ) : (
                      teamMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {member.users.full_name || 'Unnamed User'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{member.users.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={member.role}
                              onChange={(e) => handleChangeRole(member.id, e.target.value)}
                              className="text-sm px-2 py-1 border border-gray-300 rounded"
                              disabled={member.users.id === user?.id} // Can't change own role
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {member.users.slack_user_id ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Connected
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                Not Connected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatLastActive(member.users.last_active)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {/* Cannot remove yourself */}
                            {member.users.id !== user?.id && (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}