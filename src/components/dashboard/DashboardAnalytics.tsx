'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AnalyticsCard from './AnalyticsCard';
import TaskStatusChart from './TaskStatusChart';
import TaskTrendChart from './TaskTrendChart';
import TeamPerformance from './TeamPerformance';
import TimeSavedChart from './TimeSavedChart';

export default function DashboardAnalytics() {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // First, get the user's team
  useEffect(() => {
    async function getTeam() {
      if (!user) return;
      
      try {
        const response = await fetch('/api/team?userId=' + user.id);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          setTeamId(data[0].team_id);
        }
      } catch (err) {
        console.error('Error fetching team:', err);
        setError('Failed to load team data');
      }
    }
    
    getTeam();
  }, [user]);
  
  // Then, get the team analytics
  useEffect(() => {
    async function getAnalytics() {
      if (!teamId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?type=team&teamId=${teamId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }
    
    if (teamId) {
      getAnalytics();
    }
  }, [teamId]);
  
  if (!teamId) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome to your Dashboard</h2>
        <p>
          You need to be part of a team to see analytics. Please create or join a team first.
        </p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard Analytics</h2>
        <div className="flex justify-center py-8">
          <div className="text-gray-500">Loading analytics data...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard Analytics</h2>
        <div className="flex justify-center py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Total Tasks"
          value={analytics?.totalTasks || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
          }
          color="blue"
          change={analytics?.weeklyChange}
          changeLabel="vs last week"
        />
        
        <AnalyticsCard
          title="Completed Tasks"
          value={analytics?.completedTasks || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          }
          color="green"
        />
        
        <AnalyticsCard
          title="Pending Tasks"
          value={analytics?.pendingTasks || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          }
          color="yellow"
        />
        
        <AnalyticsCard
          title="Hours Saved"
          value={analytics?.timeSaved?.toFixed(1) || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          }
          color="purple"
        />
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <TaskStatusChart teamId={teamId} />
        <TaskTrendChart teamId={teamId} />
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <TimeSavedChart />
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-medium mb-4">Delegation Stats</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Delegation Rate</span>
                <span className="text-sm font-medium">{analytics?.delegationRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${analytics?.delegationRate || 0}%` }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Percentage of tasks that have been delegated
              </p>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-sm font-medium">{analytics?.completionRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${analytics?.completionRate || 0}%` }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Percentage of delegated tasks that are completed
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <TeamPerformance teamId={teamId} />
    </div>
  );
}