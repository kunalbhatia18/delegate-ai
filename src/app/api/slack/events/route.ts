// src/app/api/slack/events/route.ts
import { NextResponse } from 'next/server';
import { detectTaskInMessage } from '@/lib/slack/messages/detector';

// Set to store processed event IDs (lost on server restart, but works for running session)
const processedEvents = new Set<string>();

export async function POST(request: Request) {
  console.log('Received event to /api/slack/events endpoint!');
  
  try {
    const body = await request.json();
    
    // Skip bot messages
    if (body.event?.bot_id || body.event?.app_id) {
      return NextResponse.json({ ok: true });
    }
    
    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      console.log('Handling verification challenge');
      return NextResponse.json({ challenge: body.challenge });
    }
    
    // Deduplicate events
    if (body.event_id) {
      if (processedEvents.has(body.event_id)) {
        console.log('Skipping duplicate event:', body.event_id);
        return NextResponse.json({ ok: true });
      }
      
      // Add to processed events
      processedEvents.add(body.event_id);
      
      // Clean up old events (keep last 100)
      if (processedEvents.size > 100) {
        const idsToRemove = Array.from(processedEvents).slice(0, processedEvents.size - 100);
        idsToRemove.forEach(id => processedEvents.delete(id));
      }
    }
    
    // Only process message events
    if (body.event && body.event.type === 'message') {
      console.log('Message event received from channel:', body.event.channel);
      console.log('Message text:', body.event.text);
      
      try {
        // Process the message for task detection
        const detected = await detectTaskInMessage(body.event);
        console.log('Task detected:', detected);
      } catch (error) {
        console.error('Error processing message event:', error);
      }
    } else {
      console.log('Non-message event received:', body.type);
    }
    
    // Always return 200 OK quickly to acknowledge the event
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing event:', error);
    return NextResponse.json({ ok: false, error: 'Error processing event' });
  }
}