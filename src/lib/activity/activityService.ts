import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

interface ActivityRecord {
  userId: string;
  timestamp: string;
  source: 'slack' | 'webapp' | 'task_completion';
  details?: string;
}

// Record user activity
export async function recordActivity(
  userId: string,
  source: 'slack' | 'webapp' | 'task_completion',
  details?: string
): Promise<boolean> {
  // Update the last_active field in the users table
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ last_active: new Date().toISOString() })
    .eq('id', userId);
    
  if (updateError) {
    console.error('Error updating user last_active:', updateError);
    return false;
  }
  
  return true;
}

// Get user's last activity time
export async function getLastActivity(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('last_active')
    .eq('id', userId)
    .single();
    
  if (error || !data) {
    console.error('Error fetching user last activity:', error);
    return null;
  }
  
  return data.last_active;
}

// Get recently active users in a team
export async function getRecentlyActiveUsers(
  teamId: string,
  hoursThreshold: number = 24
): Promise<{ id: string; full_name: string; last_active: string }[]> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);
  
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      users:user_id (id, full_name, last_active)
    `)
    .eq('team_id', teamId)
    .gte('users.last_active', thresholdDate.toISOString());
    
  if (error) {
    console.error('Error fetching recently active users:', error);
    return [];
  }
  
  return data.map((item: any) => item.users);
}

// Get user's activity score (0-100) based on recent activity
export async function getUserActivityScore(userId: string): Promise<number> {
  const { data: userData } = await supabase
    .from('users')
    .select('last_active')
    .eq('id', userId)
    .single();
    
  if (!userData || !userData.last_active) {
    return 0; // No activity recorded
  }
  
  const lastActive = new Date(userData.last_active);
  const now = new Date();
  const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
  
  // Score decreases as time since activity increases
  // 0 hours = 100 score, 24 hours = 50 score, 72 hours = 0 score
  const score = Math.max(0, 100 - (hoursSinceActive / 72) * 100);
  
  return Math.round(score);
}