import React, { useState, useEffect, useRef } from 'react';
import { Users, Play, Pause, Square, Clock, Plus, Trash2 } from 'lucide-react';
import './index.css';

const POSITIONS = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'LW', 'RW', 'CF'];
const FORMATIONS = ['1-4-4-2', '1-4-3-3'];

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  position: string;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
}

interface Position {
  x: number;
  y: number;
}

type FormationLayout = Record<string, Position>;

const FORMATION_LAYOUTS: Record<string, FormationLayout> = {
  '1-4-4-2': {
    GK: { x: 50, y: 90 },
    RB: { x: 80, y: 70 },
    CB: { x: 65, y: 75 },
    CB2: { x: 35, y: 75 },
    LB: { x: 20, y: 70 },
    RM: { x: 80, y: 45 },
    CM: { x: 65, y: 50 },
    CM2: { x: 35, y: 50 },
    LM: { x: 20, y: 45 },
    CF: { x: 65, y: 20 },
    CF2: { x: 35, y: 20 }
  },
  '1-4-3-3': {
    GK: { x: 50, y: 90 },
    RB: { x: 75, y: 70 },
    CB: { x: 60, y: 75 },
    CB2: { x: 40, y: 75 },
    LB: { x: 25, y: 70 },
    DM: { x: 50, y: 55 },
    CM: { x: 65, y: 45 },
    CM2: { x: 35, y: 45 },
    RW: { x: 75, y: 20 },
    CF: { x: 50, y: 15 },
    LW: { x: 25, y: 20 }
  }
};

