import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const INVALID_FCM_TOKEN_ERRORS = new Set([
    'messaging/invalid-argument',
    'messaging/registration-token-not-registered'
]);

let adminAppInstance = null;

function requireEnv(name) {
    const value = process.env[name]?.trim();

    if (!value) {
        const error = new Error(`${name} is not configured`);
        error.status = 500;
        throw error;
    }

    return value;
}

function getFirebaseDbUrl() {
    const value = (process.env.FIREBASE_DB_URL || process.env.VITE_PUBLIC_FIREBASE_DB_URL || '').trim();

    if (!value) {
        return requireEnv('FIREBASE_DB_URL').replace(/\/+$/, '');
    }

    return value.replace(/\/+$/, '');
}

function getFirebaseAuthSuffix() {
    const secret = process.env.FIREBASE_SECRET?.trim();

    if (!secret) {
        return '';
    }

    return `?auth=${encodeURIComponent(secret)}`;
}

async function parseFirebaseResponse(response) {
    const rawBody = await response.text();

    if (!rawBody) {
        return null;
    }

    try {
        return JSON.parse(rawBody);
    } catch {
        return rawBody;
    }
}

export async function firebaseRequest(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${getFirebaseDbUrl()}/${path}.json${getFirebaseAuthSuffix()}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const parsedBody = await parseFirebaseResponse(response);

    if (!response.ok) {
        const error = new Error(typeof parsedBody === 'string' ? parsedBody : `Firebase request failed for ${path}`);
        error.status = response.status;
        error.details = parsedBody;
        throw error;
    }

    return parsedBody;
}

export function emailToKey(email = '') {
    return String(email).trim().replace(/[.#$[\]]/g, '_');
}

export function sanitizeUserId(userId = '') {
    return String(userId).trim().replace(/[^a-zA-Z0-9_]/g, '_');
}

export function normalizeFcmToken(token) {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';

    if (!normalizedToken || normalizedToken === 'null' || normalizedToken === 'undefined') {
        return '';
    }

    return normalizedToken;
}

export function getFcmTokenKey(token) {
    return createHash('sha256').update(token).digest('hex');
}

export function getAuthTokenFromRequest(req) {
    const authHeader = req.headers.authorization || '';

    if (/^Bearer\s+/i.test(authHeader)) {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    return typeof req.body?.authToken === 'string' ? req.body.authToken.trim() : '';
}

export async function getUserRecord({ email, userId }) {
    if (email) {
        const path = `users/${emailToKey(email)}`;
        const user = await firebaseRequest(path);
        return { user, path, type: 'email' };
    }

    if (userId) {
        const path = `maya_phone_users/${sanitizeUserId(userId)}`;
        const user = await firebaseRequest(path);
        return { user, path, type: 'phone' };
    }

    const error = new Error('email or userId is required');
    error.status = 400;
    throw error;
}

export async function resolveAuthenticatedUser({ email, userId, authToken }) {
    const context = await getUserRecord({ email, userId });

    if (!context.user) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
    }

    if (!authToken || context.user.token !== authToken) {
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
    }

    return context;
}

export async function registerFcmToken({ path, userId, email, fcmToken, metadata = {} }) {
    const now = new Date().toISOString();
    const tokenKey = getFcmTokenKey(fcmToken);
    const registrationPath = `maya_fcm_registrations/${tokenKey}`;
    const existingRegistration = await firebaseRequest(registrationPath).catch(() => null);

    if (existingRegistration?.userPath && existingRegistration.userPath !== path) {
        await firebaseRequest(`${existingRegistration.userPath}/fcmTokens/${tokenKey}`, { method: 'DELETE' }).catch(() => null);
    }

    await firebaseRequest(`${path}/fcmTokens/${tokenKey}`, {
        method: 'PUT',
        body: {
            token: fcmToken,
            active: true,
            updatedAt: now,
            lastSeenAt: now,
            ...metadata
        }
    });

    await firebaseRequest(path, {
        method: 'PATCH',
        body: {
            lastFcmToken: fcmToken,
            lastFcmTokenUpdatedAt: now
        }
    });

    await firebaseRequest(registrationPath, {
        method: 'PUT',
        body: {
            userPath: path,
            userId: userId || null,
            email: email || null,
            updatedAt: now
        }
    });

    return { tokenKey };
}

export function collectFcmTokenEntries(user) {
    const seenTokens = new Set();
    const tokenEntries = [];

    Object.entries(user?.fcmTokens || {}).forEach(([tokenKey, tokenInfo]) => {
        const token = normalizeFcmToken(tokenInfo?.token);

        if (!token || tokenInfo?.active === false || seenTokens.has(token)) {
            return;
        }

        seenTokens.add(token);
        tokenEntries.push({ tokenKey, token });
    });

    const lastFcmToken = normalizeFcmToken(user?.lastFcmToken);

    if (lastFcmToken && !seenTokens.has(lastFcmToken)) {
        tokenEntries.push({ tokenKey: getFcmTokenKey(lastFcmToken), token: lastFcmToken });
    }

    return tokenEntries;
}

export function normalizeMessageData(data = {}) {
    return Object.entries(data).reduce((result, [key, value]) => {
        if (value === undefined || value === null || key === '') {
            return result;
        }

        result[key] = String(value);
        return result;
    }, {});
}

function getAdminCredentialConfig() {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

    if (rawJson) {
        return JSON.parse(rawJson);
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

    if (!projectId || !clientEmail || !privateKey) {
        const error = new Error('Firebase Admin credentials are not configured');
        error.status = 500;
        throw error;
    }

    return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
    if (adminAppInstance) {
        return adminAppInstance;
    }

    if (getApps().length > 0) {
        adminAppInstance = getApps()[0];
        return adminAppInstance;
    }

    const credentialConfig = getAdminCredentialConfig();
    adminAppInstance = initializeApp({
        credential: cert(credentialConfig),
        projectId: credentialConfig.projectId
    });

    return adminAppInstance;
}

export function getMessagingClient() {
    return getMessaging(getAdminApp());
}

export function isInvalidFcmTokenError(code = '') {
    return INVALID_FCM_TOKEN_ERRORS.has(code);
}