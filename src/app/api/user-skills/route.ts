import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';

// Define interfaces for the data structure
interface SkillData {
  id: string;
  name: string;
  description: string | null;
}

interface UserSkillData {
  skill_id: string;
  proficiency_level: number;
  skills: SkillData;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from('user_skills')
      .select(`
        skill_id,
        proficiency_level,
        skills (id, name, description)
      `)
      .eq('user_id', userId);
      
    if (error) {
      throw error;
    }
    
    const formattedData = (data || []).map((item: UserSkillData) => ({
      skillId: item.skill_id,
      skillName: item.skills ? item.skills.name : '',
      proficiencyLevel: item.proficiency_level || 0,
      description: item.skills ? item.skills.description : null,
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, skillId, proficiencyLevel } = await request.json();
    
    if (!userId || !skillId) {
      return NextResponse.json({ error: 'User ID and Skill ID are required' }, { status: 400 });
    }

    // Check if the user skill already exists
    const { data: existingSkill } = await adminSupabase
      .from('user_skills')
      .select('id')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .single();

    if (existingSkill) {
      // Update existing skill
      const { error } = await adminSupabase
        .from('user_skills')
        .update({ proficiency_level: proficiencyLevel })
        .eq('user_id', userId)
        .eq('skill_id', skillId);
      
      if (error) throw error;
    } else {
      // Insert new skill
      const { error } = await adminSupabase
        .from('user_skills')
        .insert({
          user_id: userId,
          skill_id: skillId,
          proficiency_level: proficiencyLevel
        });
      
      if (error) throw error;
    }

    // Return updated skills list
    const { data, error } = await adminSupabase
      .from('user_skills')
      .select(`
        skill_id,
        proficiency_level,
        skills (id, name, description)
      `)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    const formattedData = (data || []).map((item: UserSkillData) => ({
      skillId: item.skill_id,
      skillName: item.skills ? item.skills.name : '',
      proficiencyLevel: item.proficiency_level || 0,
      description: item.skills ? item.skills.description : null,
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const skillId = url.searchParams.get('skillId');

    if (!userId || !skillId) {
      return NextResponse.json({ error: 'User ID and Skill ID are required' }, { status: 400 });
    }

    const { error } = await adminSupabase
      .from('user_skills')
      .delete()
      .eq('user_id', userId)
      .eq('skill_id', skillId);
    
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}