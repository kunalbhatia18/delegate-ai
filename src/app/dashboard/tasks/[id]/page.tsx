'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completion_date: string | null;
  estimated_time: number | null;
  slack_ts: string | null;
  slack_channel: string | null;
  delegator: {
    id: string;
    full_name: string;
    email: string;
  };
  assignee: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function fetchTaskDetails() {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const response = await fetch(`/api/tasks?taskId=${params.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch task details');
        }
        
        const data = await response.json();
        setTask(data);
      } catch (error) {
        console.error('Error fetching task details:', error);
        setError('Failed to load task details. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTaskDetails();
  }, [user, params.id]);
  
  async function handleStatusUpdate(newStatus: string) {
    if (!user || !task) return;
    
    try {
      setUpdatingStatus(true);
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_status',
          taskId: task.id,
          status: newStatus,
          userId: user.id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task status');
      }
      
      const updatedTask = await response.json();
      setTask(updatedTask);
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  }
  
  function formatDate(dateString: string | null) {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  }
  
  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  if (loading) {
    return <div className="text-center py-8">Loading task details...</div>;
  }
  
  if (error || !task) {
    return (
      <div className="text-center py-8 text-red-500">
        {error || 'Task not found'}
        <div className="mt-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  const isAssignee = user && task.assignee && user.id === task.assignee.id;
  const isDelegator = user && user.id === task.delegator.id;
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Task Details</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back
        </button>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-6 pb-4 border-b">
          <h2 className="text-2xl font-medium mb-2">{task.title}</h2>
          
          <div className="flex items-center mb-4">
            <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeColor(task.status)}`}>
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>
            
            {task.due_date && (
              <span className="ml-4 text-sm text-gray-600">
                Due: {formatDate(task.due_date)}
              </span>
            )}
          </div>
          
          {task.description && (
            <div className="text-gray-700 whitespace-pre-wrap">
              {task.description}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Delegated By</h3>
            <p>{task.delegator.full_name} ({task.delegator.email})</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned To</h3>
            <p>{task.assignee ? `${task.assignee.full_name} (${task.assignee.email})` : 'Unassigned'}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Created At</h3>
            <p>{formatDate(task.created_at)}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Last Updated</h3>
            <p>{formatDate(task.updated_at)}</p>
          </div>
          
          {task.completion_date && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Completed At</h3>
              <p>{formatDate(task.completion_date)}</p>
            </div>
          )}
          
          {task.estimated_time && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Estimated Time</h3>
              <p>{task.estimated_time} minutes</p>
            </div>
          )}
        </div>
        
        {task.slack_ts && task.slack_channel && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Slack Context</h3>
            <a
              href={`https://slack.com/archives/${task.slack_channel}/p${task.slack_ts.replace('.', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Original Slack Message
            </a>
          </div>
        )}
        
        {isAssignee && task.status !== 'completed' && task.status !== 'declined' && (
          <div className="flex space-x-4 mt-6 pt-4 border-t">
            {task.status === 'assigned' && (
              <button
                onClick={() => handleStatusUpdate('accepted')}
                disabled={updatingStatus}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Accept Task
              </button>
            )}
            
            {(task.status === 'assigned' || task.status === 'accepted') && (
              <button
                onClick={() => handleStatusUpdate('completed')}
                disabled={updatingStatus}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Mark as Completed
              </button>
            )}
            
            {task.status === 'assigned' && (
              <button
                onClick={() => handleStatusUpdate('declined')}
                disabled={updatingStatus}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Decline Task
              </button>
            )}
          </div>
        )}
        
        {isDelegator && task.status === 'completed' && (
          <div className="mt-6 pt-4 border-t">
            <button
              onClick={() => alert('This feature is coming soon!')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Similar Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}