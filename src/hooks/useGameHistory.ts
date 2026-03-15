import { useState, useEffect } from 'react';

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

export const useGameHistory = () => {
  const [history, setHistory] = useState<GameRecord[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('gameHistory');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse game history:', error);
      }
    }
  }, []);

  const saveGame = (game: GameRecord) => {
    const updated = [game, ...history];
    setHistory(updated);
    localStorage.setItem('gameHistory', JSON.stringify(updated));
  };

  const deleteGame = (id: string) => {
    const updated = history.filter(g => g.id !== id);
    setHistory(updated);
    localStorage.setItem('gameHistory', JSON.stringify(updated));
  };

  const importGames = (importedGames: GameRecord[]): { added: number; merged: number } => {
    const updated = [...history];
    let added = 0;
    let merged = 0;

    for (const importedGame of importedGames) {
      const existingIndex = updated.findIndex(g =>
        g.name === importedGame.name &&
        g.teamName === importedGame.teamName &&
        g.teamScore === importedGame.teamScore &&
        g.opponentScore === importedGame.opponentScore &&
        g.totalTime === importedGame.totalTime &&
        g.date.split('T')[0] === importedGame.date.split('T')[0]
      );
      if (existingIndex >= 0) {
        // Merge player stats: replace matching players (by number), add new ones
        const mergedStats = [...updated[existingIndex].playerStats];
        for (const importedStat of importedGame.playerStats) {
          const idx = mergedStats.findIndex(s => s.number === importedStat.number);
          if (idx >= 0) {
            mergedStats[idx] = importedStat;
          } else {
            mergedStats.push(importedStat);
          }
        }
        updated[existingIndex] = { ...updated[existingIndex], playerStats: mergedStats };
        merged++;
      } else {
        updated.unshift(importedGame);
        added++;
      }
    }

    setHistory(updated);
    localStorage.setItem('gameHistory', JSON.stringify(updated));
    return { added, merged };
  };

  return { history, saveGame, deleteGame, importGames };
};