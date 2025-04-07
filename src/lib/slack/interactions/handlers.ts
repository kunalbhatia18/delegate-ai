// src/lib/slack/interactions/handlers.ts

import { supabase } from '@/lib/supabase/client';
import { getUserById } from '@/lib/supabase/db';
import { webClient, sendDirectMessage } from '@/lib/slack/client';

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
    const { taskText, channelId, skills } = buttonValue;
    
    // Get delegator's Supabase user ID
    const slackUserId = payload.user.id;
    
    // Get the user's team
    const { data: teamMemberData } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .single();
    
    if (!teamMemberData) {
      return {
        response_type: 'ephemeral',
        text: 'Error: Could not find your team information.',
        replace_original: false
      };
    }
    
    const teamId = teamMemberData.team_id;
    
    // Create the task in Supabase
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: taskText,
        description: `Delegated from Slack in #${payload.channel.name}`,
        delegator_id: userId,
        assignee_id: selectedUserId,
        team_id: teamId,
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
      await sendDirectMessage(assignee.slack_user_id, 
        `You've been assigned a new task: *${taskText}*\n` +
        `View more details and track this task in the DelegateAI dashboard.`
      );
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
      await sendDirectMessage(assignee.slack_user_id, 
        `You've been assigned a new task: *${taskText}*\n` +
        `View more details and track this task in the DelegateAI dashboard.`
      );
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