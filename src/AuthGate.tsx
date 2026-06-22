import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { CLUB_NAME, CLUB_LOGO } from './accessConfig';

// Who can sign in is controlled in Supabase (Authentication settings), not here.

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      const redirectTo = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      setSubmitting(false);
      if (error) setError(error.message);
      else setSent(true);
    },
    [email]
  );

  if (checking) return null;
  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src={CLUB_LOGO} alt={CLUB_NAME} className="w-24 h-24 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-green-800 text-center mb-2">{CLUB_NAME}</h1>

        {sent ? (
          <p className="text-gray-600 text-center my-6 text-sm">
            Check your email for a sign-in link. You can open it on any device to access
            your data.
          </p>
        ) : (
          <>
            <p className="text-gray-500 text-center mb-6 text-sm">
              Sign in to continue
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-lg"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {submitting ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          </>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          v{process.env.REACT_APP_VERSION || '0.1.0'} &copy; {new Date().getFullYear()} Alen
          Yokhanis
        </p>
      </div>
    </div>
  );
}
