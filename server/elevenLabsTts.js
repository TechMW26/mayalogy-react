import { Buffer } from 'node:buffer';
import { handleTextToSpeechRequest as handlePollinationsSpeech, sanitizeSpeechInput } from './pollinationsApi.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE = 'P3JECz9WQeXyyodBL3ZD';
const DEFAULT_MALE_VOICE = '8TMmdpPgqHKvDOGYP2lN';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const LANGUAGE_CODE_MODELS = new Set(['eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v4_turbo']);
const OUTPUT_FORMATS = new Set(['mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128']);

function env(source, name, fallback = '') {
  const value = source?.[name] ?? process.env[name] ?? fallback;
  return typeof value === 'string' ? value.trim().replace(/^"|"$/g, '') : fallback;
}

function clamp(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function json(status, body) {
  return { status, body, headers: { 'Cache-Control': 'no-store' }, isBinary: false };
}

function detectLanguage(text) {
  const hindiChars = (text.match(/[\u0900-\u097f]/g) || []).length;
  const latinChars = (text.match(/[A-Za-z]/g) || []).length;
  return hindiChars > 0 && hindiChars * 3 >= latinChars ? 'hi' : 'en';
}

// Voice feel. Tunable from .env / Vercel without code changes.
// style = emotion (0 flat .. 1 dramatic; above ~0.45 words can blur), stability = consistency, speed = pace.
function buildVoiceSettings(source, voiceId) {
  const maleVoice = env(source, 'ELEVENLABS_MALE_VOICE', env(source, 'VITE_PUBLIC_ELEVENLABS_MALE_VOICE', DEFAULT_MALE_VOICE));
  const isMale = voiceId === maleVoice;
  return {
    stability: clamp(env(source, 'ELEVENLABS_STABILITY'), 0.5, 0, 1),
    similarity_boost: clamp(env(source, 'ELEVENLABS_SIMILARITY'), 0.8, 0, 1),
    style: clamp(env(source, 'ELEVENLABS_STYLE'), 0.32, 0, 1),
    use_speaker_boost: true,
    speed: isMale
      ? clamp(env(source, 'ELEVENLABS_MALE_SPEED'), 1.1, 0.7, 1.2)
      : clamp(env(source, 'ELEVENLABS_SPEED'), 1.0, 0.7, 1.2),
  };
}

async function callElevenLabs(payload, source) {
  const apiKey = env(source, 'ELEVENLABS_API_KEY');
  const text = sanitizeSpeechInput(payload?.text || payload?.input);
  const requestedVoice = String(payload?.voiceId || payload?.voice || '');
  const voiceId = /^[A-Za-z0-9]{10,40}$/.test(requestedVoice) ? requestedVoice : env(source, 'ELEVENLABS_DEFAULT_VOICE', DEFAULT_VOICE);
  const modelId = env(source, 'ELEVENLABS_TTS_MODEL', DEFAULT_MODEL);
  const outputFormat = OUTPUT_FORMATS.has(env(source, 'ELEVENLABS_OUTPUT_FORMAT')) ? env(source, 'ELEVENLABS_OUTPUT_FORMAT') : 'mp3_44100_128';
  const language = payload?.language === 'hi' || payload?.language === 'en' ? payload.language : detectLanguage(text);

  const body = {
    text,
    model_id: modelId,
    voice_settings: buildVoiceSettings(source, voiceId),
    apply_text_normalization: 'auto',
  };
  if (LANGUAGE_CODE_MODELS.has(modelId)) body.language_code = language;

  const response = await fetch(`${ELEVENLABS_BASE}/${voiceId}?output_format=${outputFormat}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, Accept: 'audio/mpeg', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    const error = new Error(`ElevenLabs ${response.status}: ${raw.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }

  return {
    status: 200,
    isBinary: true,
    body: Buffer.from(await response.arrayBuffer()),
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'X-Maya-AI-Model': `elevenlabs/${modelId}`,
      'X-Maya-TTS-Language': language,
    },
  };
}

export async function handleSpeechRequest(payload, source = process.env) {
  const text = sanitizeSpeechInput(payload?.text || payload?.input);
  if (!text) return json(400, { error: 'text is required' });

  // ElevenLabs only. The old Pollinations fallback uses a chat-style voice model that rewrites
  // the text and replaced names with the word "name" ("NAME, main NAME hoon"). If ElevenLabs is
  // unavailable we return 503 and the app speaks with the device's Hindi voice instead, which
  // always reads the exact text.
  if (!env(source, 'ELEVENLABS_API_KEY')) {
    console.error('[tts] ELEVENLABS_API_KEY is not set');
    return json(503, { code: 'ELEVENLABS_NOT_CONFIGURED', error: 'Voice is temporarily unavailable' });
  }
  try {
    return await callElevenLabs(payload, source);
  } catch (error) {
    console.error('[tts] ElevenLabs failed:', error.message);
    return json(error.status === 401 ? 503 : (error.status || 502), { code: 'ELEVENLABS_FAILED', error: 'Voice is temporarily unavailable' });
  }
}