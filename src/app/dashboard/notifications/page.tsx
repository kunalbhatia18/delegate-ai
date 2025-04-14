'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import RouteGuard from '@/components/auth/RouteGuard';
import { Notification } from '@/lib/notifications/notificationService';

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchNotifications() {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const response = await fetch(`/api/notifications?userId=${user.id}&limit=50&includeRead=true`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        setNotifications(data || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
    
    fetchNotifications();
  }, [user]);
  
  // Mark a notification as read and navigate to its link
  const handleNotificationClick = async (notification: Notification) => {
    if (notification.read) {
      // Already read, just navigate
      if (notification.action_url) {
        router.push(notification.action_url);
      }
      return;
    }
    
    try {
      // Mark as read
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId: notification.id
        })
      });
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
      
      // Navigate to the action URL if provided
      if (notification.action_url) {
        router.push(notification.action_url);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_all_read',
          userId: user.id
        })
      });
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return (
          <div className="bg-blue-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </div>
        );
      case 'task_completed':
        return (
          <div className="bg-green-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        );
      case 'task_updated':
        return (
          <div className="bg-yellow-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        );
      case 'system':
        return (
          <div className="bg-purple-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        );
      default:
        return (
          <div className="bg-gray-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
          </div>
        );
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return (
    <RouteGuard>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Notifications</h1>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Mark All as Read
            </button>
          )}
        </div>
        
        {loading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading notifications...</div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-center py-8 text-red-500">
              {error}
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-center py-8 text-gray-500">
              No notifications to display
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 flex items-start transition duration-150 ease-in-out ${
                  notification.read 
                    ? 'hover:bg-gray-50 cursor-pointer' 
                    : 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mr-4">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className={`text-lg ${notification.read ? 'font-medium' : 'font-bold'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{notification.message}</p>
                  {notification.action_url && (
                    <div className="mt-2">
                      <span className="text-sm text-blue-600">
                        Click to view details
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}