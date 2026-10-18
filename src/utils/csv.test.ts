import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  test('round-trips commas, quotes and line breaks inside fields', () => {
    const rows = [
      ['Name', 'Note'],
      ['Smith, John', 'said "hi"'],
      ['Multi', 'line\nnote'],
      ['Plain', '7'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  test('escapes quotes on export', () => {
    expect(toCsv([['a "b"', 1]])).toBe('"a ""b""","1"');
  });

  test('reads unquoted CSV with CRLF line endings, a BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  test('keeps empty fields', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });
});
