import { neon } from './neonClient';

// Old localStorage keys used by the pre-cloud version of the app.
const OLD_TEAMS_KEY = 'teams';
const OLD_HISTORY_KEY = 'gameHistory';
const MIGRATED_FLAG = 'migrated_v1';

const readArray = (key: string): any[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// True if this device has pre-auth data that hasn't been migrated yet.
export const hasLocalDataToMigrate = (): boolean => {
  if (localStorage.getItem(MIGRATED_FLAG)) return false;
  return readArray(OLD_TEAMS_KEY).length > 0 || readArray(OLD_HISTORY_KEY).length > 0;
};

// Imports localStorage teams/players/games into the signed-in account.
// The original localStorage data is left intact (only a flag is set), so this
// is safe to run and won't destroy anything if it partially fails.
export const migrateLocalData = async (): Promise<{ teams: number; players: number; games: number }> => {
  const oldTeams = readArray(OLD_TEAMS_KEY);
  const oldGames = readArray(OLD_HISTORY_KEY);

  let teams = 0;
  let players = 0;
  let games = 0;
  const teamIdByName: Record<string, string> = {};

  for (const t of oldTeams) {
    const teamId = crypto.randomUUID();
    const { error: teamErr } = await neon.from('teams').insert({
      id: teamId,
      name: t.name,
      default_game_duration: t.defaultGameDuration ?? null,
      players_per_side: t.playersPerSide ?? null,
    });
    if (teamErr) {
      console.error('Migration: failed to insert team', t.name, teamErr);
      continue;
    }
    teams++;
    if (t.name) teamIdByName[t.name] = teamId;

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
      if (pErr) console.error('Migration: failed to insert players for', t.name, pErr);
      else players += rows.length;
    }
  }

  if (oldGames.length > 0) {
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
    const { error: gErr } = await neon.from('games').insert(gameRows);
    if (gErr) console.error('Migration: failed to insert games', gErr);
    else games = gameRows.length;
  }

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
  return { teams, players, games };
};
