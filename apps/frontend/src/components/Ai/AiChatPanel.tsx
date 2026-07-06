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
import { useExerciseImagesApi } from '../../api/exerciseImages';
import { useSessionsApi } from '../../api/sessions';
import { Session } from '../../types';
import { AiMessage, AiRound, ProposedChange } from '../../types/ai';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ProposedChangeCard } from './ProposedChangeCard';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { SYSTEM_PROMPT } from './systemPrompt';

const AUTO_APPROVE_STORAGE_KEY = 'tt.aiAutoApprove';
// Caps how many times we automatically re-prompt the model in a row when a
// round's tool call(s) resolved with nothing left pending for the user to act
// on (e.g. every call errored immediately, like a JSON parse failure). Without
// this cap, a model that keeps producing the same broken call would loop
// forever with no user action to break out of it.
const MAX_AUTO_CONTINUE_DEPTH = 3;

// True once a round's tool calls have nothing left for the user to approve or
// reject (i.e. every one already resolved to approved/rejected/error) — used
// to decide whether we must tell the model about the outcome ourselves,
// because in that case no approve/reject click will ever happen to trigger it.
function isFullyResolved(toolCalls: ProposedChange[] | undefined): toolCalls is ProposedChange[] {
  return Boolean(toolCalls?.length) && toolCalls!.every((tc) => tc.status !== 'pending');
}

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

function buildExerciseSnapshots(session: Session) {
  return session.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    nbSeries: e.nbSeries,
    defaultWeightKg: e.defaultWeightKg,
    defaultReps: e.defaultReps,
    restTimerSeconds: e.restTimerSeconds,
    dumbbellType: e.dumbbellType,
    sortOrder: e.sortOrder,
  }));
}

function buildSessionSnapshot(session: Session): string {
  return JSON.stringify(
    {
      id: session.id,
      name: session.name,
      description: session.description,
      schedule: session.schedule,
      exercises: buildExerciseSnapshots(session),
    },
    null,
    2,
  );
}

