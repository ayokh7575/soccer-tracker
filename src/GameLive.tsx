import React from 'react';
import { Play, Pause, Square, Clock, Undo2 } from 'lucide-react';
import { Player, GameAction } from './types';

interface GameLiveProps {
  gameName: string;
  gameDuration: number;
  gameTime: number;
  gameState: string;
  actionHistory: GameAction[];
  formation: string;
  formationAssignments: Record<string, string>;
  setFormationAssignments: (assignments: Record<string, string>) => void;
  playerTimes: Record<string, number>;
  playerGoals: Record<string, number>;
  playerRedCards: Record<string, number>;
  playersToSubIn: string[];
  playersToSubOut: string[];
  selectedPlayerForAction: { id: string; name: string } | null;
  setSelectedPlayerForAction: (value: { id: string; name: string } | null) => void;
  dragOverTarget: string | null;
  setDragOverTarget: (target: string | null) => void;
  draggedPlayerId: string | null;
  setDraggedPlayerId: (id: string | null) => void;
  isDragging: React.MutableRefObject<boolean>;
  
  onUndoAction: () => void;
  onTogglePlayPause: () => void;
  onEndGame: () => void;
  onGoal: (playerId: string, playerName: string) => void;
  onRedCard: (playerId: string, playerName: string) => void;
  onFieldPlayerClick: (player: Player) => void;
  onBenchPlayerClick: (playerId: string) => void;
  onCancelSubstitution: () => void;
  onPerformSubstitution: () => void;
  
  handleDragStart: (e: React.DragEvent, playerId: string, sourceSlot: string | null) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnterZone: (e: React.DragEvent, targetId: string) => void;
  handleDragLeaveZone: (e: React.DragEvent) => void;
  customHandleDropOnSlot: (e: React.DragEvent, slot: string) => void;
  handleDropOnBench: (e: React.DragEvent) => void;
  
  formatTime: (seconds: number) => string;
  getPlayerDisplayName: (player: Player) => string;
  getSlotDisplayName: (slotKey: string) => string;
  getPlayerById: (id: string) => Player | null;
  getFormationSlots: () => string[];
  getSubstitutes: () => Player[];
  formationLayouts: any;

  substituteSortKey: 'number' | 'position';
  onSetSubstituteSortKey: (key: 'number' | 'position') => void;
}

