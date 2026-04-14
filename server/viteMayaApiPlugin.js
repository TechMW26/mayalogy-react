import { handleRemoveBackgroundRequest, handleTextToSpeechRequest } from './mayaApi.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function writeResult(res, result) {
  res.statusCode = result.status;

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (result.isBinary) {
    res.end(result.body);
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.body));
}

async function handleRequest(req, res, handler) {
  try {
    const payload = await readJsonBody(req);
    console.log('[TTS DEBUG] payload keys:', Object.keys(payload), 'text length:', (payload.text || '').length, 'voiceId:', payload.voiceId || '(none)');
    const result = await handler(payload, process.env);
    console.log('[TTS DEBUG] result status:', result.status, 'isBinary:', result.isBinary);
    writeResult(res, result);
  } catch (error) {
    console.error('[TTS DEBUG] handleRequest caught error:', error.message);
    writeResult(res, {
      status: 400,
      body: { error: error.message || 'Request failed' },
      headers: {},
      isBinary: false,
    });
  }
}

export function mayaApiDevPlugin() {
  return {
    name: 'maya-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (req.method === 'POST' && pathname === '/api/tts') {
          await handleRequest(req, res, handleTextToSpeechRequest);
          return;
        }

        if (req.method === 'POST' && pathname === '/api/remove-background') {
          await handleRequest(req, res, handleRemoveBackgroundRequest);
          return;
        }

        next();
      });
    },
  };
}