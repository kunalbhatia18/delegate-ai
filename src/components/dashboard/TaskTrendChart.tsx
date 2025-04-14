'use client';

import React, { useState, useEffect } from 'react';

interface TaskTrendData {
  date: string;
  count: number;
}

interface TaskTrendChartProps {
  teamId: string;
  days?: number;
}

export default function TaskTrendChart({ teamId, days = 14 }: TaskTrendChartProps) {
  const [data, setData] = useState<TaskTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?type=creation-trend&teamId=${teamId}&days=${days}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch task trend data');
        }
        
        const trendData = await response.json();
        setData(trendData);
      } catch (err) {
        console.error('Error fetching task trend:', err);
        setError('Failed to load task trend data');
      } finally {
        setLoading(false);
      }
    }
    
    if (teamId) {
      fetchData();
    }
  }, [teamId, days]);
  
  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  
  // Get max count for scaling
  const maxCount = Math.max(...data.map(item => item.count), 1);
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading trend data...</div>
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
  
  // We'll only show up to 14 data points for better visibility
  const displayData = data.slice(-days);
  
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-lg font-medium mb-4">Task Creation Trend</h3>
      
      <div className="h-48 flex items-end space-x-1">
        {displayData.map((item, index) => {
          const height = `${(item.count / maxCount) * 100}%`;
          const isToday = item.date === new Date().toISOString().split('T')[0];
          
          return (
            <div 
              key={item.date}
              className="flex flex-col items-center flex-1"
            >
              {item.count > 0 && (
                <div className="text-xs mb-1">{item.count}</div>
              )}
              <div 
                className={`w-full ${isToday ? 'bg-blue-500' : 'bg-blue-300'} rounded-t`}
                style={{ height: item.count > 0 ? height : '4px' }}
              ></div>
              <div className="text-xs mt-2 text-gray-600 transform -rotate-45 origin-top-left truncate w-20">
                {formatDate(item.date)}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-8 text-sm text-gray-500 text-center">
        Tasks created over the past {days} days
      </div>
    </div>
  );
}