import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { AssigneeScore } from './assigneeMatchingService';
import { recordActivity } from '../activity/activityService';
import { 
  createTaskAssignedNotification, 
  createTaskCompletedNotification,
  createTaskStatusUpdatedNotification
} from '../notifications/notificationService';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'assigned' | 'accepted' | 'completed' | 'declined';
  delegator_id: string;
  assignee_id?: string;
  team_id: string;
  due_date?: string;
  slack_ts?: string;
  slack_channel?: string;
  completion_date?: string;
  estimated_time?: number;
  created_at: string;
  updated_at: string;
  delegator?: {
    id: string;
    full_name: string;
    email: string;
    slack_user_id?: string;
  };
  assignee?: {
    id: string;
    full_name: string;
    email: string;
    slack_user_id?: string;
  };
}

export interface TaskCreateParams {
  title: string;
  description?: string;
  delegator_id: string;
  assignee_id?: string;
  team_id: string;
  due_date?: string;
  slack_ts?: string;
  slack_channel?: string;
  estimated_time?: number;
}

export async function createTask(params: TaskCreateParams): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: params.title,
        description: params.description,
        delegator_id: params.delegator_id,
        assignee_id: params.assignee_id,
        team_id: params.team_id,
        due_date: params.due_date,
        slack_ts: params.slack_ts,
        slack_channel: params.slack_channel,
        estimated_time: params.estimated_time,
        status: params.assignee_id ? 'assigned' : 'pending'
      })
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .single();
      
    if (error) throw error;
    
    // Record activity for task creation
    await recordActivity(params.delegator_id, 'webapp', 'Created task');
    
    // If the task is assigned, send a notification
    if (params.assignee_id && data?.assignee?.id && data?.delegator?.full_name) {
      // Get delegator's name for the notification
      const delegatorName = data.delegator.full_name || 'A team member';
      
      // Create a notification for the assignee
      await createTaskAssignedNotification(
        params.assignee_id,
        data.id,
        data.title,
        delegatorName
      );
    }
    
    return data;
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .eq('id', taskId)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching task:', error);
    return null;
  }
}

export async function getTasksByAssignee(assigneeId: string): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id)
      `)
      .eq('assignee_id', assigneeId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching assignee tasks:', error);
    return [];
  }
}

export async function getTasksByDelegator(delegatorId: string): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .eq('delegator_id', delegatorId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching delegator tasks:', error);
    return [];
  }
}

export async function getTeamTasks(teamId: string): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching team tasks:', error);
    return [];
  }
}

export async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'assigned' | 'accepted' | 'completed' | 'declined',
  userId: string
): Promise<Task | null> {
  try {
    // First get the current task to get delegator and assignee info
    const currentTask = await getTaskById(taskId);
    
    if (!currentTask) {
      throw new Error('Task not found');
    }
    
    const updates: any = { status };
    
    // Add completion date if the task is being marked as completed
    if (status === 'completed') {
      updates.completion_date = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .single();
      
    if (error) throw error;
    
    // Record activity based on the status change
    let activityDetails = `Changed task status to ${status}`;
    if (status === 'completed') {
      await recordActivity(userId, 'task_completion', 'Completed task');
    } else {
      await recordActivity(userId, 'webapp', activityDetails);
    }
    
    // Send notifications based on status changes
    if (data) {
      // Get the user who made the change
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      const userFullName = userData?.full_name || 'A team member';
      
      // Notification logic based on status
      if (status === 'completed' && currentTask.delegator_id) {
        // Notify delegator when task is completed
        await createTaskCompletedNotification(
          currentTask.delegator_id,
          taskId,
          currentTask.title,
          userFullName
        );
      } else if ((status === 'accepted' || status === 'declined') && currentTask.delegator_id) {
        // Notify delegator when task is accepted or declined
        await createTaskStatusUpdatedNotification(
          currentTask.delegator_id,
          taskId,
          currentTask.title,
          status,
          userFullName
        );
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error updating task status:', error);
    return null;
  }
}

export async function assignTask(taskId: string, assigneeId: string): Promise<Task | null> {
  try {
    // First get the current task to get the title
    const currentTask = await getTaskById(taskId);
    
    if (!currentTask) {
      throw new Error('Task not found');
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        assignee_id: assigneeId,
        status: 'assigned'
      })
      .eq('id', taskId)
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .single();
      
    if (error) throw error;
    
    // Get delegator name for notification
    let delegatorName = 'A team member';
    
    if (data && data.delegator && data.delegator.full_name) {
      delegatorName = data.delegator.full_name;
    }
    
    // Send notification to assignee
    if (data && assigneeId) {
      await createTaskAssignedNotification(
        assigneeId,
        taskId,
        currentTask.title,
        delegatorName
      );
    }
    
    return data;
  } catch (error) {
    console.error('Error assigning task:', error);
    return null;
  }
}

export async function updateTaskDueDate(taskId: string, dueDate: string): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ due_date: dueDate })
      .eq('id', taskId)
      .select(`
        *,
        delegator:delegator_id(id, full_name, email, slack_user_id),
        assignee:assignee_id(id, full_name, email, slack_user_id)
      `)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error updating task due date:', error);
    return null;
  }
}

export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
}