import { useState, useEffect, useRef } from 'react';

export const useGameTimer = () => {
  const [gameState, setGameState] = useState<'stopped' | 'playing' | 'paused' | 'finished'>('stopped');
  const [gameTime, setGameTime] = useState(0);
  const [playerTimes, setPlayerTimes] = useState<Record<string, number>>({});
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePlayerIdsRef = useRef<string[]>([]);

  useEffect(() => {
    activePlayerIdsRef.current = activePlayerIds;
  }, [activePlayerIds]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameIntervalRef.current = setInterval(() => {
        setGameTime(prev => {
          const newTime = prev + 1;
          
          if (newTime === 40 * 60) {
            setGameState('paused');
            if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
          }
          
          if (newTime === 80 * 60) {
            setGameState('finished');
            if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
          }
          
          return newTime;
        });

        setPlayerTimes(prev => {
          const updated = { ...prev };
          activePlayerIdsRef.current.forEach(id => {
            updated[id] = (updated[id] || 0) + 1;
          });
          return updated;
        });
      }, 1000);
    } else {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    }

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, [gameState]);

  const startGame = (initialActivePlayers: string[], initialPlayerTimes: Record<string, number>) => {
    setPlayerTimes(initialPlayerTimes);
    setActivePlayerIds(initialActivePlayers);
    setGameTime(0);
    setGameState('playing');
  };

  const togglePlayPause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  const cancelGame = () => {
    setGameState('stopped');
    setGameTime(0);
    setPlayerTimes({});
    setActivePlayerIds([]);
  };

  return {
    gameState,
    gameTime,
    playerTimes,
    activePlayerIds,
    setActivePlayerIds,
    startGame,
    togglePlayPause,
    cancelGame
  };
};