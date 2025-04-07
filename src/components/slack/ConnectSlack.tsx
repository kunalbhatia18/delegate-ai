//src/components/slack/ConnectSlack.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function ConnectSlack() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  
  useEffect(() => {
    async function processSlackData() {
      try {
        setLoading(true);
        
        // Check for Slack token or status in URL params
        const slackToken = searchParams.get('slackToken');
        const slackSuccess = searchParams.get('slackConnectSuccess');
        const slackError = searchParams.get('slackConnectError');
        
        if (slackError) {
          const reason = searchParams.get('reason') || 'unknown';
          setMessage(`Error connecting to Slack: ${reason}`);
          console.error('Slack connection error:', reason);
          return;
        }
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setMessage('You must be logged in to connect Slack');
          return;
        }
        
        // Handle the secure Slack token
        if (slackToken) {
          // Fetch the actual data using the token
          try {
            const response = await fetch('/api/slack/oauth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: slackToken })
            });
            
            const result = await response.json();
            
            if (result.error) {
              setMessage(`Error: ${result.error}`);
              return;
            }
            
            const slackData = result.data;
            console.log('Retrieved secure Slack data');
            
            // Get user's team
            const { data: teamMember } = await supabase
              .from('team_members')
              .select('team_id')
              .eq('user_id', user.id)
              .single();

            let teamId;
            
            if (!teamMember) {
              // Create a team if none exists
              const { data: newTeam } = await supabase
                .from('teams')
                .insert({ name: 'My Team' })
                .select()
                .single();
              
              if (!newTeam) {
                setMessage('Failed to create team');
                return;
              }
              
              // Create team membership
              await supabase
                .from('team_members')
                .insert({
                  user_id: user.id,
                  team_id: newTeam.id,
                  role: 'owner'
                });
              
              teamId = newTeam.id;
            } else {
              teamId = teamMember.team_id;
            }
            
            // Save Slack connection to database
            const { error: saveError } = await supabase
              .from('slack_workspaces')
              .upsert({
                team_id: teamId,
                slack_team_id: slackData.slackTeamId,
                slack_access_token: slackData.accessToken,
                slack_bot_id: slackData.botUserId,
                slack_app_id: slackData.appId
              });
            
            if (saveError) {
              console.error('Error saving Slack connection:', saveError);
              setMessage('Failed to save Slack connection');
              return;
            }
            
            setIsConnected(true);
            setMessage('Slack connected successfully!');
            
            // Clear URL parameters
            window.history.replaceState({}, '', '/dashboard/connect-slack');
          } catch (fetchError) {
            console.error('Error fetching Slack data:', fetchError);
            setMessage('Failed to retrieve Slack data');
          }
        } else if (slackSuccess) {
          setIsConnected(true);
          setMessage('Slack connected successfully!');
        } else {
          // Check if team has Slack connected
          const { data: teamMembers } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user.id);
          
          if (teamMembers && teamMembers.length > 0) {
            const { data: slackWorkspace } = await supabase
              .from('slack_workspaces')
              .select('*')
              .eq('team_id', teamMembers[0].team_id)
              .single();
            
            if (slackWorkspace) {
              setIsConnected(true);
            }
          }
        }
      } catch (error) {
        console.error('Error processing Slack data:', error);
        setMessage('An error occurred while processing Slack data');
      } finally {
        setLoading(false);
      }
    }
    
    processSlackData();
  }, [searchParams]);

  const handleConnectSlack = () => {
    // Create a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('slackOAuthState', state);
    
    // Slack OAuth URL with scopes
    const scopes = [
      'channels:history',
      'channels:read',
      'chat:write',
      'commands',
      'users:read',
      'users:read.email',
      'im:write',
      'im:history'
    ].join(',');
    
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth`;
    const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
    
    // Redirect to Slack OAuth page
    window.location.href = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  };
  
  if (loading) {
    return <div className="flex justify-center items-center py-12">Loading...</div>;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Slack Integration</h2>
      
      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('Error') || message.includes('Failed') 
          ? 'bg-red-100 text-red-700' 
          : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      
      {isConnected ? (
        <div>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium">Slack is connected</h3>
              <p className="text-sm text-gray-500">Your workspace is connected to DelegateAI</p>
            </div>
          </div>
          
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => {
              // We'll add disconnect functionality later
              alert('Disconnect functionality will be added in a future update');
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4">
            Connect your Slack workspace to enable DelegateAI to detect tasks, match them with team members, and track delegation status.
          </p>
          
          <button
            type="button"
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            onClick={handleConnectSlack}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" className="h-5 w-5 mr-2">
              <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a"></path>
              <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0"></path>
              <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d"></path>
              <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e"></path>
            </svg>
            Connect to Slack
          </button>
        </div>
      )}
    </div>
  );
}