/**
 * MAYA - WhatsApp OTP Verify API (Vercel Serverless)
 * Validates the OTP against the stored session, then creates or fetches
 * the user record in Firebase RTDB and returns a session token.
 */

import { firebaseRequest } from './_firebase.js';
import { buildPhoneKey, getReviewDemoCredentials, isReviewDemoPhone, isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';
import { createPhoneAppSession } from './_phoneSession.js';

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

    const { phone, countryCode, otp } = req.body || {};

    if (!phone || !countryCode || !otp) {
        return res.status(400).json({ error: 'phone, countryCode and otp are required' });
    }

    if (!/^\d{6}$/.test(String(otp))) {
        return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    const normalizedInput = normalizePhoneInput(phone, countryCode);
    const normalizedPhone = normalizedInput.phone;
    const normalizedCountryCode = normalizedInput.countryCode;

    if (!isValidNormalizedPhone(normalizedPhone, normalizedCountryCode)) {
        return res.status(400).json({ error: 'Invalid phone number or country code format' });
    }

    const reviewDemo = getReviewDemoCredentials(process.env);
    const isReviewDemoOtp = isReviewDemoPhone(normalizedPhone, normalizedCountryCode, process.env)
        && String(otp) === reviewDemo.otp;

    const phoneKey = buildPhoneKey(normalizedPhone, normalizedCountryCode);
    const otpSessionPath = `maya_otp_sessions/${phoneKey}`;

    if (!isReviewDemoOtp) {
        // Fetch stored OTP session
        let stored;
        try {
            stored = await firebaseRequest(otpSessionPath);
        } catch (err) {
            return res.status(500).json({ error: 'Failed to verify OTP session' });
        }

        if (!stored || stored === null) {
            return res.status(401).json({ error: 'OTP not found or already used. Please request a new one.' });
        }

        // Check expiry
        if (Date.now() > stored.expiry) {
            // Clean up expired session
            await firebaseRequest(otpSessionPath, { method: 'DELETE' }).catch(() => { });
            return res.status(401).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Rate limit: max 3 attempts
        const attempts = (stored.attempts || 0) + 1;
        if (attempts > 3) {
            await firebaseRequest(otpSessionPath, { method: 'DELETE' }).catch(() => { });
            return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // Validate OTP
        if (stored.otp !== otp) {
            // Update attempt count
            await firebaseRequest(otpSessionPath, {
                method: 'PATCH',
                body: { attempts }
            }).catch(() => { });
            const remaining = 3 - attempts;
            return res.status(401).json({
                error: `Incorrect OTP. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'No attempts remaining.'}`
            });
        }

        // OTP is valid -delete the session
        await firebaseRequest(otpSessionPath, { method: 'DELETE' }).catch(() => { });
    }

    try {
        const session = await createPhoneAppSession({
            phone: normalizedPhone,
            countryCode: normalizedCountryCode,
            profileDefaults: isReviewDemoOtp ? getReviewDemoProfile() : {}
        });
        return res.status(200).json({ ...session, reviewDemoUsed: isReviewDemoOtp });
    } catch (error) {
        console.error('Phone session creation failed:', error.message);
        return res.status(500).json({ error: 'Failed to create phone session' });
    }
}

function getReviewDemoProfile() {
    return {
        name: 'App Review Demo',
        birthDate: '1990-01-01',
        birthTime: '09:00',
        birthPlace: 'Cupertino, CA',
        birthLat: 37.323,
        birthLon: -122.0322,
        gender: 'not_specified',
        maritalStatus: 'single',
        language: 'en',
        agentGender: 'female'
    };
}
