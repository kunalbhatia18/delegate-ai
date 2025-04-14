import { NextResponse } from 'next/server';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationCount
} from '@/lib/notifications/notificationService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action') || 'list';
    const includeRead = url.searchParams.get('includeRead') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    switch (action) {
      case 'list': {
        const notifications = await getUserNotifications(userId, limit, includeRead);
        return NextResponse.json(notifications);
      }
      
      case 'count': {
        const count = await getUnreadNotificationCount(userId);
        return NextResponse.json({ count });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, userId, notificationId } = await request.json();
    
    switch (action) {
      case 'mark_read': {
        if (!notificationId) {
          return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
        }
        
        const success = await markNotificationAsRead(notificationId);
        
        if (!success) {
          return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true });
      }
      
      case 'mark_all_read': {
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        const success = await markAllNotificationsAsRead(userId);
        
        if (!success) {
          return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}