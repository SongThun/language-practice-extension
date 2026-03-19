import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSession,
  setSession,
  clearSession,
  getDefaultLanguage,
  setDefaultLanguage,
} from "../storage";
import type { SessionData } from "../types";

// Mock chrome.storage.local
const store: Record<string, unknown> = {};

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          if (key in store) result[key] = store[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete store[key];
        }
        return Promise.resolve();
      }),
    },
  },
});

describe("storage", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  const mockSession: SessionData = {
    access_token: "test-token",
    refresh_token: "test-refresh",
    expires_at: Date.now() / 1000 + 3600,
    user: { id: "user-1", email: "test@example.com" },
  };

  it("returns null when no session stored", async () => {
    expect(await getSession()).toBeNull();
  });

  it("stores and retrieves session", async () => {
    await setSession(mockSession);
    const result = await getSession();
    expect(result).toEqual(mockSession);
  });

  it("clears session", async () => {
    await setSession(mockSession);
    await clearSession();
    expect(await getSession()).toBeNull();
  });

  it("returns default language 'en' when not set", async () => {
    expect(await getDefaultLanguage()).toBe("en");
  });

  it("stores and retrieves default language", async () => {
    await setDefaultLanguage("fr");
    expect(await getDefaultLanguage()).toBe("fr");
  });
});
