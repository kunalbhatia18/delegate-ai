// src/lib/slack/commands/delegate.ts

import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { getAllSkills } from '@/lib/supabase/db';
import { findBestAssignees } from '@/lib/tasks/assigneeMatchingService';
import { recordActivity } from '@/lib/activity/activityService';
import { createTask } from '@/lib/tasks/taskService';

type CommandParams = {
  text: string;
  slackUserId: string; // Changed from userId to match what's actually passed
  channelId: string;
  teamId: string;
  responseUrl: string;
};

export async function handleDelegateCommand({ text, slackUserId, channelId, teamId, responseUrl }: CommandParams) {
  // If no task text is provided
  if (!text.trim()) {
    return {
      response_type: 'ephemeral',
      text: 'Please provide a task description. Example: `/delegate Prepare Q2 report`',
    };
  }

  try {
    // Extract task details (basic version for now)
    const taskText = text.trim();
    
    console.log(`Looking up user with slack_user_id: ${slackUserId}`);
    
    // Get the user's Supabase ID from their Slack ID
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('id, full_name')
      .eq('slack_user_id', slackUserId)
      .single();
      
    if (userError || !userData) {
      console.error('Error finding user:', userError);
      return {
        response_type: 'ephemeral',
        text: 'Error: Could not find your user information in the system.',
      };
    }
    
    console.log(`Found user: ${JSON.stringify(userData)}`);
    
    // Record activity for this user
    await recordActivity(userData.id, 'slack', 'Used /delegate command');
    
    // Get skills to check if any match in the task text
    const skills = await getAllSkills();
    
    // Very basic skill matching - just check if the skill name appears in the text
    const matchedSkills = skills.filter(skill => 
      taskText.toLowerCase().includes(skill.name.toLowerCase())
    );
    
    const skillsText = matchedSkills.length > 0
      ? `\nSkills detected: ${matchedSkills.map(s => s.name).join(', ')}`
      : '\nNo specific skills detected';
    
    console.log(`Looking up workspace with slack_team_id: ${teamId}`);
    
    // Get team ID from Slack team ID
    const { data: workspaceData, error: workspaceError } = await adminSupabase
      .from('slack_workspaces')
      .select('team_id')
      .eq('slack_team_id', teamId)
      .single();
    
    let teamIdToUse = teamId;
    
    if (workspaceError || !workspaceData) {
      console.log('Workspace not found in slack_workspaces, using provided team_id');
      // Already have team ID from parameter
    } else {
      teamIdToUse = workspaceData.team_id;
      console.log(`Using team ID from slack_workspaces: ${teamIdToUse}`);
    }
    
    // Use the enhanced assignee matching system with the correct team ID
    const potentialAssignees = await findBestAssignees(
      teamIdToUse,
      taskText,
      userData.id,
      matchedSkills.map(s => s.name)
    );
    
    // If no team members available for assignment
    if (potentialAssignees.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `Task: "${taskText}"\n\nYou need to add team members before you can delegate tasks.${skillsText}`,
      };
    }
    
    // Now compose the due date section if needed
    // You could add more sophisticated date parsing here
    let dueDate = null;
    const dueDateMatch = taskText.match(/by\s+(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)/i);
    if (dueDateMatch) {
      // A very simple date parser for demonstration
      const dateText = dueDateMatch[0].toLowerCase();
      let date = new Date();
      
      if (dateText.includes('tomorrow')) {
        date.setDate(date.getDate() + 1);
      } else if (dateText.includes('next')) {
        // Set to next week
        date.setDate(date.getDate() + 7);
      } else {
        // Set to this week
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dueDateMatch[2].toLowerCase());
        if (targetDay !== -1) {
          const currentDay = date.getDay();
          const daysToAdd = (targetDay + 7 - currentDay) % 7;
          date.setDate(date.getDate() + daysToAdd);
        }
      }
      
      dueDate = date.toISOString();
    }
    
    // Create a basic interactive message to select an assignee
    return {
      response_type: 'ephemeral',
      text: `New task: "${taskText}"${skillsText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Task*: ${taskText}${skillsText}`
          }
        },
        dueDate ? {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Due Date*: ${new Date(dueDate).toLocaleDateString()}`
          }
        } : null,
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Select a team member to delegate this task to:'
          },
          accessory: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Assign to...',
              emoji: true
            },
            action_id: 'select_assignee',
            options: potentialAssignees.map(assignee => ({
              text: {
                type: 'plain_text',
                text: `${assignee.name} (${assignee.matchReason})`.substring(0, 75), // Slack limits option text to 75 chars
                emoji: true
              },
              value: assignee.userId
            }))
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Delegate Task',
                emoji: true
              },
              action_id: 'confirm_delegate',
              style: 'primary',
              value: JSON.stringify({
                taskText,
                channelId,
                skills: matchedSkills.map(s => s.id),
                dueDate,
                teamId: teamIdToUse,
                delegatorId: userData.id
              })
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Cancel',
                emoji: true
              },
              action_id: 'cancel_delegate',
              style: 'danger'
            }
          ]
        }
      ].filter(Boolean) // Remove null blocks
    };
  } catch (error) {
    console.error('Error handling delegate command:', error);
    return {
      response_type: 'ephemeral',
      text: 'An error occurred while processing your command. Please try again later.',
    };
  }
}