// src/lib/slack/commands/delegate.ts

import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { getAllSkills } from '@/lib/supabase/db';
import { findBestAssignees } from '@/lib/tasks/assigneeMatchingService';
import { recordActivity } from '@/lib/activity/activityService';
import { createTask } from '@/lib/tasks/taskService';
import { TaskDetectorFactory } from '@/lib/taskDetection/detectorFactory';

type CommandParams = {
  text: string;
  slackUserId: string;
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
    // Extract task details
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
    
    // Get skills to detect in the task text
    const skills = await getAllSkills();
    const skillNames = skills.map(skill => skill.name);
    
    // Use the task detector to identify skills and other details
    TaskDetectorFactory.setSkills(skillNames);
    const detector = TaskDetectorFactory.getDetector('rule-based');
    
    // Detect task details including skills
    const detectionResult = await detector.detectTask(taskText, {
      confidenceThreshold: 0.1, // Lower threshold since we already know it's a task
      verbose: true
    });
    
    // Get detected skills
    const detectedSkills = detectionResult.suggestedSkills || [];
    console.log('Skills detected in command:', detectedSkills);
    
    // Format the skills text
    const skillsText = detectedSkills.length > 0
      ? `\nSkills detected: ${detectedSkills.join(', ')}`
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
    
    // Use the enhanced assignee matching system with the detected skills
    const potentialAssignees = await findBestAssignees(
      teamIdToUse,
      taskText,
      userData.id,
      detectedSkills
    );
    
    // If no team members available for assignment
    if (potentialAssignees.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `Task: "${taskText}"\n\nYou need to add team members before you can delegate tasks.${skillsText}`,
      };
    }
    
    // Get the deadline info from detection if available
    let dueDate = null;
    let deadlineInfo = '';
    
    if (detectionResult.deadline) {
      deadlineInfo = `\n• Deadline: ${detectionResult.deadline}`;
      
      // Try to convert text deadline to date object for database
      try {
        // Simple date parsing for common formats
        const dateText = detectionResult.deadline.toLowerCase();
        let date = new Date();
        
        if (dateText.includes('tomorrow')) {
          date.setDate(date.getDate() + 1);
          dueDate = date.toISOString();
        } else if (dateText.includes('next week')) {
          date.setDate(date.getDate() + 7);
          dueDate = date.toISOString();
        } else if (dateText.includes('q1') || dateText.includes('quarter 1')) {
          date = new Date(date.getFullYear(), 2, 31); // End of Q1
          dueDate = date.toISOString();
        } else if (dateText.includes('q2') || dateText.includes('quarter 2')) {
          date = new Date(date.getFullYear(), 5, 30); // End of Q2
          dueDate = date.toISOString();
        } else if (dateText.includes('q3') || dateText.includes('quarter 3')) {
          date = new Date(date.getFullYear(), 8, 30); // End of Q3
          dueDate = date.toISOString();
        } else if (dateText.includes('q4') || dateText.includes('quarter 4')) {
          date = new Date(date.getFullYear(), 11, 31); // End of Q4
          dueDate = date.toISOString();
        } else if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(dateText)) {
          // Handle day of week
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          for (let i = 0; i < days.length; i++) {
            if (dateText.includes(days[i])) {
              const today = date.getDay();
              const daysUntil = (i - today + 7) % 7;
              date.setDate(date.getDate() + daysUntil);
              dueDate = date.toISOString();
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing deadline:', e);
      }
    }
    
    // Format priority if available
    let priorityInfo = '';
    if (detectionResult.priority) {
      priorityInfo = `\n• Priority: ${detectionResult.priority.charAt(0).toUpperCase() + detectionResult.priority.slice(1)}`;
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
            text: `*New Task*: ${taskText}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details*:${skillsText}${deadlineInfo}${priorityInfo}`
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
            options: potentialAssignees.map(assignee => {
              // Format the display text to show skills and reason
              let optionText = assignee.name;
              
              // Add skills info if available
              if (assignee.matchedSkills && assignee.matchedSkills.length > 0) {
                optionText += ` (Skills: ${assignee.matchedSkills.join(', ')})`;
              } else {
                // If no skills matched but we have a reason, show that
                optionText += ` (${assignee.matchReason})`;
              }
              
              // Ensure text fits within Slack's 75 character limit
              if (optionText.length > 75) {
                optionText = optionText.substring(0, 72) + '...';
              }
              
              return {
                text: {
                  type: 'plain_text',
                  text: optionText,
                  emoji: true
                },
                value: assignee.userId
              };
            })
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
                skills: detectedSkills,
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