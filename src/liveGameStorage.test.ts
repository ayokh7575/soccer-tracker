import { saveLiveGame, loadLiveGame, clearLiveGame, LIVE_GAME_KEY, LIVE_GAME_MAX_AGE_MS } from './liveGameStorage';

const snapshot = {
  team: { id: 't1', name: 'U16', players: [{ id: 'p1', firstName: 'A', lastName: 'B', number: '1', position: 'GK' }] },
  gameName: 'Round 1',
  gameDuration: 80,
  formation: '1-4-4-2',
  formationAssignments: { GK: 'p1' },
  gameState: 'paused' as const,
  gameTime: 1200,
  playerTimes: { p1: 1200 },
  activePlayerIds: ['p1'],
  playerGoals: { p1: 1 },
  playerRedCards: {},
  playerYellowCards: {},
  opponentGoals: 2,
  actionHistory: [{ type: 'opponentGoal' as const }],
};

describe('liveGameStorage', () => {
  beforeEach(() => localStorage.clear());

  test('saves and loads a game', () => {
    saveLiveGame(snapshot, 1000);
    const loaded = loadLiveGame(2000);
    expect(loaded).toMatchObject({ ...snapshot, savedAt: 1000, version: 1 });
  });

  test('forgets a game that is too old to resume', () => {
    saveLiveGame(snapshot, 1000);
    expect(loadLiveGame(1000 + LIVE_GAME_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem(LIVE_GAME_KEY)).toBeNull();
  });

  test('ignores and removes corrupt data', () => {
    localStorage.setItem(LIVE_GAME_KEY, '{not json');
    expect(loadLiveGame()).toBeNull();
    localStorage.setItem(LIVE_GAME_KEY, JSON.stringify({ version: 1 }));
    expect(loadLiveGame()).toBeNull();
    expect(localStorage.getItem(LIVE_GAME_KEY)).toBeNull();
  });

  test('clear removes the game', () => {
    saveLiveGame(snapshot);
    clearLiveGame();
    expect(loadLiveGame()).toBeNull();
  });
});
