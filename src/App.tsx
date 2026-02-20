import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, History as HistoryIcon, Upload, Download, BarChart2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTeamStorage } from './hooks/useTeamStorage';
import { useGameTimer } from './hooks/useGameTimer';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useGameHistory } from './hooks/useGameHistory';
import { useGameActions } from './hooks/useGameActions';
import { PlayerRow } from './PlayerRow';
import { Team, Player } from './types';
import { GameLive } from './GameLive';
import AccessGate from './AccessGate';
import './index.css';

const POSITIONS = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'LW', 'RW', 'CF'];
const FORMATIONS = ['1-4-4-2', '1-4-3-3'];

const FORMATION_LAYOUTS = {
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

export default function SoccerTimeTracker() {
  const [view, setView] = useState('home');
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [formation, setFormation] = useState('1-4-4-2');
  const [formationAssignments, setFormationAssignments] = useState<Record<string, string>>({});
  const [gameName, setGameName] = useState('');
  const [gameDuration, setGameDuration] = useState(80);
  
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamDefaultDuration, setTeamDefaultDuration] = useState(80);
  const [playerFirstName, setPlayerFirstName] = useState('');
  const [playerLastName, setPlayerLastName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [playerPosition, setPlayerPosition] = useState('');
  const [playerSecondaryPositions, setPlayerSecondaryPositions] = useState<string[]>([]);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [selectedPlayerForAction, setSelectedPlayerForAction] = useState<{id: string, name: string} | null>(null);
  const [isSecondaryPositionDropdownOpen, setIsSecondaryPositionDropdownOpen] = useState(false);
  const secondaryPositionRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalTime', direction: 'desc' });
  const version = process.env.REACT_APP_VERSION || '0.1.0';
  const isDragging = useRef(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const [playersToSubIn, setPlayersToSubIn] = useState<string[]>([]);
  const [playersToSubOut, setPlayersToSubOut] = useState<string[]>([]);
  const [substituteSortKey, setSubstituteSortKey] = useState<'number' | 'position'>('number');
  const [availablePlayerSortKey, setAvailablePlayerSortKey] = useState<'number' | 'position'>('number');

  // Custom Hooks
  const { teams, saveTeam, deleteTeam } = useTeamStorage();
  const { history, saveGame, deleteGame: deleteGameHistory } = useGameHistory();
  
  const { 
    gameState, 
    gameTime, 
    playerTimes, 
    activePlayerIds, 
    setActivePlayerIds,
    startGame, 
    togglePlayPause, 
    cancelGame 
  } = useGameTimer();

  const {
    playerGoals,
    playerRedCards,
    actionHistory,
    handleGoal,
    handleRedCard,
    handleUndoAction,
    initializeGameActions
  } = useGameActions({
    currentTeam,
    formationAssignments,
    setFormationAssignments,
    setActivePlayerIds
  });

  const getFormationSlots = () => {
    const layout = FORMATION_LAYOUTS[formation as keyof typeof FORMATION_LAYOUTS];
    return Object.keys(layout);
  };

  const safeSetActivePlayerIds = useCallback((value: React.SetStateAction<string[]>) => {
    if (!isDragging.current) {
      setActivePlayerIds(value);
    }
  }, [setActivePlayerIds]);

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDropOnSlot,
    handleDropOnBench
  } = useDragAndDrop({ 
    formationAssignments, 
    setFormationAssignments, 
    activePlayerIds, 
    setActivePlayerIds: safeSetActivePlayerIds, 
    view,
    maxPlayersOnField: getFormationSlots().length - Object.values(playerRedCards).reduce((a, b) => a + b, 0)
  });

  const customHandleDropOnSlot = (e: React.DragEvent, targetSlot: string) => {
    try {
      // The useDragAndDrop hook is assumed to stringify an object with player and source info.
      const draggedData = e.dataTransfer.getData("application/json");
      if (draggedData) {
        const { playerId: draggedPlayerId, sourceSlot } = JSON.parse(draggedData);
        const playerInTargetSlotId = formationAssignments[targetSlot];

        // Scenario: A bench player (no sourceSlot) is dropped on an active player.
        if (playerInTargetSlotId && !sourceSlot) {
          const newAssignments = { ...formationAssignments };
          // Place the bench player in the target slot, implicitly moving the other player to the bench.
          newAssignments[targetSlot] = draggedPlayerId;
          setFormationAssignments(newAssignments);
          return; // The custom action is complete.
        }
      }
    } catch (error) {
      // Fallback for safety if data format is not as expected.
    }

    // For all other cases, use the default hook behavior.
    handleDropOnSlot(e, targetSlot);
  };

  useEffect(() => {
    // When a drag and drop operation finishes, sync active players from the formation.
    // This prevents timer freezes during swaps by ensuring activePlayerIds is updated
    // only once from the final formation state, rather than intermediate states.
    if (!isDragging.current) {
        const newActiveIds = Object.values(formationAssignments).filter(pId => pId);
        
        const sortedNew = [...newActiveIds].sort();
        const sortedOld = [...activePlayerIds].sort();

        if (JSON.stringify(sortedNew) !== JSON.stringify(sortedOld)) {
            setActivePlayerIds(newActiveIds);
        }
    }
  }, [formationAssignments, activePlayerIds, setActivePlayerIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (secondaryPositionRef.current && !secondaryPositionRef.current.contains(event.target as Node)) {
        setIsSecondaryPositionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (currentTeam) {
      setGameDuration(currentTeam.defaultGameDuration || 80);
    }
  }, [currentTeam]);

  const handleSecondaryPositionChange = (position: string) => {
    setPlayerSecondaryPositions(prev => {
      const newSelection = prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position];
      return newSelection.sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b));
    });
  };

  const handleDragEnterZone = (e: React.DragEvent, targetId: string) => {
    handleDragEnter(e);
    setDragOverTarget(targetId);
  };

  const handleDragLeaveZone = (e: React.DragEvent) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    setDragOverTarget(null);
  };

  const formatTime = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cancelEditing = () => {
    setEditingPlayerId(null);
    setPlayerFirstName('');
    setPlayerLastName('');
    setPlayerNumber('');
    setPlayerPosition('');
    setPlayerSecondaryPositions([]);
  };

  const handleCreateTeam = () => {
    if (teamNameInput.trim() && teamDefaultDuration > 0) {
      const team: Team = {
        id: Date.now().toString(),
        name: teamNameInput,
        defaultGameDuration: teamDefaultDuration,
        players: []
      };
      saveTeam(team);
      setCurrentTeam(team);
      setTeamNameInput('');
      setView('team-detail');
      cancelEditing();
    }
  };

  const handleImportTeam = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const lines = content.split('\n');
      let teamName = teamNameInput.trim();
      
      if (!teamName) {
        teamName = file.name.replace(/\.[^/.]+$/, ""); // Use filename as team name if input is empty
      }

      const players: Player[] = [];
      let startIndex = 0;
      
      // Simple check to skip header row if it exists
      if (lines.length > 0 && (lines[0].toLowerCase().includes('first name') || lines[0].toLowerCase().includes('firstname'))) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const [firstName, lastName, number, position = 'SUB', ...secondaryParts] = parts;
          if (firstName && lastName && number) {
            players.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              firstName,
              lastName,
              number,
              position,
              secondaryPositions: secondaryParts.flatMap(p => p.split(/[:;]/)).map(p => p.trim()).filter(Boolean),
              isUnavailable: false
            });
          }
        }
      }

      if (players.length > 0) {
        const newTeam: Team = {
          id: Date.now().toString(),
          name: teamName,
          defaultGameDuration: teamDefaultDuration,
          players
        };
        saveTeam(newTeam);
        setCurrentTeam(newTeam);
        setTeamNameInput('');
        setTeamDefaultDuration(80);
        setView('team-detail');
        cancelEditing();
      } else {
        alert('No valid players found in CSV. Expected format: First Name, Last Name, Number, Position');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const handleAddPlayer = () => {
    if (playerFirstName && playerLastName && playerNumber && playerPosition) {
      const player: Player = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        firstName: playerFirstName,
        lastName: playerLastName,
        number: playerNumber,
        position: playerPosition,
        secondaryPositions: playerSecondaryPositions,
        isUnavailable: false
      };
      const updated = { ...currentTeam, players: [...currentTeam.players, player] };
      setCurrentTeam(updated);
      saveTeam(updated);
      setPlayerFirstName('');
      setPlayerLastName('');
      setPlayerNumber('');
      setPlayerPosition('');
      setPlayerSecondaryPositions([]);
    }
  };

  const startEditing = (player: Player) => {
    setEditingPlayerId(player.id);
    setPlayerFirstName(player.firstName);
    setPlayerLastName(player.lastName);
    setPlayerNumber(player.number);
    setPlayerPosition(player.position);
    setPlayerSecondaryPositions(player.secondaryPositions || []);
  };

  const handleUpdatePlayer = () => {
    if (currentTeam && editingPlayerId && playerFirstName && playerLastName && playerNumber && playerPosition) {
      const updatedPlayers = currentTeam.players.map(p => 
        p.id === editingPlayerId 
          ? { ...p, firstName: playerFirstName, lastName: playerLastName, number: playerNumber, position: playerPosition, secondaryPositions: playerSecondaryPositions }
          : p
      );
      const updatedTeam = { ...currentTeam, players: updatedPlayers };
      setCurrentTeam(updatedTeam);
      saveTeam(updatedTeam);
      cancelEditing();
    }
  };

  const togglePlayerAvailability = (player: Player) => {
    if (!currentTeam) return;
    const updatedPlayers = currentTeam.players.map(p =>
      p.id === player.id ? { ...p, isUnavailable: !p.isUnavailable } : p
    );
    const updatedTeam = { ...currentTeam, players: updatedPlayers };
    setCurrentTeam(updatedTeam);
    saveTeam(updatedTeam);
  };

  const removePlayer = (playerId: string) => {
    if (!currentTeam) return;
    if (window.confirm('Are you sure you want to remove this player?')) {
      const updated = { ...currentTeam, players: currentTeam.players.filter(p => p.id !== playerId) };
      setCurrentTeam(updated);
      saveTeam(updated);
    }
  };

  const handleClearPlayers = () => {
    if (!currentTeam) return;
    if (window.confirm('Are you sure you want to remove all players from this team?')) {
      const updated = { ...currentTeam, players: [] };
      setCurrentTeam(updated);
      saveTeam(updated);
    }
  };

  const handleStartGame = () => {
    if (!gameName.trim()) return;
    
    const slots = getFormationSlots();
    const allSlotsFilled = slots.every(slot => formationAssignments[slot]);
    
    if (!allSlotsFilled) return;
    
    const times: Record<string, number> = {};
    const goals: Record<string, number> = {};
    const redCards: Record<string, number> = {};
    const activePlayers = Object.values(formationAssignments).filter(Boolean);
    
    currentTeam?.players.forEach(p => {
      times[p.id] = 0;
      goals[p.id] = 0;
      redCards[p.id] = 0;
    });
    
    initializeGameActions(goals, redCards);
    startGame(activePlayers, times, gameDuration);
    setView('game-live');
  };

  const handleCancelSubstitution = () => {
    setPlayersToSubIn([]);
    setPlayersToSubOut([]);
  };

  const handlePerformSubstitution = () => {
    if (playersToSubIn.length === 0 || playersToSubIn.length !== playersToSubOut.length) {
      return;
    }

    const newAssignments = { ...formationAssignments };

    const outPlayerSlots: { [playerId: string]: string } = {};
    Object.entries(formationAssignments).forEach(([slot, playerId]) => {
      if (playersToSubOut.includes(playerId)) {
        outPlayerSlots[playerId] = slot;
      }
    });

    const playersToBringIn = [...playersToSubIn];

    playersToSubOut.forEach(outId => {
      const slot = outPlayerSlots[outId];
      const inId = playersToBringIn.shift();
      if (slot && inId) {
        newAssignments[slot] = inId;
      }
    });

    setFormationAssignments(newAssignments);
    handleCancelSubstitution();
  };

  const handleBenchPlayerClick = (playerId: string) => {
    if (gameState !== 'playing') return;

    const newPlayersToSubIn = playersToSubIn.includes(playerId)
      ? playersToSubIn.filter(id => id !== playerId)
      : [...playersToSubIn, playerId];

    setPlayersToSubIn(newPlayersToSubIn);
    setPlayersToSubOut([]);
  };

  const handleFieldPlayerClick = (player: Player) => {
    if (playersToSubIn.length === 0) {
      if (gameState !== 'finished') {
        setSelectedPlayerForAction({ id: player.id, name: getPlayerDisplayName(player) });
      }
      return;
    }

    if (gameState !== 'playing') return;

    const isSelected = playersToSubOut.includes(player.id);

    if (isSelected) {
      setPlayersToSubOut(playersToSubOut.filter(id => id !== player.id));
    } else {
      if (playersToSubOut.length < playersToSubIn.length) {
        setPlayersToSubOut([...playersToSubOut, player.id]);
      }
    }
  };

  const handleEndGame = () => {
    if (gameTime > 0 && currentTeam) {
      if (window.confirm('Game ended. Save to history?')) {
        const playerStats = currentTeam.players.map(p => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          number: p.number,
          time: playerTimes[p.id] || 0,
          goals: playerGoals[p.id] || 0,
          redCards: playerRedCards[p.id] || 0
        }));

        saveGame({
          id: Date.now().toString(),
          date: new Date().toISOString(),
          name: gameName,
          teamName: currentTeam.name,
          totalTime: gameTime,
          playerStats
        });

        // Mark red carded players as unavailable in the team
        const redCardedPlayerIds = Object.keys(playerRedCards).filter(id => playerRedCards[id] > 0);
        if (redCardedPlayerIds.length > 0) {
          const updatedPlayers = currentTeam.players.map(p => 
            redCardedPlayerIds.includes(p.id) ? { ...p, isUnavailable: true } : p
          );
          const updatedTeam = { ...currentTeam, players: updatedPlayers };
          setCurrentTeam(updatedTeam);
          saveTeam(updatedTeam);
        }
        
        cancelGame();
        setGameName('');
        setView('history');
        return;
      }
    }
    cancelGame();
    setGameName('');
    setView('formation');
  };

  const exportHistoryToCSV = (data = history) => {
    if (data.length === 0) return;

    const headers = ['Date', 'Game Name', 'Team Name', 'Total Game Time', 'Player Name', 'Player Number', 'Player Time', 'Goals', 'Red Cards'];
    const rows = data.flatMap(game => 
      game.playerStats.map(stat => [
        new Date(game.date).toLocaleDateString(),
        game.name,
        game.teamName,
        formatTime(game.totalTime),
        stat.name,
        stat.number,
        formatTime(stat.time),
        stat.goals || 0,
        stat.redCards || 0
      ])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'soccer_tracker_history.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getSlotDisplayName = (slotKey: string) => {
    return slotKey.replace(/2$/, '');
  };

  const getPlayerById = (id: string) => {
    if (!id) return null;
    return currentTeam?.players.find(p => p.id === id) || null;
  };

  const getPlayerDisplayName = (player: Player) => {
    const firstInitial = player.firstName.charAt(0).toUpperCase();
    return `${firstInitial}. ${player.lastName}`;
  };

  const getSubstitutes = () => {
    const assignedPlayerIds = Object.values(formationAssignments).filter(Boolean);
    const substitutes = currentTeam?.players.filter(p => !assignedPlayerIds.includes(p.id)) || [];

    return substitutes.sort((a, b) => {
      if (substituteSortKey === 'number') {
        return parseInt(a.number, 10) - parseInt(b.number, 10);
      }
      if (substituteSortKey === 'position') {
        return a.position.localeCompare(b.position);
      }
      return 0;
    });
  };

  const autoAssignPlayers = () => {
    if (!currentTeam) return;

    const slots = getFormationSlots();
    const newAssignments: Record<string, string> = {};
    const usedPlayerIds = new Set<string>();
    
    // First pass: Match primary positions
    slots.forEach(slot => {
      const slotPosition = getSlotDisplayName(slot);
      
      const matchingPlayer = currentTeam.players.find(
        player => player.position === slotPosition && !usedPlayerIds.has(player.id) && !player.isUnavailable
      );

      if (matchingPlayer) {
        newAssignments[slot] = matchingPlayer.id;
        usedPlayerIds.add(matchingPlayer.id);
      }
    });
    
    // Second pass: Match secondary positions for remaining slots
    slots.forEach(slot => {
      if (newAssignments[slot]) return; // Skip if already filled

      const slotPosition = getSlotDisplayName(slot);
      const matchingPlayer = currentTeam.players.find(
        player => player.secondaryPositions?.includes(slotPosition) && !usedPlayerIds.has(player.id) && !player.isUnavailable
      );

      if (matchingPlayer) {
        newAssignments[slot] = matchingPlayer.id;
        usedPlayerIds.add(matchingPlayer.id);
      }
    });

    setFormationAssignments(newAssignments);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: number) => void) => {
    const val = e.target.value;
    if (val === '') {
      setter(0);
      return;
    }
    if (/^\d+$/.test(val)) {
      const num = parseInt(val, 10);
      if (num >= 1 && num <= 90) {
        setter(num);
      }
    }
  };

  const renderPlayerStats = () => {
    const statsMap: Record<string, { id: string; name: string; number: string; totalTime: number; gamesPlayed: number; totalGoals: number; totalRedCards: number; avgTime: number }> = {};

    history.forEach(game => {
      game.playerStats.forEach(p => {
        if (!statsMap[p.id]) {
          statsMap[p.id] = { id: p.id, name: p.name, number: p.number, totalTime: 0, gamesPlayed: 0, totalGoals: 0, totalRedCards: 0, avgTime: 0 };
        }
        statsMap[p.id].totalTime += p.time;
        statsMap[p.id].totalGoals += (p.goals || 0);
        statsMap[p.id].totalRedCards += (p.redCards || 0);
        if (p.time > 0) {
          statsMap[p.id].gamesPlayed += 1;
        }
      });
    });

    // Calculate averages
    Object.values(statsMap).forEach(stat => {
      if (stat.gamesPlayed > 0) {
        stat.avgTime = stat.totalTime / stat.gamesPlayed;
      }
    });

    let sortedStats = Object.values(statsMap).filter(s => s.totalTime > 0);

    if (currentTeam) {
      sortedStats = sortedStats.filter(stat => currentTeam.players.some(p => p.id === stat.id));
    }

    sortedStats.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'number') {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    const requestSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }: { column: string }) => {
      if (sortConfig.key !== column) return <div className="w-4 h-4" />;
      return sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
    };

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{currentTeam ? `${currentTeam.name} Stats` : 'Player Statistics'}</h1>
          <button onClick={() => setView(currentTeam ? 'team-detail' : 'home')} className="text-blue-600 hover:underline">
            {currentTeam ? 'Back to Team' : 'Back to Home'}
          </button>
        </div>

        {sortedStats.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No stats available. Play some games first!</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden border">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('number')}
                  >
                    <div className="flex items-center gap-1">Number <SortIcon column="number" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('name')}
                  >
                    <div className="flex items-center gap-1">Name <SortIcon column="name" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('gamesPlayed')}
                  >
                    <div className="flex items-center gap-1">Games <SortIcon column="gamesPlayed" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('totalGoals')}
                  >
                    <div className="flex items-center gap-1">Goals <SortIcon column="totalGoals" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('totalRedCards')}
                  >
                    <div className="flex items-center gap-1">Red Cards <SortIcon column="totalRedCards" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('avgTime')}
                  >
                    <div className="flex items-center gap-1">Avg Time <SortIcon column="avgTime" /></div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('totalTime')}
                  >
                    <div className="flex items-center gap-1">Total Time <SortIcon column="totalTime" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedStats.map((stat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{stat.number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.gamesPlayed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalGoals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalRedCards}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(stat.avgTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 font-semibold">
                      {formatTime(stat.totalTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHome = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Soccer Time Tracker</h1>
        <p className="text-xs text-gray-400 mt-1">
          v{version} &copy; {new Date().getFullYear()} Alen Yokhanis
        </p>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Create New Team</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={teamNameInput}
            onChange={(e) => setTeamNameInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
            placeholder="Team name"
            className="flex-1 px-4 py-2 border rounded"
          />
          <input
            type="text"
            value={teamDefaultDuration || ''}
            onChange={(e) => handleDurationChange(e, setTeamDefaultDuration)}
            placeholder="Mins"
            className="w-24 px-4 py-2 border rounded"
            title="Default Game Duration (1-90 mins)"
          />
          <button 
            onClick={handleCreateTeam}
            disabled={!teamNameInput.trim() || teamDefaultDuration <= 0}
            className={`px-6 py-2 text-white rounded ${!teamNameInput.trim() || teamDefaultDuration <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Create
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Or import from CSV:</span>
          <label className="cursor-pointer px-4 py-2 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Upload size={16} />
            <span>Import Team CSV</span>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleImportTeam} 
              className="hidden" 
            />
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-1">Format: First Name, Last Name, Number, Position, Secondary Positions...</p>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-3">My Teams</h2>
        {teams.length === 0 ? (
          <p className="text-gray-500">No teams yet. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {teams.map(team => (
              <div key={team.id} className="flex items-center justify-between p-4 border rounded hover:bg-gray-50">
                <div className="flex-1 cursor-pointer" onClick={() => {
                  setCurrentTeam(team);
                  setView('team-detail');
                  cancelEditing();
                }}>
                  <h3 className="font-semibold">{team.name}</h3>
                  <p className="text-sm text-gray-600">{team.players.length} players</p>
                </div>
                <button
                  onClick={() => deleteTeam(team.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTeamDetail = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => { setCurrentTeam(null); setView('home'); cancelEditing(); }} className="text-blue-600 hover:underline">
          &larr; Back to Teams
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setView('history')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm"
          >
            <HistoryIcon size={20} />
            History
          </button>
          <button
            onClick={() => setView('player-stats')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm"
          >
            <BarChart2 size={20} />
            Team Stats
          </button>
        </div>
      </div>
      
      <h1 className="text-3xl font-bold mb-6">{currentTeam.name}</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Add Player</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <input
            type="text"
            value={playerFirstName}
            onChange={(e) => setPlayerFirstName(e.target.value)}
            placeholder="First name"
            className="px-3 py-2 border rounded"
          />
          <input
            type="text"
            value={playerLastName}
            onChange={(e) => setPlayerLastName(e.target.value)}
            placeholder="Last name"
            className="px-3 py-2 border rounded"
          />
          <input
            type="number"
            value={playerNumber}
            onChange={(e) => setPlayerNumber(e.target.value)}
            placeholder="Number"
            min="1"
            max="99"
            className="px-3 py-2 border rounded"
          />
          <select 
            value={playerPosition}
            onChange={(e) => setPlayerPosition(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">Position</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
          <div className="relative" ref={secondaryPositionRef}>
            <button
              type="button"
              onClick={() => setIsSecondaryPositionDropdownOpen(prev => !prev)}
              className="w-full h-full px-3 py-2 border rounded bg-white text-left flex items-center justify-between"
              aria-haspopup="listbox"
              aria-expanded={isSecondaryPositionDropdownOpen}
              aria-label="Secondary Positions"
            >
              <span className="block truncate text-sm">
                {playerSecondaryPositions.length > 0 ? playerSecondaryPositions.join(', ') : 'Secondary Positions'}
              </span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
            {isSecondaryPositionDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white shadow-lg border rounded max-h-60 overflow-auto">
                {POSITIONS.map(pos => (
                  <label key={pos} className="flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playerSecondaryPositions.includes(pos)}
                      onChange={() => handleSecondaryPositionChange(pos)}
                      className="h-4 w-4 border-gray-300 rounded mr-3"
                    />
                    {pos}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={editingPlayerId ? handleUpdatePlayer : handleAddPlayer}
            className={`px-4 py-2 ${editingPlayerId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded`}
          >
            {editingPlayerId ? <Save size={18} className="inline mr-1" /> : <Plus size={18} className="inline mr-1" />} 
            {editingPlayerId ? 'Update' : 'Add'}
          </button>
          {editingPlayerId && (
            <button 
              onClick={cancelEditing}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Players ({currentTeam.players.length})</h2>
          {currentTeam.players.length > 0 && (
            <button
              onClick={handleClearPlayers}
              className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 text-sm"
            >
              Clear All Players
            </button>
          )}
        </div>
        {currentTeam.players.length === 0 ? (
          <p className="text-gray-500">No players yet. Add some above!</p>
        ) : (
          <div className="space-y-2">
            {currentTeam.players.map(player => (
              <PlayerRow key={player.id} player={player} onRemove={removePlayer} onEdit={startEditing} onToggleAvailability={togglePlayerAvailability} />
            ))}
          </div>
        )}
      </div>

      {currentTeam && currentTeam.players.length > 0 && (
        <button
          onClick={() => setView('formation')}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Set Formation & Start Game
        </button>
      )}
    </div>
  );

  const renderFormation = () => {
    const slots = getFormationSlots();
    const layout = FORMATION_LAYOUTS[formation as keyof typeof FORMATION_LAYOUTS];
    const assignedPlayerIds = Object.values(formationAssignments);
    const unassignedPlayers = (currentTeam?.players.filter(p => !assignedPlayerIds.includes(p.id) && !p.isUnavailable) || []).sort((a, b) => {
      if (availablePlayerSortKey === 'number') {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      }
      if (availablePlayerSortKey === 'position') {
        return a.position.localeCompare(b.position);
      }
      return 0;
    });

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={() => setView('team-detail')} className="mb-4 text-blue-600 hover:underline">
          &larr; Back to Team
        </button>
        
        <h1 className="text-2xl font-bold mb-4">Formation Setup - Drag & Drop Players</h1>

        <div className="mb-6">
          <label className="block font-semibold mb-2">Select Formation:</label>
          <div className="flex gap-2 items-center">
            <select
              value={formation}
              onChange={(e) => {
                setFormation(e.target.value);
                setFormationAssignments({});
              }}
              className="px-4 py-2 border rounded"
            >
              {FORMATIONS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <button
              onClick={autoAssignPlayers}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Auto-Assign Players
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h2 className="font-semibold mb-3">Formation Positions</h2>
            <div className="relative bg-green-600 rounded-lg" style={{ height: '600px' }}>
              {slots.map(slot => {
                const pos = layout[slot];
                const assignedPlayer = getPlayerById(formationAssignments[slot]);
                const displayName = getSlotDisplayName(slot);
                
                return (
                  <div
                    key={slot}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${dragOverTarget === slot ? 'scale-110 ring-4 ring-yellow-400 rounded-full z-10' : ''}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnterZone(e, slot)}
                    onDragLeave={handleDragLeaveZone}
                    onDrop={(e) => {
                      setDragOverTarget(null);
                      handleDropOnSlot(e, slot);
                    }}
                  >
                    {assignedPlayer ? (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, assignedPlayer.id, slot)}
                        className="bg-white rounded-full w-20 h-20 flex flex-col items-center justify-center shadow-lg cursor-move hover:shadow-xl"
                      >
                        <div className="font-bold">#{assignedPlayer.number}</div>
                        <div className="text-xs text-center px-1">{getPlayerDisplayName(assignedPlayer)}</div>
                        <div className="text-xs font-bold text-gray-700">{assignedPlayer.position}</div>
                      </div>
                    ) : (
                      <div className="bg-white bg-opacity-50 rounded-full w-20 h-20 flex flex-col items-center justify-center shadow-lg border-2 border-dashed border-white">
                        <div className="text-gray-600 text-sm font-bold">{displayName}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Available Players</h2>
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button 
                  onClick={() => setAvailablePlayerSortKey('number')} 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${availablePlayerSortKey === 'number' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Number
                </button>
                <button 
                  onClick={() => setAvailablePlayerSortKey('position')} 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${availablePlayerSortKey === 'position' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Position
                </button>
              </div>
            </div>
            <div 
              className={`flex flex-wrap gap-3 min-h-[200px] p-3 border-2 border-dashed rounded-lg transition-colors duration-200 ${dragOverTarget === 'bench' ? 'bg-blue-50 border-blue-500' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnterZone(e, 'bench')}
              onDragLeave={handleDragLeaveZone}
              onDrop={(e) => {
                setDragOverTarget(null);
                handleDropOnBench(e);
              }}
            >
              {unassignedPlayers.map(player => (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, player.id)}
                  className="bg-white rounded-full w-20 h-20 flex flex-col items-center justify-center shadow-lg cursor-move hover:shadow-xl"
                >
                  <div className="font-bold">#{player.number}</div>
                  <div className="text-xs text-center px-1">{getPlayerDisplayName(player)}</div>
                  <div className="text-xs font-bold text-gray-700">{player.position}</div>
                </div>
              ))}
              {unassignedPlayers.length === 0 && (
                <p className="text-gray-400 text-center text-sm py-8 w-full">All players assigned</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <h2 className="font-semibold mb-2">Game Name:</h2>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Enter game name..."
                className="w-full px-4 py-2 border rounded"
              />
            </div>
            <div className="w-32">
              <h2 className="font-semibold mb-2">Duration:</h2>
              <input
                type="text"
                value={gameDuration || ''}
                onChange={(e) => handleDurationChange(e, setGameDuration)}
                placeholder="Mins"
                className="w-full px-4 py-2 border rounded"
                title="Game Duration (1-90 mins)"
              />
            </div>
          </div>
          
          <button
            onClick={handleStartGame}
            disabled={!gameName.trim() || !getFormationSlots().every(slot => formationAssignments[slot]) || gameDuration <= 0}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Start Game
          </button>
          {!getFormationSlots().every(slot => formationAssignments[slot]) && gameName.trim() && (
            <p className="text-red-600 text-sm mt-2 text-center">
              Please assign players to all positions before starting the game
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const displayedHistory = currentTeam 
      ? history.filter(game => game.teamName === currentTeam.name)
      : history;

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{currentTeam ? `${currentTeam.name} History` : 'Game History'}</h1>
          <div className="flex gap-4">
            {displayedHistory.length > 0 && (
              <button 
                onClick={() => exportHistoryToCSV(displayedHistory)}
                className="flex items-center gap-2 text-green-600 hover:underline"
              >
                <Download size={20} /> Export CSV
              </button>
            )}
            <button onClick={() => setView(currentTeam ? 'team-detail' : 'home')} className="text-blue-600 hover:underline">
              {currentTeam ? 'Back to Team' : 'Back to Home'}
            </button>
          </div>
        </div>
        
        {displayedHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No games saved {currentTeam ? 'for this team' : ''}.</p>
        ) : (
          <div className="space-y-4">
            {displayedHistory.map(game => (
              <div key={game.id} className="bg-white p-4 rounded-lg shadow border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{game.name}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(game.date).toLocaleDateString()} • {game.teamName}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-blue-600">
                      {formatTime(game.totalTime)}
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm('Delete this record?')) {
                          deleteGameHistory(game.id);
                        }
                      }}
                      className="text-red-500 text-xs hover:underline mt-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Player Stats</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {game.playerStats.map(stat => (
                      <div key={stat.id} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-sm">
                        <span className="truncate mr-2">#{stat.number} {stat.name}</span>
                        <span className={`font-mono ${stat.time > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatTime(stat.time)}
                        </span>
                        {stat.goals > 0 && (
                          <span className="ml-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">⚽ {stat.goals}</span>
                        )}
                        {(stat.redCards || 0) > 0 && (
                          <span className="ml-2 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">🟥 {stat.redCards}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AccessGate>
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1">
        {view === 'home' && renderHome()}
        {view === 'team-detail' && renderTeamDetail()}
        {view === 'formation' && renderFormation()}
        {view === 'game-live' && (
          <GameLive
            gameName={gameName}
            gameDuration={gameDuration}
            gameTime={gameTime}
            gameState={gameState}
            actionHistory={actionHistory}
            formation={formation}
            formationAssignments={formationAssignments}
            setFormationAssignments={setFormationAssignments}
            playerTimes={playerTimes}
            playerGoals={playerGoals}
            playerRedCards={playerRedCards}
            playersToSubIn={playersToSubIn}
            playersToSubOut={playersToSubOut}
            selectedPlayerForAction={selectedPlayerForAction}
            setSelectedPlayerForAction={setSelectedPlayerForAction}
            dragOverTarget={dragOverTarget}
            setDragOverTarget={setDragOverTarget}
            draggedPlayerId={draggedPlayerId}
            setDraggedPlayerId={setDraggedPlayerId}
            isDragging={isDragging}
            onUndoAction={handleUndoAction}
            onTogglePlayPause={togglePlayPause}
            onEndGame={handleEndGame}
            onGoal={handleGoal}
            onRedCard={handleRedCard}
            onFieldPlayerClick={handleFieldPlayerClick}
            onBenchPlayerClick={handleBenchPlayerClick}
            onCancelSubstitution={handleCancelSubstitution}
            onPerformSubstitution={handlePerformSubstitution}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDragEnterZone={handleDragEnterZone}
            handleDragLeaveZone={handleDragLeaveZone}
            customHandleDropOnSlot={customHandleDropOnSlot}
            handleDropOnBench={handleDropOnBench}
            formatTime={formatTime}
            getPlayerDisplayName={getPlayerDisplayName}
            getSlotDisplayName={getSlotDisplayName}
            getPlayerById={getPlayerById}
            getFormationSlots={getFormationSlots}
            getSubstitutes={getSubstitutes}
            formationLayouts={FORMATION_LAYOUTS}
            substituteSortKey={substituteSortKey}
            onSetSubstituteSortKey={setSubstituteSortKey}
          />
        )}
        {view === 'history' && renderHistory()}
        {view === 'player-stats' && renderPlayerStats()}
      </div>
      <footer className="py-3 text-center text-xs text-gray-400">
        v{version} &copy; {new Date().getFullYear()} Alen Yokhanis
      </footer>
    </div>
    </AccessGate>
  );
}
