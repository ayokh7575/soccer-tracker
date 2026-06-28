import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { CLUB_NAME, CLUB_LOGO } from './accessConfig';

// Who can sign in is controlled in Supabase (Authentication settings), not here.

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
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

  // Step 1: email a 6-digit code.
  const sendCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      setSubmitting(false);
      if (error) setError(error.message);
      else setCodeSent(true);
    },
    [email]
  );

  // Step 2: verify the code; onAuthStateChange picks up the new session.
  const verifyCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });
      setSubmitting(false);
      if (error) setError(error.message);
    },
    [email, token]
  );

  const reset = () => {
    setCodeSent(false);
    setToken('');
    setError('');
  };

  if (checking) return null;
  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src={CLUB_LOGO} alt={CLUB_NAME} className="w-24 h-24 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-green-800 text-center mb-2">{CLUB_NAME}</h1>

        {codeSent ? (
          <>
            <p className="text-gray-500 text-center mb-6 text-sm">
              Enter the 6-digit code sent to <span className="font-medium">{email}</span>
            </p>
            <form onSubmit={verifyCode} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-[0.4em]"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={submitting || token.length < 6}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {submitting ? 'Verifying…' : 'Verify'}
              </button>
            </form>
            <button
              onClick={reset}
              className="w-full text-gray-400 text-xs text-center mt-4 hover:text-gray-600"
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-center mb-6 text-sm">Sign in to continue</p>
            <form onSubmit={sendCode} className="space-y-4">
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
                {submitting ? 'Sending…' : 'Send code'}
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