function toolResultContent(change: ProposedChange): string {
  if (change.resultContent !== undefined) return change.resultContent;
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

/**
 * Summarizes the outcome of an entire group of mutually-exclusive candidates
 * (e.g. the 4 photo options from one `search_exercise_image` call) as a single
 * tool result, matching the ONE tool call the model actually made. Without
 * this, the model would need to see 4 separate `update_exercise` results for
 * calls it never issued, which it can't reconcile with what it asked for.
 */
function summarizeGroupOutcome(children: ProposedChange[]): string {
  const approved = children.find((c) => c.status === 'approved');
  if (approved) {
    return `The user reviewed the candidates and picked option ${approved.groupIndex} of ${approved.groupTotal}. It was applied successfully.`;
  }
  if (children.some((c) => c.status === 'pending')) {
    return 'The user has not yet reviewed these candidates.';
  }
  const errored = children.find((c) => c.status === 'error');
  if (errored) {
    return `Applying the selected candidate failed: ${errored.errorMessage ?? 'unknown error'}`;
  }
  return 'The user rejected all candidates. Nothing was applied.';
}

/**
 * Turns raw tool calls from the model into ProposedChange entries. Most tools
 * map 1:1 to a single pending change. `search_exercise_image` is special: it is
 * resolved right here (calling our backend's exercise-image-search proxy)
 * rather than left for the user to approve/reject as-is, because there's
 * nothing to "apply" about a search — instead its up-to-4 results are fanned
 * out into that many sibling `update_exercise` proposals (all sharing a
 * `groupId`), so the user can pick exactly one. This keeps the LLM's job
 * simple (one tool call, one query) while our own code handles turning that
 * into several candidate mutations.
 */
async function resolveToolCalls(
  rawToolCalls: RawToolCall[],
  session: Session,
  searchExerciseImages: (query: string) => Promise<{ id: string; url: string; description: string }[]>,
): Promise<ProposedChange[]> {
  const resolved: ProposedChange[] = [];

  for (const tc of rawToolCalls) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || '{}');
    } catch {
      resolved.push({
        id: tc.id,
        toolName: tc.function.name as ProposedChange['toolName'],
        args: {},
        status: 'error',
        errorMessage: 'Failed to parse tool arguments',
      });
      continue;
    }

    if (tc.function.name === 'get_exercises') {
      resolved.push({
        id: tc.id,
        toolName: 'get_exercises',
        args: {},
        status: 'approved',
        hidden: true,
        resultContent: JSON.stringify(buildExerciseSnapshots(session), null, 2),
      });
      continue;
    }

    if (tc.function.name === 'search_exercise_image') {
      const exerciseId = typeof args.exerciseId === 'string' ? args.exerciseId : undefined;
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      const exercise = exerciseId ? session.exercises.find((e) => e.id === exerciseId) : undefined;

      if (!exercise) {
        resolved.push({
          id: tc.id,
          toolName: 'search_exercise_image',
          args,
          status: 'error',
          errorMessage: 'exerciseId does not belong to the current session',
        });
        continue;
      }
      if (!query) {
        resolved.push({ id: tc.id, toolName: 'search_exercise_image', args, status: 'error', errorMessage: 'query is required' });
        continue;
      }

      try {
        const images = await searchExerciseImages(query);
        if (images.length === 0) {
          resolved.push({
            id: tc.id,
            toolName: 'search_exercise_image',
            args,
            status: 'error',
            errorMessage: `No images found for "${query}". You may retry with a broader or differently-worded query.`,
          });
          continue;
        }
        images.forEach((image, i) => {
          resolved.push({
            id: `${tc.id}_${i}`,
            toolName: 'update_exercise',
            args: { exerciseId, imageData: image.url },
            status: 'pending',
            groupId: tc.id,
            groupIndex: i + 1,
            groupTotal: images.length,
            groupToolName: 'search_exercise_image',
            groupArgs: args,
          });
        });
      } catch (err) {
        resolved.push({
          id: tc.id,
          toolName: 'search_exercise_image',
          args,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Image search failed',
        });
      }
      continue;
    }

    resolved.push({ id: tc.id, toolName: tc.function.name as ProposedChange['toolName'], args, status: 'pending' });
  }

  return resolved;
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
 *
 * Grouped candidates (multiple `update_exercise` ProposedChanges sharing a
 * `groupId`, generated from a single `search_exercise_image` call) are
 * collapsed back into the ONE tool call the model actually issued, with a
 * single summarized result — otherwise the model would see several
 * `update_exercise` calls/results for a tool it never called, can't reconcile
 * that with its own request, and ends up re-issuing the search every follow-up
 * turn instead of treating it as resolved.
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
      const rawCalls = round.toolCalls ?? [];
      const seenGroups = new Set<string>();
      const entries: { id: string; name: string; args: Record<string, unknown>; resultContent: string }[] = [];

      for (const tc of rawCalls) {
        if (tc.groupId) {
          if (seenGroups.has(tc.groupId)) continue;
          seenGroups.add(tc.groupId);
          const siblings = rawCalls.filter((c) => c.groupId === tc.groupId);
          entries.push({
            id: tc.groupId,
            name: tc.groupToolName ?? tc.toolName,
            args: tc.groupArgs ?? {},
            resultContent: summarizeGroupOutcome(siblings),
          });
        } else {
          entries.push({ id: tc.id, name: tc.toolName, args: tc.args, resultContent: toolResultContent(tc) });
        }
      }

      const toolCalls: RawToolCall[] | undefined = entries.length
        ? entries.map((e) => ({
            id: e.id,
            type: 'function' as const,
            function: { name: e.name, arguments: JSON.stringify(e.args) },
          }))
        : undefined;

      history.push({
        role: 'assistant',
        content: round.content,
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
      });

      if (toolCalls) {
        for (const e of entries) {
          history.push({
            role: 'tool',
            tool_call_id: e.id,
            name: e.name,
            content: e.resultContent,
          });
        }
      }
    }
  }
  return history;
}

