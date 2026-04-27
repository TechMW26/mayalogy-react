import {
    collectFcmTokenEntries,
    firebaseRequest,
    getMessagingClient,
    getUserRecord,
    isInvalidFcmTokenError,
    normalizeFcmToken,
    normalizeMessageData
} from './_firebase.js';

export const config = {
    api: {
        bodyParser: { sizeLimit: '1mb' }
    }
};

function getPushSecret(req) {
    return typeof req.headers['x-maya-push-secret'] === 'string'
        ? req.headers['x-maya-push-secret'].trim()
        : '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const configuredPushSecret = process.env.MAYA_PUSH_API_SECRET?.trim();

    if (!configuredPushSecret) {
        return res.status(500).json({ error: 'MAYA_PUSH_API_SECRET is not configured' });
    }

    if (getPushSecret(req) !== configuredPushSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const directTokens = Array.isArray(req.body?.tokens)
        ? req.body.tokens.map((token) => normalizeFcmToken(token)).filter(Boolean)
        : [];
    const singleToken = normalizeFcmToken(req.body?.fcmToken);

    if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required' });
    }

    let userContext = null;
    let tokenEntries = [];

    try {
        if (directTokens.length > 0 || singleToken) {
            const tokens = singleToken ? [singleToken, ...directTokens] : directTokens;
            const uniqueTokens = [...new Set(tokens)];
            tokenEntries = uniqueTokens.map((token) => ({ tokenKey: null, token }));
        } else {
            userContext = await getUserRecord({ email, userId });

            if (!userContext.user) {
                return res.status(404).json({ error: 'User not found' });
            }

            tokenEntries = collectFcmTokenEntries(userContext.user);
        }

        if (tokenEntries.length === 0) {
            return res.status(404).json({ error: 'No registered FCM tokens found for this target' });
        }

        const payloadData = normalizeMessageData({
            title,
            body,
            url: req.body?.url,
            ...((req.body?.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data)) ? req.body.data : {})
        });

        const response = await getMessagingClient().sendEachForMulticast({
            tokens: tokenEntries.map(({ token }) => token),
            data: payloadData,
            android: {
                priority: 'high'
            }
        }, Boolean(req.body?.dryRun));

        if (userContext) {
            const staleTokens = response.responses
                .map((result, index) => ({ result, entry: tokenEntries[index] }))
                .filter(({ result, entry }) => entry.tokenKey && !result.success && isInvalidFcmTokenError(result.error?.code));

            await Promise.all(staleTokens.flatMap(({ entry }) => ([
                firebaseRequest(`${userContext.path}/fcmTokens/${entry.tokenKey}`, { method: 'DELETE' }).catch(() => null),
                firebaseRequest(`maya_fcm_registrations/${entry.tokenKey}`, { method: 'DELETE' }).catch(() => null)
            ])));
        }

        return res.status(200).json({
            success: response.successCount > 0,
            sentCount: response.successCount,
            failedCount: response.failureCount,
            results: response.responses.map((result, index) => ({
                token: tokenEntries[index].token,
                success: result.success,
                messageId: result.messageId || null,
                error: result.error?.message || null,
                code: result.error?.code || null
            }))
        });
    } catch (error) {
        console.error('send-notification error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to send notification' });
    }
}