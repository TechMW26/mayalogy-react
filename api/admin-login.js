import { clientIp, isAdminConfigured, isAdminPassword, issueAdminToken } from './_adminAuth.js';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

// At most 8 wrong passwords per IP in 10 minutes (per server instance).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map();

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!isAdminConfigured()) {
        return res.status(503).json({ error: 'Admin panel is not set up. Add ADMIN_PANEL_PASSWORD to the server env.', code: 'not_configured' });
    }

    const ip = clientIp(req);
    const now = Date.now();
    const entry = fails.get(ip);
    if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_FAILS) {
        const wait = Math.ceil((entry.first + WINDOW_MS - now) / 60000);
        return res.status(429).json({ error: `Too many wrong tries. Try again in ${wait} min.`, code: 'locked' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!isAdminPassword(password)) {
        const fresh = !entry || now - entry.first >= WINDOW_MS;
        fails.set(ip, fresh ? { first: now, count: 1 } : { first: entry.first, count: entry.count + 1 });
        if (fails.size > 2000) fails.clear();
        await new Promise((resolve) => setTimeout(resolve, 600));
        return res.status(401).json({ error: 'Wrong password', code: 'wrong_password' });
    }

    fails.delete(ip);
    return res.status(200).json({ success: true, ...issueAdminToken() });
}
