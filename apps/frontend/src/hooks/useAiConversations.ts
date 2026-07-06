import { useCallback, useEffect, useState } from 'react';
import { AiConversation, AiMessage, AiRound, ProposedChange } from '../types/ai';

const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 40;

function storageKey(sessionId: string) {
  return `tt.aiConversations.${sessionId}`;
}

// Older stored conversations kept a single top-level `content`/`toolCalls` pair
// per assistant message instead of the `rounds` array. Normalize on read so old
// history still displays and builds correct API history.
function normalizeMessage(m: AiMessage): AiMessage {
  if (m.role !== 'assistant' || m.rounds) return m;
  if (!m.content && !m.toolCalls?.length) return { ...m, rounds: [] };
  return { ...m, rounds: [{ content: m.content, toolCalls: m.toolCalls }] };
}

function readConversations(sessionId: string): AiConversation[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c: AiConversation) => ({ ...c, messages: c.messages.map(normalizeMessage) }));
  } catch {
    return [];
  }
}

function writeConversations(sessionId: string, conversations: AiConversation[]) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(conversations));
  } catch {
    // localStorage unavailable/full — history just won't persist across reloads
  }
}

function makeTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New conversation';
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

export function useAiConversations(sessionId: string | undefined) {
  const [conversations, setConversations] = useState<AiConversation[]>(() =>
    sessionId ? readConversations(sessionId) : [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setConversations([]);
      setActiveId(null);
      return;
    }
    const loaded = readConversations(sessionId);
    setConversations(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, [sessionId]);

  // `persist` uses a functional state update so it always operates on the latest
  // conversations, even when called from a callback whose closure was created
  // before an `await` (e.g. after a streamed AI response resolves). Capturing
  // `conversations` directly here would silently drop concurrent updates
  // (like the user's message) once the stale closure overwrites storage.
  const persist = useCallback(
    (updater: (prev: AiConversation[]) => AiConversation[]) => {
      if (!sessionId) return;
      setConversations((prev) => {
        const next = updater(prev);
        const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const capped = sorted.slice(0, MAX_CONVERSATIONS);
        writeConversations(sessionId, capped);
        return capped;
      });
    },
    [sessionId],
  );

  const createConversation = useCallback((): string => {
    const now = new Date().toISOString();
    const conversation: AiConversation = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    persist((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    return conversation.id;
  }, [persist]);

  const deleteConversation = useCallback(
    (id: string) => {
      const next = conversations.filter((c) => c.id !== id);
      persist((prev) => prev.filter((c) => c.id !== id));
      setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current));
    },
    [conversations, persist],
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      persist((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    },
    [persist],
  );

  const appendMessage = useCallback(
    (conversationId: string, message: AiMessage) => {
      const now = new Date().toISOString();
      persist((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages, message];
          const title = c.title === 'New conversation' && message.role === 'user' ? makeTitle(message.content) : c.title;
          return { ...c, messages, updatedAt: now, title };
        }),
      );
    },
    [persist],
  );

  // Patches a single tool call's status, wherever its round lives within the message.
  const updateToolCallStatus = useCallback(
    (conversationId: string, messageId: string, toolCallId: string, patch: Partial<ProposedChange>) => {
      persist((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== messageId || !m.rounds) return m;
              return {
                ...m,
                rounds: m.rounds.map((r) =>
                  r.toolCalls
                    ? { ...r, toolCalls: r.toolCalls.map((tc) => (tc.id === toolCallId ? { ...tc, ...patch } : tc)) }
                    : r,
                ),
              };
            }),
          };
        }),
      );
    },
    [persist],
  );

  // Appends a new round (follow-up text and/or chained tool calls) to an existing
  // assistant message, instead of creating a brand-new message for what is really
  // a continuation of the same AI turn. Keeping rounds as an ordered array (rather
  // than merging text into one `content` string) lets buildHistory reconstruct
  // the exact assistant/tool-result alternation the API expects.
  const appendRound = useCallback(
    (conversationId: string, messageId: string, round: AiRound) => {
      const now = new Date().toISOString();
      persist((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            updatedAt: now,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, rounds: [...(m.rounds ?? []), round] } : m,
            ),
          };
        }),
      );
    },
    [persist],
  );

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    renameConversation,
    appendMessage,
    updateToolCallStatus,
    appendRound,
  };
}
