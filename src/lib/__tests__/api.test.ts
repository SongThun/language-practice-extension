import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWord, listWords, listTags, createTag, suggestDefinition } from "../api";

// Mock chrome.runtime.sendMessage
vi.stubGlobal("chrome", {
  runtime: {
    sendMessage: vi.fn((_msg: unknown, cb: (response: unknown) => void) => {
      cb({ token: "mock-jwt-token" });
    }),
    lastError: null,
  },
});

// Mock import.meta.env
vi.stubGlobal("import.meta", {
  env: { VITE_API_URL: "http://localhost:8000" },
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("createWord sends POST with auth header", async () => {
    const mockWord = { id: 1, word: "test", definition: "a test" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockWord),
    });

    const result = await createWord({
      word: "test",
      definition: "a test",
      language: "en",
    });

    expect(result).toEqual(mockWord);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/words",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-jwt-token",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("listWords builds query string from params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await listWords({ language: "fr", limit: 5 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("language=fr");
    expect(url).toContain("limit=5");
  });

  it("listTags calls GET /api/tags", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: "academic" }]),
    });

    const result = await listTags();
    expect(result).toEqual([{ id: 1, name: "academic" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/tags",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-jwt-token",
        }),
      })
    );
  });

  it("createTag sends POST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 2, name: "slang" }),
    });

    const result = await createTag({ name: "slang" });
    expect(result).toEqual({ id: 2, name: "slang" });
  });

  it("suggestDefinition sends POST with payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ definition: "present everywhere" }),
    });

    const result = await suggestDefinition({
      word: "ubiquitous",
      language: "en",
      context_sentence: "Technology is ubiquitous.",
    });

    expect(result.definition).toBe("present everywhere");
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve("Not authenticated"),
    });

    await expect(listTags()).rejects.toThrow("Not authenticated");
  });

  it("sends request without Authorization header when chrome.runtime.lastError is set (lines 17-19)", async () => {
    // Override chrome.runtime.sendMessage to simulate lastError
    const originalSendMessage = chrome.runtime.sendMessage;
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>) = vi.fn(
      (_msg: unknown, cb: (response: unknown) => void) => {
        // Simulate lastError being set during the callback
        Object.defineProperty(chrome.runtime, "lastError", {
          value: { message: "Extension context invalidated" },
          configurable: true,
        });
        cb({ token: "should-be-ignored" });
        // Clean up lastError
        Object.defineProperty(chrome.runtime, "lastError", {
          value: null,
          configurable: true,
        });
      }
    );

    const mockTags = [{ id: 1, name: "test" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTags),
    });

    const result = await listTags();
    expect(result).toEqual(mockTags);

    // Verify no Authorization header was sent (token was null due to lastError)
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty("Authorization");

    // Restore
    chrome.runtime.sendMessage = originalSendMessage;
  });
});
