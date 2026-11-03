import { renderHook, act } from '@testing-library/react';
import { useTeamStorage } from './hooks/useTeamStorage';
import { Team } from './types';

// Mock the Neon client with a chainable, awaitable query builder that
// resolves to empty data and records every write. These tests cover the
// hook's optimistic local state and which rows it writes.
const h = vi.hoisted(() => ({ writes: [] as { table: string; op: string; rows?: any; ids?: any }[] }));

vi.mock('./neonClient', () => {
  const query = (table: string) => {
    const q: any = {};
    for (const m of ['select', 'order', 'eq', 'not']) q[m] = () => q;
    q.upsert = (rows: any) => { h.writes.push({ table, op: 'upsert', rows }); return q; };
    q.delete = () => q;
    q.in = (_col: string, ids: any) => { h.writes.push({ table, op: 'delete', ids }); return q; };
    q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: [], error: null });
    return q;
  };
  return { neon: { from: (table: string) => query(table) } };
});

beforeEach(() => { h.writes = []; });

const player = (id: string, firstName = 'P' + id) =>
  ({ id, firstName, lastName: 'X', number: id, position: 'CM' });

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

  it('only writes the players that changed, and only deletes players removed on this device', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {});
    const team: Team = { id: 't', name: 'U15 Blue', ageGroup: 'U15', players: [player('1'), player('2'), player('3')] };
    await act(async () => { await result.current.saveTeam(team); });
    expect(h.writes.find(w => w.table === 'teams')?.rows.age_group).toBe('U15');
    h.writes = [];

    // Edit player 2, remove player 3, add player 4.
    await act(async () => {
      await result.current.saveTeam({ ...team, players: [player('1'), player('2', 'Renamed'), player('4')] });
    });
    expect(h.writes.some(w => w.table === 'teams')).toBe(false); // team details unchanged
    const upserted = h.writes.find(w => w.table === 'players' && w.op === 'upsert')!.rows.map((r: any) => r.id);
    expect(upserted).toEqual(['2', '4']);
    expect(h.writes.find(w => w.op === 'delete')?.ids).toEqual(['3']);
  });

  it('keeps the team in the same place in the list when it is edited', async () => {
    const { result } = renderHook(() => useTeamStorage());
    await act(async () => {});
    await act(async () => { await result.current.saveTeam({ id: 'a', name: 'A', players: [] }); });
    await act(async () => { await result.current.saveTeam({ id: 'b', name: 'B', players: [] }); });
    await act(async () => { await result.current.saveTeam({ id: 'a', name: 'A2', players: [] }); });
    expect(result.current.teams.map(t => t.name)).toEqual(['A2', 'B']);
  });
});
