import { renderHook, act } from '@testing-library/react';
import { useGameHistory, GameRecord } from './useGameHistory';

// Mock the Supabase client with a chainable, awaitable query builder that
// resolves to empty data. The hook's optimistic local-state updates (and the
// in-memory importGames merge logic) are what these tests exercise.
// Plain functions (not vi.fn) so Vitest mock resets doesn't wipe them between tests.
vi.mock('../supabaseClient', () => {
  const q: any = {};
  for (const m of ['select', 'order', 'upsert', 'insert', 'delete', 'eq', 'not']) {
    q[m] = () => q;
  }
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return { supabase: { from: () => q } };
});

const makeGame = (name: string, players: { number: string; goals?: number; time?: number }[]): GameRecord => ({
  id: `id-${name}`,
  date: '2026-03-16T00:00:00.000Z',
  name,
  teamName: 'U16 NCFC',
  teamScore: 2,
  opponentScore: 0,
  totalTime: 1920,
  playerStats: players.map(p => ({
    id: `stat-${p.number}`,
    name: `Player ${p.number}`,
    number: p.number,
    time: p.time ?? 1920,
    goals: p.goals ?? 0,
    redCards: 0,
    yellowCards: 0
  }))
});

describe('useGameHistory - importGames', () => {
  test('adds a new game when no history exists', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load

    await act(async () => {
      await result.current.importGames([makeGame('Game 1', [{ number: '21', goals: 1 }])]);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].name).toBe('Game 1');
    expect(result.current.history[0].playerStats[0].number).toBe('21');
  });

  test('adds multiple new games', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load

    await act(async () => {
      await result.current.importGames([
        makeGame('Game 1', [{ number: '21' }]),
        makeGame('Game 2', [{ number: '22' }])
      ]);
    });

    expect(result.current.history).toHaveLength(2);
  });

  test('returns correct added/merged counts for new games', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load
    let counts = { added: 0, merged: 0 };

    await act(async () => {
      counts = await result.current.importGames([
        makeGame('Game 1', [{ number: '21' }]),
        makeGame('Game 2', [{ number: '22' }])
      ]);
    });

    expect(counts.added).toBe(2);
    expect(counts.merged).toBe(0);
  });

  test('merges player stats when game name already exists', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load

    await act(async () => {
      await result.current.saveGame(makeGame('test', [{ number: '21', goals: 1 }]));
    });

    await act(async () => {
      await result.current.importGames([
        makeGame('test', [{ number: '21', goals: 1 }, { number: '22', goals: 0 }])
      ]);
    });

    const game = result.current.history.find(g => g.name === 'test')!;
    expect(game.playerStats).toHaveLength(2);
    expect(game.playerStats.some(s => s.number === '22')).toBe(true);
  });

  test('replaces existing player stats (by number) when merging', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load

    await act(async () => {
      await result.current.saveGame(makeGame('test', [{ number: '21', goals: 0 }]));
    });

    await act(async () => {
      await result.current.importGames([makeGame('test', [{ number: '21', goals: 2 }])]);
    });

    const game = result.current.history.find(g => g.name === 'test')!;
    const player21 = game.playerStats.find(s => s.number === '21')!;
    expect(player21.goals).toBe(2);
  });

  test('returns correct added/merged counts when merging', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load
    let counts = { added: 0, merged: 0 };

    await act(async () => {
      await result.current.saveGame(makeGame('Existing Game', [{ number: '21' }]));
    });

    await act(async () => {
      counts = await result.current.importGames([
        makeGame('Existing Game', [{ number: '21' }]),
        makeGame('New Game', [{ number: '22' }])
      ]);
    });

    expect(counts.added).toBe(1);
    expect(counts.merged).toBe(1);
  });

  test('does not duplicate a game imported twice with no changes', async () => {
    const { result } = renderHook(() => useGameHistory());
    await act(async () => {}); // flush the initial async load
    const game = makeGame('Game 1', [{ number: '21' }]);

    await act(async () => { await result.current.importGames([game]); });
    await act(async () => { await result.current.importGames([game]); });

    expect(result.current.history).toHaveLength(1);
  });
});
