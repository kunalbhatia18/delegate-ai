'use client';

import React from 'react';
import { useState, useEffect } from 'react';

interface StatusData {
  status: string;
  count: number;
}

interface TaskStatusChartProps {
  teamId: string;
}

export default function TaskStatusChart({ teamId }: TaskStatusChartProps) {
  const [data, setData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?type=status-distribution&teamId=${teamId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch status distribution data');
        }
        
        const statusData = await response.json();
        setData(statusData);
      } catch (err) {
        console.error('Error fetching status distribution:', err);
        setError('Failed to load task status data');
      } finally {
        setLoading(false);
      }
    }
    
    if (teamId) {
      fetchData();
    }
  }, [teamId]);
  
  // Define colors for each status
  const statusColors: Record<string, string> = {
    'pending': 'bg-gray-300',
    'assigned': 'bg-blue-300',
    'accepted': 'bg-yellow-300',
    'completed': 'bg-green-300',
    'declined': 'bg-red-300'
  };
  
  // Format status labels
  const formatStatus = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading chart data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-gray-500">No task data available</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-lg font-medium mb-4">Task Status Distribution</h3>
      
      <div className="h-48 flex items-end space-x-4">
        {data.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          const height = `${Math.max(percentage, 5)}%`; // Min height of 5% for visibility
          
          return (
            <div 
              key={item.status}
              className="flex flex-col items-center flex-1"
            >
              <div className="w-full flex justify-center mb-2">
                <div className="text-sm">{item.count}</div>
              </div>
              <div 
                className={`w-full ${statusColors[item.status] || 'bg-gray-300'} rounded-t`}
                style={{ height }}
              ></div>
              <div className="text-xs mt-2 text-gray-600">{formatStatus(item.status)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}