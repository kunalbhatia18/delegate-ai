import { NextResponse } from 'next/server';
import { handleDelegateCommand } from '@/lib/slack/commands/delegate';
import { adminSupabase } from '@/lib/supabase/admin';
import axios from 'axios';

export async function POST(request: Request) {
  // Parse form data from Slack
  const formData = await request.formData();
  const command = formData.get('command') as string;
  const text = formData.get('text') as string;
  const slackUserId = formData.get('user_id') as string;
  const channelId = formData.get('channel_id') as string;
  const slackTeamId = formData.get('team_id') as string;
  const responseUrl = formData.get('response_url') as string;
  
  console.log('Slack command received:', { command, text, slackUserId, channelId, slackTeamId });
  
  // Immediately respond to Slack to prevent timeout
  // This is crucial - Slack requires a response within 3 seconds
  const immediateResponse = {
    response_type: 'ephemeral',
    text: 'Processing your request...'
  };
  
  // Process the command asynchronously
  processCommandAsync(command, text, slackUserId, channelId, slackTeamId, responseUrl);
  
  // Return the immediate response to Slack
  return NextResponse.json(immediateResponse);
}

// Process the command asynchronously and update the message when done
async function processCommandAsync(
  command: string,
  text: string,
  slackUserId: string,
  channelId: string,
  slackTeamId: string,
  responseUrl: string
) {
  try {
    // Set up test data on demand
    await setupTestData(slackUserId);
    
    // Get user and team IDs
    const { data: userData } = await adminSupabase
      .from('users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();
    
    if (!userData) {
      await updateSlackMessage(responseUrl, {
        response_type: 'ephemeral',
        text: `Error: Your Slack account (ID: ${slackUserId}) isn't linked to DelegateAI. Contact support.`,
        replace_original: true
      });
      return;
    }
    
    // Get the user's team
    const { data: teamMemberData } = await adminSupabase
      .from('team_members')
      .select('*')
      .eq('user_id', userData.id)
      .single();
      
    if (!teamMemberData) {
      await updateSlackMessage(responseUrl, {
        response_type: 'ephemeral',
        text: `Error: You need to be part of a team to use this command.`,
        replace_original: true
      });
      return;
    }
    
    // Handle the command
    let response;
    
    switch (command) {
      case '/delegate':
        response = await handleDelegateCommand({
          text,
          slackUserId,
          channelId,
          teamId: teamMemberData.team_id,
          responseUrl
        });
        break;
        
      default:
        response = {
          response_type: 'ephemeral',
          text: `Command ${command} not recognized.`,
          replace_original: true
        };
    }
    
    // Update the original message with the response
    await updateSlackMessage(responseUrl, {
      ...response,
      replace_original: true
    });
  } catch (error) {
    console.error('Error processing Slack command:', error);
    await updateSlackMessage(responseUrl, {
      response_type: 'ephemeral',
      text: 'An error occurred while processing your command. Check server logs for details.',
      replace_original: true
    });
  }
}

// Function to update a Slack message using the response_url
async function updateSlackMessage(responseUrl: string, message: any) {
  try {
    await axios.post(responseUrl, message);
  } catch (error) {
    console.error('Error updating Slack message:', error);
  }
}

// Setup function to create test data on demand
async function setupTestData(currentSlackUserId: string) {
  console.log('Setting up test data...');
  
  try {
    // Create a team if it doesn't exist
    const { data: existingTeams } = await adminSupabase
      .from('teams')
      .select('*')
      .eq('name', 'Demo Team');
      
    let teamId;
    
    if (!existingTeams || existingTeams.length === 0) {
      const { data: newTeam } = await adminSupabase
        .from('teams')
        .insert({ name: 'Demo Team' })
        .select()
        .single();
        
      if (newTeam) {
        teamId = newTeam.id;
        console.log('Created new team:', newTeam);
      }
    } else {
      teamId = existingTeams[0].id;
      console.log('Found existing team:', existingTeams[0]);
    }
    
    if (!teamId) {
      console.error('Failed to get team ID');
      return;
    }
    
    // Create the current user if they don't exist
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('*')
      .eq('slack_user_id', currentSlackUserId);
      
    let userId;
    
    if (!existingUser || existingUser.length === 0) {
      const { data: newUser } = await adminSupabase
        .from('users')
        .insert({
          email: `user_${currentSlackUserId}@example.com`,
          full_name: 'Slack User',
          slack_user_id: currentSlackUserId
        })
        .select()
        .single();
        
      if (newUser) {
        userId = newUser.id;
        console.log('Created new user:', newUser);
      }
    } else {
      userId = existingUser[0].id;
      console.log('Found existing user:', existingUser[0]);
    }
    
    if (!userId) {
      console.error('Failed to get user ID');
      return;
    }
    
    // Make sure user is a team member
    const { data: existingMembership } = await adminSupabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .eq('team_id', teamId);
      
    if (!existingMembership || existingMembership.length === 0) {
      const { data: newMembership } = await adminSupabase
        .from('team_members')
        .insert({
          user_id: userId,
          team_id: teamId,
          role: 'owner'
        })
        .select();
        
      console.log('Created team membership:', newMembership);
    } else {
      console.log('Found existing membership:', existingMembership[0]);
    }
    
    // Create a teammate for delegation
    const { data: existingTeammate } = await adminSupabase
      .from('users')
      .select('*')
      .eq('email', 'teammate@example.com');
      
    let teammateId;
    
    if (!existingTeammate || existingTeammate.length === 0) {
      const { data: newTeammate } = await adminSupabase
        .from('users')
        .insert({
          email: 'teammate@example.com',
          full_name: 'Test Teammate',
          slack_user_id: 'FAKE_ID_123'
        })
        .select()
        .single();
        
      if (newTeammate) {
        teammateId = newTeammate.id;
        console.log('Created new teammate:', newTeammate);
      }
    } else {
      teammateId = existingTeammate[0].id;
      console.log('Found existing teammate:', existingTeammate[0]);
    }
    
    if (!teammateId) {
      console.error('Failed to get teammate ID');
      return;
    }
    
    // Make sure teammate is a team member
    const { data: existingTeammateMembership } = await adminSupabase
      .from('team_members')
      .select('*')
      .eq('user_id', teammateId)
      .eq('team_id', teamId);
      
    if (!existingTeammateMembership || existingTeammateMembership.length === 0) {
      const { data: newMembership } = await adminSupabase
        .from('team_members')
        .insert({
          user_id: teammateId,
          team_id: teamId,
          role: 'member'
        })
        .select();
        
      console.log('Created teammate membership:', newMembership);
    } else {
      console.log('Found existing teammate membership:', existingTeammateMembership[0]);
    }
    
    console.log('Test data setup complete!');
  } catch (error) {
    console.error('Error setting up test data:', error);
  }
}