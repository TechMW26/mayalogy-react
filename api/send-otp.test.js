import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from './send-otp.js';

const originalFetch = global.fetch;
const originalEnv = {
    FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
    FIREBASE_SECRET: process.env.FIREBASE_SECRET,
    INTERAKT_API_KEY: process.env.INTERAKT_API_KEY,
    INTERAKT_OTP_TEMPLATE: process.env.INTERAKT_OTP_TEMPLATE
};

afterEach(() => {
    global.fetch = originalFetch;
    Object.entries(originalEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    });
});

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        setHeader() {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('sends the same OTP in authentication template body and button values', async () => {
    process.env.FIREBASE_DB_URL = 'https://example.firebaseio.test';
    process.env.INTERAKT_API_KEY = Buffer.from('test-key:').toString('base64');
    process.env.INTERAKT_OTP_TEMPLATE = 'maya_otp_auth';

    const requests = [];
    global.fetch = async (url, options = {}) => {
        requests.push({ url, options });
        return {
            ok: true,
            json: async () => ({ result: true, message: 'Message created successfully' }),
            text: async () => 'null'
        };
    };

    const res = createResponse();
    await handler({ method: 'POST', body: { phone: '9876543210', countryCode: '+91' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(requests.length, 2);

    const storedSession = JSON.parse(requests[0].options.body);
    const message = JSON.parse(requests[1].options.body);

    assert.match(storedSession.otp, /^\d{6}$/);
    assert.deepEqual(message.template.bodyValues, [storedSession.otp]);
    assert.deepEqual(message.template.buttonValues, { 0: [storedSession.otp] });
});

test('does not create an OTP session when Interakt is not configured', async () => {
    process.env.FIREBASE_DB_URL = 'https://example.firebaseio.test';
    delete process.env.INTERAKT_API_KEY;

    let requestCount = 0;
    global.fetch = async () => {
        requestCount += 1;
        throw new Error('fetch should not be called');
    };

    const res = createResponse();
    await handler({ method: 'POST', body: { phone: '9876543210', countryCode: '+91' } }, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Interakt API key not configured');
    assert.equal(requestCount, 0);
});

test('removes the OTP session when Interakt reports a failed message', async () => {
    process.env.FIREBASE_DB_URL = 'https://example.firebaseio.test';
    process.env.INTERAKT_API_KEY = Buffer.from('test-key:').toString('base64');

    const methods = [];
    global.fetch = async (url, options = {}) => {
        methods.push(options.method);
        if (String(url).startsWith('https://api.interakt.ai')) {
            return {
                ok: true,
                json: async () => ({ result: false, message: 'Template rejected' })
            };
        }

        return { ok: true, text: async () => 'null' };
    };

    const res = createResponse();
    await handler({ method: 'POST', body: { phone: '9876543210', countryCode: '+91' } }, res);

    assert.equal(res.statusCode, 502);
    assert.deepEqual(methods, ['PUT', 'POST', 'DELETE']);
});
