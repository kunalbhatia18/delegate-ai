import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const email = url.searchParams.get('email');
    
    // Get a specific user by ID
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      return NextResponse.json(data);
    }
    
    // Search user by email
    if (email) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email);
        
      if (error) throw error;
      
      return NextResponse.json(data || []);
    }
    
    // Get all users (with limit)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(100);
      
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, userId, email, full_name, slack_user_id } = await request.json();
    
    switch (action) {
      case 'create': {
        if (!email) {
          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        
        // Check if user with this email already exists
        const { data: existingUser } = await adminSupabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();
          
        if (existingUser) {
          return NextResponse.json(existingUser);
        }
        
        // Create new user
        const { data, error } = await adminSupabase
          .from('users')
          .insert({
            email,
            full_name: full_name || email.split('@')[0], // Use part before @ as default name
            slack_user_id
          })
          .select()
          .single();
          
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      case 'update': {
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        const updates: any = {};
        
        if (full_name !== undefined) updates.full_name = full_name;
        if (slack_user_id !== undefined) updates.slack_user_id = slack_user_id;
        
        const { data, error } = await adminSupabase
          .from('users')
          .update(updates)
          .eq('id', userId)
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