import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, History as HistoryIcon, Upload, BarChart2, ChevronDown, Search, BookOpen, ShieldCheck } from 'lucide-react';
import { useTeamStorage } from './hooks/useTeamStorage';
import { useGameTimer } from './hooks/useGameTimer';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useGameHistory } from './hooks/useGameHistory';
import { useGameActions } from './hooks/useGameActions';
import { PlayerRow } from './PlayerRow';
import { Team, Player } from './types';
import { GameLive } from './GameLive';
import { UserManual } from './UserManual';
import { AdminUsers } from './AdminUsers';
import { neon } from './neonClient';
import { hasLocalDataToMigrate, hasPartialMigration, migrateLocalData } from './migrateLocalData';
import { LiveGameSnapshot, loadLiveGame, saveLiveGame, clearLiveGame } from './liveGameStorage';
import { POSITIONS, FORMATIONS_BY_SIDE, FORMATION_LAYOUTS } from './constants';
import { formatTime } from './utils/format';
import { historyToCsv, parseHistoryCsv } from './historyCsv';
import { parseTeamCsv } from './teamCsv';
import { HistoryView } from './views/HistoryView';
import { PlayerStatsView } from './views/PlayerStatsView';
import { EndGameDialog } from './EndGameDialog';
import './index.css';

