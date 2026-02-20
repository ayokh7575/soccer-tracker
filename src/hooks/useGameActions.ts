import { useState } from 'react';
import { Player, Team, GameAction } from '../types';

interface UseGameActionsProps {
  currentTeam: Team | null;
  formationAssignments: Record<string, string>;
  setFormationAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActivePlayerIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useGameActions = ({
  currentTeam,
  formationAssignments,
  setFormationAssignments,
  setActivePlayerIds,
}: UseGameActionsProps) => {
  const [playerGoals, setPlayerGoals] = useState<Record<string, number>>({});
  const [playerRedCards, setPlayerRedCards] = useState<Record<string, number>>({});
  const [actionHistory, setActionHistory] = useState<GameAction[]>([]);

  const getPlayerById = (id: string) => {
    if (!id) return null;
    return currentTeam?.players.find(p => p.id === id) || null;
  };

  const getPlayerDisplayName = (player: Player) => {
    const firstInitial = player.firstName.charAt(0).toUpperCase();
    return `${firstInitial}. ${player.lastName}`;
  };

  const handleGoal = (playerId: string, playerName: string) => {
    if (window.confirm(`Goal scored by ${playerName}?`)) {
      setPlayerGoals(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + 1
      }));
      setActionHistory(prev => [...prev, { type: 'goal', playerId }]);
    }
  };

  const handleRedCard = (playerId: string, playerName: string) => {
    if (window.confirm(`Give Red Card to ${playerName}? Player will be sent to bench and cannot return.`)) {
      setPlayerRedCards(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + 1
      }));

      // Remove from pitch
      const slot = Object.keys(formationAssignments).find(key => formationAssignments[key] === playerId);
      if (slot) {
        const newAssignments = { ...formationAssignments };
        delete newAssignments[slot];
        setFormationAssignments(newAssignments);
      }

      setActivePlayerIds(prev => prev.filter(id => id !== playerId));
      setActionHistory(prev => [...prev, { type: 'redCard', playerId, fromSlot: slot }]);
    }
  };

  const handleUndoAction = () => {
    if (actionHistory.length === 0) return;
    
    const lastAction = actionHistory[actionHistory.length - 1];
    const player = getPlayerById(lastAction.playerId);
    
    if (!player) return;

    if (lastAction.type === 'goal') {
      if (window.confirm(`Undo last goal by ${getPlayerDisplayName(player)}?`)) {
        setPlayerGoals(prev => ({
          ...prev,
          [lastAction.playerId]: Math.max(0, (prev[lastAction.playerId] || 0) - 1)
        }));
        setActionHistory(prev => prev.slice(0, -1));
      }
    } else if (lastAction.type === 'redCard') {
      if (window.confirm(`Undo red card for ${getPlayerDisplayName(player)}?`)) {
        setPlayerRedCards(prev => ({
          ...prev,
          [lastAction.playerId]: Math.max(0, (prev[lastAction.playerId] || 0) - 1)
        }));
        if (lastAction.fromSlot && !formationAssignments[lastAction.fromSlot]) {
          setFormationAssignments(prev => ({ ...prev, [lastAction.fromSlot!]: lastAction.playerId }));
          setActivePlayerIds(prev => [...prev, lastAction.playerId]);
        }
        setActionHistory(prev => prev.slice(0, -1));
      }
    }
  };

  const initializeGameActions = (initialGoals: Record<string, number>, initialRedCards: Record<string, number>) => {
    setPlayerGoals(initialGoals);
    setPlayerRedCards(initialRedCards);
    setActionHistory([]);
  };

  return {
    playerGoals,
    playerRedCards,
    actionHistory,
    handleGoal,
    handleRedCard,
    handleUndoAction,
    initializeGameActions
  };
};