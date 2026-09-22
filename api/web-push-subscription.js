import {
    firebaseRequest,
    getAuthTokenFromRequest,
    getWebPushSubscriptionKey,
    resolveAuthenticatedUser
} from './_firebase.js';

export const config = {
    api: { bodyParser: { sizeLimit: '64kb' } }
};

export function normalizeSubscription(value) {
    const endpoint = typeof value?.endpoint === 'string' ? value.endpoint.trim() : '';
    const auth = typeof value?.keys?.auth === 'string' ? value.keys.auth.trim() : '';
    const p256dh = typeof value?.keys?.p256dh === 'string' ? value.keys.p256dh.trim() : '';

    if (!endpoint.startsWith('https://') || endpoint.length > 2048 || !auth || !p256dh) {
        return null;
    }

    return {
        endpoint,
        expirationTime: Number.isFinite(value?.expirationTime) ? value.expirationTime : null,
        keys: { auth: auth.slice(0, 512), p256dh: p256dh.slice(0, 512) }
    };
}

export default async function handler(req, res) {
    if (!['POST', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', 'POST, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authToken = getAuthTokenFromRequest(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';

    try {
        const { path } = await resolveAuthenticatedUser({ email, userId, authToken });

        if (req.method === 'DELETE') {
            const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
            if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
            await firebaseRequest(`${path}/webPushSubscriptions/${getWebPushSubscriptionKey(endpoint)}`, { method: 'DELETE' });
            return res.status(200).json({ success: true });
        }

        const subscription = normalizeSubscription(req.body?.subscription);
        if (!subscription) return res.status(400).json({ error: 'A valid Web Push subscription is required' });

        const subscriptionKey = getWebPushSubscriptionKey(subscription.endpoint);
        await firebaseRequest(`${path}/webPushSubscriptions/${subscriptionKey}`, {
            method: 'PUT',
            body: {
                ...subscription,
                platform: typeof req.body?.platform === 'string' ? req.body.platform.slice(0, 40) : 'ios-web',
                kind: 'web-push',
                userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null,
                updatedAt: new Date().toISOString()
            }
        });

        return res.status(200).json({ success: true, subscriptionKey });
    } catch (error) {
        console.error('web-push-subscription error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to save Web Push subscription' });
    }
}