export default function SoccerTimeTracker() {
  const [view, setView] = useState('home');
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [formation, setFormation] = useState('1-4-4-2');
  const [formationAssignments, setFormationAssignments] = useState<Record<string, string>>({});
  const [gameName, setGameName] = useState('');
  const [gameDuration, setGameDuration] = useState(80);
  
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamDefaultDuration, setTeamDefaultDuration] = useState(80);
  const [teamPlayersPerSide, setTeamPlayersPerSide] = useState<9 | 11>(11);
  const [playerFirstName, setPlayerFirstName] = useState('');
  const [playerLastName, setPlayerLastName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [playerPosition, setPlayerPosition] = useState('');
  const [playerSecondaryPositions, setPlayerSecondaryPositions] = useState<string[]>([]);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [isBorrowedPlayer, setIsBorrowedPlayer] = useState(false);
  const [selectedPlayerForAction, setSelectedPlayerForAction] = useState<{id: string, name: string} | null>(null);
  const [isSecondaryPositionDropdownOpen, setIsSecondaryPositionDropdownOpen] = useState(false);
  const secondaryPositionRef = useRef<HTMLDivElement>(null);
  const addPlayerSectionRef = useRef<HTMLDivElement>(null);
  const version = __APP_VERSION__;
  const isDragging = useRef(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const [playersToSubIn, setPlayersToSubIn] = useState<string[]>([]);
  const [playersToSubOut, setPlayersToSubOut] = useState<string[]>([]);
  const [substituteSortKey, setSubstituteSortKey] = useState<'number' | 'position'>('number');
  const [availablePlayerSortKey, setAvailablePlayerSortKey] = useState<'number' | 'position'>('number');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [substituteSearchQuery, setSubstituteSearchQuery] = useState('');
  const [playerFilterPosition, setPlayerFilterPosition] = useState('');

  // Custom Hooks
  const {
    teams, loading: teamsLoading, error: teamsError, clearError: clearTeamsError,
    saveTeam, deleteTeam, reload: reloadTeams,
  } = useTeamStorage();
  const {
    history, error: historyError, clearError: clearHistoryError,
    saveGame, deleteGame: deleteGameHistory, importGames, reload: reloadHistory,
  } = useGameHistory();

  const dataError = teamsError || historyError;
  const dismissDataError = () => { clearTeamsError(); clearHistoryError(); };

  // Admins get an in-app screen for managing who can use the app. The database
  // enforces this too, so a non-admin who forced the view would see nothing.
  const currentEmail = neon.auth.useSession().data?.user?.email;
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Retry until the check succeeds, including when it returns false: while
      // the database is waking from scale-to-zero the JWT cannot be verified
      // yet, so this returns false for a genuine admin. Treating that first
      // answer as final hid the link for the whole session.
      const delays = [400, 800, 1600, 3000];
      for (let attempt = 0; attempt <= delays.length && !cancelled; attempt++) {
        try {
          const { data, error } = await neon.rpc('is_admin');
          if (cancelled) return;
          if (!error && data === true) {
            setIsAdmin(true);
            return;
          }
          if (error) console.error('Admin check failed:', error);
        } catch (err) {
          console.error('Admin check failed:', err);
        }
        if (attempt < delays.length) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [showMigrate, setShowMigrate] = useState(false);
  useEffect(() => { setShowMigrate(hasLocalDataToMigrate()); }, []);

  const handleMigrateLocalData = async () => {
    try {
      const r = await migrateLocalData();
      await Promise.all([reloadTeams(), reloadHistory()]);
      setShowMigrate(false);
      alert(`Imported ${r.teams} team(s), ${r.players} player(s), and ${r.games} game(s) into your account.`);
    } catch (e) {
      console.error('Local data import failed:', e);
      // Whatever did import is kept; a retry only imports what's missing.
      await Promise.all([reloadTeams(), reloadHistory()]);
      alert('Some of your data could not be imported. Your local data is unchanged — tap "Import data" again to retry the rest.');
    }
  };
  
  const { 
    gameState, 
    gameTime, 
    playerTimes, 
    activePlayerIds, 
    setActivePlayerIds,
    startGame, 
    restoreGame,
    togglePlayPause, 
    cancelGame 
  } = useGameTimer();

  const {
    playerGoals,
    playerRedCards,
    playerYellowCards,
    opponentGoals,
    actionHistory,
    handleGoal,
    handleOpponentGoal,
    handleRedCard,
    handleYellowCard,
    handleUndoAction,
    initializeGameActions
  } = useGameActions({
    currentTeam,
    formationAssignments,
    setFormationAssignments,
    setActivePlayerIds
  });

  const getFormationSlots = () => {
    const layout = FORMATION_LAYOUTS[formation];
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
    // Only for a game being set up: a game in progress (including one just
    // resumed) keeps the duration it was started with.
    if (currentTeam && gameState === 'idle') {
      setGameDuration(currentTeam.defaultGameDuration || 80);
    }
  }, [currentTeam]);

  // ---- Live game persistence (survives refresh / tab killed / flat battery) ----
  const [pendingLiveGame, setPendingLiveGame] = useState<LiveGameSnapshot | null>(() => loadLiveGame());

  useEffect(() => {
    if (view !== 'game-live' || gameState === 'idle' || !currentTeam) return;
    saveLiveGame({
      team: currentTeam,
      gameName,
      gameDuration,
      formation,
      formationAssignments,
      gameState,
      gameTime,
      playerTimes,
      activePlayerIds,
      playerGoals,
      playerRedCards,
      playerYellowCards,
      opponentGoals,
      actionHistory,
    });
  }, [view, currentTeam, gameName, gameDuration, formation, formationAssignments, gameState, gameTime,
      playerTimes, activePlayerIds, playerGoals, playerRedCards, playerYellowCards, opponentGoals, actionHistory]);

  const resumeLiveGame = () => {
    const saved = pendingLiveGame;
    if (!saved) return;
    // Prefer the team as it is now (e.g. a player's name was corrected), but
    // fall back to the copy in the snapshot if the team can't be found.
    const team = teams.find(t => t.id === saved.team.id) ?? saved.team;
    setCurrentTeam(team);
    setFormation(saved.formation);
    setFormationAssignments(saved.formationAssignments);
    setGameName(saved.gameName);
    setGameDuration(saved.gameDuration);
    initializeGameActions(
      saved.playerGoals, saved.playerRedCards, saved.playerYellowCards,
      saved.opponentGoals, saved.actionHistory
    );
    restoreGame({
      gameState: saved.gameState,
      gameTime: saved.gameTime,
      playerTimes: saved.playerTimes,
      activePlayerIds: saved.activePlayerIds,
      duration: saved.gameDuration,
      resumeFrom: saved.savedAt,
    });
    setPendingLiveGame(null);
    setView('game-live');
  };

  const discardLiveGame = () => {
    if (!window.confirm('Discard the unfinished game? It will not be saved to history.')) return;
    clearLiveGame();
    setPendingLiveGame(null);
  };

  // Ends the game on screen and forgets the copy kept on this device.
  const finishLiveGame = () => {
    cancelGame();
    clearLiveGame();
  };

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

  const cancelEditing = () => {
    setEditingPlayerId(null);
    setPlayerFirstName('');
    setPlayerLastName('');
    setPlayerNumber('');
    setPlayerPosition('');
    setPlayerSecondaryPositions([]);
    setPlayerSearchQuery('');
    setPlayerFilterPosition('');
    setIsBorrowedPlayer(false);
  };

  const getFilteredPlayers = () => {
    if (!currentTeam) return [];
    const query = playerSearchQuery.toLowerCase();
    return currentTeam.players.filter(p => {
      const matchesSearch = p.firstName.toLowerCase().includes(query) || p.lastName.toLowerCase().includes(query) || p.number.includes(query);
      const matchesPosition = playerFilterPosition ? p.position === playerFilterPosition : true;
      return matchesSearch && matchesPosition;
    });
  };

  // Saves an updated version of the current team, reverting the local copy if
  // the database rejects the write (otherwise the UI would keep showing a
  // change that was never persisted).
  const saveCurrentTeam = async (updated: Team) => {
    const previous = currentTeam;
    setCurrentTeam(updated);
    const ok = await saveTeam(updated);
    if (!ok) setCurrentTeam(previous);
    return ok;
  };

  const handleCreateTeam = async () => {
    if (teamNameInput.trim() && teamDefaultDuration > 0) {
      const team: Team = {
        id: crypto.randomUUID(),
        name: teamNameInput,
        defaultGameDuration: teamDefaultDuration,
        playersPerSide: teamPlayersPerSide,
        players: []
      };
      // Only open the team once it actually exists in the database.
      if (!(await saveTeam(team))) return;
      setCurrentTeam(team);
      setTeamNameInput('');
      setTeamPlayersPerSide(11);
      setView('team-detail');
      cancelEditing();
    }
  };

  const handleImportTeam = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      let teamName = teamNameInput.trim();
      if (!teamName) {
        teamName = file.name.replace(/\.[^/.]+$/, ""); // Use filename as team name if input is empty
      }

      const players = parseTeamCsv(content);

      if (players.length > 0) {
        const newTeam: Team = {
          id: crypto.randomUUID(),
          name: teamName,
          defaultGameDuration: teamDefaultDuration,
          playersPerSide: teamPlayersPerSide,
          players
        };
        // Only open the imported team once it actually exists in the database.
        if (!(await saveTeam(newTeam))) return;
        setCurrentTeam(newTeam);
        setTeamNameInput('');
        setTeamDefaultDuration(80);
        setTeamPlayersPerSide(11);
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
    if (currentTeam && playerFirstName && playerLastName && playerNumber && playerPosition) {
      const player: Player = {
        id: crypto.randomUUID(),
        firstName: playerFirstName,
        lastName: playerLastName,
        number: playerNumber,
        position: playerPosition,
        secondaryPositions: playerSecondaryPositions,
        isUnavailable: false,
        isBorrowed: isBorrowedPlayer || undefined
      };
      const updated = { ...currentTeam, players: [...currentTeam.players, player] };
      saveCurrentTeam(updated);
      setPlayerFirstName('');
      setPlayerLastName('');
      setPlayerNumber('');
      setPlayerPosition('');
      setPlayerSecondaryPositions([]);
      setIsBorrowedPlayer(false);
    }
  };

  const startEditing = (player: Player) => {
    setEditingPlayerId(player.id);
    setPlayerFirstName(player.firstName);
    setPlayerLastName(player.lastName);
    setPlayerNumber(player.number);
    setPlayerPosition(player.position);
    setPlayerSecondaryPositions(player.secondaryPositions || []);
    setIsBorrowedPlayer(player.isBorrowed ?? false);
    addPlayerSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpdatePlayer = () => {
    if (currentTeam && editingPlayerId && playerFirstName && playerLastName && playerNumber && playerPosition) {
      const updatedPlayers = currentTeam.players.map(p =>
        p.id === editingPlayerId
          ? { ...p, firstName: playerFirstName, lastName: playerLastName, number: playerNumber, position: playerPosition, secondaryPositions: playerSecondaryPositions, isBorrowed: isBorrowedPlayer || undefined }
          : p
      );
      const updatedTeam = { ...currentTeam, players: updatedPlayers };
      saveCurrentTeam(updatedTeam);
      cancelEditing();
    }
  };

  const togglePlayerAvailability = (player: Player) => {
    if (!currentTeam) return;
    const updatedPlayers = currentTeam.players.map(p =>
      p.id === player.id ? { ...p, isUnavailable: !p.isUnavailable } : p
    );
    const updatedTeam = { ...currentTeam, players: updatedPlayers };
    saveCurrentTeam(updatedTeam);
  };

  const removePlayer = (playerId: string) => {
    if (!currentTeam) return;
    if (window.confirm('Are you sure you want to remove this player?')) {
      const updated = { ...currentTeam, players: currentTeam.players.filter(p => p.id !== playerId) };
      saveCurrentTeam(updated);
    }
  };

  const handleClearPlayers = () => {
    if (!currentTeam) return;
    if (window.confirm('Are you sure you want to remove all players from this team?')) {
      const updated = { ...currentTeam, players: [] };
      saveCurrentTeam(updated);
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
    const yellowCards: Record<string, number> = {};
    const activePlayers = Object.values(formationAssignments).filter(Boolean);
    
    currentTeam?.players.forEach(p => {
      times[p.id] = 0;
      goals[p.id] = 0;
      redCards[p.id] = 0;
      yellowCards[p.id] = 0;
    });
    
    initializeGameActions(goals, redCards, yellowCards);
    startGame(activePlayers, times, gameDuration);
    // Starting a new game replaces any unfinished one kept on this device.
    setPendingLiveGame(null);
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

  // Stop button: if anything has been played, ask what to do with the game.
  const [showEndGameDialog, setShowEndGameDialog] = useState(false);
  const [savingGame, setSavingGame] = useState(false);

  const handleEndGame = () => {
    if (gameTime > 0 && currentTeam) {
      setShowEndGameDialog(true);
    } else {
      // Nothing played yet: nothing to save or lose.
      finishLiveGame();
      setGameName('');
      setView('formation');
    }
  };

  const saveAndEndGame = async () => {
    if (!currentTeam) return;
    const playerStats = currentTeam.players.map(p => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      number: p.number,
      time: playerTimes[p.id] || 0,
      goals: playerGoals[p.id] || 0,
      redCards: playerRedCards[p.id] || 0,
      yellowCards: playerYellowCards[p.id] || 0
    }));

    setSavingGame(true);
    // Keep the game on screen if it couldn't be saved, so the result isn't lost.
    const saved = await saveGame({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: gameName,
      teamName: currentTeam.name,
      teamScore: Object.values(playerGoals).reduce((a, b) => a + b, 0),
      opponentScore: opponentGoals,
      totalTime: gameTime,
      playerStats
    }, currentTeam.id);
    if (!saved) {
      setSavingGame(false);
      setShowEndGameDialog(false);
      return;
    }

    // Mark red carded players as unavailable, and remove borrowed players
    const redCardedPlayerIds = Object.keys(playerRedCards).filter(id => playerRedCards[id] > 0);
    const updatedPlayers = currentTeam.players
      .filter(p => !p.isBorrowed)
      .map(p => redCardedPlayerIds.includes(p.id) ? { ...p, isUnavailable: true } : p);
    await saveCurrentTeam({ ...currentTeam, players: updatedPlayers });

    setSavingGame(false);
    setShowEndGameDialog(false);
    finishLiveGame();
    setGameName('');
    setView('history');
  };

  const discardAndEndGame = async () => {
    setShowEndGameDialog(false);
    // Borrowed players were only for this game, saved or not.
    if (currentTeam) {
      await saveCurrentTeam({ ...currentTeam, players: currentTeam.players.filter(p => !p.isBorrowed) });
    }
    finishLiveGame();
    setGameName('');
    setView('formation');
  };

  const exportHistoryToCSV = (data = history) => {
    if (data.length === 0) return;
    const blob = new Blob([historyToCsv(data)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'soccer_tracker_history.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const importedGames = parseHistoryCsv(content);
      if (importedGames === null) { alert('Invalid CSV file.'); return; }
      if (importedGames.length === 0) { alert('No valid game records found in CSV.'); return; }

      importGames(importedGames).then(({ added, merged }) => {
        alert(`Import complete: ${added} game(s) added, ${merged} game(s) merged.`);
      });
    };
    reader.readAsText(file);
    event.target.value = '';
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
    const substitutes = currentTeam?.players.filter(p => !assignedPlayerIds.includes(p.id) && !p.isUnavailable) || [];

    const filteredSubstitutes = substitutes.filter(p =>
      (p.firstName.toLowerCase().includes(substituteSearchQuery.toLowerCase()) ||
      p.lastName.toLowerCase().includes(substituteSearchQuery.toLowerCase()) ||
      p.number.includes(substituteSearchQuery)) &&
      (playerFilterPosition ? p.position === playerFilterPosition : true));

    return filteredSubstitutes.sort((a, b) => {
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

  const renderHome = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Soccer Time Tracker</h1>
        <p className="text-xs text-gray-400 mt-1">
          v{version} &copy; {new Date().getFullYear()} Alen Yokhanis
        </p>
      </div>

      {!teamsLoading && pendingLiveGame && (
        <div
          data-testid="resume-game-banner"
          className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-4"
        >
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Unfinished game: {pendingLiveGame.gameName} ({pendingLiveGame.team.name})</p>
            <p>
              {pendingLiveGame.gameState === 'playing'
                ? 'The clock was running and has kept counting while the app was closed.'
                : `Stopped at ${formatTime(pendingLiveGame.gameTime)}.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={discardLiveGame}
              className="px-4 py-2 border border-amber-400 text-amber-900 rounded-lg hover:bg-amber-100 font-semibold whitespace-nowrap"
            >
              Discard
            </button>
            <button
              onClick={resumeLiveGame}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold whitespace-nowrap"
            >
              Resume game
            </button>
          </div>
        </div>
      )}

      {!teamsLoading && showMigrate && (teams.length === 0 || hasPartialMigration()) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-between gap-4">
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Local data found on this device</p>
            <p>Import your existing teams and game history into your account.</p>
          </div>
          <button
            onClick={handleMigrateLocalData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold whitespace-nowrap"
          >
            Import data
          </button>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Create New Team</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={teamNameInput}
            onChange={(e) => setTeamNameInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
            placeholder="Team name"
            className="flex-1 min-w-0 px-4 py-2 border rounded"
          />
          <input
            type="text"
            value={teamDefaultDuration || ''}
            onChange={(e) => handleDurationChange(e, setTeamDefaultDuration)}
            placeholder="Mins"
            className="w-16 px-2 py-2 border rounded text-center"
            title="Default Game Duration (1-90 mins)"
          />
          <select
            value={teamPlayersPerSide}
            onChange={(e) => setTeamPlayersPerSide(Number(e.target.value) as 9 | 11)}
            className="px-3 py-2 border rounded"
            title="Players per side"
          >
            <option value={11}>11-a-side</option>
            <option value={9}>9-a-side</option>
          </select>
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
        {teamsLoading ? (
          <p className="text-gray-500">Loading teams…</p>
        ) : teams.length === 0 ? (
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

  // Takes the team as an argument so the view can rely on it being set.
  const renderTeamDetail = (currentTeam: Team) => (
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
      
      <h1 className="text-3xl font-bold mb-6">
        {currentTeam.name}
        <span className="text-lg font-normal text-gray-500 ml-2">({currentTeam.playersPerSide ?? 11}-a-side)</span>
      </h1>

      <div className="mb-6" ref={addPlayerSectionRef}>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-xl font-semibold">Add Player</h2>
          <button
            type="button"
            onClick={() => setIsBorrowedPlayer(prev => !prev)}
            className={`px-3 py-1 text-sm font-medium rounded-full border transition-colors ${isBorrowedPlayer ? 'bg-amber-400 border-amber-500 text-white' : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'}`}
          >
            Borrow Player
          </button>
        </div>
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
            aria-label="Player Position"
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
            className={`px-4 py-2 ${editingPlayerId ? 'bg-blue-600 hover:bg-blue-700' : isBorrowedPlayer ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded`}
          >
            {editingPlayerId ? <Save size={18} className="inline mr-1" /> : <Plus size={18} className="inline mr-1" />}
            {editingPlayerId ? 'Update' : isBorrowedPlayer ? 'Add Borrowed' : 'Add'}
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
        
        {currentTeam.players.length > 0 && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                placeholder="Search players by name or number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={playerFilterPosition}
              onChange={(e) => setPlayerFilterPosition(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by Position"
            >
              <option value="">All Positions</option>
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        )}

        {currentTeam.players.length === 0 ? (
          <p className="text-gray-500">No players yet. Add some above!</p>
        ) : (
          <div className="space-y-2">
            {getFilteredPlayers().map(player => (
              <PlayerRow key={player.id} player={player} onRemove={removePlayer} onEdit={startEditing} onToggleAvailability={togglePlayerAvailability} />
            ))}
            {getFilteredPlayers().length === 0 && (
              <p className="text-gray-500 text-center py-4">No players found matching "{playerSearchQuery}"</p>
            )}
          </div>
        )}
      </div>

      {currentTeam && currentTeam.players.length > 0 && (
        <button
          onClick={() => {
            const side = currentTeam.playersPerSide ?? 11;
            setFormation(FORMATIONS_BY_SIDE[side][0]);
            setFormationAssignments({});
            setView('formation');
          }}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Set Formation & Start Game
        </button>
      )}
    </div>
  );

  const renderFormation = () => {
    const slots = getFormationSlots();
    const layout = FORMATION_LAYOUTS[formation];
    const assignedPlayerIds = Object.values(formationAssignments);
    const unassignedPlayers = (currentTeam?.players.filter(p => 
      !assignedPlayerIds.includes(p.id) && 
      !p.isUnavailable &&
      (p.firstName.toLowerCase().includes(substituteSearchQuery.toLowerCase()) || 
       p.lastName.toLowerCase().includes(substituteSearchQuery.toLowerCase()) || 
       p.number.includes(substituteSearchQuery)) &&
      (playerFilterPosition ? p.position === playerFilterPosition : true)
    ) || []).sort((a, b) => {
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
              {FORMATIONS_BY_SIDE[currentTeam?.playersPerSide ?? 11].map(f => (
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
            <div className="relative bg-green-600 rounded-lg" style={{ height: '400px' }}>
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
                        className="bg-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center shadow-lg cursor-move hover:shadow-xl"
                      >
                        <div className="text-xs sm:text-sm font-bold">#{assignedPlayer.number}</div>
                        <div className="text-[10px] sm:text-xs text-center px-1 leading-tight">{getPlayerDisplayName(assignedPlayer)}</div>
                        <div className="text-[10px] sm:text-xs font-bold text-gray-700">{assignedPlayer.position}</div>
                      </div>
                    ) : (
                      <div className="bg-white bg-opacity-50 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center shadow-lg border-2 border-dashed border-white">
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
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={substituteSearchQuery}
                  onChange={(e) => setSubstituteSearchQuery(e.target.value)}
                  placeholder="Search available players..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={playerFilterPosition}
                onChange={(e) => setPlayerFilterPosition(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter Available Players"
              >
                <option value="">All</option>
                {POSITIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
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
            <div className="w-24">
              <h2 className="font-semibold mb-2">Duration:</h2>
              <input
                type="text"
                value={gameDuration || ''}
                onChange={(e) => handleDurationChange(e, setGameDuration)}
                placeholder="Mins"
                className="w-full px-4 py-2 border rounded text-center"
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


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {dataError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-300 px-4 py-3 flex items-start justify-between gap-4"
        >
          <p className="text-sm text-red-800">{dataError}</p>
          <button
            onClick={dismissDataError}
            aria-label="Dismiss error"
            className="text-red-700 text-sm font-semibold hover:underline whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex-1">
        {view === 'home' && renderHome()}
        {view === 'team-detail' && currentTeam && renderTeamDetail(currentTeam)}
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
            opponentGoals={opponentGoals}
            playerYellowCards={playerYellowCards}
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
            onOpponentGoal={handleOpponentGoal}
            onYellowCard={handleYellowCard}
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
            substituteSearchQuery={substituteSearchQuery}
            onSetSubstituteSearchQuery={setSubstituteSearchQuery}
            playerFilterPosition={playerFilterPosition}
            onSetPlayerFilterPosition={setPlayerFilterPosition}
          />
        )}
        {view === 'game-live' && showEndGameDialog && (
          <EndGameDialog
            gameName={gameName}
            score={`${Object.values(playerGoals).reduce((a, b) => a + b, 0)} - ${opponentGoals}`}
            saving={savingGame}
            onSave={saveAndEndGame}
            onDiscard={discardAndEndGame}
            onKeepPlaying={() => setShowEndGameDialog(false)}
          />
        )}
        {view === 'history' && (
          <HistoryView
            history={history}
            currentTeam={currentTeam}
            onImport={handleImportHistory}
            onExport={exportHistoryToCSV}
            onDelete={deleteGameHistory}
            onBack={() => setView(currentTeam ? 'team-detail' : 'home')}
          />
        )}
        {view === 'player-stats' && (
          <PlayerStatsView
            history={history}
            currentTeam={currentTeam}
            onBack={() => setView(currentTeam ? 'team-detail' : 'home')}
          />
        )}
        {view === 'manual' && <UserManual onBack={() => setView('home')} />}
        {view === 'admin' && isAdmin && (
          <AdminUsers onBack={() => setView('home')} currentEmail={currentEmail} />
        )}
      </div>
      <footer className="py-3 text-center text-xs text-gray-400">
        v{version} &copy; {new Date().getFullYear()} Alen Yokhanis
        <button
          onClick={() => setView('manual')}
          className="ml-4 text-blue-500 hover:underline inline-flex items-center gap-1"
        >
          <BookOpen size={12} /> User Manual
        </button>
        {isAdmin && (
          <button
            onClick={() => setView('admin')}
            className="ml-4 text-blue-500 hover:underline inline-flex items-center gap-1"
          >
            <ShieldCheck size={12} /> Manage access
          </button>
        )}
        <button
          onClick={() => neon.auth.signOut()}
          className="ml-4 text-blue-500 hover:underline"
        >
          Sign out
        </button>
      </footer>
    </div>
  );
}
