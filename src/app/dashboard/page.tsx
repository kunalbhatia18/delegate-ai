'use client';

import Link from 'next/link';
import RouteGuard from '@/components/auth/RouteGuard';

export default function DashboardPage() {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
            <p className="mb-4">
              Welcome to DelegateAI! Your AI-powered task delegation system.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Connect Slack</h3>
                <p className="text-gray-600 mb-4">
                  Connect your Slack workspace to start detecting and delegating tasks.
                </p>
                <Link 
                  href="/dashboard/connect-slack"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Connect Slack
                </Link>
              </div>
              
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Manage Team</h3>
                <p className="text-gray-600 mb-4">
                  Add team members and assign skills to improve task matching.
                </p>
                <Link 
                  href="/dashboard/team"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  Manage Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}