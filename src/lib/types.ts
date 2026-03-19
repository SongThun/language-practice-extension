export interface Word {
  id: number;
  word: string;
  definition: string;
  language: string;
  context_sentence: string | null;
  user_id: string;
  box: number;
  last_practiced: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  user_id: string;
  created_at: string;
}

export interface CreateWordPayload {
  word: string;
  definition: string;
  language: string;
  context_sentence?: string;
  tag_ids?: number[];
}

export interface CreateTagPayload {
  name: string;
}

export interface SuggestDefinitionPayload {
  word: string;
  context_sentence?: string;
  language: string;
}

export interface SuggestDefinitionResponse {
  definition: string;
}

export interface ListWordsParams {
  language?: string;
  tag?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export type MessageType =
  | "GET_SESSION"
  | "GET_AUTH_TOKEN"
  | "SIGN_OUT"
  | "SESSION_UPDATED";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
}

export interface SelectionData {
  text: string;
  sentence: string;
  rect: { top: number; left: number; bottom: number; width: number };
}
