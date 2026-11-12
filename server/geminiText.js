import { handleTextGenerationRequest as handlePollinationsText } from './pollinationsApi.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = 'gemini-3.1-flash-lite,gemini-3-flash-preview';
const RETRY_STATUSES = new Set([404, 429, 500, 503, 504]);
const MAX_CHARS = 20000;

function env(source, name, fallback = '') {
  const value = source?.[name] ?? process.env[name] ?? fallback;
  return typeof value === 'string' ? value.trim().replace(/^"|"$/g, '') : fallback;
}

function clamp(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function json(status, body) {
  return { status, body, headers: { 'Cache-Control': 'no-store' }, isBinary: false };
}

function buildRequest(payload) {
  const systemParts = [];
  if (payload?.systemPrompt) systemParts.push(String(payload.systemPrompt).slice(0, MAX_CHARS));

  const turns = [];
  const incoming = Array.isArray(payload?.messages) ? payload.messages.slice(-24) : [];
  if (payload?.prompt) incoming.push({ role: 'user', content: payload.prompt });

  for (const message of incoming) {
    const text = String(message?.content || '').slice(0, MAX_CHARS).trim();
    if (!text) continue;
    if (message?.role === 'system') { systemParts.push(text); continue; }
    const role = message?.role === 'assistant' ? 'model' : 'user';
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  }

  if (turns.length && turns[0].role === 'model') turns.unshift({ role: 'user', parts: [{ text: 'Continue.' }] });
  return { systemParts, turns };
}

function thinkingFor(model) {
  if (/2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-3/.test(model)) return { thinkingLevel: 'low' };
  return null;
}

async function callGeminiModel(model, turns, systemParts, payload, source) {
  const body = {
    contents: turns,
    generationConfig: {
      temperature: clamp(payload?.temperature, 0.8, 0, 2),
      topP: clamp(payload?.topP, 0.95, 0, 1),
      maxOutputTokens: clamp(payload?.maxTokens, 1500, 64, 8000),
    },
  };
  if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
  const thinking = thinkingFor(model);
  if (thinking) {
    body.generationConfig.thinkingConfig = thinking;
    // Gemini 3 counts thinking tokens inside maxOutputTokens, so add headroom to avoid cut-off replies.
    if (thinking.thinkingLevel) body.generationConfig.maxOutputTokens += 1024;
  }

  const response = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env(source, 'GEMINI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    const error = new Error(`Gemini ${model} ${response.status}: ${raw.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).filter((part) => !part?.thought).map((part) => part?.text || '').join('').trim();
  if (!text) {
    const error = new Error(`Gemini ${model} returned no text (${data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'unknown'})`);
    error.status = 502;
    throw error;
  }

  return json(200, { text, model: `gemini/${model}`, provider: 'gemini' });
}

async function callGemini(payload, source) {
  const { systemParts, turns } = buildRequest(payload);
  if (!turns.length) return json(400, { error: 'prompt or messages are required' });

  const models = env(source, 'GEMINI_TEXT_MODELS', env(source, 'GEMINI_TEXT_MODEL', DEFAULT_MODELS))
    .split(',').map((m) => m.trim()).filter((m) => /^[a-z0-9.-]+$/i.test(m)).slice(0, 4);

  let lastError = new Error('No Gemini model configured');
  for (const model of models) {
    try {
      return await callGeminiModel(model, turns, systemParts, payload, source);
    } catch (error) {
      lastError = error;
      console.warn('[ai-text]', error.message);
      const retryable = RETRY_STATUSES.has(error.status) || error.status === 502 || error.name === 'TimeoutError';
      if (!retryable) break;
    }
  }
  throw lastError;
}

export async function handleTextRequest(payload, source = process.env) {
  if (env(source, 'GEMINI_API_KEY')) {
    try {
      return await callGemini(payload, source);
    } catch (error) {
      console.error('[ai-text] Gemini failed:', error.message);
      if (!env(source, 'POLLINATIONS_API_KEY')) {
        return json(error.status === 400 ? 400 : 503, { code: 'GEMINI_FAILED', error: 'MAYA is temporarily unavailable' });
      }
    }
  }

  return handlePollinationsText(payload, source);
}