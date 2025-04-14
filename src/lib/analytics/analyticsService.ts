import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

export interface AnalyticsSummary {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  delegationRate: number; // Percentage of tasks that have been delegated
  completionRate: number; // Percentage of delegated tasks that are completed
  timeSaved: number; // Estimated hours saved in total
  tasksThisWeek: number;
  tasksLastWeek: number;
  weeklyChange: number; // Percentage change from last week
}

export interface TeamMemberAnalytics {
  userId: string;
  fullName: string;
  email: string;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  avgCompletionTime: number; // In hours
  timeSaved: number; // Estimated hours saved
}

/**
 * Get analytics summary for a team
 */
export async function getTeamAnalytics(teamId: string): Promise<AnalyticsSummary> {
  try {
    // Get all tasks for the team
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('team_id', teamId);
      
    if (error) throw error;
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // Count tasks
    const totalTasks = tasks ? tasks.length : 0;
    const completedTasks = tasks ? tasks.filter(task => task.status === 'completed').length : 0;
    const pendingTasks = tasks ? tasks.filter(task => 
      task.status !== 'completed' && task.status !== 'declined'
    ).length : 0;
    
    // Count tasks in different time periods
    const tasksThisWeek = tasks ? tasks.filter(task => 
      new Date(task.created_at) >= oneWeekAgo
    ).length : 0;
    
    const tasksLastWeek = tasks ? tasks.filter(task => 
      new Date(task.created_at) >= twoWeeksAgo && 
      new Date(task.created_at) < oneWeekAgo
    ).length : 0;
    
    // Calculate rates
    const delegationRate = totalTasks > 0 ? 
      (tasks.filter(task => task.status !== 'pending').length / totalTasks) * 100 : 0;
      
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    // Calculate weekly change
    const weeklyChange = tasksLastWeek > 0 ? 
      ((tasksThisWeek - tasksLastWeek) / tasksLastWeek) * 100 : 
      (tasksThisWeek > 0 ? 100 : 0);
    
    // Calculate time saved (estimated 45 minutes per completed task)
    const timeSaved = completedTasks * 0.75;
    
    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      delegationRate,
      completionRate,
      timeSaved,
      tasksThisWeek,
      tasksLastWeek,
      weeklyChange
    };
  } catch (error) {
    console.error('Error getting team analytics:', error);
    // Return empty analytics
    return {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      delegationRate: 0,
      completionRate: 0,
      timeSaved: 0,
      tasksThisWeek: 0,
      tasksLastWeek: 0,
      weeklyChange: 0
    };
  }
}

/**
 * Get analytics for a specific user
 */
export async function getUserAnalytics(userId: string): Promise<{
  tasksAssigned: number;
  tasksCompleted: number;
  tasksCreated: number;
  timeSaved: number;
}> {
  try {
    // Get tasks assigned to user
    const { data: assignedTasks, error: assignedError } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignee_id', userId);
      
    if (assignedError) throw assignedError;
    
    // Get tasks created by user
    const { data: createdTasks, error: createdError } = await supabase
      .from('tasks')
      .select('*')
      .eq('delegator_id', userId);
      
    if (createdError) throw createdError;
    
    const tasksAssigned = assignedTasks ? assignedTasks.length : 0;
    const tasksCompleted = assignedTasks ? 
      assignedTasks.filter(task => task.status === 'completed').length : 0;
    const tasksCreated = createdTasks ? createdTasks.length : 0;
    
    // Estimate time saved (45 minutes per task delegated)
    const timeSaved = tasksCreated * 0.75;
    
    return {
      tasksAssigned,
      tasksCompleted,
      tasksCreated,
      timeSaved
    };
  } catch (error) {
    console.error('Error getting user analytics:', error);
    return {
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksCreated: 0,
      timeSaved: 0
    };
  }
}

/**
 * Get analytics for each team member
 */
