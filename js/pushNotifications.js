/**
 * Mayalogy notification bridge.
 * Android uses the native FCM bridge; iOS uses standards-based Web Push from
 * the installed Home Screen app (required by iOS 16.4+).
 */
const MayaPushNotifications = {
    publicKey: 'BB4ftFsgbK3ozJuiuRa8A_-pRnzjf0npedtLAdMeDaRADujGvdzACGu8p9aeDn0v7keK0IgOxzjf_fLty_yV73E',
    initialized: false,
    promptElement: null,

    isNativeAndroid() {
        return Boolean(window.MayaAndroid) || /MAYAAstrology-Android/i.test(navigator.userAgent || '');
    },

    isIosDevice() {
        return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },

    isStandalone() {
        return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    },

    isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    },

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js?v=20260922-notifications-v1', { scope: '/' });
            } catch (error) {
                console.warn('Mayalogy service worker registration failed:', error);
            }
        }
        await this.handleAuthStateChanged();
    },

    getRegistrationContext() {
        const auth = window.MayaAuth;
        if (!auth?.isAuthenticated || !auth.token) return null;
        const identity = auth.getPushRegistrationContext?.();
        return identity ? { ...identity, authToken: auth.token } : null;
    },

    async handleAuthStateChanged() {
        this.removePrompt();
        if (this.isNativeAndroid() || !this.getRegistrationContext() || !this.isIosDevice()) return;

        if (!this.isStandalone()) {
            this.showPrompt('install');
            return;
        }
        if (!this.isSupported()) return;

        if (Notification.permission === 'granted') {
            await this.syncExistingSubscription();
        } else if (Notification.permission === 'default') {
            this.showPrompt('enable');
        }
    },

    showPrompt(kind) {
        if (sessionStorage.getItem('maya_push_prompt_dismissed') === '1' || this.promptElement) return;
        window.setTimeout(() => {
            if (this.promptElement || !this.getRegistrationContext()) return;
            const install = kind === 'install';
            const element = document.createElement('section');
            element.className = 'maya-push-prompt';
            element.setAttribute('role', 'dialog');
            element.setAttribute('aria-labelledby', 'maya-push-title');
            element.innerHTML = `
                <button class="maya-push-prompt__close" type="button" aria-label="Dismiss notification setup"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
                <div class="maya-push-prompt__icon"><i class="bi ${install ? 'bi-box-arrow-up' : 'bi-bell'}" aria-hidden="true"></i></div>
                <div class="maya-push-prompt__copy">
                    <h2 id="maya-push-title">${install ? 'Get Mayalogy notifications on iPhone' : 'Stay updated with Mayalogy'}</h2>
                    <p>${install
                        ? 'Tap Share, choose Add to Home Screen, then open Mayalogy from the new icon.'
                        : 'Enable notifications for personal readings, reminders, and important updates.'}</p>
                    <div class="maya-push-prompt__actions">
                        <button type="button" data-push-dismiss>Not now</button>
                        <button type="button" class="maya-push-prompt__primary" data-push-action>${install ? 'Got it' : 'Enable notifications'}</button>
                    </div>
                </div>`;
            document.body.appendChild(element);
            this.promptElement = element;
            element.querySelector('.maya-push-prompt__close')?.addEventListener('click', () => this.dismissPrompt());
            element.querySelector('[data-push-dismiss]')?.addEventListener('click', () => this.dismissPrompt());
            element.querySelector('[data-push-action]')?.addEventListener('click', async (event) => {
                if (install) {
                    this.dismissPrompt();
                    return;
                }
                const button = event.currentTarget;
                button.disabled = true;
                button.textContent = 'Enabling…';
                const result = await this.enableFromUserGesture();
                if (result.success) {
                    this.removePrompt();
                    window.MayaUtils?.toast?.success?.('Notifications enabled');
                } else {
                    button.disabled = false;
                    button.textContent = 'Enable notifications';
                    window.MayaUtils?.toast?.error?.(result.error || 'Could not enable notifications');
                }
            });
        }, 900);
    },

    dismissPrompt() {
        sessionStorage.setItem('maya_push_prompt_dismissed', '1');
        this.removePrompt();
    },

    removePrompt() {
        this.promptElement?.remove();
        this.promptElement = null;
    },

    decodePublicKey() {
        const padded = this.publicKey.padEnd(this.publicKey.length + (4 - this.publicKey.length % 4) % 4, '=');
        const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    },

    async enableFromUserGesture() {
        if (!this.isStandalone()) return { success: false, error: 'Add Mayalogy to your Home Screen first.' };
        if (!this.isSupported()) return { success: false, error: 'Web Push is not supported on this device.' };

        try {
            let permission = Notification.permission;
            if (permission === 'default') permission = await Notification.requestPermission();
            if (permission !== 'granted') return { success: false, error: 'Notifications are blocked in device settings.' };

            const registration = await navigator.serviceWorker.register('/sw.js?v=20260922-notifications-v1', { scope: '/' });
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.decodePublicKey()
                });
            }
            await this.saveSubscription(subscription);
            return { success: true };
        } catch (error) {
            console.error('Could not enable Mayalogy Web Push:', error);
            return { success: false, error: 'Could not enable notifications. Please try again.' };
        }
    },

    async syncExistingSubscription() {
        try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription) await this.saveSubscription(subscription);
        } catch (error) {
            console.warn('Could not refresh Web Push subscription:', error);
        }
    },

    async saveSubscription(subscription) {
        const context = this.getRegistrationContext();
        if (!context) throw new Error('Sign in before enabling notifications');
        const response = await fetch('/api/web-push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${context.authToken}` },
            body: JSON.stringify({
                email: context.email,
                userId: context.userId,
                platform: 'ios-web',
                subscription: subscription.toJSON()
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not save notification subscription');
        MayaUtils.storage.set('maya_web_push_endpoint', subscription.endpoint, { skipSync: true });
    },

    async detachFromCurrentUser() {
        const context = this.getRegistrationContext();
        const endpoint = MayaUtils.storage.get('maya_web_push_endpoint');
        if (!context || !endpoint) return;
        MayaUtils.storage.remove('maya_web_push_endpoint', { skipSync: true });
        await fetch('/api/web-push-subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${context.authToken}` },
            body: JSON.stringify({ email: context.email, userId: context.userId, endpoint })
        }).catch(() => null);
    }
};

window.MayaPushNotifications = MayaPushNotifications;
