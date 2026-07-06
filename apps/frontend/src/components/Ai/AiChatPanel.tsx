import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAiConfig } from '../../hooks/useAiConfig';
import { useAiConversations } from '../../hooks/useAiConversations';
import { ChatMessageInput, RawToolCall, streamChatCompletion } from '../../api/aiClient';
import { executeToolCall } from '../../api/aiTools';
import { useSessionsApi } from '../../api/sessions';
import { Session } from '../../types';
import { AiMessage, AiRound, ProposedChange } from '../../types/ai';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ProposedChangeCard } from './ProposedChangeCard';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { SYSTEM_PROMPT } from './systemPrompt';

const AUTO_APPROVE_STORAGE_KEY = 'tt.aiAutoApprove';

function readAutoApprove(): boolean {
  try {
    return localStorage.getItem(AUTO_APPROVE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  session: Session;
  onSessionChanged: () => Promise<void>;
}

function buildSessionSnapshot(session: Session): string {
  return JSON.stringify(
    {
      id: session.id,
      name: session.name,
      description: session.description,
      schedule: session.schedule,
      exercises: session.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        nbSeries: e.nbSeries,
        defaultWeightKg: e.defaultWeightKg,
        defaultReps: e.defaultReps,
        restTimerSeconds: e.restTimerSeconds,
        dumbbellType: e.dumbbellType,
        sortOrder: e.sortOrder,
      })),
    },
    null,
    2,
  );
}

function toolResultContent(change: ProposedChange): string {
  switch (change.status) {
    case 'approved':
      return 'The change was applied successfully.';
    case 'rejected':
      return 'The user rejected this change. It was not applied.';
    case 'error':
      return `The change failed to apply: ${change.errorMessage ?? 'unknown error'}`;
    case 'pending':
    default:
      return 'The user has not yet reviewed this change.';
  }
}

function parseToolCalls(rawToolCalls: RawToolCall[]): ProposedChange[] {
  return rawToolCalls.map((tc) => {
    try {
      return {
        id: tc.id,
        toolName: tc.function.name as ProposedChange['toolName'],
        args: JSON.parse(tc.function.arguments || '{}'),
        status: 'pending',
      };
    } catch {
      return {
        id: tc.id,
        toolName: tc.function.name as ProposedChange['toolName'],
        args: {},
        status: 'error',
        errorMessage: 'Failed to parse tool arguments',
      };
    }
  });
}

/**
 * Rebuilds the OpenAI-style message history from stored conversation messages,
 * ensuring strict user/assistant alternation. Each assistant message is made of
 * one or more "rounds" (text + optional tool calls); every round with tool calls
 * is immediately followed by matching 'tool' role messages, and if the message
 * has a later round (the AI's follow-up reply after those tool results), that is
 * emitted as its own assistant turn right after — never merged into the earlier
 * turn's content. Most OpenAI-compatible chat templates reject a tool result that
 * isn't immediately answered by an assistant message before the next user turn.
 */
function buildHistory(messages: AiMessage[]): ChatMessageInput[] {
  const history: ChatMessageInput[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      history.push({ role: 'user', content: m.content });
      continue;
    }
    if (m.role !== 'assistant') continue;

    for (const round of m.rounds ?? []) {
      const toolCalls: RawToolCall[] | undefined = round.toolCalls?.length
        ? round.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.toolName, arguments: JSON.stringify(tc.args) },
          }))
        : undefined;

      history.push({
        role: 'assistant',
        content: round.content,
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
      });

      if (toolCalls) {
        for (const tc of round.toolCalls ?? []) {
          history.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.toolName,
            content: toolResultContent(tc),
          });
        }
      }
    }
  }
  return history;
}

