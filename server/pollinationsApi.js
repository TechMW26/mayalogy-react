import { Buffer } from 'node:buffer';

const API_BASE = 'https://gen.pollinations.ai/v1';
const MAX_TEXT_CONTENT_CHARS = 20000;
const MAX_TEXT_REQUEST_CHARS = 100000;
const MAX_VISION_IMAGE_BYTES = 7 * 1024 * 1024;
const MAX_EDIT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_SIZES = new Set(['512x512', '768x768', '1024x1024']);
const DEFAULT_MODELS = Object.freeze({
  text: [
    'mistralai/mistral-small-3.2',
    'openai/gpt-5.4-nano',
  ],
  vision: [
    'qwen/qwen3-vl-30b-a3b-instruct',
    'deepseek/deepseek-v4-flash-vision-exp',
    'openai/gpt-5.4-nano',
  ],
  image: [
    'black-forest-labs/flux.1-schnell',
    'tongyi-mai/z-image-turbo',
    'openai/gpt-image-1-mini',
  ],
  imageEdit: [
    'prunaai/p-image-edit',
    'openai/gpt-image-1-mini',
  ],
  speech: [
    'elevenlabs/eleven-flash-v2.5',
    'elevenlabs/eleven-multilingual-v2',
  ],
});

function jsonResponse(status, body, headers = {}) {
  return { status, body, headers, isBinary: false };
}

function binaryResponse(status, body, headers = {}) {
  return { status, body, headers, isBinary: true };
}

function getEnv(env, name, fallback = '') {
  const value = env?.[name] ?? process.env[name] ?? fallback;
  return typeof value === 'string' ? value.trim() : fallback;
}

function requireKey(env) {
  const key = getEnv(env, 'POLLINATIONS_API_KEY');
  if (!key) {
    const error = new Error('Pollinations is not configured');
    error.status = 503;
    error.code = 'POLLINATIONS_API_KEY_MISSING';
    throw error;
  }
  return key;
}

function getModels(env, kind) {
  const envName = `POLLINATIONS_${kind.replace(/[A-Z]/g, (letter) => `_${letter}`)}_MODELS`.toUpperCase();
  const configured = getEnv(env, envName)
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(value))
    .slice(0, 5);
  return configured.length ? configured : DEFAULT_MODELS[kind];
}

function safeNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function sanitizeSpeechInput(value) {
  return String(value || '')
    .replace(/\[\[pause-(?:250|500|750|1000)\]\]/gi, '… ')
    .replace(/\[(?:pause|softly|whispers?|curious|warm|thoughtful|intrigued)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4096);
}

function normalizeMessages(payload) {
  const messages = (Array.isArray(payload?.messages) ? payload.messages : [])
    .slice(-24)
    .map((message) => ({
      role: ['system', 'assistant', 'user'].includes(message?.role) ? message.role : 'user',
      content: String(message?.content || '').slice(0, MAX_TEXT_CONTENT_CHARS),
    }))
    .filter((message) => message.content.trim());

  if (payload?.prompt) {
    messages.push({ role: 'user', content: String(payload.prompt).slice(0, MAX_TEXT_CONTENT_CHARS) });
  }

  const systemMessage = payload?.systemPrompt
    ? { role: 'system', content: String(payload.systemPrompt).slice(0, MAX_TEXT_CONTENT_CHARS) }
    : null;
  let remaining = MAX_TEXT_REQUEST_CHARS - (systemMessage?.content.length || 0);
  const normalized = [];
  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    const content = message.content.slice(-remaining);
    if (content.trim()) normalized.unshift({ ...message, content });
    remaining -= content.length;
  }
  if (systemMessage?.content.trim()) normalized.unshift(systemMessage);
  return normalized;
}

function parseImageDataUrl(value, maxBytes) {
  const match = String(value || '').trim().match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return null;
  const base64 = match[2];
  if (base64.length % 4 !== 0) return null;
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > maxBytes) return null;
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType, bytes };
}

function safeUpstreamMessage(message) {
  return String(message || 'Pollinations request failed')
    .replace(/sk_[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 500);
}

async function readUpstreamError(response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error || parsed?.message || raw;
  } catch {
    return raw || `Pollinations request failed with status ${response.status}`;
  }
}

async function callWithFallback({ env, kind, path, makeInit, parseResponse }) {
  const key = requireKey(env);
  const models = getModels(env, kind);
  let lastStatus = 502;
  let lastMessage = 'Pollinations request failed';

  for (const model of models) {
    try {
      const requestInit = makeInit(model);
      const response = await fetch(`${API_BASE}${path}`, {
        ...requestInit,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(requestInit.headers || {}),
        },
        signal: AbortSignal.timeout(55000),
      });

      if (response.ok) {
        return await parseResponse(response, model);
      }

      lastStatus = response.status;
      lastMessage = await readUpstreamError(response);
      if (![400, 404, 408, 409, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastStatus = error?.name === 'TimeoutError' ? 504 : 502;
      lastMessage = error?.message || lastMessage;
    }
  }

  const error = new Error(safeUpstreamMessage(lastMessage));
  error.status = lastStatus;
  error.code = lastStatus === 402 ? 'POLLINATIONS_BUDGET_EXHAUSTED' : 'POLLINATIONS_REQUEST_FAILED';
  throw error;
}

export async function handleTextGenerationRequest(payload, env = process.env) {
  const messages = normalizeMessages(payload);
  if (!messages.length) return jsonResponse(400, { error: 'prompt or messages are required' });

  try {
    return await callWithFallback({
      env,
      kind: 'text',
      path: '/chat/completions',
      makeInit: (model) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: safeNumber(payload?.temperature, 0.85, 0, 2),
          top_p: safeNumber(payload?.topP, 0.95, 0, 1),
          max_tokens: safeNumber(payload?.maxTokens, 4000, 64, 12000),
        }),
      }),
      parseResponse: async (response, model) => {
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('Pollinations returned no text');
        return jsonResponse(200, { text, model, provider: 'pollinations' }, { 'Cache-Control': 'no-store' });
      },
    });
  } catch (error) {
    return jsonResponse(error.status || 502, { code: error.code || 'POLLINATIONS_REQUEST_FAILED', error: error.message });
  }
}

