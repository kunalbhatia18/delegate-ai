import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_completed' | 'task_updated' | 'system' | 'other';
  read: boolean;
  created_at: string;
  action_url?: string;
  related_entity_id?: string;
}

/**
 * Create a new notification for a user
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'task_assigned' | 'task_completed' | 'task_updated' | 'system' | 'other',
  actionUrl?: string,
  relatedEntityId?: string
): Promise<Notification | null> {
  try {
    const { data, error } = await adminSupabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
        action_url: actionUrl,
        related_entity_id: relatedEntityId
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in createNotification:', error);
    return null;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 10,
  includeRead: boolean = false
): Promise<Notification[]> {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (!includeRead) {
      query = query.eq('read', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    return [];
  }
}

/**
 * Get the count of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
      
    if (error) {
      console.error('Error counting notifications:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadNotificationCount:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
      
    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
      
    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error);
    return false;
  }
}

/**
 * Create a task assigned notification
 */
export async function createTaskAssignedNotification(
  userId: string,
  taskId: string,
  taskTitle: string,
  delegatorName: string
): Promise<Notification | null> {
  return createNotification(
    userId,
    'New Task Assigned',
    `${delegatorName} assigned you a new task: ${taskTitle}`,
    'task_assigned',
    `/dashboard/tasks/${taskId}`,
    taskId
  );
}

/**
 * Create a task completed notification
 */
export async function createTaskCompletedNotification(
  userId: string,
  taskId: string,
  taskTitle: string,
  assigneeName: string
): Promise<Notification | null> {
  return createNotification(
    userId,
    'Task Completed',
    `${assigneeName} completed the task: ${taskTitle}`,
    'task_completed',
    `/dashboard/tasks/${taskId}`,
    taskId
  );
}

/**
 * Create a task status updated notification
 */
export async function createTaskStatusUpdatedNotification(
  userId: string,
  taskId: string,
  taskTitle: string,
  status: string,
  updaterName: string
): Promise<Notification | null> {
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);
  
  return createNotification(
    userId,
    `Task ${statusText}`,
    `${updaterName} has ${status} the task: ${taskTitle}`,
    'task_updated',
    `/dashboard/tasks/${taskId}`,
    taskId
  );
}