import { createServerClient } from './server';
import { Database } from '@/types/supabase';
import { supabase } from './client';

export type Tables = Database['public']['Tables'];
export type User = Tables['users']['Row'];
export type Team = Tables['teams']['Row'];
export type Task = Tables['tasks']['Row'];
export type Skill = Tables['skills']['Row'];
export type TeamMember = Tables['team_members']['Row'];
export type UserSkill = Tables['user_skills']['Row'];
export type SlackWorkspace = Tables['slack_workspaces']['Row'];

// User functions
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  
  return data;
}

export async function getUserTeams(userId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      team_id,
      teams:team_id(*)
    `)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching user teams:', error);
    return [];
  }
  
  // Extract the teams data from the response
  return data.map(item => item.teams as unknown as Team);
}

// Team functions
export async function getTeamMembers(teamId: string): Promise<(User & { role: string })[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role,
      user:user_id(*)
    `)
    .eq('team_id', teamId);
  
  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }
  
  return data.map(item => ({
    ...(item.user as unknown as User),
    role: item.role
  }));
}

// Tasks functions
export async function getTeamTasks(teamId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('team_id', teamId);
  
  if (error) {
    console.error('Error fetching team tasks:', error);
    return [];
  }
  
  return data;
}

// Skills functions
export async function getUserSkills(userId: string): Promise<(Skill & { proficiency_level: number | null })[]> {
  const { data, error } = await supabase
    .from('user_skills')
    .select(`
      proficiency_level,
      skill:skill_id(*)
    `)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching user skills:', error);
    return [];
  }
  
  return data.map(item => ({
    ...(item.skill as unknown as Skill),
    proficiency_level: item.proficiency_level
  }));
}

export async function getAllSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }
  
  return data;
}

// Task skills functions
export async function getTaskSkills(taskId: string): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('task_skills')
    .select(`
      skill:skill_id(*)
    `)
    .eq('task_id', taskId);
  
  if (error) {
    console.error('Error fetching task skills:', error);
    return [];
  }
  
  return data.map(item => item.skill as unknown as Skill);
}