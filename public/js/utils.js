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
        // Internal aliasing: `maya_language` is now the NARRATION language.
        // Reads/writes are transparently routed to `maya_narration_lang` so
        // that legacy callers in funnel/voice/ai keep working unchanged.
        // UI shell code (pages.js, app.js, i18n.js, onboarding.js) does not
        // read this key for layout decisions -it always renders English.
        _aliasKey(key) {
            return key === 'maya_language' ? 'maya_narration_lang' : key;
        },
        set(key, value, options = {}) {
            try {
                const realKey = this._aliasKey(key);
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + realKey;
                localStorage.setItem(prefixedKey, JSON.stringify(value));
                
                if (!options.skipSync && window.MayaDBSync?.isInitialized && typeof MayaDBSync.handleStorageMutation === 'function') {
                    MayaDBSync.handleStorageMutation(realKey, value, 'SET', options);
                }
                
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const realKey = this._aliasKey(key);
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + realKey;
                const item = localStorage.getItem(prefixedKey);
                if (item !== null) return JSON.parse(item);
                // Backwards-compat: fall back to the legacy un-aliased key
                // so existing installs upgrade smoothly.
                if (realKey !== key) {
                    const legacyItem = localStorage.getItem(MAYA_CONFIG.APP.STORAGE_PREFIX + key);
                    if (legacyItem !== null) return JSON.parse(legacyItem);
                }
                return defaultValue;
            } catch (e) {
                console.error('Storage get error:', e);
                return defaultValue;
            }
        },

        remove(key, options = {}) {
            try {
                const realKey = this._aliasKey(key);
                const prefixedKey = MAYA_CONFIG.APP.STORAGE_PREFIX + realKey;
                localStorage.removeItem(prefixedKey);
                
                if (!options.skipSync && window.MayaDBSync?.isInitialized && typeof MayaDBSync.handleStorageMutation === 'function') {
                    MayaDBSync.handleStorageMutation(realKey, null, 'DELETE', options);
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
                return { birthPlace: '', birthLat: null, birthLon: null, birthTimezone: null, resolved: false };
            }

            const existingLat = Number(existing.birthLat ?? existing.lat);
            const existingLon = Number(existing.birthLon ?? existing.lon);
            const existingTimezone = Number(existing.birthTimezone ?? existing.utcOffsetMinutes ?? existing.timezone);
            if (Number.isFinite(existingLat) && Number.isFinite(existingLon)) {
                return {
                    birthPlace,
                    birthLat: existingLat,
                    birthLon: existingLon,
                    birthTimezone: Number.isFinite(existingTimezone)
                        ? existingTimezone
                        : Math.max(-720, Math.min(840, Math.round(existingLon / 15) * 60)),
                    resolved: true,
                    source: 'existing'
                };
            }

            // Each map service gets at most 2 s, so a slow one never blocks the next.
            const timed = (url) => {
                const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timer = ctrl ? setTimeout(() => ctrl.abort(), 2000) : null;
                return fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: ctrl?.signal })
                    .finally(() => timer && clearTimeout(timer));
            };

            try {
                const response = await timed(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(birthPlace)}&limit=1`
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
                        birthTimezone: Math.max(-720, Math.min(840, Math.round(Number.parseFloat(match.lon) / 15) * 60)),
                        resolved: true,
                        source: 'lookup'
                    };
                }
            } catch (error) {
                console.warn('Birth place resolution failed:', error.message);
            }

            // Second map service (Open-Meteo, free, no key). Without coordinates the app
            // can only draw a Chandra kundli, which never matches other kundli apps.
            try {
                const city = birthPlace.split(',')[0].trim();
                const response = await timed(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
                );
                if (response.ok) {
                    const data = await response.json();
                    const list = Array.isArray(data?.results) ? data.results : [];
                    const want = birthPlace.toLowerCase();
                    const hit = list.find((x) => x.admin1 && want.includes(String(x.admin1).toLowerCase()))
                        || list.find((x) => x.country && want.includes(String(x.country).toLowerCase()))
                        || list.find((x) => x.country_code === 'IN')
                        || list[0];
                    const lat = Number(hit?.latitude);
                    const lon = Number(hit?.longitude);
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                        return {
                            birthPlace: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ') || birthPlace,
                            birthLat: lat,
                            birthLon: lon,
                            birthTimezone: Math.max(-720, Math.min(840, Math.round(lon / 15) * 60)),
                            resolved: true,
                            source: 'open-meteo'
                        };
                    }
                }
            } catch (error) {
                console.warn('Second place lookup failed:', error.message);
            }

            return {
                birthPlace,
                birthLat: null,
                birthLon: null,
                birthTimezone: null,
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

/**
 * Birth time with a clear AM/PM choice, everywhere in the app.
 * Every <input type="time"> is kept (same id, same 24-hour "HH:MM" value that the rest of
 * the code reads) but hidden behind Hour / Minute / AM-PM controls, so the user never has
 * to guess whether the box is in 12- or 24-hour format. If the time is half-filled
 * (for example hour picked but no AM/PM), the Next/Save button asks to finish it instead
 * of silently saving "unknown".
 */
(function installAmPmTimeInputs() {
    if (typeof document === 'undefined' || window.__mayaAmPmTime) return;
    window.__mayaAmPmTime = true;

    const isHindi = () => {
        try {
            const raw = localStorage.getItem('maya_maya_language');
            const lang = raw ? JSON.parse(raw) : '';
            if (lang === 'hi') return true;
            if (lang === 'en') return false;
        } catch (_e) { /* ignore */ }
        return (document.documentElement.lang || '').toLowerCase().startsWith('hi');
    };
    const pad = (n) => String(n).padStart(2, '0');

    function enhance(input) {
        if (!input || input.dataset.ampmEnhanced === '1' || input.type !== 'time') return;
        input.dataset.ampmEnhanced = '1';
        const hi = isHindi();
        const selectClass = (input.className || '').replace(/\bonboarding-input\b/g, '').trim();
        const wrap = document.createElement('div');
        wrap.className = 'maya-ampm-time';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', hi ? 'जन्म समय' : 'Birth time');
        const hourOptions = ['<option value="">' + (hi ? 'घंटा' : 'Hour') + '</option>']
            .concat(Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`)).join('');
        const minuteOptions = ['<option value="">' + (hi ? 'मिनट' : 'Min') + '</option>']
            .concat(Array.from({ length: 60 }, (_, i) => `<option value="${pad(i)}">${pad(i)}</option>`)).join('');
        wrap.innerHTML = `
            <select class="maya-ampm-time__hour ${selectClass}" aria-label="${hi ? 'घंटा' : 'Hour'}">${hourOptions}</select>
            <span class="maya-ampm-time__colon" aria-hidden="true">:</span>
            <select class="maya-ampm-time__minute ${selectClass}" aria-label="${hi ? 'मिनट' : 'Minute'}">${minuteOptions}</select>
            <div class="maya-ampm-time__period" role="radiogroup" aria-label="AM / PM">
                <button type="button" class="maya-ampm-time__btn" data-period="AM" role="radio" aria-checked="false">AM<small>${hi ? 'रात 12 – दोपहर 12' : 'midnight – noon'}</small></button>
                <button type="button" class="maya-ampm-time__btn" data-period="PM" role="radio" aria-checked="false">PM<small>${hi ? 'दोपहर 12 – रात 12' : 'noon – midnight'}</small></button>
            </div>
            <div class="maya-ampm-time__hint" aria-live="polite"></div>`;
        input.insertAdjacentElement('afterend', wrap);
        input.style.display = 'none';
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;

        const hourSel = wrap.querySelector('.maya-ampm-time__hour');
        const minSel = wrap.querySelector('.maya-ampm-time__minute');
        const hint = wrap.querySelector('.maya-ampm-time__hint');
        let period = '';

        const setPeriod = (p) => {
            period = p;
            wrap.querySelectorAll('.maya-ampm-time__btn').forEach((b) => {
                const on = b.dataset.period === p;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-checked', on ? 'true' : 'false');
            });
        };
        const sync = () => {
            const h = Number(hourSel.value);
            const m = minSel.value;
            let next = '';
            if (h && m !== '' && period) {
                const h24 = period === 'AM' ? (h % 12) : ((h % 12) + 12);
                next = `${pad(h24)}:${m}`;
            }
            wrap.classList.toggle('is-partial', !next && !!(hourSel.value || m !== '' || period));
            if (next || !wrap.classList.contains('is-partial')) { wrap.classList.remove('is-invalid'); hint.textContent = ''; }
            if (input.value !== next) {
                input.value = next;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        const load = () => {
            const match = /^(\d{1,2}):(\d{2})/.exec(input.value || '');
            if (!match) return;
            const h24 = Math.min(23, Number(match[1]));
            hourSel.value = String(h24 % 12 === 0 ? 12 : h24 % 12);
            minSel.value = match[2];
            setPeriod(h24 < 12 ? 'AM' : 'PM');
        };

        hourSel.addEventListener('change', () => { if (hourSel.value && minSel.value === '') minSel.value = '00'; sync(); });
        minSel.addEventListener('change', sync);
        wrap.querySelectorAll('.maya-ampm-time__btn').forEach((b) => b.addEventListener('click', () => { setPeriod(b.dataset.period); sync(); }));
        wrap._mayaHint = (msg) => { wrap.classList.add('is-invalid'); hint.textContent = msg; };
        load();
    }

    function scan(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches('input[type="time"]')) enhance(root);
        root.querySelectorAll('input[type="time"]').forEach(enhance);
    }

    // Half-filled time: stop Next/Save and ask for the missing part (Back/"I don't know" still work).
    const SKIP = /(back|prev|close|cancel|unknown|skip|dismiss|mute|pause)/i;
    document.addEventListener('click', (event) => {
        const trigger = event.target?.closest?.('button, [type="submit"], .maya-btn, a.btn');
        if (!trigger || trigger.closest('.maya-ampm-time')) return;
        if (SKIP.test(`${trigger.id || ''} ${trigger.className || ''}`)) return;
        const partial = Array.from(document.querySelectorAll('.maya-ampm-time.is-partial'))
            .find((w) => w.offsetParent !== null);
        if (!partial) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const hi = isHindi();
        const needPeriod = !partial.querySelector('.maya-ampm-time__btn.is-active');
        partial._mayaHint(needPeriod
            ? (hi ? 'कृपया AM या PM चुनें' : 'Please choose AM or PM')
            : (hi ? 'कृपया घंटा और मिनट चुनें' : 'Please choose the hour and minute'));
        (partial.querySelector(needPeriod ? '.maya-ampm-time__btn' : '.maya-ampm-time__hour') || partial).focus?.();
    }, true);

    const start = () => {
        scan(document.body);
        new MutationObserver((mutations) => {
            mutations.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); }));
        }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/**
 * Small fixed UI labels (overlay header, music player) follow the app language.
 * Only exact, known strings inside these areas are swapped, and the English
 * original is restored when the language goes back to English.
 */
