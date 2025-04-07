// src/lib/slack/interactions/handlers.ts

import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { getUserById } from '@/lib/supabase/db';
import { webClient, sendDirectMessage } from '@/lib/slack/client';
import { updateTaskStatus } from '@/lib/tasks/taskService';
import { recordActivity } from '@/lib/activity/activityService';
import { WebClient } from '@slack/web-api';

// Store state between selection and confirmation
const delegationState = new Map();

export async function handleSelectAssignee(payload: any) {
  const userId = payload.user.id;
  const selectedUserId = payload.actions[0].selected_option.value;
  
  // Store the selected user for this delegation
  delegationState.set(`${userId}_assignee`, selectedUserId);
  
  return {
    response_type: 'ephemeral',
    text: 'Team member selected. Click "Delegate Task" to confirm.',
    replace_original: false
  };
}

export async function handleCancelDelegate(payload: any) {
  const userId = payload.user.id;
  
  // Clean up any stored state
  delegationState.delete(`${userId}_assignee`);
  
  return {
    response_type: 'ephemeral',
    text: 'Task delegation cancelled.',
    delete_original: true
  };
}

export async function handleConfirmDelegate(payload: any) {
  const userId = payload.user.id;
  const selectedUserId = delegationState.get(`${userId}_assignee`);
  
  // If no assignee was selected
  if (!selectedUserId) {
    return {
      response_type: 'ephemeral',
      text: 'Please select a team member to delegate to first.',
      replace_original: false
    };
  }
  
  try {
    // Parse the button value to get task details
    const buttonValue = JSON.parse(payload.actions[0].value);
    const { taskText, channelId, skills, teamId } = buttonValue;
    
    // Get delegator's Supabase user ID
    const slackUserId = payload.user.id;
    
    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('slack_user_id', slackUserId)
      .single();
    
    if (!userData) {
      return {
        response_type: 'ephemeral',
        text: 'Error: Could not find your user information.',
        replace_original: false
      };
    }
    
    // Record activity for delegation
    await recordActivity(userData.id, 'slack', 'Delegated task via Slack');
    
    // Get the user's team if not provided
    let effectiveTeamId = teamId;
    if (!effectiveTeamId) {
      const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userData.id)
        .single();
      
      if (!teamMemberData) {
        return {
          response_type: 'ephemeral',
          text: 'Error: Could not find your team information.',
          replace_original: false
        };
      }
      
      effectiveTeamId = teamMemberData.team_id;
    }
    
    // Create the task in Supabase
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: taskText,
        description: `Delegated from Slack in #${payload.channel.name}`,
        delegator_id: userData.id,
        assignee_id: selectedUserId,
        team_id: effectiveTeamId,
        status: 'assigned',
        slack_ts: payload.message.ts,
        slack_channel: channelId
      })
      .select()
      .single();
    
    if (taskError) {
      console.error('Error creating task:', taskError);
      return {
        response_type: 'ephemeral',
        text: 'Error creating task in database. Please try again.',
        replace_original: false
      };
    }
    
    // Add skills to the task if any
    if (skills && skills.length > 0) {
      const skillConnections = skills.map((skillId: string) => ({
        task_id: task.id,
        skill_id: skillId
      }));
      
      await supabase.from('task_skills').insert(skillConnections);
    }
    
    // Get assignee information
    const assignee = await getUserById(selectedUserId);
    const assigneeName = assignee?.full_name || 'Team member';
    
    // Notify the assignee if they have a Slack ID
    if (assignee?.slack_user_id) {
      // Send a more detailed notification with buttons
      await webClient.chat.postMessage({
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
                text: `<https://slack.com/archives/${channelId}/p${payload.message.ts.replace('.', '')}|View original message>`
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
    
    // Clean up state
    delegationState.delete(`${userId}_assignee`);
    
    // Post success message in thread
    await webClient.chat.postMessage({
      channel: channelId,
      thread_ts: payload.message.ts,
      text: `✅ Task delegated to ${assigneeName}: *${taskText}*`
    });
    
    // Update the original message
    return {
      response_type: 'ephemeral',
      text: `Successfully delegated task to ${assigneeName}.`,
      delete_original: true
    };
  } catch (error) {
    console.error('Error confirming delegation:', error);
    return {
      response_type: 'ephemeral',
      text: 'An error occurred while delegating the task. Please try again.',
      replace_original: false
    };
  }
}

export async function handleAutoDelegate(payload: any) {
  try {
    // Parse the button value to get task details
    const buttonValue = JSON.parse(payload.actions[0].value);
    const { taskText, channelId, assigneeId, messageTs } = buttonValue;
    
    // Get the sender's user ID
    const slackUserId = payload.user.id;
    
    // Get user information from Supabase
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();
      
    if (!userData) {
      return {
        response_type: 'ephemeral',
        text: 'Error: Could not find your user information.',
        replace_original: false
      };
    }
    
    // Record activity
    await recordActivity(userData.id, 'slack', 'Auto-delegated task via Slack');
    
    // Get the user's team
    const { data: teamMemberData } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userData.id)
      .single();
    
    if (!teamMemberData) {
      return {
        response_type: 'ephemeral',
        text: 'Error: Could not find your team information.',
        replace_original: false
      };
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
    
    // Create the task in Supabase
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: taskText,
        description: `Auto-detected task from Slack`,
        delegator_id: userData.id,
        assignee_id: assigneeId,
        team_id: teamMemberData.team_id,
        status: 'assigned',
        slack_ts: messageTs,
        slack_channel: channelId
      })
      .select()
      .single();
    
    if (taskError) {
      console.error('Error creating task:', taskError);
      return {
        response_type: 'ephemeral',
        text: 'Error creating task in database. Please try again.',
        replace_original: false
      };
    }
    
    // Notify the assignee if they have a Slack ID
    if (assignee.slack_user_id) {
      // Send a more detailed notification with buttons
      await webClient.chat.postMessage({
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
    await webClient.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: `✅ Task delegated to ${assignee.full_name || 'Team member'}: *${taskText}*`
    });
    
    // Update the original ephemeral message
    return {
      response_type: 'ephemeral',
      text: `Successfully delegated to ${assignee.full_name || 'Team member'}: "${taskText}"`,
      delete_original: true
    };
  } catch (error) {
    console.error('Error in auto-delegation:', error);
    return {
      response_type: 'ephemeral',
      text: 'An error occurred while delegating the task. Please try again.',
      replace_original: false
    };
  }
}

