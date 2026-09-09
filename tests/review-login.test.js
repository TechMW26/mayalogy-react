import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { isAndroidAppRequest, secureEqual } from '../api/review-login.js';

function invoke({ body = {}, headers = {}, method = 'POST' } = {}) {
  const req = { body, headers, method };
  let statusCode = 200;
  let responseBody;
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; return this; },
  };
  return handler(req, res).then(() => ({ statusCode, responseBody }));
}

test('review login is limited to the signed app user-agent marker', () => {
  assert.equal(isAndroidAppRequest({ headers: { 'user-agent': 'Chrome MAYAAstrology-Android/1.0' } }), true);
  assert.equal(isAndroidAppRequest({ headers: { 'user-agent': 'Chrome' } }), false);
});

test('credential comparison is constant-time for equal-length values', () => {
  assert.equal(secureEqual('reviewer', 'reviewer'), true);
  assert.equal(secureEqual('reviewer', 'incorrect'), false);
});

test('review login stays hidden when the temporary gate is disabled', async () => {
  const before = process.env.APP_REVIEW_LOGIN_ENABLED;
  process.env.APP_REVIEW_LOGIN_ENABLED = 'false';
  try {
    const result = await invoke({ headers: { 'user-agent': 'MAYAAstrology-Android/1.0' } });
    assert.equal(result.statusCode, 404);
    assert.equal(result.responseBody.error, 'Reviewer access is unavailable');
  } finally {
    if (before === undefined) delete process.env.APP_REVIEW_LOGIN_ENABLED;
    else process.env.APP_REVIEW_LOGIN_ENABLED = before;
  }
});

test('review login rejects incorrect credentials without touching Firebase', async () => {
  const before = {
    enabled: process.env.APP_REVIEW_LOGIN_ENABLED,
    id: process.env.APP_REVIEW_LOGIN_ID,
    password: process.env.APP_REVIEW_LOGIN_PASSWORD,
  };
  Object.assign(process.env, {
    APP_REVIEW_LOGIN_ENABLED: 'true',
    APP_REVIEW_LOGIN_ID: 'play-review',
    APP_REVIEW_LOGIN_PASSWORD: 'a-long-test-password',
  });
  try {
    const result = await invoke({
      headers: { 'user-agent': 'MAYAAstrology-Android/1.0' },
      body: { loginId: 'play-review', password: 'wrong' },
    });
    assert.equal(result.statusCode, 401);
  } finally {
    for (const [key, value] of Object.entries(before)) {
      const envKey = key === 'enabled' ? 'APP_REVIEW_LOGIN_ENABLED' : `APP_REVIEW_LOGIN_${key.toUpperCase()}`;
      if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
    }
  }
});
