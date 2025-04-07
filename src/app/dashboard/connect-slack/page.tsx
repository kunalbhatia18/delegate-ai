'use client';

import ConnectSlack from '@/components/slack/ConnectSlack';
import RouteGuard from '@/components/auth/RouteGuard';

export default function ConnectSlackPage() {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Connect Slack</h1>
          
          <ConnectSlack />
          
          <div className="mt-8 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Setting Up Slack</h2>
            
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h3 className="font-medium text-lg">What does DelegateAI do with Slack?</h3>
                <p className="text-gray-600">DelegateAI monitors your team channels for tasks that can be delegated, matches them with the right team members, and helps you track task completion.</p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h3 className="font-medium text-lg">How does task detection work?</h3>
                <p className="text-gray-600">Our AI scans messages for delegation opportunities and suggests matches based on team members' skills and availability.</p>
              </div>
              
              <div className="border-l-4 border-yellow-500 pl-4 py-2">
                <h3 className="font-medium text-lg">Available commands</h3>
                <p className="text-gray-600">Use <code>/delegate [task] @user</code> to manually delegate tasks.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}