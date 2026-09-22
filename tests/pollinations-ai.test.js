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
  assert.equal(DEFAULT_MODELS.text[0], 'mistralai/mistral-small-3.2');
  assert.equal(DEFAULT_MODELS.vision[0], 'qwen/qwen3-vl-30b-a3b-instruct');
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

test('preserves both palm images in the Pollinations vision request', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"lines":[]}' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const left = 'data:image/png;base64,bGVmdA==';
  const right = 'data:image/png;base64,cmlnaHQ=';
  const result = await handleVisionRequest({ prompt: 'Compare both palms', images: [left, right] }, { POLLINATIONS_API_KEY: 'sk_test_only' });

  assert.equal(result.status, 200);
  const imageParts = requestBody.messages[0].content.filter((part) => part.type === 'image_url');
  assert.deepEqual(imageParts.map((part) => part.image_url.url), [left, right]);
});

test('speech preserves the existing browser voiceId contract', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(Buffer.from('audio'), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await handleTextToSpeechRequest({ text: 'Hello', voiceId: 'P3JECz9WQeXyyodBL3ZD' }, { POLLINATIONS_API_KEY: 'sk_test_only' });
  assert.equal(result.status, 200);
  assert.equal(requestBody.voice, 'P3JECz9WQeXyyodBL3ZD');
});

test('rejects malformed, oversized, and unexpectedly costly media inputs', async () => {
  const env = { POLLINATIONS_API_KEY: 'sk_test_only' };
  assert.equal((await handleVisionRequest({ prompt: 'Inspect', imageData: 'data:image/svg+xml;base64,PHN2Zz4=' }, env)).status, 400);
  assert.equal((await handleVisionRequest({ prompt: 'Inspect', imageData: 'data:image/png;base64,not_base64!' }, env)).status, 400);
  assert.equal((await handleVisionRequest({
    prompt: 'Compare both palms',
    images: ['data:image/png;base64,aW1hZ2U=', 'data:image/png;base64,not_base64!'],
  }, env)).status, 400);
  assert.equal((await handleVisionRequest({
    prompt: 'Compare palms',
    images: Array(3).fill('data:image/png;base64,aW1hZ2U='),
  }, env)).status, 400);
  assert.equal((await handleImageGenerationRequest({ prompt: 'A moon', size: '9999x9999' }, env)).status, 400);
  assert.equal((await handleImageEditRequest({ imageData: 'data:image/svg+xml;base64,PHN2Zz4=' }, env)).status, 400);
});

test('bounds text context while preserving the system prompt and newest request', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await handleTextGenerationRequest({
    systemPrompt: `SYSTEM-${'s'.repeat(50000)}`,
    messages: Array.from({ length: 40 }, (_, index) => ({ role: 'user', content: `${index}-${'x'.repeat(50000)}` })),
    prompt: `LATEST-${'z'.repeat(50000)}`,
  }, { POLLINATIONS_API_KEY: 'sk_test_only' });

  assert.equal(result.status, 200);
  assert.ok(requestBody.messages.reduce((total, message) => total + message.content.length, 0) <= 100000);
  assert.match(requestBody.messages[0].content, /^SYSTEM-/);
  assert.match(requestBody.messages.at(-1).content, /^LATEST-/);
});

test('browser runtime contains no AI provider secret values', async () => {
  const runtime = await readFile(new URL('../public/js/runtime-env.js', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /GEMINI_KEY|GROQ_KEY|POLLINATIONS_API_KEY/);
  const config = await readFile(new URL('../public/js/config.js', import.meta.url), 'utf8');
  assert.match(config, /AI_TEXT:\s*'\/api\/ai-text'/);
  assert.match(config, /AI_VISION:\s*'\/api\/ai-vision'/);
  assert.match(config, /AI_IMAGE:\s*'\/api\/ai-image'/);
});
