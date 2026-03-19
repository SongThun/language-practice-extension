import { useState, useEffect } from "react";
import type { SessionData } from "./types";

export function useSession(): { session: SessionData | null; loading: boolean } {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
      if (chrome.runtime.lastError) {
        setLoading(false);
        return;
      }
      setSession(response?.session ?? null);
      setLoading(false);
    });
  }, []);

  return { session, loading };
}
