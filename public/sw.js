/**
 * MAYA - Service Worker
 * Network-only worker with Web Push delivery for installed iOS web apps.
 */

const CACHE_VERSION = '20260922-notifications-v1';

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        await clearAllCaches();
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await clearAllCaches();
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            clearAllCaches().then(() => {
                event.ports[0]?.postMessage({ cleared: true, version: CACHE_VERSION, mode: 'network-only' });
            })
        );
    }

    if (event.data?.type === 'GET_VERSION') {
        event.ports[0]?.postMessage({ version: CACHE_VERSION, mode: 'network-only' });
    }
});

function notificationUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || '/'), self.location.origin);
        return url.origin === self.location.origin ? url.href : self.location.origin;
    } catch {
        return self.location.origin;
    }
}

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { data: { body: event.data ? event.data.text() : '' } };
    }

    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = String(data.title || notification.title || 'Mayalogy');
    const body = String(data.body || notification.body || 'Your Mayalogy update is ready.');
    const url = notificationUrl(data.url || payload.fcmOptions?.link || '/');

    event.waitUntil(Promise.all([
        self.registration.showNotification(title, {
            body,
            icon: notification.icon || '/images/maya-logo.png',
            badge: notification.badge || '/favicon.png',
            image: data.image || notification.image,
            tag: String(data.tag || notification.tag || 'mayalogy'),
            data: { url }
        }),
        self.navigator?.setAppBadge ? self.navigator.setAppBadge(1).catch(() => null) : Promise.resolve()
    ]));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = notificationUrl(event.notification.data?.url);
    event.waitUntil((async () => {
        if (self.navigator?.clearAppBadge) {
            try { await self.navigator.clearAppBadge(); } catch { /* no-op */ }
        }
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            try {
                if ('navigate' in client) await client.navigate(url);
                return await client.focus();
            } catch { /* try another client */ }
        }
        return self.clients.openWindow(url);
    })());
});
