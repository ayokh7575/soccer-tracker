import { useState, useEffect, useCallback } from 'react';
import { neon } from '../neonClient';
import { friendlyError } from '../errors';
import { compareAgeGroups } from '../constants';

export interface AllowedEmail {
  email: string;
  note: string | null;
  isAdmin: boolean;
  addedAt: string;
  // Age groups this coach can see and manage teams in.
  ageGroups: string[];
}

const rowToEntry = (r: any, ageGroups: string[]): AllowedEmail => ({
  email: r.email,
  note: r.note ?? null,
  isAdmin: r.is_admin ?? false,
  addedAt: r.added_at,
  ageGroups,
});

const isDuplicate = (err: any) => /duplicate|unique/i.test(String(err?.message));

// Reads and edits the access list and coaches' age groups. Every query is
// additionally restricted by RLS to the admin, so anyone else simply sees an
// empty list and cannot write.
export const useAllowedEmails = () => {
  const [entries, setEntries] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [emails, groups] = await Promise.all([
      neon.from('allowed_emails').select('*').order('added_at', { ascending: true }),
      neon.from('coach_age_groups').select('email, age_group'),
    ]);
    const err = emails.error || groups.error;
    if (err) {
      console.error('Failed to load access list:', err);
      setError(friendlyError(err, 'Could not load the access list.'));
    } else {
      const byEmail = new Map<string, string[]>();
      for (const g of (groups.data ?? []) as any[]) {
        const key = String(g.email).toLowerCase();
        byEmail.set(key, [...(byEmail.get(key) ?? []), g.age_group]);
      }
      setEntries(
        ((emails.data ?? []) as any[]).map(r =>
          rowToEntry(r, (byEmail.get(String(r.email).toLowerCase()) ?? []).sort(compareAgeGroups))
        )
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Gives an email access to an age group (adding the email to the access
  // list first if it isn't there yet). Without an age group it only adds the
  // email to the access list.
  const addEmail = useCallback(
    async (email: string, note: string, ageGroup?: string): Promise<boolean> => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned) return false;
      const exists = entries.some(e => e.email.toLowerCase() === cleaned);

      if (!exists) {
        const { error: err } = await neon
          .from('allowed_emails')
          .insert({ email: cleaned, note: note.trim() || null });
        if (err && !isDuplicate(err)) {
          console.error('Failed to add email:', err);
          setError(friendlyError(err, 'Could not add that email address.'));
          return false;
        }
      }

      if (ageGroup) {
        const { error: err } = await neon
          .from('coach_age_groups')
          .insert({ email: cleaned, age_group: ageGroup });
        if (err) {
          console.error('Failed to add age group:', err);
          setError(
            isDuplicate(err)
              ? `${cleaned} already has ${ageGroup}.`
              : friendlyError(err, 'Could not add that age group.')
          );
          await reload();
          return false;
        }
      } else if (exists) {
        setError(`${cleaned} already has access.`);
        return false;
      }

      await reload();
      return true;
    },
    [entries, reload]
  );

  const removeAgeGroup = useCallback(
    async (email: string, ageGroup: string): Promise<boolean> => {
      const { error: err } = await neon
        .from('coach_age_groups')
        .delete()
        .eq('email', email)
        .eq('age_group', ageGroup);
      if (err) {
        console.error('Failed to remove age group:', err);
        setError(friendlyError(err, 'Could not remove that age group.'));
        return false;
      }
      await reload();
      return true;
    },
    [reload]
  );

  // Removing someone from the access list also removes their age groups
  // (the database cascades it).
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

  return { entries, loading, error, clearError, addEmail, removeAgeGroup, removeEmail, reload };
};
