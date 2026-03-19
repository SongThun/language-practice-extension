import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionData } from "../types";

// Mock storage
vi.mock("../storage", () => ({
  setSession: vi.fn(() => Promise.resolve()),
  clearSession: vi.fn(() => Promise.resolve()),
  getSession: vi.fn(() => Promise.resolve(null)),
}));

// Mock supabase
vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

// Mock chrome globals
vi.stubGlobal("chrome", {
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => "https://redirect.chromiumapp.org/"),
  },
});

// We need to provide import.meta.env for signInWithGoogle
// (already provided by vitest, but we need VITE_SUPABASE_URL)
import.meta.env.VITE_SUPABASE_URL = "https://test.supabase.co";

import {
  signInWithEmail,
  signInWithGoogle,
  signOut,
  getCurrentSession,
  refreshSession,
  toSessionData,
} from "../auth";
import { supabase } from "../supabase";
import { setSession, clearSession, getSession } from "../storage";

const mockSupabaseAuth = supabase.auth as {
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
};

const mockSetSession = setSession as ReturnType<typeof vi.fn>;
const mockClearSession = clearSession as ReturnType<typeof vi.fn>;
const mockGetSession = getSession as ReturnType<typeof vi.fn>;

const fakeSession = {
  access_token: "access-123",
  refresh_token: "refresh-456",
  expires_at: 1700000000,
  user: { id: "user-1", email: "test@example.com" },
};

const expectedSessionData: SessionData = {
  access_token: "access-123",
  refresh_token: "refresh-456",
  expires_at: 1700000000,
  user: { id: "user-1", email: "test@example.com" },
};

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(chrome.runtime, "lastError", {
      value: null,
      configurable: true,
    });
  });

  describe("signInWithEmail", () => {
    it("saves session and sends message on success", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      });

      const result = await signInWithEmail("test@example.com", "password");

      expect(result).toEqual(expectedSessionData);
      expect(mockSetSession).toHaveBeenCalledWith(expectedSessionData);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SESSION_UPDATED",
        payload: expectedSessionData,
      });
    });

    it("throws on error", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid credentials" },
      });

      await expect(signInWithEmail("bad@email.com", "wrong")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("throws when no session returned", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(signInWithEmail("test@example.com", "pass")).rejects.toThrow(
        "Sign in failed"
      );
    });
  });

  describe("signInWithGoogle", () => {
    it("completes OAuth flow successfully", async () => {
      const redirectUrl = "https://redirect.chromiumapp.org/";
      const responseUrl =
        redirectUrl +
        "#access_token=google-access&refresh_token=google-refresh&expires_at=1700000000";

      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          cb(responseUrl);
        }
      );

      mockSupabaseAuth.setSession.mockResolvedValue({
        data: {
          session: {
            access_token: "google-access",
            refresh_token: "google-refresh",
            expires_at: 1700000000,
            user: { id: "google-user", email: "google@test.com" },
          },
        },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        access_token: "google-access",
        refresh_token: "google-refresh",
        expires_at: 1700000000,
        user: { id: "google-user", email: "google@test.com" },
      });
      expect(mockSetSession).toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SESSION_UPDATED" })
      );
    });

    it("rejects when cancelled by user (lastError set)", async () => {
      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          Object.defineProperty(chrome.runtime, "lastError", {
            value: { message: "The user did not approve access." },
            configurable: true,
          });
          cb(undefined);
          Object.defineProperty(chrome.runtime, "lastError", {
            value: null,
            configurable: true,
          });
        }
      );

      await expect(signInWithGoogle()).rejects.toThrow(
        "The user did not approve access."
      );
    });

    it("rejects when no responseUrl", async () => {
      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          cb(undefined);
        }
      );

      await expect(signInWithGoogle()).rejects.toThrow("OAuth flow cancelled");
    });

    it("rejects when tokens are missing from hash", async () => {
      const responseUrl = "https://redirect.chromiumapp.org/#foo=bar";

      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          cb(responseUrl);
        }
      );

      await expect(signInWithGoogle()).rejects.toThrow(
        "Missing tokens in OAuth response"
      );
    });

    it("rejects when setSession fails with error", async () => {
      const responseUrl =
        "https://redirect.chromiumapp.org/#access_token=at&refresh_token=rt";

      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          cb(responseUrl);
        }
      );

      mockSupabaseAuth.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Session error" },
      });

      await expect(signInWithGoogle()).rejects.toThrow("Session error");
    });

    it("rejects when setSession returns no session and no error", async () => {
      const responseUrl =
        "https://redirect.chromiumapp.org/#access_token=at&refresh_token=rt";

      (chrome.identity.launchWebAuthFlow as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, cb: (url?: string) => void) => {
          cb(responseUrl);
        }
      );

      mockSupabaseAuth.setSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(signInWithGoogle()).rejects.toThrow("Failed to set session");
    });
  });

  describe("signOut", () => {
    it("calls supabase signOut, clears storage, and sends message", async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
      expect(mockClearSession).toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SIGN_OUT",
      });
    });
  });

  describe("getCurrentSession", () => {
    it("delegates to getSession from storage", async () => {
      const session: SessionData = {
        access_token: "tok",
        refresh_token: "ref",
        expires_at: 999,
        user: { id: "u1", email: "e@e.com" },
      };
      mockGetSession.mockResolvedValue(session);

      const result = await getCurrentSession();
      expect(result).toEqual(session);
      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  describe("refreshSession", () => {
    it("refreshes and saves on success", async () => {
      mockGetSession.mockResolvedValue({
        access_token: "old",
        refresh_token: "old-refresh",
        expires_at: 999,
        user: { id: "u1", email: "e@e.com" },
      });

      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: 2000,
            user: { id: "u1", email: "e@e.com" },
          },
        },
        error: null,
      });

      const result = await refreshSession();

      expect(result).toEqual({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_at: 2000,
        user: { id: "u1", email: "e@e.com" },
      });
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: "new-access" })
      );
    });

    it("returns null when no existing session", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await refreshSession();
      expect(result).toBeNull();
    });

    it("clears session and returns null when refresh fails", async () => {
      mockGetSession.mockResolvedValue({
        access_token: "old",
        refresh_token: "old-refresh",
        expires_at: 999,
        user: { id: "u1", email: "e@e.com" },
      });

      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Token expired" },
      });

      const result = await refreshSession();
      expect(result).toBeNull();
      expect(mockClearSession).toHaveBeenCalled();
    });
  });

  describe("toSessionData edge cases", () => {
    it("uses fallback expires_at when not provided", async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: "at",
            refresh_token: "rt",
            // no expires_at
            user: { id: "u1", email: "e@e.com" },
          },
        },
        error: null,
      });

      const result = await signInWithEmail("e@e.com", "pass");
      // Should default to ~now + 3600
      expect(result.expires_at).toBeGreaterThanOrEqual(now + 3500);
      expect(result.expires_at).toBeLessThanOrEqual(now + 3700);
    });

    it("uses empty string when email is absent", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: "at",
            refresh_token: "rt",
            expires_at: 1700000000,
            user: { id: "u1" }, // no email
          },
        },
        error: null,
      });

      const result = await signInWithEmail("e@e.com", "pass");
      expect(result.user.email).toBe("");
    });
  });
});
