import { GameAction, Team } from './types';

// Keeps the game in progress on this device so it survives a refresh, the
// phone killing the tab, or a flat battery. Only one live game is kept; it is
// cleared when the game ends or is discarded.

export type LiveGameState = 'playing' | 'paused' | 'finished';

export interface LiveGameSnapshot {
  version: 1;
  savedAt: number; // ms since epoch, written on every save
  team: Team;
  gameName: string;
  gameDuration: number;
  formation: string;
  formationAssignments: Record<string, string>;
  gameState: LiveGameState;
  gameTime: number;
  playerTimes: Record<string, number>;
  activePlayerIds: string[];
  playerGoals: Record<string, number>;
  playerRedCards: Record<string, number>;
  playerYellowCards: Record<string, number>;
  opponentGoals: number;
  actionHistory: GameAction[];
}

export const LIVE_GAME_KEY = 'liveGame_v1';

// A snapshot older than this is a game nobody finished, not one to resume.
export const LIVE_GAME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const saveLiveGame = (snapshot: Omit<LiveGameSnapshot, 'version' | 'savedAt'>, now = Date.now()) => {
  try {
    localStorage.setItem(LIVE_GAME_KEY, JSON.stringify({ ...snapshot, version: 1, savedAt: now }));
  } catch (err) {
    // Storage full or blocked (private mode): the game still works, it just
    // can't be resumed after a reload.
    console.error('Could not save the live game on this device:', err);
  }
};

export const clearLiveGame = () => {
  try {
    localStorage.removeItem(LIVE_GAME_KEY);
  } catch {
    // ignore
  }
};

export const loadLiveGame = (now = Date.now()): LiveGameSnapshot | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LIVE_GAME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as LiveGameSnapshot;
    const valid =
      s &&
      s.version === 1 &&
      typeof s.savedAt === 'number' &&
      s.team && Array.isArray(s.team.players) &&
      typeof s.gameTime === 'number' &&
      ['playing', 'paused', 'finished'].includes(s.gameState);
    if (!valid || now - s.savedAt > LIVE_GAME_MAX_AGE_MS) {
      clearLiveGame();
      return null;
    }
    return s;
  } catch {
    clearLiveGame();
    return null;
  }
};
