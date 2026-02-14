import { useState, useEffect } from 'react';
import { Team } from '../types';

export const useTeamStorage = () => {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = () => {
    try {
      const stored = localStorage.getItem('teams');
      if (stored) {
        setTeams(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No teams found');
    }
  };

  const saveTeam = (team: Team) => {
    try {
      const existingTeams = teams.filter(t => t.id !== team.id);
      const updatedTeams = [...existingTeams, team];
      localStorage.setItem('teams', JSON.stringify(updatedTeams));
      setTeams(updatedTeams);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const deleteTeam = (teamId: string) => {
    try {
      const updatedTeams = teams.filter(t => t.id !== teamId);
      localStorage.setItem('teams', JSON.stringify(updatedTeams));
      setTeams(updatedTeams);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  return { teams, saveTeam, deleteTeam };
};