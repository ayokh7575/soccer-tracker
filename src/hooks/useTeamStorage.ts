import { useState, useEffect, useCallback } from 'react';
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
  defaultGameDuration: r.default_game_duration ?? undefined,
  playersPerSide: (r.players_per_side ?? undefined) as 9 | 11 | undefined,
  players: ((r.players ?? []) as any[])
    .slice()
    .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
    .map(rowToPlayer),
});

export const useTeamStorage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Persists the whole team: upserts the team row, upserts its players, and
  // deletes any players no longer in the array (reconciles DB to local state).
  // Returns whether the write succeeded so callers can avoid acting on a
  // change the database rejected (e.g. navigating to a team that wasn't saved).
  const saveTeam = useCallback(async (team: Team): Promise<boolean> => {
    // Optimistic local update so the UI stays responsive.
    setTeams(prev => [...prev.filter(t => t.id !== team.id), team]);

    const { error: teamErr } = await neon.from('teams').upsert({
      id: team.id,
      name: team.name,
      default_game_duration: team.defaultGameDuration ?? null,
      players_per_side: team.playersPerSide ?? null,
    });
    if (teamErr) {
      await handleWriteFailure(teamErr, 'Failed to save team:', 'Could not save the team. Please try again.');
      return false;
    }

    const players = team.players ?? [];
    if (players.length > 0) {
      const rows = players.map(p => ({
        id: p.id,
        team_id: team.id,
        first_name: p.firstName,
        last_name: p.lastName,
        number: p.number,
        position: p.position,
        secondary_positions: p.secondaryPositions ?? [],
        is_unavailable: p.isUnavailable ?? false,
        is_borrowed: p.isBorrowed ?? false,
      }));
      const { error: upErr } = await neon.from('players').upsert(rows);
      if (upErr) {
        await handleWriteFailure(upErr, 'Failed to save players:', 'Could not save the players. Please try again.');
        return false;
      }
    }

    // Reconcile: delete players that were removed locally.
    const keepIds = players.map(p => p.id);
    let del = neon.from('players').delete().eq('team_id', team.id);
    if (keepIds.length > 0) del = del.not('id', 'in', `(${keepIds.join(',')})`);
    const { error: delErr } = await del;
    if (delErr) {
      await handleWriteFailure(delErr, 'Failed to reconcile players:', 'Could not update the squad. Please try again.');
      return false;
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
