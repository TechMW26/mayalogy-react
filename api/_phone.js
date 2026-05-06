export function normalizePhoneInput(phone, countryCode) {
    const normalizedCountryCode = normalizeCountryCode(countryCode);
    const countryDigits = normalizedCountryCode.replace(/\D/g, '');
    let normalizedPhone = String(phone ?? '').replace(/\D/g, '');

    if (countryDigits && normalizedPhone.startsWith(countryDigits) && normalizedPhone.length > countryDigits.length + 6) {
        normalizedPhone = normalizedPhone.slice(countryDigits.length);
    }

    if (countryDigits === '91' && normalizedPhone.length === 11 && normalizedPhone.startsWith('0')) {
        normalizedPhone = normalizedPhone.slice(1);
    }

    return {
        phone: normalizedPhone,
        countryCode: normalizedCountryCode
    };
}

export function isValidNormalizedPhone(phone, countryCode) {
    const phoneDigits = String(phone ?? '');
    const countryDigits = String(countryCode ?? '').replace(/\D/g, '');

    return /^\+\d{1,4}$/.test(String(countryCode ?? ''))
        && /^\d{6,15}$/.test(phoneDigits)
        && countryDigits.length + phoneDigits.length <= 15;
}

export function buildPhoneKey(phone, countryCode) {
    return `${countryCode}_${phone}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function getReviewDemoCredentials(env = process.env) {
    const countryCode = normalizeCountryCode(env.APP_REVIEW_DEMO_COUNTRY_CODE || '+1');
    const phone = String(env.APP_REVIEW_DEMO_PHONE || '5550100').replace(/\D/g, '');
    const otp = String(env.APP_REVIEW_DEMO_OTP || '123456').replace(/\D/g, '');

    return { countryCode, phone, otp };
}

export function isReviewDemoPhone(phone, countryCode, env = process.env) {
    const demo = getReviewDemoCredentials(env);
    return String(phone || '') === demo.phone && normalizeCountryCode(countryCode) === demo.countryCode;
}

function normalizeCountryCode(countryCode) {
    const digits = String(countryCode ?? '').replace(/\D/g, '');
    return digits ? `+${digits}` : '';
}