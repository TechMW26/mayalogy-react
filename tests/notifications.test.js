import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWebPushSubscriptionKey } from '../api/_firebase.js';
import { normalizeSubscription } from '../api/web-push-subscription.js';
import {
    collectWebPushSubscriptions,
    MAYA_WEB_PUSH_PUBLIC_KEY,
    sendWebPushSubscriptions
} from '../server/webPush.js';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('native Android notification wiring targets the Mayalogy Firebase project', async () => {
    const [manifest, service, activity, googleServices] = await Promise.all([
        read('../android-app/app/src/main/AndroidManifest.xml'),
        read('../android-app/app/src/main/java/com/maya/astrology/MayaFirebaseMessagingService.kt'),
        read('../android-app/app/src/main/java/com/maya/astrology/MainActivity.kt'),
        read('../android-app/app/google-services.json').then(JSON.parse)
    ]);

    assert.equal(googleServices.project_info.project_id, 'mayalogy-mwft');
    assert.equal(googleServices.client[0].client_info.android_client_info.package_name, 'com.maya.astrology');
    assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
    assert.match(manifest, /MayaFirebaseMessagingService/);
    assert.match(service, /override fun onNewToken/);
    assert.match(service, /override fun onMessageReceived/);
    assert.match(activity, /window\.dispatchEvent\(new CustomEvent\('maya:fcm-token'/);
    assert.match(activity, /getFcmToken\(\)/);
    assert.match(activity, /fun getNotificationPermissionState\(\): String/);
    assert.match(activity, /fun requestNotificationPermission\(\)/);
    assert.match(activity, /Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
    const onCreateBody = activity.split('override fun onCreate')[1].split('private fun setupPermissionLaunchers')[0];
    assert.doesNotMatch(onCreateBody, /requestNotificationPermissionIfNeeded\(\)/);
    const browserAuth = await read('../public/js/auth.js');
    assert.match(browserAuth, /detachFcmTokenFromCurrentUser/);
    const detachBody = browserAuth.split('async detachFcmTokenFromCurrentUser()')[1].split('async hydrateAuthenticatedState')[0];
    assert.match(detachBody, /fetch\('\/api\/save-fcm-token'/);
    assert.match(detachBody, /method: 'DELETE'/);
});

test('Web Push uses one persistent root service worker and a user-tap permission request', async () => {
    const [rootWorker, publicWorker, rootPush, publicPush, index, loader, manifest] = await Promise.all([
        read('../sw.js'),
        read('../public/sw.js'),
        read('../js/pushNotifications.js'),
        read('../public/js/pushNotifications.js'),
        read('../index.html'),
        read('../src/legacyLoader.js'),
        read('../public/manifest.json').then(JSON.parse)
    ]);

    assert.equal(rootWorker, publicWorker);
    assert.equal(rootPush, publicPush);
    assert.match(rootWorker, /addEventListener\('push'/);
    assert.match(rootWorker, /addEventListener\('notificationclick'/);
    assert.doesNotMatch(rootWorker, /registration\.unregister/);
    assert.match(index, /serviceWorker\.register\(`\/sw\.js\?v=\$\{buildStamp\}`/);
    assert.doesNotMatch(index, /registration\.unregister/);
    assert.match(loader, /pushNotifications\.js/);

    const enableBody = rootPush.split('async enableFromUserGesture()')[1].split('async syncExistingSubscription()')[0];
    const initBody = rootPush.split('async init()')[1].split('getRegistrationContext()')[0];
    assert.match(enableBody, /Notification\.requestPermission\(\)/);
    assert.match(enableBody, /pushManager\.subscribe/);
    assert.match(enableBody, /this\.isIosDevice\(\) && !this\.isStandalone\(\)/);
    assert.doesNotMatch(initBody, /Notification\.requestPermission\(\)/);
    assert.match(rootPush, /Add to Home Screen/);
    assert.match(rootPush, /Allow Mayalogy notifications/);
    assert.match(rootPush, /showPrompt\('web-settings'\)/);
    assert.match(rootPush, /Subscribe to Mayalogy updates/);
    assert.match(rootPush, /requestNotificationPermission/);
    assert.match(rootPush, /Open Android Settings, choose Apps, Mayalogy, Notifications/);
    assert.match(rootPush, /sessionStorage\.setItem\('maya_push_prompt_dismissed'/);
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.id, '/');
});

test('Web Push subscriptions are validated and keyed without storing endpoints as RTDB keys', () => {
    const valid = normalizeSubscription({
        endpoint: 'https://push.example.test/subscription/123',
        expirationTime: null,
        keys: { auth: 'auth-value', p256dh: 'key-value' }
    });
    assert.equal(valid.endpoint, 'https://push.example.test/subscription/123');
    assert.equal(getWebPushSubscriptionKey(valid.endpoint).length, 64);
    assert.equal(normalizeSubscription({ endpoint: 'javascript:alert(1)', keys: { auth: 'a', p256dh: 'b' } }), null);
    assert.equal(normalizeSubscription({ endpoint: 'https://push.example.test', keys: {} }), null);
});

test('notification sender recognizes Web Push destinations and fails closed without its private key', async () => {
    const subscriptions = collectWebPushSubscriptions({
        webPushSubscriptions: {
            valid: { endpoint: 'https://push.example.test/1', keys: { auth: 'a', p256dh: 'b' } },
            invalid: { endpoint: 'https://push.example.test/2', keys: {} }
        }
    });
    assert.equal(subscriptions.length, 1);
    const result = await sendWebPushSubscriptions('users/test', subscriptions, { title: 'Test', body: 'Body' }, { WEB_PUSH_PRIVATE_KEY: '' });
    assert.deepEqual(result, { sentCount: 0, failedCount: 1, results: [], notConfigured: true });
});

test('the same VAPID public key is used by browser subscriptions and server delivery', async () => {
    const client = await read('../public/js/pushNotifications.js');
    assert.match(client, new RegExp(MAYA_WEB_PUSH_PUBLIC_KEY));
    assert.equal(MAYA_WEB_PUSH_PUBLIC_KEY.length, 87);
});
