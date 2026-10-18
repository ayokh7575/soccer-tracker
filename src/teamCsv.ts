import { Player } from './types';
import { parseCsv } from './utils/csv';

// Team CSV: First Name, Last Name, Number, Position, Secondary Positions...
// Secondary positions may be extra columns or one column split by ':' or ';'.
// A header row is skipped if present.
export const parseTeamCsv = (content: string): Player[] => {
  const rows = parseCsv(content);
  const first = (rows[0] ?? []).join(',').toLowerCase();
  const start = first.includes('first name') || first.includes('firstname') ? 1 : 0;

  const players: Player[] = [];
  for (const raw of rows.slice(start)) {
    const parts = raw.map(p => p.trim());
    if (parts.length < 3) continue;
    const [firstName, lastName, number, position = 'SUB', ...secondaryParts] = parts;
    if (!firstName || !lastName || !number) continue;
    players.push({
      id: crypto.randomUUID(),
      firstName,
      lastName,
      number,
      position: position || 'SUB',
      secondaryPositions: secondaryParts.flatMap(p => p.split(/[:;]/)).map(p => p.trim()).filter(Boolean),
      isUnavailable: false,
    });
  }
  return players;
};