(function installUiLanguageLabels() {
    if (typeof document === 'undefined' || window.__mayaUiLangLabels) return;
    window.__mayaUiLangLabels = true;

    const HI = {
        'Talk to MAYA': 'माया से बात करें',
        'Talk to Moksh': 'मोक्ष से बात करें',
        'Your personal guide': 'आपका निजी मार्गदर्शन',
        'Bhakti Music': 'भक्ति संगीत',
        'Now Playing': 'अभी चल रहा है',
        'Playing': 'चल रहा है',
        'Paused': 'रुका हुआ',
        'Ended': 'ख़त्म',
        'Buffering...': 'लोड हो रहा है...',
        'Error': 'चल नहीं पाया'
    };
    const EN = Object.fromEntries(Object.entries(HI).map(([en, hi]) => [hi, en]));
    const SCOPE = '.maya-overlay-header, .maya-global-player';

    const isHindi = () => {
        try {
            if (window.MayaFunnel?._isHindiMode) return window.MayaFunnel._isHindiMode();
            return String(window.MayaUtils?.storage?.get?.('maya_language') || '').toLowerCase().startsWith('hi');
        } catch (_e) { return false; }
    };

    let current = null;
    const apply = (root) => {
        const hi = isHindi();
        const map = hi ? HI : EN;
        const scopes = root?.closest?.(SCOPE) ? [root] : Array.from((root || document).querySelectorAll?.(SCOPE) || []);
        scopes.forEach((scope) => {
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const raw = node.textContent;
                const key = raw.trim();
                if (key && map[key]) node.textContent = raw.replace(key, map[key]);
            }
        });
        current = hi;
    };

    const start = () => {
        apply(document);
        new MutationObserver((mutations) => {
            for (const m of mutations) {
                const target = m.target?.nodeType === 1 ? m.target : m.target?.parentElement;
                if (target?.closest?.(SCOPE)) { apply(target.closest(SCOPE)); continue; }
                m.addedNodes.forEach((n) => { if (n.nodeType === 1 && (n.matches?.(SCOPE) || n.querySelector?.(SCOPE))) apply(n.parentElement || document); });
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
        // The language can change during onboarding; re-check once a second (cheap).
        setInterval(() => { if (isHindi() !== current) apply(document); }, 1000);
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/**
 * MAYA / Moksh guide cards: a slow-turning ring of graha dots around the avatar,
 * a short line about each guide's style and three topic chips. Names show in Hindi
 * in Hindi mode. Works on the cards onboarding.js renders; nothing else changes.
 */
(function installGuideCardExtras() {
    if (typeof document === 'undefined' || window.__mayaGuideCardExtras) return;
    window.__mayaGuideCardExtras = true;
    const isHindi = () => {
        try {
            if (window.MayaOnboarding?.isHindiUI) return !!window.MayaOnboarding.isHindiUI();
            if (window.MayaFunnel?._isHindiMode) return window.MayaFunnel._isHindiMode();
            return String(window.MayaUtils?.storage?.get?.('maya_language') || '').toLowerCase().startsWith('hi');
        } catch (_e) { return false; }
    };
    const COPY = {
        female: {
            hi: { name: '\u092e\u093e\u092f\u093e', line: '\u0926\u093f\u0932 \u0915\u0940 \u092c\u093e\u0924, \u0928\u0930\u092e\u0940 \u0938\u0947', chips: ['\u092d\u093e\u0935\u0928\u093e\u090f\u0901', '\u0930\u093f\u0936\u094d\u0924\u0947', '\u0905\u0902\u0924\u0930\u094d\u091c\u094d\u091e\u093e\u0928'] },
            en: { name: 'Maya', line: 'Gentle, heart-first guidance', chips: ['Emotions', 'Relationships', 'Intuition'] }
        },
        male: {
            hi: { name: '\u092e\u094b\u0915\u094d\u0937', line: '\u0938\u0940\u0927\u0940 \u092c\u093e\u0924, \u0938\u093e\u092b\u093c \u0930\u093e\u0938\u094d\u0924\u093e', chips: ['\u0915\u0930\u093f\u092f\u0930', '\u0915\u0930\u094d\u092e', '\u0909\u092a\u093e\u092f'] },
            en: { name: 'Moksh', line: 'Straight talk, clear path', chips: ['Career', 'Karma', 'Remedies'] }
        }
    };
    const enhance = (slide) => {
        const kind = slide.getAttribute('data-value');
        if (!COPY[kind] || slide.dataset.extras === '1') return;
        slide.dataset.extras = '1';
        const c = COPY[kind][isHindi() ? 'hi' : 'en'];
        const name = slide.querySelector('.gc-name');
        if (name) name.textContent = c.name;
        const avatar = slide.querySelector('.gc-avatar');
        if (avatar && !avatar.querySelector('.gc-orbit-ring')) {
            const ring = document.createElement('span');
            ring.className = 'gc-orbit-ring';
            ring.setAttribute('aria-hidden', 'true');
            ring.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
            avatar.appendChild(ring);
        }
        const bottom = slide.querySelector('.gc-content-bottom');
        if (bottom && !bottom.querySelector('.gc-chips')) {
            const line = document.createElement('p');
            line.className = 'gc-line';
            line.textContent = c.line;
            const chips = document.createElement('div');
            chips.className = 'gc-chips';
            chips.innerHTML = c.chips.map((t) => `<span class="gc-chip">${t}</span>`).join('');
            bottom.appendChild(line);
            bottom.appendChild(chips);
        }
    };
    const scan = (root) => { (root.querySelectorAll ? root.querySelectorAll('.gc-slide[data-value]') : []).forEach(enhance); };
    const start = () => {
        scan(document);
        new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n.matches?.('.gc-slide') ? n.parentElement || n : n); })))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/**
 * "Hear the voice" button on the MAYA / Moksh cards: plays a short sample in that
 * guide's own voice, so people choose by hearing, not guessing. The saved guide
 * choice is not changed by listening.
 */
(function installGuideVoiceSample() {
    if (typeof document === 'undefined' || window.__mayaGuideVoiceSample) return;
    window.__mayaGuideVoiceSample = true;
    const isHindi = () => {
        try {
            if (window.MayaOnboarding?.isHindiUI) return !!window.MayaOnboarding.isHindiUI();
            return String(window.MayaUtils?.storage?.get?.('maya_language') || '').toLowerCase().startsWith('hi');
        } catch (_e) { return false; }
    };
    const SAMPLE = {
        female: {
            hi: '\u0928\u092e\u0938\u094d\u0924\u0947, \u092e\u0948\u0902 \u092e\u093e\u092f\u093e \u0939\u0942\u0901\u0964 \u0906\u092a\u0915\u0940 \u0915\u0941\u0902\u0921\u0932\u0940 \u0915\u094b \u0926\u093f\u0932 \u0938\u0947 \u0938\u092e\u091d\u0915\u0930, \u092a\u094d\u092f\u093e\u0930 \u0938\u0947 \u092c\u0924\u093e\u090a\u0901\u0917\u0940\u0964',
            en: 'Hi, I am Maya. I will read your chart with care, and explain it gently.'
        },
        male: {
            hi: '\u0928\u092e\u0938\u094d\u0924\u0947, \u092e\u0948\u0902 \u092e\u094b\u0915\u094d\u0937 \u0939\u0942\u0901\u0964 \u0906\u092a\u0915\u0940 \u0915\u0941\u0902\u0921\u0932\u0940 \u0915\u0940 \u0939\u0930 \u092c\u093e\u0924 \u0938\u0940\u0927\u0940 \u0914\u0930 \u0938\u093e\u092b\u093c \u092c\u0924\u093e\u090a\u0901\u0917\u093e\u0964',
            en: 'Hi, I am Moksh. I will read your chart and tell you clearly, step by step.'
        }
    };
    // One sample at a time. Saved state is restored only when the last sample ends.
    let runId = 0;
    let saved = null;
    const stopAll = (voice) => {
        try { voice?.stop?.(); } catch (_e) { /* ignore */ }
        try { window.speechSynthesis?.cancel?.(); } catch (_e) { /* ignore */ }
    };
    const restore = (voice) => {
        document.querySelectorAll('.gc-voice-btn.is-playing').forEach((b) => b.classList.remove('is-playing'));
        if (!saved || !voice) return;
        // If the user already picked a guide, keep that pick.
        voice.agentGender = window.MayaOnboarding?.userData?.agentGender || saved.gender;
        voice.isMuted = saved.muted;
        voice.speakFallback = saved.fallback;
        saved = null;
    };
    const play = async (kind, btn) => {
        const voice = window.MayaVoice;
        if (!voice?.speak) return;
        // Tap again on the playing button = stop. Never two voices at once.
        if (btn.classList.contains('is-playing')) {
            runId += 1;
            stopAll(voice);
            restore(voice);
            return;
        }
        const myRun = (runId += 1);
        // Speak in the language the user picked for MAYA (narration), not the screen language.
        let hi = false;
        try {
            hi = window.MayaOnboarding?.isHindiNarration
                ? !!window.MayaOnboarding.isHindiNarration()
                : String(window.MayaUtils?.storage?.get?.('maya_language') || '').toLowerCase().startsWith('hi');
        } catch (_e) { hi = false; }
        if (!saved) {
            // New users start muted; a tap here is a clear ask to hear it.
            saved = { gender: voice.agentGender, muted: !!voice.isMuted, fallback: voice.speakFallback };
            // Only the guide's real voice: no robotic browser voice during the sample.
            voice.speakFallback = () => Promise.resolve();
        }
        document.querySelectorAll('.gc-voice-btn.is-playing').forEach((b) => b.classList.remove('is-playing'));
        btn.classList.add('is-playing');
        try {
            stopAll(voice);
            voice.isMuted = false;
            voice.agentGender = kind === 'male' ? 'male' : 'female';
            voice.preferredVoiceId = null;
            await voice.speak(SAMPLE[kind][hi ? 'hi' : 'en']);
        } catch (_e) { /* sample is optional */ }
        finally {
            if (myRun === runId) restore(voice);
        }
    };
    const enhance = (slide) => {
        const kind = slide.getAttribute('data-value');
        if (!SAMPLE[kind] || slide.querySelector('.gc-voice-btn')) return;
        const bottom = slide.querySelector('.gc-content-bottom');
        if (!bottom) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gc-voice-btn';
        btn.setAttribute('data-keep-voice', '');
        btn.innerHTML = `<span class="gc-voice-icon" aria-hidden="true">&#9654;</span> ${isHindi() ? '\u0906\u0935\u093e\u091c\u093c \u0938\u0941\u0928\u0947\u0902' : 'Hear the voice'}`;
        // Phones: the card listens to touchend (select guide) and the slider to touchstart
        // (swipe), so the button must keep its touches to itself.
        let touched = 0;
        btn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault(); e.stopPropagation();
            touched = Date.now();
            play(kind, btn);
        }, { passive: false });
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Date.now() - touched < 600) return;
            play(kind, btn);
        });
        bottom.insertBefore(btn, bottom.firstChild);
    };
    const scan = (root) => { (root.querySelectorAll ? root.querySelectorAll('.gc-slide[data-value]') : []).forEach(enhance); };
    const start = () => {
        scan(document);
        new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n.parentElement || n); })))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
