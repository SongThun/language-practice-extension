import React, { useState, useEffect } from "react";
import { listWords } from "../../lib/api";
import { signOut } from "../../lib/auth";
import { LANGUAGE_LABELS } from "../../lib/constants";
import type { SessionData, Word } from "../../lib/types";

interface RecentWordsProps {
  session: SessionData;
  onSignOut: () => void;
}

export function RecentWords({ session, onSignOut }: RecentWordsProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWords({ limit: 10 })
      .then(setWords)
      .catch((err) => {
        console.error("Failed to fetch words:", err);
        setError("Failed to load words");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
  };

  const handleOpenApp = () => {
    const webUrl = import.meta.env.VITE_WEB_URL || "http://localhost:3000";
    chrome.tabs.create({ url: webUrl });
  };

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-primary text-sm font-bold">Language Practice</h1>
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs truncate max-w-[120px]">
            {session.user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="text-muted text-xs hover:text-destructive transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted text-sm">Loading...</span>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 text-destructive text-xs">{error}</div>
        )}

        {!loading && !error && words.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <p className="text-muted text-sm mb-2">No words yet.</p>
            <p className="text-muted text-xs">
              Highlight text on any webpage to save words.
            </p>
          </div>
        )}

        {!loading &&
          words.map((word) => (
            <div
              key={word.id}
              className="px-4 py-3 border-b border-border hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-text text-sm font-semibold">
                  {word.word}
                </span>
                <span className="text-xs bg-card border border-border rounded px-1.5 py-0.5 text-muted">
                  {LANGUAGE_LABELS[word.language] ?? word.language.toUpperCase()}
                </span>
              </div>
              <p className="text-muted text-xs line-clamp-2 leading-relaxed">
                {word.definition}
              </p>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={handleOpenApp}
          className="w-full bg-card border border-border text-text rounded-md py-2 text-xs hover:border-primary transition-colors"
        >
          Open Language Practice App
        </button>
      </div>
    </div>
  );
}