export function AiChatPanel({ open, onClose, session, onSessionChanged }: Props) {
  const { config, setToolsSupported, isConfigured } = useAiConfig();
  const {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    appendMessage,
    updateToolCallStatus,
    appendRound,
  } = useAiConversations(session.id);
  const api = useSessionsApi();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(readAutoApprove);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks rounds currently being auto-approved (keyed by message id + tool call
  // ids) so the effect below doesn't kick off duplicate approval runs while one
  // is still in flight for the same round.
  const autoApproveInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_APPROVE_STORAGE_KEY, String(autoApprove));
    } catch {
      // localStorage unavailable — preference just won't persist across reloads
    }
  }, [autoApprove]);

  useEffect(() => {
    if (open && conversations.length === 0) {
      createConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeConversation?.messages.length, streamingText]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    let conversationId = activeId;
    let baseMessages: AiMessage[] = activeConversation?.messages ?? [];
    if (!conversationId) {
      conversationId = createConversation();
      baseMessages = [];
    }

    setInput('');
    setSendError(null);

    appendMessage(conversationId, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    });

    const history = buildHistory(baseMessages);

    const messages: ChatMessageInput[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current session snapshot (JSON):\n${buildSessionSnapshot(session)}` },
      ...history,
      { role: 'user', content: text },
    ];

    setSending(true);
    setStreamingText('');
    try {
      const { result, toolsSupported } = await streamChatCompletion(config, messages, {
        onDelta: (delta) => setStreamingText((prev) => prev + delta),
      });
      if (config.toolsSupported === null) setToolsSupported(toolsSupported);

      const toolCalls = parseToolCalls(result.toolCalls);

      appendMessage(conversationId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        rounds: [{ content: result.content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }],
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to reach the AI endpoint');
    } finally {
      setSending(false);
      setStreamingText('');
    }
  };

  // Continues the same AI turn after its tool call(s) have all been resolved,
  // feeding the tool results back so the model can give a real natural-language
  // reply instead of leaving an empty bubble. The response is appended as a NEW
  // round on the same assistant message (rather than merged into the previous
  // round's content or a brand-new message), so buildHistory can place it, in
  // the API request, right after the tool results it is answering.
  const runFollowUp = async (conversationId: string, messageId: string, messagesForHistory: AiMessage[]) => {
    const history = buildHistory(messagesForHistory);
    const messages: ChatMessageInput[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current session snapshot (JSON):\n${buildSessionSnapshot(session)}` },
      ...history,
    ];

    setSending(true);
    setStreamingText('');
    setSendError(null);
    try {
      const { result, toolsSupported } = await streamChatCompletion(config, messages, {
        onDelta: (delta) => setStreamingText((prev) => prev + delta),
      });
      if (config.toolsSupported === null) setToolsSupported(toolsSupported);

      const newToolCalls = parseToolCalls(result.toolCalls);

      appendRound(conversationId, messageId, {
        content: result.content,
        toolCalls: newToolCalls.length > 0 ? newToolCalls : undefined,
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to reach the AI endpoint');
    } finally {
      setSending(false);
      setStreamingText('');
    }
  };

  // Only continue once every tool call in the round that owns `change` has been
  // resolved (approved/rejected/error) — not while any are still pending.
  const maybeRunFollowUp = async (conversationId: string, messageId: string, updatedToolCalls: ProposedChange[]) => {
    if (updatedToolCalls.some((tc) => tc.status === 'pending')) return;
    if (!activeConversation) return;
    const updatedIds = new Set(updatedToolCalls.map((tc) => tc.id));
    const messagesForHistory = activeConversation.messages.map((m) => {
      if (m.id !== messageId || !m.rounds) return m;
      return {
        ...m,
        rounds: m.rounds.map((r) =>
          r.toolCalls?.some((tc) => updatedIds.has(tc.id)) ? { ...r, toolCalls: updatedToolCalls } : r,
        ),
      };
    });
    await runFollowUp(conversationId, messageId, messagesForHistory);
  };

  const handleApprove = async (messageId: string, change: ProposedChange) => {
    if (!activeConversation) return;
    const message = activeConversation.messages.find((m) => m.id === messageId);
    const round = message?.rounds?.find((r) => r.toolCalls?.some((tc) => tc.id === change.id));
    if (!round?.toolCalls) return;

    let updatedToolCalls: ProposedChange[];
    try {
      await executeToolCall(change.toolName, change.args, { session, api });
      updatedToolCalls = round.toolCalls.map((tc) => (tc.id === change.id ? { ...tc, status: 'approved' as const } : tc));
      updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'approved' });
      await onSessionChanged();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply change';
      updatedToolCalls = round.toolCalls.map((tc) =>
        tc.id === change.id ? { ...tc, status: 'error' as const, errorMessage } : tc,
      );
      updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'error', errorMessage });
    }
    await maybeRunFollowUp(activeConversation.id, messageId, updatedToolCalls);
  };

  const handleReject = async (messageId: string, change: ProposedChange) => {
    if (!activeConversation) return;
    const message = activeConversation.messages.find((m) => m.id === messageId);
    const round = message?.rounds?.find((r) => r.toolCalls?.some((tc) => tc.id === change.id));
    if (!round?.toolCalls) return;

    const updatedToolCalls = round.toolCalls.map((tc) =>
      tc.id === change.id ? { ...tc, status: 'rejected' as const } : tc,
    );
    updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'rejected' });
    await maybeRunFollowUp(activeConversation.id, messageId, updatedToolCalls);
  };

  // Approves every currently-pending tool call within a single round in sequence,
  // applying each via executeToolCall, then triggers at most one onSessionChanged
  // refresh and one AI follow-up once the whole round is resolved. Shared by the
  // "Approve All" button and the auto-approve effect below.
  const approveAllPending = async (messageId: string, round: AiRound) => {
    if (!activeConversation || !round.toolCalls) return;
    const pending = round.toolCalls.filter((tc) => tc.status === 'pending');
    if (pending.length === 0) return;

    let updatedToolCalls = round.toolCalls;
    let anyApplied = false;
    for (const change of pending) {
      try {
        await executeToolCall(change.toolName, change.args, { session, api });
        updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'approved' });
        updatedToolCalls = updatedToolCalls.map((tc) => (tc.id === change.id ? { ...tc, status: 'approved' as const } : tc));
        anyApplied = true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to apply change';
        updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'error', errorMessage });
        updatedToolCalls = updatedToolCalls.map((tc) =>
          tc.id === change.id ? { ...tc, status: 'error' as const, errorMessage } : tc,
        );
      }
    }
    if (anyApplied) await onSessionChanged();
    await maybeRunFollowUp(activeConversation.id, messageId, updatedToolCalls);
  };

  // When auto-approve is on, automatically resolve any newly arrived round's
  // pending tool calls as soon as they show up in state. Runs as an effect
  // (rather than being called right after appendMessage/appendRound) so it
  // always reads the freshly committed `activeConversation`, avoiding the stale
  // closures that plagued the manual per-change handlers. `autoApproveInFlight`
  // guards against re-triggering for a round that's already being processed.
  useEffect(() => {
    if (!autoApprove || !activeConversation) return;
    for (const message of activeConversation.messages) {
      if (message.role !== 'assistant') continue;
      for (const round of message.rounds ?? []) {
        const pending = round.toolCalls?.filter((tc) => tc.status === 'pending') ?? [];
        if (pending.length === 0) continue;
        const key = `${message.id}:${round.toolCalls?.map((tc) => tc.id).join(',')}`;
        if (autoApproveInFlight.current.has(key)) continue;
        autoApproveInFlight.current.add(key);
        approveAllPending(message.id, round).finally(() => autoApproveInFlight.current.delete(key));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApprove, activeConversation]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      data-cy="ai-chat-panel"
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" alignItems="center" sx={{ p: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <IconButton onClick={() => setSidebarOpen((v) => !v)} data-cy="ai-toggle-sidebar-btn">
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, ml: 1 }} fontWeight={600}>
            AI Assistant
          </Typography>
          <IconButton onClick={() => createConversation()} data-cy="ai-new-conversation-btn">
            <AddIcon />
          </IconButton>
          <IconButton onClick={onClose} data-cy="ai-close-btn">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Checkbox
                size="small"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                data-cy="ai-auto-approve-checkbox"
              />
            }
            label={<Typography variant="caption">Auto-approve changes</Typography>}
          />
        </Stack>

        {sidebarOpen && (
          <List dense sx={{ maxHeight: 200, overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {conversations.map((c) => (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                onClick={() => {
                  setActiveId(c.id);
                  setSidebarOpen(false);
                }}
                data-cy="ai-conversation-item"
              >
                <ListItemText primary={c.title} secondary={new Date(c.updatedAt).toLocaleString()} />
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(c.id);
                  }}
                  data-cy="ai-delete-conversation-btn"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        )}

        {!isConfigured ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">Configure an AI provider in Profile to use the assistant.</Alert>
          </Box>
        ) : (
          <>
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5 }} data-cy="ai-message-list">
              {(activeConversation?.messages ?? []).map((message) => (
                <Box key={message.id} sx={{ mb: 1.5 }}>
                  {message.role === 'user' ? (
                    <ChatMessageBubble role={message.role} content={message.content} />
                  ) : (
                    (message.rounds ?? []).map((round, roundIndex) => {
                      const pendingCount = round.toolCalls?.filter((tc) => tc.status === 'pending').length ?? 0;
                      return (
                        <Box key={roundIndex}>
                          <ChatMessageBubble role={message.role} content={round.content} />
                          {round.toolCalls?.map((change) => (
                            <ProposedChangeCard
                              key={change.id}
                              change={change}
                              session={session}
                              onApprove={() => handleApprove(message.id, change)}
                              onReject={() => handleReject(message.id, change)}
                              disabled={sending}
                            />
                          ))}
                          {pendingCount > 1 && (
                            <Button
                              size="small"
                              variant="text"
                              sx={{ mt: 0.5 }}
                              disabled={sending}
                              onClick={() => approveAllPending(message.id, round)}
                              data-cy="ai-approve-all-btn"
                            >
                              Approve all ({pendingCount})
                            </Button>
                          )}
                        </Box>
                      );
                    })
                  )}
                </Box>
              ))}
              {sending && <ChatMessageBubble role="assistant" content={streamingText} />}
            </Box>

            {sendError && (
              <Alert severity="error" sx={{ mx: 1.5, mb: 1 }} onClose={() => setSendError(null)}>
                {sendError}
              </Alert>
            )}

            <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask the AI to adjust this session…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
                inputProps={{ 'data-cy': 'ai-message-input' }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                data-cy="ai-send-btn"
              >
                {sending ? <CircularProgress size={20} /> : <SendIcon />}
              </IconButton>
            </Stack>
          </>
        )}
      </Box>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete conversation"
        message="This conversation will be permanently removed from this device."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteConversation(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </Drawer>
  );
}
