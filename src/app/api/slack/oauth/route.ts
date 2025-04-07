// src/app/api/slack/oauth/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

// In-memory temporary token storage (in a real app, use Redis or a database)
const tempTokens = new Map();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('OAuth callback received with code:', code ? 'present' : 'missing');
  
  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    console.log('Using base URL for redirects:', baseUrl);
    
    // Exchange the code for access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl}/api/slack/oauth`,
      },
    });
    
    const data = response.data;
    
    if (!data.ok) {
      console.error('Slack OAuth error:', data.error);
      return NextResponse.redirect(`${baseUrl}/dashboard?slackConnectError=true&reason=${data.error}`);
    }
    
    console.log('Successfully obtained Slack tokens for team:', data.team.id);
    
    // Generate a secure temporary token
    const tempToken = crypto.randomBytes(16).toString('hex');
    
    // Store the Slack data with the temp token (expires in 5 minutes)
    tempTokens.set(tempToken, {
      accessToken: data.access_token,
      slackTeamId: data.team.id,
      botUserId: data.bot_user_id,
      appId: data.app_id,
      expires: Date.now() + (5 * 60 * 1000) // 5 minutes
    });
    
    // Redirect to dashboard with just the temp token
    return NextResponse.redirect(`${baseUrl}/dashboard?slackToken=${tempToken}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error connecting to Slack:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    return NextResponse.redirect(`${baseUrl}/dashboard?slackConnectError=true&reason=exception`);
  }
}

// Add an API endpoint to retrieve the token data
export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body;
  
  if (!token || !tempTokens.has(token)) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }
  
  const tokenData = tempTokens.get(token);
  
  // Check if token has expired
  if (tokenData.expires < Date.now()) {
    tempTokens.delete(token);
    return NextResponse.json({ error: 'Token expired' }, { status: 400 });
  }
  
  // Delete the token after use
  tempTokens.delete(token);
  
  return NextResponse.json({ data: tokenData });
}