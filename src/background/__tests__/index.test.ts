import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionData } from "../../lib/types";

// Capture listener callbacks
let onInstalledCallback: () => Promise<void>;
let onAlarmCallback: (alarm: { name: string }) => Promise<void>;
let onMessageCallback: (
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) => boolean | undefined;

// Chrome storage mock
const store: Record<string, unknown> = {};

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const EXTENSION_ID = "test-extension-id";

vi.stubGlobal("chrome", {
  runtime: {
    id: EXTENSION_ID,
    onInstalled: {
      addListener: vi.fn((cb: () => Promise<void>) => {
        onInstalledCallback = cb;
      }),
    },
    onMessage: {
      addListener: vi.fn(
        (
          cb: (
            message: { type: string; payload?: unknown },
            sender: chrome.runtime.MessageSender,
            sendResponse: (response: unknown) => void
          ) => boolean | undefined
        ) => {
          onMessageCallback = cb;
        }
      ),
    },
    lastError: null,
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn((cb: (alarm: { name: string }) => Promise<void>) => {
        onAlarmCallback = cb;
      }),
    },
  },
  storage: {
    local: {
      get: vi.fn((key: string) => {
        const result: Record<string, unknown> = {};
        if (key in store) result[key] = store[key];
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  },
});

// Provide import.meta.env values
import.meta.env.VITE_SUPABASE_URL = "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
import.meta.env.VITE_API_URL = "http://localhost:8000";

// Import the module to register all listeners
await import("../../background/index");

const mockSession: SessionData = {
  access_token: "test-access",
  refresh_token: "test-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "test@example.com" },
};

describe("background worker", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe("onInstalled", () => {
    it("clears storage when no session exists", async () => {
      await onInstalledCallback();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith("lp_session");
      expect(chrome.alarms.create).toHaveBeenCalledWith("token-refresh", {
        periodInMinutes: 50,
      });
    });

    it("does not clear existing session", async () => {
      store["lp_session"] = mockSession;

      await onInstalledCallback();

      // remove should NOT have been called since session already exists
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
      // But alarm should still be created
      expect(chrome.alarms.create).toHaveBeenCalledWith("token-refresh", {
        periodInMinutes: 50,
      });
    });

    it("creates alarm", async () => {
      await onInstalledCallback();

      expect(chrome.alarms.create).toHaveBeenCalledWith("token-refresh", {
        periodInMinutes: 50,
      });
    });
  });

  describe("onAlarm", () => {
    it("ignores non-matching alarm", async () => {
      await onAlarmCallback({ name: "some-other-alarm" });

      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });

    it("skips refresh when no session", async () => {
      await onAlarmCallback({ name: "token-refresh" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("skips refresh when token not expiring soon", async () => {
      // Token expires far in the future (> 600 seconds)
      store["lp_session"] = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      };

      await onAlarmCallback({ name: "token-refresh" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refreshes token when expiring within threshold", async () => {
      // Token expires in 5 minutes (< 600 seconds threshold)
      store["lp_session"] = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      const refreshedData = {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "user-1", email: "test@example.com" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedData),
      });

      await onAlarmCallback({ name: "token-refresh" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.supabase.co/auth/v1/token?grant_type=refresh_token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            apikey: "test-anon-key",
          }),
        })
      );

      expect(store["lp_session"]).toEqual(
        expect.objectContaining({ access_token: "new-access" })
      );
    });

    it("handles failed refresh (non-ok response)", async () => {
      store["lp_session"] = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await onAlarmCallback({ name: "token-refresh" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Token refresh failed:",
        401
      );
      consoleSpy.mockRestore();
    });

    it("handles fetch error during refresh", async () => {
      store["lp_session"] = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await onAlarmCallback({ name: "token-refresh" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Token refresh error:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("onMessage", () => {
    it("GET_SESSION returns session from storage", async () => {
      store["lp_session"] = mockSession;

      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "GET_SESSION" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(true); // keeps channel open

      // Wait for async .then() to resolve
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          session: mockSession,
        });
      });
    });

    it("GET_SESSION returns null when no session", async () => {
      const sendResponse = vi.fn();
      onMessageCallback(
        { type: "GET_SESSION" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ session: null });
      });
    });

    it("GET_AUTH_TOKEN returns token from session", async () => {
      store["lp_session"] = mockSession;

      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "GET_AUTH_TOKEN" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(true);

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          token: "test-access",
        });
      });
    });

    it("GET_AUTH_TOKEN returns null when no session", async () => {
      const sendResponse = vi.fn();
      onMessageCallback(
        { type: "GET_AUTH_TOKEN" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ token: null });
      });
    });

    it("SIGN_OUT clears session", async () => {
      store["lp_session"] = mockSession;

      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "SIGN_OUT" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(true);

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
      expect(chrome.storage.local.remove).toHaveBeenCalledWith("lp_session");
    });

    it("SESSION_UPDATED with valid payload persists session", async () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "SESSION_UPDATED", payload: mockSession },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(true); // async — keeps channel open

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
      expect(store["lp_session"]).toEqual(mockSession);
    });

    it("SESSION_UPDATED with invalid payload responds with failure", () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "SESSION_UPDATED" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith({ success: false });
    });

    it("rejects messages from other extensions", () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "GET_SESSION" },
        { id: "other-extension-id" } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it("unknown message type returns false", () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "UNKNOWN_TYPE" },
        { id: EXTENSION_ID } as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
