import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const teamId = url.searchParams.get('teamId');
    
    // Get user's teams
    if (userId) {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          role,
          teams:team_id(id, name)
        `)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    // Get team details
    if (teamId) {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
        
      if (error) throw error;
      
      return NextResponse.json(data);
    }
    
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, teamId, userId, name, role } = await request.json();
    
    switch (action) {
      case 'create': {
        if (!name || !userId) {
          return NextResponse.json({ error: 'Name and user ID are required' }, { status: 400 });
        }
        
        // Create new team
        const { data: team, error: teamError } = await adminSupabase
          .from('teams')
          .insert({ name })
          .select()
          .single();
          
        if (teamError) throw teamError;
        
        // Add user as team owner
        const { error: memberError } = await adminSupabase
          .from('team_members')
          .insert({
            user_id: userId,
            team_id: team.id,
            role: 'owner'
          });
          
        if (memberError) throw memberError;
        
        return NextResponse.json(team);
      }
      
      case 'update': {
        if (!teamId || !name) {
          return NextResponse.json({ error: 'Team ID and name are required' }, { status: 400 });
        }
        
        const { data, error } = await adminSupabase
          .from('teams')
          .update({ name })
          .eq('id', teamId)
          .select()
          .single();
          
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      case 'add_member': {
        if (!teamId || !userId || !role) {
          return NextResponse.json({ error: 'Team ID, user ID, and role are required' }, { status: 400 });
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
      
      case 'remove_member': {
        if (!teamId || !userId) {
          return NextResponse.json({ error: 'Team ID and user ID are required' }, { status: 400 });
        }
        
        const { error } = await adminSupabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', userId);
          
        if (error) throw error;
        
        return NextResponse.json({ success: true });
      }
      
      case 'update_role': {
        if (!teamId || !userId || !role) {
          return NextResponse.json({ error: 'Team ID, user ID, and role are required' }, { status: 400 });
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