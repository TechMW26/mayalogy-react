/**
 * MAYA - Auth Module
 * User Authentication with Firebase
 */

console.log('🔧 auth.js loading...');

const MayaAuth = {
    currentUser: null,
    isAuthenticated: false,
    token: null,
    pushBridgeInitialized: false,
    pendingFcmToken: null,

    /**
     * Initialize auth state from storage
     */
    async init() {
        console.log('🔐 Initializing Auth module...');

        this.initFcmTokenBridge();

        // Initialize Firebase first
        if (window.MayaFirebase) {
            const result = MayaFirebase.init();
            console.log('🔥 Firebase init result:', result);
        } else {
            console.error('❌ MayaFirebase not found!');
        }

        const storedUser = MayaUtils.storage.get('maya_user');
        const storedToken = MayaUtils.storage.get('maya_token');

        if (storedUser && storedToken) {
            this.currentUser = storedUser;
            this.token = storedToken;
            this.isAuthenticated = true;
            try {
                await this.hydrateAuthenticatedState({ loadRemoteProfile: true });
            } catch (error) {
                console.warn('⚠️ Could not hydrate stored auth state:', error);
                this.persistAuthenticatedState(storedUser);
            }

            const sessionIdentifier = this.currentUser.email || this.currentUser.phone;

            console.log('✅ Auth restored from storage:', sessionIdentifier);
        } else {
            console.log('👤 No stored auth found');
        }

        if (this.isAuthenticated) {
            void this.syncFcmToken();
        }

        return this.isAuthenticated;
    },

    initFcmTokenBridge() {
        if (this.pushBridgeInitialized) {
            return;
        }

        this.pushBridgeInitialized = true;

        const existingHandler = window.onMayaFcmToken;
        const handleFcmToken = (token) => {
            const normalizedToken = this.normalizeFcmToken(token);

            if (!normalizedToken) {
                return;
            }

            this.pendingFcmToken = normalizedToken;
            MayaUtils.storage.set('maya_native_fcm_token', normalizedToken, { skipSync: true });

            if (this.isAuthenticated) {
                void this.syncFcmToken(normalizedToken);
            }
        };

        window.onMayaFcmToken = (token) => {
            handleFcmToken(token);

            if (typeof existingHandler === 'function') {
                existingHandler(token);
            }
        };

        window.addEventListener('maya:fcm-token', (event) => {
            handleFcmToken(event?.detail?.token);
        });

        handleFcmToken(this.readNativeFcmToken());
    },

    normalizeFcmToken(token) {
        if (typeof token !== 'string') {
            return '';
        }

        const normalizedToken = token.trim();
        return normalizedToken && normalizedToken !== 'null' && normalizedToken !== 'undefined'
            ? normalizedToken
            : '';
    },

    readNativeFcmToken() {
        try {
            if (window.MayaAndroid && typeof MayaAndroid.getFcmToken === 'function') {
                const nativeToken = this.normalizeFcmToken(MayaAndroid.getFcmToken());

                if (nativeToken) {
                    return nativeToken;
                }
            }
        } catch (error) {
            console.warn('Could not read native FCM token:', error);
        }

        return this.normalizeFcmToken(MayaUtils.storage.get('maya_native_fcm_token'));
    },

    getPushRegistrationContext() {
        if (this.currentUser?.email) {
            const emailKey = window.MayaFirebase?.emailToKey
                ? MayaFirebase.emailToKey(this.currentUser.email)
                : String(this.currentUser.email).replace(/[.#$[\]]/g, '_');

            return {
                email: this.currentUser.email,
                cacheKey: `email:${emailKey}`
            };
        }

        if (this.currentUser?.id) {
            return {
                userId: this.currentUser.id,
                cacheKey: `phone:${this.currentUser.id}`
            };
        }

        return null;
    },

    async syncFcmToken(token = this.pendingFcmToken || this.readNativeFcmToken()) {
        const fcmToken = this.normalizeFcmToken(token);
        const registrationContext = this.getPushRegistrationContext();

        if (!this.isAuthenticated || !this.token || !registrationContext || !fcmToken) {
            return { success: false, skipped: true };
        }

        const cachedRegistration = MayaUtils.storage.get('maya_fcm_registration');
        if (cachedRegistration?.token === fcmToken && cachedRegistration?.userKey === registrationContext.cacheKey) {
            return { success: true, cached: true };
        }

        const response = await fetch('/api/save-fcm-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
                ...registrationContext,
                fcmToken,
                platform: 'android-webview',
                source: 'android-webview',
                appPackage: 'com.maya.astrology'
            })
        });

        const responseBody = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(responseBody.error || 'Failed to register FCM token');
        }

        MayaUtils.storage.set('maya_fcm_registration', {
            token: fcmToken,
            userKey: registrationContext.cacheKey,
            updatedAt: new Date().toISOString()
        }, { skipSync: true });

        return { success: true, tokenKey: responseBody.tokenKey || null };
    },

    mergeKnownFields(target, source, keys) {
        const merged = { ...(target || {}) };

        keys.forEach((key) => {
            const value = source?.[key];

            if (value !== undefined && value !== null && value !== '') {
                merged[key] = value;
            }
        });

        return merged;
    },

    persistAuthenticatedState(user = this.currentUser) {
        if (!user || !this.token) {
            return null;
        }

        const authFields = [
            'id', 'email', 'name', 'phone', 'countryCode', 'phoneNumber', 'createdAt', 'lastLogin',
            'birthDate', 'birthTime', 'birthPlace', 'birthLat', 'birthLon', 'gender', 'maritalStatus',
            'language', 'agentGender'
        ];
        const profileFields = [
            'name', 'gender', 'agentGender', 'birthDate', 'birthTime', 'birthPlace', 'birthLat', 'birthLon',
            'maritalStatus', 'language', 'email', 'phone', 'countryCode', 'phoneNumber'
        ];

        this.currentUser = this.mergeKnownFields(this.currentUser, user, authFields);
        MayaUtils.storage.set('maya_session', {
            email: this.currentUser.email || null,
            phone: this.currentUser.phone || null,
            token: this.token
        }, { skipSync: true });

        const mergedProfile = this.mergeKnownFields(MayaUtils.storage.get('maya_profile') || {}, this.currentUser, profileFields);
        this.currentUser = this.mergeKnownFields(this.currentUser, mergedProfile, profileFields);
        MayaUtils.storage.set('maya_user', this.currentUser);
        MayaUtils.storage.set('maya_profile', mergedProfile);

        const mergedFunnelData = this.mergeKnownFields(MayaUtils.storage.get('funnel_data') || {}, mergedProfile, profileFields);
        MayaUtils.storage.set('funnel_data', mergedFunnelData);

        if (mergedProfile.language) {
            MayaUtils.storage.set('maya_language', mergedProfile.language);
        }

        if (mergedProfile.birthDate) {
            MayaUtils.storage.set('funnel_complete', true);
        }

        return mergedProfile;
    },

    async hydrateAuthenticatedState({ loadRemoteProfile = true } = {}) {
        if (!this.isAuthenticated || !this.currentUser) {
            return { user: null, profile: null };
        }

        const storageInfo = this.getCurrentUserStorageInfo();

        if (window.MayaDBSync && this.currentUser.email) {
            MayaDBSync.init(this.currentUser.email);

            try {
                await MayaDBSync.loadFromFirebase();
            } catch (error) {
                console.warn('⚠️ Could not restore synced user data:', error);
            }
        }

        if (!loadRemoteProfile || !storageInfo || !window.MayaFirebase) {
            return {
                user: this.currentUser,
                profile: this.persistAuthenticatedState(this.currentUser)
            };
        }

        let remoteUser = null;

        try {
            if (storageInfo.type === 'email') {
                const result = await MayaFirebase.getProfile(storageInfo.identifier);
                remoteUser = result?.success ? result.user : null;
            } else {
                remoteUser = await MayaFirebase.request(storageInfo.profilePath, 'GET');
            }
        } catch (error) {
            console.warn('⚠️ Could not fetch remote auth profile:', error);
        }

        const profile = this.persistAuthenticatedState(remoteUser || this.currentUser);

        if (storageInfo.type === 'phone' && profile?.birthDate && !remoteUser?.birthDate) {
            try {
                await this.saveBirthDetails(profile);
            } catch (error) {
                console.warn('⚠️ Could not backfill phone profile:', error);
            }
        }

        return {
            user: this.currentUser,
            profile
        };
    },

    /**
     * Send a Firebase SMS OTP.
     */
    async sendOTP(phone, countryCode) {
        if (!window.MayaFirebasePhoneAuth?.sendOTP) {
            return { success: false, error: 'SMS authentication is not available. Please refresh and try again.' };
        }

        return window.MayaFirebasePhoneAuth.sendOTP(phone, countryCode);
    },

    /**
     * Verify a Firebase SMS OTP and create an app session.
     */
    async verifyOTP(phone, countryCode, otp) {
        try {
            if (!window.MayaFirebasePhoneAuth?.verifyOTP) {
                return { success: false, error: 'SMS authentication is not available. Please refresh and try again.' };
            }

            const data = await window.MayaFirebasePhoneAuth.verifyOTP(phone, countryCode, otp);
            if (!data.success) return data;

            const { user, token, isNewUser } = data;
            this.currentUser = user;
            this.token = token;
            this.isAuthenticated = true;

            MayaUtils.storage.set('maya_token', token);

            try {
                await this.hydrateAuthenticatedState({ loadRemoteProfile: true });
            } catch (error) {
                console.warn('⚠️ Could not hydrate phone auth profile:', error);
                this.persistAuthenticatedState(user);
            }

            console.log('✅ Phone OTP auth success:', this.currentUser.phone);
            void this.syncFcmToken();
            return { success: true, user: this.currentUser, isNewUser };
        } catch (err) {
            console.error('verifyOTP error:', err);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Temporary credential login for Google Play reviewers.
     * The server enables this only for the Android app user agent.
     */
    async loginForAppReview(loginId, password) {
        try {
            const response = await fetch('/api/review-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, password })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                return { success: false, error: data.error || 'Reviewer login failed' };
            }

            this.currentUser = data.user;
            this.token = data.token;
            this.isAuthenticated = true;
            MayaUtils.storage.set('maya_token', data.token);
            this.persistAuthenticatedState(data.user);
            void this.syncFcmToken();
            return { success: true, user: this.currentUser, reviewAccount: true };
        } catch (error) {
            console.error('Reviewer login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    getCurrentUserStorageInfo() {
        if (this.currentUser?.email) {
            return {
                type: 'email',
                identifier: this.currentUser.email,
                profilePath: `users/${MayaFirebase.emailToKey(this.currentUser.email)}`,
                progressPath: `funnel_progress/${MayaFirebase.emailToKey(this.currentUser.email)}`
            };
        }

        if (this.currentUser?.id && this.currentUser?.phone) {
            return {
                type: 'phone',
                identifier: this.currentUser.phone,
                profilePath: `maya_phone_users/${this.currentUser.id}`,
                progressPath: `maya_phone_progress/${this.currentUser.id}`
            };
        }

        return null;
    },

    /**
     * Logout user
     */
    logout() {
        if (window.MayaDBSync) {
            MayaDBSync.clearLocalCache();
            MayaDBSync.onUserLogout();
        }

        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        void window.MayaFirebasePhoneAuth?.logout?.();

        MayaUtils.storage.remove('maya_user', { skipSync: true });
        MayaUtils.storage.remove('maya_token', { skipSync: true });
        MayaUtils.storage.remove('maya_session', { skipSync: true });
        MayaUtils.storage.remove('maya_profile', { skipSync: true });
        MayaUtils.storage.remove('maya_fcm_registration', { skipSync: true });
        MayaUtils.storage.remove('funnel_complete', { skipSync: true });

        // Clear conversation history
        if (window.MayaAI) {
            MayaAI.clearHistory();
        }

        return true;
    },

    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        const storageInfo = this.getCurrentUserStorageInfo();
        if (!this.isAuthenticated || !storageInfo) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!window.MayaFirebase) {
            return { success: false, error: 'Firebase not initialized' };
        }

        try {
            const updates = {
                ...profileData,
                updatedAt: new Date().toISOString()
            };
            const result = storageInfo.type === 'email'
                ? await MayaFirebase.updateProfile(storageInfo.identifier, profileData)
                : await MayaFirebase.request(storageInfo.profilePath, 'PATCH', updates).then(() => ({ success: true }));

            if (result.success) {
                this.persistAuthenticatedState({ ...this.currentUser, ...profileData });
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: result.error || 'Update failed' };
            }
        } catch (error) {
            console.error('Profile update error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Save birth details
     */
    async saveBirthDetails(birthData) {
        // Always save locally
        const profile = MayaUtils.storage.get('maya_profile') || {};
        MayaUtils.storage.set('maya_profile', { ...profile, ...birthData });

        const storageInfo = this.getCurrentUserStorageInfo();
        if (!this.isAuthenticated || !storageInfo) {
            return { success: true, local: true };
        }

        if (!window.MayaFirebase) {
            return { success: true, local: true };
        }

        try {
            const result = storageInfo.type === 'email'
                ? await MayaFirebase.saveBirthDetails(storageInfo.identifier, birthData)
                : await MayaFirebase.request(storageInfo.profilePath, 'PATCH', {
                    name: birthData.name || null,
                    birthDate: birthData.birthDate || null,
                    birthTime: birthData.birthTime || null,
                    birthPlace: birthData.birthPlace || null,
                    birthLat: birthData.birthLat || null,
                    birthLon: birthData.birthLon || null,
                    gender: birthData.gender || null,
                    maritalStatus: birthData.maritalStatus || null,
                    language: typeof birthData.language === 'string' ? birthData.language : undefined,
                    updatedAt: new Date().toISOString()
                }).then(() => ({ success: true }));
            return result;
        } catch (error) {
            console.error('Save birth details error:', error);
            return { success: true, local: true }; // Still saved locally
        }
    },

    /**
     * Get birth details
     */
    async getBirthDetails() {
        // First check local storage
        const localData = MayaUtils.storage.get('maya_profile');
        const storageInfo = this.getCurrentUserStorageInfo();

        if (!this.isAuthenticated || !storageInfo) {
            return localData || null;
        }

        if (!window.MayaFirebase) {
            return localData || null;
        }

        try {
            const result = storageInfo.type === 'email'
                ? await MayaFirebase.getProfile(storageInfo.identifier)
                : await MayaFirebase.request(storageInfo.profilePath, 'GET').then((user) => ({ success: !!user, user }));

            if (result.success && result.user) {
                // Merge ALL fields from cloud with local data
                const profileData = {
                    name: result.user.name,
                    birthDate: result.user.birthDate,
                    birthTime: result.user.birthTime,
                    birthPlace: result.user.birthPlace,
                    birthLat: result.user.birthLat,
                    birthLon: result.user.birthLon,
                    gender: result.user.gender,
                    maritalStatus: result.user.maritalStatus,
                    language: result.user.language,
                    email: result.user.email,
                    phone: result.user.phone,
                    countryCode: result.user.countryCode,
                    phoneNumber: result.user.phoneNumber
                };
                // Merge: local data as base, cloud data overwrites
                const mergedProfile = { ...localData, ...profileData };
                MayaUtils.storage.set('maya_profile', mergedProfile);

                // Also sync language setting
                if (profileData.language) {
                    MayaUtils.storage.set('maya_language', profileData.language);
                }

                if (mergedProfile.birthDate) {
                    MayaUtils.storage.set('funnel_complete', true);
                }

                return mergedProfile;
            }

            return localData || null;
        } catch (error) {
            console.error('Get birth details error:', error);
            return localData || null;
        }
    },

    /**
     * Get user profile from Firebase
     */
    async getProfile() {
        const storageInfo = this.getCurrentUserStorageInfo();
        if (!this.isAuthenticated || !storageInfo) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!window.MayaFirebase) {
            return { success: false, error: 'Firebase not initialized' };
        }

        try {
            const result = storageInfo.type === 'email'
                ? await MayaFirebase.getProfile(storageInfo.identifier)
                : await MayaFirebase.request(storageInfo.profilePath, 'GET').then((user) => ({ success: !!user, user }));

            if (result.success) {
                this.persistAuthenticatedState({ ...this.currentUser, ...result.user });
            }

            return result;
        } catch (error) {
            console.error('Get profile error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Save funnel progress
     */
    async saveFunnelProgress(progressData) {
        const storageInfo = this.getCurrentUserStorageInfo();
        if (!this.isAuthenticated || !storageInfo) {
            return { success: true, local: true };
        }

        if (!window.MayaFirebase) {
            return { success: true, local: true };
        }

        try {
            return storageInfo.type === 'email'
                ? await MayaFirebase.saveFunnelProgress(storageInfo.identifier, progressData)
                : await MayaFirebase.request(storageInfo.progressPath, 'PUT', {
                    ...progressData,
                    updatedAt: new Date().toISOString()
                }).then(() => ({ success: true }));
        } catch (error) {
            console.error('Save funnel progress error:', error);
            return { success: true, local: true };
        }
    },

    /**
     * Get current user
     */
    getUser() {
        return this.currentUser;
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.isAuthenticated;
    },

    /**
     * Check if user has completed onboarding
     */
    hasCompletedOnboarding() {
        const profile = MayaUtils.storage.get('maya_profile');
        return profile && profile.birthDate;
    },

    /**
     * Capture phone (pre-auth, for lead tracking)
     */
    async capturePhone(phone, countryCode, source = 'gate') {
        if (!window.MayaFirebase) {
            return false;
        }

        try {
            const phoneKey = `${countryCode}_${phone}`.replace(/[^a-zA-Z0-9_]/g, '_');
            await MayaFirebase.request(`phone_captures/${phoneKey}`, 'PUT', {
                phone: `${countryCode}${phone}`,
                countryCode,
                phoneNumber: phone,
                source,
                capturedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Phone capture error:', error);
            return false;
        }
    },

};

// Make globally available
window.MayaAuth = MayaAuth;
