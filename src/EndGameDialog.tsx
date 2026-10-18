import React, { useState } from 'react';

interface EndGameDialogProps {
  gameName: string;
  score: string; // e.g. "2 - 1"
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepPlaying: () => void;
}

// Shown when the coach taps Stop. Three explicit choices, so "go back" can
// never be mistaken for "throw the game away". Discarding asks for a second
// tap because it can't be undone.
export const EndGameDialog: React.FC<EndGameDialogProps> = ({
  gameName, score, saving, onSave, onDiscard, onKeepPlaying,
}) => {
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-game-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 id="end-game-title" className="text-xl font-bold mb-1">End game?</h2>
        <p className="text-sm text-gray-600 mb-6">
          {gameName ? <><span className="font-medium">{gameName}</span> · </> : null}Score {score}
        </p>

        <div className="space-y-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving…' : 'Save to history'}
          </button>

          <button
            onClick={() => (confirmDiscard ? onDiscard() : setConfirmDiscard(true))}
            disabled={saving}
            className={`w-full py-3 rounded-lg font-semibold border disabled:opacity-50 ${
              confirmDiscard
                ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                : 'border-red-300 text-red-700 hover:bg-red-50'
            }`}
          >
            {confirmDiscard ? 'Tap again to discard — not saved' : "Discard game (don't save)"}
          </button>

          <button
            onClick={onKeepPlaying}
            disabled={saving}
            className="w-full py-3 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Keep playing
          </button>
        </div>
      </div>
    </div>
  );
};
