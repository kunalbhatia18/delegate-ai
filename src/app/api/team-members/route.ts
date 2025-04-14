import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    const userId = url.searchParams.get('userId');
    
    if (!teamId && !userId) {
      return NextResponse.json({ error: 'Team ID or User ID is required' }, { status: 400 });
    }
    
    // Get members of a team
    if (teamId) {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          team_id,
          role,
          users:user_id(id, full_name, email, slack_user_id, last_active)
        `)
        .eq('team_id', teamId);
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    // Get teams of a user
    if (userId) {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          team_id,
          role,
          teams:team_id(id, name)
        `)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, teamId, userId, role } = await request.json();
    
    if (!teamId || !userId) {
      return NextResponse.json({ error: 'Team ID and User ID are required' }, { status: 400 });
    }
    
    switch (action) {
      case 'add': {
        if (!role) {
          return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }
        
        const { data, error } = await adminSupabase
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: userId,
            role
          })
          .select()
          .single();
          
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      case 'remove': {
        const { error } = await adminSupabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', userId);
          
        if (error) throw error;
        
        return NextResponse.json({ success: true });
      }
      
      case 'update_role': {
        if (!role) {
          return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }
        
        const { data, error } = await adminSupabase
          .from('team_members')
          .update({ role })
          .eq('team_id', teamId)
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}