'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAllSkills, UserSkillInfo } from '@/lib/skills/skillService';

interface TeamMemberSkills {
  userId: string;
  userName: string;
  email: string;
  skills: UserSkillInfo[];
}

interface TeamSkillsManagementProps {
  teamId: string;
}

export default function TeamSkillsManagement({ teamId }: TeamSkillsManagementProps) {
  const { user } = useAuth();
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [memberSkills, setMemberSkills] = useState<TeamMemberSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add new skill form state
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDescription, setNewSkillDescription] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);
  
  // Add skill to user form state
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [proficiencyLevel, setProficiencyLevel] = useState<number>(3);
  const [assigningSkill, setAssigningSkill] = useState(false);
  
  // Fetch data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Get team members
        const membersResponse = await fetch(`/api/team-members?teamId=${teamId}`);
        if (!membersResponse.ok) throw new Error('Failed to fetch team members');
        const membersData = await membersResponse.json();
        setTeamMembers(membersData || []);
        
        // Get all available skills
        const skills = await getAllSkills();
        setAllSkills(skills);
        
        // Get skills for each team member
        const membersWithSkills: TeamMemberSkills[] = [];
        
        for (const member of membersData) {
          const skillsResponse = await fetch(`/api/user-skills?userId=${member.user_id}`);
          
          if (skillsResponse.ok) {
            const skillsData = await skillsResponse.json();
            
            membersWithSkills.push({
              userId: member.user_id,
              userName: member.users.full_name || 'Unnamed User',
              email: member.users.email,
              skills: skillsData || []
            });
          }
        }
        
        setMemberSkills(membersWithSkills);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load team skills data');
      } finally {
        setLoading(false);
      }
    }
    
    if (teamId) {
      fetchData();
    }
  }, [teamId]);
  
  // Handle adding a new skill to the system
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSkillName.trim()) return;
    
    try {
      setAddingSkill(true);
      
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_skill',
          name: newSkillName.trim(),
          description: newSkillDescription.trim() || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add skill');
      }
      
      const newSkill = await response.json();
      
      // Update skills list
      setAllSkills([...allSkills, newSkill]);
      
      // Reset form
      setNewSkillName('');
      setNewSkillDescription('');
      setShowAddSkillForm(false);
      
    } catch (err) {
      console.error('Error adding skill:', err);
      setError('Failed to add skill. Please try again.');
    } finally {
      setAddingSkill(false);
    }
  };
  
  // Handle assigning a skill to a team member
  const handleAssignSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMember || !selectedSkill) return;
    
    try {
      setAssigningSkill(true);
      
      const response = await fetch('/api/user-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember,
          skillId: selectedSkill,
          proficiencyLevel
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to assign skill');
      }
      
      const updatedSkills = await response.json();
      
      // Update the memberSkills state
      setMemberSkills(memberSkills.map(member => 
        member.userId === selectedMember
          ? { ...member, skills: updatedSkills }
          : member
      ));
      
      // Reset form
      setSelectedSkill('');
      setProficiencyLevel(3);
      
    } catch (err) {
      console.error('Error assigning skill:', err);
      setError('Failed to assign skill. Please try again.');
    } finally {
      setAssigningSkill(false);
    }
  };
  
  // Handle removing a skill from a team member
  const handleRemoveSkill = async (userId: string, skillId: string) => {
    try {
      const response = await fetch(`/api/user-skills?userId=${userId}&skillId=${skillId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove skill');
      }
      
      // Update the memberSkills state
      setMemberSkills(memberSkills.map(member => 
        member.userId === userId
          ? { 
              ...member, 
              skills: member.skills.filter(skill => skill.skillId !== skillId) 
            }
          : member
      ));
      
    } catch (err) {
      console.error('Error removing skill:', err);
      setError('Failed to remove skill. Please try again.');
    }
  };
  
  // Handle updating a skill proficiency level
  const handleUpdateProficiency = async (userId: string, skillId: string, newLevel: number) => {
    try {
      const response = await fetch('/api/user-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          skillId,
          proficiencyLevel: newLevel
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update skill level');
      }
      
      const updatedSkills = await response.json();
      
      // Update the memberSkills state
      setMemberSkills(memberSkills.map(member => 
        member.userId === userId
          ? { ...member, skills: updatedSkills }
          : member
      ));
      
    } catch (err) {
      console.error('Error updating skill level:', err);
      setError('Failed to update skill level. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Team Skills Management</h2>
        <div className="flex justify-center py-8">
          <div className="text-gray-500">Loading skills data...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Team Skills Management</h2>
          <div className="space-x-3">
            <button
              onClick={() => setShowAddSkillForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Add New Skill
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="px-6 py-4 bg-red-100 border-b border-red-200 text-red-700">
          {error}
        </div>
      )}
      
      {/* Add New Skill Form */}
      {showAddSkillForm && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-3">Add New Skill</h3>
          
          <form onSubmit={handleAddSkill}>
            <div className="grid gap-4 mb-4 md:grid-cols-2">
              <div>
                <label htmlFor="skillName" className="block text-sm font-medium text-gray-700 mb-1">
                  Skill Name
                </label>
                <input
                  id="skillName"
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="skillDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  id="skillDescription"
                  type="text"
                  value={newSkillDescription}
                  onChange={(e) => setNewSkillDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddSkillForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={addingSkill}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                disabled={addingSkill || !newSkillName.trim()}
              >
                {addingSkill ? 'Adding...' : 'Add Skill'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Team Members Skills */}
      <div className="px-6 py-4">
        <h3 className="text-lg font-medium mb-4">Team Member Skills</h3>
        
        {/* Member selection */}
        <div className="mb-6">
          <label htmlFor="memberSelect" className="block text-sm font-medium text-gray-700 mb-1">
            Select Team Member
          </label>
          <select
            id="memberSelect"
            value={selectedMember || ''}
            onChange={(e) => setSelectedMember(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a team member</option>
            {teamMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.users.full_name || member.users.email}
              </option>
            ))}
          </select>
        </div>
        
        {/* Assign skill to selected member */}
        {selectedMember && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-medium mb-3">Assign Skill to {
              memberSkills.find(m => m.userId === selectedMember)?.userName
            }</h4>
            
            <form onSubmit={handleAssignSkill} className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="skillSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Skill
                </label>
                <select
                  id="skillSelect"
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a skill</option>
                  {allSkills
                    .filter(skill => 
                      !memberSkills
                        .find(m => m.userId === selectedMember)?.skills
                        .some(s => s.skillId === skill.id)
                    )
                    .map((skill) => (
                      <option key={skill.id} value={skill.id}>{skill.name}</option>
                    ))
                  }
                </select>
              </div>
              
              <div>
                <label htmlFor="proficiencyLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Proficiency Level
                </label>
                <select
                  id="proficiencyLevel"
                  value={proficiencyLevel}
                  onChange={(e) => setProficiencyLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 - Beginner</option>
                  <option value={2}>2 - Basic</option>
                  <option value={3}>3 - Intermediate</option>
                  <option value={4}>4 - Advanced</option>
                  <option value={5}>5 - Expert</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={assigningSkill || !selectedSkill}
                >
                  {assigningSkill ? 'Assigning...' : 'Assign Skill'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Display skills for each member */}
        <div className="space-y-6">
          {memberSkills.map((member) => (
            <div key={member.userId} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h4 className="font-medium">{member.userName}</h4>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
              
              <div className="p-4">
                {member.skills.length === 0 ? (
                  <p className="text-gray-500">No skills assigned yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {member.skills.map((skill) => (
                      <div key={skill.skillId} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{skill.skillName}</h5>
                            {skill.description && (
                              <p className="text-sm text-gray-500">{skill.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveSkill(member.userId, skill.skillId)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove skill"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="mt-2">
                          <label className="block text-sm text-gray-600 mb-1">
                            Proficiency: {skill.proficiencyLevel}/5
                          </label>
                          <select
                            value={skill.proficiencyLevel}
                            onChange={(e) => handleUpdateProficiency(
                              member.userId, 
                              skill.skillId, 
                              parseInt(e.target.value)
                            )}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value={1}>1 - Beginner</option>
                            <option value={2}>2 - Basic</option>
                            <option value={3}>3 - Intermediate</option>
                            <option value={4}>4 - Advanced</option>
                            <option value={5}>5 - Expert</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}