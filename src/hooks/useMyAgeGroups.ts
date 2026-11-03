import { useState, useEffect, useCallback } from 'react';
import { neon } from '../neonClient';
import { AGE_GROUPS, compareAgeGroups } from '../constants';

// The age groups the signed-in person can create and manage teams in:
// every age group for the admin, otherwise the ones the admin assigned.
export const useMyAgeGroups = (email: string | undefined, isAdmin: boolean) => {
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!email) {
      setAssigned([]);
      setLoading(false);
      return;
    }
    // RLS returns only your own rows (all rows for the admin), so filter by
    // email as well to get just yours either way.
    const { data, error } = await neon
      .from('coach_age_groups')
      .select('age_group')
      .eq('email', email.toLowerCase());
    if (error) {
      console.error('Failed to load your age groups:', error);
    } else {
      setAssigned(((data ?? []) as any[]).map(r => r.age_group).sort(compareAgeGroups));
    }
    setLoading(false);
  }, [email]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Pick up changes the admin made while the app was in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return {
    ageGroups: isAdmin ? [...AGE_GROUPS] as string[] : assigned,
    loading: isAdmin ? false : loading,
    reload,
  };
};
