import { neon } from './neonClient';

// Old localStorage keys used by the pre-cloud version of the app.
const OLD_TEAMS_KEY = 'teams';
const OLD_HISTORY_KEY = 'gameHistory';
const MIGRATED_FLAG = 'migrated_v1';
// What a previous, partly failed attempt already imported, so a retry carries
// on from there instead of creating duplicates.
const PROGRESS_KEY = 'migrated_v1_progress';

interface MigrationProgress {
  teams: Record<string, string>; // old team key -> new team id
  playersDone: Record<string, true>; // old team key -> players imported
  gamesDone: boolean;
}

const readArray = (key: string): any[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readProgress = (): MigrationProgress => {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (p && typeof p === 'object') {
      return { teams: p.teams ?? {}, playersDone: p.playersDone ?? {}, gamesDone: !!p.gamesDone };
    }
  } catch {
    // fall through
  }
  return { teams: {}, playersDone: {}, gamesDone: false };
};

const writeProgress = (p: MigrationProgress) => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
};

// Old teams may lack an id; fall back to position + name, which is stable as
// long as the old localStorage data isn't changed (it never is after migration
// starts — the old app is gone).
const teamKey = (t: any, index: number) => String(t?.id ?? `${index}:${t?.name ?? ''}`);

// True if this device has pre-auth data that hasn't been migrated yet.
export const hasLocalDataToMigrate = (): boolean => {
  if (localStorage.getItem(MIGRATED_FLAG)) return false;
  return readArray(OLD_TEAMS_KEY).length > 0 || readArray(OLD_HISTORY_KEY).length > 0;
};

// True if an earlier import on this device stopped part-way.
export const hasPartialMigration = (): boolean =>
  !localStorage.getItem(MIGRATED_FLAG) && localStorage.getItem(PROGRESS_KEY) !== null;

export class MigrationIncompleteError extends Error {
  constructor(public failures: string[]) {
    super(`Some data could not be imported: ${failures.join('; ')}`);
    this.name = 'MigrationIncompleteError';
  }
}

// Imports localStorage teams/players/games into the signed-in account.
// The original localStorage data is left intact. Progress is recorded after
// every step, and the "done" flag is only set once everything has been
// imported — so if anything fails, this throws MigrationIncompleteError and
// calling it again retries just the parts that are missing.
export const migrateLocalData = async (): Promise<{ teams: number; players: number; games: number }> => {
  const oldTeams = readArray(OLD_TEAMS_KEY);
  const oldGames = readArray(OLD_HISTORY_KEY);
  const progress = readProgress();
  const failures: string[] = [];

  let teams = 0;
  let players = 0;
  let games = 0;
  const teamIdByName: Record<string, string> = {};

  for (let i = 0; i < oldTeams.length; i++) {
    const t = oldTeams[i];
    const key = teamKey(t, i);

    let teamId = progress.teams[key];
    if (!teamId) {
      teamId = crypto.randomUUID();
      const { error: teamErr } = await neon.from('teams').insert({
        id: teamId,
        name: t.name,
        default_game_duration: t.defaultGameDuration ?? null,
        players_per_side: t.playersPerSide ?? null,
      });
      if (teamErr) {
        console.error('Migration: failed to insert team', t.name, teamErr);
        failures.push(`team "${t.name}"`);
        continue;
      }
      progress.teams[key] = teamId;
      writeProgress(progress);
      teams++;
    }
    if (t.name) teamIdByName[t.name] = teamId;

    if (!progress.playersDone[key]) {
      const teamPlayers = Array.isArray(t.players) ? t.players : [];
      if (teamPlayers.length > 0) {
        const rows = teamPlayers.map((p: any) => ({
          id: crypto.randomUUID(),
          team_id: teamId,
          first_name: p.firstName,
          last_name: p.lastName,
          number: p.number,
          position: p.position,
          secondary_positions: p.secondaryPositions ?? [],
          is_unavailable: p.isUnavailable ?? false,
          is_borrowed: p.isBorrowed ?? false,
        }));
        const { error: pErr } = await neon.from('players').insert(rows);
        if (pErr) {
          console.error('Migration: failed to insert players for', t.name, pErr);
          failures.push(`players for "${t.name}"`);
          continue;
        }
        players += rows.length;
      }
      progress.playersDone[key] = true;
      writeProgress(progress);
    }
  }

  if (!progress.gamesDone && oldGames.length > 0) {
    const gameRows = oldGames.map((g: any) => ({
      id: crypto.randomUUID(),
      team_id: teamIdByName[g.teamName] ?? null,
      name: g.name,
      team_name: g.teamName,
      played_at: g.date,
      team_score: g.teamScore,
      opponent_score: g.opponentScore,
      total_time: g.totalTime,
      player_stats: g.playerStats ?? [],
    }));
    // One insert for all games: it either all lands or none of it does, so a
    // retry can't duplicate games.
    const { error: gErr } = await neon.from('games').insert(gameRows);
    if (gErr) {
      console.error('Migration: failed to insert games', gErr);
      failures.push('game history');
    } else {
      games = gameRows.length;
      progress.gamesDone = true;
      writeProgress(progress);
    }
  }

  if (failures.length > 0) throw new MigrationIncompleteError(failures);

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
  localStorage.removeItem(PROGRESS_KEY);
  return { teams, players, games };
};
