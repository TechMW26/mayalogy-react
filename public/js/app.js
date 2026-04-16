/**
 * MAYA - Main Application
 * Application Initialization and Core Logic
 */

console.log('🔧 app.js loading...');

// Global function for Android theme sync
window.syncThemeFromAndroid = function(theme) {
    console.log('📱 Global syncThemeFromAndroid called with:', theme);
    if (window.MayaApp && typeof MayaApp.syncThemeFromAndroid === 'function') {
        MayaApp.syncThemeFromAndroid(theme);
    } else {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('maya_theme', theme);
    }
};

// Check if running in Android app
window.isAndroidApp = typeof MayaAndroid !== 'undefined';

// Detect Android WebView (works even without MayaAndroid interface)
window.isAndroidWebView = (function() {
    const ua = navigator.userAgent || '';
    // Check for Android WebView indicators
    const isAndroid = /Android/i.test(ua);
    const isWebView = /wv|WebView/i.test(ua) || (isAndroid && /Version\/[\d.]+/.test(ua) && !/Chrome\/[\d.]+ Mobile Safari/i.test(ua));
    const hasAndroidInterface = typeof MayaAndroid !== 'undefined';
    // Also check for TWA (Trusted Web Activity) 
    const isTWA = document.referrer.includes('android-app://') || (isAndroid && window.matchMedia('(display-mode: standalone)').matches);
    
    return isAndroid && (isWebView || hasAndroidInterface || isTWA);
})();

// Android WebView detection logged (safe area CSS disabled for now)
if (window.isAndroidWebView) {
    console.log('📱 Android WebView detected');
}

