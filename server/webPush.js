import webPush from 'web-push';
import { firebaseRequest } from '../api/_firebase.js';

const PUBLIC_KEY = 'BB4ftFsgbK3ozJuiuRa8A_-pRnzjf0npedtLAdMeDaRADujGvdzACGu8p9aeDn0v7keK0IgOxzjf_fLty_yV73E';
let configuredPrivateKey = '';

function configure(env = process.env) {
    const privateKey = String(env.WEB_PUSH_PRIVATE_KEY || '').trim();
    if (!privateKey) return false;
    if (privateKey !== configuredPrivateKey) {
        webPush.setVapidDetails('https://www.mayalogy.in', PUBLIC_KEY, privateKey);
        configuredPrivateKey = privateKey;
    }
    return true;
}

export function collectWebPushSubscriptions(user) {
    return Object.entries(user?.webPushSubscriptions || {})
        .filter(([, value]) => value?.endpoint && value?.keys?.auth && value?.keys?.p256dh)
        .map(([key, subscription]) => ({ key, subscription }));
}

export async function sendWebPushSubscriptions(userPath, entries, data, env = process.env) {
    if (!entries.length) return { sentCount: 0, failedCount: 0, results: [] };
    if (!configure(env)) return { sentCount: 0, failedCount: entries.length, results: [], notConfigured: true };

    const results = await Promise.all(entries.map(async ({ key, subscription }) => {
        try {
            await webPush.sendNotification(subscription, JSON.stringify({
                data,
                notification: {
                    title: data.title,
                    body: data.body,
                    icon: '/images/maya-logo.png',
                    badge: '/favicon.png',
                    tag: data.tag || 'mayalogy'
                }
            }), { TTL: 86_400, urgency: 'high' });
            return { success: true, key };
        } catch (error) {
            const statusCode = Number(error?.statusCode || 0);
            if (statusCode === 404 || statusCode === 410) {
                await firebaseRequest(`${userPath}/webPushSubscriptions/${key}`, { method: 'DELETE' }).catch(() => null);
            }
            return { success: false, key, statusCode, error: error?.message || 'Web Push delivery failed' };
        }
    }));

    return {
        sentCount: results.filter((result) => result.success).length,
        failedCount: results.filter((result) => !result.success).length,
        results
    };
}

export { PUBLIC_KEY as MAYA_WEB_PUSH_PUBLIC_KEY };
