import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPhoneKey, isValidNormalizedPhone, normalizePhoneInput } from './_phone.js';

test('normalizes Firebase phone-auth input without duplicating the country code', () => {
    assert.deepEqual(normalizePhoneInput('91 80764 84222', '+91'), {
        phone: '8076484222',
        countryCode: '+91'
    });
    assert.deepEqual(normalizePhoneInput('08076484222', '+91'), {
        phone: '8076484222',
        countryCode: '+91'
    });
});

test('validates E.164-compatible phone parts and creates a stable database key', () => {
    assert.equal(isValidNormalizedPhone('8076484222', '+91'), true);
    assert.equal(isValidNormalizedPhone('123', '+91'), false);
    assert.equal(isValidNormalizedPhone('123456789012345', '+91'), false);
    assert.equal(buildPhoneKey('8076484222', '+91'), '_91_8076484222');
});

test('browser auth uses Firebase SMS exclusively', async () => {
    for (const relativePath of ['../js/auth.js', '../public/js/auth.js']) {
        const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
        assert.match(source, /MayaFirebasePhoneAuth\.sendOTP/);
        assert.match(source, /MayaFirebasePhoneAuth\.verifyOTP/);
        assert.doesNotMatch(source, /\/api\/send-otp|\/api\/verify-otp|pendingOtpProvider|WhatsApp|Interakt/i);
    }
});

test('all rendered login flows are Firebase SMS-only and stop after send failure', async () => {
    for (const relativePath of [
        '../js/onboarding.js',
        '../public/js/onboarding.js',
        '../js/funnel.js',
        '../public/js/funnel.js'
    ]) {
        const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
        assert.match(source, /SMS OTP/);
        assert.doesNotMatch(source, /WhatsApp|pendingOtpProvider|result\.provider|resend\.provider/i);
    }

    const funnel = await readFile(new URL('../js/funnel.js', import.meta.url), 'utf8');
    assert.match(funnel, /if \(!result\.success\)[\s\S]*?return;[\s\S]*?showOTPVerificationFlow/);
});
