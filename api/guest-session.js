import { firebaseRequest } from './_firebase.js';

// Saves what a visitor who is NOT logged in has told MAYA (birth details, numbers,
// answers, how far they got) under maya_guests/<guestId>. Only the server writes
// here (admin access), so the database rules can keep this path closed to browsers.

export const config = {
    api: { bodyParser: { sizeLimit: '96kb' } }
};

const GUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
const TOP_KEYS = ['profile', 'funnel', 'calculations', 'language', 'onboarding', 'answers', 'validations', 'journey', 'device', 'linkedTo'];
const SECRET_KEY = /token|otp|password|secret|apikey|api_key|authorization/i;
const MAX_BYTES = 80 * 1024;
const lastWrite = new Map();

// Firebase keys cannot contain . # $ [ ] / ; drop secrets, functions, huge strings.
function clean(value, depth = 0) {
    if (depth > 6) return null;
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.slice(0, 2000);
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 60).map((item) => clean(item, depth + 1));
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).slice(0, 120).forEach((key) => {
            if (SECRET_KEY.test(key)) return;
            const safeKey = String(key).replace(/[.#$[\]/]/g, '_').slice(0, 120);
            if (!safeKey) return;
            const v = clean(value[key], depth + 1);
            if (v !== null && v !== undefined) out[safeKey] = v;
        });
        return out;
    }
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
    }
    const guestId = typeof body?.guestId === 'string' ? body.guestId.trim() : '';
    if (!GUEST_ID.test(guestId)) {
        return res.status(400).json({ error: 'guestId is invalid' });
    }

    // One write per guest every 2 s is plenty; ignore bursts.
    const now = Date.now();
    if (now - (lastWrite.get(guestId) || 0) < 2000) {
        return res.status(202).json({ success: true, skipped: true });
    }
    lastWrite.set(guestId, now);
    if (lastWrite.size > 5000) lastWrite.clear();

    const data = {};
    TOP_KEYS.forEach((key) => {
        if (body?.data && Object.prototype.hasOwnProperty.call(body.data, key)) {
            const v = clean(body.data[key]);
            if (v !== null && v !== undefined) data[key] = v;
        }
    });
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) {
        return res.status(413).json({ error: 'Too much data' });
    }

    try {
        const path = `maya_guests/${guestId}`;
        const firstSeenAt = await firebaseRequest(`${path}/firstSeenAt`).catch(() => null);
        await firebaseRequest(path, {
            method: 'PATCH',
            body: {
                ...data,
                guestId,
                firstSeenAt: Number.isFinite(firstSeenAt) ? firstSeenAt : now,
                updatedAt: now,
                userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null
            }
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('guest-session error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to save guest data' });
    }
}
