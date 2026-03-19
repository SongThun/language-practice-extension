import { describe, it, expect, vi, beforeEach } from "vitest";

// Set up chrome.storage.local mock before importing the module
const store: Record<string, string> = {};

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn((key: string) => {
        const result: Record<string, unknown> = {};
        if (key in store) result[key] = store[key];
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, string>) => {
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

// Mock createClient so we can inspect the adapter it receives
let capturedAdapter: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(
    (
      _url: string,
      _key: string,
      options: { auth: { storage: typeof capturedAdapter } }
    ) => {
      capturedAdapter = options.auth.storage;
      return {
        auth: {
          signInWithPassword: vi.fn(),
          signUp: vi.fn(),
          setSession: vi.fn(),
          signOut: vi.fn(),
          refreshSession: vi.fn(),
        },
      };
    }
  ),
}));

// Import to trigger module execution (which calls createClient)
await import("../supabase");

describe("chromeStorageAdapter", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("getItem returns stored value", async () => {
    store["test-key"] = "test-value";
    const result = await capturedAdapter.getItem("test-key");
    expect(result).toBe("test-value");
  });

  it("getItem returns null for missing key", async () => {
    const result = await capturedAdapter.getItem("nonexistent");
    expect(result).toBeNull();
  });

  it("setItem stores value", async () => {
    await capturedAdapter.setItem("my-key", "my-value");
    expect(store["my-key"]).toBe("my-value");
  });

  it("removeItem removes value", async () => {
    store["to-delete"] = "value";
    await capturedAdapter.removeItem("to-delete");
    expect(store["to-delete"]).toBeUndefined();
  });
});
