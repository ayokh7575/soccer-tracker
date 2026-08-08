import { renderHook, act } from '@testing-library/react';
import { useTeamStorage } from './hooks/useTeamStorage';
import { Team } from './types';

// Mock the Neon client with a chainable, awaitable query builder that
// resolves to empty data. These tests cover the hook's optimistic local state.
// Plain functions (not vi.fn) so Vitest mock resets doesn't wipe them between tests.
vi.mock('./neonClient', () => {
  const q: any = {};
  for (const m of ['select', 'order', 'upsert', 'insert', 'delete', 'eq', 'not']) {
    q[m] = () => q;
  }
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return { neon: { from: () => q } };
});

describe('useTeamStorage', () => {
  it('initializes with empty teams', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {}); // flush the initial async load
    await act(async () => {});
    expect(result.current.teams).toEqual([]);
  });

  it('saveTeam adds the team to local state', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {}); // flush the initial async load
    const team: Team = { id: '1', name: 'New Team', players: [] };

    await act(async () => {
      await result.current.saveTeam(team);
    });

    expect(result.current.teams).toContainEqual(team);
  });

  it('saveTeam updates an existing team in place', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {}); // flush the initial async load
    const team: Team = { id: '1', name: 'Old Name', players: [] };

    await act(async () => {
      await result.current.saveTeam(team);
    });
    await act(async () => {
      await result.current.saveTeam({ ...team, name: 'New Name' });
    });

    expect(result.current.teams).toHaveLength(1);
    expect(result.current.teams[0].name).toBe('New Name');
  });

  it('deleteTeam removes the team from local state', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {}); // flush the initial async load
    const team: Team = { id: '1', name: 'Delete Me', players: [] };

    await act(async () => {
      await result.current.saveTeam(team);
    });
    await act(async () => {
      await result.current.deleteTeam('1');
    });

    expect(result.current.teams).toHaveLength(0);
  });
});
