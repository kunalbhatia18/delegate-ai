import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { createTask, updateTaskStatus, assignTask, updateTaskDueDate, deleteTask } from '@/lib/tasks/taskService';
import { recordActivity } from '@/lib/activity/activityService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    const assigneeId = url.searchParams.get('assigneeId');
    const delegatorId = url.searchParams.get('delegatorId');
    const teamId = url.searchParams.get('teamId');
    
    // Get a specific task
    if (taskId) {
      const { data, error } = await adminSupabase
        .from('tasks')
        .select(`
          *,
          delegator:delegator_id(id, full_name, email, slack_user_id),
          assignee:assignee_id(id, full_name, email, slack_user_id)
        `)
        .eq('id', taskId)
        .single();
        
      if (error) throw error;
      
      return NextResponse.json(data);
    }
    
    // Get tasks by assignee
    if (assigneeId) {
      const { data, error } = await adminSupabase
        .from('tasks')
        .select(`
          *,
          delegator:delegator_id(id, full_name, email, slack_user_id)
        `)
        .eq('assignee_id', assigneeId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    // Get tasks by delegator
    if (delegatorId) {
      const { data, error } = await adminSupabase
        .from('tasks')
        .select(`
          *,
          assignee:assignee_id(id, full_name, email, slack_user_id)
        `)
        .eq('delegator_id', delegatorId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    // Get tasks by team
    if (teamId) {
      const { data, error } = await adminSupabase
        .from('tasks')
        .select(`
          *,
          delegator:delegator_id(id, full_name, email, slack_user_id),
          assignee:assignee_id(id, full_name, email, slack_user_id)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, taskId, ...data } = await request.json();
    
    switch (action) {
      case 'create': {
        const task = await createTask(data);
        
        if (!task) {
          throw new Error('Failed to create task');
        }
        
        if (data.assignee_id) {
          await recordActivity(data.delegator_id, 'webapp', 'Created and assigned task');
        }
        
        return NextResponse.json(task);
      }
      
      case 'update_status': {
        if (!taskId || !data.status || !data.userId) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        
        const task = await updateTaskStatus(taskId, data.status, data.userId);
        
        if (!task) {
          throw new Error('Failed to update task status');
        }
        
        return NextResponse.json(task);
      }
      
      case 'assign': {
        if (!taskId || !data.assignee_id) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        
        const task = await assignTask(taskId, data.assignee_id);
        
        if (!task) {
          throw new Error('Failed to assign task');
        }
        
        if (data.userId) {
          await recordActivity(data.userId, 'webapp', 'Assigned task');
        }
        
        return NextResponse.json(task);
      }
      
      case 'update_due_date': {
        if (!taskId || !data.due_date) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        
        const task = await updateTaskDueDate(taskId, data.due_date);
        
        if (!task) {
          throw new Error('Failed to update due date');
        }
        
        return NextResponse.json(task);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    const success = await deleteTask(taskId);
    
    if (!success) {
      throw new Error('Failed to delete task');
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}