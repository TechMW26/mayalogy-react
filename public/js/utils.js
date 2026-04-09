/**
 * MAYA - Utility Functions
 */

console.log('🔧 utils.js loading...');

const MayaUtils = {
    /**
     * Storage helpers with prefix
     * Now integrates with MayaDBSync for Firebase sync when available
     */
    storage: {
        set(key, value) {
            try {
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + key;
                localStorage.setItem(prefixedKey, JSON.stringify(value));
                
                // If DBSync is available and initialized, queue for Firebase sync
                if (window.MayaDBSync && MayaDBSync.isInitialized && MayaDBSync.currentUserEmail) {
                    // Queue sync without the prefix (DBSync handles its own storage)
                    MayaDBSync.queueSync(key, value);
                }
                
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + key;
                const item = localStorage.getItem(prefixedKey);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage get error:', e);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + key;
                localStorage.removeItem(prefixedKey);
                
                // If DBSync is available, queue deletion for Firebase
                if (window.MayaDBSync && MayaDBSync.isInitialized && MayaDBSync.currentUserEmail) {
                    MayaDBSync.queueSync(key, null, 'DELETE');
                }
                
                return true;
            } catch (e) {
                console.error('Storage remove error:', e);
                return false;
            }
        },

        clear() {
            try {
                Object.keys(localStorage)
                    .filter(key => key.startsWith(MAYA_CONFIG.APP.STORAGE_PREFIX))
                    .forEach(key => localStorage.removeItem(key));
                return true;
            } catch (e) {
                console.error('Storage clear error:', e);
                return false;
            }
        }
    },

    /**
     * Date/Time helpers
     */
    date: {
        formatDate(date, format = 'long') {
            const d = new Date(date);
            const options = {
                short: { day: 'numeric', month: 'short', year: 'numeric' },
                long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                time: { hour: '2-digit', minute: '2-digit' }
            };
            return d.toLocaleDateString('en-US', options[format] || options.long);
        },

        getAge(birthDate) {
            const today = new Date();
            // Use consistent date parsing if MayaAstrology is available
            const birth = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
            if (!birth) return 0;
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        },

        parseTime(timeString) {
            const [hours, minutes] = timeString.split(':').map(Number);
            return { hours, minutes };
        },

        toJulianDay(date) {
            const d = new Date(date);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
            
            let jd = 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) -
                     Math.floor(3 * (Math.floor((y + (m - 9) / 7) / 100) + 1) / 4) +
                     Math.floor(275 * m / 9) + day + 1721028.5 + h / 24;
            
            return jd;
        }
    },

    /**
     * Validation helpers
     */
    validate: {
        email(email) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        },

        password(password) {
            // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            return regex.test(password);
        },

        name(name) {
            return name && name.trim().length >= 2;
        },

        date(dateString) {
            const date = new Date(dateString);
            return date instanceof Date && !isNaN(date);
        },

        time(timeString) {
            const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            return regex.test(timeString);
        }
    },

    /**
     * Location helpers
     */
    location: {
        async resolveBirthPlace(placeName, existing = {}) {
            const birthPlace = typeof placeName === 'string' ? placeName.trim() : '';
            if (!birthPlace) {
                return { birthPlace: '', birthLat: null, birthLon: null, resolved: false };
            }

            const existingLat = Number(existing.birthLat ?? existing.lat);
            const existingLon = Number(existing.birthLon ?? existing.lon);
            if (Number.isFinite(existingLat) && Number.isFinite(existingLon)) {
                return {
                    birthPlace,
                    birthLat: existingLat,
                    birthLon: existingLon,
                    resolved: true,
                    source: 'existing'
                };
            }

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(birthPlace)}&limit=1`,
                    {
                        cache: 'no-store',
                        headers: { Accept: 'application/json' }
                    }
                );

                if (!response.ok) {
                    throw new Error(`Place lookup failed with status ${response.status}`);
                }

                const results = await response.json();
                const match = Array.isArray(results) ? results[0] : null;

                if (match?.lat && match?.lon) {
                    return {
                        birthPlace: match.display_name || birthPlace,
                        birthLat: Number.parseFloat(match.lat),
                        birthLon: Number.parseFloat(match.lon),
                        resolved: true,
                        source: 'lookup'
                    };
                }
            } catch (error) {
                console.warn('Birth place resolution failed:', error.message);
            }

            return {
                birthPlace,
                birthLat: null,
                birthLon: null,
                resolved: false,
                source: 'unresolved'
            };
        }
    },

    /**
     * DOM helpers
     */
    dom: {
        $(selector) {
            return document.querySelector(selector);
        },

        $$(selector) {
            return document.querySelectorAll(selector);
        },

        create(tag, attrs = {}, children = []) {
            const el = document.createElement(tag);
            Object.entries(attrs).forEach(([key, value]) => {
                if (key === 'className') {
                    el.className = value;
                } else if (key === 'dataset') {
                    Object.entries(value).forEach(([dataKey, dataValue]) => {
                        el.dataset[dataKey] = dataValue;
                    });
                } else if (key.startsWith('on')) {
                    el.addEventListener(key.slice(2).toLowerCase(), value);
                } else {
                    el.setAttribute(key, value);
                }
            });
            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    el.appendChild(child);
                }
            });
            return el;
        },

        show(element) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.remove('d-none');
        },

        hide(element) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.add('d-none');
        },

        toggle(element, condition) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.toggle('d-none', !condition);
        }
    },

    /**
     * Animation helpers
     */
    animate: {
        fadeIn(element, duration = 300) {
            return new Promise(resolve => {
                element.style.opacity = '0';
                element.style.display = 'block';
                element.style.transition = `opacity ${duration}ms`;
                
                requestAnimationFrame(() => {
                    element.style.opacity = '1';
                    setTimeout(resolve, duration);
                });
            });
        },

        fadeOut(element, duration = 300) {
            return new Promise(resolve => {
                element.style.transition = `opacity ${duration}ms`;
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.style.display = 'none';
                    resolve();
                }, duration);
            });
        },

        typeWriter(element, text, speed = 50) {
            return new Promise(resolve => {
                element.textContent = '';
                let i = 0;
                
                const type = () => {
                    if (i < text.length) {
                        element.textContent += text.charAt(i);
                        i++;
                        setTimeout(type, speed);
                    } else {
                        resolve();
                    }
                };
                
                type();
            });
        }
    },

    /**
     * Toast notifications - Top center push notification style
     * Limited to max 3 toasts, auto-dismissed
     */
    toast: {
        _maxToasts: 3,
        _lastMessage: null,
        _lastTime: 0,
        
        show(message, type = 'info', duration = 2500) {
            const container = document.getElementById('toast-container');
            if (!container) return;
            
            // Prevent duplicate messages within 1 second
            const now = Date.now();
            if (this._lastMessage === message && now - this._lastTime < 1000) {
                return;
            }
            this._lastMessage = message;
            this._lastTime = now;
            
            // Remove excess toasts if at limit
            const existingToasts = container.querySelectorAll('.toast');
            if (existingToasts.length >= this._maxToasts) {
                const oldest = existingToasts[0];
                oldest.classList.add('hide');
                setTimeout(() => oldest.remove(), 300);
            }
            
            const id = 'toast-' + now;
            
            const icons = {
                success: 'bi-check-circle-fill',
                error: 'bi-x-circle-fill',
                warning: 'bi-exclamation-triangle-fill',
                info: 'bi-info-circle-fill'
            };
            
            const colors = {
                success: 'text-success',
                error: 'text-danger',
                warning: 'text-warning',
                info: 'text-info'
            };
            
            const toast = MayaUtils.dom.create('div', {
                id,
                className: 'toast show',
                role: 'alert'
            }, [
                MayaUtils.dom.create('div', { className: 'toast-header' }, [
                    MayaUtils.dom.create('i', { className: `bi ${icons[type]} ${colors[type]} me-2` }),
                    MayaUtils.dom.create('strong', { className: 'me-auto' }, [type.charAt(0).toUpperCase() + type.slice(1)]),
                    MayaUtils.dom.create('button', {
                        type: 'button',
                        className: 'btn-close',
                        'data-bs-dismiss': 'toast',
                        onclick: () => {
                            toast.classList.add('hide');
                            setTimeout(() => toast.remove(), 300);
                        }
                    })
                ]),
                MayaUtils.dom.create('div', { className: 'toast-body' }, [message])
            ]);
            
            container.appendChild(toast);
            
            // Auto dismiss
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.classList.add('hide');
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        },

        success(message, duration) {
            this.show(message, 'success', duration);
        },

        error(message, duration) {
            this.show(message, 'error', duration);
        },

        warning(message, duration) {
            this.show(message, 'warning', duration);
        },

        info(message, duration) {
            this.show(message, 'info', duration);
        }
    },

    /**
     * Debounce function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Generate unique ID
     */
    generateId(prefix = 'maya') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Validate email (shortcut)
     */
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * Get ordinal suffix (1st, 2nd, 3rd, etc.)
     */
    getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Check if device is mobile
     */
    isMobile() {
        return window.innerWidth < 768;
    },

    /**
     * Check if device is tablet
     */
    isTablet() {
        return window.innerWidth >= 768 && window.innerWidth < 992;
    },

    /**
     * Get system theme preference
     */
    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    /**
     * Scroll to element
     */
    scrollTo(element, offset = 0) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    },

    /**
     * Show AI loading overlay (removed - no longer used)
     */
    showAILoader() {
        // AI loader removed from app
    },

    /**
     * Hide AI loading overlay (removed - no longer used)
     */
    hideAILoader() {
        // AI loader removed from app
    },

    /**
     * Retry utility with exponential backoff
     * @param {Function} fn - Async function to retry
     * @param {Object} options - Retry options
     * @returns {Promise<any>} - Result of the function
     */
    async retry(fn, options = {}) {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            backoffMultiplier = 2,
            retryCondition = () => true,
            onRetry = null,
            label = 'operation'
        } = options;

        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (error) {
                lastError = error;
                
                // Check if we should retry this error
                if (!retryCondition(error, attempt)) {
                    throw error;
                }
                
                // Don't retry after last attempt
                if (attempt >= maxRetries) {
                    break;
                }

                // Calculate delay with exponential backoff + jitter
                const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
                const jitter = Math.random() * 500;
                const delay = Math.min(exponentialDelay + jitter, maxDelay);

                console.log(`🔄 Retry ${attempt}/${maxRetries} for ${label} in ${Math.round(delay)}ms...`);
                
                if (onRetry) {
                    onRetry(attempt, maxRetries, error, delay);
                }

                await this.sleep(delay);
            }
        }

        console.error(`❌ All ${maxRetries} retries failed for ${label}`);
        throw lastError;
    },

    /**
     * Retry with fallback - tries main function, then fallback functions in order
     * @param {Array<Function>} functions - Array of async functions to try in order
     * @param {Object} options - Retry options for each function
     * @returns {Promise<any>} - Result of the first successful function
     */
    async retryWithFallbacks(functions, options = {}) {
        const {
            retriesPerFunction = 2,
            label = 'operation'
        } = options;

        let lastError;

        for (let i = 0; i < functions.length; i++) {
            const fn = functions[i];
            const fnLabel = `${label} [source ${i + 1}/${functions.length}]`;

            try {
                return await this.retry(fn, {
                    ...options,
                    maxRetries: retriesPerFunction,
                    label: fnLabel
                });
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ ${fnLabel} failed, trying next fallback...`);
            }
        }

        throw lastError || new Error(`All ${functions.length} fallbacks failed for ${label}`);
    },

    /**
     * Sleep/delay helper
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Timeout wrapper - adds timeout to any promise
     * @param {Promise} promise - Promise to wrap
     * @param {number} ms - Timeout in milliseconds
     * @param {string} label - Label for error message
     * @returns {Promise<any>}
     */
    async withTimeout(promise, ms, label = 'operation') {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`${label} timed out after ${ms}ms`));
            }, ms);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    /**
     * Check if error is retryable (network errors, rate limits, server errors)
     * @param {Error} error - The error to check
     * @returns {boolean}
     */
    isRetryableError(error) {
        const message = error?.message?.toLowerCase() || '';
        const status = error?.status || error?.statusCode;

        // Network errors
        if (message.includes('network') || 
            message.includes('fetch') || 
            message.includes('timeout') ||
            message.includes('connection')) {
            return true;
        }

        // Rate limiting (429)
        if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
            return true;
        }

        // Server errors (5xx)
        if (status >= 500 && status < 600) {
            return true;
        }

        // Service unavailable
        if (status === 503 || message.includes('unavailable') || message.includes('overloaded')) {
            return true;
        }

        return false;
    },

    /**
     * Clear all caches and force refresh
     * Useful for debugging and after updates
     */
    async clearAllCaches() {
        try {
            console.log('🗑️ Clearing all caches...');
            
            // 1. Clear Service Worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('✅ Service Worker caches cleared');
            }
            
            // 2. Tell Service Worker to skip waiting (if registered)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const channel = new MessageChannel();
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2]);
            }
            
            // 3. Unregister Service Worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('✅ Service Worker unregistered');
                }
            }
            
            // 4. Clear sessionStorage
            sessionStorage.clear();
            console.log('✅ Session storage cleared');

            // 5. Remove stale localStorage cache-style keys while preserving user data.
            const cacheKeyPatterns = [
                /translation_cache/i,
                /stmt_cache/i,
                /daily_horoscope/i,
                /network-only-build/i
            ];

            Object.keys(localStorage).forEach((key) => {
                if (cacheKeyPatterns.some((pattern) => pattern.test(key))) {
                    localStorage.removeItem(key);
                }
            });
            console.log('✅ Local storage cache keys cleared');
            
            return true;
        } catch (error) {
            console.error('❌ Error clearing caches:', error);
            return false;
        }
    },

    /**
     * Force hard reload of the app
     */
    async forceReload() {
        await this.clearAllCaches();
        // Force reload without cache
        window.location.reload(true);
    },

    /**
     * Get app version info
     */
    getAppVersion() {
        // Extract version from CSS link
        const cssLink = document.querySelector('link[href*="maya.css"]');
        const version = cssLink?.href?.match(/v=([^&]+)/)?.[1] || 'unknown';
        return {
            css: version,
            build: '20260407a'
        };
    }
};

// Make globally available
window.MayaUtils = MayaUtils;
