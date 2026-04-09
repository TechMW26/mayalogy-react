/**
 * MAYA - Database Sync Layer
 * Syncs data between localStorage (speed) and Firebase (persistence)
 * All user data should be saved via this module for cross-device sync
 */

console.log('🔧 dbSync.js loading...');

const MayaDBSync = {
    isInitialized: false,
    currentUserEmail: null,
    syncQueue: [],
    isSyncing: false,
    
    // Data keys that should be synced to Firebase
    SYNCABLE_KEYS: [
        'maya_profile',
        'maya_profile_photo',
        'maya_language',
        'maya_theme',
        'maya_voice_muted',
        'maya_notifications',
        'maya_chat_history',
        'maya_palm_readings',
        'maya_vastu_analyses',
        'maya_dismissed_notifications',
        'maya_current_page',
        'funnel_complete',
        'maya_funnel_progress'
    ],

    /**
     * Initialize the sync layer with current user
     */
    init(userEmail = null) {
        if (userEmail) {
            this.currentUserEmail = userEmail;
        } else {
            // Try to get from session
            const session = MayaUtils.storage.get('maya_session');
            if (session && session.email) {
                this.currentUserEmail = session.email;
            }
        }
        
        this.isInitialized = true;
        console.log('🔄 MayaDBSync initialized', this.currentUserEmail ? `for ${this.currentUserEmail}` : '(no user)');
        
        // Start sync queue processor
        this.processSyncQueue();
        
        return this;
    },

    /**
     * Set data - saves to both localStorage and queues for Firebase sync
     */
    set(key, value) {
        try {
            // Always save to localStorage first (instant)
            MayaUtils.storage.set(key, value);
            
            // Queue for Firebase sync if user is logged in and key is syncable
            if (this.currentUserEmail && this.SYNCABLE_KEYS.includes(key)) {
                this.queueSync(key, value);
            }
            
            return true;
        } catch (e) {
            console.error('❌ MayaDBSync set error:', e);
            return false;
        }
    },

    /**
     * Get data - returns from localStorage (fast)
     */
    get(key, defaultValue = null) {
        return MayaUtils.storage.get(key, defaultValue);
    },

    /**
     * Remove data - removes from both localStorage and Firebase
     */
    remove(key) {
        try {
            MayaUtils.storage.remove(key);
            
            if (this.currentUserEmail && this.SYNCABLE_KEYS.includes(key)) {
                this.queueSync(key, null, 'DELETE');
            }
            
            return true;
        } catch (e) {
            console.error('❌ MayaDBSync remove error:', e);
            return false;
        }
    },

    /**
     * Queue a sync operation for Firebase
     */
    queueSync(key, value, operation = 'SET') {
        // Remove any existing pending sync for this key
        this.syncQueue = this.syncQueue.filter(item => item.key !== key);
        
        // Add new sync operation
        this.syncQueue.push({
            key: key,
            value: value,
            operation: operation,
            timestamp: Date.now()
        });
        
        // Debounce - process queue after short delay
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this.processSyncQueue(), 1000);
    },

    /**
     * Process the sync queue - sends to Firebase
     */
    async processSyncQueue() {
        if (this.isSyncing || this.syncQueue.length === 0 || !this.currentUserEmail) {
            return;
        }
        
        this.isSyncing = true;
        
        try {
            // Ensure Firebase is initialized
            if (!MayaFirebase.isInitialized) {
                MayaFirebase.init();
            }
            
            const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
            
            // Batch all pending syncs
            const syncData = {};
            const deleteKeys = [];
            
            while (this.syncQueue.length > 0) {
                const item = this.syncQueue.shift();
                
                if (item.operation === 'DELETE') {
                    deleteKeys.push(item.key);
                } else {
                    syncData[item.key] = item.value;
                }
            }
            
            // Perform sync operations
            if (Object.keys(syncData).length > 0) {
                console.log('🔄 Syncing to Firebase:', Object.keys(syncData));
                await MayaFirebase.request(`user_data/${emailKey}`, 'PATCH', {
                    ...syncData,
                    _lastSynced: new Date().toISOString()
                });
                console.log('✅ Firebase sync complete');
            }
            
            // Handle deletes
            for (const key of deleteKeys) {
                await MayaFirebase.request(`user_data/${emailKey}/${key}`, 'DELETE');
            }
            
        } catch (error) {
            console.error('❌ Firebase sync error:', error);
            // Re-queue failed items for retry
            // Items are already removed from queue, so they won't retry automatically
            // This is intentional to prevent infinite retry loops
        } finally {
            this.isSyncing = false;
        }
    },

    /**
     * Sync all local data to Firebase (full sync)
     */
    async syncAllToFirebase() {
        if (!this.currentUserEmail) {
            console.warn('⚠️ Cannot sync - no user logged in');
            return { success: false, error: 'No user logged in' };
        }
        
        try {
            console.log('🔄 Starting full sync to Firebase...');
            
            const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
            const syncData = {};
            
            for (const key of this.SYNCABLE_KEYS) {
                const value = MayaUtils.storage.get(key);
                if (value !== null) {
                    syncData[key] = value;
                }
            }
            
            syncData._lastSynced = new Date().toISOString();
            syncData._syncedFrom = 'local';
            
            await MayaFirebase.request(`user_data/${emailKey}`, 'PUT', syncData);
            
            console.log('✅ Full sync to Firebase complete');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Full sync error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Load all data from Firebase to localStorage
     * Called on login to restore user's data on new device
     */
    async loadFromFirebase() {
        if (!this.currentUserEmail) {
            console.warn('⚠️ Cannot load - no user logged in');
            return { success: false, error: 'No user logged in' };
        }
        
        try {
            console.log('🔄 Loading data from Firebase...');
            
            const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
            const cloudData = await MayaFirebase.request(`user_data/${emailKey}`, 'GET');
            
            if (!cloudData) {
                console.log('ℹ️ No cloud data found - first time user or no sync yet');
                return { success: true, loaded: false };
            }
            
            // Merge cloud data with local (cloud wins for sync)
            let loadedCount = 0;
            for (const key of this.SYNCABLE_KEYS) {
                if (cloudData[key] !== undefined) {
                    MayaUtils.storage.set(key, cloudData[key]);
                    loadedCount++;
                }
            }
            
            console.log(`✅ Loaded ${loadedCount} items from Firebase`);
            return { success: true, loaded: true, count: loadedCount };
            
        } catch (error) {
            console.error('❌ Load from Firebase error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Merge Firebase data with local data (smart merge)
     * Uses timestamps to determine which data is newer
     */
    async smartSync() {
        if (!this.currentUserEmail) {
            return { success: false, error: 'No user logged in' };
        }
        
        try {
            const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
            const cloudData = await MayaFirebase.request(`user_data/${emailKey}`, 'GET');
            
            const localLastSync = MayaUtils.storage.get('_lastSynced');
            const cloudLastSync = cloudData?._lastSynced;
            
            // If cloud is newer, load from cloud
            if (cloudLastSync && (!localLastSync || new Date(cloudLastSync) > new Date(localLastSync))) {
                console.log('☁️ Cloud data is newer - loading from Firebase');
                return await this.loadFromFirebase();
            }
            
            // If local is newer or same, sync to cloud
            console.log('💾 Local data is newer - syncing to Firebase');
            return await this.syncAllToFirebase();
            
        } catch (error) {
            console.error('❌ Smart sync error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Called when user logs in - load their data
     */
    async onUserLogin(email) {
        this.currentUserEmail = email;
        console.log('👤 User logged in, syncing data for:', email);
        
        // Load data from Firebase
        const result = await this.loadFromFirebase();
        
        // Then sync any local changes back
        if (result.success) {
            await this.syncAllToFirebase();
        }
        
        return result;
    },

    /**
     * Called when user logs out - clear sync state
     */
    onUserLogout() {
        console.log('👋 User logged out, clearing sync state');
        this.currentUserEmail = null;
        this.syncQueue = [];
    },

    /**
     * Save chat message to both local and Firebase
     */
    async saveChatMessage(message) {
        // Get existing history
        const chatHistory = this.get('maya_chat_history') || [];
        
        // Add new message
        chatHistory.push({
            ...message,
            timestamp: message.timestamp || Date.now()
        });
        
        // Keep only last 100 messages
        if (chatHistory.length > 100) {
            chatHistory.splice(0, chatHistory.length - 100);
        }
        
        // Save
        this.set('maya_chat_history', chatHistory);
    },

    /**
     * Save reading (palm, vastu, etc.) 
     */
    async saveReading(type, readingData) {
        const key = type === 'palm' ? 'maya_palm_readings' : 'maya_vastu_analyses';
        const readings = this.get(key) || [];
        
        readings.push({
            ...readingData,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });
        
        // Keep only last 20 readings
        if (readings.length > 20) {
            readings.splice(0, readings.length - 20);
        }
        
        this.set(key, readings);
        
        // Also save to Firebase readings collection for detailed storage
        if (this.currentUserEmail) {
            try {
                await MayaFirebase.saveReading(this.currentUserEmail, {
                    type: type,
                    ...readingData
                });
            } catch (e) {
                console.warn('Could not save reading to Firebase:', e);
            }
        }
    },

    /**
     * Clear all user data (for account deletion/reset)
     */
    async clearAllUserData() {
        // Clear local storage
        for (const key of this.SYNCABLE_KEYS) {
            MayaUtils.storage.remove(key);
        }
        
        // Clear from Firebase
        if (this.currentUserEmail) {
            try {
                const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
                await MayaFirebase.request(`user_data/${emailKey}`, 'DELETE');
            } catch (e) {
                console.error('Could not clear Firebase data:', e);
            }
        }
        
        console.log('🗑️ All user data cleared');
    }
};

// Make globally available
window.MayaDBSync = MayaDBSync;

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    MayaDBSync.init();
});

console.log('✅ dbSync.js loaded');
