// Turns raw Data API / Postgres errors into something a coach can act on.
export const friendlyError = (err: any, fallback = 'Something went wrong. Please try again.'): string => {
  const message = String(err?.message ?? err ?? '');
  const code = String(err?.code ?? '');

  // Row-Level Security rejected the row: the account is not on the allowlist.
  if (
    code === '42501' ||
    /row-level security|insufficient privilege|permission denied/i.test(message)
  ) {
    return 'Your account does not have access to this app. Ask the administrator to add your email address.';
  }

  if (/authentication required|jwt|token|unauthorized/i.test(message)) {
    return 'Your session has expired. Please sign out and sign in again.';
  }

  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  return fallback;
};
