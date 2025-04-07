'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '@/components/auth/RouteGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white h-screen shadow-md">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold text-blue-600">DelegateAI</h2>
                <p className="text-sm text-gray-500">Task Delegation System</p>
              </div>
              
              <nav className="flex-1 p-4 space-y-1">
                <Link
                  href="/dashboard"
                  className={`block px-4 py-2 rounded ${
                    pathname === '/dashboard'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/tasks"
                  className={`block px-4 py-2 rounded ${
                    pathname === '/dashboard/tasks'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Tasks
                </Link>
                <Link
                  href="/dashboard/skills"
                  className={`block px-4 py-2 rounded ${
                    pathname === '/dashboard/skills'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Skills
                </Link>
                <Link
                  href="/dashboard/team"
                  className={`block px-4 py-2 rounded ${
                    pathname === '/dashboard/team'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Team
                </Link>
                <Link
                  href="/dashboard/connect-slack"
                  className={`block px-4 py-2 rounded ${
                    pathname === '/dashboard/connect-slack'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Connect Slack
                </Link>
              </nav>
              
              <div className="p-4 border-t">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Your Profile
                </Link>
              </div>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}