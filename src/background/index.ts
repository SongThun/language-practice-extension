import type { ExtensionMessage, SessionData } from "../lib/types";
import { getSession, setSession, clearSession } from "../lib/storage";
import { toSessionData } from "../lib/auth";

const ALARM_NAME = "token-refresh";
const REFRESH_INTERVAL_MINUTES = 50;
const REFRESH_THRESHOLD_SECONDS = 600; // 10 minutes

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize storage with defaults
  const existing = await getSession();
  if (!existing) {
    await clearSession();
  }

  // Set up periodic token refresh
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const session = await getSession();

  if (!session) return;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = session.expires_at - now;

  if (expiresIn > REFRESH_THRESHOLD_SECONDS) return;

  // Token expires within 10 minutes — refresh it
  try {
    const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
    const supabaseKey = getEnvVar("VITE_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Token refresh skipped: missing Supabase config");
      return;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", response.status);
      return;
    }

    const data = await response.json();

    const updatedSession = toSessionData({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: {
        id: data.user?.id ?? session.user.id,
        email: data.user?.email ?? session.user.email,
      },
    });

    await setSession(updatedSession);
  } catch (err) {
    console.error("Token refresh error:", err);
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Only accept messages from this extension (popup, content scripts, etc.)
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    if (message.type === "GET_SESSION") {
      getSession().then((session) => {
        sendResponse({ session });
      });
      return true; // keep channel open for async response
    }

    if (message.type === "GET_AUTH_TOKEN") {
      getSession().then((session) => {
        sendResponse({ token: session?.access_token ?? null });
      });
      return true;
    }

    if (message.type === "SIGN_OUT") {
      clearSession().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === "SESSION_UPDATED") {
      const payload = message.payload as SessionData | undefined;
      if (payload?.access_token && payload?.refresh_token && payload?.user?.id) {
        setSession(payload).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
      sendResponse({ success: false });
      return false;
    }

    return false;
  }
);

// Helper to read env vars that were baked in at build time.
// In the service worker context we store them during build via define config,
// but we can also read from the env vars that CRXJS injects.
function getEnvVar(key: string): string {
  // @crxjs/vite-plugin replaces import.meta.env at build time for service workers too
  const envMap: Record<string, string> = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? "",
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    VITE_API_URL: import.meta.env.VITE_API_URL ?? "",
  };
  return envMap[key] ?? "";
}
