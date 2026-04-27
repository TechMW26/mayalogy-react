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

function normalizeCountryCode(countryCode) {
    const digits = String(countryCode ?? '').replace(/\D/g, '');
    return digits ? `+${digits}` : '';
}