/**
 * MAYA - WhatsApp OTP Send API (Vercel Serverless)
 * Generates a 6-digit OTP, stores it in Firebase RTDB with 5-min expiry,
 * and sends it via Interakt WhatsApp API.
 */

import { randomInt } from 'node:crypto';
import { buildPhoneKey, isReviewDemoPhone, isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';

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

    const { phone, countryCode } = req.body || {};

    if (!phone || !countryCode) {
        return res.status(400).json({ error: 'phone and countryCode are required' });
    }

    const normalizedInput = normalizePhoneInput(phone, countryCode);
    const normalizedPhone = normalizedInput.phone;
    const normalizedCountryCode = normalizedInput.countryCode;

    if (!isValidNormalizedPhone(normalizedPhone, normalizedCountryCode)) {
        return res.status(400).json({ error: 'Invalid phone number or country code format' });
    }

    if (isReviewDemoPhone(normalizedPhone, normalizedCountryCode, process.env)) {
        return res.status(200).json({ success: true, message: 'Review demo OTP ready' });
    }

    const firebaseUrl = getFirebaseDbUrl();
    const firebaseSecret = process.env.FIREBASE_SECRET; // Firebase legacy secret or service account token
    const interaktApiKey = process.env.INTERAKT_API_KEY?.trim();
    const templateName = process.env.INTERAKT_OTP_TEMPLATE?.trim() || 'mayaotp';

    if (!firebaseUrl) {
        return res.status(500).json({ error: 'Firebase DB URL not configured' });
    }

    if (!interaktApiKey) {
        return res.status(500).json({ error: 'Interakt API key not configured' });
    }

    const otp = String(randomInt(100000, 1000000));
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    const phoneKey = buildPhoneKey(normalizedPhone, normalizedCountryCode);

    // Store OTP in Firebase RTDB
    const authParam = firebaseSecret ? `?auth=${encodeURIComponent(firebaseSecret)}` : '';
    const deleteOtpSession = () => fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, {
        method: 'DELETE'
    }).catch(() => { });

    try {
        const storeResp = await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                otp,
                expiry,
                phone: normalizedPhone,
                countryCode: normalizedCountryCode,
                attempts: 0
            })
        });
        if (!storeResp.ok) {
            const errBody = await storeResp.text();
            console.error('Firebase OTP store failed:', errBody);
            return res.status(500).json({ error: 'Failed to store OTP session' });
        }
    } catch (err) {
        console.error('Firebase OTP store error:', err.message);
        return res.status(500).json({ error: 'Failed to store OTP session' });
    }

    const looksLikeBase64Token = (() => {
        try {
            const decoded = Buffer.from(interaktApiKey, 'base64').toString('utf8');
            return decoded.endsWith(':') && decoded.length > 1;
        } catch {
            return false;
        }
    })();

    const basicToken = looksLikeBase64Token
        ? interaktApiKey
        : Buffer.from(`${interaktApiKey}:`).toString('base64');

    const interaktPayload = buildInteraktPayload({
        countryCode: normalizedCountryCode,
        phoneNumber: normalizedPhone,
        templateName,
        otp
    });

    try {
        const { response: interaktResp, body: errBody } = await sendInteraktMessage(basicToken, interaktPayload);

        if (!interaktResp.ok || errBody?.result === false) {
            const detail = errBody?.message || errBody?.error || 'Unknown error';
            console.error('Interakt send failed:', errBody);
            await deleteOtpSession();

            if (/phone number|country code/i.test(detail) && /invalid/i.test(detail)) {
                return res.status(400).json({ error: 'Invalid phone number or country code', detail });
            }

            return res.status(502).json({ error: 'Failed to send WhatsApp OTP', detail });
        }
    } catch (err) {
        console.error('Interakt request error:', err.message);
        await deleteOtpSession();
        return res.status(502).json({ error: 'Failed to reach WhatsApp service' });
    }

    return res.status(200).json({ success: true, message: 'OTP sent to WhatsApp' });
}

function getFirebaseDbUrl() {
    return (process.env.FIREBASE_DB_URL || process.env.VITE_PUBLIC_FIREBASE_DB_URL || '').trim().replace(/\/+$/, '');
}

function buildInteraktPayload({ countryCode, phoneNumber, templateName, otp }) {
    return {
        countryCode,
        phoneNumber,
        callbackData: 'maya_otp_auth',
        type: 'Template',
        template: {
            name: templateName,
            languageCode: 'en',
            headerValues: [],
            bodyValues: [otp],
            buttonValues: {
                0: [otp]
            }
        }
    };
}

async function sendInteraktMessage(basicToken, payload) {
    const response = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    return { response, body };
}
