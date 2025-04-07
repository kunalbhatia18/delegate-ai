// src/app/dashboard.skills/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getUserSkills, getAllSkills, addUserSkill, removeUserSkill, updateUserSkillLevel } from '@/lib/skills/skillService';
import RouteGuard from '@/components/auth/RouteGuard';

export default function SkillsPage() {
  const { user } = useAuth();
  const [userSkills, setUserSkills] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [proficiencyLevel, setProficiencyLevel] = useState<number>(3);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    async function loadSkills() {
      if (user) {
        try {
          setLoading(true);
          
          // Load user's skills
          const skills = await getUserSkills(user.id);
          setUserSkills(skills);
          
          // Load all available skills
          const allSkills = await getAllSkills();
          setAvailableSkills(allSkills);
        } catch (error) {
          console.error('Error loading skills:', error);
          setMessage({
            text: 'Failed to load skills. Please try again.',
            type: 'error'
          });
        } finally {
          setLoading(false);
        }
      }
    }
    
    loadSkills();
  }, [user]);
  
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSkill || !user) return;
    
    try {
      const result = await addUserSkill(user.id, selectedSkill, proficiencyLevel);
      
      if (result) {
        // Reload skills
        const skills = await getUserSkills(user.id);
        setUserSkills(skills);
        
        setMessage({
          text: 'Skill added successfully!',
          type: 'success'
        });
        
        // Reset form
        setSelectedSkill('');
        setProficiencyLevel(3);
      } else {
        setMessage({
          text: 'Failed to add skill. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error adding skill:', error);
      setMessage({
        text: 'An error occurred. Please try again.',
        type: 'error'
      });
    }
  };
  
  const handleRemoveSkill = async (skillId: string) => {
    if (!user) return;
    
    try {
      const result = await removeUserSkill(user.id, skillId);
      
      if (result) {
        // Update local state
        setUserSkills(userSkills.filter(skill => skill.skillId !== skillId));
        
        setMessage({
          text: 'Skill removed successfully!',
          type: 'success'
        });
      } else {
        setMessage({
          text: 'Failed to remove skill. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error removing skill:', error);
      setMessage({
        text: 'An error occurred. Please try again.',
        type: 'error'
      });
    }
  };
  
  const handleUpdateLevel = async (skillId: string, newLevel: number) => {
    if (!user) return;
    
    try {
      const result = await updateUserSkillLevel(user.id, skillId, newLevel);
      
      if (result) {
        // Update local state
        setUserSkills(userSkills.map(skill => 
          skill.skillId === skillId 
            ? { ...skill, proficiencyLevel: newLevel } 
            : skill
        ));
        
        setMessage({
          text: 'Skill level updated!',
          type: 'success'
        });
      } else {
        setMessage({
          text: 'Failed to update skill level. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating skill level:', error);
      setMessage({
        text: 'An error occurred. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Filter out skills that the user already has
  const filteredAvailableSkills = availableSkills.filter(skill => 
    !userSkills.some(userSkill => userSkill.skillId === skill.id)
  );
  
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Your Skills</h1>
          
          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
          
          <div className="bg-white shadow-md rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Add New Skill</h2>
            
            <form onSubmit={handleAddSkill} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium text-gray-700 mb-1">
                  Skill
                </label>
                <select
                  id="skill"
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a skill</option>
                  {filteredAvailableSkills.map(skill => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                  Proficiency Level (1-5)
                </label>
                <select
                  id="level"
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
              
              <button
                type="submit"
                disabled={loading || !selectedSkill}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Add Skill
              </button>
            </form>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Your Skills</h2>
            
            {loading ? (
              <div className="text-center py-4">Loading skills...</div>
            ) : userSkills.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                You haven't added any skills yet. Add skills to improve task matching.
              </div>
            ) : (
              <div className="space-y-4">
                {userSkills.map(skill => (
                  <div key={skill.skillId} className="border rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{skill.skillName}</h3>
                      <div className="text-sm text-gray-500">
                        Proficiency: {skill.proficiencyLevel}/5
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <select
                        value={skill.proficiencyLevel}
                        onChange={(e) => handleUpdateLevel(skill.skillId, parseInt(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded"
                      >
                        {[1, 2, 3, 4, 5].map(level => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        onClick={() => handleRemoveSkill(skill.skillId)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Remove skill"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}