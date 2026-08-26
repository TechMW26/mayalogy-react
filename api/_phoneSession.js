import { randomBytes } from 'node:crypto';
import { firebaseRequest } from './_firebase.js';
import { buildPhoneKey } from './_phone.js';

export async function createPhoneAppSession({ phone, countryCode, profileDefaults = {} }) {
    const phoneKey = buildPhoneKey(phone, countryCode);
    const userPath = `maya_phone_users/${phoneKey}`;
    const existingUser = await firebaseRequest(userPath).catch(() => null);
    const isNewUser = !existingUser;
    const now = Date.now();
    const token = `tok_${now}_${randomBytes(18).toString('base64url')}`;
    const baseUser = existingUser || {
        id: phoneKey,
        phone: `${countryCode}${phone}`,
        countryCode,
        phoneNumber: phone,
        createdAt: now,
        ...profileDefaults
    };
    const user = {
        ...baseUser,
        token,
        lastLogin: now
    };

    await firebaseRequest(userPath, {
        method: isNewUser ? 'PUT' : 'PATCH',
        body: isNewUser ? user : { token, lastLogin: now }
    });

    return {
        success: true,
        isNewUser,
        token,
        user: buildClientUser(user, now)
    };
}

function buildClientUser(user, lastLogin) {
    return {
        id: user.id,
        email: user.email || null,
        name: user.name || null,
        phone: user.phone,
        countryCode: user.countryCode,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        lastLogin,
        birthDate: user.birthDate || null,
        birthTime: user.birthTime || null,
        birthPlace: user.birthPlace || null,
        birthLat: user.birthLat ?? null,
        birthLon: user.birthLon ?? null,
        gender: user.gender || null,
        maritalStatus: user.maritalStatus || null,
        language: user.language || null,
        agentGender: user.agentGender || null
    };
}
