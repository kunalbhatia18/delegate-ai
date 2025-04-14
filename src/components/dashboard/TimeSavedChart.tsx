'use client';

import React, { useState, useEffect } from 'react';
import { getUserAnalytics } from '@/lib/analytics/analyticsService';
import { useAuth } from '@/hooks/useAuth';

export default function TimeSavedChart() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<{
    tasksCreated: number;
    timeSaved: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?type=user&userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user analytics');
        }
        
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error fetching user analytics:', err);
        setError('Failed to load time saved data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user]);
  
  // Calculate equivalent activities
  const getEquivalentActivities = (hours: number) => {
    if (hours <= 0) return [];
    
    const activities = [
      {
        name: 'Client meetings',
        hoursPerUnit: 1,
        icon: '👥',
      },
      {
        name: 'Email processing',
        hoursPerUnit: 0.5,
        icon: '📧',
      },
      {
        name: 'Presentations prepared',
        hoursPerUnit: 4,
        icon: '📊',
      },
      {
        name: 'Strategic planning sessions',
        hoursPerUnit: 2,
        icon: '🧩',
      },
      {
        name: 'Design reviews',
        hoursPerUnit: 1.5,
        icon: '🎨',
      }
    ];
    
    return activities.map(activity => {
      const units = Math.floor(hours / activity.hoursPerUnit);
      return {
        ...activity,
        units: Math.max(units, 0)
      };
    }).filter(activity => activity.units > 0);
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading time saved data...</div>
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
  
  if (!analytics || analytics.timeSaved <= 0) {
    return (
      <div className="bg-white rounded-lg shadow p-5 h-64 flex items-center justify-center">
        <div className="text-gray-500">
          No time saved data available yet. Start delegating tasks to see your time savings!
        </div>
      </div>
    );
  }
  
  const equivalentActivities = getEquivalentActivities(analytics.timeSaved);
  
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-lg font-medium mb-4">Your Time Savings</h3>
      
      <div className="flex justify-center my-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-blue-600">
            {analytics.timeSaved.toFixed(1)}
          </div>
          <div className="text-gray-500 mt-2">
            hours saved through delegation
          </div>
        </div>
      </div>
      
      {equivalentActivities.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Time saved is equivalent to:</h4>
          
          <div className="space-y-3">
            {equivalentActivities.map((activity, index) => (
              <div key={index} className="flex items-center">
                <div className="text-2xl mr-3">{activity.icon}</div>
                <div>
                  <span className="font-bold">{activity.units}</span> {activity.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-center text-gray-500">
        Based on {analytics.tasksCreated} tasks you've delegated
      </div>
    </div>
  );
}