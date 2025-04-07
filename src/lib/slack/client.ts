import { WebClient } from '@slack/web-api';
import { App, ExpressReceiver } from '@slack/bolt';
import { supabase } from '@/lib/supabase/client';

// Initialize the Web API client
export const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Create a receiver for handling Slack events (used in API routes)
export function createSlackReceiver() {
  const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    processBeforeResponse: true,
  });
  
  return receiver;
}

// Initialize Slack app with credentials
export function initSlackApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: false,
    appToken: process.env.SLACK_APP_TOKEN,
  });

  return app;
}

// Helper function to get user information by ID
export async function getUserInfo(userId: string) {
  try {
    const result = await webClient.users.info({
      user: userId,
    });
    return result.user;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Helper function to send a direct message
export async function sendDirectMessage(userId: string, text: string) {
  try {
    const result = await webClient.chat.postMessage({
      channel: userId,
      text,
    });
    return result;
  } catch (error) {
    console.error('Error sending direct message:', error);
    return null;
  }
}

// Get Slack token for a team
export async function getSlackTokenForTeam(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('slack_workspaces')
      .select('slack_access_token')
      .eq('team_id', teamId)
      .single();
      
    if (error || !data) {
      console.error('Error getting Slack token:', error);
      return null;
    }
    
    return data.slack_access_token;
  } catch (error) {
    console.error('Error in getSlackTokenForTeam:', error);
    return null;
  }
}

// Post a message in a channel
export async function postMessage(channel: string, text: string, threadTs?: string) {
  try {
    const messageParams: any = {
      channel,
      text,
    };
    
    if (threadTs) {
      messageParams.thread_ts = threadTs;
    }
    
    const result = await webClient.chat.postMessage(messageParams);
    return result;
  } catch (error) {
    console.error('Error posting message:', error);
    return null;
  }
}