'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function TaskDetailPage() {
  // Use the useParams hook instead of directly accessing params
  const params = useParams();
  const taskId = params?.id as string;
  
  const { user } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{text: string, type: 'success' | 'error' | 'info'}|null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to force refresh

  useEffect(() => {
    async function fetchTaskDetails() {
      if (!user || !taskId) return;
      
      try {
        setLoading(true);
        
        const response = await fetch(`/api/tasks?taskId=${taskId}`);
        
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
  }, [user, taskId, refreshKey]); // Added refreshKey to dependencies
  
  async function handleStatusUpdate(newStatus: string) {
    if (!user || !task) return;
    
    // Clear any previous action messages
    setActionMessage(null);
    
    // Handle the case where a user tries to complete a task that hasn't been accepted
    if (newStatus === 'completed' && task.status === 'assigned') {
      setActionMessage({
        text: 'You need to accept this task before marking it as completed. Please click "Accept Task" first.',
        type: 'info'
      });
      return;
    }
    
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
        // Try to get the detailed error message from the response
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update task status');
        } catch (jsonError) {
          throw new Error('Failed to update task status');
        }
      }
      
      const updatedTask = await response.json();
      setTask(updatedTask);
      
      // Show success message
      setActionMessage({
        text: `Task ${newStatus === 'completed' ? 'marked as complete' : 
               newStatus === 'accepted' ? 'accepted' : 
               newStatus === 'declined' ? 'declined' : 'status updated'}!`,
        type: 'success'
      });
      
      // Force a refresh to ensure we have the latest state
      setRefreshKey(prevKey => prevKey + 1);
      
    } catch (error) {
      console.error('Error updating task status:', error);
      setActionMessage({
        text: (error as Error).message || 'Failed to update task status. Please try again.',
        type: 'error'
      });
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
  
  // For better UX, show buttons based on task status and user role
  const isActionable = isAssignee && task.status !== 'completed' && task.status !== 'declined';
  
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
        {/* Action message with appropriate styling based on type */}
        {actionMessage && (
          <div className={`mb-4 p-3 rounded-md ${
            actionMessage.type === 'success' ? 'bg-green-100 text-green-700' :
            actionMessage.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {actionMessage.text}
          </div>
        )}
        
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
        
        {/* Task Action Panel - Shown only if user is assignee and task is not in terminal state */}
        {isActionable && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-3">Task Actions</h3>
            
            {/* Workflow status indicator */}
            <div className="mb-4 flex items-center">
              <div className="flex items-center justify-between w-full max-w-md">
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
                    task.status === 'assigned' || task.status === 'accepted' || task.status === 'completed' 
                      ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    1
                  </div>
                  <p className="text-xs mt-1">Assigned</p>
                </div>
                <div className="flex-1 h-1 bg-gray-200 mx-2">
                  <div className={`h-1 ${
                    task.status === 'accepted' || task.status === 'completed' 
                      ? 'bg-blue-500' : 'bg-gray-200'
                  }`} style={{width: '100%'}}></div>
                </div>
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
                    task.status === 'accepted' || task.status === 'completed' 
                      ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    2
                  </div>
                  <p className="text-xs mt-1">Accepted</p>
                </div>
                <div className="flex-1 h-1 bg-gray-200 mx-2">
                  <div className={`h-1 ${
                    task.status === 'completed' 
                      ? 'bg-purple-500' : 'bg-gray-200'
                  }`} style={{width: '100%'}}></div>
                </div>
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
                    task.status === 'completed' 
                      ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <p className="text-xs mt-1">Completed</p>
                </div>
              </div>
            </div>
            
            {/* Available actions based on current state */}
            <div className="flex flex-wrap gap-3">
              {task.status === 'assigned' && (
                <>
                  <button
                    onClick={() => handleStatusUpdate('accepted')}
                    disabled={updatingStatus}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept Task
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('declined')}
                    disabled={updatingStatus}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Decline Task
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('completed')}
                    disabled={updatingStatus}
                    className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
                  >
                    Mark as Completed
                  </button>
                </>
              )}
              
              {task.status === 'accepted' && (
                <button
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Mark as Completed
                </button>
              )}
            </div>
           
          </div>
        )}
        
        {/* For tasks in terminal states */}
        {isAssignee && (task.status === 'completed' || task.status === 'declined') && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-2">Task Status</h3>
            <p className="text-gray-600">
              {task.status === 'completed' 
                ? 'You have completed this task. No further actions are required.' 
                : 'You have declined this task. No further actions are available.'}
            </p>
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