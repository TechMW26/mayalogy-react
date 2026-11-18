import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Admin panel sign-in. The password lives only in the server env (ADMIN_PANEL_PASSWORD).
// After a correct password the browser gets a signed token that lasts 12 hours.
// Changing the password signs everyone out.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function adminPassword() {
    return String(process.env.ADMIN_PANEL_PASSWORD || '').trim();
}

function signingKey() {
    const password = adminPassword();
    if (!password) return null;
    const extra = process.env.ADMIN_PANEL_SECRET
        || process.env.FIREBASE_SECRET
        || process.env.FIREBASE_ADMIN_PRIVATE_KEY
        || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        || '';
    return createHash('sha256').update(`maya-admin|${password}|${extra}`).digest();
}

function sameText(a, b) {
    const x = createHash('sha256').update(String(a || '')).digest();
    const y = createHash('sha256').update(String(b || '')).digest();
    return timingSafeEqual(x, y);
}

export function isAdminConfigured() {
    return !!adminPassword();
}

export function isAdminPassword(input) {
    const password = adminPassword();
    return !!password && sameText(input, password);
}

export function issueAdminToken() {
    const key = signingKey();
    const now = Date.now();
    const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + TOKEN_TTL_MS })).toString('base64url');
    const sig = createHmac('sha256', key).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expiresAt: now + TOKEN_TTL_MS };
}

export function isAdminRequest(req) {
    const key = signingKey();
    if (!key) return false;
    const header = String(req.headers?.authorization || req.headers?.Authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = createHmac('sha256', key).update(payload).digest('base64url');
    if (!sameText(sig, expected)) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return Number(data.exp) > Date.now();
    } catch {
        return false;
    }
}

export function clientIp(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket?.remoteAddress || 'unknown';
}
