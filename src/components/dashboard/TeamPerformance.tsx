'use client';

import React, { useState, useEffect } from 'react';
import { TeamMemberAnalytics } from '@/lib/analytics/analyticsService';

interface TeamPerformanceProps {
  teamId: string;
}

export default function TeamPerformance({ teamId }: TeamPerformanceProps) {
  const [members, setMembers] = useState<TeamMemberAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?type=members&teamId=${teamId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team member data');
        }
        
        const memberData = await response.json();
        setMembers(memberData);
      } catch (err) {
        console.error('Error fetching team performance:', err);
        setError('Failed to load team performance data');
      } finally {
        setLoading(false);
      }
    }
    
    if (teamId) {
      fetchData();
    }
  }, [teamId]);
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-5 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading team performance data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-5 flex items-center justify-center min-h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-5 flex items-center justify-center min-h-64">
        <div className="text-gray-500">No team members data available</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-medium">Team Performance</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">Team Member</th>
              <th scope="col" className="px-6 py-3">Tasks Assigned</th>
              <th scope="col" className="px-6 py-3">Tasks Completed</th>
              <th scope="col" className="px-6 py-3">Completion Rate</th>
              <th scope="col" className="px-6 py-3">Avg. Completion Time</th>
              <th scope="col" className="px-6 py-3">Time Saved</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  {member.fullName}
                </td>
                <td className="px-6 py-4">{member.tasksAssigned}</td>
                <td className="px-6 py-4">{member.tasksCompleted}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className="mr-2">{member.completionRate.toFixed(0)}%</span>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${member.completionRate}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {member.avgCompletionTime > 0 
                    ? `${member.avgCompletionTime.toFixed(1)} hours` 
                    : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  {member.timeSaved > 0 
                    ? `${member.timeSaved.toFixed(1)} hours` 
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}