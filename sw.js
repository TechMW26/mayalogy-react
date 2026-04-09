/**
 * MAYA - Service Worker
 * Network-only cleanup worker used to remove older cached deployments.
 */

const CACHE_VERSION = '20260408l';

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
        await self.registration.unregister();

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(clients.map((client) => client.navigate(client.url)));
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