export const GameLive: React.FC<GameLiveProps> = ({
  gameName,
  gameDuration,
  gameTime,
  gameState,
  actionHistory,
  formation,
  formationAssignments,
  setFormationAssignments,
  playerTimes,
  playerGoals,
  playerRedCards,
  playersToSubIn,
  playersToSubOut,
  selectedPlayerForAction,
  setSelectedPlayerForAction,
  dragOverTarget,
  setDragOverTarget,
  draggedPlayerId,
  setDraggedPlayerId,
  isDragging,
  onUndoAction,
  onTogglePlayPause,
  onEndGame,
  onGoal,
  onRedCard,
  onFieldPlayerClick,
  onBenchPlayerClick,
  onCancelSubstitution,
  onPerformSubstitution,
  handleDragStart,
  handleDragOver,
  handleDragEnterZone,
  handleDragLeaveZone,
  customHandleDropOnSlot,
  handleDropOnBench,
  formatTime,
  getPlayerDisplayName,
  getSlotDisplayName,
  getPlayerById,
  getFormationSlots,
  getSubstitutes,
  formationLayouts,
  substituteSortKey,
  onSetSubstituteSortKey,
}) => {
  const layout = formationLayouts[formation];
  const slots = getFormationSlots();
  const substitutes = getSubstitutes();
  const halfTimeSeconds = (gameDuration / 2) * 60;
  const fullTimeSeconds = gameDuration * 60;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{gameName}</h1>
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold flex items-center gap-2" data-testid="game-timer">
            <Clock size={24} />
            {formatTime(gameTime)}
            {gameTime >= halfTimeSeconds && gameTime < fullTimeSeconds && <span className="text-sm">(2nd Half)</span>}
          </div>
          <div className="flex gap-2">
            {gameState !== 'finished' && (
              <>
                {actionHistory.length > 0 && (
                  <button
                    onClick={onUndoAction}
                    aria-label="Undo Last Action"
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    <Undo2 size={18} />
                  </button>
                )}
                <button
                  onClick={onTogglePlayPause}
                  aria-label="Toggle Timer"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {gameState === 'playing' ? <Pause size={18} /> : <Play size={18} />}
                </button>
              </>
            )}
            <button
              onClick={onEndGame}
              aria-label="End Game"
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

      {gameTime === halfTimeSeconds && gameState === 'paused' && (
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
                  data-testid="player-slot"
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${dragOverTarget === slot ? 'scale-110 ring-4 ring-yellow-400 rounded-full z-10' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnterZone(e, slot)}
                  onDragLeave={handleDragLeaveZone}
                  onDrop={(e) => {
                    setDraggedPlayerId(null);
                    setDragOverTarget(null);
                    customHandleDropOnSlot(e, slot);
                    isDragging.current = false;
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (player && gameState !== 'finished' && playersToSubIn.length === 0) {
                      setSelectedPlayerForAction({ id: player.id, name: getPlayerDisplayName(player) });
                    }
                  }}
                  onClick={(e) => {
                    if (player) {
                      onFieldPlayerClick(player);
                    }
                  }}
                >
                  {player ? (
                    <div
                      draggable={gameState !== 'finished' && playersToSubIn.length === 0}
                      onDragStart={(e) => {
                        isDragging.current = true;
                        setDraggedPlayerId(player.id);
                        handleDragStart(e, player.id, slot);
                      }}
                      onDragEnd={() => {
                        isDragging.current = false;
                        setDraggedPlayerId(null);
                      }}
                      className={`bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg cursor-pointer hover:shadow-xl ${player.id === draggedPlayerId ? 'ring-4 ring-blue-400 opacity-75' : ''} ${playersToSubOut.includes(player.id) ? 'ring-4 ring-red-500' : ''}`}
                    >
                      <div className="font-bold text-lg">#{player.number}</div>
                      <div className="text-xs text-center px-1">{getPlayerDisplayName(player)}</div>
                      <div className="text-xs font-semibold text-blue-600">
                        {formatTime(playerTimes[player.id] || 0)}
                      </div>
                      {(playerGoals[player.id] || 0) > 0 && (
                        <div className="absolute -top-2 -right-2 bg-yellow-400 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border border-white shadow-sm">⚽ {playerGoals[player.id]}</div>
                      )}
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
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Substitutes - Drag to pitch</h2>
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button 
                onClick={() => onSetSubstituteSortKey('number')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${substituteSortKey === 'number' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Number
              </button>
              <button 
                onClick={() => onSetSubstituteSortKey('position')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${substituteSortKey === 'position' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Position
              </button>
            </div>
          </div>
          <div 
            className={`flex flex-wrap gap-3 p-3 border-2 border-dashed rounded-lg min-h-[200px] transition-colors duration-200 ${dragOverTarget === 'bench' ? 'bg-blue-50 border-blue-500' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnterZone(e, 'bench')}
            onDragLeave={handleDragLeaveZone}
            onDrop={(e) => {
              const targetElement = e.target as HTMLElement;
              const playerDiv = targetElement.closest(`[data-player-id]`);
              const targetBenchPlayerId = playerDiv?.getAttribute('data-player-id');
            
              let dropOnBenchHandled = false;
              // If dropped on a specific player, perform swap
              if (targetBenchPlayerId) {
                try {
                  const draggedData = e.dataTransfer.getData("application/json");
                  if (draggedData) {
                    const { sourceSlot } = JSON.parse(draggedData);
                    // Check if dragging from field to bench player
                    if (sourceSlot) {
                      const newAssignments = { ...formationAssignments };
                      newAssignments[sourceSlot] = targetBenchPlayerId;
                      setFormationAssignments(newAssignments);
                      dropOnBenchHandled = true;
                    }
                  }
                } catch (error) { /* safety fallback */ }
              }
              
              // If not a player-on-player swap, use the default bench drop
              if (!dropOnBenchHandled) {
                handleDropOnBench(e);
              }
              
              // Reset states for any drop on the bench area
              setDraggedPlayerId(null);
              setDragOverTarget(null);
              isDragging.current = false;
            }}
          >
            {substitutes.map(player => {
              const hasRedCard = (playerRedCards[player.id] || 0) > 0;
              return (
              <div
                key={player.id}
                data-player-id={player.id}
                onDragOver={handleDragOver}
                onDragEnter={(e) => { e.stopPropagation(); handleDragEnterZone(e, player.id); }}
                onDragLeave={(e) => { e.stopPropagation(); handleDragLeaveZone(e); }}
                onClick={() => onBenchPlayerClick(player.id)}
                draggable={gameState !== 'finished' && !hasRedCard && playersToSubIn.length === 0}
                onDragStart={(e) => {
                  isDragging.current = true;
                  setDraggedPlayerId(player.id);
                  handleDragStart(e, player.id, null);
                }}
                onDragEnd={() => {
                  isDragging.current = false;
                  setDraggedPlayerId(null);
                }}
                className={`relative bg-gray-100 rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 ${player.id === draggedPlayerId ? 'ring-4 ring-blue-400 opacity-75' : ''} ${dragOverTarget === player.id ? 'ring-4 ring-yellow-400 scale-110' : ''} ${playersToSubIn.includes(player.id) ? 'ring-4 ring-green-500' : ''}`}
              >
                <div className="font-bold text-lg">#{player.number}</div>
                <div className="text-xs text-center px-1">{getPlayerDisplayName(player)}</div>
                <div className="text-xs font-bold text-gray-700">{player.position}</div>
                <div className="text-xs font-semibold text-gray-500">
                  {formatTime(playerTimes[player.id] || 0)}
                </div>
                {(playerGoals[player.id] || 0) > 0 && (
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border border-white shadow-sm">⚽ {playerGoals[player.id]}</div>
                )}
                {hasRedCard && (
                  <div className="absolute -top-2 -left-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border border-white shadow-sm">🟥</div>
                )}
              </div>
            )})}
            {substitutes.length === 0 && (
              <p className="text-gray-400 text-center text-sm py-8 w-full">No substitutes</p>
            )}
          </div>
        </div>
      </div>

      {playersToSubIn.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-4">
          <button
            onClick={onCancelSubstitution}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg shadow-lg hover:bg-gray-600 font-semibold"
          >
            Cancel
          </button>
          {playersToSubIn.length > 0 && playersToSubIn.length === playersToSubOut.length && (
            <button
              onClick={onPerformSubstitution}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 font-semibold"
            >
              Substitute ({playersToSubIn.length})
            </button>
          )}
        </div>
      )}

      {selectedPlayerForAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedPlayerForAction(null)}>
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-center">Action for {selectedPlayerForAction.name}</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  onGoal(selectedPlayerForAction.id, selectedPlayerForAction.name);
                  setSelectedPlayerForAction(null);
                }}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center justify-center gap-2"
              >
                ⚽ Goal
              </button>
              <button
                onClick={() => {
                  onRedCard(selectedPlayerForAction.id, selectedPlayerForAction.name);
                  setSelectedPlayerForAction(null);
                }}
                className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
              >
                🟥 Red Card
              </button>
              <button
                onClick={() => setSelectedPlayerForAction(null)}
                className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};