import React from 'react';
import { Trash2, Edit2, Ban, XCircle } from 'lucide-react';
import { Player } from './types';

interface PlayerRowProps {
  player: Player;
  onRemove: (id: string) => void;
  onEdit: (player: Player) => void;
  onToggleAvailability: (player: Player) => void;
}

export const PlayerRow: React.FC<PlayerRowProps> = ({ player, onRemove, onEdit, onToggleAvailability }) => {
  return (
    <div className={`flex items-center justify-between p-3 border rounded ${player.isUnavailable ? 'bg-gray-100' : ''}`} data-testid="player-row">
      <div className={player.isUnavailable ? 'opacity-50' : ''}>
        <span className="font-semibold">#{player.number}</span>
        <span className="ml-3">{player.firstName} {player.lastName}</span>
        <span className="ml-3 text-sm bg-gray-200 px-2 py-1 rounded">{player.position}</span>
        {player.isUnavailable && <span className="ml-2 text-xs text-red-600 font-semibold">(Unavailable)</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={player.isUnavailable ? "Mark as available" : "Mark as unavailable"}
          onClick={() => onToggleAvailability(player)}
          className={`p-2 rounded ${player.isUnavailable ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
          title={player.isUnavailable ? "Mark as available" : "Mark as unavailable"}
        >
          {player.isUnavailable ? <XCircle size={16} /> : <Ban size={16} />}
        </button>
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