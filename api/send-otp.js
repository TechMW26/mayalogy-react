/**
 * MAYA - WhatsApp OTP Send API (Vercel Serverless)
 * Generates a 6-digit OTP, stores it in Firebase RTDB with 5-min expiry,
 * and sends it via Interakt WhatsApp API.
 */

import { buildPhoneKey, isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';

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

    // Generate cryptographically random 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    const phoneKey = buildPhoneKey(normalizedPhone, normalizedCountryCode);

    const firebaseUrl = process.env.FIREBASE_DB_URL;
    const firebaseSecret = process.env.FIREBASE_SECRET; // Firebase legacy secret or service account token

    if (!firebaseUrl) {
        return res.status(500).json({ error: 'Firebase DB URL not configured' });
    }

    // Store OTP in Firebase RTDB
    const authParam = firebaseSecret ? `?auth=${firebaseSecret}` : '';
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

    // Send WhatsApp OTP via Interakt
    const interaktApiKey = process.env.INTERAKT_API_KEY;
    const templateName = process.env.INTERAKT_OTP_TEMPLATE || 'maya_otp_auth';

    if (!interaktApiKey) {
        return res.status(500).json({ error: 'Interakt API key not configured' });
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

    let interaktPayload = buildInteraktPayload({
        countryCode: normalizedCountryCode,
        phoneNumber: normalizedPhone,
        templateName,
        otp
    });

    try {
        let interaktResult = await sendInteraktMessage(basicToken, interaktPayload);
        let { response: interaktResp, body: errBody } = interaktResult;

        if (!interaktResp.ok) {
            const missingButtonVariable = parseMissingButtonVariableError(errBody.message);

            if (missingButtonVariable) {
                interaktPayload = buildInteraktPayload({
                    countryCode: normalizedCountryCode,
                    phoneNumber: normalizedPhone,
                    templateName,
                    otp,
                    buttonValues: buildDefaultButtonValues(missingButtonVariable.index, missingButtonVariable.count, otp)
                });

                interaktResult = await sendInteraktMessage(basicToken, interaktPayload);
                interaktResp = interaktResult.response;
                errBody = interaktResult.body;
            }
        }

        if (!interaktResp.ok) {
            const detail = errBody.message || 'Unknown error';
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

function buildInteraktPayload({ countryCode, phoneNumber, templateName, otp, buttonValues }) {
    const payload = {
        countryCode,
        phoneNumber,
        callbackData: 'maya_otp_auth',
        type: 'Template',
        template: {
            name: templateName,
            languageCode: 'en',
            headerValues: [],
            bodyValues: [otp]
        }
    };

    if (buttonValues && Object.keys(buttonValues).length > 0) {
        payload.template.buttonValues = buttonValues;
    }

    return payload;
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

function parseMissingButtonVariableError(detail) {
    const message = String(detail || '');
    const match = message.match(/button at index\s+(\d+).*?expected number of values(?:\s+are|\s+is)?\s+(\d+)/i);

    if (!match) {
        return null;
    }

    return {
        index: Number(match[1]),
        count: Number(match[2])
    };
}

function buildDefaultButtonValues(index, count, otp) {
    return {
        [index]: Array.from({ length: count }, () => otp)
    };
}
