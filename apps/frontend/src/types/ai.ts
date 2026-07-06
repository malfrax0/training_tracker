export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** null = not yet tested, true/false = cached auto-detect result for this config */
  toolsSupported: boolean | null;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseUrl: 'http://localhost:1234',
  apiKey: '',
  model: 'mistralai/ministral-3-3b',
  toolsSupported: null,
};

export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiToolName =
  | 'update_session_meta'
  | 'update_schedule'
  | 'add_exercise'
  | 'update_exercise'
  | 'delete_exercise'
  | 'reorder_exercises';

export type ProposedChangeStatus = 'pending' | 'approved' | 'rejected' | 'error';

export interface ProposedChange {
  id: string;
  toolName: AiToolName;
  args: Record<string, unknown>;
  status: ProposedChangeStatus;
  errorMessage?: string;
}

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  toolCalls?: ProposedChange[];
  /**
   * Assistant messages only. An ordered sequence of (text, optional tool calls)
   * round-trips that make up a single visual turn. Each round after the first
   * represents the AI's follow-up reply once the previous round's tool calls
   * were resolved. Storing these separately (instead of merging follow-up text
   * into a single `content` string) is required so the history sent back to the
   * API can be reconstructed with correct assistant/tool role alternation —
   * merging would leave a tool result answered by nothing before the next user
   * message, which most chat templates reject.
   */
  rounds?: AiRound[];
  createdAt: string;
}

export interface AiRound {
  content: string;
  toolCalls?: ProposedChange[];
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiMessage[];
}
