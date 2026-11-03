import { useState, useEffect, useCallback, useRef } from 'react';
import { neon } from '../neonClient';
import { friendlyError } from '../errors';
import { Team, Player } from '../types';

const rowToPlayer = (p: any): Player => ({
  id: p.id,
  firstName: p.first_name,
  lastName: p.last_name,
  number: p.number,
  position: p.position,
  secondaryPositions: p.secondary_positions ?? [],
  isUnavailable: p.is_unavailable ?? false,
  isBorrowed: p.is_borrowed ?? false,
});

const rowToTeam = (r: any): Team => ({
  id: r.id,
  name: r.name,
  ageGroup: r.age_group ?? undefined,
  defaultGameDuration: r.default_game_duration ?? undefined,
  playersPerSide: (r.players_per_side ?? undefined) as 9 | 11 | undefined,
  players: ((r.players ?? []) as any[])
    .slice()
    .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
    .map(rowToPlayer),
});

const playerToRow = (p: Player, teamId: string) => ({
  id: p.id,
  team_id: teamId,
  first_name: p.firstName,
  last_name: p.lastName,
  number: p.number,
  position: p.position,
  secondary_positions: p.secondaryPositions ?? [],
  is_unavailable: p.isUnavailable ?? false,
  is_borrowed: p.isBorrowed ?? false,
});

const sameTeamFields = (a: Team, b: Team) =>
  a.name === b.name &&
  a.ageGroup === b.ageGroup &&
  a.defaultGameDuration === b.defaultGameDuration &&
  a.playersPerSide === b.playersPerSide;

const samePlayer = (a: Player, b: Player) =>
  JSON.stringify(playerToRow(a, '')) === JSON.stringify(playerToRow(b, ''));

export const useTeamStorage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest teams, readable inside callbacks without re-creating them.
  const teamsRef = useRef<Team[]>([]);
  teamsRef.current = teams;

  const reload = useCallback(async () => {
    const { data, error: err } = await neon
      .from('teams')
      .select('*, players(*)')
      .order('created_at', { ascending: true });
    if (err) {
      console.error('Failed to load teams:', err);
      setError(friendlyError(err, 'Could not load your teams. Please try again.'));
    } else {
      setTeams((data ?? []).map(rowToTeam));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Teams are shared by every coach in an age group, so pick up their changes
  // whenever the app comes back to the screen.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // A write failed: surface why, then resync from the server so the optimistic
  // local state can't keep showing changes that were actually rejected.
  const handleWriteFailure = useCallback(
    async (err: any, context: string, fallback: string) => {
      console.error(context, err);
      setError(friendlyError(err, fallback));
      await reload();
    },
    [reload]
  );

  // Saves only what changed compared with the last version this device knew
  // about: the team row if its details changed, players that were added or
  // edited, and players that were removed here. Because other coaches in the
  // same age group edit the same teams, it never touches players it didn't
  // change — so it can't delete a player someone else just added.
  // Returns whether the write succeeded so callers can avoid acting on a
  // change the database rejected (e.g. navigating to a team that wasn't saved).
  const saveTeam = useCallback(async (team: Team): Promise<boolean> => {
    const previous = teamsRef.current.find(t => t.id === team.id);

    // Optimistic local update (in place, so the list doesn't reorder).
    setTeams(prev =>
      prev.some(t => t.id === team.id) ? prev.map(t => (t.id === team.id ? team : t)) : [...prev, team]
    );

    if (!previous || !sameTeamFields(previous, team)) {
      const { error: teamErr } = await neon.from('teams').upsert({
        id: team.id,
        name: team.name,
        age_group: team.ageGroup ?? null,
        default_game_duration: team.defaultGameDuration ?? null,
        players_per_side: team.playersPerSide ?? null,
      });
      if (teamErr) {
        await handleWriteFailure(teamErr, 'Failed to save team:', 'Could not save the team. Please try again.');
        return false;
      }
    }

    const previousPlayers = new Map((previous?.players ?? []).map(p => [p.id, p]));
    const changed = team.players.filter(p => {
      const before = previousPlayers.get(p.id);
      return !before || !samePlayer(before, p);
    });
    if (changed.length > 0) {
      const { error: upErr } = await neon.from('players').upsert(changed.map(p => playerToRow(p, team.id)));
      if (upErr) {
        await handleWriteFailure(upErr, 'Failed to save players:', 'Could not save the players. Please try again.');
        return false;
      }
    }

    const keep = new Set(team.players.map(p => p.id));
    const removed = [...previousPlayers.keys()].filter(id => !keep.has(id));
    if (removed.length > 0) {
      const { error: delErr } = await neon.from('players').delete().in('id', removed);
      if (delErr) {
        await handleWriteFailure(delErr, 'Failed to remove players:', 'Could not update the squad. Please try again.');
        return false;
      }
    }
    return true;
  }, [handleWriteFailure]);

  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    setTeams(prev => prev.filter(t => t.id !== teamId));
    const { error: err } = await neon.from('teams').delete().eq('id', teamId);
    if (err) {
      await handleWriteFailure(err, 'Failed to delete team:', 'Could not delete the team. Please try again.');
      return false;
    }
    return true;
  }, [handleWriteFailure]);

  const clearError = useCallback(() => setError(null), []);

  return { teams, loading, error, clearError, saveTeam, deleteTeam, reload };
};
