import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers,
    body,
    isBinary: false,
  };
}

function binaryResponse(status, body, headers = {}) {
  return {
    status,
    headers,
    body,
    isBinary: true,
  };
}

function getEnvValue(env, key, fallback = '') {
  const value = env?.[key] ?? process.env[key] ?? fallback;
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('imageData must be a base64 data URL');
  }

  const [, mimeType, base64Value] = match;
  return new Blob([Buffer.from(base64Value, 'base64')], { type: mimeType });
}

async function blobToDataUrl(blob) {
  const mimeType = blob.type || 'image/png';
  const buffer = Buffer.from(await blob.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function removeBackgroundWithRemoveBg(blob, apiKey) {
  const formData = new FormData();
  formData.append('image_file', blob, 'palm.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');

  const response = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `remove.bg request failed with status ${response.status}`);
  }

  return new Blob([await response.arrayBuffer()], {
    type: response.headers.get('content-type') || 'image/png',
  });
}

async function removeBackgroundWithCloudinary(blob, env) {
  const cloudName = getEnvValue(env, 'CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnvValue(env, 'CLOUDINARY_API_KEY');
  const apiSecret = getEnvValue(env, 'CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `background_removal=cloudinary_ai&folder=palm-readings&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

  const formData = new FormData();
  formData.append('file', blob, 'palm.png');
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('background_removal', 'cloudinary_ai');
  formData.append('folder', 'palm-readings');

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    return null;
  }

  const { public_id: publicId } = await uploadResponse.json();

  if (!publicId) {
    return null;
  }

  const transformedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_background_removal/${publicId}.png`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const transformedResponse = await fetch(transformedUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!transformedResponse.ok) {
      continue;
    }

    const contentType = transformedResponse.headers.get('content-type') || '';

    if (!contentType.startsWith('image/')) {
      continue;
    }

    return new Blob([await transformedResponse.arrayBuffer()], {
      type: contentType,
    });
  }

  return null;
}

export async function handleTextToSpeechRequest(payload, env = process.env) {
  const text = normalizeText(payload?.text);

  if (!text) {
    return jsonResponse(400, { error: 'text is required' });
  }

  const apiKey = getEnvValue(env, 'ELEVENLABS_API_KEY');

  if (!apiKey) {
    return jsonResponse(503, {
      code: 'ELEVENLABS_API_KEY_MISSING',
      error: 'ELEVENLABS_API_KEY is not configured',
    });
  }

  const voiceId = normalizeText(payload?.voiceId)
    || getEnvValue(env, 'VITE_PUBLIC_ELEVENLABS_VOICE')
    || 'P3JECz9WQeXyyodBL3ZD';

  const requestBody = {
    text,
    model_id: payload?.model_id || 'eleven_multilingual_v2',
    voice_settings: payload?.voice_settings || {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.32,
      use_speaker_boost: true,
    },
    optimize_streaming_latency: payload?.optimize_streaming_latency ?? 2,
    language_code: payload?.language_code || 'en',
  };

  if (normalizeText(payload?.previous_text)) {
    requestBody.previous_text = String(payload.previous_text).slice(-350);
  }

  if (normalizeText(payload?.next_text)) {
    requestBody.next_text = String(payload.next_text).slice(0, 350);
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorBody = errorText || `ElevenLabs request failed with status ${response.status}`;

    try {
      const parsedError = JSON.parse(errorText);
      errorBody = parsedError?.detail?.message || parsedError?.message || parsedError?.error || errorBody;
    } catch (_error) {
      // Keep the raw upstream text when it is not JSON.
    }

    return jsonResponse(response.status, {
      code: response.status === 503 ? 'ELEVENLABS_UNAVAILABLE' : 'ELEVENLABS_REQUEST_FAILED',
      error: errorBody,
    });
  }

  return binaryResponse(200, Buffer.from(await response.arrayBuffer()), {
    'Cache-Control': 'no-store',
    'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
  });
}

export async function handleRemoveBackgroundRequest(payload, env = process.env) {
  const imageData = normalizeText(payload?.imageData);

  if (!imageData.startsWith('data:')) {
    return jsonResponse(400, { error: 'imageData must be a base64 data URL' });
  }

  const imageBlob = dataUrlToBlob(imageData);
  const removeBgKey = getEnvValue(env, 'REMOVE_BG_API_KEY');

  if (removeBgKey) {
    try {
      const resultBlob = await removeBackgroundWithRemoveBg(imageBlob, removeBgKey);
      return jsonResponse(200, {
        imageData: await blobToDataUrl(resultBlob),
        provider: 'remove.bg',
      });
    } catch (error) {
      console.warn('remove.bg fallback failed:', error.message);
    }
  }

  const cloudinaryBlob = await removeBackgroundWithCloudinary(imageBlob, env);

  if (cloudinaryBlob) {
    return jsonResponse(200, {
      imageData: await blobToDataUrl(cloudinaryBlob),
      provider: 'cloudinary',
    });
  }

  return jsonResponse(502, { error: 'Background removal failed' });
}