import React from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { Player } from './types';

interface PlayerRowProps {
  player: Player;
  onRemove: (id: string) => void;
  onEdit: (player: Player) => void;
}

export const PlayerRow: React.FC<PlayerRowProps> = ({ player, onRemove, onEdit }) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded" data-testid="player-row">
      <div>
        <span className="font-semibold">#{player.number}</span>
        <span className="ml-3">{player.firstName} {player.lastName}</span>
        <span className="ml-3 text-sm bg-gray-200 px-2 py-1 rounded">{player.position}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Edit player"
          onClick={() => onEdit(player)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
        >
          <Edit2 size={16} />
        </button>
        <button
          type="button"
          aria-label="Remove player"
          onClick={() => onRemove(player.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};