export async function handleNotATask(payload: any) {
  // Simply acknowledge and remove the suggestion
  return {
    response_type: 'ephemeral',
    text: 'Got it! I\'ll be more careful with my suggestions in the future.',
    delete_original: true
  };
}

// NEW FUNCTIONS FOR TASK STATUS MANAGEMENT

export async function handleTaskAcceptance(
  client: WebClient,
  taskId: string,
  slackUserId: string
): Promise<boolean> {
  try {
    // Get user ID from Slack ID
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .select('id, full_name')
      .eq('slack_user_id', slackUserId)
      .single();
      
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return false;
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
      return false;
    }
    
    // Update task status
    const updatedTask = await updateTaskStatus(taskId, 'accepted', user.id);
    
    if (!updatedTask) {
      console.error('Failed to update task status');
      return false;
    }
    
    // Record activity
    await recordActivity(user.id, 'slack', 'Accepted task via Slack');
    
    // Get delegator's Slack ID for notification
    const delegatorSlackId = (task.delegator as any).slack_user_id;
    
    if (delegatorSlackId) {
      // Send notification to delegator
      await client.chat.postMessage({
        channel: delegatorSlackId,
        text: `✅ ${user.full_name || 'Team member'} has accepted your task: *${task.title}*`,
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
              text: `${user.full_name || 'Team member'} has *accepted* this task.`
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
    
    return true;
  } catch (error) {
    console.error('Error handling task acceptance:', error);
    return false;
  }
}

export async function handleTaskDecline(
  client: WebClient,
  taskId: string,
  slackUserId: string
): Promise<boolean> {
  try {
    // Get user ID from Slack ID
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .select('id, full_name')
      .eq('slack_user_id', slackUserId)
      .single();
      
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return false;
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
      return false;
    }
    
    // Update task status
    const updatedTask = await updateTaskStatus(taskId, 'declined', user.id);
    
    if (!updatedTask) {
      console.error('Failed to update task status');
      return false;
    }
    
    // Record activity
    await recordActivity(user.id, 'slack', 'Declined task via Slack');
    
    // Get delegator's Slack ID for notification
    const delegatorSlackId = (task.delegator as any).slack_user_id;
    
    if (delegatorSlackId) {
      // Send notification to delegator
      await client.chat.postMessage({
        channel: delegatorSlackId,
        text: `❌ ${user.full_name || 'Team member'} has declined your task: *${task.title}*`,
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
              text: `${user.full_name || 'Team member'} has *declined* this task.`
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
    
    return true;
  } catch (error) {
    console.error('Error handling task decline:', error);
    return false;
  }
}

export async function handleTaskCompletion(
  client: WebClient,
  taskId: string,
  slackUserId: string
): Promise<boolean> {
  try {
    // Get user ID from Slack ID
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .select('id, full_name')
      .eq('slack_user_id', slackUserId)
      .single();
      
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return false;
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
      return false;
    }
    
    // Update task status
    const updatedTask = await updateTaskStatus(taskId, 'completed', user.id);
    
    if (!updatedTask) {
      console.error('Failed to update task status');
      return false;
    }
    
    // Record activity
    await recordActivity(user.id, 'task_completion', 'Completed task via Slack');
    
    // Get delegator's Slack ID for notification
    const delegatorSlackId = (task.delegator as any).slack_user_id;
    
    if (delegatorSlackId) {
      // Send notification to delegator
      await client.chat.postMessage({
        channel: delegatorSlackId,
        text: `🎉 ${user.full_name || 'Team member'} has completed your task: *${task.title}*`,
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
              text: `${user.full_name || 'Team member'} has *completed* this task.`
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
    
    return true;
  } catch (error) {
    console.error('Error handling task completion:', error);
    return false;
  }
}