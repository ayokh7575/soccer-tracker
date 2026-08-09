import { useState, useEffect, useCallback } from 'react';
import { neon } from '../neonClient';
import { friendlyError } from '../errors';

export interface AllowedEmail {
  email: string;
  note: string | null;
  isAdmin: boolean;
  addedAt: string;
}

const rowToEntry = (r: any): AllowedEmail => ({
  email: r.email,
  note: r.note ?? null,
  isAdmin: r.is_admin ?? false,
  addedAt: r.added_at,
});

// Reads and edits the access list. Every query is additionally restricted by
// RLS to admins, so a non-admin simply sees an empty list and cannot write.
export const useAllowedEmails = () => {
  const [entries, setEntries] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await neon
      .from('allowed_emails')
      .select('*')
      .order('added_at', { ascending: true });
    if (err) {
      console.error('Failed to load access list:', err);
      setError(friendlyError(err, 'Could not load the access list.'));
    } else {
      setEntries((data ?? []).map(rowToEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEmail = useCallback(
    async (email: string, note: string): Promise<boolean> => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned) return false;
      const { error: err } = await neon
        .from('allowed_emails')
        .insert({ email: cleaned, note: note.trim() || null });
      if (err) {
        console.error('Failed to add email:', err);
        setError(
          /duplicate|unique/i.test(String(err.message))
            ? `${cleaned} already has access.`
            : friendlyError(err, 'Could not add that email address.')
        );
        return false;
      }
      await reload();
      return true;
    },
    [reload]
  );

  const removeEmail = useCallback(
    async (email: string): Promise<boolean> => {
      const { error: err } = await neon.from('allowed_emails').delete().eq('email', email);
      if (err) {
        console.error('Failed to remove email:', err);
        setError(friendlyError(err, 'Could not remove that email address.'));
        return false;
      }
      await reload();
      return true;
    },
    [reload]
  );

  const clearError = useCallback(() => setError(null), []);

  return { entries, loading, error, clearError, addEmail, removeEmail, reload };
};
