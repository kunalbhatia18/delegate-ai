import { supabase } from '@/lib/supabase/client';

export interface ActivityRecord {
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
  try {
    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_activity',
        userId,
        source,
        details
      })
    });
    
    if (!response.ok) throw new Error('Failed to record activity');
    return true;
  } catch (error) {
    console.error('Error recording activity:', error);
    return false;
  }
}

// Get user's last activity time
export async function getLastActivity(userId: string): Promise<string | null> {
  try {
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
  } catch (error) {
    console.error('Error getting last activity:', error);
    return null;
  }
}

// Get user's activity score (0-100) based on recent activity
export async function getUserActivityScore(userId: string): Promise<number> {
  try {
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
  } catch (error) {
    console.error('Error calculating activity score:', error);
    return 0;
  }
}