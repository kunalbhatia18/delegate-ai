// src/app/api/slack/interactive/route.ts
import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { WebClient } from '@slack/web-api';
import { recordActivity } from '@/lib/activity/activityService';
import { updateTaskStatus } from '@/lib/tasks/taskService';

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
  blocks?: any[];
}

// Valid task state transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['assigned'],
  'assigned': ['accepted', 'declined'],
  'accepted': ['completed'],
  'declined': [],  // Terminal state - no transitions allowed
  'completed': []  // Terminal state - no transitions allowed
};

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

              // Record activity for the delegator
              if (userData.id) {
                await recordActivity(userData.id, 'slack', 'Delegated task via Slack');
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
                    text: `You've been assigned a new task: *${taskText}*`,
                    blocks: [
                      {
                        type: 'header',
                        text: {
                          type: 'plain_text',
                          text: '🎯 New Task Assigned to You',
                          emoji: true
                        }
                      },
                      {
                        type: 'section',
                        text: {
                          type: 'mrkdwn',
                          text: `*Task:* ${taskText}`
                        }
                      },
                      {
                        type: 'context',
                        elements: [
                          {
                            type: 'mrkdwn',
                            text: `<https://slack.com/archives/${channelId}/p${payload.message?.ts?.replace('.', '')}|View original message>`
                          }
                        ]
                      },
                      {
                        type: 'actions',
                        elements: [
                          {
                            type: 'button',
                            text: {
                              type: 'plain_text',
                              text: 'Accept Task',
                              emoji: true
                            },
                            style: 'primary',
                            action_id: 'accept_task',
                            value: task.id
                          },
                          {
                            type: 'button',
                            text: {
                              type: 'plain_text',
                              text: 'Decline Task',
                              emoji: true
                            },
                            style: 'danger',
                            action_id: 'decline_task',
                            value: task.id
                          }
                        ]
                      }
                    ]
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
              
              // Get assignee information
              const assignee = await getUserById(assigneeId);
              if (!assignee) {
                return {
                  response_type: 'ephemeral',
                  text: 'Error: Could not find the assignee information.',
                  replace_original: false
                };
              }
              
              // Create the task
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .insert({
                  title: taskText,
                  description: `Auto-detected task from Slack`,
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
                  text: 'Error creating task in database. Please try again.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }

              // Record activity for the delegator
              if (userData.id) {
                await recordActivity(userData.id, 'slack', 'Auto-delegated task via Slack');
              }
              
              // Notify the assignee if they have a Slack ID
              if (assignee.slack_user_id) {
                // Send a more detailed notification with buttons
                await client.chat.postMessage({
                  channel: assignee.slack_user_id,
                  text: `You've been assigned a new task: *${taskText}*`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: '🎯 New Task Assigned to You',
                        emoji: true
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Task:* ${taskText}`
                      }
                    },
                    {
                      type: 'context',
                      elements: [
                        {
                          type: 'mrkdwn',
                          text: `<https://slack.com/archives/${channelId}/p${messageTs.replace('.', '')}|View original message>`
                        }
                      ]
                    },
                    {
                      type: 'actions',
                      elements: [
                        {
                          type: 'button',
                          text: {
                            type: 'plain_text',
                            text: 'Accept Task',
                            emoji: true
                          },
                          style: 'primary',
                          action_id: 'accept_task',
                          value: task.id
                        },
                        {
                          type: 'button',
                          text: {
                            type: 'plain_text',
                            text: 'Decline Task',
                            emoji: true
                          },
                          style: 'danger',
                          action_id: 'decline_task',
                          value: task.id
                        }
                      ]
                    }
                  ]
                });
              }
              
              // Post confirmation in thread
              await client.chat.postMessage({
                channel: channelId,
                thread_ts: messageTs,
                text: `✅ Task delegated to ${assignee.full_name || 'Team member'}: *${taskText}*`
              });
              
              // Update the original ephemeral message
              response = {
                response_type: 'ephemeral',
                text: `Successfully delegated to ${assignee.full_name || 'Team member'}: "${taskText}"`,
                delete_original: true
              };
            } catch (error) {
              console.error('Error in auto-delegation:', error);
              response = {
                response_type: 'ephemeral',
                text: 'An error occurred while delegating the task. Please try again.',
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
            
          // HANDLERS FOR TASK STATUS UPDATES
          case 'accept_task': {
            try {
              const taskId = payload.actions[0].value;
              const slackUserId = payload.user.id;
              
              // Get user's Supabase ID from Slack ID
              const { data: user, error: userError } = await adminSupabase
                .from('users')
                .select('id, full_name')
                .eq('slack_user_id', slackUserId)
                .single();
                
              if (userError || !user) {
                console.error('Error finding user:', userError);
                response = {
                  text: 'Error identifying your user account.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get task details
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .select(`
                  *,
                  delegator:delegator_id(id, full_name, slack_user_id)
                `)
                .eq('id', taskId)
                .single();
                
              if (taskError || !task) {
                console.error('Error fetching task:', taskError);
                response = {
                  text: 'Error finding the task.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Check if the task is in a valid state to be accepted
              if (task.status !== 'assigned') {
                response = {
                  text: `This task cannot be accepted because it is already ${task.status}.`,
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Update task status
              const { data: updatedTask, error: updateError } = await adminSupabase
                .from('tasks')
                .update({ status: 'accepted' })
                .eq('id', taskId)
                .select()
                .single();
                
              if (updateError) {
                console.error('Error updating task:', updateError);
                response = {
                  text: 'Error updating task status.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Record activity
              await recordActivity(user.id, 'slack', 'Accepted task via Slack');
              
              // Notify the delegator
              const delegatorSlackId = (task.delegator as any).slack_user_id;
              if (delegatorSlackId) {
                await client.chat.postMessage({
                  channel: delegatorSlackId,
                  text: `✅ ${user.full_name || 'Your assignee'} has accepted the task: *${task.title}*`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: '✅ Task Accepted',
                        emoji: true
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Task:* ${task.title}`
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `${user.full_name || 'Your assignee'} has *accepted* this task.`
                      }
                    },
                    task.slack_channel && task.slack_ts ? {
                      type: 'context',
                      elements: [
                        {
                          type: 'mrkdwn',
                          text: `<https://slack.com/archives/${task.slack_channel}/p${task.slack_ts.replace('.', '')}|View original message>`
                        }
                      ]
                    } : null
                  ].filter(Boolean) as any[]
                });
              }
              
              // Update the original message to remove the buttons
              const updatedBlocks = payload.message.blocks
                .filter((block: any) => block.type !== 'actions')
                .concat([
                  {
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: '✅ *Task accepted*'
                      }
                    ]
                  }
                ]);
                
              await client.chat.update({
                channel: payload.container.channel_id,
                ts: payload.container.message_ts,
                blocks: updatedBlocks
              });
              
              response = {
                text: 'You have accepted the task! 👍',
                response_type: 'ephemeral',
                replace_original: false
              };
            } catch (error) {
              console.error('Error handling task acceptance:', error);
              response = {
                text: 'An error occurred while updating the task status.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
          }
          
          case 'decline_task': {
            try {
              const taskId = payload.actions[0].value;
              const slackUserId = payload.user.id;
              
              // Get user's Supabase ID from Slack ID
              const { data: user, error: userError } = await adminSupabase
                .from('users')
                .select('id, full_name')
                .eq('slack_user_id', slackUserId)
                .single();
                
              if (userError || !user) {
                console.error('Error finding user:', userError);
                response = {
                  text: 'Error identifying your user account.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get task details
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .select(`
                  *,
                  delegator:delegator_id(id, full_name, slack_user_id)
                `)
                .eq('id', taskId)
                .single();
                
              if (taskError || !task) {
                console.error('Error fetching task:', taskError);
                response = {
                  text: 'Error finding the task.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Check if the task is in a valid state to be declined
              if (task.status !== 'assigned') {
                response = {
                  text: `This task cannot be declined because it is already ${task.status}.`,
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Update task status
              const { data: updatedTask, error: updateError } = await adminSupabase
                .from('tasks')
                .update({ status: 'declined' })
                .eq('id', taskId)
                .select()
                .single();
                
              if (updateError) {
                console.error('Error updating task:', updateError);
                response = {
                  text: 'Error updating task status.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Record activity
              await recordActivity(user.id, 'slack', 'Declined task via Slack');
              
              // Notify the delegator
              const delegatorSlackId = (task.delegator as any).slack_user_id;
              if (delegatorSlackId) {
                await client.chat.postMessage({
                  channel: delegatorSlackId,
                  text: `❌ ${user.full_name || 'Your assignee'} has declined the task: *${task.title}*`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: '❌ Task Declined',
                        emoji: true
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Task:* ${task.title}`
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `${user.full_name || 'Your assignee'} has *declined* this task.`
                      }
                    },
                    task.slack_channel && task.slack_ts ? {
                      type: 'context',
                      elements: [
                        {
                          type: 'mrkdwn',
                          text: `<https://slack.com/archives/${task.slack_channel}/p${task.slack_ts.replace('.', '')}|View original message>`
                        }
                      ]
                    } : null
                  ].filter(Boolean) as any[]
                });
              }
              
              // Update the original message to remove the buttons
              const updatedBlocks = payload.message.blocks
                .filter((block: any) => block.type !== 'actions')
                .concat([
                  {
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: '❌ *Task declined*'
                      }
                    ]
                  }
                ]);
                
              await client.chat.update({
                channel: payload.container.channel_id,
                ts: payload.container.message_ts,
                blocks: updatedBlocks
              });
              
              response = {
                text: 'You have declined the task.',
                response_type: 'ephemeral',
                replace_original: false
              };
            } catch (error) {
              console.error('Error handling task decline:', error);
              response = {
                text: 'An error occurred while updating the task status.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
          }
          
          case 'complete_task': {
            try {
              const taskId = payload.actions[0].value;
              const slackUserId = payload.user.id;
              
              // Get user's Supabase ID from Slack ID
              const { data: user, error: userError } = await adminSupabase
                .from('users')
                .select('id, full_name')
                .eq('slack_user_id', slackUserId)
                .single();
                
              if (userError || !user) {
                console.error('Error finding user:', userError);
                response = {
                  text: 'Error identifying your user account.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Get task details
              const { data: task, error: taskError } = await adminSupabase
                .from('tasks')
                .select(`
                  *,
                  delegator:delegator_id(id, full_name, slack_user_id)
                `)
                .eq('id', taskId)
                .single();
                
              if (taskError || !task) {
                console.error('Error fetching task:', taskError);
                response = {
                  text: 'Error finding the task.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Check if the task is in a valid state to be completed
              if (task.status !== 'accepted' && task.status !== 'assigned') {
                response = {
                  text: `This task cannot be completed because it is ${task.status}.`,
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Update task status and set completion date
              const { data: updatedTask, error: updateError } = await adminSupabase
                .from('tasks')
                .update({ 
                  status: 'completed',
                  completion_date: new Date().toISOString()
                })
                .eq('id', taskId)
                .select()
                .single();
                
              if (updateError) {
                console.error('Error updating task:', updateError);
                response = {
                  text: 'Error updating task status.',
                  response_type: 'ephemeral',
                  replace_original: false
                };
                break;
              }
              
              // Record activity
              await recordActivity(user.id, 'task_completion', 'Completed task via Slack');
              
              // Notify the delegator
              const delegatorSlackId = (task.delegator as any).slack_user_id;
              if (delegatorSlackId) {
                await client.chat.postMessage({
                  channel: delegatorSlackId,
                  text: `🎉 ${user.full_name || 'Your assignee'} has completed the task: *${task.title}*`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: '🎉 Task Completed',
                        emoji: true
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Task:* ${task.title}`
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `${user.full_name || 'Your assignee'} has *completed* this task.`
                      }
                    },
                    task.slack_channel && task.slack_ts ? {
                      type: 'context',
                      elements: [
                        {
                          type: 'mrkdwn',
                          text: `<https://slack.com/archives/${task.slack_channel}/p${task.slack_ts.replace('.', '')}|View original message>`
                        }
                      ]
                    } : null
                  ].filter(Boolean) as any[]
                });
              }
              
              // Update the original message to remove the buttons
              const updatedBlocks = payload.message.blocks
                .filter((block: any) => block.type !== 'actions')
                .concat([
                  {
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: '🎉 *Task completed*'
                      }
                    ]
                  }
                ]);
                
              await client.chat.update({
                channel: payload.container.channel_id,
                ts: payload.container.message_ts,
                blocks: updatedBlocks
              });
              
              response = {
                text: 'Task marked as completed! 🎉',
                response_type: 'ephemeral',
                replace_original: false
              };
            } catch (error) {
              console.error('Error handling task completion:', error);
              response = {
                text: 'An error occurred while updating the task status.',
                response_type: 'ephemeral',
                replace_original: false
              };
            }
            break;
          }
            
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
            blocks: response.blocks
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

// Helper function to get user by ID
async function getUserById(userId: string) {
  try {
    const { data, error } = await adminSupabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
}