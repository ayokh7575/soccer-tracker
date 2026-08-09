import React, { useState } from 'react';
import { Trash2, UserPlus, ShieldCheck } from 'lucide-react';
import { useAllowedEmails } from './hooks/useAllowedEmails';

interface AdminUsersProps {
  onBack: () => void;
  currentEmail?: string;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ onBack, currentEmail }) => {
  const { entries, loading, error, clearError, addEmail, removeEmail } = useAllowedEmails();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await addEmail(email, note);
    setSaving(false);
    if (ok) {
      setEmail('');
      setNote('');
    }
  };

  const handleRemove = async (entry: { email: string }) => {
    if (window.confirm(`Remove access for ${entry.email}? Their data is kept, but they will no longer be able to sign in to the app.`)) {
      await removeEmail(entry.email);
    }
  };

  const isSelf = (entryEmail: string) =>
    !!currentEmail && entryEmail.toLowerCase() === currentEmail.toLowerCase();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage access</h1>
        <button onClick={onBack} className="text-blue-600 hover:underline">
          Back to Home
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Only these email addresses can use the app. Anyone else who signs in is shown an
        &ldquo;access not enabled&rdquo; message. Each person gets their own private teams
        and history.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between gap-4">
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={clearError} className="text-red-700 text-sm font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-8 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@example.com"
          required
          aria-label="Email address"
          className="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. U16 coach)"
          aria-label="Note"
          className="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <UserPlus size={18} />
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-3">
        People with access {entries.length > 0 && `(${entries.length})`}
      </h2>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">No one has access yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.email}
              className="flex items-center justify-between p-3 border rounded-lg bg-white"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{entry.email}</span>
                  {entry.isAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                      <ShieldCheck size={12} /> Admin
                    </span>
                  )}
                  {isSelf(entry.email) && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                </div>
                {entry.note && <p className="text-sm text-gray-500 truncate">{entry.note}</p>}
              </div>
              {isSelf(entry.email) ? (
                <span className="text-xs text-gray-400 whitespace-nowrap pl-3">
                  Can&rsquo;t remove yourself
                </span>
              ) : (
                <button
                  onClick={() => handleRemove(entry)}
                  aria-label={`Remove access for ${entry.email}`}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
