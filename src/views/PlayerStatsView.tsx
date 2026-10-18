import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Team } from '../types';
import { GameRecord } from '../hooks/useGameHistory';
import { formatTime } from '../utils/format';

interface PlayerStatsViewProps {
  history: GameRecord[];
  // When set, only this team's players are shown.
  currentTeam: Team | null;
  onBack: () => void;
}

// Season totals per player, built from the saved game history.
export const PlayerStatsView: React.FC<PlayerStatsViewProps> = ({ history, currentTeam, onBack }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalTime', direction: 'desc' });

  const statsMap: Record<string, { id: string; name: string; number: string; totalTime: number; gamesPlayed: number; totalGoals: number; totalRedCards: number; totalYellowCards: number; avgTime: number }> = {};

  history.forEach(game => {
    game.playerStats.forEach(p => {
      if (!statsMap[p.id]) {
        statsMap[p.id] = { id: p.id, name: p.name, number: p.number, totalTime: 0, gamesPlayed: 0, totalGoals: 0, totalRedCards: 0, totalYellowCards: 0, avgTime: 0 };
      }
      statsMap[p.id].totalTime += p.time;
      statsMap[p.id].totalGoals += (p.goals || 0);
      statsMap[p.id].totalRedCards += (p.redCards || 0);
      statsMap[p.id].totalYellowCards += (p.yellowCards || 0);
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
        <button onClick={onBack} className="text-blue-600 hover:underline">
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
                  onClick={() => requestSort('totalYellowCards')}
                >
                  <div className="flex items-center gap-1">Yellow Cards <SortIcon column="totalYellowCards" /></div>
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
                    {stat.totalYellowCards}
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
