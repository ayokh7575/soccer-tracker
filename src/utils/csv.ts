// Minimal RFC 4180 CSV reading/writing: quoted fields may contain commas,
// line breaks and doubled quotes ("" for a literal ").

export const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 byte-order mark (Excel adds one).
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
};

const quote = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`;

export const toCsv = (rows: unknown[][]): string => rows.map(r => r.map(quote).join(',')).join('\n');
