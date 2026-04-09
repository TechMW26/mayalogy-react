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
    init() {
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
            console.log('✅ Auth restored from storage:', storedUser.email);
        } else {
            console.log('👤 No stored auth found');
        }
        
        return this.isAuthenticated;
    },

    /**
     * Check if email exists
     */
    async checkEmail(email) {
        if (!window.MayaFirebase) {
            return false;
        }
        const result = await MayaFirebase.checkEmail(email);
        return result.exists || false;
    },

    /**
     * Register a new user
     */
    async register(userData) {
        console.log('📝 Registering user:', userData.email);
        
        if (!window.MayaFirebase) {
            console.error('❌ Firebase not initialized');
            return { success: false, error: 'Firebase not initialized' };
        }
        
        // Ensure Firebase is initialized
        if (!MayaFirebase.isInitialized) {
            MayaFirebase.init();
        }

        try {
            const result = await MayaFirebase.register(userData);
            console.log('📝 Registration result:', result.success ? 'Success' : result.error);
            
            if (result.success) {
                this.currentUser = result.user;
                this.token = result.token;
                this.isAuthenticated = true;
                
                MayaUtils.storage.set('maya_user', this.currentUser);
                MayaUtils.storage.set('maya_token', this.token);
                
                // Initialize DB sync for new user
                if (window.MayaDBSync) {
                    console.log('🔄 Initializing sync for new user...');
                    MayaDBSync.init(result.user.email);
                    // Sync any existing local data to cloud
                    await MayaDBSync.syncAllToFirebase();
                }
                
                console.log('✅ User registered and logged in:', this.currentUser.email);
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: result.error || 'Registration failed' };
            }
        } catch (error) {
            console.error('❌ Registration error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Login user
     */
    async login(email, password) {
        console.log('🔑 Logging in user:', email);
        
        if (!window.MayaFirebase) {
            console.error('❌ Firebase not initialized');
            return { success: false, error: 'Firebase not initialized' };
        }
        
        // Ensure Firebase is initialized
        if (!MayaFirebase.isInitialized) {
            MayaFirebase.init();
        }

        try {
            const result = await MayaFirebase.login(email, password);
            console.log('🔑 Login result:', result.success ? 'Success' : result.error);
            
            if (result.success) {
                this.currentUser = result.user;
                this.token = result.token;
                this.isAuthenticated = true;
                
                MayaUtils.storage.set('maya_user', this.currentUser);
                MayaUtils.storage.set('maya_token', this.token);
                
                // Also update local profile with user data from Firebase
                const profile = MayaUtils.storage.get('maya_profile') || {};
                MayaUtils.storage.set('maya_profile', {
                    ...profile,
                    name: result.user.name,
                    email: result.user.email,
                    birthDate: result.user.birthDate || profile.birthDate,
                    birthTime: result.user.birthTime || profile.birthTime,
                    birthPlace: result.user.birthPlace || profile.birthPlace,
                    birthLat: Number.isFinite(Number(result.user.birthLat)) ? Number(result.user.birthLat) : (profile.birthLat ?? null),
                    birthLon: Number.isFinite(Number(result.user.birthLon)) ? Number(result.user.birthLon) : (profile.birthLon ?? null),
                    gender: result.user.gender || profile.gender,
                    language: result.user.language || profile.language || MayaUtils.storage.get('maya_language') || 'en'
                });
                
                // Sync user data from Firebase (load settings, chat history, etc.)
                if (window.MayaDBSync) {
                    console.log('🔄 Syncing user data from cloud...');
                    await MayaDBSync.onUserLogin(email);
                }
                
                console.log('✅ User logged in:', this.currentUser.email);
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: result.error || 'Invalid credentials' };
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    /**
     * Logout user
     */
    logout() {
        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        
        MayaUtils.storage.remove('maya_user');
        MayaUtils.storage.remove('maya_token');
        MayaUtils.storage.remove('maya_profile');
        MayaUtils.storage.remove('funnel_complete');
        
        // Clear conversation history
        if (window.MayaAI) {
            MayaAI.clearHistory();
        }
        
        // Clear sync state
        if (window.MayaDBSync) {
            MayaDBSync.onUserLogout();
        }
        
        return true;
    },

    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        if (!this.isAuthenticated || !this.currentUser?.email) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!window.MayaFirebase) {
            return { success: false, error: 'Firebase not initialized' };
        }

        try {
            const result = await MayaFirebase.updateProfile(this.currentUser.email, profileData);
            
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

        if (!this.isAuthenticated || !this.currentUser?.email) {
            return { success: true, local: true };
        }

        if (!window.MayaFirebase) {
            return { success: true, local: true };
        }

        try {
            const result = await MayaFirebase.saveBirthDetails(this.currentUser.email, birthData);
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
        
        if (!this.isAuthenticated || !this.currentUser?.email) {
            return localData || null;
        }

        if (!window.MayaFirebase) {
            return localData || null;
        }

        try {
            const result = await MayaFirebase.getProfile(this.currentUser.email);
            
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
                    language: result.user.language,
                    email: result.user.email
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
        if (!this.isAuthenticated || !this.currentUser?.email) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!window.MayaFirebase) {
            return { success: false, error: 'Firebase not initialized' };
        }

        try {
            const result = await MayaFirebase.getProfile(this.currentUser.email);
            
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
        if (!this.isAuthenticated || !this.currentUser?.email) {
            return { success: true, local: true };
        }

        if (!window.MayaFirebase) {
            return { success: true, local: true };
        }

        try {
            return await MayaFirebase.saveFunnelProgress(this.currentUser.email, progressData);
        } catch (error) {
            console.error('Save funnel progress error:', error);
            return { success: true, local: true };
        }
    },

    /**
     * Request password reset (placeholder)
     */
    async forgotPassword(email) {
        console.log('Password reset requested for:', email);
        return { 
            success: true, 
            message: 'If an account exists with this email, you will receive reset instructions.' 
        };
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
     * Capture email for funnel (pre-auth)
     */
    async captureEmail(email, source = 'teaser') {
        if (!window.MayaFirebase) {
            return false;
        }

        try {
            await MayaFirebase.request(`email_captures/${MayaFirebase.emailToKey(email)}`, 'PUT', {
                email: email,
                source: source,
                capturedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Email capture error:', error);
            return false;
        }
    }
};

// Make globally available
window.MayaAuth = MayaAuth;
