'use client';

import { useState } from 'react';
import TaskList from '@/components/tasks/TaskList';
import { useAuth } from '@/hooks/useAuth';

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'assigned' | 'delegated'>('assigned');
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tasks</h1>
      
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
        </nav>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <TaskList type={activeTab} />
      </div>
    </div>
  );
}