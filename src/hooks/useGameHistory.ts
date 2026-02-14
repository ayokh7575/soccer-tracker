import { useState, useEffect } from 'react';

export interface PlayerStat {
  id: string;
  name: string;
  number: string;
  time: number;
}

export interface GameRecord {
  id: string;
  date: string;
  name: string;
  teamName: string;
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

  return { history, saveGame, deleteGame };
};