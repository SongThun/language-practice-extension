import type {
  Word,
  Tag,
  CreateWordPayload,
  CreateTagPayload,
  SuggestDefinitionPayload,
  SuggestDefinitionResponse,
  ListWordsParams,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not configured");
}

try {
  const parsed = new URL(API_URL);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("VITE_API_URL must use http or https protocol");
  }
} catch (e) {
  if (e instanceof TypeError) {
    throw new Error("VITE_API_URL is not a valid URL");
  }
  throw e;
}

async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_AUTH_TOKEN" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.token ?? null);
    });
  });
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function createWord(payload: CreateWordPayload): Promise<Word> {
  return request<Word>("/api/words", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listWords(params: ListWordsParams = {}): Promise<Word[]> {
  const searchParams = new URLSearchParams();
  if (params.language) searchParams.set("language", params.language);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.keyword) searchParams.set("keyword", params.keyword);
  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined)
    searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const endpoint = `/api/words${query ? `?${query}` : ""}`;
  return request<Word[]>(endpoint);
}

export async function listTags(): Promise<Tag[]> {
  return request<Tag[]>("/api/tags");
}

export async function createTag(payload: CreateTagPayload): Promise<Tag> {
  return request<Tag>("/api/tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function suggestDefinition(
  payload: SuggestDefinitionPayload
): Promise<SuggestDefinitionResponse> {
  return request<SuggestDefinitionResponse>("/api/words/suggest-definition", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
