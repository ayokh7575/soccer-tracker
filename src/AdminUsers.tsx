import React, { useState } from 'react';
import { Trash2, UserPlus, ShieldCheck, X } from 'lucide-react';
import { useAllowedEmails, AllowedEmail } from './hooks/useAllowedEmails';
import { AGE_GROUPS, compareAgeGroups } from './constants';

interface AdminUsersProps {
  onBack: () => void;
  currentEmail?: string;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ onBack, currentEmail }) => {
  const { entries, loading, error, clearError, addEmail, removeAgeGroup, removeEmail } = useAllowedEmails();
  const [email, setEmail] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await addEmail(email, note, ageGroup || undefined);
    setSaving(false);
    if (ok) {
      setEmail('');
      setNote('');
    }
  };

  const handleRemove = async (entry: AllowedEmail) => {
    if (window.confirm(`Remove ${entry.email} from the app? They will no longer be able to sign in. Their age groups' teams are kept for the other coaches.`)) {
      await removeEmail(entry.email);
    }
  };

  const handleRemoveAgeGroup = async (entry: AllowedEmail, ag: string) => {
    if (window.confirm(`Remove ${ag} from ${entry.email}? They will no longer see ${ag} teams.`)) {
      await removeAgeGroup(entry.email, ag);
    }
  };

  const isSelf = (entryEmail: string) =>
    !!currentEmail && entryEmail.toLowerCase() === currentEmail.toLowerCase();

  // "U15: sam@…, alex@…" overview, in age order.
  const byAgeGroup = new Map<string, string[]>();
  for (const entry of entries) {
    for (const ag of entry.ageGroups) byAgeGroup.set(ag, [...(byAgeGroup.get(ag) ?? []), entry.email]);
  }
  const ageGroupSummary = [...byAgeGroup.entries()].sort(([a], [b]) => compareAgeGroups(a, b));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage access</h1>
        <button onClick={onBack} className="text-blue-600 hover:underline">
          Back to Home
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Only these email addresses can use the app. Give each coach an age group: they can
        then create, edit and delete teams in that age group, and share them with the other
        coaches of the same age group. You can see and manage every team.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between gap-4">
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={clearError} className="text-red-700 text-sm font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-2 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@example.com"
          required
          aria-label="Email address"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-w-[12rem] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          aria-label="Age group"
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Age group…</option>
          {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. head coach)"
          aria-label="Note"
          className="flex-1 min-w-[10rem] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      <p className="text-xs text-gray-500 mb-8">
        To give an existing coach another age group, add their email again with the new age group.
      </p>

      {ageGroupSummary.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Coaches by age group</h2>
          <div className="space-y-1 text-sm" data-testid="age-group-summary">
            {ageGroupSummary.map(([ag, emails]) => (
              <p key={ag}>
                <span className="font-semibold inline-block w-20">{ag}</span>
                <span className="text-gray-700">{emails.join(', ')}</span>
              </p>
            ))}
          </div>
        </div>
      )}

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
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.ageGroups.map(ag => (
                    <span
                      key={ag}
                      className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 font-semibold pl-2 pr-1 py-0.5 rounded-full"
                    >
                      {ag}
                      <button
                        onClick={() => handleRemoveAgeGroup(entry, ag)}
                        aria-label={`Remove ${ag} from ${entry.email}`}
                        className="hover:bg-green-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {entry.ageGroups.length === 0 && !entry.isAdmin && (
                    <span className="text-xs text-amber-700">No age group yet — can&rsquo;t see any teams</span>
                  )}
                </div>
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
