import type { SessionData } from "./types";

const KEYS = {
  SESSION: "lp_session",
  DEFAULT_LANGUAGE: "lp_default_language",
} as const;

export async function getSession(): Promise<SessionData | null> {
  const result = await chrome.storage.local.get(KEYS.SESSION);
  return result[KEYS.SESSION] ?? null;
}

export async function setSession(session: SessionData): Promise<void> {
  await chrome.storage.local.set({ [KEYS.SESSION]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(KEYS.SESSION);
}

export async function getDefaultLanguage(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.DEFAULT_LANGUAGE);
  return result[KEYS.DEFAULT_LANGUAGE] ?? "en";
}

export async function setDefaultLanguage(language: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.DEFAULT_LANGUAGE]: language });
}
