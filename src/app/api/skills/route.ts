import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { action, userId, skillId, proficiencyLevel, name, description } = await request.json();
    
    switch (action) {
      case 'add_skill': {
        const { data, error } = await adminSupabase
          .from('skills')
          .insert({ name, description })
          .select()
          .single();
        
        if (error) throw error;
        return NextResponse.json(data);
      }
      
      case 'add_user_skill': {
        const { error } = await adminSupabase
          .from('user_skills')
          .upsert({
            user_id: userId,
            skill_id: skillId,
            proficiency_level: proficiencyLevel
          });
        
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      case 'remove_user_skill': {
        const { error } = await adminSupabase
          .from('user_skills')
          .delete()
          .eq('user_id', userId)
          .eq('skill_id', skillId);
        
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      case 'update_user_skill': {
        const { error } = await adminSupabase
          .from('user_skills')
          .update({ proficiency_level: proficiencyLevel })
          .eq('user_id', userId)
          .eq('skill_id', skillId);
        
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}