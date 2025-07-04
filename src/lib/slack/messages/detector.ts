import { supabase } from '@/lib/supabase/client';
import { adminSupabase } from '@/lib/supabase/admin';
import { webClient } from '@/lib/slack/client';
import { getAllSkills } from '@/lib/supabase/db';
import { TaskDetectorFactory } from '@/lib/taskDetection/detectorFactory';
import { findBestAssignees } from '@/lib/tasks/assigneeMatchingService';
import { recordActivity } from '@/lib/activity/activityService';

export async function detectTaskInMessage(message: any): Promise<boolean> {
  // Skip messages from bots
  if (message.bot_id || message.app_id) {
    return false;
  }
  
  // Skip thread replies
  if (message.thread_ts && message.thread_ts !== message.ts) {
    return false;
  }
  
  // Skip messages that are too short
  if (!message.text || message.text.length < 10) {
    return false;
  }
  
  try {
    // Record this activity for the user
    const { data: userData } = await adminSupabase
      .from('users')
      .select('id')
      .eq('slack_user_id', message.user)
      .single();
      
    if (userData) {
      await recordActivity(userData.id, 'slack', 'Message in channel');
    }
    
    // Get all skills from the database
    const skills = await getAllSkills();
    const skillNames = skills.map(skill => skill.name);
    
    console.log(`Analyzing message for tasks. Available skills: ${skillNames.length}`);
    
    // Configure the task detector with available skills
    TaskDetectorFactory.setSkills(skillNames);
    const detector = TaskDetectorFactory.getDetector('rule-based');
    
    // Detect if message contains a task
    const detectionResult = await detector.detectTask(message.text, {
      confidenceThreshold: 0.45,
      verbose: true
    });
    
    console.log('Task detection result:', detectionResult);
    
    // If not detected as a task, skip
    if (!detectionResult.isTask) {
      return false;
    }
    
    // Get the Slack workspace for this team - using adminSupabase to bypass RLS
    let { data: slackWorkspace } = await adminSupabase
      .from('slack_workspaces')
      .select('*')
      .eq('slack_team_id', message.team)
      .single();
      
    if (!slackWorkspace) {
      console.log('No slack workspace found for team:', message.team);
      
      // Auto-provision a workspace for this team
      console.log('Attempting to auto-provision a workspace...');
      const { data: existingTeam } = await adminSupabase
        .from('teams')
        .select('*')
        .eq('name', 'Demo Team')
        .single();
        
      if (existingTeam) {
        // Create a slack workspace entry with the team ID
        const { data: newWorkspace, error } = await adminSupabase
          .from('slack_workspaces')
          .insert({
            team_id: existingTeam.id,
            slack_team_id: message.team,
            slack_access_token: process.env.SLACK_BOT_TOKEN || '',
            slack_bot_id: process.env.SLACK_BOT_ID || 'U08LR5K5HU6',
            slack_app_id: process.env.SLACK_APP_ID || 'A08M7HMHV5X'
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error auto-provisioning workspace:', error);
          return false;
        }
        
        console.log('Auto-provisioned workspace:', newWorkspace);
        
        // Use the new workspace
        slackWorkspace = newWorkspace;
      } else {
        console.error('No demo team found for auto-provisioning');
        return false;
      }
    }
    
    // Use detected skills for matching
    const detectedSkills = detectionResult.suggestedSkills || [];
    console.log('Skills detected in message:', detectedSkills);
    
    // Find the best assignees based on the task text and detected skills
    const bestAssignees = await findBestAssignees(
      slackWorkspace.team_id,
      detectionResult.taskText,
      userData?.id, // Exclude the sender
      detectedSkills
    );
    
    if (bestAssignees.length === 0) {
      console.log('No suitable assignees found');
      return false;
    }
    
    // Get the top suggested assignee
    const suggestedAssignee = bestAssignees[0];
    
    // Prepare task context info
    let contextInfo = '';
    
    // Add detected skills info
    if (detectedSkills.length > 0) {
      contextInfo += `\n• Skills: ${detectedSkills.join(', ')}`;
    }
    
    if (detectionResult.deadline) {
      contextInfo += `\n• Deadline: ${detectionResult.deadline}`;
    }
    if (detectionResult.priority) {
      contextInfo += `\n• Priority: ${detectionResult.priority.charAt(0).toUpperCase() + detectionResult.priority.slice(1)}`;
    }
    if (detectionResult.context) {
      contextInfo += `\n• Context: ${detectionResult.context}`;
    }
    
    // Format confidence as percentage
    const confidencePercent = Math.round(detectionResult.confidence * 100);
    
    // Format the matched skills text
    let skillsText = 'No specific skills required';
    if (suggestedAssignee.matchedSkills && suggestedAssignee.matchedSkills.length > 0) {
      skillsText = suggestedAssignee.matchedSkills.join(', ');
    }
    
    // Send ephemeral message to the original sender suggesting delegation
    try {
      await webClient.chat.postEphemeral({
        channel: message.channel,
        user: message.user,
        text: `I detected a potential task: "${detectionResult.taskText}"`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `I detected a potential task in your message (${confidencePercent}% confidence). Would you like to delegate it?`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Task:* ${detectionResult.taskText}${contextInfo}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recommended assignee:* ${suggestedAssignee.name} (Skills: ${skillsText}, ${suggestedAssignee.matchReason})`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "Select an assignee:"
            },
            accessory: {
              type: 'static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Choose...',
                emoji: true
              },
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: suggestedAssignee.name,
                  emoji: true
                },
                value: suggestedAssignee.userId
              },
              options: bestAssignees.map(assignee => ({
                text: {
                  type: 'plain_text',
                  text: assignee.name,
                  emoji: true
                },
                value: assignee.userId
              })),
              action_id: 'select_assignee'
            }
          },
          {
            type: 'actions',
            block_id: 'delegation_actions',
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
                  taskText: detectionResult.taskText,
                  channelId: message.channel,
                  messageTs: message.ts
                })
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Not a task',
                  emoji: true
                },
                action_id: 'not_a_task',
                style: 'danger'
              }
            ]
          }
        ]
      });
      
      return true;
    } catch (error) {
      console.error('Error sending task suggestion message:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in task detection:', error);
    return false;
  }
}