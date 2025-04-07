import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

interface SkillInfo {
  id: string;
  name: string;
  description: string | null;
}

interface UserSkillInfo {
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
  
  return data;
}

// Get skills for a specific user
export async function getUserSkills(userId: string): Promise<UserSkillInfo[]> {
  const { data, error } = await supabase
    .from('user_skills')
    .select(`
      skill_id,
      proficiency_level,
      skills (id, name, description)
    `)
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error fetching user skills:', error);
    return [];
  }
  
  return data.map(item => ({
    skillId: item.skill_id,
    skillName: (item.skills as any).name,
    proficiencyLevel: item.proficiency_level || 0,
    description: (item.skills as any).description,
  }));
}

// Add skill to user
export async function addUserSkill(
  userId: string,
  skillId: string,
  proficiencyLevel: number
): Promise<boolean> {
  const { error } = await supabase
    .from('user_skills')
    .upsert({
      user_id: userId,
      skill_id: skillId,
      proficiency_level: proficiencyLevel
    });
    
  if (error) {
    console.error('Error adding user skill:', error);
    return false;
  }
  
  return true;
}

// Remove skill from user
export async function removeUserSkill(
  userId: string,
  skillId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_skills')
    .delete()
    .eq('user_id', userId)
    .eq('skill_id', skillId);
    
  if (error) {
    console.error('Error removing user skill:', error);
    return false;
  }
  
  return true;
}

// Update user skill proficiency level
export async function updateUserSkillLevel(
  userId: string,
  skillId: string,
  proficiencyLevel: number
): Promise<boolean> {
  const { error } = await supabase
    .from('user_skills')
    .update({ proficiency_level: proficiencyLevel })
    .eq('user_id', userId)
    .eq('skill_id', skillId);
    
  if (error) {
    console.error('Error updating user skill level:', error);
    return false;
  }
  
  return true;
}

// Add a new skill to the system
export async function addSkill(
  name: string, 
  description?: string
): Promise<SkillInfo | null> {
  const { data, error } = await adminSupabase
    .from('skills')
    .insert({ name, description })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding skill:', error);
    return null;
  }
  
  return data;
}