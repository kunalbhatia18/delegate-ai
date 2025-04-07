import { supabase } from '@/lib/supabase/client';

export interface SkillInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface UserSkillInfo {
  skillId: string;
  skillName: string;
  proficiencyLevel: number;
  description: string | null;
}

// Get all available skills
export async function getAllSkills(): Promise<SkillInfo[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name');
    
  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }
  
  return data || [];
}

// Get skills for a specific user
export async function getUserSkills(userId: string): Promise<UserSkillInfo[]> {
  try {
    const response = await fetch(`/api/user-skills?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user skills');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user skills:', error);
    return [];
  }
}

// Add skill to user
export async function addUserSkill(
  userId: string,
  skillId: string,
  proficiencyLevel: number
): Promise<UserSkillInfo[]> {
  try {
    const response = await fetch('/api/user-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        skillId,
        proficiencyLevel
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add skill');
    }
    
    // Return the updated skills list
    return await response.json();
  } catch (error) {
    console.error('Error adding user skill:', error);
    throw error;
  }
}

// Remove skill from user
export async function removeUserSkill(
  userId: string,
  skillId: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/user-skills?userId=${userId}&skillId=${skillId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove skill');
    }
    
    return true;
  } catch (error) {
    console.error('Error removing user skill:', error);
    return false;
  }
}

// Update user skill proficiency level
export async function updateUserSkillLevel(
  userId: string,
  skillId: string,
  proficiencyLevel: number
): Promise<boolean> {
  try {
    // We can reuse addUserSkill since it handles both add and update
    await addUserSkill(userId, skillId, proficiencyLevel);
    return true;
  } catch (error) {
    console.error('Error updating user skill level:', error);
    return false;
  }
}

// Add a new skill to the system
export async function addSkill(
  name: string, 
  description?: string
): Promise<SkillInfo | null> {
  try {
    const response = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_skill',
        name,
        description
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add skill');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error adding skill:', error);
    return null;
  }
}