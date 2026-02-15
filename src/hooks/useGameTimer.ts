import { useState, useEffect, useRef, useCallback } from 'react';

export const useGameTimer = () => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'finished'>('idle');
  const [gameTime, setGameTime] = useState(0);
  const [playerTimes, setPlayerTimes] = useState<Record<string, number>>({});
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);

  // Use a ref to track the last time the timer updated to handle background throttling
  const lastTickRef = useRef<number | null>(null);

  const startGame = useCallback((initialActivePlayers: string[], initialTimes: Record<string, number>) => {
    setGameState('playing');
    setGameTime(0);
    setPlayerTimes(initialTimes);
    setActivePlayerIds(initialActivePlayers);
    lastTickRef.current = Date.now();
  }, []);

  const togglePlayPause = useCallback(() => {
    setGameState(prev => {
      if (prev === 'playing') {
        lastTickRef.current = null;
        return 'paused';
      }
      if (prev === 'paused') {
        lastTickRef.current = Date.now();
        return 'playing';
      }
      return prev;
    });
  }, []);

  const cancelGame = useCallback(() => {
    setGameState('idle');
    setGameTime(0);
    setPlayerTimes({});
    setActivePlayerIds([]);
    lastTickRef.current = null;
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameState === 'playing') {
      // Ensure we have a baseline timestamp
      if (!lastTickRef.current) {
        lastTickRef.current = Date.now();
      }

      intervalId = setInterval(() => {
        const now = Date.now();
        // Calculate time passed since the last tick
        // If the browser was backgrounded, this delta will include that time
        const deltaMs = now - (lastTickRef.current || now);
        
        // Only update if at least 1 second has passed
        if (deltaMs >= 1000) {
          const deltaSeconds = Math.floor(deltaMs / 1000);
          
          setGameTime(prev => prev + deltaSeconds);
          
          setPlayerTimes(prev => {
            const next = { ...prev };
            activePlayerIds.forEach(id => {
              next[id] = (next[id] || 0) + deltaSeconds;
            });
            return next;
          });

          // Advance the last tick by the exact amount of seconds we processed
          // keeping any sub-second remainder for the next tick to prevent drift
          if (lastTickRef.current) {
             lastTickRef.current += deltaSeconds * 1000;
          }
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameState, activePlayerIds]);

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