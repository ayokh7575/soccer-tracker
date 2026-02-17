import React, { useState, DragEvent } from 'react';

interface UseDragAndDropProps {
  formationAssignments: Record<string, string>;
  setFormationAssignments: (assignments: Record<string, string>) => void;
  activePlayerIds: string[];
  setActivePlayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  view: string;
  maxPlayersOnField?: number;
}

export const useDragAndDrop = ({
  formationAssignments,
  setFormationAssignments,
  activePlayerIds,
  setActivePlayerIds,
  view,
  maxPlayersOnField
}: UseDragAndDropProps) => {
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent, playerId: string, fromSlot: string | null = null) => {
    setDraggedPlayer(playerId);
    setDraggedFromSlot(fromSlot);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ playerId, sourceSlot: fromSlot }));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (e: DragEvent, slotKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPlayer) return;

    const currentPlayerInSlot = formationAssignments[slotKey];
    
    // Check if adding from bench to empty slot would exceed limit
    if (!draggedFromSlot && !currentPlayerInSlot && maxPlayersOnField !== undefined) {
      const currentCount = Object.keys(formationAssignments).length;
      if (currentCount >= maxPlayersOnField) {
        window.alert(`Cannot add player. Team is down to ${maxPlayersOnField} players due to red card(s).`);
        setDraggedPlayer(null);
        setDraggedFromSlot(null);
        return;
      }
    }

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

  const handleDropOnBench = (e: DragEvent) => {
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

  return {
    draggedPlayer,
    draggedFromSlot,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDropOnSlot,
    handleDropOnBench
  };
};