import { supabase } from "./supabase";
import { setSession, clearSession, getSession } from "./storage";
import type { SessionData } from "./types";

export function toSessionData(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string };
}): SessionData {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
    },
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<SessionData> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Sign in failed");
  }

  const sessionData = toSessionData(data.session);
  await setSession(sessionData);

  chrome.runtime.sendMessage({ type: "SESSION_UPDATED", payload: sessionData });

  return sessionData;
}

export async function signInWithGoogle(): Promise<SessionData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl =
    `${supabaseUrl}/auth/v1/authorize?` +
    new URLSearchParams({
      provider: "google",
      redirect_to: redirectUrl,
    }).toString();

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(
            new Error(chrome.runtime.lastError?.message ?? "OAuth flow cancelled")
          );
          return;
        }

        try {
          const url = new URL(responseUrl);
          // Supabase returns tokens in the hash fragment
          const hashParams = new URLSearchParams(
            url.hash.substring(1) // remove the leading #
          );

          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (!accessToken || !refreshToken) {
            throw new Error("Missing tokens in OAuth response");
          }

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error || !data.session) {
            throw new Error(error?.message ?? "Failed to set session");
          }

          const sessionData = toSessionData(data.session);
          await setSession(sessionData);

          chrome.runtime.sendMessage({
            type: "SESSION_UPDATED",
            payload: sessionData,
          });

          resolve(sessionData);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function signOut(): Promise<void> {
  await Promise.all([supabase.auth.signOut(), clearSession()]);
  chrome.runtime.sendMessage({ type: "SIGN_OUT" });
}

export async function getCurrentSession(): Promise<SessionData | null> {
  return getSession();
}

export async function refreshSession(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: session.refresh_token,
  });

  if (error || !data.session) {
    await clearSession();
    return null;
  }

  const sessionData = toSessionData(data.session);
  await setSession(sessionData);
  return sessionData;
}
