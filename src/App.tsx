import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Plus, Trash2 } from 'lucide-react';

const POSITIONS = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'LW', 'RW', 'CF'];
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

export default function SoccerTimeTracker() {
  const [view, setView] = useState('home');
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [formation, setFormation] = useState('1-4-4-2');
  const [formationAssignments, setFormationAssignments] = useState({});
  const [gameName, setGameName] = useState('');
  const [gameState, setGameState] = useState('stopped');
  const [gameTime, setGameTime] = useState(0);
  const [playerTimes, setPlayerTimes] = useState({});
  const [activePlayerIds, setActivePlayerIds] = useState([]);
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState(null);
  
  const [teamNameInput, setTeamNameInput] = useState('');
  const [playerFirstName, setPlayerFirstName] = useState('');
  const [playerLastName, setPlayerLastName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [playerPosition, setPlayerPosition] = useState('');
  
  const gameIntervalRef = useRef(null);
  const activePlayerIdsRef = useRef([]);
  
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
            clearInterval(gameIntervalRef.current);
          }
          
          if (newTime === 80 * 60) {
            setGameState('finished');
            clearInterval(gameIntervalRef.current);
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateTeam = () => {
    if (teamNameInput.trim()) {
      const team = {
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
    if (playerFirstName && playerLastName && playerNumber && playerPosition) {
      const player = {
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

  const removePlayer = (playerId) => {
    const updated = { ...currentTeam, players: currentTeam.players.filter(p => p.id !== playerId) };
    setCurrentTeam(updated);
    saveTeam(updated);
  };

  const startGame = () => {
    if (!gameName.trim()) return;
    
    const slots = getFormationSlots();
    const allSlotsFilled = slots.every(slot => formationAssignments[slot]);
    
    if (!allSlotsFilled) return;
    
    const times = {};
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

  const handleDragStart = (e, playerId, fromSlot = null) => {
    setDraggedPlayer(playerId);
    setDraggedFromSlot(fromSlot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSlot = (e, slotKey) => {
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

  const handleDropOnBench = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPlayer || !draggedFromSlot) {
      return;
    }

    const newAssignments = {};
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

  const getFormationSlots = () => {
    const layout = FORMATION_LAYOUTS[formation];
    return Object.keys(layout);
  };

  const getSlotDisplayName = (slotKey) => {
    return slotKey.replace(/2$/, '');
  };

  const getPlayerById = (id) => {
    if (!id) return null;
    return currentTeam?.players.find(p => p.id === id) || null;
  };

  const getPlayerDisplayName = (player) => {
    const firstInitial = player.firstName.charAt(0).toUpperCase();
    return `${firstInitial}. ${player.lastName}`;
  };

  const getSubstitutes = () => {
    const assignedPlayerIds = Object.values(formationAssignments).filter(Boolean);
    return currentTeam?.players.filter(p => !assignedPlayerIds.includes(p.id)) || [];
  };

  const autoAssignPlayers = () => {
    const slots = getFormationSlots();
    const newAssignments = {};
    const usedPlayerIds = new Set();
    
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

  const renderHome = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Soccer Time Tracker</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Create New Team</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={teamNameInput}
            onChange={(e) => setTeamNameInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
            placeholder="Team name"
            className="flex-1 px-4 py-2 border rounded"
          />
          <button 
            onClick={handleCreateTeam}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create
          </button>
        </div>
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
      <button onClick={() => setView('home')} className="mb-4 text-blue-600 hover:underline">
        ← Back to Teams
      </button>
      
      <h1 className="text-3xl font-bold mb-6">{currentTeam.name}</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Add Player</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
          <button 
            onClick={handleAddPlayer}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Plus size={18} className="inline mr-1" /> Add
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Players ({currentTeam.players.length})</h2>
        {currentTeam.players.length === 0 ? (
          <p className="text-gray-500">No players yet. Add some above!</p>
        ) : (
          <div className="space-y-2">
            {currentTeam.players.map(player => (
              <div key={player.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-semibold">#{player.number}</span>
                  <span className="ml-3">{player.firstName} {player.lastName}</span>
                  <span className="ml-3 text-sm bg-gray-200 px-2 py-1 rounded">{player.position}</span>
                </div>
                <button
                  onClick={() => removePlayer(player.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentTeam.players.length > 0 && (
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
    const layout = FORMATION_LAYOUTS[formation];
    const assignedPlayerIds = Object.values(formationAssignments);
    const unassignedPlayers = currentTeam.players.filter(p => !assignedPlayerIds.includes(p.id));

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={() => setView('team-detail')} className="mb-4 text-blue-600 hover:underline">
          ← Back to Team
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
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnSlot(e, slot)}
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
            <h2 className="font-semibold mb-3">Available Players</h2>
            <div 
              className="flex flex-wrap gap-3 min-h-[200px] p-3 border-2 border-dashed rounded-lg"
              onDragOver={handleDragOver}
              onDrop={handleDropOnBench}
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
          <h2 className="font-semibold mb-2">Game Name:</h2>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Enter game name..."
            className="w-full px-4 py-2 border rounded mb-4"
          />
          
          <button
            onClick={startGame}
            disabled={!gameName.trim() || !getFormationSlots().every(slot => formationAssignments[slot])}
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

  const renderGameLive = () => {
    const layout = FORMATION_LAYOUTS[formation];
    const slots = getFormationSlots();
    const substitutes = getSubstitutes();

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{gameName}</h1>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock size={24} />
              {formatTime(gameTime)}
              {gameTime >= 2400 && gameTime < 4800 && <span className="text-sm">(2nd Half)</span>}
            </div>
            <div className="flex gap-2">
              {gameState !== 'finished' && (
                <button
                  onClick={togglePlayPause}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {gameState === 'playing' ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}
              <button
                onClick={cancelGame}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Square size={18} />
              </button>
            </div>
          </div>
        </div>

        {gameState === 'finished' && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded text-center font-semibold">
            Game Finished!
          </div>
        )}

        {gameTime === 2400 && gameState === 'paused' && (
          <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded text-center font-semibold">
            Half Time - Press play to start second half
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h2 className="font-semibold mb-3">Playing XI - Drag to substitute</h2>
            <div className="relative bg-green-600 rounded-lg" style={{ height: '600px' }}>
              {slots.map(slot => {
                const pos = layout[slot];
                const playerId = formationAssignments[slot];
                const player = playerId ? getPlayerById(playerId) : null;
                const displayName = getSlotDisplayName(slot);

                return (
                  <div
                    key={slot}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnSlot(e, slot)}
                  >
                    {player ? (
                      <div
                        draggable={gameState !== 'finished'}
                        onDragStart={(e) => handleDragStart(e, player.id, slot)}
                        className="bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg cursor-move hover:shadow-xl"
                      >
                        <div className="font-bold text-lg">#{player.number}</div>
                        <div className="text-xs text-center px-1">{getPlayerDisplayName(player)}</div>
                        <div className="text-xs font-semibold text-blue-600">
                          {formatTime(playerTimes[player.id] || 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white bg-opacity-50 rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg border-2 border-dashed border-white">
                        <div className="text-gray-600 text-sm font-bold">{displayName}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Substitutes - Drag to pitch</h2>
            <div 
              className="flex flex-wrap gap-3 p-3 border-2 border-dashed rounded-lg min-h-[200px]"
              onDragOver={handleDragOver}
              onDrop={handleDropOnBench}
            >
              {substitutes.map(player => (
                <div
                  key={player.id}
                  draggable={gameState !== 'finished'}
                  onDragStart={(e) => handleDragStart(e, player.id, null)}
                  className="bg-gray-100 rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg cursor-move hover:shadow-xl"
                >
                  <div className="font-bold text-lg">#{player.number}</div>
                  <div className="text-xs text-center px-1">{getPlayerDisplayName(player)}</div>
                  <div className="text-xs font-bold text-gray-700">{player.position}</div>
                  <div className="text-xs font-semibold text-gray-500">
                    {formatTime(playerTimes[player.id] || 0)}
                  </div>
                </div>
              ))}
              {substitutes.length === 0 && (
                <p className="text-gray-400 text-center text-sm py-8 w-full">No substitutes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {view === 'home' && renderHome()}
      {view === 'team-detail' && renderTeamDetail()}
      {view === 'formation' && renderFormation()}
      {view === 'game-live' && renderGameLive()}
    </div>
  );
}
