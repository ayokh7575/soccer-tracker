import { parseTeamCsv } from './teamCsv';

describe('parseTeamCsv', () => {
  test('skips the header and reads secondary positions from extra columns or ":" lists', () => {
    const players = parseTeamCsv(
      'First Name,Last Name,Number,Position,Secondary\n' +
      'Sam,Smith,7,CM,RM:AM\n' +
      'Jo,Lee,1,GK\n' +
      'Alex,Ng,9,CF,LW,RW\n'
    );
    expect(players.map(p => [p.firstName, p.number, p.position, p.secondaryPositions])).toEqual([
      ['Sam', '7', 'CM', ['RM', 'AM']],
      ['Jo', '1', 'GK', []],
      ['Alex', '9', 'CF', ['LW', 'RW']],
    ]);
  });

  test('handles quoted names containing commas', () => {
    const [p] = parseTeamCsv('"Mary, Jane",Doe,4,CB');
    expect(p.firstName).toBe('Mary, Jane');
    expect(p.lastName).toBe('Doe');
  });

  test('defaults a missing position to SUB and ignores incomplete rows', () => {
    const players = parseTeamCsv('Sam,Smith,7\nNo,Number\n');
    expect(players).toHaveLength(1);
    expect(players[0].position).toBe('SUB');
  });
});
