/**
 * MAYA - Auth Module
 * User Authentication with Firebase
 */

console.log('🔧 auth.js loading...');

const MayaAuth = {
    currentUser: null,
    isAuthenticated: false,
    token: null,

    /**
     * Initialize auth state from storage
     */
    async init() {
        console.log('🔐 Initializing Auth module...');
        
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
            const sessionIdentifier = storedUser.email || storedUser.phone;
            MayaUtils.storage.set('maya_session', {
                email: storedUser.email,
                phone: storedUser.phone,
                token: storedToken
            }, { skipSync: true });

            if (window.MayaDBSync && storedUser.email) {
                MayaDBSync.init(storedUser.email);
                try {
                    await MayaDBSync.loadFromFirebase();
                } catch (error) {
                    console.warn('⚠️ Could not restore synced user data:', error);
                }
            }

            console.log('✅ Auth restored from storage:', sessionIdentifier);
        } else {
            console.log('👤 No stored auth found');
        }
        
        return this.isAuthenticated;
    },

    /**
     * Send WhatsApp OTP via Interakt
     */
    async sendOTP(phone, countryCode) {
        try {
            const resp = await fetch('/api/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, countryCode })
            });
            const data = await resp.json();
            if (!resp.ok) return { success: false, error: data.error || 'Failed to send OTP' };
            return { success: true };
        } catch (err) {
            console.error('sendOTP error:', err);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Verify WhatsApp OTP and log in / register the user
     */
    async verifyOTP(phone, countryCode, otp) {
        try {
            const resp = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, countryCode, otp })
            });
            const data = await resp.json();
            if (!resp.ok) return { success: false, error: data.error || 'OTP verification failed' };

            const { user, token, isNewUser } = data;
            this.currentUser = user;
            this.token = token;
            this.isAuthenticated = true;

            MayaUtils.storage.set('maya_user', user);
            MayaUtils.storage.set('maya_token', token);
            MayaUtils.storage.set('maya_session', { phone: user.phone, token }, { skipSync: true });

            // Merge phone into profile
            const profile = MayaUtils.storage.get('maya_profile') || {};
            MayaUtils.storage.set('maya_profile', {
                ...profile,
                phone: user.phone,
                countryCode: user.countryCode,
                phoneNumber: user.phoneNumber
            });

            console.log('✅ Phone OTP auth success:', user.phone);
            return { success: true, user, isNewUser };
        } catch (err) {
            console.error('verifyOTP error:', err);
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
        
        MayaUtils.storage.remove('maya_user', { skipSync: true });
        MayaUtils.storage.remove('maya_token', { skipSync: true });
        MayaUtils.storage.remove('maya_session', { skipSync: true });
        MayaUtils.storage.remove('maya_profile', { skipSync: true });
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
                this.currentUser = { ...this.currentUser, ...profileData };
                MayaUtils.storage.set('maya_user', this.currentUser);
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
                this.currentUser = { ...this.currentUser, ...result.user };
                MayaUtils.storage.set('maya_user', this.currentUser);
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
