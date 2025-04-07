// src/app/api/slack/interactive/route.ts
import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { WebClient } from '@slack/web-api';

// Declare the global state type to avoid TypeScript errors
declare global {
  var delegationState: Record<string, string>;
}

// Initialize global state if not exists
if (!global.delegationState) {
  global.delegationState = {};
}

// Type for Slack response
interface SlackResponse {
  text: string;
  response_type?: 'ephemeral' | 'in_channel';
  replace_original?: boolean;
  delete_original?: boolean;
}

export async function POST(request: Request) {
  try {
    // Slack sends a URL-encoded payload
    const formData = await request.formData();
    const payloadStr = formData.get('payload') as string;
    
    if (!payloadStr) {
      console.error('No payload received');
      return NextResponse.json({ error: 'No payload received' }, { status: 400 });
    }
    
    const payload = JSON.parse(payloadStr);
    console.log('Interactive payload received:', JSON.stringify(payload, null, 2));
    
    // Default response
    let response: SlackResponse = { text: 'Processing your request...' };
    let shouldPostToResponseUrl = true; // Flag to track if we should post directly
    
    // Initialize Slack client
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Handle different interactive components
    switch (payload.type) {
      case 'block_actions':
        // Handle button clicks and selections
        const actionId = payload.actions[0].action_id;
        
        switch (actionId) {
          case 'select_assignee':
            // Handle selection
            try {
              const userId = payload.user.id;
              const selectedUserId = payload.actions[0].selected_option.value;
              
              console.log(`Selection: User ${userId} selected assignee ${selectedUserId}`);
              
              // Store in global state
              global.delegationState[`${userId}_assignee`] = selectedUserId;
              
              console.log('Global state after selection:', global.delegationState);
              
              response = {
                text: `Team member selected. Click "Delegate Task" to confirm.`,
                response_type: 'ephemeral',
                replace_original: false
              };
              
              // For selections, don't replace original message
              shouldPostToResponseUrl = false;
            } catch (error) {
              console.error('Error in select_assignee:', error);
              response = {
                text: 'Error selecting team member.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
            
          case 'confirm_delegate':
            // Handle task delegation
            try {
              const userId = payload.user.id;
              
              // Get from global state for typical delegation
              const selectedUserId = global.delegationState[`${userId}_assignee`];
              
              console.log(`Confirmation: User ${userId} confirming task to assignee ${selectedUserId || 'NONE'}`);
              
              // Parse the task details from button value
              const buttonValue = JSON.parse(payload.actions[0].value);
              const taskText = buttonValue.taskText;
              const channelId = buttonValue.channelId;
              const assigneeId = selectedUserId || buttonValue.assigneeId; // Use from state or button
              
              if (!assigneeId) {
                response = {
                  text: 'No team member selected. Please select a team member first.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get delegator information from Slack ID
              let { data: userData } = await adminSupabase
                .from('users')
                .select('*')
                .eq('slack_user_id', userId)
                .single();
                
              if (!userData) {
                console.log(`Creating user for Slack ID: ${userId}`);
                // Create a user entry for this Slack user
                const { data: newUser, error: userError } = await adminSupabase
                  .from('users')
                  .insert({
                    email: `user_${userId}@example.com`,
                    full_name: payload.user.name || 'Slack User',
                    slack_user_id: userId
                  })
                  .select()
                  .single();
                  
                if (userError || !newUser) {
                  console.error('Error creating user:', userError);
                  response = {
                    text: 'Error creating user record.',
                    response_type: 'ephemeral',
                    replace_original: false
                  };
                  break;
                }
                
                // Add them to the Demo Team
                const { data: demoTeam } = await adminSupabase
                  .from('teams')
                  .select('*')
                  .eq('name', 'Demo Team')
                  .single();
                  
                if (demoTeam) {
                  await adminSupabase
                    .from('team_members')
                    .insert({
                      user_id: newUser.id,
                      team_id: demoTeam.id,
                      role: 'member'
                    });
                }
                
                // Use the new user
                userData = newUser;
              }
              
              // Get the team info
              const { data: teamMember } = await adminSupabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', userData.id)
                .single();
                
              if (!teamMember) {
                console.error('No team found for user:', userData.id);
                response = {
                  text: 'Error: You need to be part of a team to delegate tasks.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Create the task
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .insert({
                  title: taskText,
                  description: `Task detected in Slack and delegated by ${userData.full_name || 'a team member'}`,
                  delegator_id: userData.id,
                  assignee_id: assigneeId,
                  team_id: teamMember.team_id,
                  status: 'assigned',
                  slack_ts: payload.message?.ts || null,
                  slack_channel: channelId
                })
                .select()
                .single();
              
              if (taskError) {
                console.error('Error creating task:', taskError);
                response = {
                  text: 'Error creating task in database.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get assignee info
              const { data: assignee } = await adminSupabase
                .from('users')
                .select('*')
                .eq('id', assigneeId)
                .single();
                
              // Clear any stored state
              delete global.delegationState[`${userId}_assignee`];
              
              // Notify the assignee if they have a Slack ID
              if (assignee?.slack_user_id) {
                try {
                  await client.chat.postMessage({
                    channel: assignee.slack_user_id,
                    text: `You've been assigned a new task: *${taskText}*\nView more details in the DelegateAI dashboard.`
                  });
                } catch (err) {
                  console.error('Error notifying assignee:', err);
                }
              }
              
              // Post a thread message in the original channel
              if (channelId && payload.message?.ts) {
                try {
                  await client.chat.postMessage({
                    channel: channelId,
                    thread_ts: payload.message.ts,
                    text: `✅ <@${userId}> delegated task to <@${assignee?.slack_user_id || 'someone'}>: *${taskText}*`
                  });
                } catch (err) {
                  console.error('Error posting thread message:', err);
                }
              }
              
              // Success response
              response = {
                text: `✅ Task "${taskText}" delegated to ${assignee?.full_name || 'team member'} successfully!`,
                response_type: 'ephemeral',
                replace_original: true
              };
            } catch (error) {
              console.error('Error in confirm_delegate:', error);
              response = {
                text: 'An error occurred while delegating the task.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
            
          case 'auto_delegate':
            // Handle auto-delegation from detected tasks
            try {
              const userId = payload.user.id;
              
              // Parse the button value to get task details
              const buttonValue = JSON.parse(payload.actions[0].value);
              const taskText = buttonValue.taskText;
              const channelId = buttonValue.channelId;
              const assigneeId = buttonValue.assigneeId;
              const messageTs = buttonValue.messageTs;
              
              // Get delegator information from Slack ID
              let { data: userData } = await adminSupabase
                .from('users')
                .select('*')
                .eq('slack_user_id', userId)
                .single();
                
              if (!userData) {
                console.log(`Creating user for Slack ID: ${userId}`);
                // Create a user entry for this Slack user
                const { data: newUser, error: userError } = await adminSupabase
                  .from('users')
                  .insert({
                    email: `user_${userId}@example.com`,
                    full_name: payload.user.name || 'Slack User',
                    slack_user_id: userId
                  })
                  .select()
                  .single();
                  
                if (userError || !newUser) {
                  console.error('Error creating user:', userError);
                  response = {
                    text: 'Error creating user record.',
                    response_type: 'ephemeral',
                    replace_original: false
                  };
                  break;
                }
                
                userData = newUser;
              }
              
              // Get the team info
              const { data: teamMember } = await adminSupabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', userData.id)
                .single();
                
              if (!teamMember) {
                console.error('No team found for user:', userData.id);
                response = {
                  text: 'Error: You need to be part of a team to delegate tasks.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Create the task
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .insert({
                  title: taskText,
                  description: `Task auto-detected in Slack`,
                  delegator_id: userData.id,
                  assignee_id: assigneeId,
                  team_id: teamMember.team_id,
                  status: 'assigned',
                  slack_ts: messageTs,
                  slack_channel: channelId
                })
                .select()
                .single();
              
              if (taskError) {
                console.error('Error creating task:', taskError);
                response = {
                  text: 'Error creating task in database.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get assignee info
              const { data: assignee } = await adminSupabase
                .from('users')
                .select('*')
                .eq('id', assigneeId)
                .single();
                
              // Notify the assignee if they have a Slack ID
              if (assignee?.slack_user_id) {
                try {
                  await client.chat.postMessage({
                    channel: assignee.slack_user_id,
                    text: `You've been assigned a new task: *${taskText}*\nView more details in the DelegateAI dashboard.`
                  });
                } catch (err) {
                  console.error('Error notifying assignee:', err);
                }
              }
              
              // Post a thread message in the original channel
              if (channelId && messageTs) {
                try {
                  await client.chat.postMessage({
                    channel: channelId,
                    thread_ts: messageTs,
                    text: `✅ <@${userId}> delegated task to <@${assignee?.slack_user_id || 'someone'}>: *${taskText}*`
                  });
                } catch (err) {
                  console.error('Error posting thread message:', err);
                }
              }
              
              // Success response
              response = {
                text: `✅ Task "${taskText}" delegated to ${assignee?.full_name || 'team member'} successfully!`,
                response_type: 'ephemeral',
                replace_original: true
              };
            } catch (error) {
              console.error('Error in auto_delegate:', error);
              response = {
                text: 'An error occurred while processing the auto-delegation.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
            
          case 'not_a_task':
            // Handle "Not a task" button
            response = {
              text: 'Got it! I\'ll be more careful with my suggestions in the future.',
              response_type: 'ephemeral',
              replace_original: true
            };
            break;
            
          case 'cancel_delegate':
            // Handle cancellation
            response = {
              text: 'Task delegation cancelled.',
              response_type: 'ephemeral',
              replace_original: true
            };
            break;
            
          default:
            console.log('Unknown action_id:', actionId);
            shouldPostToResponseUrl = false;
        }
        break;
        
      default:
        console.log('Unhandled payload type:', payload.type);
        shouldPostToResponseUrl = false;
    }
    
    console.log('Sending response to Slack:', response);
    
    // Post directly to response_url for immediate UI update
    if (shouldPostToResponseUrl && payload.response_url) {
      try {
        console.log("Posting directly to response_url");
        await fetch(payload.response_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: response.text,
            replace_original: response.replace_original,
          }),
        });
      } catch (error) {
        console.error("Error posting to response_url:", error);
      }
    }
    
    // Return the response as well (as backup)
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing interactive payload:', error);
    return NextResponse.json({ 
      text: 'An error occurred while processing your request.',
      replace_original: false
    });
  }
}