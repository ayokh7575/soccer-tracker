import { renderHook, act } from '@testing-library/react';
import { useGameHistory, GameRecord } from './useGameHistory';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('adds a new game when no history exists', () => {
    const { result } = renderHook(() => useGameHistory());

    act(() => {
      result.current.importGames([makeGame('Game 1', [{ number: '21', goals: 1 }])]);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].name).toBe('Game 1');
    expect(result.current.history[0].playerStats[0].number).toBe('21');
  });

  test('adds multiple new games', () => {
    const { result } = renderHook(() => useGameHistory());

    act(() => {
      result.current.importGames([
        makeGame('Game 1', [{ number: '21' }]),
        makeGame('Game 2', [{ number: '22' }])
      ]);
    });

    expect(result.current.history).toHaveLength(2);
  });

  test('returns correct added/merged counts for new games', () => {
    const { result } = renderHook(() => useGameHistory());
    let counts = { added: 0, merged: 0 };

    act(() => {
      counts = result.current.importGames([
        makeGame('Game 1', [{ number: '21' }]),
        makeGame('Game 2', [{ number: '22' }])
      ]);
    });

    expect(counts.added).toBe(2);
    expect(counts.merged).toBe(0);
  });

  test('merges player stats when game name already exists', () => {
    const { result } = renderHook(() => useGameHistory());

    // Save an existing game with player #21
    act(() => {
      result.current.saveGame(makeGame('test', [{ number: '21', goals: 1 }]));
    });

    // Import same game with player #22 added
    act(() => {
      result.current.importGames([
        makeGame('test', [{ number: '21', goals: 1 }, { number: '22', goals: 0 }])
      ]);
    });

    const game = result.current.history.find(g => g.name === 'test')!;
    expect(game.playerStats).toHaveLength(2);
    expect(game.playerStats.some(s => s.number === '22')).toBe(true);
  });

  test('replaces existing player stats (by number) when merging', () => {
    const { result } = renderHook(() => useGameHistory());

    act(() => {
      result.current.saveGame(makeGame('test', [{ number: '21', goals: 0 }]));
    });

    // Import same game with updated stats for player #21
    act(() => {
      result.current.importGames([makeGame('test', [{ number: '21', goals: 2 }])]);
    });

    const game = result.current.history.find(g => g.name === 'test')!;
    const player21 = game.playerStats.find(s => s.number === '21')!;
    expect(player21.goals).toBe(2);
  });

  test('returns correct added/merged counts when merging', () => {
    const { result } = renderHook(() => useGameHistory());
    let counts = { added: 0, merged: 0 };

    act(() => {
      result.current.saveGame(makeGame('Existing Game', [{ number: '21' }]));
    });

    act(() => {
      counts = result.current.importGames([
        makeGame('Existing Game', [{ number: '21' }]),
        makeGame('New Game', [{ number: '22' }])
      ]);
    });

    expect(counts.added).toBe(1);
    expect(counts.merged).toBe(1);
  });

  test('persists imported games to localStorage', () => {
    const { result } = renderHook(() => useGameHistory());

    act(() => {
      result.current.importGames([makeGame('Game 1', [{ number: '21' }])]);
    });

    const stored = JSON.parse(window.localStorage.getItem('gameHistory') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Game 1');
  });

  test('does not duplicate a game imported twice with no changes', () => {
    const { result } = renderHook(() => useGameHistory());
    const game = makeGame('Game 1', [{ number: '21' }]);

    act(() => { result.current.importGames([game]); });
    act(() => { result.current.importGames([game]); });

    expect(result.current.history).toHaveLength(1);
  });
});
