import { WebClient } from '@slack/web-api';
import { Task } from '@/lib/tasks/taskService';

export async function sendTaskAssignmentNotification(
  slackClient: WebClient,
  task: Task,
  assigneeName: string,
  assigneeSlackId: string,
  delegatorName: string
): Promise<boolean> {
  try {
    // Format due date if exists
    const dueDate = task.due_date 
      ? `<!date^${Math.floor(new Date(task.due_date).getTime() / 1000)}^{date_short_pretty}|${task.due_date}>`
      : 'No due date';
    
    // Build context link
    let contextLink = '';
    if (task.slack_channel && task.slack_ts) {
      contextLink = `<https://slack.com/archives/${task.slack_channel}/p${task.slack_ts.replace('.', '')}|View original message>`;
    }
    
    // Send DM to assignee
    await slackClient.chat.postMessage({
      channel: assigneeSlackId,
      text: `You've been assigned a new task by ${delegatorName}`,
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
            text: `*Task:* ${task.title}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Assigned by:* ${delegatorName}`
            },
            {
              type: 'mrkdwn',
              text: `*Due date:* ${dueDate}`
            }
          ]
        },
        task.description ? {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:* ${task.description}`
          }
        } : null,
        contextLink ? {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: contextLink
            }
          ]
        } : null,
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
      ].filter(Boolean) as any[]
    });
    
    return true;
  } catch (error) {
    console.error('Error sending task assignment notification:', error);
    return false;
  }
}

export async function sendTaskStatusUpdateNotification(
  slackClient: WebClient,
  task: Task,
  newStatus: string,
  userId: string,
  userName: string,
  recipientSlackId: string
): Promise<boolean> {
  try {
    // Get status emoji
    let statusEmoji = '🔄';
    let statusText = 'updated';
    
    switch (newStatus) {
      case 'accepted':
        statusEmoji = '✅';
        statusText = 'accepted';
        break;
      case 'declined':
        statusEmoji = '❌';
        statusText = 'declined';
        break;
      case 'completed':
        statusEmoji = '🎉';
        statusText = 'completed';
        break;
    }
    
    // Send notification
    await slackClient.chat.postMessage({
      channel: recipientSlackId,
      text: `Task status update: ${task.title} was ${statusText} by ${userName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} Task ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
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
            text: `${userName} has *${statusText}* this task.`
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
    
    return true;
  } catch (error) {
    console.error('Error sending task status update notification:', error);
    return false;
  }
}

export async function sendTaskReminderNotification(
  slackClient: WebClient,
  task: Task,
  recipientSlackId: string
): Promise<boolean> {
  try {
    const dueDate = task.due_date 
      ? `<!date^${Math.floor(new Date(task.due_date).getTime() / 1000)}^{date_short_pretty}|${task.due_date}>`
      : 'No due date';
    
    await slackClient.chat.postMessage({
      channel: recipientSlackId,
      text: `Reminder: Task "${task.title}" is due soon`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⏰ Task Reminder',
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
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:* ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`
            },
            {
              type: 'mrkdwn',
              text: `*Due date:* ${dueDate}`
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
                text: 'Mark as Completed',
                emoji: true
              },
              style: 'primary',
              action_id: 'complete_task',
              value: task.id
            }
          ]
        }
      ]
    });
    
    return true;
  } catch (error) {
    console.error('Error sending task reminder notification:', error);
    return false;
  }
}