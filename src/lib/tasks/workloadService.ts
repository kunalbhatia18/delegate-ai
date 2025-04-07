import { supabase } from '@/lib/supabase/client';

// Get the number of active tasks for a user
export async function getActiveTaskCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact' })
      .eq('assignee_id', userId)
      .in('status', ['assigned', 'accepted']);
      
    if (error) {
      console.error('Error counting active tasks:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error getting active tasks:', error);
    return 0;
  }
}

// Get the team's average active task count
export async function getTeamAverageTaskCount(teamId: string): Promise<number> {
  try {
    // First get all team members
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);
      
    if (teamError || !teamMembers || teamMembers.length === 0) {
      console.error('Error fetching team members:', teamError);
      return 0;
    }
    
    // Get task counts for each team member
    const userIds = teamMembers.map(tm => tm.user_id);
    
    // We need to handle the group by differently
    // First, let's get all tasks for these users
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('assignee_id')
      .in('assignee_id', userIds)
      .in('status', ['assigned', 'accepted']);
      
    if (tasksError) {
      console.error('Error fetching team tasks:', tasksError);
      return 0;
    }
    
    if (!tasks || tasks.length === 0) {
      return 0;
    }
    
    // Now manually count tasks per user
    const taskCounts: Record<string, number> = {};
    tasks.forEach(task => {
      if (task.assignee_id) {
        taskCounts[task.assignee_id] = (taskCounts[task.assignee_id] || 0) + 1;
      }
    });
    
    // Calculate average
    const taskCountValues = Object.values(taskCounts);
    if (taskCountValues.length === 0) return 0;
    
    const totalTasks = taskCountValues.reduce((sum: number, count: number) => sum + count, 0);
    return Math.round(totalTasks / teamMembers.length);
  } catch (error) {
    console.error('Error calculating team average:', error);
    return 0;
  }
}

// Calculate a workload score for a user (0-100, lower is better for new assignments)
export async function getUserWorkloadScore(
  userId: string,
  teamId: string
): Promise<number> {
  try {
    const activeTaskCount = await getActiveTaskCount(userId);
    const teamAverage = await getTeamAverageTaskCount(teamId);
    
    if (teamAverage === 0) {
      // No team average to compare against, so use absolute scale
      // 0 tasks = 0 score, 5 tasks = 50 score, 10+ tasks = 100 score
      return Math.min(100, (activeTaskCount / 10) * 100);
    }
    
    // Calculate relative to team average
    // 0% of average = 0 score, 100% of average = 50 score, 200%+ of average = 100 score
    const relativeWorkload = activeTaskCount / teamAverage;
    const score = Math.min(100, (relativeWorkload / 2) * 100);
    
    return Math.round(score);
  } catch (error) {
    console.error('Error calculating workload score:', error);
    return 50; // Default to middle score if error
  }
}