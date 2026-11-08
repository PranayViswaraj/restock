// One interface for every LLM provider:
//
//   chat({ system, messages, tools, mock }) -> { text, toolCalls: [{id, name, args}], raw }
//
// Neutral message format used by the agent:
//   { role: 'user', content }
//   { role: 'assistant', content, toolCalls: [{id, name, args}], raw }
//   { role: 'tool', toolCallId, name, content }   // content = JSON string
//
// Providers (LLM_PROVIDER):
//   gemini -> Google Gemini API (free tier) via @google/genai
//   groq   -> Groq API (free tier), OpenAI-compatible endpoint, plain fetch
//   mock   -> no API at all; the caller supplies a `mock` function (rule-based)
// Mock is used automatically when USE_MOCK_LLM=true or the API key is missing.
import { GoogleGenAI } from '@google/genai';
import { flag } from '../env.js';

const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b-versatile' };

export function providerInfo() {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  const key = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
  const mock = flag('USE_MOCK_LLM') || !key || !['gemini', 'groq'].includes(provider);
  return {
    provider: mock ? 'mock' : provider,
    model: mock ? 'rule-based planner' : process.env.LLM_MODEL || DEFAULT_MODELS[provider],
    mock,
  };
}

/** Friendly error for the dashboard; keeps the raw message for the audit log. */
export class LLMError extends Error {
  constructor(message, { status, raw } = {}) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Call the configured LLM. Retries ONCE with backoff on failure (rate limits are common on free tiers). */
export async function chat({ system, messages, tools = [], mock }) {
  const info = providerInfo();
  if (info.mock) {
    if (!mock) throw new LLMError('Mock LLM mode is on but no mock handler was provided.');
    return mock({ system, messages, tools });
  }
  const call = info.provider === 'groq' ? groqChat : geminiChat;
  try {
    return await call({ system, messages, tools, model: info.model });
  } catch (err) {
    const isRateLimit = err.status === 429;
    const waitMs = isRateLimit ? 6000 : 2000;
    console.warn(`[llm] ${info.provider} call failed (${err.status || 'network'}): ${err.message}. Retrying in ${waitMs / 1000}s…`);
    await sleep(waitMs);
    try {
      return await call({ system, messages, tools, model: info.model });
    } catch (err2) {
      const friendly = err2.status === 429
        ? `The ${info.provider} free tier is rate-limiting us right now. Wait a minute and try again (or set USE_MOCK_LLM=true for the demo).`
        : `The AI service (${info.provider}) is unavailable: ${err2.message}`;
      throw new LLMError(friendly, { status: err2.status, raw: err2.message });
    }
  }
}

// ---------------------------------------------------------------- Gemini
let geminiClient = null;
function gemini() {
  geminiClient ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return geminiClient;
}

function toGeminiContents(messages) {
  const contents = [];
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      // Replay Gemini's own parts verbatim when we have them: newer models attach
      // "thought signatures" to function calls and require them back.
      const parts = m.raw?.geminiParts || [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.toolCalls || []).map((tc) => ({ functionCall: { name: tc.name, args: tc.args } })),
      ];
      contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      let response;
      try { response = JSON.parse(m.content); } catch { response = { result: m.content }; }
      if (Array.isArray(response) || typeof response !== 'object' || response === null) response = { result: response };
      const part = { functionResponse: { name: m.name, response } };
      // Merge consecutive tool results into one user turn (Gemini expects that).
      const last = contents[contents.length - 1];
      if (last?.role === 'user' && last.parts.every((p) => p.functionResponse)) last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }
  return contents;
}

async function geminiChat({ system, messages, tools, model }) {
  const config = { systemInstruction: system, temperature: 0.2 };
  if (tools.length) {
    config.tools = [{
      functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })),
    }];
  }
  let response;
  try {
    response = await gemini().models.generateContent({ model, contents: toGeminiContents(messages), config });
  } catch (err) {
    // @google/genai errors carry an HTTP status on .status; the message is often raw JSON.
    let message = err.message || 'Gemini request failed';
    try { message = JSON.parse(message).error?.message || message; } catch { /* not JSON */ }
    const e = new Error(message.slice(0, 500));
    e.status = err.status || (/429|RESOURCE_EXHAUSTED/.test(err.message) ? 429 : undefined);
    throw e;
  }
  const parts = response.candidates?.[0]?.content?.parts || [];
  const toolCalls = (response.functionCalls || []).map((fc, i) => ({
    id: fc.id || `gem-${Date.now()}-${i}`,
    name: fc.name,
    args: fc.args || {},
  }));
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
  return { text, toolCalls, raw: { geminiParts: parts } };
}

// ---------------------------------------------------------------- Groq (OpenAI-compatible)
function toOpenAIMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || null };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        }));
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

async function groqChat({ system, messages, tools, model }) {
  const body = { model, temperature: 0.2, messages: toOpenAIMessages(system, messages) };
  if (tools.length) {
    body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    body.tool_choice = 'auto';
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error?.message || `Groq HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const msg = data.choices?.[0]?.message || {};
  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* model sent bad JSON; tool will report it */ }
    return { id: tc.id, name: tc.function.name, args };
  });
  return { text: (msg.content || '').trim(), toolCalls, raw: null };
}