const MayaApp = {
    isInitialized: false,
    isOnboardingActive: false,

    /**
     * Initialize the application
     */
    async init() {
        console.log('🌟 Initializing MAYA...');

        // Check if Android app - use device theme
        let theme = MayaUtils.storage.get('maya_theme') || 'dark';
        if (window.MayaAndroid && typeof MayaAndroid.getDeviceTheme === 'function') {
            theme = MayaAndroid.getDeviceTheme();
            console.log('📱 Using Android device theme:', theme);
        }

        // Apply theme first (before anything visual)
        this.applyTheme(theme);

        // Start pyramid loader animation
        this.initPreloader();

        // Initialize modules
        if (window.MayaAuth) {
            await MayaAuth.init();
        }

        // Initialize voice - loads saved mute preference
        if (window.MayaVoice) {
            MayaVoice.init();
            // Only force mute if no saved preference exists (first time user)
            const savedMute = MayaUtils.storage.get('maya_voice_muted');
            if (savedMute === null) {
                MayaVoice.setMute(true); // Mute by default for new users to avoid autoplay issues
            }
        }

        await this.applyLanguagePreference(MayaUtils.storage.get('maya_language') || 'en', { force: true });

        // Setup event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        console.log('✨ MAYA initialized successfully!');
    },

    /**
     * Initialize and animate the splash screen
     * Uses React + Framer Motion (CDN scripts cached by SW on first load)
     */
    initPreloader() {
        console.log('🎬 initPreloader (splash) called');
        
        let hasStarted = false;
        
        const doStart = () => {
            if (hasStarted) return;
            hasStarted = true;
            console.log('🚀 doStart triggered');
            this.hidePreloader();
            this.startApp();
        };
        
        // SAFETY: Always start after max 4 seconds no matter what
        setTimeout(() => {
            console.log('⏰ Safety timeout triggered');
            doStart();
        }, 4000);
        
        // React splash animation handles itself - just wait for it to complete
        // Animation timeline: 500ms start, 2500ms morph, ~3500ms total
        setTimeout(doStart, 3500);
    },

    /**
     * Start the app after preloader
     */
    async startApp() {
        console.log('🚀 Starting MAYA app...');
        
        // Cleanup old horoscopes in Firebase (keep last 7 days)
        this.cleanupOldHoroscopes();
        
        // Set initial UI visibility based on auth state
        this.updateUIVisibility();
        
        // Check authentication and onboarding
        await this.checkUserState();
    },

    /**
     * Update UI visibility based on login state
     * Hides header, sidebar, bottom nav for non-logged-in users
     */
    updateUIVisibility() {
        const isAuthenticated = window.MayaAuth?.isAuthenticated || false;
        
        if (isAuthenticated) {
            // User is logged in - show all UI
            document.body.classList.remove('guest-mode');
            console.log('🔓 UI unlocked - user is logged in');
        } else {
            // User is NOT logged in - hide app chrome, show only funnel
            document.body.classList.add('guest-mode');
            console.log('🔒 UI locked - user is guest (not logged in)');
        }
    },

    /**
     * Called after successful login/register to show full UI
     */
    onUserAuthenticated() {
        console.log('✅ User authenticated - showing full UI');
        document.body.classList.remove('guest-mode');
        this.updateSidebarUserInfo();
        void this.applyLanguagePreference(MayaUtils.storage.get('maya_language') || MayaUtils.storage.get('maya_profile')?.language || 'en', { force: true });
    },

    async applyLanguagePreference(language = MayaUtils.storage.get('maya_language') || 'en', { rerenderCurrentPage = false, force = false, syncProfile = false } = {}) {
        const resolvedLanguage = language === 'hi' ? 'hi' : 'en';

        if (window.MayaDBSync?.set) {
            MayaDBSync.set('maya_language', resolvedLanguage);
        } else {
            MayaUtils.storage.set('maya_language', resolvedLanguage);
        }

        const profile = MayaUtils.storage.get('maya_profile') || {};
        if (profile.language !== resolvedLanguage) {
            MayaUtils.storage.set('maya_profile', { ...profile, language: resolvedLanguage });
        }

        document.documentElement.lang = resolvedLanguage === 'hi' ? 'hi' : 'en';

        if (window.MayaStatements?.setLanguage) {
            MayaStatements.setLanguage(resolvedLanguage);
        }

        if (window.MayaDynamicContent?.setLanguage) {
            MayaDynamicContent.setLanguage(resolvedLanguage);
        }

        if (window.MayaListener?.setLanguage) {
            MayaListener.setLanguage(resolvedLanguage);
        }

        if (window.MayaI18n) {
            MayaI18n.init?.();
            await MayaI18n.setLanguage(resolvedLanguage, { force });
        }

        if (syncProfile && window.MayaAuth?.isAuthenticated && typeof MayaAuth.updateProfile === 'function') {
            try {
                await MayaAuth.updateProfile({ language: resolvedLanguage });
            } catch (error) {
                console.warn('Failed to sync language preference:', error);
            }
        }

        this.updateSidebarUserInfo();

        if (rerenderCurrentPage && window.MayaPages?.currentPage) {
            await MayaPages.render(MayaPages.currentPage);
        }
    },
    
    /**
     * Cleanup old horoscopes from Firebase
     */
    async cleanupOldHoroscopes() {
        const session = MayaUtils.storage.get('maya_session');
        if (session?.email && window.MayaFirebase) {
            try {
                await MayaFirebase.cleanupOldHoroscopes(session.email);
            } catch (e) {
                // Silent fail - not critical
            }
        }
    },

    /**
     * Hide preloader
     */
    hidePreloader() {
        const preloader = document.getElementById('preloader');
        const appContainer = document.getElementById('app-container');
        
        if (preloader) {
            preloader.classList.add('hidden');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }
        
        // Show main app
        if (appContainer) {
            appContainer.classList.remove('d-none');
        }
        
        // Update sidebar user info
        this.updateSidebarUserInfo();
    },

    /**
     * Update sidebar with user name and day status
     */
    updateSidebarUserInfo() {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const profilePhoto = MayaUtils.storage.get('maya_profile_photo');
        const isHindi = MayaUtils.storage.get('maya_language') === 'hi';
        
        // Update avatar with profile photo or initials
        const avatarEl = document.getElementById('sidebar-avatar');
        if (avatarEl) {
            if (profilePhoto) {
                avatarEl.innerHTML = `<img src="${profilePhoto}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else if (profile.name) {
                const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                avatarEl.innerHTML = `<span style="font-weight: 600; font-size: 1rem;">${initials}</span>`;
            } else {
                avatarEl.innerHTML = `<i class="bi bi-person"></i>`;
            }
        }
        
        // Update user name
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            if (profile.name) {
                const firstName = profile.name.split(' ')[0];
                userNameEl.textContent = firstName;
            } else {
                userNameEl.textContent = window.MayaI18n?.t('Guest') || (isHindi ? 'अतिथि' : 'Guest');
            }
        }
        
        // Update day status
        const dayStatusEl = document.getElementById('user-day-status');
        if (dayStatusEl && profile.birthDate) {
            const dayStatus = this.calculateDayStatus(profile.birthDate);
            dayStatusEl.innerHTML = this.getDayStatusPill(dayStatus, isHindi);
        }
    },

    /**
     * Calculate day status based on horoscope factors
     */
    calculateDayStatus(birthDate) {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const zodiac = window.MayaAstrology ? MayaAstrology.getZodiac(birthDate, profile) : null;
        if (!zodiac) return 'okay';
        
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayOfMonth = today.getDate();
        const month = today.getMonth() + 1;
        
        // Simple algorithm based on various factors
        let score = 0;
        
        // Lucky day bonus
        const luckyDays = {
            'Aries': 2, 'Taurus': 5, 'Gemini': 3, 'Cancer': 1,
            'Leo': 0, 'Virgo': 3, 'Libra': 5, 'Scorpio': 2,
            'Sagittarius': 4, 'Capricorn': 6, 'Aquarius': 6, 'Pisces': 4
        };
        if (luckyDays[zodiac.name] === dayOfWeek) score += 3;
        
        // Lucky number match
        const luckyNumbers = zodiac.luckyNumbers || [];
        if (luckyNumbers.includes(dayOfMonth) || luckyNumbers.includes(dayOfMonth % 10)) score += 2;
        
        // Moon phase influence (simplified)
        const moonPhase = (dayOfMonth % 15);
        if (moonPhase < 5) score += 1; // Near new/full moon
        
        // Planetary hour bonus (simplified based on hour)
        const hour = today.getHours();
        if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 19)) score += 1;
        
        // Seasonal zodiac alignment
        const currentZodiacMonth = this.getZodiacForMonth(month, dayOfMonth);
        if (currentZodiacMonth === zodiac.name) score += 2;
        
        // Random cosmic factor (seeded by date for consistency)
        const dateSeed = today.getFullYear() * 10000 + month * 100 + dayOfMonth;
        const cosmicBonus = (dateSeed % 3);
        score += cosmicBonus;
        
        // Determine status
        if (score >= 6) return 'good';
        if (score >= 3) return 'okay';
        return 'challenging';
    },

    /**
     * Get zodiac sign for current month
     */
    getZodiacForMonth(month, day) {
        const signs = [
            { name: 'Capricorn', end: { month: 1, day: 19 } },
            { name: 'Aquarius', end: { month: 2, day: 18 } },
            { name: 'Pisces', end: { month: 3, day: 20 } },
            { name: 'Aries', end: { month: 4, day: 19 } },
            { name: 'Taurus', end: { month: 5, day: 20 } },
            { name: 'Gemini', end: { month: 6, day: 20 } },
            { name: 'Cancer', end: { month: 7, day: 22 } },
            { name: 'Leo', end: { month: 8, day: 22 } },
            { name: 'Virgo', end: { month: 9, day: 22 } },
            { name: 'Libra', end: { month: 10, day: 22 } },
            { name: 'Scorpio', end: { month: 11, day: 21 } },
            { name: 'Sagittarius', end: { month: 12, day: 21 } },
            { name: 'Capricorn', end: { month: 12, day: 31 } }
        ];
        
        for (const sign of signs) {
            if (month < sign.end.month || (month === sign.end.month && day <= sign.end.day)) {
                return sign.name;
            }
        }
        return 'Capricorn';
    },

    /**
     * Get day status pill HTML
     */
    getDayStatusPill(status, isHindi) {
        const statusConfig = {
            good: {
                class: 'day-status-pill--good',
                icon: 'bi-sun-fill',
                label: isHindi ? 'शुभ दिन' : 'Great Day'
            },
            okay: {
                class: 'day-status-pill--okay',
                icon: 'bi-cloud-sun-fill',
                label: isHindi ? 'सामान्य दिन' : 'Mixed Day'
            },
            challenging: {
                class: 'day-status-pill--challenging',
                icon: 'bi-cloud-fill',
                label: isHindi ? 'सावधान रहें' : 'Be Mindful'
            }
        };
        
        const config = statusConfig[status] || statusConfig.okay;
        return `<span class="day-status-pill ${config.class}">
            <i class="bi ${config.icon}"></i>
            ${config.label}
        </span>`;
    },

    /**
     * Apply theme
     */
    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'system') {
            // Check if Android app is providing theme
            if (window.MayaAndroid && typeof MayaAndroid.getDeviceTheme === 'function') {
                const androidTheme = MayaAndroid.getDeviceTheme();
                html.setAttribute('data-bs-theme', androidTheme);
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                html.setAttribute('data-bs-theme', prefersDark ? 'dark' : 'light');
            }
        } else {
            html.setAttribute('data-bs-theme', theme);
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (MayaUtils.storage.get('maya_theme') === 'system') {
                html.setAttribute('data-bs-theme', e.matches ? 'dark' : 'light');
            }
        });
    },

    /**
     * Sync theme from Android app (called by native code)
     */
    syncThemeFromAndroid(theme) {
        console.log('📱 Syncing theme from Android:', theme);
        const html = document.documentElement;
        html.setAttribute('data-bs-theme', theme);
        MayaUtils.storage.set('maya_theme', theme);
    },

    /**
     * Check user state and show appropriate flow
     */
    async checkUserState() {
        const profile = MayaUtils.storage.get('maya_profile');
        const hasProfile = profile && profile.birthDate;
        const isAuthenticated = window.MayaAuth ? MayaAuth.isAuthenticated : false;
        const preferredLanguage = MayaUtils.storage.get('maya_language') || profile?.language || 'en';

        await this.applyLanguagePreference(preferredLanguage, { force: true });
        
        // Get funnel state
        const funnelComplete = MayaUtils.storage.get('funnel_complete');
        const funnelState = window.MayaOnboarding ? MayaOnboarding.getFunnelState() : null;
        
        // IMPORTANT: Always show funnel if user is NOT logged in (no email/password)
        // Funnel should only be skipped if:
        // 1. User is authenticated (logged in with email/password) AND
        // 2. Funnel is marked as complete AND
        // 3. Profile exists with birth date
        const shouldShowFunnel = !isAuthenticated || !funnelComplete || !hasProfile;

        console.log('📊 User state check:', { 
            hasProfile, 
            isAuthenticated, 
            funnelComplete,
            funnelState,
            shouldShowFunnel
        });

        if (shouldShowFunnel && !isAuthenticated) {
            // Show onboarding for non-logged-in users (ALWAYS)
            console.log('📊 User not logged in - showing funnel...');
            if (funnelState && funnelState.currentStep > 0 && !funnelState.isComplete) {
                console.log(`📊 Resuming from step ${funnelState.currentStep + 1}: ${funnelState.currentStepName}`);
            }
            setTimeout(() => {
                this.showOnboarding();
            }, 500);
        } else if (isAuthenticated && hasProfile) {
            // Load home page ONLY for authenticated users with complete profile
            console.log('📊 User logged in with profile, rendering saved page...');
            // Ensure UI is visible for authenticated user
            this.onUserAuthenticated();
            if (window.MayaPages) {
                // Restore last visited page or default to home
                const savedPage = MayaUtils.storage.get('maya_current_page') || 'home';
                console.log('📊 Restoring page:', savedPage);
                MayaPages.render(savedPage);
            }
        } else {
            // Fallback: show funnel
            console.log('📊 Fallback: showing funnel...');
            setTimeout(() => {
                this.showOnboarding();
            }, 500);
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Sidebar user profile click - go to profile page
        const userProfile = document.querySelector('.user-profile[data-page="profile"]');
        if (userProfile) {
            userProfile.addEventListener('click', () => {
                MayaPages.render('profile');
                this.closeSidebar();
            });
        }
        
        // Navigation - Sidebar and Bottom Nav
        document.querySelectorAll('.sidebar-nav .nav-link, .bottom-nav .nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                if (page) {
                    // Update active states
                    document.querySelectorAll('.nav-link, .bottom-nav .nav-item').forEach(l => l.classList.remove('active'));
                    document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));
                    
                    // Render page
                    MayaPages.render(page);
                    
                    // Close sidebar on mobile
                    this.closeSidebar();
                }
            });
        });

        // MAYA button (in bottom nav)
        const mayaNavBtn = document.getElementById('maya-nav-btn');
        if (mayaNavBtn) {
            mayaNavBtn.addEventListener('click', () => {
                this.showMaya();
            });
        }

        // MAYA overlay close button (X in top right)
        const mayaClose = document.getElementById('maya-close');
        if (mayaClose) {
            mayaClose.addEventListener('click', () => {
                this.hideMaya();
            });
        }

        const mayaHistory = document.getElementById('maya-history');
        if (mayaHistory) {
            mayaHistory.addEventListener('click', () => {
                this.openMayaChatHistory();
            });
        }

        // MAYA overlay back button (arrow in top left)
        const mayaBack = document.getElementById('maya-back');
        if (mayaBack) {
            mayaBack.addEventListener('click', () => {
                this.hideMaya();
            });
        }

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Close sidebar on overlay click
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Sidebar close button (mobile)
        document.getElementById('sidebar-close')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Notifications panel toggle
        document.getElementById('notifications-btn')?.addEventListener('click', () => {
            this.toggleNotifications();
        });

        // Close notifications panel
        document.getElementById('notifications-close')?.addEventListener('click', () => {
            this.closeNotifications();
        });

        // Close notifications on overlay click
        document.getElementById('notifications-overlay')?.addEventListener('click', () => {
            this.closeNotifications();
        });

        // Auth modal buttons
        this.setupAuthListeners();

        // Voice toggle in header
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                const muted = MayaVoice.toggleMute();
                voiceToggle.innerHTML = muted 
                    ? '<i class="bi bi-volume-mute"></i>' 
                    : '<i class="bi bi-volume-up"></i>';
            });
        }

        // Email capture form
        this.setupFunnelListeners();
        
        // Global event delegation for showMaya action and lucky cards
        document.addEventListener('click', (e) => {
            // Handle "Ask MAYA" buttons with data-action="showMaya"
            const showMayaBtn = e.target.closest('[data-action="showMaya"]');
            if (showMayaBtn) {
                e.preventDefault();
                this.showMaya();
                return;
            }
            
            // Handle Lucky Element cards with event delegation
            const luckyCard = e.target.closest('.maya-lucky-card');
            if (luckyCard && luckyCard.dataset.luckyType) {
                const type = luckyCard.dataset.luckyType;
                const value = luckyCard.dataset.luckyValue;
                const name = luckyCard.dataset.luckyName;
                if (window.MayaPages && MayaPages.showLuckyModal) {
                    MayaPages.showLuckyModal(type, value, name);
                }
            }
        });
    },

    /**
     * Setup auth listeners
     */
    setupAuthListeners() {
        // Show login modal
        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthModal('login');
        });

        // Show register modal
        document.getElementById('showRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthModal('register');
        });

        // Login form submit
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const result = await MayaAuth.login(email, password);
            if (result.success) {
                MayaUtils.toast.success('Welcome back!');
                // Always reload page after successful login to refresh session
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                MayaUtils.toast.error(result.error);
            }
        });

        // Register form submit
        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                name: document.getElementById('registerName').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value
            };
            
            const result = await MayaAuth.register(userData);
            if (result.success) {
                MayaUtils.toast.success('Account created successfully!');
                // Always reload page after successful registration to refresh session
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                MayaUtils.toast.error(result.error);
            }
        });

        // Google login
        document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
            // Implement Google OAuth
            MayaUtils.toast.info('Google login coming soon!');
        });
    },

    /**
     * Setup funnel listeners
     */
    setupFunnelListeners() {
        const emailForm = document.getElementById('emailCaptureForm');
        if (emailForm) {
            emailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('captureEmail').value;
                
                if (!MayaUtils.isValidEmail(email)) {
                    MayaUtils.toast.error('Please enter a valid email');
                    return;
                }

                await MayaAuth.captureEmail(email, 'teaser');
                MayaUtils.storage.set('maya_captured_email', email);
                MayaUtils.storage.set('maya_funnel_progress', MAYA_CONFIG.FUNNEL.EMAIL_GATE_STEP);
                
                MayaUtils.toast.success('Thank you! Unlocking your full reading...');
                this.hideTeaser();
                this.showFullReading();
            });
        }
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        sidebar?.classList.toggle('show');
        overlay?.classList.toggle('show');
    },

    /**
     * Close sidebar
     */
    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('show');
        document.getElementById('sidebar-overlay')?.classList.remove('show');
    },

    /**
     * Toggle notifications panel
     */
    toggleNotifications() {
        const panel = document.getElementById('notifications-panel');
        const overlay = document.getElementById('notifications-overlay');
        
        // Update notifications before showing
        this.updateNotifications();
        
        panel?.classList.toggle('show');
        overlay?.classList.toggle('show');
    },

    /**
     * Close notifications panel
     */
    closeNotifications() {
        document.getElementById('notifications-panel')?.classList.remove('show');
        document.getElementById('notifications-overlay')?.classList.remove('show');
    },

    /**
     * Generate dynamic notifications from horoscope data
     * Call this after horoscope is loaded
     */
    async updateNotifications() {
        const container = document.getElementById('notifications-body');
        if (!container) return;

        const profile = MayaUtils.storage.get('maya_profile') || {};
        const language = MayaUtils.storage.get('maya_language') || 'en';
        const zodiac = window.MayaAstrology?.getZodiac(profile.birthDate, profile);
        
        // Get today's horoscope data
        let horoscope = null;
        if (window.MayaPages?._horoscopeCache?.data) {
            horoscope = MayaPages._horoscopeCache.data;
        }

        const notifications = [];
        const now = new Date();
        const hours = now.getHours();

        // Notification templates based on time of day and horoscope
        if (horoscope && horoscope.text) {
            notifications.push({
                id: 'horoscope-ready',
                icon: 'bi-stars',
                text: language === 'hi' ? 'आज का राशिफल तैयार है!' : 'Your daily horoscope is ready!',
                time: language === 'hi' ? 'अभी' : 'Just now',
                unread: true,
                action: 'horoscope'
            });
        }

        // Time-based precaution notifications
        if (hours >= 6 && hours < 12) {
            // Morning notifications
            notifications.push({
                id: 'time-morning',
                icon: 'bi-sunrise',
                text: language === 'hi' 
                    ? `सुप्रभात ${profile.name || ''}! आज ${zodiac?.name || ''} के लिए शुभ दिन है।` 
                    : `Good morning ${profile.name || ''}! Auspicious day for ${zodiac?.name || ''}.`,
                time: language === 'hi' ? 'सुबह' : 'Morning',
                unread: false,
                action: null
            });
        } else if (hours >= 12 && hours < 17) {
            // Afternoon
            notifications.push({
                id: 'time-afternoon',
                icon: 'bi-sun',
                text: language === 'hi' 
                    ? 'दोपहर में धैर्य रखें - ऊर्जा का स्तर बनाए रखें।' 
                    : 'Stay patient this afternoon - maintain your energy levels.',
                time: language === 'hi' ? 'दोपहर' : 'Afternoon',
                unread: false,
                action: null
            });
        } else if (hours >= 17 && hours < 21) {
            // Evening
            notifications.push({
                id: 'time-evening',
                icon: 'bi-sunset',
                text: language === 'hi' 
                    ? 'शाम का समय - आराम और चिंतन के लिए उत्तम।' 
                    : 'Evening time - perfect for relaxation and reflection.',
                time: language === 'hi' ? 'शाम' : 'Evening',
                unread: false,
                action: null
            });
        } else {
            // Night
            notifications.push({
                id: 'time-night',
                icon: 'bi-moon-stars',
                text: language === 'hi' 
                    ? 'रात्रि का समय - कल के लिए शुभ ऊर्जा का संचय करें।' 
                    : 'Night time - preserve positive energy for tomorrow.',
                time: language === 'hi' ? 'रात' : 'Night',
                unread: false,
                action: null
            });
        }

        // Zodiac-specific daily tip
        if (zodiac) {
            const tips = this._getZodiacDailyTips(zodiac.name, language);
            if (tips) {
                notifications.push({
                    id: 'zodiac-tip',
                    icon: 'bi-lightbulb',
                    text: tips.tip,
                    time: tips.time,
                    unread: false,
                    action: null
                });

                if (tips.precaution) {
                    notifications.push({
                        id: 'zodiac-caution',
                        icon: 'bi-shield-exclamation',
                        text: tips.precaution,
                        time: language === 'hi' ? 'सावधानी' : 'Caution',
                        unread: true,
                        action: null
                    });
                }
            }
        }

        // Lucky color/number reminder
        if (zodiac) {
            const luckyInfo = this._getLuckyInfo(zodiac.name, language);
            if (luckyInfo) {
                notifications.push({
                    id: 'lucky',
                    icon: 'bi-gem',
                    text: luckyInfo,
                    time: language === 'hi' ? 'आज' : 'Today',
                    unread: false,
                    action: null
                });
            }
        }

        // Filter out dismissed notifications
        const dismissedIds = MayaUtils.storage.get('maya_dismissed_notifications') || [];
        const today = new Date().toDateString();
        const dismissedToday = dismissedIds.filter(d => d.date === today).map(d => d.id);
        const visibleNotifications = notifications.filter(n => !dismissedToday.includes(n.id));

        // Render notifications
        if (visibleNotifications.length === 0) {
            container.innerHTML = `
                <div class="notifications-empty">
                    <i class="bi bi-bell-slash"></i>
                    <p>${language === 'hi' ? 'कोई नई सूचना नहीं' : 'No new notifications'}</p>
                </div>
            `;
        } else {
            container.innerHTML = visibleNotifications.map((n, index) => `
                <div class="notification-item ${n.unread ? 'unread' : ''}" data-notification-id="${n.id || index}" data-action="${n.action || ''}">
                    <div class="notification-icon"><i class="bi ${n.icon}"></i></div>
                    <div class="notification-content">
                        <p class="notification-text">${n.text}</p>
                        <span class="notification-time">${n.time}</span>
                    </div>
                    <button class="notification-dismiss" title="${language === 'hi' ? 'हटाएं' : 'Dismiss'}">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `).join('');

            // Add click handlers
            this._attachNotificationHandlers(container);
        }

        // Update badge count
        const unreadCount = visibleNotifications.filter(n => n.unread).length;
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }
    },

    /**
     * Get zodiac-specific daily tips and precautions
     */
    _getZodiacDailyTips(zodiac, language) {
        return null;
    },

    /**
     * Get lucky info for zodiac - uses MAYA_CONFIG for accurate data
     */
    _getLuckyInfo(zodiacName, language) {
        // Get zodiac data from config for accuracy
        const zodiacSign = MAYA_CONFIG?.ZODIAC?.SIGNS?.find(s => s.name === zodiacName);
        
        if (!zodiacSign) {
            // Fallback data if config not found
            const luckyData = {
                'Aries': { color: 'Red', numbers: [9, 1, 8], hi_color: 'लाल' },
                'Taurus': { color: 'Green', numbers: [6, 5, 8], hi_color: 'हरा' },
                'Gemini': { color: 'Yellow', numbers: [5, 3, 6], hi_color: 'पीला' },
                'Cancer': { color: 'White', numbers: [2, 7, 9], hi_color: 'सफेद' },
                'Leo': { color: 'Gold', numbers: [1, 4, 9], hi_color: 'सुनहरा' },
                'Virgo': { color: 'Green', numbers: [5, 6, 2], hi_color: 'हरा' },
                'Libra': { color: 'White', numbers: [6, 9, 5], hi_color: 'सफेद' },
                'Scorpio': { color: 'Maroon', numbers: [9, 4, 2], hi_color: 'मैरून' },
                'Sagittarius': { color: 'Yellow', numbers: [3, 7, 9], hi_color: 'पीला' },
                'Capricorn': { color: 'Navy Blue', numbers: [8, 4, 6], hi_color: 'गहरा नीला' },
                'Aquarius': { color: 'Blue', numbers: [4, 8, 7], hi_color: 'नीला' },
                'Pisces': { color: 'Yellow', numbers: [3, 7, 12], hi_color: 'पीला' }
            };
            const data = luckyData[zodiacName];
            if (!data) return null;
            
            return language === 'hi' 
                ? `आज का शुभ रंग: ${data.hi_color} | शुभ अंक: ${data.numbers[0]}`
                : `Lucky color: ${data.color} | Lucky number: ${data.numbers[0]}`;
        }

        // Use config data for accurate info
        const colorName = zodiacSign.colorName || 'Indigo';
        const luckyNumber = zodiacSign.luckyNumbers?.[0] || 7;
        
        // Hindi color names mapping
        const hindiColors = {
            'Red': 'लाल', 'Green': 'हरा', 'Yellow': 'पीला', 'White': 'सफेद',
            'Gold': 'सुनहरा', 'Maroon': 'मैरून', 'Navy Blue': 'गहरा नीला', 
            'Blue': 'नीला', 'Pink': 'गुलाबी', 'Purple': 'बैंगनी'
        };
        
        const hiColor = hindiColors[colorName] || colorName;

        return language === 'hi' 
            ? `आज का शुभ रंग: ${hiColor} | शुभ अंक: ${luckyNumber}`
            : `Lucky color: ${colorName} | Lucky number: ${luckyNumber}`;
    },

    /**
     * Attach click and dismiss handlers to notification items
     */
    _attachNotificationHandlers(container) {
        const items = container.querySelectorAll('.notification-item');
        
        items.forEach(item => {
            // Click handler for the notification content (not dismiss button)
            item.addEventListener('click', (e) => {
                // Don't trigger if dismiss button was clicked
                if (e.target.closest('.notification-dismiss')) return;
                
                const action = item.dataset.action;
                const notificationId = item.dataset.notificationId;
                
                // Mark as read
                item.classList.remove('unread');
                
                // Handle navigation based on action
                if (action && action !== 'null' && action !== '') {
                    this.closeNotifications();
                    
                    // Navigate to the appropriate page
                    if (window.MayaPages && typeof MayaPages.navigateTo === 'function') {
                        MayaPages.navigateTo(action);
                    }
                }
            });
            
            // Dismiss button handler
            const dismissBtn = item.querySelector('.notification-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const notificationId = item.dataset.notificationId;
                    
                    // Add dismissing animation
                    item.classList.add('dismissing');
                    
                    // After animation, remove and save dismissed state
                    setTimeout(() => {
                        item.classList.add('dismissed');
                        this._dismissNotification(notificationId);
                        
                        // Check if all notifications are dismissed
                        const remaining = container.querySelectorAll('.notification-item:not(.dismissed)');
                        if (remaining.length === 0) {
                            const language = MayaUtils.storage.get('maya_language') || 'en';
                            container.innerHTML = `
                                <div class="notifications-empty">
                                    <i class="bi bi-bell-slash"></i>
                                    <p>${language === 'hi' ? 'कोई नई सूचना नहीं' : 'No new notifications'}</p>
                                </div>
                            `;
                        }
                        
                        // Update badge
                        this._updateNotificationBadge();
                    }, 300);
                });
            }
        });
    },

    /**
     * Save dismissed notification ID
     */
    _dismissNotification(notificationId) {
        const today = new Date().toDateString();
        let dismissed = MayaUtils.storage.get('maya_dismissed_notifications') || [];
        
        // Filter out old entries (older than today)
        dismissed = dismissed.filter(d => d.date === today);
        
        // Add new dismissed notification
        if (!dismissed.find(d => d.id === notificationId)) {
            dismissed.push({ id: notificationId, date: today });
        }
        
        MayaUtils.storage.set('maya_dismissed_notifications', dismissed);
    },

    /**
     * Update notification badge count
     */
    _updateNotificationBadge() {
        const container = document.getElementById('notifications-body');
        if (!container) return;
        
        const unreadItems = container.querySelectorAll('.notification-item.unread:not(.dismissed)');
        const badge = document.querySelector('.notification-badge');
        
        if (badge) {
            if (unreadItems.length > 0) {
                badge.textContent = unreadItems.length;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }
    },

    /**
     * Show MAYA overlay with chat interface
     */
    showMaya() {
        console.log('showMaya called');
        const overlay = document.getElementById('maya-overlay');
        const inputArea = document.getElementById('maya-input-area');
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');
        
        if (overlay) {
            overlay.classList.add('show');
            overlay.classList.remove('funnel-mode');
            overlay.classList.add('maya-overlay--chat');
            console.log('MAYA overlay shown');
            
            // Initialize blob if not already
            if (window.MayaBlob && !MayaBlob.isAnimating) {
                MayaBlob.init('maya-blob-container');
            }
            
            // Blob at top - chat bubbles fill below
            if (blobContainer) {
                blobContainer.classList.remove('blob-centered');
                blobContainer.classList.add('blob-top');
            }
            
            // Set up chat-bubble mode (same as funnel-end chat)
            if (textDisplay) {
                textDisplay.style.display = 'flex';
                textDisplay.classList.add('maya-chat-mode');
                textDisplay.innerHTML = `<div class="maya-chat-messages" id="maya-chat-messages"></div>`;
                this.restoreMayaChatHistory();
            }
            
            // Show input area
            if (inputArea) {
                inputArea.style.display = 'flex';
            }
            
            // Setup chat handlers
            this.setupMayaChatInterface();
        } else {
            console.error('MAYA overlay element not found!');
        }
    },
    
    /**
     * Initialize Gemini Live Voice for live conversation
     * Uses browser speech recognition + Gemini AI + ElevenLabs TTS
     */
    async initRealtimeVoice() {
        if (!window.MayaRealtime) return;
        
        // Only use realtime if user has completed funnel
        if (!MayaRealtime.canUseRealtime()) {
            console.log('📵 Live voice not available - funnel not completed');
            return;
        }
        
        const textElement = document.getElementById('maya-speaking-text');
        const blobContainer = document.getElementById('maya-blob-container');
        const language = MayaUtils.storage.get('maya_language') || 'en';
        
        // Setup realtime callbacks
        MayaRealtime.onStateChange = (state, message) => {
            switch (state) {
                case 'connected':
                    console.log('🎙️ Gemini Live Voice active');
                    // Update mic button to show realtime mode
                    const micBtn = document.getElementById('maya-mic');
                    if (micBtn) {
                        micBtn.classList.add('realtime-active');
                        micBtn.title = 'Live voice active - just speak!';
                    }
                    break;
                    
                case 'user_speaking':
                    if (blobContainer) {
                        blobContainer.classList.add('blob-listening');
                    }
                    break;
                    
                case 'user_stopped':
                    if (blobContainer) {
                        blobContainer.classList.remove('blob-listening');
                    }
                    break;
                    
                case 'ai_speaking':
                    if (blobContainer) {
                        blobContainer.classList.add('blob-speaking');
                    }
                    if (window.MayaBlob) {
                        MayaBlob.startSpeaking();
                    }
                    break;
                    
                case 'ai_stopped':
                    if (blobContainer) {
                        blobContainer.classList.remove('blob-speaking');
                    }
                    if (window.MayaBlob) {
                        MayaBlob.stopSpeaking();
                    }
                    break;
                    
                case 'error':
                    console.error('Realtime error:', message);
                    // Fall back to standard mode
                    break;
                    
                case 'disconnected':
                    const micBtnDisc = document.getElementById('maya-mic');
                    if (micBtnDisc) {
                        micBtnDisc.classList.remove('realtime-active');
                    }
                    break;
            }
        };
        
        MayaRealtime.onTranscript = (transcript, source) => {
            if (source === 'user' && textElement) {
                // Show what user said
                textElement.innerHTML = language === 'hi' 
                    ? `<span class="user-transcript">"${transcript}"</span>`
                    : `<span class="user-transcript">"${transcript}"</span>`;
            }
        };
        
        MayaRealtime.onResponse = (text, type) => {
            if (textElement) {
                if (type === 'delta') {
                    // Streaming response
                    textElement.textContent = (textElement.textContent || '') + text;
                } else if (type === 'done') {
                    // Complete response
                    textElement.textContent = text;
                    
                    // Save to chat history
                    this.saveToChatHistory('Voice conversation', text);
                }
            }
        };
        
        // Initialize realtime connection
        const success = await MayaRealtime.init();
        
        if (success) {
            // Hide the standard mic button functionality - realtime handles it
            const micBtn = document.getElementById('maya-mic');
            if (micBtn) {
                // Replace click handler to just toggle mute
                micBtn.onclick = (e) => {
                    e.preventDefault();
                    const isMuted = micBtn.classList.toggle('muted');
                    MayaRealtime.setMuted(isMuted);
                    micBtn.querySelector('i').className = isMuted ? 'bi bi-mic-mute' : 'bi bi-mic-fill';
                };
            }
        }
    },

    /**
     * Setup MAYA chat interface with mic
     */
    setupMayaChatInterface() {
        const sendBtn = document.getElementById('maya-send');
        const input = document.getElementById('maya-input');
        const micBtn = document.getElementById('maya-mic');
        const language = MayaUtils.storage.get('maya_language') || 'en';
        
        // Remove old listeners by cloning elements
        if (sendBtn) {
            const newSendBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
            
            newSendBtn.addEventListener('click', () => this.handleMayaChat());
        }
        
        if (input) {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            newInput.placeholder = language === 'hi' ? 'MAYA से कुछ भी पूछें...' : 'Ask MAYA anything...';
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleMayaChat();
            });
        }
        
        // Setup mic button
        if (micBtn && window.MayaListener) {
            const newMicBtn = micBtn.cloneNode(true);
            micBtn.parentNode.replaceChild(newMicBtn, micBtn);
            
            // Initialize listener
            MayaListener.init();
            MayaListener.setLanguage(language);
            
            // Handle recognition results
            MayaListener.onResult = (transcript) => {
                const inputEl = document.getElementById('maya-input');
                if (inputEl) {
                    inputEl.value = transcript;
                    this.handleMayaChat();
                }
            };
            
            MayaListener.onStart = () => {
                const btn = document.getElementById('maya-mic');
                if (btn) {
                    btn.classList.add('listening');
                    btn.querySelector('i').className = 'bi bi-mic-fill';
                }
                const inputEl = document.getElementById('maya-input');
                if (inputEl) {
                    inputEl.placeholder = language === 'hi' ? 'सुन रही हूँ...' : 'Listening...';
                }
            };
            
            MayaListener.onEnd = () => {
                const btn = document.getElementById('maya-mic');
                if (btn) {
                    btn.classList.remove('listening');
                    btn.querySelector('i').className = 'bi bi-mic';
                }
                const inputEl = document.getElementById('maya-input');
                if (inputEl) {
                    inputEl.placeholder = language === 'hi' ? 'MAYA से कुछ भी पूछें...' : 'Ask MAYA anything...';
                }
            };
            
            // Click to toggle listening
            newMicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (MayaVoice && MayaVoice.isPlaying) return;
                
                if (MayaListener.isListening) {
                    MayaListener.stop();
                } else {
                    MayaListener.start();
                }
            });
        }
    },

    restoreMayaChatHistory() {
        const container = document.getElementById('maya-chat-messages');
        if (!container) return;

        container.innerHTML = '';

        const language = MayaUtils.storage.get('maya_language') || 'en';
        const history = MayaUtils.storage.get('maya_chat_history') || [];
        const recentHistory = history.slice(-12);

        if (!recentHistory.length) {
            this._addChatBubble(
                'maya',
                language === 'hi'
                    ? 'मैं यहाँ हूँ. मुझसे ज्योतिष, अंकशास्त्र, प्रेम, करियर या आज की ऊर्जा के बारे में पूछें.'
                    : 'I am here. Ask me about astrology, numerology, love, career, or today\'s energy.'
            );
            return;
        }

        recentHistory.forEach(entry => {
            if (entry.question) {
                this._addChatBubble('user', entry.question);
            }
            if (entry.answer) {
                this._addChatBubble('maya', entry.answer);
            }
        });
    },

    /**
     * Handle MAYA chat input
     */
    async handleMayaChat() {
        const input = document.getElementById('maya-input');
        const message = input?.value?.trim();
        if (!message) return;
        input.value = '';

        const profile = MayaUtils.storage.get('maya_profile') || {};
        const language = MayaUtils.storage.get('maya_language') || 'en';

        // Add user bubble
        this._addChatBubble('user', message);

        // Show typing indicator
        const typing = this._showTypingIndicator();

        // Blob thinking state
        if (window.MayaBlob) MayaBlob.startThinking();

        try {
            // Initialize AI if needed
            if (window.MayaAI && !MayaAI.userContext) {
                MayaAI.init({
                    fullName: profile.name,
                    birthDate: profile.birthDate,
                    birthTime: profile.birthTime,
                    birthPlace: profile.birthPlace,
                    birthLat: profile.birthLat,
                    birthLon: profile.birthLon,
                    gender: profile.gender,
                    language: language
                });
            }

            const response = await MayaAI.askMaya(message, {
                fullName: profile.name,
                birthDate: profile.birthDate,
                birthTime: profile.birthTime,
                birthPlace: profile.birthPlace,
                birthLat: profile.birthLat,
                birthLon: profile.birthLon,
                language: language
            });

            if (window.MayaBlob) MayaBlob.stopThinking();

            // Remove typing, add response bubble
            typing?.remove();
            this._addChatBubble('maya', response);

            // Speak response
            if (window.MayaVoice && !MayaVoice.isMuted) {
                await MayaVoice.speakStreaming(response);
            }

            // Save to chat history
            this.saveToChatHistory(message, response);

        } catch (error) {
            console.error('MAYA chat error:', error);
            if (window.MayaBlob) MayaBlob.stopThinking();
            typing?.remove();
            const errorMsg = language === 'hi'
                ? 'क्षमा करें, मुझे अभी कुछ समस्या हो रही है।'
                : 'I apologize, I\'m having some trouble right now.';
            this._addChatBubble('maya', errorMsg);
        }
    },

    /**
     * Add a chat bubble to the MAYA chat overlay.
     */
    _addChatBubble(role, text) {
        const container = document.getElementById('maya-chat-messages');
        if (!container) return;
        const bubble = document.createElement('div');
        bubble.className = `maya-chat-bubble maya-chat-bubble--${role}`;
        const content = document.createElement('div');
        content.className = 'maya-chat-bubble__content';
        content.textContent = text;
        bubble.appendChild(content);
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    },

    /**
     * Show a typing indicator in the chat.
     */
    _showTypingIndicator() {
        const container = document.getElementById('maya-chat-messages');
        if (!container) return null;
        const bubble = document.createElement('div');
        bubble.className = 'maya-chat-bubble maya-chat-bubble--maya maya-chat-bubble--typing';
        bubble.id = 'maya-typing-indicator';
        bubble.innerHTML = '<div class="maya-chat-bubble__content"><span class="maya-typing-dots"><span></span><span></span><span></span></span></div>';
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
        return bubble;
    },

    /**
     * Save chat to history
     */
    saveToChatHistory(question, answer) {
        if (!question || !answer) return;
        
        const chatHistory = MayaUtils.storage.get('maya_chat_history') || [];
        
        // Add new chat
        chatHistory.push({
            id: Date.now().toString(),
            question: question,
            answer: answer,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 chats
        if (chatHistory.length > 50) {
            chatHistory.shift();
        }
        
        MayaUtils.storage.set('maya_chat_history', chatHistory);
    },

            openMayaChatHistory() {
                this.hideMaya();

                document.querySelectorAll('.nav-link, .bottom-nav .nav-item').forEach(link => {
                    link.classList.remove('active');
                });
                document.querySelectorAll('[data-page="chat-history"]').forEach(link => {
                    link.classList.add('active');
                });

                if (window.MayaPages) {
                    MayaPages.render('chat-history');
                }
            },

    /**
     * Hide MAYA overlay
     */
    hideMaya() {
        const overlay = document.getElementById('maya-overlay');
        if (overlay) {
            overlay.classList.remove('show');
                    overlay.classList.remove('maya-overlay--chat');
        }
        
        // Clean up chat-mode on text display
        const textDisplay = document.getElementById('maya-text-display');
        if (textDisplay) {
            textDisplay.classList.remove('maya-chat-mode');
            textDisplay.innerHTML = '<p class="maya-speaking-text" id="maya-speaking-text"></p>';
        }
        
        // Stop voice
        if (window.MayaVoice) {
            MayaVoice.stop();
        }
        
        // Stop realtime connection
        if (window.MayaRealtime && MayaRealtime.isConnected) {
            MayaRealtime.stop();
        }
        
        // Stop listener
        if (window.MayaListener && MayaListener.isListening) {
            MayaListener.stop();
        }

        // Keep app state intact for normal chat closes. Only reset when closing an active funnel flow.
        if (overlay?.classList.contains('funnel-mode') || window.MayaFunnel?.isActive) {
            window.location.reload();
        }
    },

    /**
     * Generate MAYA reading
     */
    async generateMayaReading() {
        const textElement = document.getElementById('maya-speaking-text');
        const textDisplay = document.getElementById('maya-text-display');
        const profile = MayaUtils.storage.get('maya_profile');
        const language = MayaUtils.storage.get('maya_language') || 'en';
        
        if (!profile || !profile.birthDate) {
            if (textElement) {
                textElement.textContent = "I don't have your birth details yet. Let me help you set them up first.";
            }
            return;
        }

        // Scroll text display to top
        if (textDisplay) {
            textDisplay.scrollTop = 0;
        }

        // Show thinking state
        if (window.MayaBlob) {
            MayaBlob.startThinking();
        }
        
        if (textElement) {
            textElement.textContent = language === 'hi' ? "आपकी कॉस्मिक ऊर्जाओं को पढ़ रही हूँ..." : "Reading your cosmic energies...";
        }

        try {
            // Prepare user data with correct field names
            const userData = {
                fullName: profile.name,
                name: profile.name,
                birthDate: profile.birthDate,
                birthTime: profile.birthTime,
                birthPlace: profile.birthPlace,
                birthLat: profile.birthLat,
                birthLon: profile.birthLon,
                gender: profile.gender,
                language: language
            };
            
            const reading = await MayaAI.generateInitialReading(userData, true);
            
            if (window.MayaBlob) {
                MayaBlob.stopThinking();
            }

            // Display the reading
            if (textElement) {
                textElement.textContent = reading;
            }
            
            // Speak the reading (if voice is enabled)
            if (window.MayaVoice && !MayaVoice.isMuted) {
                MayaVoice.speak(reading);
            }
        } catch (error) {
            console.error('Reading generation error:', error);
            if (textElement) {
                const fallbackMsg = language === 'hi' 
                    ? 'रीडिंग अभी तैयार नहीं हो सकी। कृपया फिर से कोशिश करें।'
                    : 'The reading could not be generated right now. Please try again.';
                textElement.textContent = fallbackMsg;
            }
            if (window.MayaBlob) {
                MayaBlob.stopThinking();
            }
        }
    },

    /**
     * Show onboarding modal
     */
    showOnboarding() {
        console.log('🎭 showOnboarding called');
        this.isOnboardingActive = true;
        
        const modalEl = document.getElementById('onboardingModal');
        console.log('🎭 Modal element:', modalEl);
        
        if (!modalEl) {
            console.error('❌ Onboarding modal element not found!');
            return;
        }
        
        try {
            const modal = new bootstrap.Modal(modalEl, {
                backdrop: 'static',
                keyboard: false
            });
            
            console.log('🎭 Bootstrap modal created:', modal);
            modal.show();
            console.log('🎭 Modal.show() called');
            
            // Also add shown event listener
            modalEl.addEventListener('shown.bs.modal', () => {
                console.log('🎭 Modal shown event fired');
            });

            // Start onboarding flow after modal is shown
            setTimeout(() => {
                console.log('🎭 Starting onboarding flow...');
                console.log('🎭 MayaOnboarding exists:', !!window.MayaOnboarding);
                
                if (window.MayaOnboarding) {
                    MayaOnboarding.start();
                } else {
                    console.error('❌ MayaOnboarding not found!');
                }
            }, 500);
        } catch (error) {
            console.error('❌ Error creating/showing modal:', error);
        }
    },

    /**
     * Show auth modal
     */
    showAuthModal(type = 'login') {
        const modal = new bootstrap.Modal(document.getElementById('authModal'));
        
        // Show appropriate form
        if (type === 'login') {
            document.getElementById('loginFormContainer')?.classList.remove('d-none');
            document.getElementById('registerFormContainer')?.classList.add('d-none');
        } else {
            document.getElementById('loginFormContainer')?.classList.add('d-none');
            document.getElementById('registerFormContainer')?.classList.remove('d-none');
        }
        
        modal.show();
    },

    /**
     * Hide auth modal
     */
    hideAuthModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        modal?.hide();
    },

    /**
     * Show teaser (funnel step before email gate)
     */
    async showTeaser() {
        const profile = MayaUtils.storage.get('maya_profile');
        if (!profile) return;

        this.showMaya();
        
        const textElement = document.querySelector('.maya-text');
        const lang = MayaUtils.storage.get('maya_language') || profile.language || 'en';
        const firstName = String(profile.name || '').trim().split(/\s+/)[0] || 'friend';
        const numerology = {
            lifePath: MayaNumerology.calculateLifePath(profile.birthDate),
            destiny: MayaNumerology.calculateDestinyNumber(profile.name || ''),
            personalYear: MayaNumerology.calculatePersonalYear(profile.birthDate)
        };

        let teaserText = '';

        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        try {
            if (window.MayaStatements?.getTeaserHook) {
                teaserText = await MayaStatements.getTeaserHook(firstName, {
                    lifePath: numerology.lifePath,
                    destiny: numerology.destiny,
                    personalYear: numerology.personalYear,
                    predictionItems: []
                }, {
                    userData: {
                        gender: profile.gender || '',
                        birthPlaceShort: (profile.birthPlace || '').split(',')[0].trim()
                    }
                });
            }
        } catch (error) {
            console.warn('AI teaser hook failed:', error.message);
        }
        
        if (textElement) {
            if (teaserText && window.MayaVoice) {
                MayaVoice.speakWithDisplay(teaserText, textElement);
            } else if (teaserText) {
                textElement.textContent = teaserText;
            } else {
                textElement.textContent = '';
            }
        }

        // Show email capture form
        document.getElementById('mayaEmailCapture')?.classList.remove('d-none');
    },

    /**
     * Hide teaser
     */
    hideTeaser() {
        document.getElementById('mayaEmailCapture')?.classList.add('d-none');
    },

    /**
     * Show full reading after email capture
     */
    async showFullReading() {
        const profile = MayaUtils.storage.get('maya_profile');
        if (!profile) return;

        await this.generateMayaReading();
    },

    /**
     * Show initial reading after onboarding
     */
    async showInitialReading() {
        console.log('📖 showInitialReading called');
        this.isOnboardingActive = false;
        
        try {
            // Show main app container
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.classList.remove('d-none');
            }
            
            // Render home first (with error handling)
            if (window.MayaPages) {
                console.log('📖 Rendering home page...');
                try {
                    await MayaPages.render('home');
                } catch (e) {
                    console.error('Home page render error:', e);
                }
            }
            
            // Then show MAYA with reading after delay
            setTimeout(() => {
                console.log('📖 Showing MAYA overlay for initial reading...');
                this.showMaya();
            }, 800);
        } catch (error) {
            console.error('Error in showInitialReading:', error);
            // Still try to show MAYA even if home page fails
            setTimeout(() => {
                this.showMaya();
            }, 500);
        }
    },

    /**
     * Navigate to page
     */
    navigateTo(pageId) {
        // Update active states
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll(`[data-page="${pageId}"]`).forEach(l => l.classList.add('active'));
        
        MayaPages.render(pageId);
    }
};

console.log('🔧 app.js loaded, setting up DOMContentLoaded listener...');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOMContentLoaded fired!');
    MayaApp.init();
});

// Also try immediate init if DOM already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('📄 DOM already ready, initializing immediately...');
    setTimeout(() => MayaApp.init(), 1);
}

// Make globally available
window.MayaApp = MayaApp;
