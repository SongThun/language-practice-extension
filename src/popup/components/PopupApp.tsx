import React, { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RecentWords } from "./RecentWords";
import type { SessionData } from "../../lib/types";
import { useSession } from "../../lib/hooks";

export function PopupApp() {
  const { session: initialSession, loading } = useSession();
  const [session, setSession] = useState<SessionData | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Sync initial session from hook into local state once loaded
  if (!loading && !initialized) {
    setSession(initialSession);
    setInitialized(true);
  }

  const handleLoginSuccess = (newSession: SessionData) => {
    setSession(newSession);
  };

  const handleSignOut = () => {
    setSession(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-muted text-sm">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginForm onSuccess={handleLoginSuccess} />;
  }

  return <RecentWords session={session} onSignOut={handleSignOut} />;
}
