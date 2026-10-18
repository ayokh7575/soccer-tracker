import React from 'react';
import { Upload, Download } from 'lucide-react';
import { Team } from '../types';
import { GameRecord } from '../hooks/useGameHistory';
import { formatTime } from '../utils/format';

interface HistoryViewProps {
  history: GameRecord[];
  // When set, only this team's games are shown.
  currentTeam: Team | null;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: (games: GameRecord[]) => void;
  onDelete: (gameId: string) => void;
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history, currentTeam, onImport, onExport, onDelete, onBack,
}) => {
  const displayedHistory = currentTeam 
    ? history.filter(game => game.teamName === currentTeam.name)
    : history;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{currentTeam ? `${currentTeam.name} History` : 'Game History'}</h1>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-blue-600 hover:underline cursor-pointer">
            <Upload size={20} /> Import CSV
            <input type="file" accept=".csv" onChange={onImport} className="hidden" />
          </label>
          {displayedHistory.length > 0 && (
            <button
              onClick={() => onExport(displayedHistory)}
              className="flex items-center gap-2 text-green-600 hover:underline"
            >
              <Download size={20} /> Export CSV
            </button>
          )}
          <button onClick={onBack} className="text-blue-600 hover:underline">
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
                  <p className="text-lg font-bold mt-1">
                    Score: {game.teamScore} - {game.opponentScore}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-xl text-blue-600">
                    {formatTime(game.totalTime)}
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm('Delete this record?')) {
                        onDelete(game.id);
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
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${stat.time > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatTime(stat.time)}
                        </span>
                        {stat.goals > 0 && (
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">⚽ {stat.goals}</span>
                        )}
                        {/* Show yellow cards if they exist and didn't result in the red card shown */}
                        {(stat.yellowCards || 0) > 0 && !((stat.redCards || 0) > 0 && (stat.yellowCards || 0) === 2) && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">🟨</span>
                        )}
                        {/* Show red card */}
                        {(stat.redCards || 0) > 0 && ((stat.yellowCards || 0) === 2 ? (
                            <span className="flex flex-col gap-0.5" title="2nd Yellow Card">
                              <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-1.5 py-0.5 rounded-full">🟨</span>
                              <span className="bg-red-100 text-red-800 text-xs font-bold px-1.5 py-0.5 rounded-full">🟥</span>
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">🟥</span>
                          )
                        )}
                      </div>
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
