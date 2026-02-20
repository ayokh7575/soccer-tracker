import React, { useState, useEffect, useCallback } from 'react';
import { ACCESS_CODE_HASH } from './accessConfig';

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SESSION_KEY = 'soccer_tracker_auth';

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === ACCESS_CODE_HASH) {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const hashed = await hashCode(code);
      if (hashed === ACCESS_CODE_HASH) {
        sessionStorage.setItem(SESSION_KEY, ACCESS_CODE_HASH);
        setAuthenticated(true);
      } else {
        setError('Invalid access code');
      }
    },
    [code]
  );

  if (checking) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green-800 text-center mb-2">
          Soccer Time Tracker
        </h1>
        <p className="text-gray-500 text-center mb-6 text-sm">
          Enter the access code to continue
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-lg"
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Enter
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">
          v{process.env.REACT_APP_VERSION || '0.1.0'} &copy; {new Date().getFullYear()} Alen Yokhanis
        </p>
      </div>
    </div>
  );
}
