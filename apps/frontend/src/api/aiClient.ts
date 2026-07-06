import { AiConfig } from '../types/ai';
import { AI_TOOL_SCHEMAS } from './aiTools';

export interface RawToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Present on assistant messages that proposed tool calls. */
  tool_calls?: RawToolCall[];
  /** Present on 'tool' role messages — must match the id of the tool_call it answers. */
  tool_call_id?: string;
  /** Present on 'tool' role messages — the name of the function that was called. */
  name?: string;
}

export interface StreamResult {
  content: string;
  toolCalls: RawToolCall[];
}

export interface StreamCallbacks {
  onDelta?: (textDelta: string) => void;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

function looksLikeToolCallingUnsupported(message: string): boolean {
  return /tool|function[_ ]?call/i.test(message);
}

interface StreamDelta {
  content?: string;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

async function requestChatCompletion(
  config: AiConfig,
  messages: ChatMessageInput[],
  useTools: boolean,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const url = buildChatCompletionsUrl(config.baseUrl);
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
  };
  if (useTools) {
    body.tools = AI_TOOL_SCHEMAS;
    body.tool_choice = 'auto';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice(5).trim();
      if (dataStr === '[DONE]') continue;

      let json: { choices?: Array<{ delta?: StreamDelta }> };
      try {
        json = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const delta = json.choices?.[0]?.delta;
      if (!delta) continue;

      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        callbacks.onDelta?.(delta.content);
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const index = tc.index ?? 0;
          const existing = toolCallBuffers.get(index) ?? { id: '', name: '', args: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCallBuffers.set(index, existing);
        }
      }
    }
  }

  const toolCalls: RawToolCall[] = Array.from(toolCallBuffers.values())
    .filter((tc) => tc.name)
    .map((tc, i) => ({
      id: tc.id || `call_${i}`,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.args },
    }));

  return { content, toolCalls };
}

export async function streamChatCompletion(
  config: AiConfig,
  messages: ChatMessageInput[],
  callbacks: StreamCallbacks = {},
): Promise<{ result: StreamResult; toolsSupported: boolean }> {
  const attemptTools = config.toolsSupported !== false;

  if (attemptTools) {
    try {
      const result = await requestChatCompletion(config, messages, true, callbacks);
      return { result, toolsSupported: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (config.toolsSupported === null && looksLikeToolCallingUnsupported(message)) {
        const result = await requestChatCompletion(config, messages, false, callbacks);
        return { result, toolsSupported: false };
      }
      throw err;
    }
  }

  const result = await requestChatCompletion(config, messages, false, callbacks);
  return { result, toolsSupported: false };
}

export async function testAiConnection(config: AiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const url = buildChatCompletionsUrl(config.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
        stream: false,
        max_tokens: 5,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, message: text || `HTTP ${response.status}` };
    }
    return { ok: true, message: 'Connection successful.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
  }
}
