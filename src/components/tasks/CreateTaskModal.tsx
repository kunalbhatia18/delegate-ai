'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface CreateTaskModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
}

export default function CreateTaskModal({ onClose, onTaskCreated }: CreateTaskModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch user's teams and team members
  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        // Get user's teams
        const teamsResponse = await fetch(`/api/team?userId=${user.id}`);
        
        if (!teamsResponse.ok) {
          throw new Error('Failed to fetch teams');
        }
        
        const teamsData = await teamsResponse.json();
        
        if (teamsData && teamsData.length > 0) {
          setTeams(teamsData);
          
          // Set default team
          const defaultTeam = teamsData[0].team_id;
          setTeamId(defaultTeam);
          
          // Get team members
          const membersResponse = await fetch(`/api/team-members?teamId=${defaultTeam}`);
          
          if (!membersResponse.ok) {
            throw new Error('Failed to fetch team members');
          }
          
          const membersData = await membersResponse.json();
          setTeamMembers(membersData || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load teams or members');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user]);
  
  // Handle team change
  const handleTeamChange = async (newTeamId: string) => {
    setTeamId(newTeamId);
    setAssigneeId(''); // Reset selected assignee
    
    try {
      // Get team members for the selected team
      const membersResponse = await fetch(`/api/team-members?teamId=${newTeamId}`);
      
      if (!membersResponse.ok) {
        throw new Error('Failed to fetch team members');
      }
      
      const membersData = await membersResponse.json();
      setTeamMembers(membersData || []);
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError('Failed to load team members');
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !title.trim() || !teamId) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      const taskData = {
        action: 'create',
        title: title.trim(),
        description: description.trim() || null,
        delegator_id: user.id,
        team_id: teamId,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        estimated_time: estimatedTime ? parseInt(estimatedTime) : null
      };
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create task');
      }
      
      // Notify parent of successful creation
      onTaskCreated();
      
      // Close the modal
      onClose();
      
    } catch (err) {
      console.error('Error creating task:', err);
      setError('Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Create New Task</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="text-center py-4">Loading team data...</div>
          ) : teams.length === 0 ? (
            <div className="text-center py-4">
              <p className="mb-4">You need to be part of a team to create tasks.</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Task Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Team */}
                  <div>
                    <label htmlFor="team" className="block text-sm font-medium text-gray-700 mb-1">
                      Team *
                    </label>
                    <select
                      id="team"
                      value={teamId}
                      onChange={(e) => handleTeamChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {teams.map((team) => (
                        <option key={team.team_id} value={team.team_id}>
                          {team.teams?.name || 'Unnamed Team'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Assignee */}
                  <div>
                    <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 mb-1">
                      Assignee (Optional)
                    </label>
                    <select
                      id="assignee"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers
                        .filter(member => member.user_id !== user?.id) // Don't show self
                        .map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.users?.full_name || member.users?.email || 'Unknown User'}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  
                  {/* Due Date */}
                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date (Optional)
                    </label>
                    <input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Estimated Time */}
                  <div>
                    <label htmlFor="estimatedTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Time (Minutes, Optional)
                    </label>
                    <input
                      id="estimatedTime"
                      type="number"
                      min="0"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={submitting || !title.trim() || !teamId}
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}