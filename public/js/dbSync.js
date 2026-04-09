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
    hasFlushHandlers: false,
    syncTimeout: null,
    LOCAL_META_KEY: 'maya_sync_meta',

    // Portable user data that should follow the account across devices.
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
        'maya_funnel_progress',
        'funnel_data',
        'maya_calculations',
        'maya_user_data',
        'conversations'
    ],

    COLLECTION_LIMITS: {
        maya_chat_history: 50,
        maya_palm_readings: 10,
        maya_vastu_analyses: 20
    },

    /**
     * Initialize the sync layer with current user.
     */
    init(userEmail = null) {
        const resolvedUserEmail = userEmail
            || MayaUtils.storage.get('maya_session')?.email
            || MayaUtils.storage.get('maya_user')?.email
            || null;

        this.currentUserEmail = resolvedUserEmail;
        this.isInitialized = true;
        this.installFlushHandlers();

        console.log('🔄 MayaDBSync initialized', this.currentUserEmail ? `for ${this.currentUserEmail}` : '(no user)');

        void this.processSyncQueue({ reason: 'init' });
        return this;
    },

    shouldSyncKey(key) {
        return this.SYNCABLE_KEYS.includes(key);
    },

    normalizeTimestamp(value) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            return numericValue;
        }

        if (typeof value === 'string') {
            const parsedValue = Date.parse(value);
            if (Number.isFinite(parsedValue) && parsedValue > 0) {
                return parsedValue;
            }
        }

        return 0;
    },

    normalizeMetaEntry(entry, fallbackTimestamp = 0) {
        const updatedAt = this.normalizeTimestamp(entry?.updatedAt || fallbackTimestamp);
        if (!updatedAt) {
            return null;
        }

        return {
            updatedAt,
            deleted: Boolean(entry?.deleted)
        };
    },

    getLocalMeta() {
        return MayaUtils.storage.get(this.LOCAL_META_KEY) || {};
    },

    writeLocalMeta(meta) {
        MayaUtils.storage.set(this.LOCAL_META_KEY, meta, { skipSync: true });
        return meta;
    },

    writeLocalMetaEntry(key, entry) {
        if (!this.shouldSyncKey(key)) {
            return;
        }

        const meta = this.getLocalMeta();
        meta[key] = {
            updatedAt: this.normalizeTimestamp(entry?.updatedAt) || Date.now(),
            deleted: Boolean(entry?.deleted)
        };
        this.writeLocalMeta(meta);
    },

    clearLocalCache(keys = this.SYNCABLE_KEYS) {
        keys.forEach(key => MayaUtils.storage.remove(key, { skipSync: true }));
        MayaUtils.storage.remove(this.LOCAL_META_KEY, { skipSync: true });
        this.syncQueue = [];
    },

    /**
     * Set data - saves to local storage and records sync metadata.
     */
    set(key, value, options = {}) {
        try {
            MayaUtils.storage.set(key, value, { ...options, skipSync: true });
            this.handleStorageMutation(key, value, 'SET', options);
            return true;
        } catch (e) {
            console.error('❌ MayaDBSync set error:', e);
            return false;
        }
    },

    /**
     * Get data - returns from localStorage (fast).
     */
    get(key, defaultValue = null) {
        return MayaUtils.storage.get(key, defaultValue);
    },

    /**
     * Remove data locally and queue cloud deletion when appropriate.
     */
    remove(key, options = {}) {
        try {
            MayaUtils.storage.remove(key, { ...options, skipSync: true });
            this.handleStorageMutation(key, null, 'DELETE', options);
            return true;
        } catch (e) {
            console.error('❌ MayaDBSync remove error:', e);
            return false;
        }
    },

    handleStorageMutation(key, value, operation = 'SET', options = {}) {
        if (!this.shouldSyncKey(key)) {
            return false;
        }

        const timestamp = this.normalizeTimestamp(options.timestamp) || Date.now();
        this.writeLocalMetaEntry(key, {
            updatedAt: timestamp,
            deleted: operation === 'DELETE'
        });

        if (this.currentUserEmail) {
            this.queueSync(key, value, operation, timestamp);
        }

        return true;
    },

    trimCollection(key, value) {
        if (!Array.isArray(value)) {
            return value;
        }

        const limit = this.COLLECTION_LIMITS[key];
        if (!limit || value.length <= limit) {
            return value;
        }

        if (key === 'maya_chat_history') {
            return value.slice(-limit);
        }

        return value.slice(0, limit);
    },

    extractItemTimestamp(item) {
        if (!item || typeof item !== 'object') {
            return 0;
        }

        return this.normalizeTimestamp(
            item.timestamp
            || item.date
            || item.createdAt
            || item.savedAt
            || item.updatedAt
            || item.id
        );
    },

    getPortableItemId(item, index = 0) {
        if (!item || typeof item !== 'object') {
            return `value-${index}-${String(item)}`;
        }

        const candidateId = item.id
            || item.timestamp
            || item.date
            || item.createdAt
            || item.savedAt
            || item.question
            || item.name
            || item.type
            || item.title;

        if (candidateId !== undefined && candidateId !== null && String(candidateId).trim()) {
            return String(candidateId);
        }

        return `item-${index}-${this.extractItemTimestamp(item) || 'no-time'}-${Object.keys(item).sort().join('|')}`;
    },

    isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    },

    mergePortableArray(key, localArray = [], cloudArray = []) {
        const mergedItems = new Map();

        cloudArray.forEach((item, index) => {
            mergedItems.set(this.getPortableItemId(item, index), item);
        });

        localArray.forEach((item, index) => {
            mergedItems.set(this.getPortableItemId(item, cloudArray.length + index), item);
        });

        const mergedArray = Array.from(mergedItems.values());

        if (key === 'maya_chat_history') {
            mergedArray.sort((left, right) => this.extractItemTimestamp(left) - this.extractItemTimestamp(right));
        } else {
            mergedArray.sort((left, right) => this.extractItemTimestamp(right) - this.extractItemTimestamp(left));
        }

        return this.trimCollection(key, mergedArray);
    },

    mergePortableValue(key, localValue, cloudValue) {
        if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
            return this.mergePortableArray(key, localValue, cloudValue);
        }

        if (this.isPlainObject(localValue) && this.isPlainObject(cloudValue)) {
            return { ...localValue, ...cloudValue };
        }

        return cloudValue ?? localValue;
    },

    valuesEqual(left, right) {
        if (left === right) {
            return true;
        }

        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch (error) {
            return false;
        }
    },

    /**
     * Queue a sync operation for Firebase.
     */
    queueSync(key, value, operation = 'SET', timestamp = Date.now()) {
        if (!this.shouldSyncKey(key)) {
            return;
        }

        this.syncQueue = this.syncQueue.filter(item => item.key !== key);
        this.syncQueue.push({
            key,
            value: this.trimCollection(key, value),
            operation,
            timestamp: this.normalizeTimestamp(timestamp) || Date.now()
        });

        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => void this.processSyncQueue({ reason: 'debounced' }), 350);
    },

    restoreSyncQueue(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return;
        }

        items.slice().reverse().forEach(item => {
            this.syncQueue = this.syncQueue.filter(existing => existing.key !== item.key);
            this.syncQueue.unshift(item);
        });
    },

    installFlushHandlers() {
        if (this.hasFlushHandlers || typeof document === 'undefined') {
            return;
        }

        const flushPendingSync = () => {
            if (this.currentUserEmail && this.syncQueue.length > 0) {
                void this.processSyncQueue({ reason: 'lifecycle' });
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flushPendingSync();
            }
        });

        window.addEventListener('pagehide', flushPendingSync);
        window.addEventListener('beforeunload', flushPendingSync);
        this.hasFlushHandlers = true;
    },

    /**
     * Process the sync queue - sends to Firebase.
     */
    async processSyncQueue({ reason = 'manual' } = {}) {
        if (this.isSyncing || this.syncQueue.length === 0 || !this.currentUserEmail) {
            return { success: true, skipped: true, reason };
        }

        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
        this.isSyncing = true;

        const pendingItems = [];

        try {
            if (!MayaFirebase.isInitialized) {
                MayaFirebase.init();
            }

            const emailKey = MayaFirebase.emailToKey(this.currentUserEmail);
            const syncData = {};
            const deleteKeys = [];
            const metaUpdates = {};

            while (this.syncQueue.length > 0) {
                const item = this.syncQueue.shift();
                pendingItems.push(item);

                metaUpdates[item.key] = {
                    updatedAt: item.timestamp,
                    deleted: item.operation === 'DELETE'
                };

                if (item.operation === 'DELETE') {
                    deleteKeys.push(item.key);
                } else {
                    syncData[item.key] = this.trimCollection(item.key, item.value);
                }
            }

            if (Object.keys(syncData).length > 0) {
                console.log('🔄 Syncing to Firebase:', Object.keys(syncData));
                await MayaFirebase.request(`user_data/${emailKey}`, 'PATCH', {
                    ...syncData,
                    _lastSynced: new Date().toISOString(),
                    _syncedFrom: reason
                });
                console.log('✅ Firebase sync complete');
            }

            if (Object.keys(metaUpdates).length > 0) {
                await MayaFirebase.request(`user_data/${emailKey}/_meta`, 'PATCH', metaUpdates);
            }

            for (const key of deleteKeys) {
                await MayaFirebase.request(`user_data/${emailKey}/${key}`, 'DELETE');
            }

            return {
                success: true,
                syncedKeys: Object.keys(syncData),
                deletedKeys: deleteKeys
            };
        } catch (error) {
            console.error('❌ Firebase sync error:', error);
            this.restoreSyncQueue(pendingItems);
            return { success: false, error: error.message };
        } finally {
            this.isSyncing = false;

            if (this.syncQueue.length > 0 && this.currentUserEmail) {
                clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => void this.processSyncQueue({ reason: 'retry' }), 1000);
            }
        }
    },

    /**
     * Sync all known local user data to Firebase.
     */
    async syncAllToFirebase() {
        if (!this.currentUserEmail) {
            console.warn('⚠️ Cannot sync - no user logged in');
            return { success: false, error: 'No user logged in' };
        }

        console.log('🔄 Starting full sync to Firebase...');

        const localMeta = this.getLocalMeta();

        for (const key of this.SYNCABLE_KEYS) {
            const value = MayaUtils.storage.get(key);
            const metaEntry = this.normalizeMetaEntry(localMeta[key]);

            if (metaEntry?.deleted) {
                this.queueSync(key, null, 'DELETE', metaEntry.updatedAt);
                continue;
            }

            if (value !== null && value !== undefined) {
                const timestamp = metaEntry?.updatedAt || Date.now();
                if (!metaEntry) {
                    this.writeLocalMetaEntry(key, { updatedAt: timestamp, deleted: false });
                }
                this.queueSync(key, value, 'SET', timestamp);
            }
        }

        return await this.processSyncQueue({ reason: 'full-sync' });
    },

    /**
     * Load all data from Firebase to localStorage.
     * Called on login and on auth restore to hydrate the device.
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
                return { success: true, loaded: false, count: 0 };
            }

            const localMeta = this.getLocalMeta();
            const nextMeta = { ...localMeta };
            const cloudMeta = cloudData._meta || {};
            const cloudLastSynced = this.normalizeTimestamp(cloudData._lastSynced);
            let restoredCount = 0;
            let queuedCount = 0;
            let removedCount = 0;

            for (const key of this.SYNCABLE_KEYS) {
                const cloudValue = cloudData[key];
                const localValue = MayaUtils.storage.get(key);
                const cloudHasValue = cloudValue !== undefined && cloudValue !== null;
                const localHasValue = localValue !== undefined && localValue !== null;
                const cloudEntry = this.normalizeMetaEntry(cloudMeta[key], cloudHasValue ? cloudLastSynced : 0);
                const localEntry = this.normalizeMetaEntry(localMeta[key]);

                if (cloudEntry && (!localEntry || cloudEntry.updatedAt > localEntry.updatedAt)) {
                    if (cloudEntry.deleted) {
                        if (localHasValue) {
                            MayaUtils.storage.remove(key, { skipSync: true });
                            removedCount++;
                        }
                    } else if (cloudHasValue) {
                        MayaUtils.storage.set(key, this.trimCollection(key, cloudValue), { skipSync: true });
                        restoredCount++;
                    }

                    nextMeta[key] = cloudEntry;
                    continue;
                }

                if (localEntry && (!cloudEntry || localEntry.updatedAt > cloudEntry.updatedAt)) {
                    if (localEntry.deleted) {
                        this.queueSync(key, null, 'DELETE', localEntry.updatedAt);
                        queuedCount++;
                    } else if (localHasValue) {
                        this.queueSync(key, localValue, 'SET', localEntry.updatedAt);
                        queuedCount++;
                    }

                    nextMeta[key] = localEntry;
                    continue;
                }

                if (!cloudEntry && !localEntry) {
                    if (cloudHasValue && localHasValue) {
                        const mergedValue = this.mergePortableValue(key, localValue, cloudValue);
                        const timestamp = Date.now();

                        MayaUtils.storage.set(key, this.trimCollection(key, mergedValue), { skipSync: true });
                        nextMeta[key] = { updatedAt: timestamp, deleted: false };
                        this.queueSync(key, mergedValue, 'SET', timestamp);
                        restoredCount++;
                        queuedCount++;
                    } else if (cloudHasValue) {
                        const timestamp = cloudLastSynced || Date.now();
                        MayaUtils.storage.set(key, this.trimCollection(key, cloudValue), { skipSync: true });
                        nextMeta[key] = { updatedAt: timestamp, deleted: false };
                        restoredCount++;
                    } else if (localHasValue) {
                        const timestamp = Date.now();
                        nextMeta[key] = { updatedAt: timestamp, deleted: false };
                        this.queueSync(key, localValue, 'SET', timestamp);
                        queuedCount++;
                    }

                    continue;
                }

                if (cloudEntry?.deleted) {
                    if (localHasValue) {
                        MayaUtils.storage.remove(key, { skipSync: true });
                        removedCount++;
                    }

                    nextMeta[key] = cloudEntry;
                    continue;
                }

                if (!localHasValue && cloudHasValue) {
                    MayaUtils.storage.set(key, this.trimCollection(key, cloudValue), { skipSync: true });
                    restoredCount++;
                }

                nextMeta[key] = cloudEntry || localEntry || nextMeta[key];

                if (cloudHasValue && localHasValue && !this.valuesEqual(localValue, cloudValue)) {
                    const mergedValue = this.mergePortableValue(key, localValue, cloudValue);
                    const timestamp = Date.now();

                    MayaUtils.storage.set(key, this.trimCollection(key, mergedValue), { skipSync: true });
                    nextMeta[key] = { updatedAt: timestamp, deleted: false };
                    this.queueSync(key, mergedValue, 'SET', timestamp);
                    restoredCount++;
                    queuedCount++;
                }
            }

            this.writeLocalMeta(nextMeta);

            if (this.syncQueue.length > 0) {
                await this.processSyncQueue({ reason: 'post-load' });
            }

            console.log(`✅ Hydrated synced data: restored ${restoredCount}, queued ${queuedCount}, removed ${removedCount}`);
            return {
                success: true,
                loaded: true,
                count: restoredCount,
                queued: queuedCount,
                removed: removedCount
            };
        } catch (error) {
            console.error('❌ Load from Firebase error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Smart sync now hydrates first and pushes newer local changes back.
     */
    async smartSync() {
        if (!this.currentUserEmail) {
            return { success: false, error: 'No user logged in' };
        }

        return await this.loadFromFirebase();
    },

    /**
     * Called when user logs in - load their data and push any newer local state.
     */
    async onUserLogin(email) {
        this.init(email);
        console.log('👤 User logged in, syncing data for:', email);

        const result = await this.loadFromFirebase();

        if (result.success && result.loaded === false) {
            await this.syncAllToFirebase();
        }

        return result;
    },

    /**
     * Called when user logs out - clear sync state.
     */
    onUserLogout() {
        console.log('👋 User logged out, clearing sync state');
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
        this.currentUserEmail = null;
        this.syncQueue = [];
    },

    /**
     * Save chat message to both local and Firebase.
     */
    async saveChatMessage(message) {
        const chatHistory = this.get('maya_chat_history') || [];

        chatHistory.push({
            ...message,
            timestamp: message.timestamp || Date.now()
        });

        this.set('maya_chat_history', this.trimCollection('maya_chat_history', chatHistory));
    },

    /**
     * Save reading (palm, vastu, etc.).
     */
    async saveReading(type, readingData) {
        const key = type === 'palm' ? 'maya_palm_readings' : 'maya_vastu_analyses';
        const readings = this.get(key) || [];

        readings.unshift({
            ...readingData,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });

        this.set(key, this.trimCollection(key, readings));

        if (this.currentUserEmail) {
            try {
                await MayaFirebase.saveReading(this.currentUserEmail, {
                    type,
                    ...readingData
                });
            } catch (e) {
                console.warn('Could not save reading to Firebase:', e);
            }
        }
    },

    /**
     * Clear all user data (for account deletion/reset).
     */
    async clearAllUserData() {
        this.clearLocalCache();

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
