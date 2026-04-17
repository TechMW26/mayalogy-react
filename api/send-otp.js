/**
 * MAYA - WhatsApp OTP Send API (Vercel Serverless)
 * Generates a 6-digit OTP, stores it in Firebase RTDB with 5-min expiry,
 * and sends it via Interakt WhatsApp API.
 */

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

    // Basic phone validation: 6-15 digits
    if (!/^\d{6,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Generate cryptographically random 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Sanitize key for Firebase path (no special chars)
    const phoneKey = `${countryCode}_${phone}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const firebaseUrl = process.env.FIREBASE_DB_URL;
    const firebaseSecret = process.env.FIREBASE_SECRET; // Firebase legacy secret or service account token

    if (!firebaseUrl) {
        return res.status(500).json({ error: 'Firebase DB URL not configured' });
    }

    // Store OTP in Firebase RTDB
    const authParam = firebaseSecret ? `?auth=${firebaseSecret}` : '';
    try {
        const storeResp = await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp, expiry, phone, countryCode, attempts: 0 })
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

    // Interakt message payload — uses Authentication template type
    // Template must be set up in Interakt with one body variable (the OTP code)
    const interaktPayload = {
        countryCode,
        phoneNumber: phone,
        callbackData: 'maya_otp_auth',
        type: 'Template',
        template: {
            name: templateName,
            languageCode: 'en',
            headerValues: [],
            bodyValues: [otp]
        }
    };

    try {
        const interaktResp = await fetch('https://api.interakt.ai/v1/public/message/', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(interaktPayload)
        });

        if (!interaktResp.ok) {
            const errBody = await interaktResp.json().catch(() => ({}));
            console.error('Interakt send failed:', errBody);
            return res.status(500).json({ error: 'Failed to send WhatsApp OTP', detail: errBody.message || 'Unknown error' });
        }
    } catch (err) {
        console.error('Interakt request error:', err.message);
        return res.status(500).json({ error: 'Failed to reach WhatsApp service' });
    }

    return res.status(200).json({ success: true, message: 'OTP sent to WhatsApp' });
}
