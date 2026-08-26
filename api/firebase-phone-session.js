import { getAuthClient } from './_firebase.js';
import { createPhoneAppSession } from './_phoneSession.js';
import { isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';

export const config = {
    api: {
        bodyParser: { sizeLimit: '1mb' }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phone, countryCode, idToken } = req.body || {};
    const normalized = normalizePhoneInput(phone, countryCode);

    if (!idToken || !isValidNormalizedPhone(normalized.phone, normalized.countryCode)) {
        return res.status(400).json({ error: 'phone, countryCode and Firebase ID token are required' });
    }

    try {
        const decodedToken = await getAuthClient().verifyIdToken(String(idToken), true);
        const verifiedPhone = String(decodedToken.phone_number || '').replace(/\s/g, '');
        const expectedPhone = `${normalized.countryCode}${normalized.phone}`;

        if (!verifiedPhone || verifiedPhone !== expectedPhone) {
            return res.status(401).json({ error: 'Verified phone number does not match this OTP request' });
        }

        const session = await createPhoneAppSession(normalized);
        return res.status(200).json(session);
    } catch (error) {
        console.error('Firebase phone session error:', error.code || error.message);
        const status = /^auth\//.test(error.code || '') ? 401 : (error.status || 500);
        return res.status(status).json({
            error: status === 401 ? 'Firebase OTP session is invalid or expired' : 'Could not create app session'
        });
    }
}
