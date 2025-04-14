'use client';

import React from 'react';

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: number;
  changeLabel?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
}

export default function AnalyticsCard({
  title,
  value,
  icon,
  change,
  changeLabel,
  color = 'blue'
}: AnalyticsCardProps) {
  // Get color classes based on color prop
  const getBgColor = () => {
    switch (color) {
      case 'blue': return 'bg-blue-50';
      case 'green': return 'bg-green-50';
      case 'red': return 'bg-red-50';
      case 'yellow': return 'bg-yellow-50';
      case 'purple': return 'bg-purple-50';
      case 'gray': return 'bg-gray-50';
      default: return 'bg-blue-50';
    }
  }
  
  const getIconColor = () => {
    switch (color) {
      case 'blue': return 'text-blue-500';
      case 'green': return 'text-green-500';
      case 'red': return 'text-red-500';
      case 'yellow': return 'text-yellow-500';
      case 'purple': return 'text-purple-500';
      case 'gray': return 'text-gray-500';
      default: return 'text-blue-500';
    }
  }
  
  const getChangeColor = () => {
    if (!change) return '';
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  }
  
  const getChangeIcon = () => {
    if (!change) return null;
    
    return change >= 0 ? (
      <svg className="w-3 h-3 me-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 14">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13V1m0 0L1 5m4-4 4 4"/>
      </svg>
    ) : (
      <svg className="w-3 h-3 me-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 14">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 1v12m0 0 4-4m-4 4L1 9"/>
      </svg>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
          <p className="text-2xl font-bold">{value}</p>
          
          {change !== undefined && (
            <div className={`flex items-center text-sm mt-2 ${getChangeColor()}`}>
              {getChangeIcon()}
              <span>{Math.abs(change).toFixed(1)}%</span>
              {changeLabel && <span className="ml-1 text-gray-500">{changeLabel}</span>}
            </div>
          )}
        </div>
        
        {icon && (
          <div className={`${getBgColor()} ${getIconColor()} p-3 rounded-full`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}