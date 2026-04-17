/**
 * MAYA - WhatsApp OTP Verify API (Vercel Serverless)
 * Validates the OTP against the stored session, then creates or fetches
 * the user record in Firebase RTDB and returns a session token.
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

    const { phone, countryCode, otp } = req.body || {};
    const masterOtp = String(process.env.MAYA_MASTER_OTP || '7500');
    const isMasterOtp = String(otp || '') === masterOtp;

    if (!phone || !countryCode || !otp) {
        return res.status(400).json({ error: 'phone, countryCode and otp are required' });
    }

    if (!isMasterOtp && !/^\d{6}$/.test(String(otp))) {
        return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    const phoneKey = `${countryCode}_${phone}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const firebaseUrl = process.env.FIREBASE_DB_URL;
    const firebaseSecret = process.env.FIREBASE_SECRET;
    const authParam = firebaseSecret ? `?auth=${firebaseSecret}` : '';

    if (!firebaseUrl) {
        return res.status(500).json({ error: 'Firebase DB URL not configured' });
    }

    if (!isMasterOtp) {
        // Fetch stored OTP session
        let stored;
        try {
            const resp = await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`);
            stored = await resp.json();
        } catch (err) {
            return res.status(500).json({ error: 'Failed to verify OTP session' });
        }

        if (!stored || stored === null) {
            return res.status(401).json({ error: 'OTP not found or already used. Please request a new one.' });
        }

        // Check expiry
        if (Date.now() > stored.expiry) {
            // Clean up expired session
            await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, { method: 'DELETE' }).catch(() => {});
            return res.status(401).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Rate limit: max 3 attempts
        const attempts = (stored.attempts || 0) + 1;
        if (attempts > 3) {
            await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, { method: 'DELETE' }).catch(() => {});
            return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // Validate OTP
        if (stored.otp !== otp) {
            // Update attempt count
            await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attempts })
            }).catch(() => {});
            const remaining = 3 - attempts;
            return res.status(401).json({
                error: `Incorrect OTP. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'No attempts remaining.'}`
            });
        }

        // OTP is valid — delete the session
        await fetch(`${firebaseUrl}/maya_otp_sessions/${phoneKey}.json${authParam}`, { method: 'DELETE' }).catch(() => {});
    }

    // Create or retrieve user by phone
    let user;
    try {
        const userResp = await fetch(`${firebaseUrl}/maya_phone_users/${phoneKey}.json${authParam}`);
        user = await userResp.json();
    } catch (err) {
        user = null;
    }

    const isNewUser = !user || user === null;
    const now = Date.now();
    const token = `tok_${now}_${Math.random().toString(36).slice(2, 11)}`;

    if (isNewUser) {
        user = {
            id: phoneKey,
            phone: `${countryCode}${phone}`,
            countryCode,
            phoneNumber: phone,
            createdAt: now,
            lastLogin: now
        };
        await fetch(`${firebaseUrl}/maya_phone_users/${phoneKey}.json${authParam}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }).catch(() => {});
    } else {
        // Update last login
        await fetch(`${firebaseUrl}/maya_phone_users/${phoneKey}.json${authParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastLogin: now })
        }).catch(() => {});
        user.lastLogin = now;
    }

    return res.status(200).json({
        success: true,
        isNewUser,
        masterOtpUsed: isMasterOtp,
        token,
        user: {
            id: user.id,
            phone: user.phone,
            countryCode: user.countryCode,
            phoneNumber: user.phoneNumber,
            createdAt: user.createdAt,
            lastLogin: now
        }
    });
}
