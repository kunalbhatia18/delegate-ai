import { NextResponse } from 'next/server';
import { getAllSkills } from '@/lib/supabase/db';

export async function GET() {
  try {
    const skills = await getAllSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    console.error('Failed to fetch skills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}