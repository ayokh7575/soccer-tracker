import { historyToCsv, parseHistoryCsv } from './historyCsv';
import { GameRecord } from './hooks/useGameHistory';

const game: GameRecord = {
  id: 'g1',
  date: '2026-03-16T00:00:00.000Z',
  name: 'Round 3, vs "Reds"',
  teamName: 'U16 NCFC',
  teamScore: 2,
  opponentScore: 1,
  totalTime: 4800,
  playerStats: [
    { id: 'p1', name: "O'Brien, Sam", number: '7', time: 2700, goals: 2, redCards: 0, yellowCards: 1 },
    { id: 'p2', name: 'Lee Kim', number: '9', time: 0, goals: 0, redCards: 0, yellowCards: 0 },
  ],
};

describe('history CSV', () => {
  test('export then import keeps names containing commas and quotes intact', () => {
    const parsed = parseHistoryCsv(historyToCsv([game]));
    expect(parsed).toHaveLength(1);
    const g = parsed![0];
    expect(g.name).toBe('Round 3, vs "Reds"');
    expect(g.teamName).toBe('U16 NCFC');
    expect(g.teamScore).toBe(2);
    expect(g.opponentScore).toBe(1);
    expect(g.totalTime).toBe(4800);
    expect(g.playerStats.map(s => [s.name, s.number, s.time, s.goals, s.yellowCards])).toEqual([
      ["O'Brien, Sam", '7', 2700, 2, 1],
      ['Lee Kim', '9', 0, 0, 0],
    ]);
  });

  test('parses DD/MM/YYYY dates', () => {
    const csv = 'Date,Game Name,Team Name,Score,Total Game Time,Player Name,Player Number,Player Time,Goals,Red Cards,Yellow Cards\n' +
      '16/03/2026,G1,T,1-0,80:00,A B,4,10:00,0,0,0';
    expect(parseHistoryCsv(csv)![0].date).toBe('2026-03-16T00:00:00.000Z');
  });

  test('returns null for a file with no data rows', () => {
    expect(parseHistoryCsv('Date,Game Name')).toBeNull();
  });
});
