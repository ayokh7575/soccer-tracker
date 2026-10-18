import { renderHook, act } from '@testing-library/react';
import { useGameHistory, GameRecord } from './useGameHistory';

// Records every write and serves one existing game (linked to team t1) on load.
const writes: { op: string; rows: any }[] = [];
vi.mock('../neonClient', () => {
  const existing = [{
    id: 'g1', team_id: 't1', name: 'Round 1', team_name: 'U16', played_at: '2026-03-16T00:00:00.000Z',
    team_score: 1, opponent_score: 0, total_time: 4800,
    player_stats: [{ id: 's1', name: 'A', number: '7', time: 4800, goals: 1, redCards: 0, yellowCards: 0 }],
  }];
  const q: any = {};
  for (const m of ['select', 'order', 'delete', 'eq', 'not']) q[m] = () => q;
  q.upsert = (rows: any) => { writes.push({ op: 'upsert', rows }); return q; };
  q.insert = (rows: any) => { writes.push({ op: 'insert', rows }); return q; };
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: existing, error: null });
  return { neon: { from: () => q } };
});

const imported = (name: string): GameRecord => ({
  id: `imp-${name}`, date: '2026-03-16T00:00:00.000Z', name, teamName: 'U16',
  teamScore: 1, opponentScore: 0, totalTime: 4800,
  playerStats: [{ id: 'x', name: 'B', number: '9', time: 100, goals: 0, redCards: 0, yellowCards: 0 }],
});

describe('useGameHistory - team link', () => {
  beforeEach(() => { writes.length = 0; });

  test('merging an import into an existing game keeps its team', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {});
    expect(result.current.history[0].teamId).toBe('t1');

    await act(async () => { await result.current.importGames([imported('Round 1'), imported('Round 2')]); });

    const rows = writes.find(w => w.op === 'upsert')!.rows;
    expect(rows.find((r: any) => r.name === 'Round 1').team_id).toBe('t1'); // merged: link kept
    expect(rows.find((r: any) => r.name === 'Round 2').team_id).toBeNull(); // new import: unknown team
  });

  test('saving a played game links it to the team', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {});
    await act(async () => { await result.current.saveGame(imported('Round 3'), 't9'); });
    expect(writes.find(w => w.op === 'insert')!.rows.team_id).toBe('t9');
    expect(result.current.history[0].teamId).toBe('t9');
  });
});
