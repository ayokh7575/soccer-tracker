import React, { useState, useEffect, useCallback, useRef } from 'react';
import { neon } from './neonClient';
import { CLUB_NAME, CLUB_LOGO } from './accessConfig';

// Remembers that a code was emailed, so the gate comes back on the code step
// after a reload. iOS often reloads a home-screen app when you switch to Mail
// to read the code; without this the app returned to the email step, the coach
// requested another code, and the one they then typed had been replaced
// ("Invalid OTP"). Codes expire after a few minutes, so a stale entry is dropped.
export const PENDING_SIGN_IN_KEY = 'pendingSignIn_v1';
const PENDING_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000;

interface PendingSignIn { email: string; sentAt: number }

const loadPendingSignIn = (): PendingSignIn | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_SIGN_IN_KEY) || 'null');
    if (p && typeof p.email === 'string' && typeof p.sentAt === 'number' &&
        Date.now() - p.sentAt < PENDING_SIGN_IN_MAX_AGE_MS) {
      return p;
    }
  } catch {
    // ignore
  }
  return null;
};

const savePendingSignIn = (p: PendingSignIn) => {
  try { localStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

const clearPendingSignIn = () => {
  try { localStorage.removeItem(PENDING_SIGN_IN_KEY); } catch { /* ignore */ }
};

// Better Auth's messages, in words a coach can act on.
const friendlyOtpError = (message: string | undefined, fallback: string): string => {
  if (/invalid otp/i.test(message ?? '')) {
    return "That code doesn't match. Use the code from the most recent email — each new code replaces the one before it.";
  }
  if (/expired/i.test(message ?? '')) return 'That code has expired. Tap "Send a new code".';
  if (/too many attempts/i.test(message ?? '')) return 'Too many wrong tries for this code. Tap "Send a new code".';
  return message || fallback;
};

// How long to wait, after the server accepts the code, for the session to
// show up before concluding the browser dropped it.
export const SESSION_WAIT_MS = 4000;

const isHomeScreenApp = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

// Neon Auth keeps the sign-in in a cookie on its own domain. iOS home-screen
// web apps don't send it back, so the code is accepted but the app never sees
// a session (and a second tap on Verify fails because the code is used up).
// Neon Auth doesn't accept the session token any other way, so the only fix
// is to use the app in a browser tab.
export const SESSION_NOT_KEPT_MESSAGE = isHomeScreenApp()
  ? 'Your code was accepted, but iPhone home-screen apps can\'t keep this sign-in. ' +
    'Open the app in Safari instead, or remove the icon and add it again with "Open as Web App" turned off.'
  : 'Your code was accepted, but this browser didn\'t keep the sign-in. ' +
    'Check that cookies aren\'t blocked for this site, or try another browser.';

const formatClock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const session = neon.auth.useSession();
  const userId = session.data?.user?.id;
  const userEmail = session.data?.user?.email;
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [pendingAtLoad] = useState(loadPendingSignIn);
  const [email, setEmail] = useState(pendingAtLoad?.email ?? '');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(!!pendingAtLoad);
  const [sentAt, setSentAt] = useState<number | null>(pendingAtLoad?.sentAt ?? null);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Set when the server accepted the code; cleared once the session appears.
  const [awaitingSession, setAwaitingSession] = useState(false);

  // Signing in finishes the pending sign-in. Signing out must return to a clean
  // email prompt: without this the gate re-renders with codeSent still true and
  // shows the code step for the previous account. Only a real sign-out resets
  // the form — on first load there's no user yet, and a code step restored
  // after a reload must survive.
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (userId) {
      clearPendingSignIn();
      setAwaitingSession(false);
    } else if (previousUserId.current) {
      clearPendingSignIn();
      setCodeSent(false);
      setSentAt(null);
      setNotice('');
      setToken('');
      setEmail('');
      setError('');
      setSubmitting(false);
    }
    previousUserId.current = userId;
  }, [userId]);

  // The code was accepted; if no session arrives, say why instead of leaving
  // the coach on the code screen (where tapping Verify again gives "Invalid OTP").
  useEffect(() => {
    if (!awaitingSession || userId) return;
    const timer = setTimeout(() => {
      setAwaitingSession(false);
      setToken('');
      setError(SESSION_NOT_KEPT_MESSAGE);
    }, SESSION_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingSession, userId]);

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
      // The database scales to zero when idle. On the first request after it
      // wakes, the JWT cannot be verified yet, so auth.uid() is null and this
      // returns false — which looks identical to "not on the allowlist". Retry
      // before concluding denial, otherwise a legitimate user is turned away
      // purely because they were the one who woke the database.
      const delays = [400, 800, 1600, 3000];
      for (let attempt = 0; attempt <= delays.length && !cancelled; attempt++) {
        const { data, error } = await neon.rpc('is_allowed');
        if (cancelled) return;
        if (data === true) {
          setAccess('allowed');
          return;
        }
        if (error) {
          // Row-Level Security still enforces access on every query, so a failed
          // check should not lock a legitimate user out of the UI.
          console.error('Access check failed:', error);
          setAccess('allowed');
          return;
        }
        if (attempt < delays.length) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
      }
      if (!cancelled) setAccess('denied');
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Step 1: email a 6-digit code. Also used by "Send a new code".
  const requestCode = useCallback(
    async (isResend: boolean) => {
      setError('');
      setNotice('');
      setSubmitting(true);
      try {
        const { error } = await neon.auth.emailOtp.sendVerificationOtp({
          email: email.trim(),
          type: 'sign-in',
        });
        if (error) {
          setError(error.message || 'Could not send the code. Please try again.');
        } else {
          const now = Date.now();
          savePendingSignIn({ email: email.trim(), sentAt: now });
          setSentAt(now);
          setToken('');
          setCodeSent(true);
          if (isResend) setNotice('New code sent. Earlier codes no longer work.');
        }
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

  const sendCode = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      requestCode(false);
    },
    [requestCode]
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
        if (error) setError(friendlyOtpError(error.message, 'That code was not accepted. Please try again.'));
        else {
          clearPendingSignIn();
          setAwaitingSession(true);
        }
      } catch (err: any) {
        // A thrown error (network, CORS, blocked cookies) must not leave the
        // button stuck on "Verifying…" with no explanation.
        // The Neon client throws server rejections (e.g. "Invalid OTP")
        // rather than returning them, so they arrive here too.
        console.error('Failed to verify code:', err);
        setError(friendlyOtpError(err?.message, 'Could not reach the sign-in service. Please try again.'));
      } finally {
        setSubmitting(false);
      }
    },
    [email, token]
  );

  const reset = () => {
    clearPendingSignIn();
    setCodeSent(false);
    setSentAt(null);
    setNotice('');
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
              {sentAt && <> at {formatClock(sentAt)}</>}. Only the most recent code works.
            </p>
            <form onSubmit={verifyCode} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.replace(/\D/g, ''));
                  if (error) setError('');
                }}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-[0.4em]"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              {notice && !error && <p className="text-green-700 text-sm text-center">{notice}</p>}
              <button
                type="submit"
                disabled={submitting || awaitingSession || token.length < 6}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {submitting || awaitingSession ? 'Verifying…' : 'Verify'}
              </button>
            </form>
            <button
              onClick={() => requestCode(true)}
              disabled={submitting}
              className="w-full text-green-700 text-sm text-center mt-4 hover:underline disabled:opacity-50"
            >
              Send a new code
            </button>
            <button
              onClick={reset}
              className="w-full text-gray-400 text-xs text-center mt-3 hover:text-gray-600"
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
                inputMode="email"
                autoComplete="email"
                // Phone keyboards otherwise capitalise the first letter and can
                // autocorrect in stray characters, producing an address the
                // server rejects as malformed.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  // Strip whitespace anywhere, not just the ends.
                  setEmail(e.target.value.replace(/\s/g, ''));
                  // Clear a stale failure as soon as the input is corrected.
                  if (error) setError('');
                }}
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