export async function handleVisionRequest(payload, env = process.env) {
  const prompt = String(payload?.prompt || '').trim();
  const candidates = Array.isArray(payload?.images) ? payload.images : [payload?.imageData];
  const images = candidates
    .map((image) => parseImageDataUrl(image, MAX_VISION_IMAGE_BYTES))
    .filter(Boolean)
    .slice(0, 2);

  if (!prompt || !images.length) return jsonResponse(400, { error: 'prompt and at least one base64 image are required' });

  try {
    return await callWithFallback({
      env,
      kind: 'vision',
      path: '/chat/completions',
      makeInit: (model) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt.slice(0, MAX_TEXT_CONTENT_CHARS) },
              ...images.map(({ dataUrl }) => ({ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } })),
            ],
          }],
          temperature: safeNumber(payload?.temperature, 0.7, 0, 2),
          max_tokens: safeNumber(payload?.maxTokens, 8000, 128, 16000),
        }),
      }),
      parseResponse: async (response, model) => {
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('Pollinations returned no vision analysis');
        return jsonResponse(200, { text, model, provider: 'pollinations' }, { 'Cache-Control': 'no-store' });
      },
    });
  } catch (error) {
    return jsonResponse(error.status || 502, { code: error.code || 'POLLINATIONS_REQUEST_FAILED', error: error.message });
  }
}

export async function handleImageGenerationRequest(payload, env = process.env) {
  const prompt = String(payload?.prompt || '').trim();
  if (!prompt) return jsonResponse(400, { error: 'prompt is required' });
  const size = payload?.size || '1024x1024';
  if (!ALLOWED_IMAGE_SIZES.has(size)) {
    return jsonResponse(400, { error: 'size must be 512x512, 768x768, or 1024x1024' });
  }

  try {
    return await callWithFallback({
      env,
      kind: 'image',
      path: '/images/generations',
      makeInit: (model) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: prompt.slice(0, 32000),
          n: 1,
          size,
          quality: ['low', 'medium', 'high'].includes(payload?.quality) ? payload.quality : 'medium',
          response_format: 'b64_json',
          safe: true,
        }),
      }),
      parseResponse: async (response, model) => {
        const data = await response.json();
        const item = data?.data?.[0] || {};
        const imageData = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
        if (!imageData) throw new Error('Pollinations returned no image');
        return jsonResponse(200, { imageData, model, provider: 'pollinations' }, { 'Cache-Control': 'no-store' });
      },
    });
  } catch (error) {
    return jsonResponse(error.status || 502, { code: error.code || 'POLLINATIONS_REQUEST_FAILED', error: error.message });
  }
}

export async function handleImageEditRequest(payload, env = process.env) {
  const image = parseImageDataUrl(payload?.imageData, MAX_EDIT_IMAGE_BYTES);
  if (!image) {
    return jsonResponse(400, { error: 'imageData must be a supported base64 image up to 10 MB' });
  }

  try {
    return await callWithFallback({
      env,
      kind: 'imageEdit',
      path: '/images/edits',
      makeInit: (model) => {
        const formData = new FormData();
        formData.append('image', new Blob([image.bytes], { type: image.mimeType }), 'source.png');
        formData.append('prompt', String(payload?.prompt || 'Remove the background cleanly. Keep the subject unchanged on a transparent background.').slice(0, 32000));
        formData.append('model', model);
        formData.append('size', '1024x1024');
        return { method: 'POST', body: formData };
      },
      parseResponse: async (response, model) => {
        const data = await response.json();
        const item = data?.data?.[0] || {};
        const result = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
        if (!result) throw new Error('Pollinations returned no edited image');
        return jsonResponse(200, { imageData: result, model, provider: 'pollinations' }, { 'Cache-Control': 'no-store' });
      },
    });
  } catch (error) {
    return jsonResponse(error.status || 502, { code: error.code || 'POLLINATIONS_REQUEST_FAILED', error: error.message });
  }
}

export async function handleTextToSpeechRequest(payload, env = process.env) {
  const input = sanitizeSpeechInput(payload?.text || payload?.input);
  if (!input) return jsonResponse(400, { error: 'text is required' });
  const requestedVoice = payload?.voice || payload?.voiceId;

  try {
    return await callWithFallback({
      env,
      kind: 'speech',
      path: '/audio/speech',
      makeInit: (model) => ({
        method: 'POST',
        headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input,
          voice: /^[A-Za-z0-9._-]{1,100}$/.test(requestedVoice || '') ? requestedVoice : 'nova',
          response_format: 'mp3',
          safe: true,
        }),
      }),
      parseResponse: async (response, model) => binaryResponse(200, Buffer.from(await response.arrayBuffer()), {
        'Cache-Control': 'no-store',
        'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
        'X-Maya-AI-Model': model,
      }),
    });
  } catch (error) {
    return jsonResponse(error.status || 502, { code: error.code || 'POLLINATIONS_REQUEST_FAILED', error: error.message });
  }
}

export { DEFAULT_MODELS, sanitizeSpeechInput };
