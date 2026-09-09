import { timingSafeEqual } from 'node:crypto';
import { createPhoneAppSession } from './_phoneSession.js';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

function secureEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function isAndroidAppRequest(req) {
  return /MAYAAstrology-Android\//i.test(String(req.headers?.['user-agent'] || ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const enabled = String(process.env.APP_REVIEW_LOGIN_ENABLED || '').toLowerCase() === 'true';
  const expectedId = String(process.env.APP_REVIEW_LOGIN_ID || '');
  const expectedPassword = String(process.env.APP_REVIEW_LOGIN_PASSWORD || '');

  if (!enabled || !expectedId || !expectedPassword || !isAndroidAppRequest(req)) {
    return res.status(404).json({ error: 'Reviewer access is unavailable' });
  }

  const loginId = String(req.body?.loginId || '').trim();
  const password = String(req.body?.password || '');
  if (!secureEqual(loginId, expectedId) || !secureEqual(password, expectedPassword)) {
    return res.status(401).json({ error: 'Invalid reviewer ID or password' });
  }

  try {
    const session = await createPhoneAppSession({
      phone: '555010099',
      countryCode: '+1',
      profileDefaults: {
        name: 'Google Play Reviewer',
        birthDate: '1990-01-15',
        birthTime: '12:00',
        birthPlace: 'Mountain View, California, United States',
        birthLat: 37.3861,
        birthLon: -122.0839,
        gender: 'other',
        maritalStatus: 'single',
        language: 'en',
        agentGender: 'female',
        accountType: 'google_play_review',
      },
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...session, reviewAccount: true });
  } catch (error) {
    console.error('Review login session error:', error.message);
    return res.status(error.status || 500).json({ error: 'Could not create reviewer session' });
  }
}

export { isAndroidAppRequest, secureEqual };
