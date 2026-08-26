import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  RecaptchaVerifier,
  getAuth,
  signInAnonymously,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_PUBLIC_FIREBASE_API_KEY || 'AIzaSyD9NNjAtsNmmzf_ipoYK2FsL3MLs4cJgXM',
  authDomain: import.meta.env.VITE_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mayalogy-mwft.firebaseapp.com',
  projectId: import.meta.env.VITE_PUBLIC_FIREBASE_PROJECT_ID || 'mayalogy-mwft',
  appId: import.meta.env.VITE_PUBLIC_FIREBASE_APP_ID || '1:567378109378:web:71138848a585eb74f0ec5b',
  databaseURL: import.meta.env.VITE_PUBLIC_FIREBASE_DB_URL || 'https://mayalogy-mwft-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: import.meta.env.VITE_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mayalogy-mwft.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '567378109378',
};

let auth = null;
let initializePromise = null;
let recaptchaVerifier = null;
let confirmationResult = null;

function requireFirebaseConfig() {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Firebase client configuration is missing: ${missingKeys.join(', ')}`);
  }
}

function getRecaptchaContainer() {
  let container = document.getElementById('maya-firebase-recaptcha');

  if (!container) {
    container = document.createElement('div');
    container.id = 'maya-firebase-recaptcha';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);
  }

  return container;
}

function resetRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

function toE164(phone, countryCode) {
  const countryDigits = String(countryCode || '').replace(/\D/g, '');
  let phoneDigits = String(phone || '').replace(/\D/g, '');

  if (countryDigits && phoneDigits.startsWith(countryDigits) && phoneDigits.length > countryDigits.length + 6) {
    phoneDigits = phoneDigits.slice(countryDigits.length);
  }

  if (countryDigits === '91' && phoneDigits.length === 11 && phoneDigits.startsWith('0')) {
    phoneDigits = phoneDigits.slice(1);
  }

  if (!countryDigits || phoneDigits.length < 6 || countryDigits.length + phoneDigits.length > 15) {
    throw new Error('Invalid phone number');
  }

  return `+${countryDigits}${phoneDigits}`;
}

function getFirebaseErrorMessage(error, fallback) {
  const messages = {
    'auth/captcha-check-failed': 'Security verification failed. Please try again.',
    'auth/invalid-phone-number': 'Please enter a valid phone number.',
    'auth/missing-phone-number': 'Please enter your phone number.',
    'auth/quota-exceeded': 'SMS limit reached. Please try WhatsApp OTP later.',
    'auth/too-many-requests': 'Too many OTP requests. Please wait and try again.',
    'auth/code-expired': 'OTP has expired. Please request a new one.',
    'auth/invalid-verification-code': 'Incorrect OTP. Please try again.',
    'auth/session-expired': 'OTP session expired. Please request a new one.',
  };

  return messages[error?.code] || fallback;
}

async function ensureAnonymousSession() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  return auth.currentUser;
}

export function initializeFirebaseClient() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    requireFirebaseConfig();
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.useDeviceLanguage();
    auth.settings.appVerificationDisabledForTesting = import.meta.env.VITE_FIREBASE_AUTH_TEST_MODE === 'true';
    await ensureAnonymousSession();

    window.MayaFirebasePhoneAuth = {
      testMode: import.meta.env.VITE_FIREBASE_AUTH_TEST_MODE === 'true',

      async getIdToken(forceRefresh = false) {
        await initializeFirebaseClient();
        const user = await ensureAnonymousSession();
        return user.getIdToken(forceRefresh);
      },

      async sendOTP(phone, countryCode) {
        await initializeFirebaseClient();
        confirmationResult = null;
        resetRecaptcha();

        try {
          const container = getRecaptchaContainer();
          recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
          await recaptchaVerifier.render();
          confirmationResult = await signInWithPhoneNumber(auth, toE164(phone, countryCode), recaptchaVerifier);
          return { success: true, provider: 'firebase' };
        } catch (error) {
          console.error('Firebase SMS OTP send failed:', error);
          resetRecaptcha();
          return {
            success: false,
            error: getFirebaseErrorMessage(error, 'Failed to send SMS OTP. Please try again.'),
          };
        }
      },

      async verifyOTP(phone, countryCode, otp) {
        if (!confirmationResult) {
          return { success: false, error: 'OTP session not found. Please request a new OTP.' };
        }

        try {
          const credential = await confirmationResult.confirm(String(otp));
          const idToken = await credential.user.getIdToken(true);
          const response = await fetch('/api/firebase-phone-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, countryCode, idToken }),
          });
          const body = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(body.error || 'Could not start your Mayalogy session.');
          }

          confirmationResult = null;
          resetRecaptcha();
          return body;
        } catch (error) {
          console.error('Firebase SMS OTP verification failed:', error);
          return {
            success: false,
            error: getFirebaseErrorMessage(error, error?.message || 'OTP verification failed.'),
          };
        }
      },

      async logout() {
        await initializeFirebaseClient();
        confirmationResult = null;
        resetRecaptcha();
        await signOut(auth);
        await ensureAnonymousSession();
      },
    };

    return window.MayaFirebasePhoneAuth;
  })().catch((error) => {
    initializePromise = null;
    throw error;
  });

  return initializePromise;
}