function App() {
  const [view, setView] = useState<'home' | 'team-detail' | 'formation' | 'game-live'>('home');
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [formation, setFormation] = useState('1-4-4-2');
  const [formationAssignments, setFormationAssignments] = useState<Record<string, string>>({});
  const [gameName, setGameName] = useState('');
  const [gameState, setGameState] = useState<'stopped' | 'playing' | 'paused' | 'finished'>('stopped');
  const [gameTime, setGameTime] = useState(0);
  const [playerTimes, setPlayerTimes] = useState<Record<string, number>>({});
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<string | null>(null);
  
  const [teamNameInput, setTeamNameInput] = useState('');
  const [playerFirstName, setPlayerFirstName] = useState('');
  const [playerLastName, setPlayerLastName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [playerPosition, setPlayerPosition] = useState('');
  
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePlayerIdsRef = useRef<string[]>([]);
  
  useEffect(() => {
    activePlayerIdsRef.current = activePlayerIds;
  }, [activePlayerIds]);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = () => {
    try {
      const stored = localStorage.getItem('teams');
      if (stored) {
        setTeams(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No teams found');
    }
  };

  const saveTeam = (team: Team) => {
    try {
      const existingTeams = teams.filter(t => t.id !== team.id);
      const updatedTeams = [...existingTeams, team];
      localStorage.setItem('teams', JSON.stringify(updatedTeams));
      setTeams(updatedTeams);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const deleteTeam = (teamId: string) => {
    try {
      const updatedTeams = teams.filter(t => t.id !== teamId);
      localStorage.setItem('teams', JSON.stringify(updatedTeams));
      setTeams(updatedTeams);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateTeam = () => {
    if (teamNameInput.trim()) {
      const team: Team = {
        id: Date.now().toString(),
        name: teamNameInput,
        players: []
      };
      saveTeam(team);
      setCurrentTeam(team);
      setTeamNameInput('');
      setView('team-detail');
    }
  };

  const handleAddPlayer = () => {
    if (playerFirstName && playerLastName && playerNumber && playerPosition && currentTeam) {
      const player: Player = {
        id: Date.now().toString(),
        firstName: playerFirstName,
        lastName: playerLastName,
        number: playerNumber,
        position: playerPosition
      };
      const updated = { ...currentTeam, players: [...currentTeam.players, player] };
      setCurrentTeam(updated);
      saveTeam(updated);
      setPlayerFirstName('');
      setPlayerLastName('');
      setPlayerNumber('');
      setPlayerPosition('');
    }
  };

  const removePlayer = (playerId: string) => {
    if (!currentTeam) return;
    const updated = { ...currentTeam, players: currentTeam.players.filter(p => p.id !== playerId) };
    setCurrentTeam(updated);
    saveTeam(updated);
  };

  const startGame = () => {
    if (!gameName.trim() || !currentTeam) return;
    
    const slots = getFormationSlots();
    const allSlotsFilled = slots.every(slot => formationAssignments[slot]);
    
    if (!allSlotsFilled) return;
    
    const times: Record<string, number> = {};
    const activePlayers = Object.values(formationAssignments).filter(Boolean);
    
    currentTeam.players.forEach(p => {
      times[p.id] = 0;
    });
    
    setPlayerTimes(times);
    setActivePlayerIds(activePlayers);
    setGameTime(0);
    setGameState('playing');
    setView('game-live');
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
    setGameName('');
    setView('formation');
  };

  const handleDragStart = (e: React.DragEvent, playerId: string, fromSlot: string | null = null) => {
    setDraggedPlayer(playerId);
    setDraggedFromSlot(fromSlot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSlot = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPlayer) return;

    const currentPlayerInSlot = formationAssignments[slotKey];
    const newAssignments = { ...formationAssignments };
    
    if (draggedFromSlot) {
      delete newAssignments[draggedFromSlot];
      
      if (currentPlayerInSlot) {
        newAssignments[draggedFromSlot] = currentPlayerInSlot;
      }
    }
    
    newAssignments[slotKey] = draggedPlayer;

    setFormationAssignments(newAssignments);

    if (view === 'game-live') {
      setActivePlayerIds(prev => {
        let updated = [...prev];
        
        if (currentPlayerInSlot) {
          updated = updated.filter(id => id !== currentPlayerInSlot);
        }
        
        if (!updated.includes(draggedPlayer)) {
          updated.push(draggedPlayer);
        }
        
        return updated;
      });
    }

    setDraggedPlayer(null);
    setDraggedFromSlot(null);
  };

  const handleDropOnBench = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPlayer || !draggedFromSlot) {
      return;
    }

    const newAssignments: Record<string, string> = {};
    Object.keys(formationAssignments).forEach(key => {
      if (key !== draggedFromSlot) {
        newAssignments[key] = formationAssignments[key];
      }
    });
    
    const newActivePlayerIds = activePlayerIds.filter(id => id !== draggedPlayer);

    setFormationAssignments(newAssignments);
    setActivePlayerIds(newActivePlayerIds);
    setDraggedPlayer(null);
    setDraggedFromSlot(null);
  };

  const getFormationSlots = (): string[] => {
    const layout = FORMATION_LAYOUTS[formation];
    return Object.keys(layout);
  };

  const getSlotDisplayName = (slotKey: string): string => {
    return slotKey.replace(/2$/, '');
  };

  const getPlayerById = (id: string): Player | null => {
    if (!id || !currentTeam) return null;
    return currentTeam.players.find(p => p.id === id) || null;
  };

  const getPlayerDisplayName = (player: Player): string => {
    const firstInitial = player.firstName.charAt(0).toUpperCase();
    return `${firstInitial}. ${player.lastName}`;
  };

  const getSubstitutes = (): Player[] => {
    if (!currentTeam) return [];
    const assignedPlayerIds = Object.values(formationAssignments).filter(Boolean);
    return currentTeam.players.filter(p => !assignedPlayerIds.includes(p.id));
  };

  const autoAssignPlayers = () => {
    if (!currentTeam) return;
    const slots = getFormationSlots();
    const newAssignments: Record<string, string> = {};
    const usedPlayerIds = new Set<string>();
    
    slots.forEach(slot => {
      const slotPosition = getSlotDisplayName(slot);
      
      const matchingPlayer = currentTeam.players.find(
        player => player.position === slotPosition && !usedPlayerIds.has(player.id)
      );
      
      if (matchingPlayer) {
        newAssignments[slot] = matchingPlayer.id;
        usedPlayerIds.add(matchingPlayer.id);
      }
    });
    
    setFormationAssignments(newAssignments);
  };

  // I'll provide the render functions in the next message due to length...
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Render functions go here */}
    </div>
  );
}

export default App;
