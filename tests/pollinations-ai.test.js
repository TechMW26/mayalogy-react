import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_MODELS,
  handleImageEditRequest,
  handleImageGenerationRequest,
  handleTextGenerationRequest,
  handleTextToSpeechRequest,
  handleVisionRequest,
  sanitizeSpeechInput,
} from '../server/pollinationsApi.js';

test('uses economical capability-specific Pollinations model routes', () => {
  assert.equal(DEFAULT_MODELS.text[0], 'openai/gpt-5.4-nano');
  assert.equal(DEFAULT_MODELS.vision[0], 'deepseek/deepseek-v4-flash-vision-exp');
  assert.equal(DEFAULT_MODELS.image[0], 'black-forest-labs/flux.1-schnell');
  assert.equal(DEFAULT_MODELS.speech[0], 'elevenlabs/eleven-flash-v2.5');
});

test('fails closed when the server key is absent', async () => {
  const result = await handleTextGenerationRequest({ prompt: 'Hello' }, { POLLINATIONS_API_KEY: '' });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'POLLINATIONS_API_KEY_MISSING');
});

test('routes text, vision, image and speech through Pollinations bearer auth', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/chat/completions')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Complete response.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/images/generations') || url.endsWith('/images/edits')) {
      return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(Buffer.from('audio'), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const env = { POLLINATIONS_API_KEY: 'sk_test_only' };
  assert.equal((await handleTextGenerationRequest({ prompt: 'Hello' }, env)).status, 200);
  assert.equal((await handleVisionRequest({ prompt: 'Inspect', imageData: 'data:image/png;base64,aW1hZ2U=' }, env)).status, 200);
  assert.equal((await handleImageGenerationRequest({ prompt: 'A moon' }, env)).status, 200);
  assert.equal((await handleImageEditRequest({ imageData: 'data:image/png;base64,aW1hZ2U=', prompt: 'Remove background' }, env)).status, 200);
  assert.equal((await handleTextToSpeechRequest({ text: 'Hello' }, env)).status, 200);
  assert.equal(calls.length, 5);
  calls.forEach(({ url, init }) => {
    assert.match(url, /^https:\/\/gen\.pollinations\.ai\/v1\//);
    assert.equal(init.headers.Authorization, 'Bearer sk_test_only');
  });
});

test('speech input removes orchestration tags before synthesis', () => {
  assert.equal(sanitizeSpeechInput('[warm] Hello [[pause-500]] there'), 'Hello … there');
});

test('browser runtime contains no AI provider secret values', async () => {
  const runtime = await readFile(new URL('../public/js/runtime-env.js', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /GEMINI_KEY|GROQ_KEY|POLLINATIONS_API_KEY/);
  const config = await readFile(new URL('../public/js/config.js', import.meta.url), 'utf8');
  assert.match(config, /AI_TEXT:\s*'\/api\/ai-text'/);
  assert.match(config, /AI_VISION:\s*'\/api\/ai-vision'/);
  assert.match(config, /AI_IMAGE:\s*'\/api\/ai-image'/);
});
