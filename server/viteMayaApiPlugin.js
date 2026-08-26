import { handleRemoveBackgroundRequest, handleTextToSpeechRequest } from './mayaApi.js';
import sendOtpHandler from '../api/send-otp.js';
import verifyOtpHandler from '../api/verify-otp.js';
import firebasePhoneSessionHandler from '../api/firebase-phone-session.js';

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

async function handleRequest(req, res, handler, routeName = 'api') {
  try {
    const payload = await readJsonBody(req);
    const result = await handler(payload, process.env);
    if (!result.isBinary && result.status >= 400) {
      console.warn('[MAYA API]', routeName, result.status, result.body?.code || '(no code)', result.body?.error || '(no detail)');
    }
    writeResult(res, result);
  } catch (error) {
    console.error('[MAYA API]', routeName, 'request failed:', error.message);
    writeResult(res, {
      status: 400,
      body: { error: error.message || 'Request failed' },
      headers: {},
      isBinary: false,
    });
  }
}

async function handleVercelRequest(req, res, handler, routeName = 'api') {
  try {
    req.body = await readJsonBody(req);

    const response = {
      statusCode: 200,
      setHeader(key, value) {
        res.setHeader(key, value);
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        res.statusCode = this.statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
        return this;
      },
      end(body = '') {
        res.statusCode = this.statusCode;
        res.end(body);
        return this;
      },
    };

    await handler(req, response);
  } catch (error) {
    console.error('[MAYA API]', routeName, 'request failed:', error.message);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'Request failed' }));
  }
}

export function mayaApiDevPlugin() {
  return {
    name: 'maya-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (req.method === 'POST' && pathname === '/api/tts') {
          await handleRequest(req, res, handleTextToSpeechRequest, 'tts');
          return;
        }

        if (req.method === 'POST' && pathname === '/api/remove-background') {
          await handleRequest(req, res, handleRemoveBackgroundRequest, 'remove-background');
          return;
        }

        if (req.method === 'POST' && pathname === '/api/send-otp') {
          await handleVercelRequest(req, res, sendOtpHandler, 'send-otp');
          return;
        }

        if (req.method === 'POST' && pathname === '/api/verify-otp') {
          await handleVercelRequest(req, res, verifyOtpHandler, 'verify-otp');
          return;
        }

        if (req.method === 'POST' && pathname === '/api/firebase-phone-session') {
          await handleVercelRequest(req, res, firebasePhoneSessionHandler, 'firebase-phone-session');
          return;
        }

        next();
      });
    },
  };
}
