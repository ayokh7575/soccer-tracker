import { friendlyError } from './errors';

describe('friendlyError', () => {
  test('explains an allowlist (RLS) rejection by Postgres error code', () => {
    expect(friendlyError({ code: '42501', message: 'permission denied for table teams' }))
      .toMatch(/does not have access/i);
  });

  test('explains an allowlist rejection by message text', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "teams"' }))
      .toMatch(/does not have access/i);
  });

  test('explains an expired session', () => {
    expect(friendlyError({ message: 'Authentication required. A valid token is needed.' }))
      .toMatch(/session has expired/i);
  });

  test('explains a network failure', () => {
    expect(friendlyError({ message: 'TypeError: Failed to fetch' }))
      .toMatch(/could not reach the server/i);
  });

  test('falls back to the supplied message for unknown errors', () => {
    expect(friendlyError({ message: 'something odd' }, 'Could not save the team. Please try again.'))
      .toBe('Could not save the team. Please try again.');
  });

  test('handles null/undefined errors without throwing', () => {
    expect(friendlyError(null)).toBeTruthy();
    expect(friendlyError(undefined)).toBeTruthy();
  });
});
