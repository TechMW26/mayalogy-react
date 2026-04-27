import {
    getAuthTokenFromRequest,
    normalizeFcmToken,
    registerFcmToken,
    resolveAuthenticatedUser
} from './_firebase.js';

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

    const authToken = getAuthTokenFromRequest(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const fcmToken = normalizeFcmToken(req.body?.fcmToken);

    if (!fcmToken) {
        return res.status(400).json({ error: 'fcmToken is required' });
    }

    try {
        const { user, path, type } = await resolveAuthenticatedUser({ email, userId, authToken });
        const { tokenKey } = await registerFcmToken({
            path,
            userId: type === 'phone' ? user.id : userId,
            email: type === 'email' ? user.email : email,
            fcmToken,
            metadata: {
                platform: typeof req.body?.platform === 'string' ? req.body.platform.trim() || 'android-webview' : 'android-webview',
                source: typeof req.body?.source === 'string' ? req.body.source.trim() || 'android-webview' : 'android-webview',
                appPackage: typeof req.body?.appPackage === 'string' ? req.body.appPackage.trim() || 'com.maya.astrology' : 'com.maya.astrology',
                userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null
            }
        });

        return res.status(200).json({ success: true, tokenKey });
    } catch (error) {
        console.error('save-fcm-token error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to save FCM token' });
    }
}