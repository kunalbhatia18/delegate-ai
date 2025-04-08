import { getAllSkills, getUserSkills } from '../skills/skillService';
import { getUserActivityScore } from '../activity/activityService';
import { getUserWorkloadScore } from './workloadService';
import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

// Factor weights for scoring
const WEIGHTS = {
  SKILL_MATCH: 0.65,  // 65% - Skill relevance is most important
  ACTIVITY: 0.15,     // 15% - Recent activity is good
  WORKLOAD: 0.20      // 20% - Lower workload is preferred
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
  matchedSkills: string[];
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
    console.log("Finding assignees with skills:", requiredSkills, "for task:", taskText);
    
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
    console.log("All available skills:", allSkills.map(s => s.name));
    
    // Extract keywords from task text
    const taskWords = taskText.toLowerCase().split(/\W+/).filter(word => 
      word.length > 3 && !['this', 'that', 'with', 'from', 'have', 'will'].includes(word)
    );
    
    console.log("Task keywords:", taskWords);
    
    // Match skill keywords in the task text
    const matchedSkillIds = new Map<string, number>(); // skill ID -> relevance score
    
    // First add explicitly required skills with high relevance
    if (requiredSkills.length > 0) {
      console.log("Explicitly required skills:", requiredSkills);
      
      for (const skillName of requiredSkills) {
        const skill = allSkills.find(s => 
          s.name.toLowerCase() === skillName.toLowerCase()
        );
        
        if (skill) {
          matchedSkillIds.set(skill.id, 10); // High relevance for explicitly required skills
          console.log(`Added required skill: ${skill.name} with ID ${skill.id}`);
        }
      }
    }
    
    // Then search for skills in the task text
    for (const skill of allSkills) {
      // Check if skill name is directly mentioned in the task
      if (taskText.toLowerCase().includes(skill.name.toLowerCase())) {
        // If already added as required, keep the higher score
        if (!matchedSkillIds.has(skill.id) || matchedSkillIds.get(skill.id)! < 8) {
          matchedSkillIds.set(skill.id, 8);
          console.log(`Found skill in task text: ${skill.name} with ID ${skill.id}`);
        }
        continue;
      }
      
      // Otherwise, look for keyword matches
      const skillKeywords = (skill.name + ' ' + (skill.description || '')).toLowerCase().split(/\W+/);
      
      let matchCount = 0;
      for (const keyword of skillKeywords) {
        if (keyword.length > 3 && taskWords.includes(keyword)) {
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        // If already added with higher relevance, don't override
        const currentRelevance = matchedSkillIds.get(skill.id) || 0;
        const newRelevance = matchCount * 2;
        
        if (newRelevance > currentRelevance) {
          matchedSkillIds.set(skill.id, newRelevance);
          console.log(`Matched skill keywords: ${skill.name} with score ${newRelevance}`);
        }
      }
    }
    
    // If no skills matched, try to match with partial words (add a fallback)
    if (matchedSkillIds.size === 0) {
      console.log("No direct skill matches, trying partial matches");
      
      for (const skill of allSkills) {
        const skillName = skill.name.toLowerCase();
        
        for (const word of taskWords) {
          if (word.length >= 4 && (skillName.includes(word) || word.includes(skillName))) {
            matchedSkillIds.set(skill.id, 3); // Lower score for partial matches
            console.log(`Partial match for skill: ${skill.name}`);
            break;
          }
        }
      }
    }
    
    // Get the actual skill names for matched skills
    const matchedSkillNames = new Set<string>();
    for (const [skillId, _] of matchedSkillIds.entries()) {
      const skill = allSkills.find(s => s.id === skillId);
      if (skill) matchedSkillNames.add(skill.name);
    }
    
    console.log("Final matched skills:", Array.from(matchedSkillNames));
    
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
      const matchedUserSkills: string[] = [];
      
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
            
            // Add to matched skills list
            const skillName = allSkills.find(s => s.id === skillId)?.name || '';
            if (skillName) matchedUserSkills.push(skillName);
            
            // Build explanation for the first 2 matching skills
            if (skillMatchReason.length === 0 || skillMatchReason.split(',').length < 2) {
              if (skillName) {
                if (skillMatchReason) {
                  skillMatchReason += `, ${skillName} (Level ${matchingUserSkill.proficiencyLevel}/5)`;
                } else {
                  skillMatchReason = `${skillName} (Level ${matchingUserSkill.proficiencyLevel}/5)`;
                }
              }
            }
          }
        }
        
        skillMatchScore = totalRelevance > 0 ? (userMatches / totalRelevance) * 100 : 0;
      } else {
        // No skills identified in task - give everyone an average score
        skillMatchScore = 50;
        skillMatchReason = 'General task (no specific skills required)';
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
      
      // Always prioritize skill matches in the reason
      if (skillMatchReason && matchedUserSkills.length > 0) {
        if (matchedUserSkills.length === 1) {
          matchReason = `Has ${skillMatchReason}`;
        } else {
          matchReason = `Has skills: ${skillMatchReason}`;
        }
      }
      
      // Add workload reason if it's very good
      if (invertedWorkloadScore > 80) {
        if (matchReason) matchReason += ', ';
        matchReason += 'Very low current workload';
      } else if (invertedWorkloadScore > 60) {
        if (matchReason) matchReason += ', ';
        matchReason += 'Low current workload';
      }
      
      // Add activity reason if it's very recent
      if (activityScore > 90) {
        if (matchReason) matchReason += ', ';
        matchReason += 'Recently active';
      }
      
      // If we still have no reason, provide a fallback
      if (!matchReason) {
        if (matchedSkillIds.size > 0) {
          matchReason = 'No matching skills for this task';
        } else {
          matchReason = 'Team member available for work';
        }
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
        matchReason,
        matchedSkills: matchedUserSkills
      });
    }
    
    // Sort by total score descending
    assigneeScores.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log("Assignee scores calculated:", assigneeScores.map(a => ({
      name: a.name,
      score: a.totalScore,
      reason: a.matchReason,
      matchedSkills: a.matchedSkills
    })));
    
    return assigneeScores;
  } catch (error) {
    console.error('Error finding best assignees:', error);
    return [];
  }
}