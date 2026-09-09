import { getAuthClient } from './_firebase.js';
import { createPhoneAppSession } from './_phoneSession.js';
import { isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';

export const config = {
    api: {
        bodyParser: { sizeLimit: '1mb' }
    }
};

export function getVerifiedPhoneIdentity(decodedToken, requestedCountryCode) {
    const phoneClaim = String(decodedToken?.phone_number || '').trim();
    const normalized = normalizePhoneInput(phoneClaim, requestedCountryCode);
    const verifiedE164 = `${normalized.countryCode}${normalized.phone}`;

    if (!phoneClaim || !isValidNormalizedPhone(normalized.phone, normalized.countryCode) || verifiedE164 !== phoneClaim) {
        return null;
    }

    return normalized;
}

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

    let decodedToken;

    try {
        // This is an immediate exchange of a freshly issued Firebase ID token.
        // Signature, audience, issuer and expiry are still verified; a separate
        // revocation lookup only adds another failure point here.
        decodedToken = await getAuthClient().verifyIdToken(String(idToken));
    } catch (error) {
        console.error('Firebase phone token verification failed:', error.code || error.message);
        return res.status(401).json({
            code: 'FIREBASE_TOKEN_INVALID',
            error: 'Firebase OTP session is invalid or expired'
        });
    }

    const verifiedIdentity = getVerifiedPhoneIdentity(decodedToken, normalized.countryCode);
    const expectedPhone = `${normalized.countryCode}${normalized.phone}`;

    if (!verifiedIdentity || `${verifiedIdentity.countryCode}${verifiedIdentity.phone}` !== expectedPhone) {
        console.error('Firebase phone claim did not match the requested phone number');
        return res.status(401).json({
            code: 'FIREBASE_PHONE_MISMATCH',
            error: 'Verified phone number does not match this OTP request'
        });
    }

    try {
        const session = await createPhoneAppSession(verifiedIdentity);
        return res.status(200).json(session);
    } catch (error) {
        console.error('Firebase phone session creation failed:', error.code || error.message);
        return res.status(error.status || 500).json({
            code: 'APP_SESSION_CREATE_FAILED',
            error: 'Could not create app session'
        });
    }
}
