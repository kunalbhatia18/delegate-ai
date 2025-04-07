import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { createTask, assignTask, updateTaskDueDate, deleteTask } from '@/lib/tasks/taskService';
import { recordActivity } from '@/lib/activity/activityService';

// Valid task state transitions with strict sequencing
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['assigned'],
  'assigned': ['accepted', 'declined'], // Cannot skip to completed
  'accepted': ['completed'],
  'declined': [],  // Terminal state - no transitions allowed
  'completed': []  // Terminal state - no transitions allowed
};

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

        try {
          // Log the input parameters for debugging
          console.log("Updating task status:", { taskId, status: data.status, userId: data.userId });
          
          // First check current status to ensure valid transition
          const { data: currentTask, error: fetchError } = await adminSupabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
            
          if (fetchError) {
            console.error("Error fetching current task status:", fetchError);
            throw new Error('Failed to fetch current task status');
          }
          
          if (!currentTask) {
            console.error("Task not found:", taskId);
            throw new Error('Task not found');
          }
          
          // Log detailed task state for debugging
          console.log("Current task state:", JSON.stringify(currentTask, null, 2));
          
          // Check if the transition is valid
          const currentStatus = currentTask.status;
          const targetStatus = data.status;
          
          // Get valid next states for the current status
          const validNextStates = VALID_STATUS_TRANSITIONS[currentStatus] || [];
          
          console.log(`Checking transition from '${currentStatus}' to '${targetStatus}'`);
          console.log(`Valid transitions for ${currentStatus}:`, validNextStates);
          
          if (!validNextStates.includes(targetStatus)) {
            // Custom message for trying to complete an unaccepted task
            let errorMsg;
            if (currentStatus === 'assigned' && targetStatus === 'completed') {
              errorMsg = 'You must first accept this task before marking it as completed.';
            } else {
              errorMsg = `Cannot change task status from '${currentStatus}' to '${targetStatus}'. Valid transitions are: ${validNextStates.join(', ') || 'none'}`;
            }
            console.error(errorMsg);
            return NextResponse.json({ error: errorMsg }, { status: 400 });
          }

          // Prepare updates object
          const updates: any = { 
            status: targetStatus 
          };
          
          // Add completion date if the task is being marked as completed
          if (targetStatus === 'completed') {
            updates.completion_date = new Date().toISOString();
          }
          
          console.log("Applying updates:", updates);
          
          // Update the task
          const { data: updatedTask, error } = await adminSupabase
            .from('tasks')
            .update(updates)
            .eq('id', taskId)
            .select(`
              *,
              delegator:delegator_id(id, full_name, email, slack_user_id),
              assignee:assignee_id(id, full_name, email, slack_user_id)
            `)
            .single();
            
          if (error) {
            console.error("Database error updating task status:", error);
            throw error;
          }
          
          if (!updatedTask) {
            console.error("Updated task is null even though no error was reported");
            throw new Error('Task not found or could not be updated');
          }
          
          console.log("Successfully updated task to:", updatedTask.status);
          
          // Record activity based on the status change
          try {
            if (targetStatus === 'completed') {
              await recordActivity(data.userId, 'task_completion', 'Completed task');
            } else {
              await recordActivity(data.userId, 'webapp', `Changed task status to ${targetStatus}`);
            }
          } catch (activityError) {
            console.error("Error recording activity:", activityError);
            // Continue even if activity recording fails
          }
          
          return NextResponse.json(updatedTask);
        } catch (updateError) {
          console.error("Error updating task status:", updateError);
          throw new Error('Failed to update task status: ' + (updateError as Error).message);
        }
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