import { getAllSkills, getUserSkills } from '../skills/skillService';
import { getUserActivityScore } from '../activity/activityService';
import { getUserWorkloadScore } from './workloadService';
import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

// Factor weights for scoring
const WEIGHTS = {
  SKILL_MATCH: 0.5,  // 50% - Skill relevance is most important
  ACTIVITY: 0.3,     // 30% - Recent activity is good
  WORKLOAD: 0.2      // 20% - Lower workload is preferred
};

export interface AssigneeScore {
  userId: string;
  name: string;
  slackUserId: string;
  email: string;
  skillMatchScore: number;
  activityScore: number;
  workloadScore: number; // Lower is better
  totalScore: number;
  matchReason: string;
}

// Add these interfaces to properly type the member objects
interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  slack_user_id: string | null;
}

interface TeamMember {
  user_id: string;
  users: UserData;
}

export async function findBestAssignees(
  teamId: string,
  taskText: string,
  excludeUserId?: string,
  requiredSkills: string[] = []
): Promise<AssigneeScore[]> {
  try {
    // Get team members
    const { data: teamMembers, error: teamError } = await adminSupabase
      .from('team_members')
      .select(`
        user_id,
        users:user_id(id, full_name, email, slack_user_id)
      `)
      .eq('team_id', teamId);
      
    if (teamError || !teamMembers || teamMembers.length === 0) {
      console.error('Error fetching team members:', teamError);
      return [];
    }
    
    // Filter out excluded user - with proper type annotation
    const filteredMembers = (teamMembers as TeamMember[]).filter(member => 
      member.users.id !== excludeUserId && member.users.slack_user_id
    );
    
    if (filteredMembers.length === 0) {
      return [];
    }
    
    // Get all skills
    const allSkills = await getAllSkills();
    
    // Extract keywords from task text
    const taskWords = taskText.toLowerCase().split(/\W+/).filter(word => 
      word.length > 3 && !['this', 'that', 'with', 'from', 'have', 'will'].includes(word)
    );
    
    // Match skill keywords in the task text
    const matchedSkillIds = new Map<string, number>(); // skill ID -> relevance score
    
    for (const skill of allSkills) {
      const skillKeywords = (skill.name + ' ' + (skill.description || '')).toLowerCase().split(/\W+/);
      
      let matchCount = 0;
      for (const keyword of skillKeywords) {
        if (keyword.length > 3 && taskWords.includes(keyword)) {
          matchCount++;
        }
      }
      
      if (matchCount > 0 || requiredSkills.includes(skill.name)) {
        matchedSkillIds.set(skill.id, matchCount + (requiredSkills.includes(skill.name) ? 5 : 0));
      }
    }
    
    // If no skills matched, try to match with partial words
    if (matchedSkillIds.size === 0) {
      for (const skill of allSkills) {
        const skillName = skill.name.toLowerCase();
        
        for (const word of taskWords) {
          if (word.length >= 4 && (skillName.includes(word) || word.includes(skillName))) {
            matchedSkillIds.set(skill.id, 1);
            break;
          }
        }
      }
    }
    
    // Calculate scores for each team member
    const assigneeScores: AssigneeScore[] = [];
    
    for (const member of filteredMembers) {
      const userId = member.users.id;
      const userName = member.users.full_name || member.users.email;
      const userSlackId = member.users.slack_user_id || '';
      const email = member.users.email;
      
      // Calculate skill match score
      let skillMatchScore = 0;
      let skillMatchReason = '';
      
      if (matchedSkillIds.size > 0) {
        const userSkills = await getUserSkills(userId);
        let totalRelevance = 0;
        let userMatches = 0;
        
        for (const [skillId, relevance] of matchedSkillIds.entries()) {
          totalRelevance += relevance;
          
          const matchingUserSkill = userSkills.find(us => us.skillId === skillId);
          if (matchingUserSkill) {
            // Consider both skill relevance and user's proficiency
            const skillScore = relevance * (matchingUserSkill.proficiencyLevel / 5);
            userMatches += skillScore;
            
            // Build explanation for the first 2 matching skills
            if (skillMatchReason.length === 0 || skillMatchReason.split(',').length < 2) {
              const skillName = allSkills.find(s => s.id === skillId)?.name || '';
              if (skillName) {
                if (skillMatchReason) {
                  skillMatchReason += `, ${skillName} (${matchingUserSkill.proficiencyLevel}/5)`;
                } else {
                  skillMatchReason = `${skillName} (${matchingUserSkill.proficiencyLevel}/5)`;
                }
              }
            }
          }
        }
        
        skillMatchScore = totalRelevance > 0 ? (userMatches / totalRelevance) * 100 : 0;
      } else {
        // No skills identified in task - give everyone an average score
        skillMatchScore = 50;
        skillMatchReason = 'No specific skills required';
      }
      
      // Calculate activity score
      const activityScore = await getUserActivityScore(userId);
      
      // Calculate workload score (lower is better)
      const workloadScore = await getUserWorkloadScore(userId, teamId);
      
      // Invert workload score since lower is better (100 - score)
      const invertedWorkloadScore = 100 - workloadScore;
      
      // Calculate total score
      const totalScore = 
        (skillMatchScore * WEIGHTS.SKILL_MATCH) +
        (activityScore * WEIGHTS.ACTIVITY) +
        (invertedWorkloadScore * WEIGHTS.WORKLOAD);
      
      // Build match reason based on highest factors
      let matchReason = '';
      if (skillMatchReason) {
        matchReason = `Skills: ${skillMatchReason}`;
      }
      
      if (activityScore > 70) {
        if (matchReason) matchReason += ', ';
        matchReason += 'Recently active';
      }
      
      if (invertedWorkloadScore > 70) {
        if (matchReason) matchReason += ', ';
        matchReason += 'Low current workload';
      }
      
      if (!matchReason) {
        matchReason = 'Team member';
      }
      
      assigneeScores.push({
        userId,
        name: userName,
        slackUserId: userSlackId,
        email,
        skillMatchScore,
        activityScore,
        workloadScore,
        totalScore,
        matchReason
      });
    }
    
    // Sort by total score descending
    assigneeScores.sort((a, b) => b.totalScore - a.totalScore);
    
    return assigneeScores;
  } catch (error) {
    console.error('Error finding best assignees:', error);
    return [];
  }
}