export function AiChatPanel({ open, onClose, session, onSessionChanged }: Props) {
  const { config, setToolsSupported, isConfigured } = useAiConfig();
  const { searchExerciseImages } = useExerciseImagesApi();
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

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendMessage(conversationId, userMessage);

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

      const toolCalls = await resolveToolCalls(result.toolCalls, session, searchExerciseImages);

      const assistantMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        rounds: [{ content: result.content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }],
        createdAt: new Date().toISOString(),
      };
      appendMessage(conversationId, assistantMessage);

      if (isFullyResolved(toolCalls)) {
        await runFollowUp(conversationId, assistantMessage.id, [...baseMessages, userMessage, assistantMessage]);
        return;
      }
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
  const runFollowUp = async (
    conversationId: string,
    messageId: string,
    messagesForHistory: AiMessage[],
    depth = 0,
  ) => {
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

      const newToolCalls = await resolveToolCalls(result.toolCalls, session, searchExerciseImages);
      const newRound: AiRound = { content: result.content, toolCalls: newToolCalls.length > 0 ? newToolCalls : undefined };
      appendRound(conversationId, messageId, newRound);

      // Nothing pending means there's no approve/reject click left to trigger the
      // next step (e.g. every tool call in this round errored immediately, such
      // as a JSON parse failure) — the model must be told the outcome itself, or
      // the conversation would just go silent. Depth-capped to avoid looping
      // forever if the model keeps producing the same broken call.
      if (isFullyResolved(newToolCalls)) {
        if (depth + 1 >= MAX_AUTO_CONTINUE_DEPTH) {
          setSendError('The AI kept failing to complete this action after several attempts. Try rephrasing your request.');
          return;
        }
        const updatedMessages = messagesForHistory.map((m) =>
          m.id === messageId ? { ...m, rounds: [...(m.rounds ?? []), newRound] } : m,
        );
        await runFollowUp(conversationId, messageId, updatedMessages, depth + 1);
      }
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
      // If this change is one of several GIF candidates from the same search
      // (shares a groupId), only one can actually be applied — auto-reject the
      // other pending siblings so the round resolves as a whole.
      updatedToolCalls = round.toolCalls.map((tc) => {
        if (tc.id === change.id) return { ...tc, status: 'approved' as const };
        if (change.groupId && tc.groupId === change.groupId && tc.status === 'pending') {
          return { ...tc, status: 'rejected' as const };
        }
        return tc;
      });
      updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'approved' });
      if (change.groupId) {
        for (const tc of round.toolCalls) {
          if (tc.id !== change.id && tc.groupId === change.groupId && tc.status === 'pending') {
            updateToolCallStatus(activeConversation.id, messageId, tc.id, { status: 'rejected' });
          }
        }
      }
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
    // Only one candidate per GIF group can win — once a group is resolved,
    // reject the remaining siblings instead of applying them too.
    const resolvedGroups = new Set<string>();
    for (const change of pending) {
      if (change.groupId && resolvedGroups.has(change.groupId)) {
        updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'rejected' });
        updatedToolCalls = updatedToolCalls.map((tc) => (tc.id === change.id ? { ...tc, status: 'rejected' as const } : tc));
        continue;
      }
      try {
        await executeToolCall(change.toolName, change.args, { session, api });
        updateToolCallStatus(activeConversation.id, messageId, change.id, { status: 'approved' });
        updatedToolCalls = updatedToolCalls.map((tc) => (tc.id === change.id ? { ...tc, status: 'approved' as const } : tc));
        anyApplied = true;
        if (change.groupId) resolvedGroups.add(change.groupId);
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
                      // Bulk "approve all" only makes sense for independent changes —
                      // GIF candidates within a group are mutually exclusive, so they're
                      // excluded from the count/action and must be picked individually.
                      const bulkApprovable = round.toolCalls?.filter((tc) => tc.status === 'pending' && !tc.groupId) ?? [];
                      // Hidden entries (e.g. auto-resolved get_exercises lookups) are not
                      // a change for the user to review — they exist only so buildHistory
                      // can answer the model's real tool call, never rendered as a card.
                      const visibleToolCalls = round.toolCalls?.filter((tc) => !tc.hidden) ?? [];
                      return (
                        <Box key={roundIndex}>
                          <ChatMessageBubble role={message.role} content={round.content} />
                          {visibleToolCalls.map((change, idx, arr) => {
                            const isFirstInGroup = Boolean(
                              change.groupId && arr.findIndex((c) => c.groupId === change.groupId) === idx,
                            );
                            const exerciseName = change.groupId
                              ? session.exercises.find((e) => e.id === change.args.exerciseId)?.name
                              : undefined;
                            return (
                              <Box key={change.id}>
                                {isFirstInGroup && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    Choose a photo{exerciseName ? ` for "${exerciseName}"` : ''}:
                                  </Typography>
                                )}
                                <ProposedChangeCard
                                  change={change}
                                  session={session}
                                  onApprove={() => handleApprove(message.id, change)}
                                  onReject={() => handleReject(message.id, change)}
                                  disabled={sending}
                                />
                              </Box>
                            );
                          })}
                          {bulkApprovable.length > 1 && (
                            <Button
                              size="small"
                              variant="text"
                              sx={{ mt: 0.5 }}
                              disabled={sending}
                              onClick={() => approveAllPending(message.id, { ...round, toolCalls: bulkApprovable })}
                              data-cy="ai-approve-all-btn"
                            >
                              Approve all ({bulkApprovable.length})
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
