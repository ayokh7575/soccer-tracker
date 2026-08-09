import React, { useState, useEffect, useCallback } from 'react';
import { neon } from './neonClient';
import { CLUB_NAME, CLUB_LOGO } from './accessConfig';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const session = neon.auth.useSession();
  const userId = session.data?.user?.id;
  const userEmail = session.data?.user?.email;
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Signing out must return to a clean email prompt: without this the gate
  // re-renders with codeSent still true and shows the code step for the
  // previous account.
  useEffect(() => {
    if (!userId) {
      setCodeSent(false);
      setToken('');
      setEmail('');
      setError('');
      setSubmitting(false);
    }
  }, [userId]);

  // Neon Auth cannot restrict who signs up yet, so anyone can create an account.
  // Ask the database whether this account is on the allowlist and, if not, say so
  // plainly instead of dropping them into an app where every action fails.
  useEffect(() => {
    if (!userId) {
      setAccess('checking');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await neon.rpc('is_allowed');
      if (cancelled) return;
      if (error) {
        // Row-Level Security still enforces access on every query, so a failed
        // check should not lock a legitimate user out of the UI.
        console.error('Access check failed:', error);
        setAccess('allowed');
      } else {
        setAccess(data === true ? 'allowed' : 'denied');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Step 1: email a 6-digit code.
  const sendCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const { error } = await neon.auth.emailOtp.sendVerificationOtp({
          email: email.trim(),
          type: 'sign-in',
        });
        if (error) setError(error.message || 'Could not send the code. Please try again.');
        else setCodeSent(true);
      } catch (err: any) {
        // A thrown error (network, CORS, blocked cookies) must not leave the
        // button stuck on "Sending…" with no explanation.
        console.error('Failed to send code:', err);
        setError(err?.message || 'Could not reach the sign-in service. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [email]
  );

  // Step 2: verify the code; useSession picks up the new session automatically.
  const verifyCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const { error } = await neon.auth.signIn.emailOtp({
          email: email.trim(),
          otp: token.trim(),
        });
        if (error) setError(error.message || 'That code was not accepted. Please try again.');
      } catch (err: any) {
        // A thrown error (network, CORS, blocked cookies) must not leave the
        // button stuck on "Verifying…" with no explanation.
        console.error('Failed to verify code:', err);
        setError(err?.message || 'Could not reach the sign-in service. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, token]
  );

  const reset = () => {
    setCodeSent(false);
    setToken('');
    setError('');
  };

  if (session.isPending) return null;

  if (session.data) {
    if (access === 'checking') return null;
    if (access === 'allowed') return <>{children}</>;

    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <img src={CLUB_LOGO} alt={CLUB_NAME} className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">{CLUB_NAME}</h1>
          <p className="text-gray-700 font-semibold mb-2">Access not enabled</p>
          <p className="text-gray-500 text-sm mb-6">
            {userEmail ? <><span className="font-medium">{userEmail}</span> is not </> : 'This account is not '}
            set up to use this app yet. Ask the administrator to enable access for
            your email address.
          </p>
          <button
            onClick={() => neon.auth.signOut()}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

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
          v{__APP_VERSION__} &copy; {new Date().getFullYear()} Alen Yokhanis
        </p>
      </div>
    </div>
  );
}
