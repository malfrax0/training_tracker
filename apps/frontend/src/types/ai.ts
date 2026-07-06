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
  | 'reorder_exercises'
  | 'search_exercise_image'
  | 'get_exercises';

export type ProposedChangeStatus = 'pending' | 'approved' | 'rejected' | 'error';

export interface ProposedChange {
  id: string;
  toolName: AiToolName;
  args: Record<string, unknown>;
  status: ProposedChangeStatus;
  errorMessage?: string;
  /**
   * Present when this change is one of several mutually-exclusive candidates
   * generated from a single `search_exercise_image` tool call (one per photo
   * result). Approving one pending change that shares a `groupId` should
   * auto-reject the other pending siblings with the same id, since only one
   * photo can end up applied.
   */
  groupId?: string;
  /** 1-based position of this candidate within its group, for display (e.g. "Option 2 of 4"). */
  groupIndex?: number;
  /** Total number of candidates in this group, for display. */
  groupTotal?: number;
  /**
   * The name of the tool the model actually called to produce this group (e.g.
   * `search_exercise_image`) — NOT `toolName` above, which for a group member
   * is the synthetic `update_exercise` used to apply that one candidate.
   * Needed so the API history can be reconstructed showing the model's real
   * tool call (and a single summarized result) instead of several calls it
   * never made — otherwise the model never sees its actual call answered and
   * will just call it again, looping.
   */
  groupToolName?: AiToolName;
  /** The original arguments the model passed to `groupToolName`, for history reconstruction. */
  groupArgs?: Record<string, unknown>;
  /**
   * Overrides the generic status-based text from `toolResultContent()` when
   * reconstructing history — used for read-only, auto-resolved informational
   * tool calls (e.g. `get_exercises`) whose "result" IS this data, not a
   * generic applied/rejected/error status.
   */
  resultContent?: string;
  /**
   * When true, this entry is never rendered as a ProposedChangeCard (it's not
   * a change the user needs to review — e.g. a read-only `get_exercises` call
   * that already auto-resolved). It still participates in `buildHistory` so
   * the model's real tool call is answered.
   */
  hidden?: boolean;
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