export async function getTeamMemberAnalytics(teamId: string): Promise<TeamMemberAnalytics[]> {
  try {
    // Get team members
    const { data: teamMembers, error: membersError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        users:user_id(id, full_name, email)
      `)
      .eq('team_id', teamId);
      
    if (membersError) throw membersError;
    if (!teamMembers || teamMembers.length === 0) return [];
    
    // Get all tasks for the team
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('team_id', teamId);
      
    if (tasksError) throw tasksError;
    if (!tasks) return [];
    
    // Calculate analytics for each member
    const memberAnalytics: TeamMemberAnalytics[] = [];
    
    for (const member of teamMembers) {
      const userId = member.user_id;
      const user = member.users as any;
      
      // Get tasks assigned to this member
      const assignedTasks = tasks.filter(task => task.assignee_id === userId);
      const completedTasks = assignedTasks.filter(task => task.status === 'completed');
      const tasksAssigned = assignedTasks.length;
      const tasksCompleted = completedTasks.length;
      
      // Calculate completion rate
      const completionRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0;
      
      // Calculate average completion time (for completed tasks with completion date)
      let totalCompletionHours = 0;
      let tasksWithCompletionTime = 0;
      
      for (const task of completedTasks) {
        if (task.completion_date && task.created_at) {
          const createdDate = new Date(task.created_at);
          const completedDate = new Date(task.completion_date);
          
          const hoursDiff = (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff > 0 && hoursDiff < 720) { // Cap at 30 days to avoid outliers
            totalCompletionHours += hoursDiff;
            tasksWithCompletionTime++;
          }
        }
      }
      
      const avgCompletionTime = tasksWithCompletionTime > 0 ? 
        totalCompletionHours / tasksWithCompletionTime : 0;
      
      // Calculate tasks created by this member
      const tasksCreated = tasks.filter(task => task.delegator_id === userId).length;
      
      // Estimate time saved (45 minutes per task delegated)
      const timeSaved = tasksCreated * 0.75;
      
      memberAnalytics.push({
        userId,
        fullName: user.full_name || 'Unknown',
        email: user.email || '',
        tasksAssigned,
        tasksCompleted,
        completionRate,
        avgCompletionTime,
        timeSaved
      });
    }
    
    // Sort by number of completed tasks (highest first)
    memberAnalytics.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    
    return memberAnalytics;
  } catch (error) {
    console.error('Error getting team member analytics:', error);
    return [];
  }
}

/**
 * Get task distribution by status
 */
export async function getTaskStatusDistribution(teamId: string): Promise<{
  status: string;
  count: number;
}[]> {
  try {
    // Get all tasks for the team
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('status')
      .eq('team_id', teamId);
      
    if (error) throw error;
    if (!tasks) return [];
    
    // Count tasks by status
    const statusCounts: Record<string, number> = {
      'pending': 0,
      'assigned': 0,
      'accepted': 0,
      'completed': 0,
      'declined': 0
    };
    
    for (const task of tasks) {
      if (task.status) {
        statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      }
    }
    
    // Convert to array format
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));
  } catch (error) {
    console.error('Error getting task distribution:', error);
    return [];
  }
}

/**
 * Get task creation trend over time
 */
export async function getTaskCreationTrend(
  teamId: string, 
  days: number = 30
): Promise<{
  date: string;
  count: number;
}[]> {
  try {
    // Calculate start date
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get tasks created in the time range
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('created_at')
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
      
    if (error) throw error;
    if (!tasks) return [];
    
    // Create a map of dates to task counts
    const dateCountMap: Record<string, number> = {};
    
    // Initialize all dates in the range with 0 counts
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      dateCountMap[dateString] = 0;
    }
    
    // Count tasks by date
    for (const task of tasks) {
      const dateString = new Date(task.created_at).toISOString().split('T')[0];
      dateCountMap[dateString] = (dateCountMap[dateString] || 0) + 1;
    }
    
    // Convert to array format and sort by date
    return Object.entries(dateCountMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting task creation trend:', error);
    return [];
  }
}