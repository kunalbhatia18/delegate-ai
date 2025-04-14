import { NextResponse } from 'next/server';
import { 
  getTeamAnalytics, 
  getUserAnalytics, 
  getTeamMemberAnalytics,
  getTaskStatusDistribution,
  getTaskCreationTrend
} from '@/lib/analytics/analyticsService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    
    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 });
    }
    
    switch (type) {
      case 'team': {
        const teamId = url.searchParams.get('teamId');
        
        if (!teamId) {
          return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }
        
        const analytics = await getTeamAnalytics(teamId);
        return NextResponse.json(analytics);
      }
      
      case 'user': {
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        const analytics = await getUserAnalytics(userId);
        return NextResponse.json(analytics);
      }
      
      case 'members': {
        const teamId = url.searchParams.get('teamId');
        
        if (!teamId) {
          return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }
        
        const memberAnalytics = await getTeamMemberAnalytics(teamId);
        return NextResponse.json(memberAnalytics);
      }
      
      case 'status-distribution': {
        const teamId = url.searchParams.get('teamId');
        
        if (!teamId) {
          return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }
        
        const distribution = await getTaskStatusDistribution(teamId);
        return NextResponse.json(distribution);
      }
      
      case 'creation-trend': {
        const teamId = url.searchParams.get('teamId');
        const days = url.searchParams.get('days') || '30';
        
        if (!teamId) {
          return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }
        
        const trend = await getTaskCreationTrend(teamId, parseInt(days));
        return NextResponse.json(trend);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}