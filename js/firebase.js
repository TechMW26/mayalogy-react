/**
 * MAYA - Firebase Module
 * Firebase Realtime Database Integration
 */

console.log('🔧 firebase.js loading...');

const MayaFirebase = {
    dbUrl: null,
    isInitialized: false,
    FALLBACK_URL: '',

    /**
     * Initialize Firebase connection
     */
    init() {
        if (this.isInitialized && this.dbUrl) {
            console.log('🔥 Firebase already initialized');
            return true;
        }
        
        const configuredUrl = window.MAYA_CONFIG?.ENDPOINTS?.FIREBASE
            || window.MAYA_SECRETS?.FIREBASE_DB_URL
            || this.FALLBACK_URL;

        if (!configuredUrl) {
            console.warn('⚠️ Firebase database URL is not configured');
            this.dbUrl = null;
            this.isInitialized = false;
            return false;
        }

        this.dbUrl = configuredUrl;
        this.isInitialized = true;
        console.log('🔥 Firebase initialized:', this.dbUrl);
        return true;
    },

    /**
     * Generate a unique user ID
     */
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Generate a simple token
     */
    generateToken() {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    },

    /**
     * Hash password (simple client-side hash - for production use Firebase Auth)
     */
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16) + '_' + password.length;
    },

    /**
     * Make a request to Firebase with retry logic
     */
    async request(path, method = 'GET', data = null) {
        // Ensure Firebase is initialized
        if (!this.isInitialized || !this.dbUrl) {
            console.warn('⚠️ Firebase not initialized, initializing now...');
            this.init();
        }
        
        if (!this.dbUrl) {
            throw new Error('Firebase database URL is not configured');
        }
        
        const url = `${this.dbUrl}/${path}.json`;
        
        const options = {
            method: method,
            keepalive: method !== 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        // Use retry wrapper for Firebase requests
        return await MayaUtils.retry(
            async (attempt) => {
                console.log(`🌐 Firebase ${method}: ${path}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
                
                const response = await MayaUtils.withTimeout(
                    fetch(url, options),
                    15000, // 15 second timeout
                    `Firebase ${method}`
                );
                
                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    error.status = response.status;
                    throw error;
                }
                
                const result = await response.json();
                console.log(`✅ Firebase ${method} success:`, path);
                return result;
            },
            {
                maxRetries: 3,
                baseDelay: 1000,
                backoffMultiplier: 2,
                label: `Firebase ${method} ${path}`,
                retryCondition: (error) => {
                    // Don't retry 4xx errors (except 429)
                    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                        return false;
                    }
                    return MayaUtils.isRetryableError(error);
                }
            }
        );
    },

    /**
     * Check if email exists
     */
    async checkEmail(email) {
        try {
            console.log('🔍 Checking email:', email);
            const emailKey = this.emailToKey(email);
            console.log('🔑 Email key:', emailKey);
            const result = await this.request(`users/${emailKey}`, 'GET');
            console.log('📧 Email check result:', result !== null ? 'EXISTS' : 'NOT FOUND');
            return { exists: result !== null, user: result };
        } catch (error) {
            console.error('❌ Check email error:', error);
            return { exists: false, error: error.message };
        }
    },

    /**
     * Convert email to Firebase-safe key
     */
    emailToKey(email) {
        return email.replace(/[.#$[\]]/g, '_');
    },

    /**
     * Register a new user
     */
    async register(userData) {
        console.log('📝 Starting registration for:', userData.email);
        try {
            const emailKey = this.emailToKey(userData.email);
            console.log('🔑 Email key:', emailKey);
            
            // Check if user already exists
            const existing = await this.checkEmail(userData.email);
            if (existing.exists) {
                console.log('⚠️ Email already registered');
                return { success: false, error: 'Email already registered' };
            }

            const userId = this.generateUserId();
            const token = this.generateToken();
            const hashedPassword = this.hashPassword(userData.password);
            console.log('🔐 User ID generated:', userId);

            const user = {
                id: userId,
                email: userData.email,
                name: userData.name || '',
                phone: userData.phone || '',
                passwordHash: hashedPassword,
                birthDate: userData.birthDate || null,
                birthTime: userData.birthTime || null,
                birthPlace: userData.birthPlace || null,
                birthLat: Number.isFinite(Number(userData.birthLat)) ? Number(userData.birthLat) : null,
                birthLon: Number.isFinite(Number(userData.birthLon)) ? Number(userData.birthLon) : null,
                gender: userData.gender || null,
                language: userData.language || 'en',
                token: token,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            console.log('💾 Saving user to Firebase...');
            // Save to Firebase
            await this.request(`users/${emailKey}`, 'PUT', user);

            console.log('✅ User registered successfully:', userData.email);

            return {
                success: true,
                token: token,
                user: {
                    id: userId,
                    email: userData.email,
                    name: userData.name,
                    birthDate: user.birthDate,
                    birthTime: user.birthTime,
                    birthPlace: user.birthPlace,
                    birthLat: user.birthLat,
                    birthLon: user.birthLon,
                    gender: user.gender,
                    language: user.language
                }
            };
        } catch (error) {
            console.error('❌ Registration error:', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    },

    /**
     * Login user
     */
    async login(email, password) {
        try {
            const emailKey = this.emailToKey(email);
            const user = await this.request(`users/${emailKey}`, 'GET');

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const hashedPassword = this.hashPassword(password);
            if (user.passwordHash !== hashedPassword) {
                return { success: false, error: 'Invalid password' };
            }

            // Generate new token
            const newToken = this.generateToken();
            await this.request(`users/${emailKey}/token`, 'PUT', newToken);
            await this.request(`users/${emailKey}/updatedAt`, 'PUT', new Date().toISOString());

            console.log('✅ User logged in:', email);

            return {
                success: true,
                token: newToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    birthDate: user.birthDate,
                    birthTime: user.birthTime,
                    birthPlace: user.birthPlace,
                    birthLat: user.birthLat,
                    birthLon: user.birthLon,
                    gender: user.gender,
                    language: user.language
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Login failed. Please try again.' };
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(email, profileData) {
        try {
            const emailKey = this.emailToKey(email);
            
            // Update specific fields
            const updates = {
                ...profileData,
                updatedAt: new Date().toISOString()
            };

            await this.request(`users/${emailKey}`, 'PATCH', updates);

            console.log('✅ Profile updated:', email);

            return { success: true, message: 'Profile updated' };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: 'Update failed. Please try again.' };
        }
    },

    /**
     * Save birth details
     */
    async saveBirthDetails(email, birthData) {
        try {
            const emailKey = this.emailToKey(email);
            
            const updates = {
                name: birthData.name || null,
                birthDate: birthData.birthDate || null,
                birthTime: birthData.birthTime || null,
                birthPlace: birthData.birthPlace || null,
                birthLat: birthData.birthLat || null,
                birthLon: birthData.birthLon || null,
                gender: birthData.gender || null,
                updatedAt: new Date().toISOString()
            };

            if (typeof birthData.language === 'string') {
                updates.language = birthData.language === 'hi' ? 'hi' : 'en';
            }

            await this.request(`users/${emailKey}`, 'PATCH', updates);

            console.log('✅ Birth details saved:', email, updates);

            return { success: true, message: 'Birth details saved' };
        } catch (error) {
            console.error('Save birth details error:', error);
            return { success: false, error: 'Failed to save birth details.' };
        }
    },

    /**
     * Get user profile
     */
    async getProfile(email) {
        try {
            const emailKey = this.emailToKey(email);
            const user = await this.request(`users/${emailKey}`, 'GET');

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    birthDate: user.birthDate,
                    birthTime: user.birthTime,
                    birthPlace: user.birthPlace,
                    birthLat: user.birthLat,
                    birthLon: user.birthLon,
                    gender: user.gender,
                    language: user.language
                }
            };
        } catch (error) {
            console.error('Get profile error:', error);
            return { success: false, error: 'Failed to get profile.' };
        }
    },

    /**
     * Save funnel progress
     */
    async saveFunnelProgress(email, progressData) {
        try {
            const emailKey = this.emailToKey(email);
            
            await this.request(`funnel_progress/${emailKey}`, 'PUT', {
                ...progressData,
                updatedAt: new Date().toISOString()
            });

            return { success: true, message: 'Progress saved' };
        } catch (error) {
            console.error('Save funnel progress error:', error);
            return { success: false, error: 'Failed to save progress.' };
        }
    },

    /**
     * Get funnel progress
     */
    async getFunnelProgress(email) {
        try {
            const emailKey = this.emailToKey(email);
            const progress = await this.request(`funnel_progress/${emailKey}`, 'GET');

            return { success: true, progress: progress };
        } catch (error) {
            console.error('Get funnel progress error:', error);
            return { success: false, error: 'Failed to get progress.' };
        }
    },

    /**
     * Save reading/chat history
     */
    async saveReading(email, readingData) {
        try {
            const emailKey = this.emailToKey(email);
            const readingId = 'reading_' + Date.now();
            
            await this.request(`readings/${emailKey}/${readingId}`, 'PUT', {
                ...readingData,
                createdAt: new Date().toISOString()
            });

            return { success: true, readingId: readingId };
        } catch (error) {
            console.error('Save reading error:', error);
            return { success: false, error: 'Failed to save reading.' };
        }
    },

    /**
     * Get user's readings
     */
    async getReadings(email) {
        try {
            const emailKey = this.emailToKey(email);
            const readings = await this.request(`readings/${emailKey}`, 'GET');

            return { success: true, readings: readings || {} };
        } catch (error) {
            console.error('Get readings error:', error);
            return { success: false, error: 'Failed to get readings.' };
        }
    },

    /**
     * Save daily horoscope for a user
     * Stored per-date for automatic daily refresh
     */
    async saveDailyHoroscope(email, horoscopeData) {
        try {
            const emailKey = this.emailToKey(email);
            const date = horoscopeData.date || new Date().toISOString().split('T')[0];
            
            await this.request(`horoscopes/${emailKey}/${date}`, 'PUT', {
                ...horoscopeData,
                savedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Save horoscope error:', error);
            return { success: false, error: 'Failed to save horoscope.' };
        }
    },

    /**
     * Get daily horoscope for a user
     * Returns null if no horoscope exists for today
     */
    async getDailyHoroscope(email, date = null) {
        try {
            const emailKey = this.emailToKey(email);
            const targetDate = date || new Date().toISOString().split('T')[0];
            
            const horoscope = await this.request(`horoscopes/${emailKey}/${targetDate}`, 'GET');

            return { success: true, horoscope: horoscope };
        } catch (error) {
            console.error('Get horoscope error:', error);
            return { success: false, error: 'Failed to get horoscope.' };
        }
    },

    /**
     * Clear old horoscopes (keep only last 7 days)
     * Called during app init to clean up storage
     */
    async cleanupOldHoroscopes(email) {
        try {
            const emailKey = this.emailToKey(email);
            const horoscopes = await this.request(`horoscopes/${emailKey}`, 'GET');
            
            if (!horoscopes) return { success: true };
            
            const today = new Date();
            const cutoffDate = new Date(today);
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            
            for (const dateKey of Object.keys(horoscopes)) {
                const horoscopeDate = new Date(dateKey);
                if (horoscopeDate < cutoffDate) {
                    await this.request(`horoscopes/${emailKey}/${dateKey}`, 'DELETE');
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Cleanup horoscopes error:', error);
            return { success: false };
        }
    }
};

// Make globally available
window.MayaFirebase = MayaFirebase;

// Auto-initialize on load
try {
    MayaFirebase.init();
} catch (e) {
    console.error('❌ MayaFirebase auto-init failed:', e);
}

// Also re-initialize when DOM is ready (in case config wasn't loaded yet)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!MayaFirebase.isInitialized || !MayaFirebase.dbUrl) {
            console.log('🔄 Re-initializing Firebase after DOM ready...');
            MayaFirebase.init();
        }
    });
}

console.log('✅ firebase.js loaded');
