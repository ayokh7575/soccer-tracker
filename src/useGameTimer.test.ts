import { renderHook, act } from '@testing-library/react';
import { useGameTimer } from './hooks/useGameTimer';

describe('useGameTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useGameTimer());
    
    expect(result.current.gameState).toBe('idle');
    expect(result.current.gameTime).toBe(0);
    expect(result.current.playerTimes).toEqual({});
    expect(result.current.activePlayerIds).toEqual([]);
  });

  it('should start the game correctly', () => {
    const { result } = renderHook(() => useGameTimer());
    const initialActivePlayers = ['p1', 'p2'];
    const initialPlayerTimes = { p1: 0, p2: 0 };

    act(() => {
      result.current.startGame(initialActivePlayers, initialPlayerTimes);
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.activePlayerIds).toEqual(initialActivePlayers);
    expect(result.current.playerTimes).toEqual(initialPlayerTimes);
    expect(result.current.gameTime).toBe(0);
  });

  it('should increment game time and player times when playing', () => {
    const { result } = renderHook(() => useGameTimer());
    const initialActivePlayers = ['p1'];
    const initialPlayerTimes = { p1: 0, p2: 0 }; // p2 is on bench

    act(() => {
      result.current.startGame(initialActivePlayers, initialPlayerTimes);
    });

    // Advance time by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.gameTime).toBe(10);
    expect(result.current.playerTimes['p1']).toBe(10);
    expect(result.current.playerTimes['p2']).toBe(0); // Bench player shouldn't accumulate time
  });

  it('should toggle play/pause', () => {
    const { result } = renderHook(() => useGameTimer());
    
    act(() => {
      result.current.startGame([], {});
    });
    expect(result.current.gameState).toBe('playing');

    act(() => {
      result.current.togglePlayPause();
    });
    expect(result.current.gameState).toBe('paused');

    // Time shouldn't advance when paused
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.gameTime).toBe(0);

    act(() => {
      result.current.togglePlayPause();
    });
    expect(result.current.gameState).toBe('playing');
  });

  it('should automatically pause at half-time (40 mins)', () => {
    const { result } = renderHook(() => useGameTimer());
    
    act(() => {
      result.current.startGame([], {});
    });

    // Advance to 40 minutes (2400 seconds)
    act(() => {
      vi.advanceTimersByTime(2400 * 1000);
    });

    expect(result.current.gameTime).toBe(2400);
    expect(result.current.gameState).toBe('paused');
  });

  it('should automatically finish at full-time (80 mins)', () => {
    const { result } = renderHook(() => useGameTimer());
    
    act(() => {
      result.current.startGame([], {});
    });

    // Advance to half-time (2400 seconds)
    act(() => {
      vi.advanceTimersByTime(2400 * 1000);
    });
    expect(result.current.gameState).toBe('paused');

    // Resume and advance to full-time
    act(() => {
      result.current.togglePlayPause();
    });
    act(() => {
      vi.advanceTimersByTime(2400 * 1000);
    });

    expect(result.current.gameTime).toBe(4800);
    expect(result.current.gameState).toBe('finished');
  });

  it('should cancel the game and reset state', () => {
    const { result } = renderHook(() => useGameTimer());
    
    act(() => {
      result.current.startGame(['p1'], { p1: 0 });
      vi.advanceTimersByTime(10000);
    });

    act(() => {
      result.current.cancelGame();
    });

    expect(result.current.gameState).toBe('idle');
    expect(result.current.gameTime).toBe(0);
    expect(result.current.playerTimes).toEqual({});
    expect(result.current.activePlayerIds).toEqual([]);
  });
});
describe('useGameTimer - restoreGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores a paused game exactly as it was', () => {
    const { result } = renderHook(() => useGameTimer());
    act(() => {
      result.current.restoreGame({
        gameState: 'paused', gameTime: 600, playerTimes: { p1: 600, p2: 100 },
        activePlayerIds: ['p1'], duration: 80, resumeFrom: Date.now() - 60_000,
      });
    });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.gameState).toBe('paused');
    expect(result.current.gameTime).toBe(600);
    expect(result.current.playerTimes).toEqual({ p1: 600, p2: 100 });
  });

  it('counts the time the app was closed for a game that was running', () => {
    const { result } = renderHook(() => useGameTimer());
    act(() => {
      result.current.restoreGame({
        gameState: 'playing', gameTime: 600, playerTimes: { p1: 600, p2: 100 },
        activePlayerIds: ['p1'], duration: 80, resumeFrom: Date.now() - 90_000,
      });
    });
    act(() => { vi.advanceTimersByTime(1000); });
    // 90s closed + 1s since reopening
    expect(result.current.gameTime).toBe(691);
    expect(result.current.playerTimes).toEqual({ p1: 691, p2: 100 });
    expect(result.current.gameState).toBe('playing');
  });

  it('stops at half time if the app was closed across it', () => {
    const { result } = renderHook(() => useGameTimer());
    act(() => {
      result.current.restoreGame({
        gameState: 'playing', gameTime: 2300, playerTimes: { p1: 2300 },
        activePlayerIds: ['p1'], duration: 80, resumeFrom: Date.now() - 600_000,
      });
    });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.gameTime).toBe(2400);
    expect(result.current.playerTimes).toEqual({ p1: 2400 });
    expect(result.current.gameState).toBe('paused');
  });
});
