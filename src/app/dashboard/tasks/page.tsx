'use client';

import { useState, useEffect } from 'react';
import EnhancedTaskList from '@/components/tasks/EnhancedTaskList';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import { useAuth } from '@/hooks/useAuth';

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'assigned' | 'delegated' | 'team'>('assigned');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Get user's team ID
  useEffect(() => {
    async function fetchUserTeam() {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/team?userId=${user.id}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.length > 0) {
            setTeamId(data[0].team_id);
          }
        }
      } catch (error) {
        console.error('Error fetching user team:', error);
      }
    }
    
    fetchUserTeam();
  }, [user]);
  
  const handleTaskCreated = () => {
    // Force a refresh of the task list
    setRefreshKey(prevKey => prevKey + 1);
    
    // If not already on delegated tab, switch to it
    if (activeTab !== 'delegated') {
      setActiveTab('delegated');
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Create Task
        </button>
      </div>
      
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'assigned' 
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Assigned to Me
          </button>
          <button
            onClick={() => setActiveTab('delegated')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'delegated'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Delegated by Me
          </button>
          {teamId && (
            <button
              onClick={() => setActiveTab('team')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              All Team Tasks
            </button>
          )}
        </nav>
      </div>
      
      {/* Key prop forces component re-render when tasks are created */}
      {activeTab === 'team' && teamId ? (
        <EnhancedTaskList key={`team-${refreshKey}`} type="team" teamId={teamId} />
      ) : (
        <EnhancedTaskList key={`${activeTab}-${refreshKey}`} type={activeTab} />
      )}
      
      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal 
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}