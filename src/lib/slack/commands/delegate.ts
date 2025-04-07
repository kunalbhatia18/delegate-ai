import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { getAllSkills } from '@/lib/supabase/db';
import { findBestAssignees } from '@/lib/tasks/assigneeMatchingService';
import { recordActivity } from '@/lib/activity/activityService';

type CommandParams = {
  text: string;
  userId: string;
  channelId: string;
  teamId: string;
  responseUrl: string;
};

export async function handleDelegateCommand({ text, userId, channelId, teamId, responseUrl }: CommandParams) {
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
    
    // Record activity for this user
    await recordActivity(userId, 'slack', 'Used /delegate command');
    
    // Get skills to check if any match in the task text
    const skills = await getAllSkills();
    
    // Very basic skill matching - just check if the skill name appears in the text
    const matchedSkills = skills.filter(skill => 
      taskText.toLowerCase().includes(skill.name.toLowerCase())
    );
    
    const skillsText = matchedSkills.length > 0
      ? `\nSkills detected: ${matchedSkills.map(s => s.name).join(', ')}`
      : '\nNo specific skills detected';
    
    // Use the enhanced assignee matching system
    const potentialAssignees = await findBestAssignees(
      teamId,
      taskText,
      userId,
      matchedSkills.map(s => s.name)
    );
    
    // If no team members available for assignment
    if (potentialAssignees.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `Task: "${taskText}"\n\nYou need to add team members before you can delegate tasks.${skillsText}`,
      };
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
                skills: matchedSkills.map(s => s.id)
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
      ]
    };
  } catch (error) {
    console.error('Error handling delegate command:', error);
    return {
      response_type: 'ephemeral',
      text: 'An error occurred while processing your command. Please try again later.',
    };
  }
}