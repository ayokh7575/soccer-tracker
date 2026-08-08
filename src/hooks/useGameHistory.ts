import { useState, useEffect, useCallback } from 'react';
import { neon } from '../neonClient';

export interface PlayerStat {
  id: string;
  name: string;
  number: string;
  time: number;
  goals: number;
  redCards: number;
  yellowCards: number;
}

export interface GameRecord {
  id: string;
  date: string;
  name: string;
  teamName: string;
  teamScore: number;
  opponentScore: number;
  totalTime: number;
  playerStats: PlayerStat[];
}

const rowToGame = (r: any): GameRecord => ({
  id: r.id,
  date: r.played_at,
  name: r.name,
  teamName: r.team_name,
  teamScore: r.team_score,
  opponentScore: r.opponent_score,
  totalTime: r.total_time,
  playerStats: (r.player_stats ?? []) as PlayerStat[],
});

const gameToRow = (g: GameRecord, teamId: string | null) => ({
  id: g.id,
  team_id: teamId,
  name: g.name,
  team_name: g.teamName,
  played_at: g.date,
  team_score: g.teamScore,
  opponent_score: g.opponentScore,
  total_time: g.totalTime,
  player_stats: g.playerStats,
});

export const useGameHistory = () => {
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await neon
      .from('games')
      .select('*')
      .order('played_at', { ascending: false });
    if (error) console.error('Failed to load games:', error);
    else setHistory((data ?? []).map(rowToGame));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // teamId links the game to a team when known (normal play); imported games pass null.
  const saveGame = useCallback(async (game: GameRecord, teamId: string | null = null) => {
    setHistory(prev => [game, ...prev]);
    const { error } = await neon.from('games').insert(gameToRow(game, teamId));
    if (error) console.error('Failed to save game:', error);
  }, []);

  const deleteGame = useCallback(async (id: string) => {
    setHistory(prev => prev.filter(g => g.id !== id));
    const { error } = await neon.from('games').delete().eq('id', id);
    if (error) console.error('Failed to delete game:', error);
  }, []);

  const importGames = useCallback(
    async (importedGames: GameRecord[]): Promise<{ added: number; merged: number }> => {
      let added = 0;
      let merged = 0;
      const updated = [...history];
      const toPersist: GameRecord[] = [];

      for (const imp of importedGames) {
        const existingIndex = updated.findIndex(g =>
          g.name === imp.name &&
          g.teamName === imp.teamName &&
          g.teamScore === imp.teamScore &&
          g.opponentScore === imp.opponentScore &&
          g.totalTime === imp.totalTime &&
          g.date.split('T')[0] === imp.date.split('T')[0]
        );
        if (existingIndex >= 0) {
          // Merge player stats: replace matching players (by number), add new ones.
          const mergedStats = [...updated[existingIndex].playerStats];
          for (const s of imp.playerStats) {
            const i = mergedStats.findIndex(x => x.number === s.number);
            if (i >= 0) mergedStats[i] = s;
            else mergedStats.push(s);
          }
          const mergedGame = { ...updated[existingIndex], playerStats: mergedStats };
          updated[existingIndex] = mergedGame;
          toPersist.push(mergedGame);
          merged++;
        } else {
          updated.unshift(imp);
          toPersist.push(imp);
          added++;
        }
      }

      setHistory(updated);

      if (toPersist.length > 0) {
        const { error } = await neon
          .from('games')
          .upsert(toPersist.map(g => gameToRow(g, null)));
        if (error) console.error('Failed to import games:', error);
      }
      return { added, merged };
    },
    [history]
  );

  return { history, loading, saveGame, deleteGame, importGames, reload };
};
