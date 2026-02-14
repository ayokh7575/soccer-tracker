import { renderHook, act } from '@testing-library/react';
import { useTeamStorage } from './hooks/useTeamStorage';
import { Team } from './types';
// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('useTeamStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should initialize with empty teams', () => {
    const { result } = renderHook(() => useTeamStorage());
    expect(result.current.teams).toEqual([]);
  });

  it('should load teams from localStorage', () => {
    const mockTeams: Team[] = [
      { id: '1', name: 'Team A', players: [] },
      { id: '2', name: 'Team B', players: [] }
    ];
    window.localStorage.setItem('teams', JSON.stringify(mockTeams));

    const { result } = renderHook(() => useTeamStorage());
    expect(result.current.teams).toEqual(mockTeams);
  });

  it('should save a new team', () => {
    const { result } = renderHook(() => useTeamStorage());
    const newTeam: Team = { id: '1', name: 'New Team', players: [] };

    act(() => {
      result.current.saveTeam(newTeam);
    });

    expect(result.current.teams).toContainEqual(newTeam);
    expect(JSON.parse(window.localStorage.getItem('teams') || '[]')).toContainEqual(newTeam);
  });

  it('should update an existing team', () => {
    const initialTeam: Team = { id: '1', name: 'Old Name', players: [] };
    window.localStorage.setItem('teams', JSON.stringify([initialTeam]));

    const { result } = renderHook(() => useTeamStorage());
    
    const updatedTeam: Team = { ...initialTeam, name: 'New Name' };

    act(() => {
      result.current.saveTeam(updatedTeam);
    });

    expect(result.current.teams).toHaveLength(1);
    expect(result.current.teams[0]).toEqual(updatedTeam);
    expect(JSON.parse(window.localStorage.getItem('teams') || '[]')[0].name).toBe('New Name');
  });

  it('should delete a team', () => {
    const teamToDelete: Team = { id: '1', name: 'Delete Me', players: [] };
    const teamToKeep: Team = { id: '2', name: 'Keep Me', players: [] };
    window.localStorage.setItem('teams', JSON.stringify([teamToDelete, teamToKeep]));

    const { result } = renderHook(() => useTeamStorage());

    act(() => {
      result.current.deleteTeam('1');
    });

    expect(result.current.teams).toHaveLength(1);
    expect(result.current.teams[0]).toEqual(teamToKeep);
    expect(JSON.parse(window.localStorage.getItem('teams') || '[]')).toHaveLength(1);
  });
});