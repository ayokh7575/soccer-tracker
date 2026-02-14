import React from 'react';
import { Trash2 } from 'lucide-react';
import { Player } from '../types';

interface PlayerRowProps {
  player: Player;
  onRemove: (id: string) => void;
}

export const PlayerRow: React.FC<PlayerRowProps> = ({ player, onRemove }) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded">
      <div>
        <span className="font-semibold">#{player.number}</span>
        <span className="ml-3">{player.firstName} {player.lastName}</span>
        <span className="ml-3 text-sm bg-gray-200 px-2 py-1 rounded">{player.position}</span>
      </div>
      <button
        onClick={() => onRemove(player.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};