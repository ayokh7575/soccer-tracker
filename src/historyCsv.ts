import { GameRecord } from './hooks/useGameHistory';
import { parseCsv, toCsv } from './utils/csv';
import { formatTime, parseTime } from './utils/format';

export const HISTORY_CSV_HEADERS = [
  'Date', 'Game Name', 'Team Name', 'Score', 'Total Game Time',
  'Player Name', 'Player Number', 'Player Time', 'Goals', 'Red Cards', 'Yellow Cards',
];

// One row per player per game.
export const historyToCsv = (games: GameRecord[]): string =>
  toCsv([
    HISTORY_CSV_HEADERS,
    ...games.flatMap(game =>
      game.playerStats.map(stat => [
        new Date(game.date).toLocaleDateString(),
        game.name,
        game.teamName,
        `${game.teamScore}-${game.opponentScore}`,
        formatTime(game.totalTime),
        stat.name,
        stat.number,
        formatTime(stat.time),
        stat.goals || 0,
        stat.redCards || 0,
        stat.yellowCards || 0,
      ])
    ),
  ]);

// Parses DD/MM/YYYY (what the export produces in Australia), falling back to
// the browser's own date parsing, then to today.
const parseDate = (date: string): string => {
  const ddmmyyyy = date.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`).toISOString();
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

// Returns null if the file isn't a usable history CSV at all.
export const parseHistoryCsv = (content: string): GameRecord[] | null => {
  const rows = parseCsv(content);
  if (rows.length < 2) return null;

  const headers = rows[0].map(h => h.trim());
  const col = (row: string[], name: string) => (row[headers.indexOf(name)] ?? '').trim();
  const gameMap = new Map<string, GameRecord>();

  for (const cells of rows.slice(1)) {
    const date = col(cells, 'Date');
    const gameName = col(cells, 'Game Name');
    const teamName = col(cells, 'Team Name');
    const score = col(cells, 'Score');
    const totalTime = col(cells, 'Total Game Time');
    const playerNumber = col(cells, 'Player Number');
    if (!gameName) continue;

    const gameKey = `${date}|${gameName}|${teamName}|${score}|${totalTime}`;
    if (!gameMap.has(gameKey)) {
      const [teamScore, opponentScore] = score.split('-').map(n => parseInt(n) || 0);
      gameMap.set(gameKey, {
        id: crypto.randomUUID(),
        date: parseDate(date),
        name: gameName,
        teamName,
        teamScore: teamScore ?? 0,
        opponentScore: opponentScore ?? 0,
        totalTime: parseTime(totalTime),
        playerStats: [],
      });
    }

    if (playerNumber) {
      gameMap.get(gameKey)!.playerStats.push({
        id: crypto.randomUUID(),
        name: col(cells, 'Player Name'),
        number: playerNumber,
        time: parseTime(col(cells, 'Player Time')),
        goals: parseInt(col(cells, 'Goals')) || 0,
        redCards: parseInt(col(cells, 'Red Cards')) || 0,
        yellowCards: parseInt(col(cells, 'Yellow Cards')) || 0,
      });
    }
  }

  return Array.from(gameMap.values());
};
