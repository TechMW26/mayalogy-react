/**
 * MAYA - Pages Module
 * Dynamic Page Rendering for All Menu Items
 * Redesigned with consistent, modern UI
 */

const MayaPages = {
    currentPage: 'home',

    // Centralized horoscope cache manager to prevent duplicate requests
    _horoscopeCache: {
        pending: null, // Promise for in-flight request
        data: null,    // Cached horoscope data
        date: null     // Date of cached data
    },

    /**
     * Get user email for Firebase operations
     */
    _getUserEmail() {
        const session = MayaUtils.storage.get('maya_session');
        return session?.email || null;
    },

    /**
     * Get today's date in local timezone (YYYY-MM-DD format)
     */
    _getLocalDate() {
        return this._formatLocalDateKey(new Date());
    },

    _formatLocalDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get or generate daily guidance plan
     * - Fetches from Firebase DB using today's date as key
     * - If data exists for today, use it (no regeneration)
     * - Only generates if no data exists for today
     */
    async getDailyHoroscope() {
        const today = this._getLocalDate();
        const email = this._getUserEmail();

        if (!this._lastHoroscopeCall) {
            this._lastHoroscopeCall = 0;
        }

        const now = Date.now();
        if (now - this._lastHoroscopeCall < 500) {
            console.warn('⚠️ getDailyHoroscope called too frequently!');
            return this._horoscopeCache.data || { text: 'Loading...' };
        }
        this._lastHoroscopeCall = now;

        console.log('📅 Horoscope: Today is', today);

        if (this._horoscopeCache.pending) {
            console.log('📅 Horoscope: Waiting for in-flight request');
            return await this._horoscopeCache.pending;
        }

        if (this._horoscopeCache.date === today && this._horoscopeCache.data) {
            console.log('📅 Horoscope: ✅ Using memory cache (no DB call)');
            return this._horoscopeCache.data;
        }

        if (email && window.MayaFirebase) {
            try {
                console.log('📅 Horoscope: Fetching from DB for', today);
                const fbResult = await MayaFirebase.getDailyHoroscope(email, today);
                if (fbResult.success && fbResult.horoscope && fbResult.horoscope.text) {
                    console.log('📅 Horoscope: ✅ Found in DB! Using saved horoscope');
                    fbResult.horoscope.date = today;
                    this._horoscopeCache.data = fbResult.horoscope;
                    this._horoscopeCache.date = today;
                    return fbResult.horoscope;
                }
            } catch (error) {
                console.warn('Firebase horoscope fetch failed:', error);
            }
        }

        console.log('📅 Horoscope: 🔄 Generating NEW horoscope for', today);
        this._horoscopeCache.pending = this._generateHoroscope(today);

        try {
            const result = await this._horoscopeCache.pending;
            this._horoscopeCache.data = result;
            this._horoscopeCache.date = today;
            return result;
        } finally {
            this._horoscopeCache.pending = null;
        }
    },

    /**
     * Generate new horoscope and save to Firebase with date
     */
    async _generateHoroscope(today) {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const zodiac = profile.birthDate ? MayaAstrology?.getZodiac(profile.birthDate, profile) : null;

        const skeleton = document.getElementById('dailyInsightSkeleton');
        const insightText = document.getElementById('dailyInsight');
        if (skeleton) skeleton.style.display = 'block';
        if (insightText) insightText.style.display = 'none';

        if (!zodiac) {
            this._hideInsightSkeleton();
            return { date: today, zodiac: null, text: this._getDefaultHoroscope(null), isAI: false };
        }

        if (window.MayaHoroscopeAPI) {
            try {
                console.log('📅 Horoscope: Trying free horoscope API for', zodiac.name);
                const horoscope = await MayaHoroscopeAPI.getPersonalizedHoroscope(profile, zodiac.name);
                if (horoscope && horoscope.combined) {
                    console.log('📅 Horoscope: ✅ Free API succeeded!');
                    const result = {
                        date: today,
                        zodiac: zodiac.name,
                        text: horoscope.combined,
                        personalDay: horoscope.personalDay,
                        source: horoscope.source,
                        isAI: horoscope.source === 'ai-personalized'
                    };

                    const userEmail = this._getUserEmail();
                    if (userEmail && window.MayaFirebase) {
                        MayaFirebase.saveDailyHoroscope(userEmail, result).catch(() => { });
                    }

                    this._hideInsightSkeleton();
                    return result;
                }
            } catch (error) {
                console.warn('📅 Horoscope: Free API failed, trying AI fallback:', error.message);
            }
        }

        if (window.MayaAI) {
            const errorPhrases = ['i apologize', 'trouble connecting', 'try again later', 'having trouble', 'something went wrong'];
            const isError = (text) => !text || text.length < 100 || errorPhrases.some((phrase) => text.toLowerCase().includes(phrase));

            try {
                const response = await MayaAI.generateDailyHoroscope({
                    fullName: profile.name || 'Friend',
                    birthDate: profile.birthDate,
                    birthTime: profile.birthTime,
                    birthPlace: profile.birthPlace,
                    birthLat: profile.birthLat,
                    birthLon: profile.birthLon,
                    language: MayaUtils.storage.get('maya_language') || 'en'
                });

                if (!isError(response)) {
                    const result = { date: today, zodiac: zodiac.name, text: response, isAI: true, source: 'ai' };
                    const userEmail = this._getUserEmail();
                    if (userEmail && window.MayaFirebase) {
                        MayaFirebase.saveDailyHoroscope(userEmail, result).catch(() => { });
                    }

                    this._hideInsightSkeleton();
                    return result;
                }
            } catch (error) {
                console.warn('📅 Horoscope: AI generation also failed', error);
            }
        }

        this._hideInsightSkeleton();
        return { date: today, zodiac: zodiac.name, text: this._getDefaultHoroscope(zodiac.name), isAI: false, source: 'unavailable' };
    },

    /**
     * Hide insight skeleton and show the text
     */
    _hideInsightSkeleton() {
        const skeleton = document.getElementById('dailyInsightSkeleton');
        const insightText = document.getElementById('dailyInsight');
        if (skeleton) skeleton.style.display = 'none';
        if (insightText) insightText.style.display = 'block';
    },

    /**
     * Get default horoscope text
     */
    _getDefaultHoroscope(signName) {
        const isHindi = false; // UI always English
        return isHindi
            ? 'आज का AI horoscope अभी उपलब्ध नहीं है। कृपया थोड़ी देर में फिर कोशिश करें।'
            : 'Today\'s AI horoscope is unavailable right now. Please try again in a moment.';
    },

    /**
     * Update active navigation state in sidebar and bottom nav
     */
    updateActiveNav(pageId) {
        // Remove active from all nav items
        document.querySelectorAll('.sidebar-nav .nav-link, .bottom-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active to matching nav items
        document.querySelectorAll(`[data-page="${pageId}"]`).forEach(item => {
            item.classList.add('active');
        });

        // Special case: settings page maps to profile button in bottom nav
        if (pageId === 'settings' || pageId === 'profile') {
            document.querySelectorAll('[data-page="settings"], [data-page="profile"]').forEach(item => {
                item.classList.add('active');
            });
        }
    },

    /**
     * Get skeleton loader HTML for different page types
     */
    getSkeleton(type = 'default') {
        const skeletons = {
            home: `
                <div class="maya-page maya-page--loading">
                    <div class="maya-page__header">
                        <div class="skeleton-text" style="width: 60%; height: 28px;"></div>
                        <div class="skeleton-text" style="width: 40%; height: 16px; margin-top: 8px;"></div>
                    </div>
                    <div class="row g-3 mb-4">
                        <div class="col-6"><div class="skeleton-card" style="height: 90px; border-radius: 16px;"></div></div>
                        <div class="col-6"><div class="skeleton-card" style="height: 90px; border-radius: 16px;"></div></div>
                    </div>
                    <div class="skeleton-card mb-4" style="height: 140px; border-radius: 20px;"></div>
                    <div class="skeleton-text mb-3" style="width: 35%; height: 20px;"></div>
                    <div class="row g-3">
                        <div class="col-4"><div class="skeleton-card" style="height: 85px; border-radius: 14px;"></div></div>
                        <div class="col-4"><div class="skeleton-card" style="height: 85px; border-radius: 14px;"></div></div>
                        <div class="col-4"><div class="skeleton-card" style="height: 85px; border-radius: 14px;"></div></div>
                    </div>
                </div>
            `,
            horoscope: `
                <div class="maya-page maya-page--loading">
                    <div class="maya-page__header">
                        <div class="skeleton-text" style="width: 50%; height: 28px;"></div>
                        <div class="skeleton-text" style="width: 35%; height: 16px; margin-top: 8px;"></div>
                    </div>
                    <div class="skeleton-card mb-4" style="height: 160px; max-width: 220px; border-radius: 20px;"></div>
                    <div class="skeleton-card mb-4" style="height: 120px; border-radius: 16px;"></div>
                    <div class="row g-3">
                        <div class="col-4"><div class="skeleton-card" style="height: 95px; border-radius: 14px;"></div></div>
                        <div class="col-4"><div class="skeleton-card" style="height: 95px; border-radius: 14px;"></div></div>
                        <div class="col-4"><div class="skeleton-card" style="height: 95px; border-radius: 14px;"></div></div>
                    </div>
                </div>
            `,
            chat: `
                <div class="maya-page maya-page--loading maya-chat-skeleton">
                    <div class="skeleton-card mb-3" style="height: 60px; border-radius: 14px; width: 70%;"></div>
                    <div class="skeleton-card mb-3" style="height: 50px; border-radius: 14px; width: 60%; margin-left: auto;"></div>
                    <div class="skeleton-card mb-3" style="height: 70px; border-radius: 14px; width: 75%;"></div>
                </div>
            `,
            default: `
                <div class="maya-page maya-page--loading">
                    <div class="maya-page__header">
                        <div class="skeleton-text" style="width: 50%; height: 28px;"></div>
                        <div class="skeleton-text" style="width: 70%; height: 16px; margin-top: 8px;"></div>
                    </div>
                    <div class="skeleton-card mb-4" style="height: 160px; border-radius: 16px;"></div>
                    <div class="skeleton-card" style="height: 120px; border-radius: 16px;"></div>
                </div>
            `
        };
        return skeletons[type] || skeletons.default;
    },

    /**
     * Render page content
     */
    async render(pageId) {
        this.currentPage = pageId;
        const content = document.getElementById('main-content');
        if (!content) {
            console.error('Main content element not found!');
            return;
        }

        window.scrollTo(0, 0);
        content.scrollTop = 0;
        this.updateActiveNav(pageId);

        const skeletonType = ['home'].includes(pageId)
            ? 'home'
            : ['horoscope'].includes(pageId)
                ? 'horoscope'
                : ['chat'].includes(pageId)
                    ? 'chat'
                    : 'default';
        content.innerHTML = this.getSkeleton(skeletonType);

        const profile = MayaUtils.storage.get('maya_profile') || {};
        const isHindi = false; // UI always English

        try {
            let pageContent = '';

            switch (pageId) {
                case 'home':
                    pageContent = this.renderHome(profile, isHindi);
                    break;
                case 'journal':
                    pageContent = this.renderJournal(profile, isHindi);
                    break;
                case 'kundli':
                    pageContent = await MayaKundli.renderKundliPage(profile, isHindi);
                    break;
                case 'compatibility':
                    pageContent = this.renderCompatibility(profile, isHindi);
                    break;
                case 'numerology':
                    pageContent = MayaNumerology.renderNumerologyPage(profile, isHindi);
                    break;
                case 'horoscope':
                    pageContent = await this.renderDailyHoroscope(profile, isHindi);
                    break;
                case 'chat':
                    pageContent = this.renderChat(isHindi);
                    break;
                case 'chat-history':
                    pageContent = this.renderChatHistory(isHindi);
                    break;
                case 'panchang':
                    pageContent = this.renderPanchang(isHindi);
                    break;
                case 'remedies':
                    pageContent = this.renderRemedies(profile, isHindi);
                    break;
                case 'muhurat':
                    pageContent = this.renderMuhurat(isHindi);
                    break;
                case 'spiritual-music':
                    pageContent = this.renderSpiritualMusic(profile, isHindi);
                    break;
                case 'vastu':
                    pageContent = this.renderVastu(isHindi);
                    break;
                case 'palm-reading':
                    pageContent = this.renderPalmReading(isHindi);
                    break;
                case 'profile':
                    pageContent = this.renderProfile(profile, isHindi);
                    break;
                case 'settings':
                    pageContent = this.renderSettings(isHindi);
                    break;
                default:
                    pageContent = this.renderHome(profile, isHindi);
            }

            content.innerHTML = pageContent;
        } catch (error) {
            console.error('Error rendering page:', pageId, error);
            content.innerHTML = `
                <div class="maya-page maya-page--error">
                    <div class="maya-error-state">
                        <div class="maya-error-state__icon">
                            <i class="bi bi-exclamation-triangle"></i>
                        </div>
                        <h5 class="maya-error-state__title">Something went wrong</h5>
                        <p class="maya-error-state__text">We couldn't load this page. Please try again.</p>
                        <button class="maya-btn maya-btn--primary" onclick="MayaPages.render('${pageId}')">
                            <i class="bi bi-arrow-clockwise"></i>
                            <span>Try Again</span>
                        </button>
                    </div>
                </div>
            `;
        }

        this.initPageScripts(pageId);
    },

    /**
     * Render Home page
     */
    renderHome(profile, isHindi) {
        const t = (text) => window.MayaI18n?.translateSync ? MayaI18n.translateSync(text, isHindi ? 'hi' : 'en') : text;
        let zodiac = null;
        let lifePath = null;
        let lifePathMeaning = null;

        try {
            if (profile && profile.birthDate && window.MayaAstrology) {
                zodiac = MayaAstrology.getZodiac(profile.birthDate, profile);
            }
        } catch (error) {
            console.error('Error getting zodiac:', error);
        }

        try {
            if (profile && profile.birthDate && window.MayaNumerology) {
                lifePath = MayaNumerology.calculateLifePath(profile.birthDate);
                const meaning = MayaNumerology.getNumberMeaning(lifePath, 'lifePath');
                lifePathMeaning = meaning?.title || this.getLifePathTitle(lifePath);
            }
        } catch (error) {
            console.error('Error getting numerology:', error);
        }

        const greeting = this.getGreeting();
        const userName = profile?.name?.split(' ')[0] || t('Friend');
        const formattedDate = new Date().toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const zodiacSystem = MayaAstrology?.getZodiacSystem?.() || 'western';
        const journalEntries = this.getJournalEntries();
        const todayJournal = this.getTodayJournalEntry();
        const journalStreak = this.getJournalStreak(journalEntries);
        const dailyPractice = this.getDailyPractice(profile, isHindi);
        const homeLabels = {
            moonSign: zodiacSystem === 'vedic' ? t('Moon Sign') : t('Sun Sign'),
            unknown: t('Unknown'),
            lifePath: t('Life Path'),
            calculate: t('Calculate'),
            journal: isHindi ? 'जर्नल' : 'Journal',
            journalDone: isHindi ? 'आज पूरा' : 'Done today',
            journalOpen: isHindi ? 'आज लिखें' : 'Open today',
            streak: isHindi ? 'अभ्यास श्रृंखला' : 'Practice Streak',
            dayUnit: isHindi ? 'दिन' : 'days',
            todayMessage: isHindi ? 'आज की अभ्यास योजना' : "Today's Practice Plan",
            openJournal: isHindi ? 'जर्नल खोलें' : 'Open Journal',
            readFullHoroscope: isHindi ? 'दैनिक योजना देखें' : 'Open Daily Plan',
            speedDial: isHindi ? 'कार्य उपकरण' : 'Action Tools',
            askMaya: t('Ask MAYA'),
            fullReading: isHindi ? 'आज की योजना MAYA से बनवाएं' : "Build Today's Plan with MAYA",
            fullReadingText: isHindi ? 'अपने जर्नल, समय और प्रोफाइल संकेतों को एक स्पष्ट अगले कदम में बदलें।' : 'Turn your journal, timing, and profile signals into one practical next step.',
            startReading: isHindi ? 'MAYA खोलें' : 'Open MAYA',
            luckyElements: isHindi ? 'प्रोफाइल संकेत' : 'Profile Signals',
            luckyColor: isHindi ? 'रंग संकेत' : 'Color Cue',
            luckyNumbers: isHindi ? 'संख्या संकेत' : 'Number Cue',
            luckyDay: isHindi ? 'दिन संकेत' : 'Day Cue',
            gemstone: isHindi ? 'रत्न संकेत' : 'Gem Cue'
        };
        const localizedLifePathMeaning = t(lifePathMeaning || 'Calculate');
        const localizedMoonSign = zodiac?.name ? t(zodiac.name) : homeLabels.unknown;
        const localizedLuckyDay = zodiac?.luckyDay ? t(zodiac.luckyDay) : (isHindi ? 'शुक्रवार' : 'Friday');

        return `
            <div class="maya-page maya-home">
                <!-- Welcome Header -->
                <div class="maya-home__header">
                    <div class="maya-home__greeting">
                        <span class="maya-home__greeting-text">${greeting},</span>
                        <h2 class="maya-home__name">${userName}</h2>
                    </div>
                    <div class="maya-home__date">
                        <i class="bi bi-calendar3"></i>
                        ${formattedDate}
                    </div>
                </div>

                <!-- Today's Message Card -->
                <div class="maya-insight-card">
                    <div class="maya-insight-card__header">
                        <span>${homeLabels.todayMessage}</span>
                    </div>
                    <div id="dailyInsightSkeleton" class="maya-insight-skeleton" style="display: none;">
                        <div class="skeleton-text" style="width: 100%; height: 1rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton-text" style="width: 95%; height: 1rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton-text" style="width: 85%; height: 1rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton-text" style="width: 70%; height: 1rem;"></div>
                    </div>
                    <p class="maya-insight-card__text" id="dailyInsight" style="display: block;">${this._escapeHtml(dailyPractice.summary)}</p>
                    <div class="maya-insight-card__footer">
                        <button class="maya-btn maya-btn--primary maya-btn--sm" data-page="horoscope">
                            ${homeLabels.readFullHoroscope}
                            <i class="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>

                <div class="maya-practice-panel">
                    ${dailyPractice.steps.map(step => `
                        <div class="maya-practice-step">
                            <div class="maya-practice-step__icon"><i class="bi ${step.icon}"></i></div>
                            <div class="maya-practice-step__body">
                                <span class="maya-practice-step__label">${step.label}</span>
                                <strong>${step.title}</strong>
                                <p>${step.text}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Quick Actions Grid (Speed Dial) -->
                <div class="maya-section">
                    <h3 class="maya-section__title">
                        <i class="bi bi-grid-3x3-gap"></i>
                        ${homeLabels.speedDial}
                    </h3>
                    <div class="maya-action-grid">
                        <a href="#" class="maya-action-tile maya-action-tile--highlight" data-action="showMaya">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-chat-heart"></i>
                            </div>
                            <span class="maya-action-tile__label">${homeLabels.askMaya}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="vastu">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-compass"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'वास्तु स्कैन' : 'Vastu Scan'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="horoscope">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-signpost-split"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'दैनिक योजना' : 'Daily Plan'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="kundli">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-diagram-3"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'लाइफ मैप' : 'Life Map'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="compatibility">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-heart"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'रिलेशन' : 'Relation'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="numerology">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-123"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'पैटर्न' : 'Patterns'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="panchang">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-calendar-week"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'समय' : 'Timing'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="palm-reading">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-hand-index"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'हैंड स्कैन' : 'Hand Scan'}</span>
                        </a>
                        <a href="#" class="maya-action-tile" data-page="spiritual-music">
                            <div class="maya-action-tile__icon">
                                <i class="bi bi-music-note-beamed"></i>
                            </div>
                            <span class="maya-action-tile__label">${isHindi ? 'संगीत' : 'Music'}</span>
                        </a>
                    </div>
                </div>

                <!-- Featured CTA -->
                <div class="maya-cta-card">
                    <div class="maya-cta-card__bg"></div>
                    <div class="maya-cta-card__content">
                        <h4 class="maya-cta-card__title">${homeLabels.fullReading}</h4>
                        <p class="maya-cta-card__text">${homeLabels.fullReadingText}</p>
                        <button class="maya-btn maya-btn--sm" id="getFullReading" style="background: white; color: #1a1a2e; font-weight: 600;">
                            ${homeLabels.startReading}
                            <i class="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>

                ${zodiac ? `
                <!-- Lucky Elements -->
                <div class="maya-section">
                    <h3 class="maya-section__title">
                        <i class="bi bi-gem"></i>
                        ${homeLabels.luckyElements}
                    </h3>
                    <div class="maya-lucky-cards">
                        <div class="maya-lucky-card" data-lucky-type="color" data-lucky-value="${zodiac.color || '#6366f1'}" data-lucky-name="${zodiac.colorName || 'Indigo'}">
                            <div class="maya-lucky-card__icon-wrap">
                                <div class="maya-lucky-card__color" style="background: ${zodiac.color || '#6366f1'}; box-shadow: 0 0 20px ${zodiac.color || '#6366f1'}80;"></div>
                            </div>
                            <div class="maya-lucky-card__content">
                                <span class="maya-lucky-card__value">${zodiac.colorName || 'Indigo'}</span>
                                <span class="maya-lucky-card__label">${homeLabels.luckyColor}</span>
                            </div>
                            <i class="bi bi-chevron-right maya-lucky-card__arrow"></i>
                        </div>
                        <div class="maya-lucky-card" data-lucky-type="number" data-lucky-value="${zodiac.luckyNumbers?.join(', ') || '2, 7'}">
                            <div class="maya-lucky-card__icon-wrap">
                                <span class="maya-lucky-card__number">${zodiac.luckyNumbers?.[0] || '2'}</span>
                            </div>
                            <div class="maya-lucky-card__content">
                                <span class="maya-lucky-card__value">${zodiac.luckyNumbers?.join(', ') || '2, 7'}</span>
                                <span class="maya-lucky-card__label">${homeLabels.luckyNumbers}</span>
                            </div>
                            <i class="bi bi-chevron-right maya-lucky-card__arrow"></i>
                        </div>
                        <div class="maya-lucky-card" data-lucky-type="day" data-lucky-value="${localizedLuckyDay}">
                            <div class="maya-lucky-card__icon-wrap">
                                <i class="bi bi-calendar-week"></i>
                            </div>
                            <div class="maya-lucky-card__content">
                                <span class="maya-lucky-card__value">${localizedLuckyDay}</span>
                                <span class="maya-lucky-card__label">${homeLabels.luckyDay}</span>
                            </div>
                            <i class="bi bi-chevron-right maya-lucky-card__arrow"></i>
                        </div>
                        <div class="maya-lucky-card" data-lucky-type="gemstone" data-lucky-value="${zodiac.gemstone || 'Emerald'}">
                            <div class="maya-lucky-card__icon-wrap">
                                <img src="images/gemstones/${(zodiac.gemstone || 'emerald').toLowerCase().replace(/\s+/g, '-')}.png" alt="${zodiac.gemstone || 'Emerald'}" class="maya-lucky-card__gem-img" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'bi bi-gem\'></i>'">
                            </div>
                            <div class="maya-lucky-card__content">
                                <span class="maya-lucky-card__value">${zodiac.gemstone || 'Emerald'}</span>
                                <span class="maya-lucky-card__label">${homeLabels.gemstone}</span>
                            </div>
                            <i class="bi bi-chevron-right maya-lucky-card__arrow"></i>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },

    _escapeHtml(value) {
        const entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return String(value ?? '').replace(/[&<>"']/g, (char) => entityMap[char]);
    },

    getJournalEntries() {
        const entries = MayaUtils.storage.get('maya_journal_entries') || [];
        return Array.isArray(entries) ? entries : [];
    },

    getTodayJournalEntry() {
        const today = this._getLocalDate();
        return this.getJournalEntries().find((entry) => entry.date === today) || null;
    },

    getJournalStreak(entries = this.getJournalEntries()) {
        const dateSet = new Set(entries.map((entry) => entry.date).filter(Boolean));
        const cursor = new Date();
        let streak = 0;

        while (dateSet.has(this._formatLocalDateKey(cursor))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return streak;
    },

    getDailyPractice(profile, isHindi) {
        const todayJournal = this.getTodayJournalEntry();
        const firstName = profile?.name?.split(' ')[0] || (isHindi ? 'मित्र' : 'Friend');
        const focusLabels = {
            clarity: { en: 'clarity', hi: 'स्पष्टता' },
            relationships: { en: 'relationships', hi: 'रिश्ते' },
            work: { en: 'work', hi: 'काम' },
            wellness: { en: 'wellness', hi: 'सेहत' },
            home: { en: 'home energy', hi: 'घर की ऊर्जा' }
        };
        const focus = todayJournal?.focus || 'clarity';
        const focusLabel = focusLabels[focus] || focusLabels.clarity;
        const localizedFocus = isHindi ? focusLabel.hi : focusLabel.en;

        return {
            summary: isHindi
                ? `${firstName}, आज ${localizedFocus} पर ध्यान दें। एक ईमानदार नोट लिखें, एक छोटा कदम चुनें, और शाम को देखें कि उससे क्या बदला।`
                : `${firstName}, focus on ${localizedFocus} today. Write one honest note, choose one small next step, and check what changed by evening.`,
            steps: [
                {
                    icon: 'bi-sunrise',
                    label: isHindi ? 'सुबह' : 'Morning',
                    title: isHindi ? 'इरादा सेट करें' : 'Set an intention',
                    text: isHindi ? 'आज किस बात को सरल बनाना है, उसे एक वाक्य में लिखें।' : 'Write the one thing you want to make simpler today.'
                },
                {
                    icon: 'bi-journal-text',
                    label: isHindi ? 'दिन में' : 'Midday',
                    title: isHindi ? 'जर्नल चेक-इन' : 'Journal check-in',
                    text: isHindi ? 'मूड, फोकस और एक व्यवहारिक अगले कदम को सेव करें।' : 'Save your mood, focus, and one practical next action.'
                },
                {
                    icon: 'bi-moon-stars',
                    label: isHindi ? 'शाम' : 'Evening',
                    title: isHindi ? 'प्रतिबिंब' : 'Reflect',
                    text: isHindi ? 'MAYA से पूछें कि आज के नोट से कल की योजना कैसे बने।' : 'Ask MAYA to turn today\'s note into tomorrow\'s plan.'
                }
            ]
        };
    },

    renderJournal(profile, isHindi) {
        const today = this._getLocalDate();
        const entries = this.getJournalEntries();
        const todayEntry = this.getTodayJournalEntry();
        const streak = this.getJournalStreak(entries);
        const practice = this.getDailyPractice(profile, isHindi);
        const firstName = profile?.name?.split(' ')[0] || (isHindi ? 'मित्र' : 'Friend');
        const moodOptions = [
            { value: 'calm', label: isHindi ? 'शांत' : 'Calm', icon: 'bi-water' },
            { value: 'steady', label: isHindi ? 'स्थिर' : 'Steady', icon: 'bi-activity' },
            { value: 'heavy', label: isHindi ? 'भारी' : 'Heavy', icon: 'bi-cloud' },
            { value: 'bright', label: isHindi ? 'उत्साहित' : 'Bright', icon: 'bi-brightness-high' }
        ];
        const focusOptions = [
            { value: 'clarity', label: isHindi ? 'स्पष्टता' : 'Clarity', icon: 'bi-eye' },
            { value: 'relationships', label: isHindi ? 'रिश्ते' : 'Relationships', icon: 'bi-people' },
            { value: 'work', label: isHindi ? 'काम' : 'Work', icon: 'bi-briefcase' },
            { value: 'wellness', label: isHindi ? 'सेहत' : 'Wellness', icon: 'bi-heart-pulse' },
            { value: 'home', label: isHindi ? 'घर' : 'Home', icon: 'bi-house-heart' }
        ];
        const selectedMood = todayEntry?.mood || 'steady';
        const selectedFocus = todayEntry?.focus || 'clarity';
        const sortedEntries = [...entries].sort((firstEntry, secondEntry) => (secondEntry.date || '').localeCompare(firstEntry.date || ''));
        const historyHtml = sortedEntries.length ? sortedEntries.slice(0, 10).map((entry) => {
            const mood = moodOptions.find((option) => option.value === entry.mood)?.label || entry.mood || '';
            const focus = focusOptions.find((option) => option.value === entry.focus)?.label || entry.focus || '';
            return `
                <div class="maya-journal-entry">
                    <div class="maya-journal-entry__meta">
                        <span>${this._escapeHtml(entry.date)}</span>
                        <span>${this._escapeHtml(mood)} - ${this._escapeHtml(focus)}</span>
                    </div>
                    ${entry.intention ? `<strong>${this._escapeHtml(entry.intention)}</strong>` : ''}
                    ${entry.reflection ? `<p>${this._escapeHtml(entry.reflection)}</p>` : ''}
                </div>
            `;
        }).join('') : `
            <div class="maya-empty-state maya-empty-state--compact">
                <div class="maya-empty-state__icon"><i class="bi bi-journal-plus"></i></div>
                <h4>${isHindi ? 'पहली एंट्री लिखें' : 'Write your first entry'}</h4>
                <p>${isHindi ? 'आपकी दैनिक योजना और बातचीत यहां से बेहतर होती जाएगी।' : 'Your daily plan and MAYA coaching will become more useful from here.'}</p>
            </div>
        `;

        return `
            <div class="maya-page maya-journal-page">
                <div class="maya-page__header">
                    <h2 class="maya-page__title">${isHindi ? 'Maya Journal' : 'Maya Journal'}</h2>
                    <p class="maya-page__subtitle">${isHindi ? `${firstName}, हर दिन एक छोटा नोट, एक साफ इरादा, और एक व्यवहारिक कदम।` : `${firstName}, one daily note, one clear intention, and one practical step.`}</p>
                </div>

                <div class="maya-journal-summary">
                    <div class="maya-journal-summary__item">
                        <span>${isHindi ? 'आज' : 'Today'}</span>
                        <strong>${todayEntry ? (isHindi ? 'पूरा' : 'Complete') : (isHindi ? 'बाकी' : 'Open')}</strong>
                    </div>
                    <div class="maya-journal-summary__item">
                        <span>${isHindi ? 'श्रृंखला' : 'Streak'}</span>
                        <strong>${streak} ${isHindi ? 'दिन' : 'days'}</strong>
                    </div>
                    <div class="maya-journal-summary__item">
                        <span>${isHindi ? 'फोकस' : 'Focus'}</span>
                        <strong>${focusOptions.find((option) => option.value === selectedFocus)?.label || 'Clarity'}</strong>
                    </div>
                </div>

                <div class="maya-journal-plan">
                    <div class="maya-journal-plan__icon"><i class="bi bi-signpost-split"></i></div>
                    <div>
                        <span>${isHindi ? 'आज की योजना' : "Today's Plan"}</span>
                        <p>${this._escapeHtml(practice.summary)}</p>
                    </div>
                </div>

                <div class="maya-journal-card">
                    <input type="hidden" id="journalDate" value="${today}">

                    <div class="maya-journal-field">
                        <label>${isHindi ? 'मूड' : 'Mood'}</label>
                        <div class="maya-journal-chips" id="journalMoodChips">
                            ${moodOptions.map((option) => `
                                <button type="button" class="maya-journal-chip ${option.value === selectedMood ? 'active' : ''}" data-journal-mood="${option.value}">
                                    <i class="bi ${option.icon}"></i>
                                    <span>${option.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="maya-journal-field">
                        <label>${isHindi ? 'फोकस' : 'Focus'}</label>
                        <div class="maya-journal-chips maya-journal-chips--wrap" id="journalFocusChips">
                            ${focusOptions.map((option) => `
                                <button type="button" class="maya-journal-chip ${option.value === selectedFocus ? 'active' : ''}" data-journal-focus="${option.value}">
                                    <i class="bi ${option.icon}"></i>
                                    <span>${option.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="maya-journal-field">
                        <label for="journalIntention">${isHindi ? 'आज का इरादा' : "Today's intention"}</label>
                        <input type="text" class="maya-input" id="journalIntention" value="${this._escapeHtml(todayEntry?.intention || '')}" placeholder="${isHindi ? 'एक छोटा व्यवहारिक कदम' : 'One small practical step'}">
                    </div>

                    <div class="maya-journal-field">
                        <label for="journalReflection">${isHindi ? 'प्रतिबिंब' : 'Reflection'}</label>
                        <textarea class="maya-input maya-journal-textarea" id="journalReflection" rows="5" placeholder="${isHindi ? 'आज मन में क्या चल रहा है?' : 'What is moving through your mind today?'}">${this._escapeHtml(todayEntry?.reflection || '')}</textarea>
                    </div>

                    <div class="maya-journal-actions">
                        <button type="button" class="maya-btn maya-btn--primary" id="saveJournalEntry">
                            <i class="bi bi-check2-circle"></i>
                            <span>${isHindi ? 'जर्नल सेव करें' : 'Save Journal'}</span>
                        </button>
                        <button type="button" class="maya-btn maya-btn--outline" id="coachJournalBtn">
                            <i class="bi bi-chat-heart"></i>
                            <span>${isHindi ? 'MAYA से कोचिंग लें' : 'Coach with MAYA'}</span>
                        </button>
                    </div>
                </div>

                <div class="maya-section">
                    <h3 class="maya-section__title">
                        <i class="bi bi-clock-history"></i>
                        ${isHindi ? 'जर्नल इतिहास' : 'Journal History'}
                    </h3>
                    <div class="maya-journal-history">
                        ${historyHtml}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get time-based greeting
     */
    getGreeting() {
        const hour = new Date().getHours();
        const isHindi = false; // UI always English
        if (hour < 12) return isHindi ? 'नमस्ते' : 'Good morning';
        if (hour < 17) return isHindi ? 'नमस्ते' : 'Good afternoon';
        return isHindi ? 'नमस्ते' : 'Good evening';
    },

    /**
     * Get Life Path title by number
     */
    getLifePathTitle(num) {
        const titles = {
            1: 'The Leader',
            2: 'The Peacemaker',
            3: 'The Communicator',
            4: 'The Builder',
            5: 'The Explorer',
            6: 'The Nurturer',
            7: 'The Seeker',
            8: 'The Achiever',
            9: 'The Humanitarian',
            11: 'The Visionary',
            22: 'The Master Builder',
            33: 'The Master Teacher'
        };
        return titles[num] || titles[num % 9 || 9] || 'Life Path';
    },

    /**
     * Render Compatibility page
     */
    renderCompatibility(profile, isHindi) {
        // Get user's first name for pre-fill
        const userName = profile?.name || '';
        const userGender = profile?.gender || '';

        return `
            <div class="maya-page maya-compatibility">
                <div class="maya-page__header">
                    <h2 class="maya-page__title">${isHindi ? 'प्रेम अनुकूलता' : 'Love Compatibility'}</h2>
                    <p class="maya-page__subtitle">${isHindi ? 'अपने साथी के साथ अपने ब्रह्मांडीय संबंध की खोज करें' : 'Discover your cosmic connection with your partner'}</p>
                </div>

                <div id="compatibilityResult"></div>

                <div class="maya-compat-form">
                    <div class="maya-compat-person-card">
                        <div class="maya-compat-person-card__header">
                            <div class="maya-compat-form__avatar">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <span class="maya-compat-form__label">${isHindi ? 'व्यक्ति 1' : 'Person 1'}</span>
                        </div>
                        <div class="maya-compat-person-card__fields">
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'नाम' : 'Name'}</label>
                                <input type="text" class="maya-input" id="yourName" 
                                       value="${userName}" placeholder="${isHindi ? 'अपना नाम दर्ज करें' : 'Enter name'}">
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'लिंग' : 'Gender'}</label>
                                <select class="maya-input maya-select" id="yourGender">
                                    <option value="" disabled ${!userGender ? 'selected' : ''}>${isHindi ? 'चुनें' : 'Select'}</option>
                                    <option value="male" ${userGender === 'male' ? 'selected' : ''}>${isHindi ? 'पुरुष' : 'Male'}</option>
                                    <option value="female" ${userGender === 'female' ? 'selected' : ''}>${isHindi ? 'महिला' : 'Female'}</option>
                                    <option value="other" ${userGender === 'other' ? 'selected' : ''}>${isHindi ? 'अन्य' : 'Other'}</option>
                                </select>
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'जन्म तिथि' : 'Birth Date'}</label>
                                <input type="date" class="maya-input" id="yourBirthDate" 
                                       value="${profile.birthDate || ''}" max="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'जन्म समय' : 'Birth Time'}</label>
                                <input type="time" class="maya-input" id="yourBirthTime" 
                                       value="${profile.birthTime || ''}">
                            </div>
                            <div class="maya-compat-field maya-compat-field--full maya-place-autocomplete-wrapper">
                                <label>${isHindi ? 'जन्म स्थान' : 'Birth Place'}</label>
                                <input type="text" class="maya-input maya-place-autocomplete" id="yourBirthPlace" 
                                       value="${profile.birthPlace || ''}" placeholder="${isHindi ? 'शहर, राज्य, देश' : 'City, State, Country'}" autocomplete="off">
                                <input type="hidden" id="yourBirthLat" value="">
                                <input type="hidden" id="yourBirthLng" value="">
                                <input type="hidden" id="yourTimezone" value="">
                            </div>
                        </div>
                    </div>
                    
                    <div class="maya-compat-divider">
                        <i class="bi bi-heart-fill"></i>
                    </div>
                    
                    <div class="maya-compat-person-card maya-compat-person-card--partner">
                        <div class="maya-compat-person-card__header">
                            <div class="maya-compat-form__avatar maya-compat-form__avatar--partner">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <span class="maya-compat-form__label">${isHindi ? 'व्यक्ति 2' : 'Person 2'}</span>
                        </div>
                        <div class="maya-compat-person-card__fields">
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'नाम' : 'Name'}</label>
                                <input type="text" class="maya-input" id="partnerName" 
                                       placeholder="${isHindi ? 'साथी का नाम दर्ज करें' : 'Enter partner\'s name'}">
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'लिंग' : 'Gender'}</label>
                                <select class="maya-input maya-select" id="partnerGender">
                                    <option value="" disabled selected>${isHindi ? 'चुनें' : 'Select'}</option>
                                    <option value="male">${isHindi ? 'पुरुष' : 'Male'}</option>
                                    <option value="female">${isHindi ? 'महिला' : 'Female'}</option>
                                    <option value="other">${isHindi ? 'अन्य' : 'Other'}</option>
                                </select>
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'जन्म तिथि' : 'Birth Date'}</label>
                                <input type="date" class="maya-input" id="partnerBirthDate"
                                       max="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="maya-compat-field">
                                <label>${isHindi ? 'जन्म समय' : 'Birth Time'}</label>
                                <input type="time" class="maya-input" id="partnerBirthTime">
                            </div>
                            <div class="maya-compat-field maya-compat-field--full maya-place-autocomplete-wrapper">
                                <label>${isHindi ? 'जन्म स्थान' : 'Birth Place'}</label>
                                <input type="text" class="maya-input maya-place-autocomplete" id="partnerBirthPlace" 
                                       placeholder="${isHindi ? 'शहर, राज्य, देश' : 'City, State, Country'}" autocomplete="off">
                                <input type="hidden" id="partnerBirthLat" value="">
                                <input type="hidden" id="partnerBirthLng" value="">
                                <input type="hidden" id="partnerTimezone" value="">
                            </div>
                        </div>
                    </div>
                    
                    <button class="maya-btn maya-btn--primary maya-btn--block" id="checkCompatibility">
                        <i class="bi bi-heart-pulse"></i>
                        <span>${isHindi ? 'अनुकूलता जांचें' : 'Check Compatibility'}</span>
                    </button>
                </div>
                
                <div class="maya-info-card maya-info-card--tip">
                    <div class="maya-info-card__icon">
                        <i class="bi bi-lightbulb"></i>
                    </div>
                    <div class="maya-info-card__content">
                        <h5>${isHindi ? 'यह कैसे काम करता है' : 'How it works'}</h5>
                        <p>${isHindi ? 'हम वैदिक ज्योतिष की अष्टकूट मिलान प्रणाली का उपयोग करके आपकी जन्म कुंडली का विश्लेषण करते हैं, जो मानसिक अनुकूलता, शारीरिक आकर्षण और भाग्य संरेखण सहित अनुकूलता के 8 प्रमुख पहलुओं की जांच करती है।' : "We analyze your birth charts using Vedic astrology's Ashtakoot Milan system, which examines 8 key aspects of compatibility including mental compatibility, physical attraction, and destiny alignment."}</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Daily Plan
     */
    async renderDailyHoroscope(profile, isHindi) {
        // Use user's preferred zodiac system (Western or Vedic)
        const zodiac = profile && profile.birthDate ? MayaAstrology.getZodiac(profile.birthDate, profile) : null;
        const today = new Date().toISOString().split('T')[0];

        // Get user's first name for personalization
        const userName = profile?.name || '';
        const firstName = userName.split(' ')[0] || (isHindi ? 'मित्र' : 'Friend');

        let horoscope = '';
        let isAIGenerated = false;
        let dosAndDonts = { dos: [], donts: [], source: 'loading' };

        if (zodiac) {
            // Use centralized cache manager
            const cached = await this.getDailyHoroscope();
            horoscope = cached.text;
            isAIGenerated = cached.isAI === true;

            // Generate Do's and Don'ts based on horoscope (async, will update UI)
            if (window.MayaHoroscopeAPI) {
                try {
                    dosAndDonts = await MayaHoroscopeAPI.generateDosAndDonts(horoscope, zodiac.name, profile);
                } catch (e) {
                    console.warn('Do\'s & Don\'ts generation failed:', e);
                    dosAndDonts = MayaHoroscopeAPI.getUnavailableDosAndDonts();
                }
            }
        }

        // Generate ratings
        const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const getRating = (offset) => Math.floor(((seed + offset) % 5) + 1);

        const renderStars = (rating) => {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<i class="bi bi-star${i <= rating ? '-fill' : ''} ${i <= rating ? 'active' : ''}"></i>`;
            }
            return stars;
        };

        const zodiacSystem = MayaAstrology.getZodiacSystem();
        const systemLabel = zodiacSystem === 'vedic' ? 'Vedic (Sidereal)' : 'Western (Tropical)';

        // Personalized greeting based on time of day
        const hour = new Date().getHours();
        let greeting = isHindi ? 'नमस्ते' : 'Hello';
        if (hour < 12) greeting = isHindi ? 'नमस्ते' : 'Good Morning';
        else if (hour < 17) greeting = isHindi ? 'नमस्ते' : 'Good Afternoon';
        else greeting = isHindi ? 'नमस्ते' : 'Good Evening';

        return `
            <div class="maya-page maya-horoscope">
                ${zodiac ? `
                    <div class="maya-zodiac-card">
                        <div class="maya-zodiac-card__glow"></div>
                        <div class="maya-zodiac-card__symbol">
                            <img src="${zodiac.image}" alt="${zodiac.name}" class="maya-zodiac-card__image" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                            <span class="maya-zodiac-card__emoji" style="display:none;">${zodiac.symbol}</span>
                        </div>
                        <div class="maya-zodiac-card__content">
                            <h3 class="maya-zodiac-card__name">${zodiac.name}</h3>
                            <span class="maya-zodiac-card__hindi">${zodiac.hindi || ''}</span>
                            <span class="maya-zodiac-card__dates">${zodiac.dateRange}</span>
                        </div>
                    </div>

                    <div class="maya-horoscope-text">
                        <div class="maya-horoscope-text__header">
                            <div class="maya-horoscope-text__quote">"</div>
                            <button class="maya-speak-btn" id="speakHoroscope" title="${isHindi ? 'सुनें' : 'Listen'}">
                                <i class="bi bi-volume-up-fill"></i>
                            </button>
                        </div>
                        <p id="horoscopeText">${horoscope}</p>
                        <div class="maya-horoscope-subtitle" id="horoscopeSubtitle"></div>
                    </div>

                    <div class="maya-dos-donts-section">
                        <h4 class="maya-section__title">
                            <i class="bi bi-signpost-split"></i>
                            ${isHindi ? `${firstName}, आज के लिए` : `${firstName}'s Daily Guide`}
                        </h4>
                        <div class="maya-dos-donts-grid">
                            <div class="maya-dos-card">
                                <div class="maya-dos-card__header">
                                    <i class="bi bi-check-circle-fill"></i>
                                    <span>${isHindi ? 'करें' : "Do's"}</span>
                                </div>
                                <ul class="maya-dos-card__list">
                                    ${dosAndDonts.dos.map(item => `<li><i class="bi bi-check2"></i> ${item}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="maya-donts-card">
                                <div class="maya-donts-card__header">
                                    <i class="bi bi-x-circle-fill"></i>
                                    <span>${isHindi ? 'न करें' : "Don'ts"}</span>
                                </div>
                                <ul class="maya-donts-card__list">
                                    ${dosAndDonts.donts.map(item => `<li><i class="bi bi-x"></i> ${item}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="maya-ratings-section">
                        <h4 class="maya-section__title">
                            <i class="bi bi-bar-chart"></i>
                            ${isHindi ? 'आज के पहलू' : "Today's Aspects"}
                            <span class="maya-section__hint">${isHindi ? '(टैप करें विस्तार के लिए)' : '(Tap for details)'}</span>
                        </h4>
                        <div class="maya-ratings-grid">
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="love" data-rating="${getRating(1)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-heart-fill"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'प्रेम' : 'Love'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(1))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="career" data-rating="${getRating(2)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-briefcase-fill"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'करियर' : 'Career'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(2))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="finance" data-rating="${getRating(3)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-currency-rupee"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'धन' : 'Finance'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(3))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="health" data-rating="${getRating(4)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-activity"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'स्वास्थ्य' : 'Health'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(4))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="family" data-rating="${getRating(5)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-people-fill"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'परिवार' : 'Family'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(5))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                            <div class="maya-rating-item maya-rating-item--clickable" data-aspect="luck" data-rating="${getRating(6)}" data-zodiac="${zodiac.name}" data-horoscope="${encodeURIComponent(horoscope)}">
                                <span class="maya-rating-item__emoji"><i class="bi bi-suit-club-fill"></i></span>
                                <span class="maya-rating-item__label">${isHindi ? 'भाग्य' : 'Luck'}</span>
                                <div class="maya-rating-item__stars">${renderStars(getRating(6))}</div>
                                <i class="bi bi-chevron-right maya-rating-item__arrow"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="maya-cta-inline">
                        <span>${isHindi ? 'व्यक्तिगत मार्गदर्शन चाहिए?' : 'Want personalized guidance?'}</span>
                        <button class="maya-btn maya-btn--outline maya-btn--sm" data-action="showMaya">
                            ${isHindi ? 'MAYA से पूछें' : 'Ask MAYA'} <i class="bi bi-arrow-right"></i>
                        </button>
                    </div>
                ` : `
                    <div class="maya-empty-state">
                        <div class="maya-empty-state__icon">
                            <i class="bi bi-calendar-x"></i>
                        </div>
                        <h4>Birth Date Required</h4>
                        <p>Please add your birth date to see your personalized daily plan.</p>
                        <button class="maya-btn maya-btn--primary" data-page="profile">
                            <i class="bi bi-person-plus"></i>
                            <span>Add Birth Details</span>
                        </button>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Render Chat page
     */
    renderChat(isHindi) {
        return `
            <div class="maya-page maya-chat">
                <div class="maya-chat__container">
                    <div class="maya-chat__messages" id="chatMessages">
                        <div class="maya-chat__welcome">
                            <div class="maya-chat__welcome-avatar">
                                <div class="maya-avatar maya-avatar--lg maya-avatar--glow">
                                    <span>M</span>
                                </div>
                            </div>
                            <h4>Hi, I'm MAYA</h4>
                            <p>Your journal and voice guide for reflection, timing, relationships, work, and practical next steps.</p>
                            <div class="maya-chat__suggestions">
                                <button class="maya-chip" data-question="Help me turn today's journal into one relationship action.">
                                    <i class="bi bi-heart"></i> Relationship
                                </button>
                                <button class="maya-chip" data-question="Help me choose one focused work step for today.">
                                    <i class="bi bi-briefcase"></i> Work
                                </button>
                                <button class="maya-chip" data-question="What should I write in my journal tonight?">
                                    <i class="bi bi-journal-text"></i> Journal Prompt
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="maya-chat__input-area">
                        <div class="maya-chat__input-wrapper">
                            <input type="text" class="maya-chat__input" id="chatInput" 
                                   placeholder="Ask MAYA anything..." autocomplete="off">
                            <button class="maya-chat__send" id="sendMessage">
                                <i class="bi bi-send-fill"></i>
                            </button>
                        </div>
                        <button class="maya-chat__voice" id="voiceInput">
                            <i class="bi bi-mic-fill"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Chat History page
     */
    renderChatHistory(isHindi) {
        // Get chat history from local storage
        const chatHistory = MayaUtils.storage.get('maya_chat_history') || [];

        const emptyState = `
            <div class="maya-empty-state">
                <div class="maya-empty-state__icon">
                    <i class="bi bi-chat-square-text"></i>
                </div>
                <h4>${isHindi ? 'कोई चैट नहीं' : 'No Conversations Yet'}</h4>
                <p>${isHindi ? 'MAYA से बात करें और आपकी बातचीत यहां दिखाई देगी।' : 'Start chatting with MAYA and your conversations will appear here.'}</p>
                <button class="maya-btn maya-btn--primary" data-action="showMaya">
                    <i class="bi bi-chat-heart"></i>
                    <span>${isHindi ? 'MAYA से बात करें' : 'Chat with MAYA'}</span>
                </button>
            </div>
        `;

        const historyList = chatHistory.length > 0 ? `
            <div class="maya-chat-history__list">
                ${chatHistory.slice().reverse().map((chat, index) => {
            const originalIndex = chatHistory.length - 1 - index;
            const chatId = String(chat.id || `legacy-${originalIndex}`);

            return `
                    <div class="maya-chat-history__item" data-chat-id="${chatId}">
                        <div class="maya-chat-history__item-icon">
                            <i class="bi bi-chat-dots"></i>
                        </div>
                        <div class="maya-chat-history__item-content">
                            <div class="maya-chat-history__item-question">${this.truncateText(chat.question, 60)}</div>
                            <div class="maya-chat-history__item-answer">${this.truncateText(chat.answer, 80)}</div>
                            <div class="maya-chat-history__item-date">
                                <i class="bi bi-clock"></i>
                                ${this.formatChatDate(chat.timestamp)}
                            </div>
                        </div>
                        <button class="maya-chat-history__item-delete" data-delete-chat="${chatId}" title="${isHindi ? 'हटाएं' : 'Delete'}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
        }).join('')}
            </div>
            <div class="maya-chat-history__actions">
                <button class="maya-btn maya-btn--danger-outline maya-btn--sm" id="clearAllChats">
                    <i class="bi bi-trash"></i>
                    <span>${isHindi ? 'सभी हटाएं' : 'Clear All'}</span>
                </button>
            </div>
        ` : emptyState;

        return `
            <div class="maya-page maya-chat-history">
                
                <div class="maya-chat-history__container">
                    ${historyList}
                </div>
            </div>
        `;
    },

    /**
     * Truncate text to specified length
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },

    /**
     * Format chat timestamp
     */
    formatChatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'long' });
        } else {
            return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
        }
    },

    /**
     * Render Panchang page
     */
    renderPanchang(isHindi) {
        const today = new Date();
        const panchangData = this.calculatePanchang(today);

        // Format Hindu date
        const hinduMonths = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada',
            'Ashwin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];
        const hinduMonthsHindi = ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद',
            'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'];

        return `
            <div class="maya-page maya-panchang">
                <div class="maya-page__header maya-page__header--center">
                    <p class="maya-page__subtitle-secondary">
                        ${isHindi ? hinduMonthsHindi[panchangData.hinduMonth] : hinduMonths[panchangData.hinduMonth]} ${panchangData.paksha.includes('Shukla') ? (isHindi ? 'शुक्ल पक्ष' : 'Shukla Paksha') : (isHindi ? 'कृष्ण पक्ष' : 'Krishna Paksha')}, ${isHindi ? 'विक्रम संवत्' : 'Vikram Samvat'} ${panchangData.vikramSamvat}
                    </p>
                </div>

                <!-- Sun & Moon Timings -->
                <div class="maya-panchang__celestial">
                    <div class="maya-panchang__celestial-item maya-panchang__celestial-item--sunrise">
                        <div class="maya-panchang__celestial-icon">
                            <i class="bi bi-sunrise-fill"></i>
                        </div>
                        <div class="maya-panchang__celestial-info">
                            <span class="maya-panchang__celestial-label">${isHindi ? 'सूर्योदय' : 'Sunrise'}</span>
                            <span class="maya-panchang__celestial-time">${panchangData.sunrise}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__celestial-item maya-panchang__celestial-item--sunset">
                        <div class="maya-panchang__celestial-icon">
                            <i class="bi bi-sunset-fill"></i>
                        </div>
                        <div class="maya-panchang__celestial-info">
                            <span class="maya-panchang__celestial-label">${isHindi ? 'सूर्यास्त' : 'Sunset'}</span>
                            <span class="maya-panchang__celestial-time">${panchangData.sunset}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__celestial-item maya-panchang__celestial-item--moonrise">
                        <div class="maya-panchang__celestial-icon">
                            <i class="bi bi-moon-stars-fill"></i>
                        </div>
                        <div class="maya-panchang__celestial-info">
                            <span class="maya-panchang__celestial-label">${isHindi ? 'चन्द्रोदय' : 'Moonrise'}</span>
                            <span class="maya-panchang__celestial-time">${panchangData.moonrise}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__celestial-item maya-panchang__celestial-item--moonset">
                        <div class="maya-panchang__celestial-icon">
                            <i class="bi bi-moon-fill"></i>
                        </div>
                        <div class="maya-panchang__celestial-info">
                            <span class="maya-panchang__celestial-label">${isHindi ? 'चन्द्रास्त' : 'Moonset'}</span>
                            <span class="maya-panchang__celestial-time">${panchangData.moonset}</span>
                        </div>
                    </div>
                </div>

                <!-- Main Tithi Highlight -->
                <div class="maya-panchang__tithi-card">
                    <div class="maya-panchang__tithi-header">
                        <div class="maya-panchang__tithi-icon ${panchangData.paksha.includes('Shukla') ? 'maya-panchang__tithi-icon--shukla' : 'maya-panchang__tithi-icon--krishna'}">
                            <i class="bi ${panchangData.moonPhaseIcon}"></i>
                        </div>
                        <div class="maya-panchang__tithi-main">
                            <span class="maya-panchang__tithi-label">${isHindi ? 'तिथि' : 'Tithi'}</span>
                            <span class="maya-panchang__tithi-value">${panchangData.tithi}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__tithi-details">
                        <div class="maya-panchang__tithi-detail">
                            <i class="bi bi-clock"></i>
                            <span>${isHindi ? 'समाप्ति' : 'Ends at'}: ${panchangData.tithiEndTime}</span>
                        </div>
                        <div class="maya-panchang__paksha-badge ${panchangData.paksha.includes('Shukla') ? 'maya-panchang__paksha-badge--shukla' : 'maya-panchang__paksha-badge--krishna'}">
                            <i class="bi ${panchangData.paksha.includes('Shukla') ? 'bi-brightness-high-fill' : 'bi-moon-fill'}"></i>
                            <span>${panchangData.paksha}</span>
                        </div>
                    </div>
                </div>

                <!-- Panchang Grid -->
                <div class="maya-panchang__grid">
                    <div class="maya-panchang__item">
                        <div class="maya-panchang__item-icon"><i class="bi bi-star-fill"></i></div>
                        <div class="maya-panchang__item-content">
                            <span class="maya-panchang__item-label">${isHindi ? 'नक्षत्र' : 'Nakshatra'}</span>
                            <span class="maya-panchang__item-value">${panchangData.nakshatra}</span>
                            <span class="maya-panchang__item-time">${isHindi ? 'समाप्ति' : 'Ends'}: ${panchangData.nakshatraEndTime}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__item">
                        <div class="maya-panchang__item-icon"><i class="bi bi-person-arms-up"></i></div>
                        <div class="maya-panchang__item-content">
                            <span class="maya-panchang__item-label">${isHindi ? 'योग' : 'Yoga'}</span>
                            <span class="maya-panchang__item-value">${panchangData.yoga}</span>
                            <span class="maya-panchang__item-time">${isHindi ? 'समाप्ति' : 'Ends'}: ${panchangData.yogaEndTime}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__item">
                        <div class="maya-panchang__item-icon"><i class="bi bi-lightning-fill"></i></div>
                        <div class="maya-panchang__item-content">
                            <span class="maya-panchang__item-label">${isHindi ? 'करण' : 'Karana'}</span>
                            <span class="maya-panchang__item-value">${panchangData.karana}</span>
                            <span class="maya-panchang__item-time">${isHindi ? 'समाप्ति' : 'Ends'}: ${panchangData.karanaEndTime}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__item">
                        <div class="maya-panchang__item-icon"><i class="bi bi-calendar-week"></i></div>
                        <div class="maya-panchang__item-content">
                            <span class="maya-panchang__item-label">${isHindi ? 'वार' : 'Vara'}</span>
                            <span class="maya-panchang__item-value">${panchangData.vara}</span>
                            <span class="maya-panchang__item-time">${isHindi ? 'स्वामी' : 'Lord'}: ${panchangData.varaLord}</span>
                        </div>
                    </div>
                </div>

                <!-- Moon Sign & Sun Sign -->
                <div class="maya-panchang__rashi-cards">
                    <div class="maya-panchang__rashi-card maya-panchang__rashi-card--moon">
                        <div class="maya-panchang__rashi-icon">
                            <i class="bi bi-moon-stars-fill"></i>
                        </div>
                        <div class="maya-panchang__rashi-content">
                            <span class="maya-panchang__rashi-label">${isHindi ? 'चंद्र राशि' : 'Moon Sign (Chandra Rashi)'}</span>
                            <span class="maya-panchang__rashi-value">${panchangData.moonSign}</span>
                            <span class="maya-panchang__rashi-hindi">${panchangData.moonSignHindi}</span>
                        </div>
                    </div>
                    <div class="maya-panchang__rashi-card maya-panchang__rashi-card--sun">
                        <div class="maya-panchang__rashi-icon">
                            <i class="bi bi-sun-fill"></i>
                        </div>
                        <div class="maya-panchang__rashi-content">
                            <span class="maya-panchang__rashi-label">${isHindi ? 'सूर्य राशि' : 'Sun Sign (Surya Rashi)'}</span>
                            <span class="maya-panchang__rashi-value">${panchangData.sunSign}</span>
                            <span class="maya-panchang__rashi-hindi">${panchangData.sunSignHindi}</span>
                        </div>
                    </div>
                </div>

                <!-- Auspicious Times -->
                <div class="maya-section">
                    <h4 class="maya-section__title maya-section__title--success">
                        <i class="bi bi-check-circle-fill"></i>
                        ${isHindi ? 'शुभ मुहूर्त' : 'Auspicious Timings (Shubh Muhurat)'}
                    </h4>
                    <div class="maya-time-slots maya-time-slots--detailed">
                        <div class="maya-time-slot maya-time-slot--good">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-sunrise"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'ब्रह्म मुहूर्त' : 'Brahma Muhurat'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.brahmaMuhurat}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'ध्यान, पूजा और अध्ययन के लिए सर्वोत्तम' : 'Best for meditation, worship & study'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--good">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-star-fill"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'अभिजित मुहूर्त' : 'Abhijit Muhurat'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.abhijitMuhurat}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'सभी शुभ कार्यों के लिए उत्तम' : 'Excellent for all auspicious activities'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--good">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-currency-rupee"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'विजय मुहूर्त' : 'Vijay Muhurat'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.vijayMuhurat}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'सफलता और विजय के लिए' : 'For success and victory'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--good">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-heart-fill"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'गोधूलि मुहूर्त' : 'Godhuli Muhurat'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.godhuliMuhurat}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'विवाह और शुभ कार्यों के लिए' : 'For marriage & auspicious events'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--good">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-moon-stars"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'अमृत काल' : 'Amrit Kaal'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.amritKaal}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'महत्वपूर्ण कार्यों के लिए अत्यंत शुभ' : 'Highly auspicious for important tasks'}</span>
                        </div>
                    </div>
                </div>

                <!-- Inauspicious Times -->
                <div class="maya-section">
                    <h4 class="maya-section__title maya-section__title--danger">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        ${isHindi ? 'अशुभ काल (इस समय शुभ कार्य न करें)' : 'Inauspicious Timings (Avoid Shubh Karya)'}
                    </h4>
                    <div class="maya-time-slots maya-time-slots--detailed">
                        <div class="maya-time-slot maya-time-slot--bad">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-x-circle"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'राहु काल' : 'Rahu Kaal'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.rahuKaal}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'नए कार्य, यात्रा, खरीदारी से बचें' : 'Avoid new ventures, travel, purchases'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--bad">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-x-circle"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'यमगण्ड काल' : 'Yamaganda Kaal'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.yamagandaKaal}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'यात्रा और महत्वपूर्ण कार्यों से बचें' : 'Avoid travel & important decisions'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--bad">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-x-circle"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'गुलिक काल' : 'Gulika Kaal'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.gulikaKaal}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'शुभ कार्य आरंभ न करें' : 'Do not start auspicious work'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--bad">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-x-circle"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'दुर्मुहूर्त' : 'Dur Muhurat'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.durMuhurat}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'शुभ कार्यों के लिए अशुभ' : 'Inauspicious for good deeds'}</span>
                        </div>
                        <div class="maya-time-slot maya-time-slot--bad">
                            <div class="maya-time-slot__header">
                                <i class="bi bi-x-circle"></i>
                                <span class="maya-time-slot__name">${isHindi ? 'वर्ज्यम्' : 'Varjyam'}</span>
                            </div>
                            <span class="maya-time-slot__time">${panchangData.varjyam}</span>
                            <span class="maya-time-slot__desc">${isHindi ? 'त्यागने योग्य समय' : 'Time to be avoided completely'}</span>
                        </div>
                    </div>
                </div>

                <!-- Do's and Don'ts -->
                <div class="maya-section">
                    <h4 class="maya-section__title maya-section__title--info">
                        <i class="bi bi-info-circle-fill"></i>
                        ${isHindi ? 'आज के लिए मार्गदर्शन' : "Today's Do's & Don'ts"}
                    </h4>
                    <div class="maya-panchang__guidance">
                        <div class="maya-panchang__dos">
                            <h5><i class="bi bi-check-lg"></i> ${isHindi ? 'क्या करें' : "Do's"}</h5>
                            <ul>
                                ${panchangData.dos.map(d => `<li>${d}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="maya-panchang__donts">
                            <h5><i class="bi bi-x-lg"></i> ${isHindi ? 'क्या न करें' : "Don'ts"}</h5>
                            <ul>
                                ${panchangData.donts.map(d => `<li>${d}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Special Observances -->
                ${panchangData.festivals.length > 0 ? `
                    <div class="maya-section">
                        <h4 class="maya-section__title maya-section__title--festival">
                            <i class="bi bi-calendar-heart-fill"></i>
                            ${isHindi ? 'आज के त्योहार / व्रत' : "Today's Festivals & Observances"}
                        </h4>
                        <div class="maya-panchang__festivals">
                            ${panchangData.festivals.map(f => `
                                <div class="maya-panchang__festival-item">
                                    <i class="bi ${f.icon} maya-panchang__festival-icon"></i>
                                    <span class="maya-panchang__festival-name">${f.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Additional Info -->
                <div class="maya-section">
                    <h4 class="maya-section__title">
                        <i class="bi bi-info-circle"></i>
                        ${isHindi ? 'अतिरिक्त जानकारी' : 'Additional Information'}
                    </h4>
                    <div class="maya-panchang__additional">
                        <div class="maya-panchang__add-item">
                            <span class="maya-panchang__add-label">${isHindi ? 'दिशा शूल' : 'Disha Shool'}</span>
                            <span class="maya-panchang__add-value">${panchangData.dishaShool}</span>
                        </div>
                        <div class="maya-panchang__add-item">
                            <span class="maya-panchang__add-label">${isHindi ? 'चन्द्रमा नक्षत्र' : 'Moon Nakshatra'}</span>
                            <span class="maya-panchang__add-value">${panchangData.nakshatra}</span>
                        </div>
                        <div class="maya-panchang__add-item">
                            <span class="maya-panchang__add-label">${isHindi ? 'नक्षत्र स्वामी' : 'Nakshatra Lord'}</span>
                            <span class="maya-panchang__add-value">${panchangData.nakshatraLord}</span>
                        </div>
                        <div class="maya-panchang__add-item">
                            <span class="maya-panchang__add-label">${isHindi ? 'शुभ रंग' : 'Lucky Color'}</span>
                            <span class="maya-panchang__add-value">${panchangData.luckyColor}</span>
                        </div>
                        <div class="maya-panchang__add-item">
                            <span class="maya-panchang__add-label">${isHindi ? 'शुभ अंक' : 'Lucky Number'}</span>
                            <span class="maya-panchang__add-value">${panchangData.luckyNumber}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Calculate comprehensive and accurate Panchang based on Vedic astronomy
     */
    calculatePanchang(date) {
        const dayOfWeek = date.getDay();

        // Varas (weekdays) with Hindi names
        const varas = [
            { name: 'Ravivara (Sunday)', hindi: 'रविवार', lord: 'Sun (Surya)' },
            { name: 'Somavara (Monday)', hindi: 'सोमवार', lord: 'Moon (Chandra)' },
            { name: 'Mangalavara (Tuesday)', hindi: 'मंगलवार', lord: 'Mars (Mangal)' },
            { name: 'Budhavara (Wednesday)', hindi: 'बुधवार', lord: 'Mercury (Budha)' },
            { name: 'Guruvara (Thursday)', hindi: 'गुरुवार', lord: 'Jupiter (Guru)' },
            { name: 'Shukravara (Friday)', hindi: 'शुक्रवार', lord: 'Venus (Shukra)' },
            { name: 'Shanivara (Saturday)', hindi: 'शनिवार', lord: 'Saturn (Shani)' }
        ];

        // Tithis with Hindi names
        const tithis = [
            { name: 'Pratipada', hindi: 'प्रतिपदा', number: 1 },
            { name: 'Dwitiya', hindi: 'द्वितीया', number: 2 },
            { name: 'Tritiya', hindi: 'तृतीया', number: 3 },
            { name: 'Chaturthi', hindi: 'चतुर्थी', number: 4 },
            { name: 'Panchami', hindi: 'पंचमी', number: 5 },
            { name: 'Shashthi', hindi: 'षष्ठी', number: 6 },
            { name: 'Saptami', hindi: 'सप्तमी', number: 7 },
            { name: 'Ashtami', hindi: 'अष्टमी', number: 8 },
            { name: 'Navami', hindi: 'नवमी', number: 9 },
            { name: 'Dashami', hindi: 'दशमी', number: 10 },
            { name: 'Ekadashi', hindi: 'एकादशी', number: 11 },
            { name: 'Dwadashi', hindi: 'द्वादशी', number: 12 },
            { name: 'Trayodashi', hindi: 'त्रयोदशी', number: 13 },
            { name: 'Chaturdashi', hindi: 'चतुर्दशी', number: 14 },
            { name: 'Purnima', hindi: 'पूर्णिमा', number: 15 },
            { name: 'Amavasya', hindi: 'अमावस्या', number: 30 }
        ];

        // 27 Nakshatras with lords
        const nakshatras = [
            { name: 'Ashwini', hindi: 'अश्विनी', lord: 'Ketu' },
            { name: 'Bharani', hindi: 'भरणी', lord: 'Venus' },
            { name: 'Krittika', hindi: 'कृत्तिका', lord: 'Sun' },
            { name: 'Rohini', hindi: 'रोहिणी', lord: 'Moon' },
            { name: 'Mrigashira', hindi: 'मृगशिरा', lord: 'Mars' },
            { name: 'Ardra', hindi: 'आर्द्रा', lord: 'Rahu' },
            { name: 'Punarvasu', hindi: 'पुनर्वसु', lord: 'Jupiter' },
            { name: 'Pushya', hindi: 'पुष्य', lord: 'Saturn' },
            { name: 'Ashlesha', hindi: 'आश्लेषा', lord: 'Mercury' },
            { name: 'Magha', hindi: 'मघा', lord: 'Ketu' },
            { name: 'Purva Phalguni', hindi: 'पूर्वा फाल्गुनी', lord: 'Venus' },
            { name: 'Uttara Phalguni', hindi: 'उत्तरा फाल्गुनी', lord: 'Sun' },
            { name: 'Hasta', hindi: 'हस्त', lord: 'Moon' },
            { name: 'Chitra', hindi: 'चित्रा', lord: 'Mars' },
            { name: 'Swati', hindi: 'स्वाति', lord: 'Rahu' },
            { name: 'Vishakha', hindi: 'विशाखा', lord: 'Jupiter' },
            { name: 'Anuradha', hindi: 'अनुराधा', lord: 'Saturn' },
            { name: 'Jyeshtha', hindi: 'ज्येष्ठा', lord: 'Mercury' },
            { name: 'Mula', hindi: 'मूल', lord: 'Ketu' },
            { name: 'Purva Ashadha', hindi: 'पूर्वाषाढ़ा', lord: 'Venus' },
            { name: 'Uttara Ashadha', hindi: 'उत्तराषाढ़ा', lord: 'Sun' },
            { name: 'Shravana', hindi: 'श्रवण', lord: 'Moon' },
            { name: 'Dhanishtha', hindi: 'धनिष्ठा', lord: 'Mars' },
            { name: 'Shatabhisha', hindi: 'शतभिषा', lord: 'Rahu' },
            { name: 'Purva Bhadrapada', hindi: 'पूर्वाभाद्रपदा', lord: 'Jupiter' },
            { name: 'Uttara Bhadrapada', hindi: 'उत्तराभाद्रपदा', lord: 'Saturn' },
            { name: 'Revati', hindi: 'रेवती', lord: 'Mercury' }
        ];

        // 27 Yogas
        const yogas = [
            { name: 'Vishkumbha', hindi: 'विष्कुम्भ', nature: 'Inauspicious' },
            { name: 'Priti', hindi: 'प्रीति', nature: 'Auspicious' },
            { name: 'Ayushman', hindi: 'आयुष्मान', nature: 'Auspicious' },
            { name: 'Saubhagya', hindi: 'सौभाग्य', nature: 'Auspicious' },
            { name: 'Shobhana', hindi: 'शोभन', nature: 'Auspicious' },
            { name: 'Atiganda', hindi: 'अतिगण्ड', nature: 'Inauspicious' },
            { name: 'Sukarma', hindi: 'सुकर्मा', nature: 'Auspicious' },
            { name: 'Dhriti', hindi: 'धृति', nature: 'Auspicious' },
            { name: 'Shula', hindi: 'शूल', nature: 'Inauspicious' },
            { name: 'Ganda', hindi: 'गण्ड', nature: 'Inauspicious' },
            { name: 'Vriddhi', hindi: 'वृद्धि', nature: 'Auspicious' },
            { name: 'Dhruva', hindi: 'ध्रुव', nature: 'Auspicious' },
            { name: 'Vyaghata', hindi: 'व्याघात', nature: 'Inauspicious' },
            { name: 'Harshana', hindi: 'हर्षण', nature: 'Auspicious' },
            { name: 'Vajra', hindi: 'वज्र', nature: 'Inauspicious' },
            { name: 'Siddhi', hindi: 'सिद्धि', nature: 'Auspicious' },
            { name: 'Vyatipata', hindi: 'व्यतीपात', nature: 'Inauspicious' },
            { name: 'Variyan', hindi: 'वरीयान', nature: 'Auspicious' },
            { name: 'Parigha', hindi: 'परिघ', nature: 'Inauspicious' },
            { name: 'Shiva', hindi: 'शिव', nature: 'Auspicious' },
            { name: 'Siddha', hindi: 'सिद्ध', nature: 'Auspicious' },
            { name: 'Sadhya', hindi: 'साध्य', nature: 'Auspicious' },
            { name: 'Shubha', hindi: 'शुभ', nature: 'Auspicious' },
            { name: 'Shukla', hindi: 'शुक्ल', nature: 'Auspicious' },
            { name: 'Brahma', hindi: 'ब्रह्म', nature: 'Auspicious' },
            { name: 'Indra', hindi: 'इन्द्र', nature: 'Auspicious' },
            { name: 'Vaidhriti', hindi: 'वैधृति', nature: 'Inauspicious' }
        ];

        // 11 Karanas (half-tithis)
        const karanas = [
            { name: 'Bava', hindi: 'बव', nature: 'Moveable' },
            { name: 'Balava', hindi: 'बालव', nature: 'Moveable' },
            { name: 'Kaulava', hindi: 'कौलव', nature: 'Moveable' },
            { name: 'Taitila', hindi: 'तैतिल', nature: 'Moveable' },
            { name: 'Gara', hindi: 'गर', nature: 'Moveable' },
            { name: 'Vanija', hindi: 'वणिज', nature: 'Moveable' },
            { name: 'Vishti', hindi: 'विष्टि (भद्रा)', nature: 'Fixed - Inauspicious' },
            { name: 'Shakuni', hindi: 'शकुनि', nature: 'Fixed' },
            { name: 'Chatushpada', hindi: 'चतुष्पद', nature: 'Fixed' },
            { name: 'Naga', hindi: 'नाग', nature: 'Fixed' },
            { name: 'Kimstughna', hindi: 'किंस्तुघ्न', nature: 'Fixed' }
        ];

        // Rashis (Zodiac signs) with Hindi names
        const rashis = [
            { name: 'Aries', hindi: 'मेष' },
            { name: 'Taurus', hindi: 'वृषभ' },
            { name: 'Gemini', hindi: 'मिथुन' },
            { name: 'Cancer', hindi: 'कर्क' },
            { name: 'Leo', hindi: 'सिंह' },
            { name: 'Virgo', hindi: 'कन्या' },
            { name: 'Libra', hindi: 'तुला' },
            { name: 'Scorpio', hindi: 'वृश्चिक' },
            { name: 'Sagittarius', hindi: 'धनु' },
            { name: 'Capricorn', hindi: 'मकर' },
            { name: 'Aquarius', hindi: 'कुम्भ' },
            { name: 'Pisces', hindi: 'मीन' }
        ];

        // Calculate Julian Day Number for accurate astronomical calculations
        const getJulianDay = (d) => {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate() + d.getHours() / 24;

            let y = year, m = month;
            if (m <= 2) { y--; m += 12; }

            const A = Math.floor(y / 100);
            const B = 2 - A + Math.floor(A / 4);

            return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
        };

        // Calculate Sun longitude (Tropical)
        const getSunLongitude = (jd) => {
            const T = (jd - 2451545.0) / 36525;
            let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
            let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
            M = M * Math.PI / 180;
            const C = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M);
            L0 = (L0 + C) % 360;
            if (L0 < 0) L0 += 360;
            return L0;
        };

        // Calculate Moon longitude (approximate)
        const getMoonLongitude = (jd) => {
            const T = (jd - 2451545.0) / 36525;
            let L = 218.3165 + 481267.8813 * T;
            let D = 297.8502 + 445267.1115 * T;
            let M = 357.5291 + 35999.0503 * T;
            let Mp = 134.9634 + 477198.8675 * T;
            let F = 93.2721 + 483202.0175 * T;

            D = D * Math.PI / 180;
            M = M * Math.PI / 180;
            Mp = Mp * Math.PI / 180;
            F = F * Math.PI / 180;

            L += 6.289 * Math.sin(Mp);
            L += 1.274 * Math.sin(2 * D - Mp);
            L += 0.658 * Math.sin(2 * D);
            L += 0.214 * Math.sin(2 * Mp);

            L = L % 360;
            if (L < 0) L += 360;
            return L;
        };

        // Ayanamsa calculation (Lahiri - most commonly used)
        const getAyanamsa = (jd) => {
            const T = (jd - 2451545.0) / 36525;
            // Lahiri Ayanamsa approximation
            return 23.85 + 0.0137 * (jd - 2451545.0) / 365.25;
        };

        const jd = getJulianDay(date);
        const ayanamsa = getAyanamsa(jd);

        // Get Sidereal positions
        let sunLong = (getSunLongitude(jd) - ayanamsa) % 360;
        let moonLong = (getMoonLongitude(jd) - ayanamsa) % 360;
        if (sunLong < 0) sunLong += 360;
        if (moonLong < 0) moonLong += 360;

        // Calculate Tithi (Moon - Sun difference / 12)
        let tithiDiff = moonLong - sunLong;
        if (tithiDiff < 0) tithiDiff += 360;
        const tithiIndex = Math.floor(tithiDiff / 12);
        const tithiRemaining = 12 - (tithiDiff % 12);

        // Calculate end time (approximate - based on Moon's daily motion of ~13 degrees)
        const hoursToTithiEnd = (tithiRemaining / 13) * 24;
        const tithiEndTime = new Date(date.getTime() + hoursToTithiEnd * 3600000);

        // Determine Paksha and actual Tithi
        const isShukla = tithiIndex < 15;
        const pakshaTithiIndex = tithiIndex % 15;
        let tithi = tithis[pakshaTithiIndex];

        // Special case for Purnima/Amavasya
        if (pakshaTithiIndex === 14) {
            tithi = isShukla ? { name: 'Purnima', hindi: 'पूर्णिमा', number: 15 }
                : { name: 'Amavasya', hindi: 'अमावस्या', number: 30 };
        }

        // Calculate Nakshatra (Moon longitude / 13.333)
        const nakshatraIndex = Math.floor(moonLong / (360 / 27));
        const nakshatraRemaining = (360 / 27) - (moonLong % (360 / 27));
        const hoursToNakshatraEnd = (nakshatraRemaining / 13) * 24;
        const nakshatraEndTime = new Date(date.getTime() + hoursToNakshatraEnd * 3600000);
        const nakshatra = nakshatras[nakshatraIndex % 27];

        // Calculate Yoga (Sun + Moon longitude / 13.333)
        let yogaLong = (sunLong + moonLong) % 360;
        const yogaIndex = Math.floor(yogaLong / (360 / 27));
        const yogaRemaining = (360 / 27) - (yogaLong % (360 / 27));
        const hoursToYogaEnd = (yogaRemaining / 13) * 24;
        const yogaEndTime = new Date(date.getTime() + hoursToYogaEnd * 3600000);
        const yoga = yogas[yogaIndex % 27];

        // Calculate Karana (half tithi)
        const karanaIndex = Math.floor(tithiDiff / 6) % 11;
        const karanaRemaining = 6 - (tithiDiff % 6);
        const hoursToKaranaEnd = (karanaRemaining / 13) * 24;
        const karanaEndTime = new Date(date.getTime() + hoursToKaranaEnd * 3600000);
        const karana = karanas[karanaIndex];

        // Moon and Sun signs
        const moonSignIndex = Math.floor(moonLong / 30);
        const sunSignIndex = Math.floor(sunLong / 30);
        const moonSign = rashis[moonSignIndex % 12];
        const sunSign = rashis[sunSignIndex % 12];

        // Calculate Vikram Samvat (Hindu calendar year)
        // Vikram Samvat = Gregorian Year + 57 (before Chaitra) or + 56 (after Chaitra)
        const vikramSamvat = date.getFullYear() + (date.getMonth() < 3 ? 56 : 57);

        // Hindu month (approximate based on Sun's position)
        const hinduMonth = Math.floor((sunLong + 23.5) / 30) % 12;

        // Moon phase icon based on tithi (using Bootstrap icons)
        const getMoonPhaseIcon = (tithiIdx, isShukla) => {
            if (tithiIdx === 14) return isShukla ? 'bi-circle-fill' : 'bi-circle';
            if (isShukla) {
                if (tithiIdx < 4) return 'bi-moon';
                if (tithiIdx < 8) return 'bi-moon-stars';
                if (tithiIdx < 12) return 'bi-moon-stars-fill';
                return 'bi-circle-fill';
            } else {
                if (tithiIdx < 4) return 'bi-moon-stars-fill';
                if (tithiIdx < 8) return 'bi-moon-stars';
                if (tithiIdx < 12) return 'bi-moon';
                return 'bi-circle';
            }
        };

        // Calculate accurate timings based on sunrise (assumed 6:00 AM for now)
        // In production, this should use actual sunrise time based on location
        const sunriseHour = 6.5; // 6:30 AM average
        const sunsetHour = 18.0; // 6:00 PM average
        const dayDuration = sunsetHour - sunriseHour;
        const nightDuration = 24 - dayDuration;
        const muhurtaDuration = dayDuration / 15; // Each day muhurta is daylight/15

        // Format time helper
        const formatTime = (hour) => {
            const h = Math.floor(hour);
            const m = Math.floor((hour - h) * 60);
            const period = h >= 12 ? 'PM' : 'AM';
            const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
        };

        // Calculate Rahu Kaal, Yamaganda, Gulika based on day
        const rahuKaalOrder = [8, 2, 7, 5, 6, 4, 3]; // Which muhurta is Rahu Kaal for each day
        const yamaOrder = [5, 4, 3, 2, 1, 7, 6];
        const gulikaOrder = [7, 6, 5, 4, 3, 2, 1];

        const rahuMuhurta = rahuKaalOrder[dayOfWeek] - 1;
        const yamaMuhurta = yamaOrder[dayOfWeek] - 1;
        const gulikaMuhurta = gulikaOrder[dayOfWeek] - 1;

        const rahuKaalStart = sunriseHour + (rahuMuhurta * muhurtaDuration);
        const rahuKaalEnd = rahuKaalStart + muhurtaDuration;

        const yamaStart = sunriseHour + (yamaMuhurta * muhurtaDuration);
        const yamaEnd = yamaStart + muhurtaDuration;

        const gulikaStart = sunriseHour + (gulikaMuhurta * muhurtaDuration);
        const gulikaEnd = gulikaStart + muhurtaDuration;

        // Abhijit Muhurat (middle of the day - 11:36 AM to 12:24 PM approximately)
        const abhijitStart = sunriseHour + (7 * muhurtaDuration);
        const abhijitEnd = abhijitStart + muhurtaDuration;

        // Brahma Muhurat (1hr 36min before sunrise)
        const brahmaStart = sunriseHour - 1.6;
        const brahmaEnd = sunriseHour - 0.8;

        // Vijay Muhurat (afternoon)
        const vijayStart = sunriseHour + (12 * muhurtaDuration);
        const vijayEnd = vijayStart + muhurtaDuration;

        // Godhuli Muhurat (around sunset)
        const godhuliStart = sunsetHour - 0.4;
        const godhuliEnd = sunsetHour + 0.4;

        // Amrit Kaal (calculated from nakshatra)
        // This varies based on nakshatra - using approximate calculation
        const amritStart = sunriseHour + ((nakshatraIndex % 8 + 2) * muhurtaDuration);
        const amritEnd = amritStart + muhurtaDuration;

        // Dur Muhurat (inauspicious)
        const durStart = sunriseHour + (10 * muhurtaDuration);
        const durEnd = durStart + muhurtaDuration;

        // Varjyam (to be avoided)
        const varjyamStart = sunriseHour + ((nakshatraIndex % 6 + 4) * muhurtaDuration);
        const varjyamEnd = varjyamStart + muhurtaDuration;

        // Disha Shool (inauspicious direction for travel)
        const dishaShoolMap = ['West', 'East', 'North', 'North', 'South', 'West', 'East'];

        // Lucky colors and numbers based on vara lord
        const luckyColorMap = ['Gold/Orange', 'White/Silver', 'Red/Coral', 'Green', 'Yellow', 'White/Pink', 'Blue/Black'];
        const luckyNumberMap = ['1, 4', '2, 7', '9, 3', '5, 6', '3, 8', '6, 9', '8, 4'];

        // Do's and Don'ts based on tithi, vara, and nakshatra
        const getDosAndDonts = () => {
            const dos = [];
            const donts = [];

            // Based on Vara (weekday)
            const varaDos = {
                0: ['Worship Sun God', 'Start health regimes', 'Meet with authorities'],
                1: ['Worship Lord Shiva', 'Start new learning', 'Water-related activities'],
                2: ['Worship Hanuman/Kartikeya', 'Property matters', 'Physical activities'],
                3: ['Start education', 'Business dealings', 'Communication tasks'],
                4: ['Religious activities', 'Marriage/engagement', 'Financial investments'],
                5: ['Worship Goddess Lakshmi', 'Buy new items', 'Art and entertainment'],
                6: ['Worship Shani Dev', 'Iron/oil related work', 'Servant matters']
            };

            const varaDonts = {
                0: ['Avoid starting journeys to East', 'Avoid oil application'],
                1: ['Avoid buying salt', 'Avoid arguments'],
                2: ['Avoid travel to South', 'Avoid new cloth purchases'],
                3: ['Avoid construction start', 'Avoid fasting'],
                4: ['Avoid haircuts', 'Avoid negative thoughts'],
                5: ['Avoid travel to West', 'Avoid quarrels'],
                6: ['Avoid starting new ventures', 'Avoid travel to inauspicious direction']
            };

            // Based on Tithi
            if (pakshaTithiIndex === 7) { // Ashtami
                dos.push('Good for Durga worship');
                donts.push('Avoid starting new businesses');
            } else if (pakshaTithiIndex === 10) { // Ekadashi
                dos.push('Fasting recommended');
                dos.push('Spiritual practices beneficial');
                donts.push('Avoid eating grains (for observers)');
            } else if (pakshaTithiIndex === 14) { // Purnima/Amavasya
                if (isShukla) {
                    dos.push('Good for Satyanarayan Puja');
                    dos.push('Charity gives multiplied benefits');
                } else {
                    dos.push('Good for Pitru Tarpan');
                    donts.push('Avoid starting new ventures');
                }
            } else if (pakshaTithiIndex === 3) { // Chaturthi
                dos.push('Worship Lord Ganesha');
            }

            // Based on Nakshatra
            if (['Pushya', 'Rohini', 'Ashwini', 'Mrigashira', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Revati'].includes(nakshatra.name)) {
                dos.push('Auspicious for important beginnings');
            }
            if (['Bharani', 'Krittika', 'Ashlesha', 'Magha', 'Vishakha', 'Jyeshtha', 'Mula'].includes(nakshatra.name)) {
                donts.push('Avoid starting gentle/soft activities');
            }

            // Based on Yoga
            if (yoga.nature === 'Inauspicious') {
                donts.push(`${yoga.name} Yoga - Be cautious in important matters`);
            }

            // Based on Karana
            if (karana.name === 'Vishti') {
                donts.push('Bhadra Karana - Avoid auspicious activities');
            }

            // Add vara-specific recommendations
            dos.push(...varaDos[dayOfWeek]);
            donts.push(...varaDonts[dayOfWeek]);

            return { dos: dos.slice(0, 5), donts: donts.slice(0, 5) };
        };

        // Get festivals/observances for today
        const getFestivals = () => {
            const festivals = [];

            // Ekadashi
            if (pakshaTithiIndex === 10) {
                festivals.push({ name: 'Ekadashi Vrat', icon: 'bi-flower1' });
            }
            // Purnima
            if (pakshaTithiIndex === 14 && isShukla) {
                festivals.push({ name: 'Purnima', icon: 'bi-circle-fill' });
            }
            // Amavasya
            if (pakshaTithiIndex === 14 && !isShukla) {
                festivals.push({ name: 'Amavasya', icon: 'bi-circle' });
            }
            // Chaturthi - Ganesh worship
            if (pakshaTithiIndex === 3) {
                festivals.push({ name: 'Vinayaka Chaturthi', icon: 'bi-flower2' });
            }
            // Pradosh Vrat on Trayodashi
            if (pakshaTithiIndex === 12) {
                festivals.push({ name: 'Pradosh Vrat', icon: 'bi-brightness-alt-high-fill' });
            }

            return festivals;
        };

        const { dos, donts } = getDosAndDonts();

        return {
            tithi: `${tithi.name} (${tithi.hindi})`,
            tithiEndTime: tithiEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            nakshatra: `${nakshatra.name} (${nakshatra.hindi})`,
            nakshatraEndTime: nakshatraEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            nakshatraLord: nakshatra.lord,
            yoga: `${yoga.name} (${yoga.hindi})`,
            yogaEndTime: yogaEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            karana: `${karana.name} (${karana.hindi})`,
            karanaEndTime: karanaEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            vara: `${varas[dayOfWeek].name}`,
            varaLord: varas[dayOfWeek].lord,
            paksha: isShukla ? 'Shukla Paksha (शुक्ल पक्ष)' : 'Krishna Paksha (कृष्ण पक्ष)',
            moonPhaseIcon: getMoonPhaseIcon(pakshaTithiIndex, isShukla),
            moonSign: moonSign.name,
            moonSignHindi: moonSign.hindi,
            sunSign: sunSign.name,
            sunSignHindi: sunSign.hindi,
            hinduMonth: hinduMonth,
            vikramSamvat: vikramSamvat,

            // Timings
            sunrise: formatTime(sunriseHour),
            sunset: formatTime(sunsetHour),
            moonrise: formatTime(sunriseHour + (tithiIndex * 0.8) % 12), // Approximate
            moonset: formatTime(sunsetHour + (tithiIndex * 0.8) % 12), // Approximate

            // Auspicious timings
            brahmaMuhurat: `${formatTime(brahmaStart)} - ${formatTime(brahmaEnd)}`,
            abhijitMuhurat: `${formatTime(abhijitStart)} - ${formatTime(abhijitEnd)}`,
            vijayMuhurat: `${formatTime(vijayStart)} - ${formatTime(vijayEnd)}`,
            godhuliMuhurat: `${formatTime(godhuliStart)} - ${formatTime(godhuliEnd)}`,
            amritKaal: `${formatTime(amritStart)} - ${formatTime(amritEnd)}`,

            // Inauspicious timings
            rahuKaal: `${formatTime(rahuKaalStart)} - ${formatTime(rahuKaalEnd)}`,
            yamagandaKaal: `${formatTime(yamaStart)} - ${formatTime(yamaEnd)}`,
            gulikaKaal: `${formatTime(gulikaStart)} - ${formatTime(gulikaEnd)}`,
            durMuhurat: `${formatTime(durStart)} - ${formatTime(durEnd)}`,
            varjyam: `${formatTime(varjyamStart)} - ${formatTime(varjyamEnd)}`,

            // Additional info
            dishaShool: `${dishaShoolMap[dayOfWeek]} direction`,
            luckyColor: luckyColorMap[dayOfWeek],
            luckyNumber: luckyNumberMap[dayOfWeek],

            // Do's and Don'ts
            dos: dos,
            donts: donts,

            // Festivals
            festivals: getFestivals()
        };
    },

    /**
     * Get accurate Vedic mantra for ruling planet
     */
    getPlanetMantra(ruling) {
        // Accurate Vedic Beej Mantras for each planet
        const mantras = {
            'Sun': 'Om Hraam Hreem Hraum Sah Suryaya Namaha',
            'Moon': 'Om Shraam Shreem Shraum Sah Chandraya Namaha',
            'Mars': 'Om Kraam Kreem Kraum Sah Bhaumaya Namaha',
            'Mercury': 'Om Braam Breem Braum Sah Budhaya Namaha',
            'Jupiter': 'Om Graam Greem Graum Sah Gurave Namaha',
            'Venus': 'Om Draam Dreem Draum Sah Shukraya Namaha',
            'Saturn': 'Om Praam Preem Praum Sah Shanaischaraya Namaha',
            'Rahu': 'Om Bhraam Bhreem Bhraum Sah Rahave Namaha',
            'Ketu': 'Om Sraam Sreem Sraum Sah Ketave Namaha',
            // Handle combined rulers
            'Mars/Pluto': 'Om Kraam Kreem Kraum Sah Bhaumaya Namaha',
            'Saturn/Uranus': 'Om Praam Preem Praum Sah Shanaischaraya Namaha',
            'Jupiter/Neptune': 'Om Graam Greem Graum Sah Gurave Namaha'
        };

        return mantras[ruling] || 'Om Namah Shivaya';
    },

    /**
     * Render Remedies page - World Class Edition
     */
    renderRemedies(profile, isHindi) {
        // Use user's preferred zodiac system (Western or Vedic)
        const zodiac = profile.birthDate ? MayaAstrology.getZodiac(profile.birthDate, profile) : null;
        const zodiacSystem = MayaAstrology.getZodiacSystem();

        // Get detailed remedy data for this zodiac
        const remedyData = zodiac ? this.getRemedyData(zodiac, isHindi) : null;

        return `
            <div class="maya-page maya-remedies-page">
                <div class="maya-page__content">
                    
                   

                    ${zodiac ? `
                        <!-- User's Zodiac Summary -->
                        <div class="maya-remedies__zodiac-card">
                            <div class="maya-remedies__zodiac-image">
                                <img src="images/zodiac-signs/${zodiac.name.toLowerCase()}.png" alt="${zodiac.name}">
                            </div>
                            <div class="maya-remedies__zodiac-info">
                                <h3>${isHindi ? zodiac.hindi : zodiac.name}</h3>
                                <p>${isHindi ? 'स्वामी ग्रह' : 'Ruling Planet'}: <strong>${zodiac.ruling}</strong></p>
                            </div>
                            <div class="maya-remedies__zodiac-element" style="background: ${this.getElementColor(zodiac.element)}20; color: ${this.getElementColor(zodiac.element)};">
                                <i class="bi ${this.getElementIcon(zodiac.element)}"></i>
                                <span>${zodiac.element}</span>
                            </div>
                        </div>

                        <!-- Gemstone Section -->
                        <div class="maya-remedies__section maya-remedies__section--gemstone">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #8b5cf6, #a855f7);">
                                    <i class="bi bi-gem"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'रत्न चिकित्सा' : 'Gemstone Therapy'}</h4>
                                    <p>${isHindi ? 'ग्रहों की शक्ति बढ़ाने के लिए' : 'Amplify planetary powers'}</p>
                                </div>
                            </div>
                            
                            <div class="maya-remedies__gemstone-showcase">
                                <div class="maya-remedies__gemstone-visual">
                                    <div class="maya-remedies__gemstone-glow" style="background: ${remedyData.gemstone.color};"></div>
                                    <img src="images/gemstones/${remedyData.gemstone.image}" alt="${remedyData.gemstone.name}" class="maya-remedies__gemstone-img">
                                </div>
                                <div class="maya-remedies__gemstone-details">
                                    <h3 class="maya-remedies__gemstone-name">${remedyData.gemstone.name}</h3>
                                    <p class="maya-remedies__gemstone-hindi">${remedyData.gemstone.hindi}</p>
                                    <div class="maya-remedies__gemstone-planet">
                                        <i class="bi bi-circle-fill"></i>
                                        <span>${isHindi ? 'ग्रह' : 'Planet'}: ${zodiac.ruling}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="maya-remedies__action-grid">
                                <div class="maya-remedies__action-item">
                                    <div class="maya-remedies__action-icon">
                                        <i class="bi bi-hand-index-fill"></i>
                                    </div>
                                    <div class="maya-remedies__action-content">
                                        <span class="maya-remedies__action-label">${isHindi ? 'उंगली' : 'Finger'}</span>
                                        <span class="maya-remedies__action-value">${remedyData.gemstone.finger}</span>
                                    </div>
                                </div>
                                <div class="maya-remedies__action-item">
                                    <div class="maya-remedies__action-icon">
                                        <i class="bi bi-circle"></i>
                                    </div>
                                    <div class="maya-remedies__action-content">
                                        <span class="maya-remedies__action-label">${isHindi ? 'धातु' : 'Metal'}</span>
                                        <span class="maya-remedies__action-value">${remedyData.gemstone.metal}</span>
                                    </div>
                                </div>
                                <div class="maya-remedies__action-item">
                                    <div class="maya-remedies__action-icon">
                                        <i class="bi bi-calendar-event"></i>
                                    </div>
                                    <div class="maya-remedies__action-content">
                                        <span class="maya-remedies__action-label">${isHindi ? 'धारण दिन' : 'Wear Day'}</span>
                                        <span class="maya-remedies__action-value">${remedyData.gemstone.day}</span>
                                    </div>
                                </div>
                                <div class="maya-remedies__action-item">
                                    <div class="maya-remedies__action-icon">
                                        <i class="bi bi-sunrise"></i>
                                    </div>
                                    <div class="maya-remedies__action-content">
                                        <span class="maya-remedies__action-label">${isHindi ? 'समय' : 'Time'}</span>
                                        <span class="maya-remedies__action-value">${remedyData.gemstone.time}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="maya-remedies__tips-box">
                                <div class="maya-remedies__tips-header">
                                    <i class="bi bi-lightbulb-fill"></i>
                                    <span>${isHindi ? 'धारण विधि' : 'How to Wear'}</span>
                                </div>
                                <ul class="maya-remedies__tips-list">
                                    ${remedyData.gemstone.tips.map(tip => `
                                        <li><i class="bi bi-check-circle-fill"></i> ${tip}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>

                        <!-- Mantra Section -->
                        <div class="maya-remedies__section maya-remedies__section--mantra">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #22c55e, #10b981);">
                                    <i class="bi bi-music-note-beamed"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'पवित्र मंत्र' : 'Sacred Mantras'}</h4>
                                    <p>${isHindi ? 'ग्रह शांति के लिए' : 'For planetary peace'}</p>
                                </div>
                            </div>

                            <div class="maya-remedies__mantra-card maya-remedies__mantra-card--primary">
                                <div class="maya-remedies__mantra-badge">${isHindi ? 'बीज मंत्र' : 'Beej Mantra'}</div>
                                <div class="maya-remedies__mantra-text">${remedyData.mantras.beej}</div>
                                <div class="maya-remedies__mantra-info">
                                    <span><i class="bi bi-123"></i> ${isHindi ? '108 बार जपें' : 'Chant 108 times'}</span>
                                </div>
                            </div>

                            <div class="maya-remedies__mantra-card">
                                <div class="maya-remedies__mantra-badge">${isHindi ? 'ग्रह मंत्र' : 'Planet Mantra'}</div>
                                <div class="maya-remedies__mantra-text maya-remedies__mantra-text--sm">${remedyData.mantras.planet}</div>
                            </div>

                            <div class="maya-remedies__chant-guide">
                                <h5><i class="bi bi-journal-text"></i> ${isHindi ? 'जप विधि' : 'Chanting Guide'}</h5>
                                <div class="maya-remedies__chant-steps">
                                    ${remedyData.mantras.guide.map((step, idx) => `
                                        <div class="maya-remedies__chant-step">
                                            <div class="maya-remedies__step-num">${idx + 1}</div>
                                            <span>${step}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Daily Practices Section -->
                        <div class="maya-remedies__section maya-remedies__section--daily">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #f59e0b, #fbbf24);">
                                    <i class="bi bi-calendar-check-fill"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'दैनिक अनुष्ठान' : 'Daily Rituals'}</h4>
                                    <p>${isHindi ? 'नियमित अभ्यास' : 'Regular practices'}</p>
                                </div>
                            </div>

                            <div class="maya-remedies__rituals-grid">
                                ${remedyData.dailyRituals.map(ritual => `
                                    <div class="maya-remedies__ritual-card">
                                        <div class="maya-remedies__ritual-time">
                                            <i class="bi ${ritual.timeIcon}"></i>
                                            <span>${ritual.time}</span>
                                        </div>
                                        <div class="maya-remedies__ritual-icon" style="background: ${ritual.color}20; color: ${ritual.color};">
                                            <i class="bi ${ritual.icon}"></i>
                                        </div>
                                        <h5 class="maya-remedies__ritual-title">${ritual.title}</h5>
                                        <p class="maya-remedies__ritual-desc">${ritual.description}</p>
                                        <div class="maya-remedies__ritual-benefit">
                                            <i class="bi bi-star-fill"></i>
                                            <span>${ritual.benefit}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Fasting & Charity Section -->
                        <div class="maya-remedies__section maya-remedies__section--charity">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #ec4899, #f472b6);">
                                    <i class="bi bi-heart-fill"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'व्रत एवं दान' : 'Fasting & Charity'}</h4>
                                    <p>${isHindi ? 'पुण्य संचय' : 'Accumulate merit'}</p>
                                </div>
                            </div>

                            <div class="maya-remedies__fast-card">
                                <div class="maya-remedies__fast-header">
                                    <i class="bi bi-cup-hot-fill"></i>
                                    <h5>${isHindi ? 'शुभ व्रत दिवस' : 'Auspicious Fasting Day'}</h5>
                                </div>
                                <div class="maya-remedies__fast-day">
                                    <span class="maya-remedies__fast-day-name">${remedyData.fasting.day}</span>
                                    <span class="maya-remedies__fast-day-planet">${isHindi ? 'के लिए' : 'for'} ${zodiac.ruling}</span>
                                </div>
                                <div class="maya-remedies__fast-tips">
                                    ${remedyData.fasting.tips.map(tip => `
                                        <div class="maya-remedies__fast-tip">
                                            <i class="bi bi-dot"></i>
                                            <span>${tip}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="maya-remedies__charity-grid">
                                <h5><i class="bi bi-gift-fill"></i> ${isHindi ? 'दान सुझाव' : 'Charity Suggestions'}</h5>
                                <div class="maya-remedies__charity-items">
                                    ${remedyData.charity.map(item => `
                                        <div class="maya-remedies__charity-item">
                                            <i class="bi ${item.icon}"></i>
                                            <span>${item.name}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Lucky Elements Section -->
                        <div class="maya-remedies__section maya-remedies__section--lucky">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #3b82f6, #60a5fa);">
                                    <i class="bi bi-four-leaf-clover"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'शुभ तत्व' : 'Lucky Elements'}</h4>
                                    <p>${isHindi ? 'अपनी ऊर्जा बढ़ाएं' : 'Enhance your energy'}</p>
                                </div>
                            </div>

                            <div class="maya-remedies__lucky-grid">
                                <div class="maya-remedies__lucky-item">
                                    <div class="maya-remedies__lucky-icon" style="background: ${zodiac.color};">
                                        <i class="bi bi-palette-fill"></i>
                                    </div>
                                    <span class="maya-remedies__lucky-label">${isHindi ? 'शुभ रंग' : 'Lucky Color'}</span>
                                    <span class="maya-remedies__lucky-value">${zodiac.colorName}</span>
                                </div>
                                <div class="maya-remedies__lucky-item">
                                    <div class="maya-remedies__lucky-icon" style="background: #f59e0b;">
                                        <i class="bi bi-dice-5-fill"></i>
                                    </div>
                                    <span class="maya-remedies__lucky-label">${isHindi ? 'शुभ अंक' : 'Lucky Numbers'}</span>
                                    <span class="maya-remedies__lucky-value">${zodiac.luckyNumbers?.join(', ') || '1, 5, 9'}</span>
                                </div>
                                <div class="maya-remedies__lucky-item">
                                    <div class="maya-remedies__lucky-icon" style="background: #22c55e;">
                                        <i class="bi bi-calendar-day-fill"></i>
                                    </div>
                                    <span class="maya-remedies__lucky-label">${isHindi ? 'शुभ दिन' : 'Lucky Day'}</span>
                                    <span class="maya-remedies__lucky-value">${zodiac.luckyDay}</span>
                                </div>
                                <div class="maya-remedies__lucky-item">
                                    <div class="maya-remedies__lucky-icon" style="background: #8b5cf6;">
                                        <i class="bi bi-compass-fill"></i>
                                    </div>
                                    <span class="maya-remedies__lucky-label">${isHindi ? 'शुभ दिशा' : 'Lucky Direction'}</span>
                                    <span class="maya-remedies__lucky-value">${zodiac.direction}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Dos and Don'ts -->
                        <div class="maya-remedies__section maya-remedies__section--dos">
                            <div class="maya-remedies__section-header">
                                <div class="maya-remedies__section-icon" style="background: linear-gradient(135deg, #06b6d4, #22d3ee);">
                                    <i class="bi bi-list-check"></i>
                                </div>
                                <div>
                                    <h4>${isHindi ? 'करें और न करें' : "Do's & Don'ts"}</h4>
                                    <p>${isHindi ? 'जीवनशैली मार्गदर्शन' : 'Lifestyle guidance'}</p>
                                </div>
                            </div>

                            <div class="maya-remedies__dos-grid">
                                <div class="maya-remedies__dos-column maya-remedies__dos-column--do">
                                    <h5><i class="bi bi-check-circle-fill"></i> ${isHindi ? 'करें' : "Do's"}</h5>
                                    <ul>
                                        ${remedyData.dos.map(item => `<li>${item}</li>`).join('')}
                                    </ul>
                                </div>
                                <div class="maya-remedies__dos-column maya-remedies__dos-column--dont">
                                    <h5><i class="bi bi-x-circle-fill"></i> ${isHindi ? 'न करें' : "Don'ts"}</h5>
                                    <ul>
                                        ${remedyData.donts.map(item => `<li>${item}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <!-- CTA -->
                        <div class="maya-remedies__cta">
                            <div class="maya-remedies__cta-content">
                                <div>
                                    <h5>${isHindi ? 'व्यक्तिगत मार्गदर्शन चाहिए?' : 'Need Personalized Guidance?'}</h5>
                                </div>
                            </div>
                            <button class="maya-btn maya-btn--primary" data-action="showMaya">
                                <span>${isHindi ? 'MAYA से पूछें' : 'Ask MAYA'}</span>
                                <i class="bi bi-arrow-right"></i>
                            </button>
                        </div>

                        <!-- Disclaimer -->
                        <div class="maya-remedies__disclaimer">
                            <i class="bi bi-info-circle"></i>
                            <p>${isHindi ?
                    'ये उपाय सामान्य वैदिक ज्ञान पर आधारित हैं। किसी भी रत्न धारण करने से पहले किसी योग्य ज्योतिषी से परामर्श अवश्य करें।' :
                    'These remedies are based on general Vedic knowledge. Please consult a qualified professional before wearing any gemstone.'
                }</p>
                        </div>
                    ` : `
                        <!-- Empty State -->
                        <div class="maya-remedies__empty">
                            <div class="maya-remedies__empty-icon">
                                <i class="bi bi-person-exclamation"></i>
                            </div>
                            <h3>${isHindi ? 'जन्म विवरण आवश्यक' : 'Birth Details Required'}</h3>
                            <p>${isHindi ? 'व्यक्तिगत उपाय प्राप्त करने के लिए कृपया अपनी जन्म तिथि जोड़ें' : 'Please add your birth date to get personalized remedies'}</p>
                            <button class="maya-btn maya-btn--primary maya-btn--lg" data-page="profile">
                                <i class="bi bi-person-plus-fill"></i>
                                <span>${isHindi ? 'जन्म विवरण जोड़ें' : 'Add Birth Details'}</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    /**
     * Get detailed remedy data for zodiac
     */
    getRemedyData(zodiac, isHindi) {
        const planetRemedies = {
            'Sun': {
                gemstone: {
                    name: 'Ruby',
                    hindi: 'माणिक्य',
                    color: '#e74c3c',
                    image: 'ruby.png',
                    finger: isHindi ? 'अनामिका (दाएं हाथ)' : 'Ring Finger (Right)',
                    metal: isHindi ? 'सोना' : 'Gold',
                    day: isHindi ? 'रविवार' : 'Sunday',
                    time: isHindi ? 'सूर्योदय' : 'Sunrise',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के रविवार को धारण करें',
                        'धारण से पहले गंगाजल से शुद्ध करें',
                        'सूर्य मंत्र का 108 बार जाप करें',
                        'कम से कम 3-5 कैरेट का रत्न'
                    ] : [
                        'Wear on Sunday during Shukla Paksha',
                        'Purify with Gangajal before wearing',
                        'Chant Surya mantra 108 times',
                        'Minimum 3-5 carat stone recommended'
                    ]
                },
                mantras: {
                    beej: 'ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः',
                    planet: 'ॐ घृणि सूर्याय नमः',
                    guide: isHindi ? [
                        'प्रातः सूर्योदय के समय पूर्व दिशा में मुख करें',
                        'तांबे के लोटे से सूर्य को जल अर्पित करें',
                        '108 बार मंत्र का जाप करें',
                        'लाल चंदन का तिलक लगाएं'
                    ] : [
                        'Face east during sunrise',
                        'Offer water to Sun with copper vessel',
                        'Chant the mantra 108 times',
                        'Apply red sandalwood tilak'
                    ]
                },
                fasting: {
                    day: isHindi ? 'रविवार' : 'Sunday',
                    tips: isHindi ? [
                        'नमक रहित भोजन करें',
                        'सूर्यास्त से पहले भोजन करें',
                        'गेहूं, गुड़ का दान करें'
                    ] : [
                        'Consume salt-free food',
                        'Eat before sunset',
                        'Donate wheat and jaggery'
                    ]
                },
                charity: [
                    { name: isHindi ? 'गेहूं' : 'Wheat', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'गुड़' : 'Jaggery', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'तांबा' : 'Copper', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'लाल वस्त्र' : 'Red Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'सूर्य नमस्कार' : 'Surya Namaskar', description: isHindi ? '12 आसन करें' : 'Perform 12 poses', icon: 'bi-sun-fill', color: '#f59e0b', time: isHindi ? 'प्रातः 6 बजे' : '6:00 AM', timeIcon: 'bi-sunrise-fill', benefit: isHindi ? 'ऊर्जा व आत्मविश्वास' : 'Energy & confidence' },
                    { title: isHindi ? 'जल अर्पण' : 'Water Offering', description: isHindi ? 'सूर्य को जल दें' : 'Offer to the Sun', icon: 'bi-droplet-fill', color: '#3b82f6', time: isHindi ? 'सूर्योदय' : 'Sunrise', timeIcon: 'bi-sunrise', benefit: isHindi ? 'पितृ दोष शांति' : 'Ancestral blessings' },
                    { title: isHindi ? 'लाल रंग धारण' : 'Wear Red', description: isHindi ? 'लाल/नारंगी पहनें' : 'Red or orange attire', icon: 'bi-palette-fill', color: '#ef4444', time: isHindi ? 'पूरे दिन' : 'All day', timeIcon: 'bi-clock', benefit: isHindi ? 'ग्रह शक्ति वृद्धि' : 'Enhance planet power' }
                ],
                dos: isHindi ? ['प्रातः जल्दी उठें', 'सूर्य को जल दें', 'पिताजी का आशीर्वाद लें', 'लाल फूल चढ़ाएं'] : ['Wake up early', 'Offer water to Sun', 'Seek father\'s blessings', 'Offer red flowers'],
                donts: isHindi ? ['सूर्यास्त के बाद भोजन न करें', 'पिताजी का अपमान न करें', 'काले कपड़े न पहनें'] : ['Don\'t eat after sunset', 'Don\'t disrespect father', 'Avoid black clothes']
            },
            'Moon': {
                gemstone: {
                    name: 'Pearl',
                    hindi: 'मोती',
                    color: '#ecf0f1',
                    image: 'pearl.png',
                    finger: isHindi ? 'कनिष्ठा (दाएं हाथ)' : 'Little Finger (Right)',
                    metal: isHindi ? 'चांदी' : 'Silver',
                    day: isHindi ? 'सोमवार' : 'Monday',
                    time: isHindi ? 'शाम' : 'Evening',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के सोमवार को धारण करें',
                        'कच्चे दूध में रात भर रखें',
                        'चंद्र मंत्र का जाप करें',
                        'प्राकृतिक मोती का चयन करें'
                    ] : [
                        'Wear on Monday during Shukla Paksha',
                        'Soak in raw milk overnight',
                        'Chant Chandra mantra',
                        'Choose natural pearl'
                    ]
                },
                mantras: {
                    beej: 'ॐ श्रां श्रीं श्रौं सः चंद्राय नमः',
                    planet: 'ॐ सोम सोमाय नमः',
                    guide: isHindi ? [
                        'सोमवार को शाम के समय जाप करें',
                        'श्वेत वस्त्र धारण करें',
                        'चंद्रमा को जल अर्पित करें',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Monday evening',
                        'Wear white clothes',
                        'Offer water to Moon',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'सोमवार' : 'Monday',
                    tips: isHindi ? [
                        'दूध व फल का सेवन करें',
                        'शिव जी की पूजा करें',
                        'चावल का दान करें'
                    ] : [
                        'Consume milk and fruits',
                        'Worship Lord Shiva',
                        'Donate rice'
                    ]
                },
                charity: [
                    { name: isHindi ? 'चावल' : 'Rice', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'दूध' : 'Milk', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'चांदी' : 'Silver', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'सफेद वस्त्र' : 'White Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'ध्यान' : 'Meditation', description: isHindi ? '15 मिनट शांत बैठें' : '15 min silent sitting', icon: 'bi-flower1', color: '#8b5cf6', time: isHindi ? 'रात्रि' : 'Night', timeIcon: 'bi-moon-stars-fill', benefit: isHindi ? 'मन की शांति' : 'Peace of mind' },
                    { title: isHindi ? 'दूध पीएं' : 'Drink Milk', description: isHindi ? 'रात को गर्म दूध' : 'Warm milk at night', icon: 'bi-cup-hot-fill', color: '#f8fafc', time: isHindi ? 'सोने से पहले' : 'Before sleep', timeIcon: 'bi-moon-fill', benefit: isHindi ? 'नींद में सुधार' : 'Better sleep' },
                    { title: isHindi ? 'माता का आशीर्वाद' : 'Mother\'s Blessing', description: isHindi ? 'माता के चरण स्पर्श' : 'Touch mother\'s feet', icon: 'bi-heart-fill', color: '#ec4899', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise', benefit: isHindi ? 'चंद्र दोष शांति' : 'Moon dosha remedy' }
                ],
                dos: isHindi ? ['माता की सेवा करें', 'सफेद वस्त्र पहनें', 'जल अधिक पीएं', 'ध्यान करें'] : ['Serve your mother', 'Wear white clothes', 'Drink more water', 'Practice meditation'],
                donts: isHindi ? ['माता का अपमान न करें', 'दूध न बर्बाद करें', 'क्रोध न करें'] : ['Don\'t disrespect mother', 'Don\'t waste milk', 'Avoid anger']
            },
            'Mars': {
                gemstone: {
                    name: 'Red Coral',
                    hindi: 'मूंगा',
                    color: '#e74c3c',
                    image: 'coral.png',
                    finger: isHindi ? 'अनामिका (दाएं हाथ)' : 'Ring Finger (Right)',
                    metal: isHindi ? 'तांबा/सोना' : 'Copper/Gold',
                    day: isHindi ? 'मंगलवार' : 'Tuesday',
                    time: isHindi ? 'प्रातः' : 'Morning',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के मंगलवार को धारण करें',
                        'गंगाजल व कच्चे दूध से शुद्ध करें',
                        'हनुमान जी की पूजा करें',
                        '6-9 रत्ती का मूंगा पहनें'
                    ] : [
                        'Wear on Tuesday during Shukla Paksha',
                        'Purify with Gangajal and raw milk',
                        'Worship Lord Hanuman',
                        'Wear 6-9 ratti coral'
                    ]
                },
                mantras: {
                    beej: 'ॐ क्रां क्रीं क्रौं सः भौमाय नमः',
                    planet: 'ॐ अंगारकाय नमः',
                    guide: isHindi ? [
                        'मंगलवार को प्रातः जाप करें',
                        'लाल वस्त्र धारण करें',
                        'हनुमान चालीसा पढ़ें',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Tuesday morning',
                        'Wear red clothes',
                        'Recite Hanuman Chalisa',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'मंगलवार' : 'Tuesday',
                    tips: isHindi ? [
                        'गुड़ व चना खाएं',
                        'हनुमान जी को सिंदूर चढ़ाएं',
                        'मसूर दाल का दान करें'
                    ] : [
                        'Eat jaggery and gram',
                        'Offer sindoor to Hanuman',
                        'Donate masoor dal'
                    ]
                },
                charity: [
                    { name: isHindi ? 'मसूर दाल' : 'Red Lentils', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'गुड़' : 'Jaggery', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'तांबा' : 'Copper', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'लाल वस्त्र' : 'Red Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'व्यायाम' : 'Exercise', description: isHindi ? '30 मिनट शारीरिक व्यायाम' : '30 min physical activity', icon: 'bi-activity', color: '#ef4444', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise-fill', benefit: isHindi ? 'ऊर्जा व शक्ति' : 'Energy & strength' },
                    { title: isHindi ? 'हनुमान चालीसा' : 'Hanuman Chalisa', description: isHindi ? 'पाठ करें' : 'Recite daily', icon: 'bi-book-fill', color: '#f97316', time: isHindi ? 'मंगलवार/शनिवार' : 'Tue/Sat', timeIcon: 'bi-calendar-event', benefit: isHindi ? 'मंगल दोष शांति' : 'Mars dosha remedy' },
                    { title: isHindi ? 'भूमि स्पर्श' : 'Touch Earth', description: isHindi ? 'नंगे पैर चलें' : 'Walk barefoot', icon: 'bi-globe-asia-australia', color: '#84cc16', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise', benefit: isHindi ? 'ग्राउंडिंग ऊर्जा' : 'Grounding energy' }
                ],
                dos: isHindi ? ['व्यायाम करें', 'भाई की सेवा करें', 'साहसी बनें', 'सत्य बोलें'] : ['Exercise regularly', 'Help your siblings', 'Be courageous', 'Speak truth'],
                donts: isHindi ? ['क्रोध न करें', 'हिंसा से बचें', 'लाल मिर्च न खाएं'] : ['Avoid anger', 'Avoid violence', 'Reduce spicy food']
            },
            'Mercury': {
                gemstone: {
                    name: 'Emerald',
                    hindi: 'पन्ना',
                    color: '#2ecc71',
                    image: 'emerald.png',
                    finger: isHindi ? 'कनिष्ठा (दाएं हाथ)' : 'Little Finger (Right)',
                    metal: isHindi ? 'सोना' : 'Gold',
                    day: isHindi ? 'बुधवार' : 'Wednesday',
                    time: isHindi ? 'सूर्योदय के 2 घंटे बाद' : '2 hrs after sunrise',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के बुधवार को धारण करें',
                        'दूध व गंगाजल से शुद्ध करें',
                        'बुध मंत्र का जाप करें',
                        '3-6 कैरेट का पन्ना पहनें'
                    ] : [
                        'Wear on Wednesday during Shukla Paksha',
                        'Purify with milk and Gangajal',
                        'Chant Budh mantra',
                        'Wear 3-6 carat emerald'
                    ]
                },
                mantras: {
                    beej: 'ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः',
                    planet: 'ॐ बुं बुधाय नमः',
                    guide: isHindi ? [
                        'बुधवार को प्रातः जाप करें',
                        'हरे वस्त्र धारण करें',
                        'विष्णु जी की पूजा करें',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Wednesday morning',
                        'Wear green clothes',
                        'Worship Lord Vishnu',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'बुधवार' : 'Wednesday',
                    tips: isHindi ? [
                        'हरी सब्जियां खाएं',
                        'मूंग दाल का सेवन करें',
                        'हरी वस्तुओं का दान करें'
                    ] : [
                        'Eat green vegetables',
                        'Consume moong dal',
                        'Donate green items'
                    ]
                },
                charity: [
                    { name: isHindi ? 'मूंग दाल' : 'Moong Dal', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'हरी सब्जियां' : 'Green Vegetables', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'कांसा' : 'Bronze', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'हरे वस्त्र' : 'Green Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'अध्ययन' : 'Study', description: isHindi ? 'नई चीजें सीखें' : 'Learn new things', icon: 'bi-book-fill', color: '#22c55e', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise-fill', benefit: isHindi ? 'बुद्धि वृद्धि' : 'Enhanced intellect' },
                    { title: isHindi ? 'लेखन' : 'Writing', description: isHindi ? 'डायरी लिखें' : 'Journal daily', icon: 'bi-pencil-fill', color: '#10b981', time: isHindi ? 'शाम' : 'Evening', timeIcon: 'bi-sunset', benefit: isHindi ? 'संवाद कुशलता' : 'Communication skills' },
                    { title: isHindi ? 'तुलसी पूजा' : 'Tulsi Worship', description: isHindi ? 'तुलसी को जल दें' : 'Water tulsi plant', icon: 'bi-flower2', color: '#84cc16', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise', benefit: isHindi ? 'बुध ग्रह शांति' : 'Mercury peace' }
                ],
                dos: isHindi ? ['नई चीजें सीखें', 'संवाद करें', 'हरे रंग पहनें', 'पुस्तकें पढ़ें'] : ['Learn new things', 'Communicate clearly', 'Wear green colors', 'Read books'],
                donts: isHindi ? ['झूठ न बोलें', 'बहन का अपमान न करें', 'नशा न करें'] : ['Don\'t lie', 'Don\'t disrespect sister', 'Avoid intoxicants']
            },
            'Jupiter': {
                gemstone: {
                    name: 'Yellow Sapphire',
                    hindi: 'पुखराज',
                    color: '#f1c40f',
                    image: 'topaz.png',
                    finger: isHindi ? 'तर्जनी (दाएं हाथ)' : 'Index Finger (Right)',
                    metal: isHindi ? 'सोना' : 'Gold',
                    day: isHindi ? 'गुरुवार' : 'Thursday',
                    time: isHindi ? 'सूर्योदय' : 'Sunrise',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के गुरुवार को धारण करें',
                        'गंगाजल व दूध से शुद्ध करें',
                        'गुरु मंत्र का जाप करें',
                        '3-5 कैरेट का पुखराज पहनें'
                    ] : [
                        'Wear on Thursday during Shukla Paksha',
                        'Purify with Gangajal and milk',
                        'Chant Guru mantra',
                        'Wear 3-5 carat yellow sapphire'
                    ]
                },
                mantras: {
                    beej: 'ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः',
                    planet: 'ॐ बृं बृहस्पतये नमः',
                    guide: isHindi ? [
                        'गुरुवार को प्रातः जाप करें',
                        'पीले वस्त्र धारण करें',
                        'विष्णु जी की पूजा करें',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Thursday morning',
                        'Wear yellow clothes',
                        'Worship Lord Vishnu',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'गुरुवार' : 'Thursday',
                    tips: isHindi ? [
                        'केले खाएं',
                        'पीले फूल चढ़ाएं',
                        'चने की दाल का दान करें'
                    ] : [
                        'Eat bananas',
                        'Offer yellow flowers',
                        'Donate chana dal'
                    ]
                },
                charity: [
                    { name: isHindi ? 'चने की दाल' : 'Chana Dal', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'केले' : 'Bananas', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'हल्दी' : 'Turmeric', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'पीले वस्त्र' : 'Yellow Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'गुरु वंदना' : 'Honor Teachers', description: isHindi ? 'बड़ों का आशीर्वाद लें' : 'Seek elders\' blessings', icon: 'bi-person-heart', color: '#f59e0b', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise-fill', benefit: isHindi ? 'ज्ञान प्राप्ति' : 'Gain wisdom' },
                    { title: isHindi ? 'दान करें' : 'Donate', description: isHindi ? 'जरूरतमंदों की सहायता' : 'Help the needy', icon: 'bi-gift-fill', color: '#eab308', time: isHindi ? 'गुरुवार' : 'Thursday', timeIcon: 'bi-calendar-event', benefit: isHindi ? 'धन वृद्धि' : 'Prosperity' },
                    { title: isHindi ? 'शिक्षा दें' : 'Teach Others', description: isHindi ? 'ज्ञान बांटें' : 'Share knowledge', icon: 'bi-mortarboard-fill', color: '#fcd34d', time: isHindi ? 'कभी भी' : 'Anytime', timeIcon: 'bi-clock', benefit: isHindi ? 'गुरु कृपा' : 'Guru\'s grace' }
                ],
                dos: isHindi ? ['गुरुओं का सम्मान करें', 'ज्ञान बांटें', 'दान करें', 'पीले वस्त्र पहनें'] : ['Respect teachers', 'Share knowledge', 'Donate regularly', 'Wear yellow clothes'],
                donts: isHindi ? ['गुरु का अपमान न करें', 'झूठ न बोलें', 'अहंकार न करें'] : ['Don\'t disrespect guru', 'Don\'t lie', 'Avoid arrogance']
            },
            'Venus': {
                gemstone: {
                    name: 'Diamond',
                    hindi: 'हीरा',
                    color: '#e8e8e8',
                    image: 'diamond.png',
                    finger: isHindi ? 'मध्यमा (दाएं हाथ)' : 'Middle Finger (Right)',
                    metal: isHindi ? 'प्लेटिनम/सफेद सोना' : 'Platinum/White Gold',
                    day: isHindi ? 'शुक्रवार' : 'Friday',
                    time: isHindi ? 'सूर्योदय' : 'Sunrise',
                    tips: isHindi ? [
                        'शुक्ल पक्ष के शुक्रवार को धारण करें',
                        'दूध व गंगाजल से शुद्ध करें',
                        'शुक्र मंत्र का जाप करें',
                        'कम से कम 0.5 कैरेट का हीरा'
                    ] : [
                        'Wear on Friday during Shukla Paksha',
                        'Purify with milk and Gangajal',
                        'Chant Shukra mantra',
                        'Minimum 0.5 carat diamond'
                    ]
                },
                mantras: {
                    beej: 'ॐ द्रां द्रीं द्रौं सः शुक्राय नमः',
                    planet: 'ॐ शुं शुक्राय नमः',
                    guide: isHindi ? [
                        'शुक्रवार को प्रातः जाप करें',
                        'सफेद वस्त्र धारण करें',
                        'लक्ष्मी जी की पूजा करें',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Friday morning',
                        'Wear white clothes',
                        'Worship Goddess Lakshmi',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'शुक्रवार' : 'Friday',
                    tips: isHindi ? [
                        'खीर का सेवन करें',
                        'लक्ष्मी पूजा करें',
                        'सफेद वस्तुओं का दान करें'
                    ] : [
                        'Consume kheer',
                        'Worship Lakshmi',
                        'Donate white items'
                    ]
                },
                charity: [
                    { name: isHindi ? 'चावल' : 'Rice', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'इत्र' : 'Perfume', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'चांदी' : 'Silver', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'सफेद वस्त्र' : 'White Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'सौंदर्य देखभाल' : 'Self Care', description: isHindi ? 'स्वयं की देखभाल करें' : 'Grooming routine', icon: 'bi-stars', color: '#ec4899', time: isHindi ? 'प्रातः' : 'Morning', timeIcon: 'bi-sunrise-fill', benefit: isHindi ? 'आकर्षण बढ़े' : 'Enhanced charm' },
                    { title: isHindi ? 'कला अभ्यास' : 'Practice Art', description: isHindi ? 'संगीत/चित्रकला' : 'Music/Painting', icon: 'bi-palette-fill', color: '#f472b6', time: isHindi ? 'शाम' : 'Evening', timeIcon: 'bi-sunset', benefit: isHindi ? 'रचनात्मकता' : 'Creativity' },
                    { title: isHindi ? 'पत्नी/साथी सम्मान' : 'Honor Partner', description: isHindi ? 'प्रेम व सम्मान दें' : 'Love and respect', icon: 'bi-heart-fill', color: '#ef4444', time: isHindi ? 'सदैव' : 'Always', timeIcon: 'bi-clock', benefit: isHindi ? 'वैवाहिक सुख' : 'Marital bliss' }
                ],
                dos: isHindi ? ['पत्नी का सम्मान करें', 'सुगंध लगाएं', 'कला सीखें', 'सुंदरता की सराहना करें'] : ['Respect spouse', 'Use fragrances', 'Learn arts', 'Appreciate beauty'],
                donts: isHindi ? ['स्त्री का अपमान न करें', 'अश्लीलता से बचें', 'फिजूलखर्ची न करें'] : ['Don\'t disrespect women', 'Avoid vulgarity', 'Don\'t overspend']
            },
            'Saturn': {
                gemstone: {
                    name: 'Blue Sapphire',
                    hindi: 'नीलम',
                    color: '#3498db',
                    image: 'sapphire.png',
                    finger: isHindi ? 'मध्यमा (दाएं हाथ)' : 'Middle Finger (Right)',
                    metal: isHindi ? 'लोहा/पंचधातु' : 'Iron/Panchdhatu',
                    day: isHindi ? 'शनिवार' : 'Saturday',
                    time: isHindi ? 'शाम' : 'Evening',
                    tips: isHindi ? [
                        'पहले 3 दिन परीक्षण करें',
                        'शनिवार शाम को धारण करें',
                        'शनि मंत्र का जाप करें',
                        '4-6 रत्ती का नीलम पहनें'
                    ] : [
                        'Test for 3 days first',
                        'Wear on Saturday evening',
                        'Chant Shani mantra',
                        'Wear 4-6 ratti blue sapphire'
                    ]
                },
                mantras: {
                    beej: 'ॐ प्रां प्रीं प्रौं सः शनैश्चराय नमः',
                    planet: 'ॐ शं शनैश्चराय नमः',
                    guide: isHindi ? [
                        'शनिवार को शाम को जाप करें',
                        'काले/नीले वस्त्र धारण करें',
                        'तेल का दीपक जलाएं',
                        '108 बार मंत्र का जाप करें'
                    ] : [
                        'Chant on Saturday evening',
                        'Wear black/blue clothes',
                        'Light oil lamp',
                        'Chant the mantra 108 times'
                    ]
                },
                fasting: {
                    day: isHindi ? 'शनिवार' : 'Saturday',
                    tips: isHindi ? [
                        'तिल व उड़द खाएं',
                        'हनुमान जी की पूजा करें',
                        'काली वस्तुओं का दान करें'
                    ] : [
                        'Eat sesame and urad',
                        'Worship Hanuman',
                        'Donate black items'
                    ]
                },
                charity: [
                    { name: isHindi ? 'उड़द दाल' : 'Urad Dal', icon: 'bi-basket-fill' },
                    { name: isHindi ? 'तिल का तेल' : 'Sesame Oil', icon: 'bi-cup-fill' },
                    { name: isHindi ? 'लोहा' : 'Iron', icon: 'bi-circle-fill' },
                    { name: isHindi ? 'काले वस्त्र' : 'Black Cloth', icon: 'bi-brush-fill' }
                ],
                dailyRituals: [
                    { title: isHindi ? 'सेवा करें' : 'Serve Others', description: isHindi ? 'गरीबों की सेवा' : 'Help the poor', icon: 'bi-people-fill', color: '#6366f1', time: isHindi ? 'शनिवार' : 'Saturday', timeIcon: 'bi-calendar-event', benefit: isHindi ? 'शनि कृपा' : 'Saturn\'s grace' },
                    { title: isHindi ? 'तेल चढ़ाएं' : 'Offer Oil', description: isHindi ? 'शनिदेव को तेल' : 'Oil to Shani Dev', icon: 'bi-droplet-fill', color: '#1e3a8a', time: isHindi ? 'शनिवार शाम' : 'Sat evening', timeIcon: 'bi-sunset', benefit: isHindi ? 'साढ़ेसाती शांति' : 'Sade Sati relief' },
                    { title: isHindi ? 'अनुशासन' : 'Discipline', description: isHindi ? 'नियमित दिनचर्या' : 'Regular routine', icon: 'bi-clock-history', color: '#0f172a', time: isHindi ? 'प्रतिदिन' : 'Daily', timeIcon: 'bi-clock', benefit: isHindi ? 'कर्म फल' : 'Karmic rewards' }
                ],
                dos: isHindi ? ['अनुशासन रखें', 'बड़ों का सम्मान करें', 'कठिन परिश्रम करें', 'धैर्य रखें'] : ['Be disciplined', 'Respect elders', 'Work hard', 'Be patient'],
                donts: isHindi ? ['आलस्य न करें', 'नौकरों का अपमान न करें', 'शराब न पीएं'] : ['Avoid laziness', 'Don\'t mistreat servants', 'Avoid alcohol']
            }
        };

        // Default to Sun if planet not found
        const planetData = planetRemedies[zodiac.ruling] || planetRemedies['Sun'];

        // Update gemstone name from zodiac config
        planetData.gemstone.name = zodiac.gemstone || planetData.gemstone.name;

        return planetData;
    },

    /**
     * Get element color
     */
    getElementColor(element) {
        const colors = {
            'Fire': '#ef4444',
            'Earth': '#84cc16',
            'Air': '#60a5fa',
            'Water': '#06b6d4'
        };
        return colors[element] || '#c79a3a';
    },

    /**
     * Get element icon
     */
    getElementIcon(element) {
        const icons = {
            'Fire': 'bi-fire',
            'Earth': 'bi-globe-asia-australia',
            'Air': 'bi-wind',
            'Water': 'bi-droplet-fill'
        };
        return icons[element] || 'bi-circle';
    },

    /**
     * Render Muhurat page
     */
    renderMuhurat(isHindi) {
        const activities = [
            { id: 'marriage', icon: 'bi-heart-fill', name: isHindi ? 'विवाह' : 'Marriage', nameEn: 'Marriage', desc: isHindi ? 'शादी और सगाई' : 'Wedding & Engagement', color: '#ec4899' },
            { id: 'griha_pravesh', icon: 'bi-house-door-fill', name: isHindi ? 'गृह प्रवेश' : 'House Warming', nameEn: 'Griha Pravesh', desc: isHindi ? 'नए घर में प्रवेश' : 'Enter new home', color: '#22c55e' },
            { id: 'business', icon: 'bi-briefcase-fill', name: isHindi ? 'व्यापार' : 'Start Business', nameEn: 'Business', desc: isHindi ? 'नया व्यापार' : 'Launch ventures', color: '#f59e0b' },
            { id: 'travel', icon: 'bi-airplane-fill', name: isHindi ? 'यात्रा' : 'Travel', nameEn: 'Travel', desc: isHindi ? 'लंबी यात्रा' : 'Long journeys', color: '#3b82f6' },
            { id: 'vehicle', icon: 'bi-car-front-fill', name: isHindi ? 'वाहन खरीद' : 'Vehicle', nameEn: 'Vehicle Purchase', desc: isHindi ? 'नया वाहन' : 'Buy vehicle', color: '#8b5cf6' },
            { id: 'property', icon: 'bi-building-fill', name: isHindi ? 'संपत्ति' : 'Property', nameEn: 'Property', desc: isHindi ? 'जमीन/मकान' : 'Land/Property', color: '#06b6d4' },
            { id: 'education', icon: 'bi-mortarboard-fill', name: isHindi ? 'शिक्षा' : 'Education', nameEn: 'Education', desc: isHindi ? 'विद्यारंभ' : 'Start learning', color: '#10b981' },
            { id: 'naming', icon: 'bi-person-badge-fill', name: isHindi ? 'नामकरण' : 'Naming', nameEn: 'Naming Ceremony', desc: isHindi ? 'नामकरण संस्कार' : 'Baby naming', color: '#f472b6' }
        ];

        // Get today's Panchang for context
        const todayPanchang = this.calculatePanchang(new Date());

        return `
            <div class="maya-page maya-muhurat-page">
                <div class="maya-page__content">
                    
                    <!-- Header -->
                    <div class="maya-muhurat__header">
                        <div class="maya-muhurat__header-icon">
                            <i class="bi bi-calendar2-check-fill"></i>
                        </div>
                        <div class="maya-muhurat__header-content">
                            <h2 class="maya-muhurat__title">${isHindi ? 'शुभ मुहूर्त' : 'Shubh Muhurat'}</h2>
                            <p class="maya-muhurat__subtitle">${isHindi ? 'शुभ कार्यों के लिए उत्तम समय' : 'Auspicious timings for important events'}</p>
                        </div>
                    </div>

                    <!-- Today's Quick Info -->
                    <div class="maya-muhurat__today-card">
                        <div class="maya-muhurat__today-header">
                            <i class="bi bi-sun-fill"></i>
                            <span>${isHindi ? 'आज का पंचांग सारांश' : "Today's Panchang Summary"}</span>
                        </div>
                        <div class="maya-muhurat__today-grid">
                            <div class="maya-muhurat__today-item">
                                <span class="maya-muhurat__today-label">${isHindi ? 'तिथि' : 'Tithi'}</span>
                                <span class="maya-muhurat__today-value">${todayPanchang.tithi.split('(')[0].trim()}</span>
                            </div>
                            <div class="maya-muhurat__today-item">
                                <span class="maya-muhurat__today-label">${isHindi ? 'नक्षत्र' : 'Nakshatra'}</span>
                                <span class="maya-muhurat__today-value">${todayPanchang.nakshatra.split('(')[0].trim()}</span>
                            </div>
                            <div class="maya-muhurat__today-item">
                                <span class="maya-muhurat__today-label">${isHindi ? 'वार' : 'Day'}</span>
                                <span class="maya-muhurat__today-value">${todayPanchang.vara}</span>
                            </div>
                            <div class="maya-muhurat__today-item">
                                <span class="maya-muhurat__today-label">${isHindi ? 'योग' : 'Yoga'}</span>
                                <span class="maya-muhurat__today-value">${todayPanchang.yoga.split('(')[0].trim()}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Activity Selector -->
                    <div class="maya-muhurat__section">
                        <div class="maya-muhurat__section-header">
                            <i class="bi bi-grid-3x3-gap-fill"></i>
                            <h5>${isHindi ? 'कार्य चुनें' : 'Select Activity'}</h5>
                        </div>
                        <div class="maya-muhurat__activity-grid">
                            ${activities.map((act, idx) => `
                                <button class="maya-muhurat__activity-btn ${idx === 0 ? 'maya-muhurat__activity-btn--active' : ''}" 
                                        data-activity="${act.id}" data-color="${act.color}">
                                    <div class="maya-muhurat__activity-icon" style="background: linear-gradient(135deg, ${act.color}25, ${act.color}10); color: ${act.color};">
                                        <i class="bi ${act.icon}"></i>
                                    </div>
                                    <span class="maya-muhurat__activity-name">${act.name}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Results Section -->
                    <div class="maya-muhurat__section">
                        <div class="maya-muhurat__section-header">
                            <i class="bi bi-calendar-check-fill"></i>
                            <h5>${isHindi ? 'आगामी शुभ तिथियां' : 'Upcoming Auspicious Dates'}</h5>
                        </div>
                        <div id="muhuratResults" class="maya-muhurat__results">
                            ${this.getMuhuratDates('marriage', isHindi)}
                        </div>
                    </div>

                    <!-- Calculation Methodology -->
                    <div class="maya-muhurat__methodology">
                        <div class="maya-muhurat__methodology-header">
                            <i class="bi bi-info-circle-fill"></i>
                            <h6>${isHindi ? 'गणना पद्धति' : 'Calculation Methodology'}</h6>
                        </div>
                        <div class="maya-muhurat__methodology-content">
                            <p>${isHindi ?
                'मुहूर्त गणना वैदिक ज्योतिष के अनुसार पंचांग तत्वों पर आधारित है: तिथि, नक्षत्र, योग, करण और वार।' :
                'Muhurat calculations are based on Vedic astrology principles using Panchang elements: Tithi, Nakshatra, Yoga, Karana, and Vara.'
            }</p>
                            <div class="maya-muhurat__methodology-factors">
                                <span><i class="bi bi-check-circle-fill"></i> ${isHindi ? 'शुभ तिथियां' : 'Auspicious Tithis'}</span>
                                <span><i class="bi bi-check-circle-fill"></i> ${isHindi ? 'शुभ नक्षत्र' : 'Favorable Nakshatras'}</span>
                                <span><i class="bi bi-check-circle-fill"></i> ${isHindi ? 'शुभ वार' : 'Lucky Days'}</span>
                                <span><i class="bi bi-check-circle-fill"></i> ${isHindi ? 'राहुकाल मुक्त' : 'Rahu Kaal Free'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Disclaimer -->
                    <div class="maya-muhurat__disclaimer">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>${isHindi ?
                'ये मुहूर्त सामान्य गणना पर आधारित हैं। महत्वपूर्ण कार्यों के लिए कृपया किसी योग्य professional से परामर्श करें।' :
                'These timing windows are based on general calculations. For important events, please consult a qualified professional for personalized guidance.'
            }</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get Muhurat dates for an activity - Real Vedic Calculations
     */
    getMuhuratDates(activity, isHindi = false) {
        // Vedic rules for different activities
        const activityRules = {
            marriage: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13], // Dwitiya, Tritiya, Panchami, Saptami, Dashami, Ekadashi, Dwadashi, Trayodashi
                auspiciousNakshatras: ['Rohini', 'Mrigashira', 'Magha', 'Uttara Phalguni', 'Hasta', 'Swati', 'Anuradha', 'Mula', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati'],
                auspiciousDays: [1, 3, 4, 5], // Monday, Wednesday, Thursday, Friday
                avoidDays: [2, 6], // Tuesday, Saturday
                icon: 'bi-heart-fill',
                color: '#ec4899'
            },
            griha_pravesh: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Rohini', 'Mrigashira', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Uttara Bhadrapada', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-house-door-fill',
                color: '#22c55e'
            },
            business: {
                auspiciousTithis: [2, 3, 5, 6, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-briefcase-fill',
                color: '#f59e0b'
            },
            travel: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Ashwini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Anuradha', 'Shravana', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-airplane-fill',
                color: '#3b82f6'
            },
            vehicle: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Uttara Bhadrapada', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-car-front-fill',
                color: '#8b5cf6'
            },
            property: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Rohini', 'Mrigashira', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Uttara Bhadrapada', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-building-fill',
                color: '#06b6d4'
            },
            education: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Ashwini', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Jyeshtha', 'Shravana', 'Dhanishta', 'Revati'],
                auspiciousDays: [1, 3, 4, 5], // Monday for mind, Wednesday for communication, Thursday for wisdom
                avoidDays: [2, 6],
                icon: 'bi-mortarboard-fill',
                color: '#10b981'
            },
            naming: {
                auspiciousTithis: [2, 3, 5, 7, 10, 11, 12, 13],
                auspiciousNakshatras: ['Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Uttara Bhadrapada', 'Revati'],
                auspiciousDays: [1, 3, 4, 5],
                avoidDays: [2, 6],
                icon: 'bi-person-badge-fill',
                color: '#f472b6'
            }
        };

        const rules = activityRules[activity] || activityRules.business;
        const muhuratDates = [];
        const today = new Date();

        // Check next 60 days for auspicious dates
        for (let i = 1; i <= 60 && muhuratDates.length < 6; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);

            const panchang = this.calculatePanchang(checkDate);
            const dayOfWeek = checkDate.getDay();

            // Extract tithi number
            const tithiName = panchang.tithi.split('(')[0].trim();
            const tithiNumber = this.getTithiNumber(tithiName);

            // Extract nakshatra name
            const nakshatraName = panchang.nakshatra.split('(')[0].trim();

            // Check if day is avoided
            if (rules.avoidDays.includes(dayOfWeek)) continue;

            // Check if tithi is auspicious
            const isTithiGood = rules.auspiciousTithis.includes(tithiNumber);

            // Check if nakshatra is auspicious
            const isNakshatraGood = rules.auspiciousNakshatras.includes(nakshatraName);

            // Check if day is favorable
            const isDayGood = rules.auspiciousDays.includes(dayOfWeek);

            // Check yoga (avoid inauspicious yogas)
            const yogaName = panchang.yoga.split('(')[0].trim();
            const badYogas = ['Vyatipata', 'Vaidhriti', 'Parigha', 'Vajra', 'Vyaghata', 'Shoola', 'Ganda', 'Atiganda'];
            const isYogaBad = badYogas.includes(yogaName);

            // Check karana (avoid Vishti/Bhadra)
            const karanaName = panchang.karana.split('(')[0].trim();
            const isKaranaBad = karanaName === 'Vishti';

            // Calculate quality score
            let score = 0;
            let qualityFactors = [];

            if (isTithiGood) { score += 25; qualityFactors.push(isHindi ? 'शुभ तिथि' : 'Good Tithi'); }
            if (isNakshatraGood) { score += 30; qualityFactors.push(isHindi ? 'शुभ नक्षत्र' : 'Good Nakshatra'); }
            if (isDayGood) { score += 20; qualityFactors.push(isHindi ? 'शुभ वार' : 'Good Day'); }
            if (!isYogaBad) { score += 15; qualityFactors.push(isHindi ? 'शुभ योग' : 'Good Yoga'); }
            if (!isKaranaBad) { score += 10; qualityFactors.push(isHindi ? 'शुभ करण' : 'Good Karana'); }

            // Only include if score is at least 50 (decent muhurat)
            if (score >= 50) {
                let quality, qualityClass;
                if (score >= 85) {
                    quality = isHindi ? 'अति शुभ' : 'Highly Auspicious';
                    qualityClass = 'excellent';
                } else if (score >= 70) {
                    quality = isHindi ? 'शुभ' : 'Auspicious';
                    qualityClass = 'good';
                } else {
                    quality = isHindi ? 'सामान्य शुभ' : 'Moderately Auspicious';
                    qualityClass = 'moderate';
                }

                // Calculate best muhurat time (avoid Rahu Kaal)
                const rahuKaalTimes = panchang.rahuKaal.split(' - ');
                const bestTime = this.calculateBestMuhuratTime(panchang, rahuKaalTimes);

                muhuratDates.push({
                    date: checkDate,
                    dateStr: checkDate.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                    }),
                    fullDate: checkDate.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }),
                    time: bestTime,
                    quality: quality,
                    qualityClass: qualityClass,
                    score: score,
                    tithi: tithiName,
                    nakshatra: nakshatraName,
                    day: panchang.vara,
                    factors: qualityFactors,
                    rahuKaal: panchang.rahuKaal,
                    icon: rules.icon,
                    color: rules.color
                });
            }
        }

        // Sort by score (best first)
        muhuratDates.sort((a, b) => b.score - a.score);

        if (muhuratDates.length === 0) {
            return `
                <div class="maya-muhurat__no-results">
                    <i class="bi bi-calendar-x"></i>
                    <p>${isHindi ? 'अगले 60 दिनों में कोई उपयुक्त मुहूर्त नहीं मिला' : 'No suitable muhurat found in the next 60 days'}</p>
                </div>
            `;
        }

        return muhuratDates.map((d, idx) => `
            <div class="maya-muhurat__result-card maya-muhurat__result-card--${d.qualityClass}">
                <div class="maya-muhurat__result-header">
                    <div class="maya-muhurat__result-date">
                        <div class="maya-muhurat__result-day-num">${d.date.getDate()}</div>
                        <div class="maya-muhurat__result-month">${d.date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { month: 'short' })}</div>
                    </div>
                    <div class="maya-muhurat__result-info">
                        <span class="maya-muhurat__result-weekday">${d.day}</span>
                        <span class="maya-muhurat__result-quality">
                            <i class="bi bi-star-fill"></i>
                            ${d.quality}
                        </span>
                    </div>
                    <div class="maya-muhurat__result-score">
                        <span class="maya-muhurat__score-value">${d.score}</span>
                        <span class="maya-muhurat__score-label">${isHindi ? 'अंक' : 'Score'}</span>
                    </div>
                </div>
                <div class="maya-muhurat__result-body">
                    <div class="maya-muhurat__result-time">
                        <i class="bi bi-clock-fill"></i>
                        <span>${isHindi ? 'शुभ समय' : 'Auspicious Time'}: <strong>${d.time}</strong></span>
                    </div>
                    <div class="maya-muhurat__result-details">
                        <div class="maya-muhurat__result-detail">
                            <span class="maya-muhurat__detail-label">${isHindi ? 'तिथि' : 'Tithi'}</span>
                            <span class="maya-muhurat__detail-value">${d.tithi}</span>
                        </div>
                        <div class="maya-muhurat__result-detail">
                            <span class="maya-muhurat__detail-label">${isHindi ? 'नक्षत्र' : 'Nakshatra'}</span>
                            <span class="maya-muhurat__detail-value">${d.nakshatra}</span>
                        </div>
                    </div>
                    <div class="maya-muhurat__result-factors">
                        ${d.factors.slice(0, 3).map(f => `<span class="maya-muhurat__factor"><i class="bi bi-check-circle-fill"></i> ${f}</span>`).join('')}
                    </div>
                    <div class="maya-muhurat__result-warning">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span>${isHindi ? 'राहुकाल से बचें' : 'Avoid Rahu Kaal'}: ${d.rahuKaal}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Get tithi number from name
     */
    getTithiNumber(tithiName) {
        const tithiMap = {
            'Pratipada': 1, 'Prathama': 1,
            'Dwitiya': 2, 'Dvitiya': 2,
            'Tritiya': 3,
            'Chaturthi': 4,
            'Panchami': 5,
            'Shashthi': 6,
            'Saptami': 7,
            'Ashtami': 8,
            'Navami': 9,
            'Dashami': 10,
            'Ekadashi': 11,
            'Dwadashi': 12,
            'Trayodashi': 13,
            'Chaturdashi': 14,
            'Purnima': 15, 'Amavasya': 15
        };
        return tithiMap[tithiName] || 1;
    },

    /**
     * Calculate best muhurat time avoiding Rahu Kaal
     */
    calculateBestMuhuratTime(panchang, rahuKaalTimes) {
        // Parse Rahu Kaal
        const parseTime = (timeStr) => {
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (!match) return 0;
            let hour = parseInt(match[1]);
            const min = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === 'PM' && hour !== 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;
            return hour + min / 60;
        };

        const rahuStart = parseTime(rahuKaalTimes[0]);
        const rahuEnd = parseTime(rahuKaalTimes[1]);

        // Preferred muhurat windows (in order of preference)
        const windows = [
            { start: 6, end: 8, label: '6:00 AM - 8:00 AM' },      // Brahma Muhurat extension
            { start: 8, end: 10, label: '8:00 AM - 10:00 AM' },    // Morning
            { start: 11.5, end: 12.5, label: '11:30 AM - 12:30 PM' }, // Abhijit Muhurat
            { start: 10, end: 11.5, label: '10:00 AM - 11:30 AM' },
            { start: 14, end: 16, label: '2:00 PM - 4:00 PM' },    // Afternoon
            { start: 16, end: 17.5, label: '4:00 PM - 5:30 PM' }   // Late afternoon
        ];

        // Find first window that doesn't overlap with Rahu Kaal
        for (const window of windows) {
            const overlaps = (window.start < rahuEnd && window.end > rahuStart);
            if (!overlaps) {
                return window.label;
            }
        }

        // If all overlap, return the best available
        return '8:00 AM - 10:00 AM';
    },

    /**
     * Render Spiritual Music page
     * Daily spiritual songs based on day, rashi, and categories
     */
    renderSpiritualMusic(profile, isHindi) {
        // Get user's zodiac/rashi based on their preferred system (western or vedic)
        let userRashi = null;
        if (profile && profile.birthDate && window.MayaAstrology) {
            const zodiac = MayaAstrology.getZodiac(profile.birthDate, profile);
            // getZodiac() already returns the correct sign based on user's preferred system
            userRashi = zodiac?.name || 'Aries';
        }

        // Day-specific deity and recommendations
        const dayWiseData = this.getDayWiseSpiritualData(isHindi);
        const today = new Date();
        const dayOfWeek = today.getDay();
        const todayData = dayWiseData[dayOfWeek];

        // Rashi-wise recommendations
        const rashiData = this.getRashiWiseMusicData(userRashi, isHindi);

        return `
            <div class="maya-page maya-spiritual-music">
                <!-- Hero Header -->
                <div class="maya-spiritual-music__hero">
                    <div class="maya-spiritual-music__hero-inner">
                        <div class="maya-spiritual-music__title-area">
                            <h1 class="maya-spiritual-music__title">
                                <i class="bi bi-music-note-beamed"></i>
                                ${isHindi ? 'आध्यात्मिक संगीत' : 'Spiritual Music'}
                            </h1>
                            <p class="maya-spiritual-music__subtitle">
                                ${isHindi ? 'दैनिक भक्ति संगीत और मंत्र' : 'Daily Devotional Music & Mantras'}
                            </p>
                        </div>
                        <div class="maya-spiritual-music__today-deity">
                            <div class="maya-spiritual-music__deity-icon">${todayData.icon}</div>
                            <div class="maya-spiritual-music__deity-info">
                                <span class="maya-spiritual-music__day-name">${todayData.dayName}</span>
                                <span class="maya-spiritual-music__deity-name">${todayData.deity}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filter Chips -->
                <div class="maya-spiritual-music__filters">
                    <div class="maya-spiritual-music__filter-scroll">
                        <button class="maya-spiritual-music__filter-chip maya-spiritual-music__filter-chip--active" data-filter="all">
                            <i class="bi bi-grid-3x3-gap"></i>
                            ${isHindi ? 'सभी' : 'All'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="todays-special">
                            <i class="bi bi-calendar-day"></i>
                            ${isHindi ? 'आज का विशेष' : "Today's Special"}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="your-rashi">
                            <i class="bi bi-star"></i>
                            ${isHindi ? 'आपकी राशि' : 'Your Rashi'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="aarti">
                            <i class="bi bi-flower1"></i>
                            ${isHindi ? 'आरती' : 'Aarti'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="bhajan">
                            <i class="bi bi-music-note"></i>
                            ${isHindi ? 'भजन' : 'Bhajan'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="mantra">
                            <i class="bi bi-soundwave"></i>
                            ${isHindi ? 'मंत्र' : 'Mantra'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="chalisa">
                            <i class="bi bi-book"></i>
                            ${isHindi ? 'चालीसा' : 'Chalisa'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="workout">
                            <i class="bi bi-lightning-charge"></i>
                            ${isHindi ? 'वर्कआउट' : 'Workout'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="meditation">
                            <i class="bi bi-peace"></i>
                            ${isHindi ? 'ध्यान' : 'Meditation'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="morning">
                            <i class="bi bi-sunrise"></i>
                            ${isHindi ? 'सुबह' : 'Morning'}
                        </button>
                        <button class="maya-spiritual-music__filter-chip" data-filter="evening">
                            <i class="bi bi-sunset"></i>
                            ${isHindi ? 'शाम' : 'Evening'}
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="maya-spiritual-music__content">

                <!-- Today's Special Section -->
                <div class="maya-spiritual-music__section" data-category="todays-special">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? `${todayData.dayName} विशेष - ${todayData.deity}` : `${todayData.dayName} Special - ${todayData.deity}`}
                        </h2>
                        <span class="maya-spiritual-music__section-badge">${isHindi ? 'आज के लिए' : 'For Today'}</span>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="todays-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                ${userRashi ? `
                <!-- Your Rashi Section -->
                <div class="maya-spiritual-music__section" data-category="your-rashi">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? `${rashiData.rashiNameHi} राशि के लिए` : `For ${rashiData.rashiName} Rashi`}
                        </h2>
                        <span class="maya-spiritual-music__section-badge">${rashiData.rulingPlanet}</span>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="rashi-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Aarti Section -->
                <div class="maya-spiritual-music__section" data-category="aarti">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'आरती संग्रह' : 'Aarti Collection'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="aarti-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Chalisa Section -->
                <div class="maya-spiritual-music__section" data-category="chalisa">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'चालीसा' : 'Chalisa'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="chalisa-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Workout/Fast Spiritual Section -->
                <div class="maya-spiritual-music__section" data-category="workout">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'वर्कआउट भक्ति' : 'Workout Bhakti'}
                        </h2>
                        <span class="maya-spiritual-music__section-badge">${isHindi ? 'उच्च ऊर्जा' : 'High Energy'}</span>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="workout-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Bhajan Section -->
                <div class="maya-spiritual-music__section" data-category="bhajan">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'भक्ति भजन' : 'Devotional Bhajans'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="bhajan-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Mantra Section -->
                <div class="maya-spiritual-music__section" data-category="mantra">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'शक्तिशाली मंत्र' : 'Powerful Mantras'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="mantra-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Meditation Section -->
                <div class="maya-spiritual-music__section" data-category="meditation">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'ध्यान संगीत' : 'Meditation Music'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="meditation-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Morning Section -->
                <div class="maya-spiritual-music__section" data-category="morning">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'प्रातः संगीत' : 'Morning Prayers'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="morning-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Evening Section -->
                <div class="maya-spiritual-music__section" data-category="evening">
                    <div class="maya-spiritual-music__section-header">
                        <h2 class="maya-spiritual-music__section-title">
                            ${isHindi ? 'संध्या प्रार्थना' : 'Evening Prayers'}
                        </h2>
                    </div>
                    <div class="maya-spiritual-music__playlist" id="evening-playlist">
                        <div class="maya-spiritual-music__loading">
                            <div class="spinner-border spinner-border-sm"></div>
                            <span>${isHindi ? 'लोड हो रहा है...' : 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                </div><!-- end .maya-spiritual-music__content -->

                <!-- Video Player (initially hidden) -->
                <div class="maya-spiritual-music__player" id="spiritual-player" style="display: none;">
                    <div class="maya-spiritual-music__player-header">
                        <button class="maya-spiritual-music__player-minimize" id="minimize-player">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                        <span class="maya-spiritual-music__now-playing">${isHindi ? 'अभी बज रहा है' : 'Now Playing'}</span>
                        <button class="maya-spiritual-music__player-close" id="close-player">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="maya-spiritual-music__player-video">
                        <iframe id="spiritual-iframe" src="" frameborder="0" 
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen></iframe>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get day-wise spiritual data
     */
    getDayWiseSpiritualData(isHindi) {
        return [
            { // Sunday
                dayName: isHindi ? 'रविवार' : 'Sunday',
                deity: isHindi ? 'सूर्य देव' : 'Lord Surya',
                icon: '☀️',
                searchQueries: ['Surya Dev Aarti', 'Aditya Hridaya Stotra', 'Sun God Mantra', 'Gayatri Mantra'],
                color: '#FF6B35'
            },
            { // Monday
                dayName: isHindi ? 'सोमवार' : 'Monday',
                deity: isHindi ? 'भगवान शिव' : 'Lord Shiva',
                icon: '🔱',
                searchQueries: ['Shiv Aarti', 'Om Namah Shivaya', 'Shiv Tandav Stotram', 'Maha Mrityunjaya Mantra'],
                color: '#4A90D9'
            },
            { // Tuesday
                dayName: isHindi ? 'मंगलवार' : 'Tuesday',
                deity: isHindi ? 'हनुमान जी' : 'Lord Hanuman',
                icon: '🙏',
                searchQueries: ['Hanuman Chalisa', 'Hanuman Aarti', 'Bajrang Baan', 'Hanuman Bhajan'],
                color: '#FF4500'
            },
            { // Wednesday
                dayName: isHindi ? 'बुधवार' : 'Wednesday',
                deity: isHindi ? 'श्री गणेश' : 'Lord Ganesha',
                icon: '🐘',
                searchQueries: ['Ganesh Aarti', 'Ganesh Mantra', 'Vakratunda Mahakaya', 'Ganpati Bappa Morya'],
                color: '#FF8C00'
            },
            { // Thursday
                dayName: isHindi ? 'गुरुवार' : 'Thursday',
                deity: isHindi ? 'साईं बाबा / विष्णु' : 'Sai Baba / Vishnu',
                icon: '🙏',
                searchQueries: ['Sai Baba Aarti', 'Vishnu Sahasranama', 'Om Jai Jagdish Hare', 'Guru Brahma Mantra'],
                color: '#FFD700'
            },
            { // Friday
                dayName: isHindi ? 'शुक्रवार' : 'Friday',
                deity: isHindi ? 'माता संतोषी / दुर्गा' : 'Goddess Santoshi / Durga',
                icon: '🪷',
                searchQueries: ['Santoshi Mata Aarti', 'Durga Aarti', 'Lakshmi Mantra', 'Devi Bhajan'],
                color: '#FF69B4'
            },
            { // Saturday
                dayName: isHindi ? 'शनिवार' : 'Saturday',
                deity: isHindi ? 'शनि देव' : 'Lord Shani',
                icon: '⚫',
                searchQueries: ['Shani Dev Aarti', 'Shani Mantra', 'Hanuman Chalisa', 'Shani Chalisa'],
                color: '#4B0082'
            }
        ];
    },

    /**
     * Get rashi-wise music recommendations
     */
    getRashiWiseMusicData(rashi, isHindi) {
        const rashiData = {
            'Aries': { rashiName: 'Aries', rashiNameHi: 'मेष', rulingPlanet: 'Mars', deity: 'Hanuman', queries: ['Hanuman Chalisa', 'Mars Mantra', 'Mangal Beej Mantra'] },
            'Taurus': { rashiName: 'Taurus', rashiNameHi: 'वृषभ', rulingPlanet: 'Venus', deity: 'Lakshmi', queries: ['Lakshmi Aarti', 'Venus Mantra', 'Shukra Beej Mantra'] },
            'Gemini': { rashiName: 'Gemini', rashiNameHi: 'मिथुन', rulingPlanet: 'Mercury', deity: 'Vishnu', queries: ['Vishnu Sahasranama', 'Mercury Mantra', 'Budh Beej Mantra'] },
            'Cancer': { rashiName: 'Cancer', rashiNameHi: 'कर्क', rulingPlanet: 'Moon', deity: 'Shiva', queries: ['Shiv Aarti', 'Chandra Mantra', 'Moon Beej Mantra'] },
            'Leo': { rashiName: 'Leo', rashiNameHi: 'सिंह', rulingPlanet: 'Sun', deity: 'Surya', queries: ['Surya Namaskar Mantra', 'Aditya Hridaya', 'Gayatri Mantra'] },
            'Virgo': { rashiName: 'Virgo', rashiNameHi: 'कन्या', rulingPlanet: 'Mercury', deity: 'Vishnu', queries: ['Krishna Bhajan', 'Budh Mantra', 'Vishnu Aarti'] },
            'Libra': { rashiName: 'Libra', rashiNameHi: 'तुला', rulingPlanet: 'Venus', deity: 'Durga', queries: ['Durga Aarti', 'Shukra Mantra', 'Devi Bhajan'] },
            'Scorpio': { rashiName: 'Scorpio', rashiNameHi: 'वृश्चिक', rulingPlanet: 'Mars', deity: 'Hanuman', queries: ['Bajrang Baan', 'Mangal Mantra', 'Hanuman Aarti'] },
            'Sagittarius': { rashiName: 'Sagittarius', rashiNameHi: 'धनु', rulingPlanet: 'Jupiter', deity: 'Vishnu', queries: ['Brihaspati Mantra', 'Guru Vandana', 'Vishnu Bhajan'] },
            'Capricorn': { rashiName: 'Capricorn', rashiNameHi: 'मकर', rulingPlanet: 'Saturn', deity: 'Shani', queries: ['Shani Chalisa', 'Shani Mantra', 'Hanuman Chalisa'] },
            'Aquarius': { rashiName: 'Aquarius', rashiNameHi: 'कुंभ', rulingPlanet: 'Saturn', deity: 'Shani', queries: ['Shani Dev Aarti', 'Shani Stotra', 'Rahu Ketu Mantra'] },
            'Pisces': { rashiName: 'Pisces', rashiNameHi: 'मीन', rulingPlanet: 'Jupiter', deity: 'Vishnu', queries: ['Vishnu Sahasranama', 'Guru Mantra', 'Narayana Bhajan'] }
        };
        return rashiData[rashi] || rashiData['Aries'];
    },

    /**
     * Initialize Spiritual Music page scripts
     */
    initSpiritualMusicPage() {
        const isHindi = false; // UI always English
        const profile = MayaUtils.storage.get('maya_profile') || {};

        const API_KEY = MAYA_CONFIG.API_KEYS.YOUTUBE || '';

        // Get day data
        const dayWiseData = this.getDayWiseSpiritualData(isHindi);
        const dayOfWeek = new Date().getDay();
        const todayData = dayWiseData[dayOfWeek];

        // Get user's rashi based on their preferred zodiac system (western or vedic)
        let userRashi = 'Aries';
        if (profile && profile.birthDate && window.MayaAstrology) {
            const zodiac = MayaAstrology.getZodiac(profile.birthDate, profile);
            // getZodiac() already returns the correct sign based on user's preferred system
            userRashi = zodiac?.name || 'Aries';
        }
        const rashiData = this.getRashiWiseMusicData(userRashi, isHindi);

        // Search queries for each category
        const categoryQueries = {
            'todays-playlist': todayData.searchQueries[Math.floor(Math.random() * todayData.searchQueries.length)],
            'rashi-playlist': rashiData.queries[Math.floor(Math.random() * rashiData.queries.length)],
            'aarti-playlist': ['Aarti Sangrah', 'Om Jai Jagdish Hare', 'Aarti Collection Hindi'][dayOfWeek % 3],
            'chalisa-playlist': ['Hanuman Chalisa Fast', 'Shiv Chalisa', 'Durga Chalisa', 'Ganesh Chalisa'][dayOfWeek % 4],
            'workout-playlist': ['Hanuman Chalisa Fast Rap', 'High Energy Bhajan Workout', 'Fast Bhakti Songs Gym'][dayOfWeek % 3],
            'bhajan-playlist': ['Latest Hindi Bhajan 2026', 'Krishna Bhajan', 'Morning Bhajan'][dayOfWeek % 3],
            'mantra-playlist': ['Powerful Mantras', 'Om Chanting', 'Gayatri Mantra 108'][dayOfWeek % 3],
            'meditation-playlist': ['Meditation Music Indian', 'Om Meditation', 'Peaceful Mantra'][dayOfWeek % 3],
            'morning-playlist': ['Morning Bhajan', 'Suprabhatam', 'Brahma Muhurat Prayer'][dayOfWeek % 3],
            'evening-playlist': ['Sandhya Aarti', 'Evening Bhajan', 'Shaam Ki Aarti'][dayOfWeek % 3]
        };

        if (API_KEY) {
            Object.entries(categoryQueries).forEach(([playlistId, query]) => {
                this.loadYouTubePlaylist(playlistId, query, API_KEY, isHindi);
            });
        } else {
            Object.keys(categoryQueries).forEach((playlistId) => {
                const container = document.getElementById(playlistId);
                if (!container) return;

                container.innerHTML = `
                    <div class="maya-spiritual-music__error">
                        <i class="bi bi-exclamation-circle"></i>
                        <span>${isHindi ? 'YouTube API configure करें' : 'Configure the YouTube API key'}</span>
                    </div>
                `;
            });
        }

        // Filter chip click handlers
        document.querySelectorAll('.maya-spiritual-music__filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.maya-spiritual-music__filter-chip').forEach(c =>
                    c.classList.remove('maya-spiritual-music__filter-chip--active'));
                e.target.closest('.maya-spiritual-music__filter-chip').classList.add('maya-spiritual-music__filter-chip--active');

                const filter = e.target.closest('.maya-spiritual-music__filter-chip').dataset.filter;

                // Show/hide sections based on filter
                document.querySelectorAll('.maya-spiritual-music__section').forEach(section => {
                    if (filter === 'all') {
                        section.style.display = 'block';
                    } else {
                        section.style.display = section.dataset.category === filter ? 'block' : 'none';
                    }
                });
            });
        });

        // Player controls
        const closePlayerBtn = document.getElementById('close-player');
        const minimizePlayerBtn = document.getElementById('minimize-player');
        const player = document.getElementById('spiritual-player');
        const iframe = document.getElementById('spiritual-iframe');

        if (closePlayerBtn) {
            closePlayerBtn.addEventListener('click', () => {
                player.style.display = 'none';
                player.classList.remove('maya-spiritual-music__player--minimized');
                iframe.src = '';
            });
        }

        if (minimizePlayerBtn) {
            minimizePlayerBtn.addEventListener('click', () => {
                player.classList.toggle('maya-spiritual-music__player--minimized');
            });
        }
    },

    /**
     * Load YouTube playlist for a category
     */
    async loadYouTubePlaylist(playlistId, query, apiKey, isHindi) {
        const container = document.getElementById(playlistId);
        if (!container) return;

        if (!apiKey) {
            container.innerHTML = `
                <div class="maya-spiritual-music__error">
                    <i class="bi bi-exclamation-circle"></i>
                    <span>${isHindi ? 'YouTube API configure करें' : 'Configure the YouTube API key'}</span>
                </div>
            `;
            return;
        }

        try {
            const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&key=${apiKey}`;

            const response = await fetch(searchURL);
            const data = await response.json();

            // Check for API errors
            if (data.error) {
                console.error('YouTube API Error:', data.error.message, 'Code:', data.error.code);
                throw new Error(data.error.message || 'YouTube API error');
            }

            if (data.items && data.items.length > 0) {
                container.innerHTML = data.items.map(item => {
                    const videoId = item.id.videoId;
                    const title = item.snippet.title;
                    const thumbnail = item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url;
                    const channel = item.snippet.channelTitle;

                    return `
                        <div class="maya-spiritual-music__video-card" data-video-id="${videoId}">
                            <div class="maya-spiritual-music__video-thumbnail">
                                <img src="${thumbnail}" alt="${title}" loading="lazy">
                                <div class="maya-spiritual-music__video-play">
                                    <i class="bi bi-play-fill"></i>
                                </div>
                            </div>
                            <div class="maya-spiritual-music__video-info">
                                <h4 class="maya-spiritual-music__video-title">${this.truncateText(title, 45)}</h4>
                                <span class="maya-spiritual-music__video-channel">${channel}</span>
                            </div>
                        </div>
                    `;
                }).join('');

                // Add click handlers
                container.querySelectorAll('.maya-spiritual-music__video-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const videoId = card.dataset.videoId;
                        const videoTitle = card.querySelector('.maya-spiritual-music__video-title')?.textContent || 'Bhakti Music';
                        this.playSpiritualVideo(videoId, videoTitle);
                    });
                });
            } else {
                console.warn('No YouTube results for query:', query);
                container.innerHTML = `
                    <div class="maya-spiritual-music__no-results">
                        <i class="bi bi-music-note-list"></i>
                        <span>${isHindi ? 'कोई वीडियो नहीं मिला' : 'No videos found'}</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading YouTube playlist:', error, 'Query:', query);
            container.innerHTML = `
                <div class="maya-spiritual-music__error">
                    <i class="bi bi-exclamation-circle"></i>
                    <span>${isHindi ? 'लोड करने में त्रुटि' : 'Error loading videos'}</span>
                </div>
            `;
        }
    },

    /**
     * Play a spiritual video
     */
    playSpiritualVideo(videoId, title = 'Bhakti Music') {
        // Use the global persistent player
        if (window.MayaMusicPlayer) {
            MayaMusicPlayer.play(videoId, title);
        } else {
            // Fallback to inline player
            const player = document.getElementById('spiritual-player');
            const iframe = document.getElementById('spiritual-iframe');

            if (player && iframe) {
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
                player.style.display = 'flex';
                player.classList.remove('maya-spiritual-music__player--minimized');

                // Scroll to top smoothly
                document.querySelector('.maya-page')?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    },

    /**
     * Truncate text helper
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    /**
     * Render Vastu Calibration page
     * Uses geolocation, compass, and camera for Vedic Vastu analysis
     */
    renderVastu(isHindi) {
        // Get saved Vastu analyses
        const savedAnalyses = MayaUtils.storage.get('maya_vastu_analyses') || [];

        // Area labels
        const areaLabels = {
            entrance: { en: 'Main Entrance', hi: 'मुख्य द्वार', icon: 'bi-door-open' },
            living_room: { en: 'Living Room', hi: 'बैठक', icon: 'bi-lamp' },
            bedroom: { en: 'Bedroom', hi: 'शयनकक्ष', icon: 'bi-moon-stars' },
            kitchen: { en: 'Kitchen', hi: 'रसोई', icon: 'bi-cup-hot' },
            bathroom: { en: 'Bathroom', hi: 'बाथरूम', icon: 'bi-droplet' },
            pooja_room: { en: 'Pooja Room', hi: 'पूजा कक्ष', icon: 'bi-flower1' },
            office: { en: 'Office', hi: 'कार्यालय', icon: 'bi-laptop' },
            other: { en: 'Other', hi: 'अन्य', icon: 'bi-grid' }
        };

        // Render saved analyses cards
        const renderAnalysisCards = () => {
            if (savedAnalyses.length === 0) {
                return `
                    <div class="maya-vastu__empty-state">
                        <div class="maya-vastu__empty-icon">
                            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                                <circle cx="26" cy="26" r="25" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.3"/>
                                <path d="M26 14v24M14 26h24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.2"/>
                                <circle cx="26" cy="26" r="4" fill="currentColor" opacity="0.3"/>
                                <path d="M26 10l2 6h-4l2-6z" fill="currentColor" opacity="0.5"/>
                            </svg>
                        </div>
                        <h4>${isHindi ? 'कोई विश्लेषण नहीं' : 'No Analyses Yet'}</h4>
                        <p>${isHindi ? 'ऊपर बटन दबाकर अपना पहला वास्तु विश्लेषण शुरू करें' : 'Tap the button above to start your first Vastu analysis'}</p>
                    </div>
                `;
            }

            return savedAnalyses.map((analysis, index) => {
                const area = areaLabels[analysis.areaType] || areaLabels.other;
                const date = new Date(analysis.timestamp);
                const dateStr = date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });

                // Determine severity class based on score
                let severityClass = 'maya-vastu__card--green';
                let severityLabel = isHindi ? 'उत्तम' : 'Good';
                let severityIcon = 'bi-check-circle-fill';

                if (analysis.score <= 4) {
                    severityClass = 'maya-vastu__card--red';
                    severityLabel = isHindi ? 'गंभीर दोष' : 'Major Dosha';
                    severityIcon = 'bi-exclamation-triangle-fill';
                } else if (analysis.score <= 6) {
                    severityClass = 'maya-vastu__card--yellow';
                    severityLabel = isHindi ? 'मध्यम दोष' : 'Minor Dosha';
                    severityIcon = 'bi-exclamation-circle-fill';
                }

                return `
                    <div class="maya-vastu__card ${severityClass}" data-analysis-index="${index}">
                        <div class="maya-vastu__card-header">
                            <div class="maya-vastu__card-icon">
                                <i class="bi ${area.icon}"></i>
                            </div>
                            <div class="maya-vastu__card-info">
                                <h4>${isHindi ? area.hi : area.en}</h4>
                                <span class="maya-vastu__card-date">
                                    <i class="bi bi-calendar3"></i> ${dateStr}
                                </span>
                            </div>
                            <div class="maya-vastu__card-score">
                                <span class="maya-vastu__score-value">${analysis.score}/10</span>
                            </div>
                        </div>
                        <div class="maya-vastu__card-body">
                            <div class="maya-vastu__card-direction">
                                <i class="bi bi-compass"></i>
                                <span>${analysis.direction} (${analysis.directionDegree}°)</span>
                            </div>
                            <div class="maya-vastu__card-severity">
                                <i class="bi ${severityIcon}"></i>
                                <span>${severityLabel}</span>
                            </div>
                        </div>
                        <div class="maya-vastu__card-actions">
                            <button class="maya-vastu__card-btn maya-vastu__card-btn--view" data-view-analysis="${index}">
                                <i class="bi bi-eye"></i>
                                <span>${isHindi ? 'देखें' : 'View'}</span>
                            </button>
                            <button class="maya-vastu__card-btn maya-vastu__card-btn--delete" data-delete-analysis="${index}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        return `
            <div class="maya-page maya-vastu">
                <!-- Hero Section -->
                <div class="maya-vastu__hero">
                    <div class="maya-vastu__hero-bg"></div>
                    <div class="maya-vastu__hero-content">
                        <div class="maya-vastu__hero-icon">
                            <i class="bi bi-compass"></i>
                        </div>
                        <h2 class="maya-vastu__hero-title">${isHindi ? 'वास्तु विश्लेषण' : 'Vastu Analysis'}</h2>
                        <p class="maya-vastu__hero-sub">${isHindi ? 'AI-संचालित वैदिक वास्तु शास्त्र मार्गदर्शन' : 'AI-powered Vedic Vastu Shastra guidance'}</p>
                        <button class="maya-vastu__start-btn" id="startNewCalibration">
                            <i class="bi bi-plus-circle"></i>
                            <span>${isHindi ? 'नया विश्लेषण शुरू करें' : 'Start New Analysis'}</span>
                            <i class="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Features Row -->
                <div class="maya-vastu__features">
                    <div class="maya-vastu__feature">
                        <div class="maya-vastu__feature-icon maya-vastu__feature-icon--compass"><i class="bi bi-compass"></i></div>
                        <span>${isHindi ? 'दिशा' : 'Compass'}</span>
                    </div>
                    <div class="maya-vastu__feature">
                        <div class="maya-vastu__feature-icon maya-vastu__feature-icon--camera"><i class="bi bi-camera"></i></div>
                        <span>${isHindi ? 'फ़ोटो' : 'Photo'}</span>
                    </div>
                    <div class="maya-vastu__feature">
                        <div class="maya-vastu__feature-icon maya-vastu__feature-icon--ai"><i class="bi bi-stars"></i></div>
                        <span>${isHindi ? 'AI विश्लेषण' : 'AI Analysis'}</span>
                    </div>
                    <div class="maya-vastu__feature">
                        <div class="maya-vastu__feature-icon maya-vastu__feature-icon--remedy"><i class="bi bi-lightbulb"></i></div>
                        <span>${isHindi ? 'उपाय' : 'Remedies'}</span>
                    </div>
                </div>
                
                <!-- Saved Analyses -->
                <div class="maya-vastu__analyses-section">
                    <h3 class="maya-vastu__section-title">
                        <i class="bi bi-clock-history"></i>
                        <span>${isHindi ? 'पिछले विश्लेषण' : 'Past Analyses'}</span>
                        ${savedAnalyses.length > 0 ? `<span class="maya-vastu__badge">${savedAnalyses.length}</span>` : ''}
                    </h3>
                    <div class="maya-vastu__analyses-grid" id="vastuAnalysesList">
                        ${renderAnalysisCards()}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Vastu Calibration Flow (fullscreen)
     */
    renderVastuCalibration(isHindi) {
        return `
            <div class="maya-vastu maya-vastu--fullscreen">
                <!-- Back Button -->
                <button class="maya-vastu__back-btn" id="vastuBackBtn">
                    <i class="bi bi-arrow-left"></i>
                </button>
                
                <!-- Step Indicator (minimal) -->
                <div class="maya-vastu__step-indicator" id="vastuStepIndicator">
                    <div class="maya-vastu__step-dot maya-vastu__step-dot--active" data-step="1"></div>
                    <div class="maya-vastu__step-dot" data-step="2"></div>
                    <div class="maya-vastu__step-dot" data-step="3"></div>
                    <div class="maya-vastu__step-dot" data-step="4"></div>
                </div>

                <!-- Step 1: Location -->
                <div class="maya-vastu__panel maya-vastu__panel--active maya-vastu__panel--centered" id="vastuStep1">
                    <div class="maya-vastu__panel-content maya-vastu__panel-content--compact">
                        <div class="maya-vastu__panel-icon maya-vastu__panel-icon--sm">
                            <i class="bi bi-geo-alt-fill"></i>
                        </div>
                        <h3>${isHindi ? 'स्थान प्राप्त करें' : 'Get Location'}</h3>
                        
                        <div class="maya-vastu__location-display maya-vastu__location-display--compact" id="locationDisplay">
                            <i class="bi bi-crosshair"></i>
                        </div>
                        
                        <button class="maya-btn maya-btn--primary" id="getLocationBtn">
                            <i class="bi bi-geo-alt"></i>
                            <span>${isHindi ? 'स्थान प्राप्त करें' : 'Get My Location'}</span>
                        </button>
                    </div>
                </div>

                <!-- Step 1.5: Compass Initialization -->
                <div class="maya-vastu__panel maya-vastu__panel--centered" id="vastuStepCompass">
                    <div class="maya-vastu__panel-content">
                        <div class="maya-vastu__panel-icon maya-vastu__panel-icon--compass" id="compassInitIcon">
                            <i class="bi bi-compass"></i>
                        </div>
                        <h3 id="compassStepTitle">${isHindi ? 'कंपास सक्रिय करें' : 'Enable Compass'}</h3>
                        <p id="compassStepDesc">${isHindi ? 'सही दिशा के लिए कंपास की आवश्यकता है' : 'Compass is needed for accurate direction'}</p>
                        
                        <!-- Compass Status -->
                        <div class="maya-vastu__compass-status" id="compassStatus">
                            <div class="maya-vastu__compass-status-icon">
                                <div class="maya-spinner maya-spinner--sm"></div>
                            </div>
                            <span id="compassStatusText">${isHindi ? 'कंपास जांच रही है...' : 'Checking compass...'}</span>
                        </div>
                        
                        <!-- Enable Compass Button (for iOS/permission required) -->
                        <button class="maya-btn maya-btn--primary maya-btn--lg" id="enableCompassBtn" style="display: none;">
                            ${isHindi ? 'कंपास सक्रिय करें' : 'Enable Compass'}
                        </button>
                        
                        <!-- Retry Button -->
                        <button class="maya-btn maya-btn--outline maya-btn--lg" id="retryCompassBtn" style="display: none;">
                            ${isHindi ? 'पुनः प्रयास करें' : 'Retry'}
                        </button>
                        
                        <!-- Manual Direction Selection -->
                        <div class="maya-vastu__compass-manual" id="compassManualSection" style="display: none;">
                            <p class="maya-vastu__manual-title">${isHindi ? 'या मैन्युअल रूप से दिशा चुनें:' : 'Or select direction manually:'}</p>
                            <div class="maya-vastu__direction-grid">
                                <button class="maya-vastu__dir-btn" data-dir="N" data-deg="0">
                                    <span class="maya-vastu__dir-icon">↑</span>
                                    <span>${isHindi ? 'उत्तर' : 'N'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="NE" data-deg="45">
                                    <span class="maya-vastu__dir-icon">↗</span>
                                    <span>${isHindi ? 'ईशान' : 'NE'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="E" data-deg="90">
                                    <span class="maya-vastu__dir-icon">→</span>
                                    <span>${isHindi ? 'पूर्व' : 'E'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="SE" data-deg="135">
                                    <span class="maya-vastu__dir-icon">↘</span>
                                    <span>${isHindi ? 'आग्नेय' : 'SE'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="S" data-deg="180">
                                    <span class="maya-vastu__dir-icon">↓</span>
                                    <span>${isHindi ? 'दक्षिण' : 'S'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="SW" data-deg="225">
                                    <span class="maya-vastu__dir-icon">↙</span>
                                    <span>${isHindi ? 'नैऋत्य' : 'SW'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="W" data-deg="270">
                                    <span class="maya-vastu__dir-icon">←</span>
                                    <span>${isHindi ? 'पश्चिम' : 'W'}</span>
                                </button>
                                <button class="maya-vastu__dir-btn" data-dir="NW" data-deg="315">
                                    <span class="maya-vastu__dir-icon">↖</span>
                                    <span>${isHindi ? 'वायव्य' : 'NW'}</span>
                                </button>
                            </div>
                            <button class="maya-btn maya-btn--primary maya-btn--lg" id="proceedWithManualBtn" style="display: none;">
                                ${isHindi ? 'आगे बढ़ें' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Direction Lock (Compass Only) -->
                <div class="maya-vastu__panel maya-vastu__panel--direction" id="vastuStep2">
                    <div class="maya-vastu__direction-screen maya-vastu__direction-screen--compact">
                        <!-- Back button -->
                        <button class="maya-vastu__back-btn maya-vastu__back-btn--top" id="directionBackBtn">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                        
                        <!-- Instruction - more compact -->
                        <div class="maya-vastu__direction-header maya-vastu__direction-header--compact">
                            <p class="maya-vastu__step-hint">${isHindi ? '📍 फ़ोन को स्कैन क्षेत्र की ओर इशारा करें' : '📍 Point phone towards area to scan'}</p>
                        </div>
                        
                        <!-- Large Compass -->
                        <div class="maya-vastu__compass-container maya-vastu__compass-container--compact">
                            <!-- Image-based Compass -->
                            <div class="maya-compass-img">
                                <!-- Compass dial (rotates) -->
                                <div class="maya-compass-img__dial" id="compassDial"></div>
                                <!-- Compass needle (fixed, points to direction you're facing) -->
                                <div class="maya-compass-img__needle">
                                    <img src="19-194340_compass-needle-png-circle.png" alt="Compass Needle">
                                </div>
                            </div>
                            
                            <!-- Direction Display -->
                            <div class="maya-vastu__direction-display maya-vastu__direction-display--large">
                                <span class="maya-vastu__direction-deg" id="directionDegree">0°</span>
                                <span class="maya-vastu__direction-name" id="directionName">${isHindi ? 'उत्तर' : 'North'}</span>
                            </div>
                        </div>
                        
                        <!-- Lock Direction Button -->
                        <div class="maya-vastu__direction-footer maya-vastu__direction-footer--compact">
                            <button class="maya-btn maya-btn--primary maya-btn--full" id="lockDirectionBtn">
                                ${isHindi ? 'दिशा लॉक करें' : 'Lock Direction'}
                            </button>
                            <!-- Hidden native camera input - camera only, no gallery -->
                            <input type="file" id="nativeCameraInput" accept="image/*" capture="environment" style="display:none;">
                        </div>
                    </div>
                </div>

                <!-- Step 2b: Photo Review (After Native Camera) -->
                <div class="maya-vastu__panel maya-vastu__panel--camera" id="vastuStep2b">
                    <div class="maya-vastu__photo-review maya-vastu__photo-review--compact" id="photoReview">
                        <img id="capturedPhoto" src="" alt="Captured">
                        <div class="maya-vastu__review-badge">
                            <i class="bi bi-compass"></i>
                            <span id="reviewDirection">North 0°</span>
                        </div>
                        <div class="maya-vastu__review-actions">
                            <button class="maya-btn maya-btn--outline maya-btn--light" id="retakeBtn">
                                ${isHindi ? 'फिर से' : 'Retake'}
                            </button>
                            <button class="maya-btn maya-btn--primary" id="usePhotoBtn">
                                ${isHindi ? 'आगे' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2.5: Area Selection (after photo capture) -->
                <div class="maya-vastu__panel maya-vastu__panel--centered" id="vastuStepArea">
                    <div class="maya-vastu__panel-content maya-vastu__panel-content--compact maya-vastu__panel-content--area">
                        <div class="maya-vastu__captured-preview maya-vastu__captured-preview--sm" id="capturedPreview">
                            <img id="previewImage" src="" alt="Captured">
                            <div class="maya-vastu__preview-badge maya-vastu__preview-badge--sm">
                                <i class="bi bi-compass"></i>
                                <span id="previewDirection">N (0°)</span>
                            </div>
                        </div>
                        
                        <h3>${isHindi ? 'कौन सा क्षेत्र है?' : 'What area?'}</h3>
                        
                        <div class="maya-vastu__area-grid maya-vastu__area-grid--compact">
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="entrance">
                                <i class="bi bi-door-open"></i>
                                <span>${isHindi ? 'द्वार' : 'Entrance'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="living_room">
                                <i class="bi bi-lamp"></i>
                                <span>${isHindi ? 'बैठक' : 'Living'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="bedroom">
                                <i class="bi bi-moon-stars"></i>
                                <span>${isHindi ? 'बेडरूम' : 'Bedroom'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="kitchen">
                                <i class="bi bi-cup-hot"></i>
                                <span>${isHindi ? 'रसोई' : 'Kitchen'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="bathroom">
                                <i class="bi bi-droplet"></i>
                                <span>${isHindi ? 'बाथरूम' : 'Bath'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="pooja_room">
                                <i class="bi bi-flower1"></i>
                                <span>${isHindi ? 'पूजा' : 'Pooja'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="office">
                                <i class="bi bi-laptop"></i>
                                <span>${isHindi ? 'ऑफिस' : 'Office'}</span>
                            </button>
                            <button class="maya-vastu__area-btn maya-vastu__area-btn--compact" data-area="other">
                                <i class="bi bi-grid"></i>
                                <span>${isHindi ? 'अन्य' : 'Other'}</span>
                            </button>
                        </div>
                        
                        <!-- Custom Area Input (for "Other" option) -->
                        <div class="maya-vastu__custom-area maya-vastu__custom-area--compact" id="customAreaSection" style="display: none;">
                            <input type="text" id="customAreaInput" class="maya-input maya-input--compact" 
                                   placeholder="${isHindi ? 'जैसे: बालकनी, सीढ़ी...' : 'e.g., Balcony, Staircase...'}" 
                                   maxlength="30">
                            <button class="maya-btn maya-btn--primary" id="proceedWithCustomAreaBtn">
                                <i class="bi bi-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 4: Analysis Results -->
                <div class="maya-vastu__panel maya-vastu__panel--results" id="vastuStep4">
                    <div class="maya-vastu__analysis-header maya-vastu__analysis-header--compact">
                        <i class="bi bi-stars"></i>
                        <h3>${isHindi ? 'वास्तु विश्लेषण' : 'Vastu Analysis'}</h3>
                    </div>
                    
                    <div class="maya-vastu__analysis-meta maya-vastu__analysis-meta--compact" id="analysisMetaInfo"></div>
                    
                    <div class="maya-vastu__analysis-loading" id="analysisLoading">
                        <div class="maya-spinner"></div>
                        <p>${isHindi ? 'विश्लेषण हो रहा है...' : 'Analyzing...'}</p>
                    </div>
                    
                    <div class="maya-vastu__results-scroll-area" id="analysisScrollArea" style="display:none;">
                        <div class="maya-vastu__analysis-result" id="analysisResult"></div>
                    </div>
                    
                    <div class="maya-vastu__fixed-actions" id="analysisActions" style="display:none;">
                        <button class="maya-btn maya-btn--primary" id="doneVastuBtn">
                            <i class="bi bi-check-circle"></i>
                            ${isHindi ? 'पूर्ण' : 'Done'}
                        </button>
                        <button class="maya-btn maya-btn--outline" id="newAnalysisBtn">
                            <i class="bi bi-plus-circle"></i>
                            ${isHindi ? 'नया' : 'New'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Palm Reading page
     * MAYA-powered palm analysis using camera
     */
    renderPalmReading(isHindi) {
        // Get saved palm readings
        const savedReadings = MayaUtils.storage.get('maya_palm_readings') || [];

        const renderPalmReadingCards = () => {
            if (savedReadings.length === 0) {
                return `
                    <div class="maya-vastu__empty-state">
                        <div class="maya-vastu__empty-icon">
                            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                                <circle cx="26" cy="26" r="25" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.3"/>
                                <path d="M26 14v24M14 26h24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.2"/>
                                <circle cx="26" cy="26" r="4" fill="currentColor" opacity="0.3"/>
                                <path d="M17 17c3-5 7-7 9-7s6 2 9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                            </svg>
                        </div>
                        <h4>${isHindi ? 'अभी कोई रीडिंग नहीं' : 'No Readings Yet'}</h4>
                        <p>${isHindi ? 'ऊपर बटन दबाकर अपनी पहली हस्तरेखा रीडिंग शुरू करें' : 'Tap the button above to start your first palm reading'}</p>
                    </div>
                `;
            }

            return savedReadings.map((reading, index) => {
                const analysisData = reading.analysisData || {};
                const isGuided = !!analysisData.isFallback;
                const statusClass = isGuided ? 'maya-vastu__card--yellow' : 'maya-vastu__card--green';
                const statusLabel = isGuided
                    ? (isHindi ? 'मार्गदर्शित' : 'Guided')
                    : (isHindi ? 'लाइव' : 'Live');
                const statusIcon = isGuided ? 'bi-info-circle-fill' : 'bi-stars';
                const insightCount = analysisData.lines?.length || 0;
                const date = new Date(reading.date);
                const dateStr = date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
                const rawSummary = (isHindi
                    ? (analysisData.overallSummaryHi || analysisData.overallSummary)
                    : (analysisData.overallSummary || analysisData.overallSummaryHi)
                ) || (isHindi ? 'सहेजी गई रीडिंग' : 'Saved palm reading');
                const cardSummary = rawSummary.replace(/\s+/g, ' ').trim().slice(0, 96);

                return `
                    <div class="maya-vastu__card ${statusClass}" data-reading-index="${index}">
                        <div class="maya-vastu__card-header">
                            <div class="maya-vastu__card-icon">
                                <i class="bi bi-hand-index"></i>
                            </div>
                            <div class="maya-vastu__card-info">
                                <h4>${reading.name || (isHindi ? 'अनाम रीडिंग' : 'Unnamed Reading')}</h4>
                                <span class="maya-vastu__card-date">
                                    <i class="bi bi-calendar3"></i> ${dateStr}
                                </span>
                            </div>
                            <div class="maya-vastu__card-score">
                                <span class="maya-vastu__score-value">${statusLabel}</span>
                            </div>
                        </div>
                        <div class="maya-vastu__card-body">
                            <div class="maya-vastu__card-direction">
                                <i class="bi bi-journal-text"></i>
                                <span>${cardSummary}${rawSummary.length > 96 ? '...' : ''}</span>
                            </div>
                            <div class="maya-vastu__card-severity">
                                <i class="bi ${statusIcon}"></i>
                                <span>${insightCount ? (isHindi ? `${insightCount} प्रमुख संकेत` : `${insightCount} key insights`) : (isHindi ? 'रीडिंग उपलब्ध' : 'Reading available')}</span>
                            </div>
                        </div>
                        <div class="maya-vastu__card-actions">
                            <button class="maya-vastu__card-btn maya-vastu__card-btn--view" data-view-reading="${index}">
                                <i class="bi bi-eye"></i>
                                <span>${isHindi ? 'देखें' : 'View'}</span>
                            </button>
                            <button class="maya-vastu__card-btn maya-vastu__card-btn--delete" data-delete-reading="${index}" title="${isHindi ? 'हटाएं' : 'Delete'}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        return `
            <div class="maya-page maya-palm-reading maya-palm-reading--fullscreen">
                <!-- Back Button -->
                <button class="maya-palm__back-btn" id="palmBackBtn">
                    <i class="bi bi-arrow-left"></i>
                </button>

                <div class="maya-palm__container">
                    <div id="palmHomeSection">
                        <div class="maya-vastu__hero">
                            <div class="maya-vastu__hero-bg"></div>
                            <div class="maya-vastu__hero-content">
                                <div class="maya-vastu__hero-icon">
                                    <i class="bi bi-hand-index"></i>
                                </div>
                                <h2 class="maya-vastu__hero-title">${isHindi ? 'हस्तरेखा विश्लेषण' : 'Palm Reading'}</h2>
                                <p class="maya-vastu__hero-sub">${isHindi ? 'दोनों हथेलियों की तस्वीर लेकर व्यक्तिगत वैदिक हस्तरेखा मार्गदर्शन प्राप्त करें' : 'Capture both palms for personalized Vedic palmistry guidance'}</p>
                                <button class="maya-vastu__start-btn" id="startNewPalmReading">
                                    <i class="bi bi-plus-circle"></i>
                                    <span>${isHindi ? 'नई रीडिंग शुरू करें' : 'Start New Reading'}</span>
                                    <i class="bi bi-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <div class="maya-vastu__features">
                            <div class="maya-vastu__feature">
                                <div class="maya-vastu__feature-icon maya-vastu__feature-icon--camera"><i class="bi bi-hand-index"></i></div>
                                <span>${isHindi ? 'बायां हाथ' : 'Left Hand'}</span>
                            </div>
                            <div class="maya-vastu__feature">
                                <div class="maya-vastu__feature-icon maya-vastu__feature-icon--camera"><i class="bi bi-hand-index" style="transform: scaleX(-1);"></i></div>
                                <span>${isHindi ? 'दायां हाथ' : 'Right Hand'}</span>
                            </div>
                            <div class="maya-vastu__feature">
                                <div class="maya-vastu__feature-icon maya-vastu__feature-icon--ai"><i class="bi bi-stars"></i></div>
                                <span>${isHindi ? 'AI रीडिंग' : 'AI Reading'}</span>
                            </div>
                            <div class="maya-vastu__feature">
                                <div class="maya-vastu__feature-icon maya-vastu__feature-icon--remedy"><i class="bi bi-gem"></i></div>
                                <span>${isHindi ? 'उपाय' : 'Remedies'}</span>
                            </div>
                        </div>

                        <div class="maya-vastu__analyses-section" id="palmSavedSection">
                            <h3 class="maya-vastu__section-title">
                                <i class="bi bi-clock-history"></i>
                                <span>${isHindi ? 'पिछली रीडिंग्स' : 'Past Readings'}</span>
                                ${savedReadings.length > 0 ? `<span class="maya-vastu__badge">${savedReadings.length}</span>` : ''}
                            </h3>
                            <div class="maya-vastu__analyses-grid" id="palmSavedList">
                                ${renderPalmReadingCards()}
                            </div>
                        </div>
                    </div>

                    <div id="palmReadingFlow" style="display:none;">
                    
                    <!-- Instructions Card - Step 1: Left Hand -->
                    <div class="maya-card maya-palm__instructions" id="palmInstructions" style="display:none;">
                        <div class="maya-palm__step-indicator">
                            <span class="maya-palm__step active" data-step="1">1</span>
                            <span class="maya-palm__step-line"></span>
                            <span class="maya-palm__step" data-step="2">2</span>
                            <span class="maya-palm__step-line"></span>
                            <span class="maya-palm__step" data-step="3"><i class="bi bi-stars"></i></span>
                        </div>
                        
                        <div class="maya-palm__hand-visual maya-palm__hand-visual--left">
                            <div class="maya-palm__hand-icon">
                                <img src="palm-of-hand.png" alt="Left Hand" class="maya-palm__hand-img maya-palm__hand-img--left">
                            </div>
                            <span class="maya-palm__hand-label">${isHindi ? 'बायां हाथ' : 'LEFT HAND'}</span>
                        </div>
                        <h3 id="palmStepTitle">${isHindi ? 'बाएं हाथ की हथेली' : 'Scan Your Left Palm'}</h3>
                        <p id="palmStepSubtitle">${isHindi ? 'बाएं हाथ में जन्मजात गुण दिखते हैं' : 'Left hand reveals your inherited traits & potential'}</p>
                        <ul class="maya-palm__tips">
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'अच्छी रोशनी में हथेली रखें' : 'Place palm in good lighting'}</li>
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'हाथ को फ्लैट और खुला रखें' : 'Keep hand flat and open'}</li>
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'रेखाएं स्पष्ट दिखनी चाहिए' : 'Lines should be clearly visible'}</li>
                        </ul>
                        <button class="maya-btn maya-btn--primary maya-btn--lg" id="startPalmScan">
                            <i class="bi bi-camera"></i>
                            ${isHindi ? 'बाएं हाथ को स्कैन करें' : 'Scan Left Hand'}
                        </button>
                    </div>
                    
                    <!-- Shared Camera Input (outside cards so it's always accessible) -->
                    <input type="file" id="palmCameraInput" accept="image/*" capture="environment" style="display:none;">

                    <!-- Preview Card - For each hand -->
                    <div class="maya-card maya-palm__preview" id="palmPreview" style="display:none;">
                        <div class="maya-palm__preview-label" id="palmPreviewLabel">
                            <span class="maya-palm__preview-badge">L</span>
                            ${isHindi ? 'बाएं हाथ' : 'Left Hand'}
                        </div>
                        <div class="maya-palm__image-wrap">
                            <img id="palmImage" src="" alt="Palm">
                        </div>
                        <div class="maya-palm__preview-actions">
                            <button class="maya-btn maya-btn--outline" id="retakePalmBtn">
                                <i class="bi bi-camera"></i>
                                ${isHindi ? 'पुनः लें' : 'Retake'}
                            </button>
                            <button class="maya-btn maya-btn--primary" id="confirmHandBtn">
                                <i class="bi bi-check-lg"></i>
                                ${isHindi ? 'आगे बढ़ें' : 'Continue'}
                            </button>
                        </div>
                    </div>
                    
                    <!-- Right Hand Instructions -->
                    <div class="maya-card maya-palm__instructions maya-palm__right-hand" id="palmRightHandInstructions" style="display:none;">
                        <div class="maya-palm__step-indicator">
                            <span class="maya-palm__step completed" data-step="1"><i class="bi bi-check"></i></span>
                            <span class="maya-palm__step-line completed"></span>
                            <span class="maya-palm__step active" data-step="2">2</span>
                            <span class="maya-palm__step-line"></span>
                            <span class="maya-palm__step" data-step="3"><i class="bi bi-stars"></i></span>
                        </div>
                        
                        <div class="maya-palm__hand-visual maya-palm__hand-visual--right">
                            <div class="maya-palm__hand-icon">
                                <img src="palm-of-hand.png" alt="Right Hand" class="maya-palm__hand-img maya-palm__hand-img--right">
                            </div>
                            <span class="maya-palm__hand-label">${isHindi ? 'दायां हाथ' : 'RIGHT HAND'}</span>
                        </div>
                        <h3>${isHindi ? 'दाएं हाथ की हथेली' : 'Now Scan Your Right Palm'}</h3>
                        <p>${isHindi ? 'दाएं हाथ में वर्तमान कर्म दिखते हैं' : 'Right hand reveals your current karma & life choices'}</p>
                        <ul class="maya-palm__tips">
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'अच्छी रोशनी में हथेली रखें' : 'Place palm in good lighting'}</li>
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'हाथ को फ्लैट और खुला रखें' : 'Keep hand flat and open'}</li>
                            <li><i class="bi bi-check-circle"></i> ${isHindi ? 'रेखाएं स्पष्ट दिखनी चाहिए' : 'Lines should be clearly visible'}</li>
                        </ul>
                        <button class="maya-btn maya-btn--primary maya-btn--lg" id="scanRightHandBtn">
                            <i class="bi bi-camera"></i>
                            ${isHindi ? 'दाएं हाथ को स्कैन करें' : 'Scan Right Hand'}
                        </button>
                    </div>

                    <!-- Loading State with Combined Hands Animation -->
                    <div class="maya-card maya-palm__loading" id="palmLoading" style="display:none;">
                        <div class="maya-palm__step-indicator">
                            <span class="maya-palm__step completed" data-step="1"><i class="bi bi-check"></i></span>
                            <span class="maya-palm__step-line completed"></span>
                            <span class="maya-palm__step completed" data-step="2"><i class="bi bi-check"></i></span>
                            <span class="maya-palm__step-line completed"></span>
                            <span class="maya-palm__step active" data-step="3"><i class="bi bi-stars"></i></span>
                        </div>
                        
                        <div class="maya-palm__combined-preview" id="palmCombinedPreview">
                            <div class="maya-palm__hand-cutout maya-palm__hand-cutout--left" id="leftHandCutout">
                                <img src="" alt="Left Hand">
                            </div>
                            <div class="maya-palm__hand-cutout maya-palm__hand-cutout--right" id="rightHandCutout">
                                <img src="" alt="Right Hand">
                            </div>
                        </div>
                        <div class="maya-palm__loading-text">
                            <div class="maya-spinner maya-spinner--sm"></div>
                            <p id="palmLoadingMessage">${isHindi ? 'हथेलियों को संयोजित किया जा रहा है...' : 'Combining your palms...'}</p>
                        </div>
                        <span class="maya-palm__loading-hint">${isHindi ? 'MAYA आपकी रेखाओं को पढ़ रही है' : 'MAYA is reading your lines'}</span>
                        
                        <!-- Skeleton Preview -->
                        <div class="maya-palm__skeleton-preview">
                            <div class="maya-palm__skeleton-tabs">
                                <div class="maya-skeleton maya-skeleton--tab"></div>
                                <div class="maya-skeleton maya-skeleton--tab"></div>
                                <div class="maya-skeleton maya-skeleton--tab"></div>
                            </div>
                            <div class="maya-palm__skeleton-cards">
                                <div class="maya-palm__skeleton-card">
                                    <div class="maya-skeleton maya-skeleton--circle"></div>
                                    <div class="maya-palm__skeleton-content">
                                        <div class="maya-skeleton maya-skeleton--title"></div>
                                        <div class="maya-skeleton maya-skeleton--text"></div>
                                        <div class="maya-skeleton maya-skeleton--text maya-skeleton--short"></div>
                                    </div>
                                </div>
                                <div class="maya-palm__skeleton-card">
                                    <div class="maya-skeleton maya-skeleton--circle"></div>
                                    <div class="maya-palm__skeleton-content">
                                        <div class="maya-skeleton maya-skeleton--title"></div>
                                        <div class="maya-skeleton maya-skeleton--text"></div>
                                        <div class="maya-skeleton maya-skeleton--text maya-skeleton--short"></div>
                                    </div>
                                </div>
                                <div class="maya-palm__skeleton-card">
                                    <div class="maya-skeleton maya-skeleton--circle"></div>
                                    <div class="maya-palm__skeleton-content">
                                        <div class="maya-skeleton maya-skeleton--title"></div>
                                        <div class="maya-skeleton maya-skeleton--text"></div>
                                        <div class="maya-skeleton maya-skeleton--text maya-skeleton--short"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Error State -->
                    <div class="maya-card maya-palm__error" id="palmError" style="display:none;">
                        <div class="maya-palm__error-icon">
                            <i class="bi bi-stars"></i>
                        </div>
                        <h3 class="maya-palm__error-title">${isHindi ? 'ब्रह्मांड से संपर्क टूट गया' : 'Lost Connection to the Cosmos'}</h3>
                        <p class="maya-palm__error-message">${isHindi ? 'चिंता न करें, तारे अभी भी आपके साथ हैं। कृपया पुनः प्रयास करें।' : 'Don\'t worry, the stars are still aligned for you. Please try again.'}</p>
                        <div class="maya-palm__error-buttons">
                            <button class="maya-palm__retry-btn" id="palmRetryBtn">
                                <i class="bi bi-arrow-repeat"></i>
                                ${isHindi ? 'पुनः प्रयास करें' : 'Try Again'}
                            </button>
                            <button class="maya-palm__new-scan-btn" id="palmErrorNewScanBtn">
                                <i class="bi bi-camera"></i>
                                ${isHindi ? 'नया स्कैन करें' : 'New Scan'}
                            </button>
                        </div>
                    </div>

                    <!-- Results Card -->
                    <div class="maya-palm__results" id="palmResults" style="display:none;">
                        <!-- Combined Hands Hero -->
                        <div class="maya-palm__result-hero maya-palm__result-hero--combined">
                            <div class="maya-palm__combined-hands" id="palmCombinedHands">
                                <!-- Combined hand images will be inserted here -->
                            </div>
                            <div class="maya-palm__result-overlay">
                                <span class="maya-palm__result-badge">
                                    <i class="bi bi-check-circle-fill" id="palmResultBadgeIcon"></i>
                                    <span id="palmResultBadgeText">${isHindi ? 'विश्लेषण पूर्ण' : 'Analysis Complete'}</span>
                                </span>
                            </div>
                        </div>
                        
                        <!-- Hand Labels -->
                        <div class="maya-palm__hand-labels">
                            <span class="maya-palm__hand-label maya-palm__hand-label--left">
                                <i class="bi bi-hand-index" style="transform: scaleX(-1);"></i>
                                ${isHindi ? 'बायां (जन्मजात)' : 'Left (Innate)'}
                            </span>
                            <span class="maya-palm__hand-label maya-palm__hand-label--right">
                                <i class="bi bi-hand-index"></i>
                                ${isHindi ? 'दायां (कर्म)' : 'Right (Karma)'}
                            </span>
                        </div>
                        
                        <!-- Category Tabs -->
                        <div class="maya-palm__tabs">
                            <button class="maya-palm__tab active" data-tab="lines">
                                <i class="bi bi-hand-index"></i>
                                <span>${isHindi ? 'रेखाएं' : 'Lines'}</span>
                            </button>
                            <button class="maya-palm__tab" data-tab="traits">
                                <i class="bi bi-person-check"></i>
                                <span>${isHindi ? 'गुण' : 'Traits'}</span>
                            </button>
                            <button class="maya-palm__tab" data-tab="remedies">
                                <i class="bi bi-gem"></i>
                                <span>${isHindi ? 'उपाय' : 'Remedies'}</span>
                            </button>
                        </div>
                        
                        <!-- Tab Content -->
                        <div class="maya-palm__tab-content" id="palmResultsContent">
                            <!-- Dynamic cards will be inserted here -->
                        </div>
                        
                        <!-- Actions -->
                        <div class="maya-palm__results-actions maya-palm__results-actions--sticky">
                            <button class="maya-btn maya-btn--gold" id="savePalmReadingBtn">
                                <i class="bi bi-bookmark-plus"></i>
                                ${isHindi ? 'सहेजें' : 'Save'}
                            </button>
                            <button class="maya-btn maya-btn--primary" id="newPalmScanBtn">
                                <i class="bi bi-camera"></i>
                                ${isHindi ? 'नई रीडिंग' : 'New Reading'}
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            
            <!-- Save Reading Modal -->
            <div class="maya-modal" id="savePalmModal">
                <div class="maya-modal__backdrop"></div>
                <div class="maya-modal__content">
                    <div class="maya-modal__header">
                        <h3>${isHindi ? 'रीडिंग सहेजें' : 'Save Reading'}</h3>
                        <button class="maya-modal__close" id="closeSavePalmModal">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="maya-modal__body">
                        <div class="maya-form-group">
                            <label class="maya-label">${isHindi ? 'हाथ का नाम' : 'Hand Name'}</label>
                            <input type="text" class="maya-input" id="palmReadingName" 
                                   placeholder="${isHindi ? 'उदा: मेरा हाथ, माँ का हाथ' : 'e.g., My Hand, Mom\'s Hand'}">
                        </div>
                    </div>
                    <div class="maya-modal__footer">
                        <button class="maya-btn maya-btn--outline" id="cancelSavePalmBtn">${isHindi ? 'रद्द करें' : 'Cancel'}</button>
                        <button class="maya-btn maya-btn--primary" id="confirmSavePalmBtn">${isHindi ? 'सहेजें' : 'Save'}</button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Profile page
     */
    renderProfile(profile, isHindi) {
        // Use user's preferred zodiac system (Western or Vedic)
        const zodiac = profile?.birthDate ? MayaAstrology.getZodiac(profile.birthDate, profile) : null;
        const zodiacSystem = MayaAstrology.getZodiacSystem();
        const initials = profile?.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
        const profilePhoto = MayaUtils.storage.get('maya_profile_photo');
        const session = MayaUtils.storage.get('maya_session');

        return `
            <div class="maya-page maya-profile">
                <div class="maya-page__header">
                    <h2 class="maya-page__title">${isHindi ? 'मेरी प्रोफ़ाइल' : 'My Profile'}</h2>
                    <p class="maya-page__subtitle">${isHindi ? 'अपनी जानकारी प्रबंधित करें' : 'Manage your information'}</p>
                </div>
                
                <div class="maya-profile__card">
                    <div class="maya-profile__photo-section">
                        <div class="maya-profile__avatar-wrapper">
                            <div class="maya-profile__avatar ${profilePhoto ? 'has-photo' : ''}">
                                ${profilePhoto
                ? `<img src="${profilePhoto}" alt="Profile" class="maya-profile__avatar-img">`
                : `<span>${initials}</span>`}
                            </div>
                            <button class="maya-profile__photo-btn" id="changePhotoBtn" title="${isHindi ? 'फोटो बदलें' : 'Change Photo'}">
                                <i class="bi bi-camera-fill"></i>
                            </button>
                            <input type="file" id="profilePhotoInput" accept="image/*" style="display: none;">
                        </div>
                        <div class="maya-profile__info">
                            <h3 class="maya-profile__name">${profile?.name || (isHindi ? 'आपका नाम' : 'Your Name')}</h3>
                            ${zodiac ? `<span class="maya-profile__sign">
                                <img src="${zodiac.image}" alt="${zodiac.name}" class="maya-profile__sign-image" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';">
                                <span class="maya-profile__sign-symbol" style="display:none;">${zodiac.symbol}</span>
                                ${zodiac.name}
                            </span>` : ''}
                            ${session?.email ? `<span class="maya-profile__email"><i class="bi bi-envelope"></i> ${session.email}</span>` : ''}
                        </div>
                    </div>
                    
                    ${profilePhoto ? `
                        <button class="maya-btn maya-btn--danger-outline maya-btn--sm" id="removePhotoBtn">
                            <i class="bi bi-trash"></i>
                            ${isHindi ? 'फोटो हटाएं' : 'Remove Photo'}
                        </button>
                    ` : ''}
                </div>

                <div class="maya-profile__form">
                    <div class="maya-section">
                        <h4 class="maya-section__title">
                            <i class="bi bi-person"></i>
                            ${isHindi ? 'व्यक्तिगत विवरण' : 'Personal Details'}
                        </h4>
                        
                        <div class="maya-form-group">
                            <label class="maya-label">${isHindi ? 'पूरा नाम' : 'Full Name'}</label>
                            <input type="text" class="maya-input" id="profileName" 
                                   value="${profile?.name || ''}" placeholder="${isHindi ? 'अपना पूरा नाम दर्ज करें' : 'Enter your full name'}">
                        </div>
                        
                        <div class="maya-form-group">
                            <label class="maya-label">${isHindi ? 'लिंग' : 'Gender'}</label>
                            <div class="maya-radio-group">
                                <label class="maya-radio">
                                    <input type="radio" name="profileGender" value="male" ${profile?.gender === 'male' ? 'checked' : ''}>
                                    <span class="maya-radio__mark"></span>
                                    <span class="maya-radio__label">${isHindi ? 'पुरुष' : 'Male'}</span>
                                </label>
                                <label class="maya-radio">
                                    <input type="radio" name="profileGender" value="female" ${profile?.gender === 'female' ? 'checked' : ''}>
                                    <span class="maya-radio__mark"></span>
                                    <span class="maya-radio__label">${isHindi ? 'महिला' : 'Female'}</span>
                                </label>
                                <label class="maya-radio">
                                    <input type="radio" name="profileGender" value="other" ${profile?.gender === 'other' ? 'checked' : ''}>
                                    <span class="maya-radio__mark"></span>
                                    <span class="maya-radio__label">${isHindi ? 'अन्य' : 'Other'}</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="maya-section">
                        <h4 class="maya-section__title">
                            <i class="bi bi-calendar-heart"></i>
                            ${isHindi ? 'जन्म विवरण' : 'Birth Details'}
                        </h4>
                        
                        <div class="maya-form-row">
                            <div class="maya-form-group">
                                <label class="maya-label">${isHindi ? 'जन्म तिथि' : 'Birth Date'}</label>
                                <input type="date" class="maya-input" id="profileBirthDate" 
                                       value="${profile?.birthDate || ''}" max="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="maya-form-group">
                                <label class="maya-label">${isHindi ? 'जन्म समय' : 'Birth Time'}</label>
                                <input type="time" class="maya-input" id="profileBirthTime" 
                                       value="${profile?.birthTime || ''}">
                            </div>
                        </div>
                        
                        <div class="maya-form-group maya-place-autocomplete-wrapper">
                            <label class="maya-label">${isHindi ? 'जन्म स्थान' : 'Birth Place'}</label>
                            <input type="text" class="maya-input maya-place-autocomplete" id="profileBirthPlace" 
                                   value="${profile?.birthPlace || ''}" placeholder="${isHindi ? 'शहर, देश' : 'City, Country'}" autocomplete="off">
                            <input type="hidden" id="profileBirthLat" value="${profile?.birthLat ?? ''}">
                            <input type="hidden" id="profileBirthLng" value="${profile?.birthLon ?? ''}">
                            <input type="hidden" id="profileBirthTimezone" value="">
                        </div>
                    </div>
                    
                    <div class="maya-section">
                        <h4 class="maya-section__title">
                            <i class="bi bi-stars"></i>
                            ${isHindi ? 'राशि प्रणाली' : 'Zodiac System'}
                        </h4>
                        <p class="maya-section__desc">${isHindi ? 'अपनी पसंदीदा ज्योतिष प्रणाली चुनें' : 'Choose your preferred astrological system'}</p>
                        
                        <div class="maya-toggle-group" id="zodiacSystemToggle">
                            <button class="maya-toggle-btn ${zodiacSystem === 'western' ? 'active' : ''}" data-system="western">
                                <span class="maya-toggle-btn__icon"><i class="bi bi-globe-americas"></i></span>
                                <span class="maya-toggle-btn__label">${isHindi ? 'पाश्चात्य' : 'Western'}</span>
                                <span class="maya-toggle-btn__desc">${isHindi ? 'सूर्य राशि' : 'Sun Sign (Tropical)'}</span>
                            </button>
                            <button class="maya-toggle-btn ${zodiacSystem === 'vedic' ? 'active' : ''}" data-system="vedic">
                                <span class="maya-toggle-btn__icon"><i class="bi bi-peace"></i></span>
                                <span class="maya-toggle-btn__label">${isHindi ? 'वैदिक' : 'Vedic'}</span>
                                <span class="maya-toggle-btn__desc">${isHindi ? 'चंद्र राशि' : 'Moon Sign (Sidereal)'}</span>
                            </button>
                        </div>
                    </div>

                    <button class="maya-btn maya-btn--primary maya-btn--block" id="saveProfile">
                        <i class="bi bi-check-lg"></i>
                        <span>${isHindi ? 'प्रोफ़ाइल सहेजें' : 'Save Profile'}</span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render Settings page
     */
    renderSettings(isHindi) {
        const currentLang = MayaUtils.storage.get('maya_language') || 'en';
        const currentTheme = MayaUtils.storage.get('maya_theme') || 'dark';
        const voiceMuted = MayaUtils.storage.get('maya_voice_muted') || false;
        const notificationsEnabled = MayaUtils.storage.get('maya_notifications') !== false;

        return `
            <div class="maya-page maya-settings">
                <div class="maya-page__header">
                    <h2 class="maya-page__title">${isHindi ? 'सेटिंग्स' : 'Settings'}</h2>
                    <p class="maya-page__subtitle">${isHindi ? 'अपना MAYA अनुभव अनुकूलित करें' : 'Customize your MAYA experience'}</p>
                </div>

                <div class="maya-settings__groups">
                    <div class="maya-settings__group">
                        <h4 class="maya-settings__group-title">
                            <i class="bi bi-sliders"></i>
                            ${isHindi ? 'प्राथमिकताएं' : 'Preferences'}
                        </h4>
                        
                        <div class="maya-settings__item">
                            <div class="maya-settings__item-info">
                                <div class="maya-settings__item-icon">
                                    <i class="bi bi-translate"></i>
                                </div>
                                <div class="maya-settings__item-text">
                                    <span class="maya-settings__item-label">${isHindi ? 'AI आवाज़ की भाषा' : 'AI Voice Language'}</span>
                                    <span class="maya-settings__item-desc">${isHindi ? 'MAYA की बोलने की भाषा' : "MAYA's speaking language"}</span>
                                </div>
                            </div>
                            <div class="maya-select-wrapper">
                                <div class="maya-select" id="settingLanguage" data-value="${currentLang}">
                                    ${currentLang === 'en' ? 'English' : 'हिंदी'}
                                </div>
                                <div class="maya-select-dropdown">
                                    <div class="maya-select-option ${currentLang === 'en' ? 'selected' : ''}" data-value="en">English</div>
                                    <div class="maya-select-option ${currentLang === 'hi' ? 'selected' : ''}" data-value="hi">हिंदी</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="maya-settings__item">
                            <div class="maya-settings__item-info">
                                <div class="maya-settings__item-icon">
                                    <i class="bi bi-moon-stars"></i>
                                </div>
                                <div class="maya-settings__item-text">
                                    <span class="maya-settings__item-label">${isHindi ? 'थीम' : 'Theme'}</span>
                                    <span class="maya-settings__item-desc">${isHindi ? 'ऐप का रूप' : 'App appearance'}</span>
                                </div>
                            </div>
                            <div class="maya-select-wrapper">
                                <div class="maya-select" id="settingTheme" data-value="${currentTheme}">
                                    ${currentTheme === 'dark' ? (isHindi ? 'डार्क' : 'Dark') : currentTheme === 'light' ? (isHindi ? 'लाइट' : 'Light') : (isHindi ? 'सिस्टम' : 'System')}
                                </div>
                                <div class="maya-select-dropdown">
                                    <div class="maya-select-option ${currentTheme === 'dark' ? 'selected' : ''}" data-value="dark">${isHindi ? 'डार्क' : 'Dark'}</div>
                                    <div class="maya-select-option ${currentTheme === 'light' ? 'selected' : ''}" data-value="light">${isHindi ? 'लाइट' : 'Light'}</div>
                                    <div class="maya-select-option ${currentTheme === 'system' ? 'selected' : ''}" data-value="system">${isHindi ? 'सिस्टम' : 'System'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="maya-settings__item">
                            <div class="maya-settings__item-info">
                                <div class="maya-settings__item-icon">
                                    <i class="bi bi-volume-up"></i>
                                </div>
                                <div class="maya-settings__item-text">
                                    <span class="maya-settings__item-label">${isHindi ? 'आवाज़ प्रतिक्रिया' : 'Voice Responses'}</span>
                                    <span class="maya-settings__item-desc">${isHindi ? 'MAYA की आवाज़ सक्षम करें' : "Enable MAYA's voice"}</span>
                                </div>
                            </div>
                            <label class="maya-toggle">
                                <input type="checkbox" id="settingVoice" ${!voiceMuted ? 'checked' : ''}>
                                <span class="maya-toggle__slider"></span>
                            </label>
                        </div>
                        
                        <div class="maya-settings__item">
                            <div class="maya-settings__item-info">
                                <div class="maya-settings__item-icon">
                                    <i class="bi bi-bell"></i>
                                </div>
                                <div class="maya-settings__item-text">
                                    <span class="maya-settings__item-label">${isHindi ? 'दैनिक सूचनाएं' : 'Daily Notifications'}</span>
                                    <span class="maya-settings__item-desc">${isHindi ? 'राशिफल अलर्ट' : 'Horoscope alerts'}</span>
                                </div>
                            </div>
                            <label class="maya-toggle">
                                <input type="checkbox" id="settingNotifications" ${notificationsEnabled ? 'checked' : ''}>
                                <span class="maya-toggle__slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="maya-settings__group">
                        <h4 class="maya-settings__group-title">
                            <i class="bi bi-info-circle"></i>
                            ${isHindi ? 'जानकारी' : 'About'}
                        </h4>
                        
                        <div class="maya-settings__about">
                            <div class="maya-settings__about-item">
                                <span>${isHindi ? 'संस्करण' : 'Version'}</span>
                                <span>2.0.0 (Build ${MayaUtils.getAppVersion().build})</span>
                            </div>
                            <div class="maya-settings__about-item">
                                <span>${isHindi ? 'निर्मित' : 'Built with'}</span>
                                <span><i class="bi bi-heart-fill" style="color: #ef4444;"></i> & Vedic Wisdom</span>
                            </div>
                        </div>
                        
                        <div class="maya-settings__cache-section">
                            <button class="maya-btn maya-btn--outline maya-btn--sm" id="clearCacheBtn">
                                <i class="bi bi-arrow-clockwise"></i>
                                <span>${isHindi ? 'कैश साफ़ करें और रीलोड करें' : 'Clear Cache & Reload'}</span>
                            </button>
                            <p class="maya-settings__cache-hint">
                                ${isHindi ? 'अपडेट के बाद समस्याओं को ठीक करने के लिए' : 'Use to fix issues after updates'}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="maya-settings__actions">
                    <button class="maya-btn maya-btn--danger-outline maya-btn--block" id="logoutBtn">
                        <i class="bi bi-box-arrow-right"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Initialize page-specific scripts
     */
    initPageScripts(pageId) {
        switch (pageId) {
            case 'home':
                this.initHomePage();
                break;
            case 'journal':
                this.initJournalPage();
                break;
            case 'horoscope':
                this.initHoroscopePage();
                break;
            case 'kundli':
                this.initKundliPage();
                break;
            case 'compatibility':
                this.initCompatibilityPage();
                break;
            case 'chat':
                this.initChatPage();
                break;
            case 'chat-history':
                this.initChatHistoryPage();
                break;
            case 'muhurat':
                this.initMuhuratPage();
                break;
            case 'spiritual-music':
                this.initSpiritualMusicPage();
                break;
            case 'vastu':
                this.initVastuPage();
                break;
            case 'palm-reading':
                this.initPalmReadingPage();
                break;
            case 'profile':
                this.initProfilePage();
                break;
            case 'settings':
                this.initSettingsPage();
                break;
        }

        // Re-bind quick action links for newly rendered content (use event delegation to avoid duplicates)
        this.bindPageLinks();
    },

    /**
     * Initialize Kundli page - render charts
     */
    initKundliPage() {
        // Initialize the canvas charts after DOM is ready
        if (window.MayaKundli) {
            setTimeout(() => {
                MayaKundli.initCharts();
            }, 100);
        }
    },

    /**
     * Bind page navigation links using event delegation (prevents duplicate listeners)
     */
    bindPageLinks() {
        // Only bind once using event delegation on the content container
        const content = document.getElementById('main-content');
        if (!content || content._pageLinksbound) return;

        content._pageLinksbound = true;
        content.addEventListener('click', (e) => {
            const link = e.target.closest('[data-page]');
            if (link) {
                e.preventDefault();
                const page = link.dataset.page;
                this.render(page);
            }

            // Handle showMaya action
            const actionLink = e.target.closest('[data-action="showMaya"]');
            if (actionLink) {
                e.preventDefault();
                if (window.MayaApp) MayaApp.showMaya();
            }
        });
    },

    /**
     * Initialize Muhurat page
     */
    initMuhuratPage() {
        const isHindi = false; // UI always English

        document.querySelectorAll('.maya-muhurat__activity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all
                document.querySelectorAll('.maya-muhurat__activity-btn').forEach(b =>
                    b.classList.remove('maya-muhurat__activity-btn--active'));
                // Add to clicked
                e.currentTarget.classList.add('maya-muhurat__activity-btn--active');
                // Update results
                const activity = e.currentTarget.dataset.activity;
                const resultsDiv = document.getElementById('muhuratResults');
                if (resultsDiv) {
                    resultsDiv.innerHTML = this.getMuhuratDates(activity, isHindi);
                }
            });
        });
    },

    /**
     * Initialize Palm Reading page
     */
    initPalmReadingPage() {
        const isHindi = false; // UI always English
        console.log(' Initializing Palm Reading Page (Dual Hand Mode)');

        // Hide header and footer for fullscreen mode
        const header = document.querySelector('.maya-header');
        const footer = document.querySelector('#bottom-nav') || document.querySelector('.maya-footer');
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';

        const homeSection = document.getElementById('palmHomeSection');
        const flowSection = document.getElementById('palmReadingFlow');
        const startReadingBtn = document.getElementById('startNewPalmReading');
        const backBtn = document.getElementById('palmBackBtn');
        const startBtn = document.getElementById('startPalmScan');
        const cameraInput = document.getElementById('palmCameraInput');
        const instructionsCard = document.getElementById('palmInstructions');
        const previewCard = document.getElementById('palmPreview');
        const rightHandInstructions = document.getElementById('palmRightHandInstructions');
        const loadingCard = document.getElementById('palmLoading');
        const errorCard = document.getElementById('palmError');
        const resultsCard = document.getElementById('palmResults');
        const palmImage = document.getElementById('palmImage');
        const retakeBtn = document.getElementById('retakePalmBtn');
        const confirmHandBtn = document.getElementById('confirmHandBtn');
        const scanRightHandBtn = document.getElementById('scanRightHandBtn');
        const newScanBtn = document.getElementById('newPalmScanBtn');
        const saveBtn = document.getElementById('savePalmReadingBtn');
        const resultsContent = document.getElementById('palmResultsContent');

        // Debug: Log which elements were found
        console.log(' Elements found:', {
            startBtn: !!startBtn,
            cameraInput: !!cameraInput,
            instructionsCard: !!instructionsCard,
            previewCard: !!previewCard,
            rightHandInstructions: !!rightHandInstructions,
            scanRightHandBtn: !!scanRightHandBtn,
            confirmHandBtn: !!confirmHandBtn
        });

        const showPalmHomeState = () => {
            if (homeSection) homeSection.style.display = 'block';
            if (flowSection) flowSection.style.display = 'none';
            if (instructionsCard) instructionsCard.style.display = 'none';
            if (previewCard) previewCard.style.display = 'none';
            if (rightHandInstructions) rightHandInstructions.style.display = 'none';
            if (loadingCard) loadingCard.style.display = 'none';
            if (errorCard) errorCard.style.display = 'none';
            if (resultsCard) resultsCard.style.display = 'none';
        };

        const startNewReadingFlow = () => {
            this._resetPalmState();
            if (cameraInput) cameraInput.value = '';
            if (homeSection) homeSection.style.display = 'none';
            if (flowSection) flowSection.style.display = 'block';
            if (instructionsCard) instructionsCard.style.display = 'block';
            if (previewCard) previewCard.style.display = 'none';
            if (rightHandInstructions) rightHandInstructions.style.display = 'none';
            if (loadingCard) loadingCard.style.display = 'none';
            if (errorCard) errorCard.style.display = 'none';
            if (resultsCard) resultsCard.style.display = 'none';
        };

        this._palmUiActions = {
            showPalmHomeState,
            startNewReadingFlow
        };

        if (startReadingBtn) {
            startReadingBtn.onclick = () => {
                startNewReadingFlow();
            };
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (flowSection && flowSection.style.display !== 'none') {
                    showPalmHomeState();
                    return;
                }

                const currentHeader = document.querySelector('.maya-header');
                const currentFooter = document.querySelector('#bottom-nav') || document.querySelector('.maya-footer');
                if (currentHeader) currentHeader.style.display = '';
                if (currentFooter) currentFooter.style.display = '';
                this.render('home');
            });
        }

        // State for dual hand capture
        this._palmState = {
            leftHandImage: null,
            rightHandImage: null,
            leftHandOriginal: null,   // Original unprocessed
            rightHandOriginal: null,  // Original unprocessed
            leftHandProcessed: null,  // Background removed
            rightHandProcessed: null, // Background removed
            leftProcessing: false,    // Is left hand being processed
            rightProcessing: false,   // Is right hand being processed
            combinedImage: null,
            currentHand: 'left',  // 'left' or 'right'
            analysisData: null
        };

        // Store references for event delegation
        this._palmElements = {
            cameraInput,
            instructionsCard,
            previewCard,
            rightHandInstructions,
            loadingCard,
            resultsCard,
            palmImage,
            isHindi
        };

        // Start scan button (Left hand)
        if (startBtn && cameraInput) {
            startBtn.onclick = () => {
                this._palmState.currentHand = 'left';
                cameraInput.value = ''; // Clear to allow re-selection
                cameraInput.click();
            };
        }

        // Scan right hand button
        if (scanRightHandBtn) {
            scanRightHandBtn.onclick = () => {
                console.log(' Scan Right Hand clicked');
                this._palmState.currentHand = 'right';
                cameraInput.value = ''; // Clear to allow re-selection
                cameraInput.click();
            };
        } else {
            console.warn(' scanRightHandBtn not found at init, will use delegation');
            // Only add delegation if button wasn't found
            document.getElementById('main-content')?.addEventListener('click', (e) => {
                const rightBtn = e.target.closest('#scanRightHandBtn');
                if (rightBtn && this._palmState && !rightBtn._handlerAttached) {
                    rightBtn._handlerAttached = true;
                    console.log(' Scan Right Hand clicked (via delegation)');
                    this._palmState.currentHand = 'right';
                    const input = document.getElementById('palmCameraInput');
                    if (input) {
                        input.value = '';
                        input.click();
                    }
                }
            });
        }

        // Camera input change
        if (cameraInput) {
            cameraInput.onchange = (e) => {
                console.log(' Camera input changed, currentHand:', this._palmState.currentHand);
                console.log(' Files:', e.target.files);

                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    console.log(' File selected:', file.name, file.size);

                    // Check if HEIC/HEIF and convert first
                    const isHEIC = file.type === 'image/heic' ||
                        file.type === 'image/heif' ||
                        file.name.toLowerCase().endsWith('.heic') ||
                        file.name.toLowerCase().endsWith('.heif');

                    const processFile = async (fileToRead) => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            let imageData = event.target.result;
                            console.log(' Image loaded, length:', imageData.length);

                            // If still HEIC data URL, convert via canvas as fallback
                            if (imageData.startsWith('data:image/heic') || imageData.startsWith('data:image/heif')) {
                                try {
                                    const img = new Image();
                                    const canvas = document.createElement('canvas');
                                    await new Promise((resolve, reject) => {
                                        img.onload = resolve;
                                        img.onerror = reject;
                                        img.src = imageData;
                                    });
                                    canvas.width = img.naturalWidth;
                                    canvas.height = img.naturalHeight;
                                    canvas.getContext('2d').drawImage(img, 0, 0);
                                    imageData = canvas.toDataURL('image/jpeg', 0.85);
                                    console.log(' HEIC canvas fallback converted, length:', imageData.length);
                                } catch (canvasErr) {
                                    console.warn(' Canvas HEIC fallback failed:', canvasErr);
                                }
                            }

                            this._palmHandleImageLoaded(imageData, isHindi, palmImage, instructionsCard, rightHandInstructions, previewCard, loadingCard, resultsCard);
                        };
                        reader.onerror = (error) => {
                            console.error(' FileReader error:', error);
                        };
                        reader.readAsDataURL(fileToRead);
                    };

                    if (isHEIC && typeof heic2any !== 'undefined') {
                        console.log(' Converting HEIC to JPEG for palm reading...');
                        heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
                            .then(convertedBlob => {
                                const jpeg = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                                console.log(' HEIC converted successfully:', Math.round(jpeg.size / 1024) + 'KB');
                                processFile(jpeg);
                            })
                            .catch(heicErr => {
                                console.warn(' HEIC conversion failed, trying raw file:', heicErr);
                                processFile(file);
                            });
                    } else {
                        processFile(file);
                    }
                } else {
                    console.log(' No file selected');
                }
            };
        }

        // Retake button
        if (retakeBtn) {
            retakeBtn.onclick = () => {
                cameraInput.value = '';
                if (this._palmState.currentHand === 'left') {
                    this._palmState.leftHandImage = null;
                    instructionsCard.style.display = 'block';
                } else {
                    this._palmState.rightHandImage = null;
                    rightHandInstructions.style.display = 'block';
                }
                previewCard.style.display = 'none';
            };
        }

        // Confirm hand button (move to next step)
        if (confirmHandBtn) {
            confirmHandBtn.onclick = async () => {
                console.log(' Confirm clicked, currentHand:', this._palmState.currentHand);

                if (this._palmState.currentHand === 'left' && !this._palmState.rightHandImage) {
                    // Left hand done, move to right hand capture
                    console.log(' Moving to right hand capture');
                    previewCard.style.display = 'none';
                    rightHandInstructions.style.display = 'block';
                } else if (this._palmState.rightHandImage) {
                    // Both hands captured - go straight to analysis
                    // Validation + bg removal + reading all happen in _startPalmAnalysis
                    console.log(' Both hands captured, starting analysis...');
                    await this._startPalmAnalysis(isHindi);
                } else {
                    console.error(' Unexpected state in confirm button');
                }
            };
        }

        // New scan button
        if (newScanBtn) {
            newScanBtn.onclick = () => {
                startNewReadingFlow();
            };
        }

        // Save button
        if (saveBtn) {
            saveBtn.onclick = () => {
                console.log(' Save button clicked');
                console.log(' Current analysis data:', this._palmState?.analysisData ? 'exists' : 'missing');
                this._showSavePalmModal(isHindi);
            };
        } else {
            console.warn(' Save button not found!');
        }

        // Initialize saved readings handlers
        this._initSavedPalmReadings(isHindi);

        // Initialize modal handlers
        this._initSavePalmModal(isHindi);

        showPalmHomeState();
    },

    /**
     * Reset palm reading state
     */
    _resetPalmState() {
        this._palmState = {
            leftHandImage: null,
            rightHandImage: null,
            leftHandOriginal: null,
            rightHandOriginal: null,
            leftHandProcessed: null,
            rightHandProcessed: null,
            leftProcessing: false,
            rightProcessing: false,
            combinedImage: null,
            currentHand: 'left',
            analysisData: null
        };
    },

    /**
     * Handle loaded palm image data - set preview and store state
     */
    _palmHandleImageLoaded(imageData, isHindi, palmImage, instructionsCard, rightHandInstructions, previewCard, loadingCard, resultsCard) {
        const previewLabel = document.getElementById('palmPreviewLabel');
        const handName = this._palmState.currentHand === 'left'
            ? (isHindi ? 'बाएं हाथ' : 'Left Hand')
            : (isHindi ? 'दाएं हाथ' : 'Right Hand');
        const badgeClass = this._palmState.currentHand === 'left' ? 'left' : 'right';

        // Show preview immediately - validation happens with analysis later
        palmImage.src = imageData;
        previewLabel.innerHTML = `
            <span class="maya-palm__preview-badge maya-palm__preview-badge--${badgeClass}">${this._palmState.currentHand === 'left' ? 'L' : 'R'}</span>
            ${handName}
        `;

        instructionsCard.style.display = 'none';
        if (rightHandInstructions) rightHandInstructions.style.display = 'none';
        previewCard.style.display = 'block';
        loadingCard.style.display = 'none';
        resultsCard.style.display = 'none';

        // Store original image (no API calls yet)
        if (this._palmState.currentHand === 'left') {
            this._palmState.leftHandOriginal = imageData;
            this._palmState.leftHandImage = imageData;
        } else {
            this._palmState.rightHandOriginal = imageData;
            this._palmState.rightHandImage = imageData;
        }

        console.log(' Preview ready, waiting for user to confirm');
    },

    /**
     * Validate that the uploaded image is a palm of the correct hand
     * Uses Gemini Vision for fast classification
     * @returns {Object} { valid: boolean, reason: string }
     */
    async _validateHandImage(imageData, expectedHand, isHindi) {
        try {
            const prompt = `Look at this image. Answer these 3 questions in JSON only:
1. "isHand": Is this an image of a human hand/palm? (true/false)
2. "palmVisible": Is the palm (inner side) clearly visible with fingers spread? (true/false)  
3. "whichHand": Which hand is this? ("left", "right", or "unknown")

Rules for determining left vs right:
- If the thumb points to the RIGHT side of the image, it is the LEFT hand (palm facing camera)
- If the thumb points to the LEFT side of the image, it is the RIGHT hand (palm facing camera)

Respond with ONLY this JSON, nothing else:
{"isHand": true/false, "palmVisible": true/false, "whichHand": "left"/"right"/"unknown"}`;

            const response = await this._callGeminiVision(prompt, imageData);

            if (!response) {
                console.warn(' Hand validation: no response, allowing through');
                return { valid: true, reason: '' };
            }

            // Parse JSON from response
            let result;
            try {
                const jsonMatch = response.match(/\{[\s\S]*?\}/);
                result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            } catch (e) {
                console.warn(' Hand validation: parse error, allowing through');
                return { valid: true, reason: '' };
            }

            if (!result) return { valid: true, reason: '' };

            console.log(' Hand validation result:', result);

            // Check 1: Is it a hand?
            if (!result.isHand) {
                return {
                    valid: false,
                    reason: isHindi
                        ? 'यह हाथ की छवि नहीं है। कृपया अपनी हथेली की फ़ोटो लें।'
                        : 'This doesn\'t appear to be a hand image. Please capture a photo of your palm.'
                };
            }

            // Check 2: Is the palm visible?
            if (!result.palmVisible) {
                return {
                    valid: false,
                    reason: isHindi
                        ? 'हथेली स्पष्ट नहीं है। कृपया हथेली को कैमरे की ओर रखें और उंगलियाँ फैलाएँ।'
                        : 'Palm is not clearly visible. Please face your palm towards the camera with fingers spread.'
                };
            }

            // Check 3: Is it the correct hand?
            if (result.whichHand !== 'unknown' && result.whichHand !== expectedHand) {
                const expectedName = expectedHand === 'left'
                    ? (isHindi ? 'बायाँ' : 'left')
                    : (isHindi ? 'दायाँ' : 'right');
                const detectedName = result.whichHand === 'left'
                    ? (isHindi ? 'बायाँ' : 'left')
                    : (isHindi ? 'दायाँ' : 'right');
                return {
                    valid: false,
                    reason: isHindi
                        ? `यह ${detectedName} हाथ है, लेकिन ${expectedName} हाथ की आवश्यकता है। कृपया सही हाथ की फ़ोटो लें।`
                        : `This looks like your ${detectedName} hand, but we need your ${expectedName} hand. Please capture the correct hand.`
                };
            }

            return { valid: true, reason: '' };
        } catch (error) {
            console.warn(' Hand validation error, allowing through:', error);
            // On any error, allow through so the feature isn't blocked
            return { valid: true, reason: '' };
        }
    },

    /**
     * Start palm analysis - process images and call AI
     * Handles bg removal + validation + analysis in one efficient flow
     */
    async _startPalmAnalysis(isHindi) {
        const loadingCard = document.getElementById('palmLoading');
        const previewCard = document.getElementById('palmPreview');
        const resultsCard = document.getElementById('palmResults');
        const loadingMessage = document.getElementById('palmLoadingMessage');

        // Show loading
        previewCard.style.display = 'none';
        loadingCard.style.display = 'block';

        // Use original images (skip bg removal to save credits and time)
        const leftImageForAI = this._palmState.leftHandOriginal || this._palmState.leftHandImage;
        const rightImageForAI = this._palmState.rightHandOriginal || this._palmState.rightHandImage;

        // Show the images in cutouts
        const leftCutout = document.querySelector('#leftHandCutout img');
        const rightCutout = document.querySelector('#rightHandCutout img');
        this._palmState.leftHandProcessed = leftImageForAI;
        this._palmState.rightHandProcessed = rightImageForAI;
        if (leftCutout) leftCutout.src = leftImageForAI;
        if (rightCutout) rightCutout.src = rightImageForAI;

        // Prefer cleaned hand images for AI when they are ready quickly.
        const withTimeout = (promise, timeoutMs, fallbackValue) =>
            Promise.race([
                promise.catch(() => fallbackValue),
                new Promise(resolve => setTimeout(() => resolve(fallbackValue), timeoutMs))
            ]);

        const leftBgRemovalPromise = this._removeBackground(leftImageForAI)
            .then(img => {
                const refinedImage = img || leftImageForAI;
                this._palmState.leftHandProcessed = refinedImage;
                if (leftCutout) leftCutout.src = refinedImage;
                return refinedImage;
            })
            .catch(() => leftImageForAI);

        const rightBgRemovalPromise = this._removeBackground(rightImageForAI)
            .then(img => {
                const refinedImage = img || rightImageForAI;
                this._palmState.rightHandProcessed = refinedImage;
                if (rightCutout) rightCutout.src = refinedImage;
                return refinedImage;
            })
            .catch(() => rightImageForAI);

        const bgRemovalPromise = Promise.allSettled([leftBgRemovalPromise, rightBgRemovalPromise]);

        try {
            // Step 1: Combine images
            loadingMessage.textContent = isHindi ? 'हथेलियों को संयोजित किया जा रहा है...' : 'Combining your palms...';
            this._palmState.combinedImage = await this._combineHandImages(
                leftImageForAI,
                rightImageForAI
            );

            const [leftImageForAnalysis, rightImageForAnalysis] = await Promise.all([
                withTimeout(leftBgRemovalPromise, 5000, leftImageForAI),
                withTimeout(rightBgRemovalPromise, 5000, rightImageForAI)
            ]);

            // Step 2: Analyze with AI - validation is built into the prompt
            loadingMessage.textContent = isHindi ? 'MAYA आपकी रेखाएँ पढ़ रही है...' : 'MAYA is reading your lines...';
            console.log(' Sending images to AI - Left:', leftImageForAnalysis ? 'YES' : 'NO', 'Right:', rightImageForAnalysis ? 'YES' : 'NO');
            const analysisData = await this._analyzePalm(
                leftImageForAnalysis,
                rightImageForAnalysis,
                isHindi
            );

            // Check if AI flagged invalid images
            if (analysisData && analysisData.validationError) {
                console.log(' AI validation failed:', analysisData.validationError);
                MayaUtils.toast.error(analysisData.validationError);
                loadingCard.style.display = 'none';
                // Go back to left hand instructions
                const instructionsCard = document.getElementById('palmInstructions');
                if (instructionsCard) instructionsCard.style.display = 'block';
                this._resetPalmState();
                return;
            }

            this._palmState.analysisData = analysisData;

            // Wait for bg removal to finish for display
            await bgRemovalPromise;

            // Step 3: Render results
            this._renderCombinedHandsHero();
            this._renderPalmResults(analysisData, isHindi);
            this._initPalmTabs();

            loadingCard.style.display = 'none';
            resultsCard.style.display = 'block';

        } catch (error) {
            console.error('Palm analysis error:', error);
            MayaUtils.toast.error(isHindi ? 'विश्लेषण विफल' : 'Analysis failed');
            loadingCard.style.display = 'none';

            // Show error state with retry button
            const errorCard = document.getElementById('palmError');
            if (errorCard) {
                errorCard.style.display = 'block';

                // Setup retry button
                const retryBtn = document.getElementById('palmRetryBtn');
                if (retryBtn) {
                    retryBtn.onclick = async () => {
                        errorCard.style.display = 'none';
                        await this._startPalmAnalysis(isHindi);
                    };
                }

                // Setup new scan button
                const newScanBtn = document.getElementById('palmErrorNewScanBtn');
                if (newScanBtn) {
                    newScanBtn.onclick = () => {
                        errorCard.style.display = 'none';
                        // Reset palm state and go back to left hand instructions
                        this._palmState = {
                            leftHandImage: null,
                            rightHandImage: null,
                            leftHandOriginal: null,
                            rightHandOriginal: null,
                            leftHandProcessed: null,
                            rightHandProcessed: null,
                            leftProcessing: false,
                            rightProcessing: false,
                            combinedImage: null,
                            currentHand: 'left',
                            analysisData: null
                        };
                        document.getElementById('palmInstructions').style.display = 'block';
                    };
                }
            }
        }
    },

    /**
     * Remove background from hand image using remove.bg API
     * Falls back to Cloudinary background removal if remove.bg fails
     */
    async _removeBackground(imageData) {
        // Validate input
        if (!imageData || !imageData.startsWith('data:')) {
            console.warn(' Invalid image data');
            return imageData;
        }

        try {
            console.log(' Refining...');
            const response = await fetch(MAYA_CONFIG.ENDPOINTS.REMOVE_BACKGROUND, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageData })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Background removal failed with status ${response.status}`);
            }

            const result = await response.json();
            return result?.imageData?.startsWith('data:') ? result.imageData : imageData;
        } catch (error) {
            console.warn('⚠️ Background removal failed:', error.message);
            return imageData;
        }
    },

    /**
     * Combine two hand images side by side
     */
    async _combineHandImages(leftImage, rightImage) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const imgLeft = new Image();
            const imgRight = new Image();

            let loadedCount = 0;
            const onLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    // Set canvas size (side by side with gap)
                    const maxHeight = Math.max(imgLeft.height, imgRight.height);
                    const scaleFactor = 300 / maxHeight; // Normalize height

                    const leftW = imgLeft.width * scaleFactor;
                    const leftH = imgLeft.height * scaleFactor;
                    const rightW = imgRight.width * scaleFactor;
                    const rightH = imgRight.height * scaleFactor;

                    const gap = 20;
                    canvas.width = leftW + rightW + gap;
                    canvas.height = Math.max(leftH, rightH);

                    // Transparent background
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Draw left hand
                    ctx.drawImage(imgLeft, 0, (canvas.height - leftH) / 2, leftW, leftH);

                    // Draw right hand
                    ctx.drawImage(imgRight, leftW + gap, (canvas.height - rightH) / 2, rightW, rightH);

                    resolve(canvas.toDataURL('image/png'));
                }
            };

            imgLeft.onload = onLoad;
            imgRight.onload = onLoad;
            imgLeft.src = leftImage;
            imgRight.src = rightImage;
        });
    },

    /**
     * Render combined hands in hero section
     */
    _renderCombinedHandsHero() {
        const container = document.getElementById('palmCombinedHands');
        if (!container) return;

        container.innerHTML = `
            <div class="maya-palm__combined-hand maya-palm__combined-hand--left">
                <img src="${this._palmState.leftHandProcessed || this._palmState.leftHandOriginal || this._palmState.leftHandImage}" alt="Left Hand">
                <div class="maya-palm__golden-outline"></div>
            </div>
            <div class="maya-palm__combined-hand maya-palm__combined-hand--right">
                <img src="${this._palmState.rightHandProcessed || this._palmState.rightHandOriginal || this._palmState.rightHandImage}" alt="Right Hand">
                <div class="maya-palm__golden-outline"></div>
            </div>
        `;
    },

    /**
     * Initialize saved palm readings handlers
     */
    _initSavedPalmReadings(isHindi) {
        // View reading handlers
        document.querySelectorAll('[data-view-reading]').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-delete-reading]')) return; // Ignore if delete clicked
                const index = parseInt(item.dataset.viewReading);
                this._viewSavedPalmReading(index, isHindi);
            });
        });

        // Delete reading handlers
        document.querySelectorAll('[data-delete-reading]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.deleteReading);
                this._deleteSavedPalmReading(index, isHindi);
            });
        });
    },

    /**
     * View a saved palm reading
     */
    _viewSavedPalmReading(index, isHindi) {
        const savedReadings = MayaUtils.storage.get('maya_palm_readings') || [];
        const reading = savedReadings[index];

        if (!reading) return;

        // Restore state
        this._palmState = {
            leftHandImage: reading.leftHandImage,
            rightHandImage: reading.rightHandImage,
            leftHandProcessed: reading.leftHandProcessed || reading.leftHandImage,
            rightHandProcessed: reading.rightHandProcessed || reading.rightHandImage,
            combinedImage: reading.combinedImage,
            currentHand: 'left',
            analysisData: reading.analysisData
        };

        // Hide all sections
        document.getElementById('palmHomeSection')?.style.setProperty('display', 'none');
        document.getElementById('palmReadingFlow')?.style.setProperty('display', 'block');
        document.getElementById('palmInstructions').style.display = 'none';
        document.getElementById('palmPreview').style.display = 'none';
        document.getElementById('palmRightHandInstructions').style.display = 'none';
        document.getElementById('palmLoading').style.display = 'none';
        document.getElementById('palmError')?.style.setProperty('display', 'none');

        // Render and show results
        this._renderCombinedHandsHero();
        this._renderPalmResults(reading.analysisData, isHindi);
        this._initPalmTabs();

        document.getElementById('palmResults').style.display = 'block';
    },

    /**
     * Delete a saved palm reading
     */
    _deleteSavedPalmReading(index, isHindi) {
        const confirmed = confirm(isHindi ? 'क्या आप इस रीडिंग को हटाना चाहते हैं?' : 'Delete this reading?');
        if (!confirmed) return;

        const savedReadings = MayaUtils.storage.get('maya_palm_readings') || [];
        savedReadings.splice(index, 1);
        MayaUtils.storage.set('maya_palm_readings', savedReadings);

        // Re-render the page
        this.render('palm-reading');
        MayaUtils.toast.success(isHindi ? 'रीडिंग हटा दी गई' : 'Reading deleted');
    },

    /**
     * Show save palm reading modal
     */
    _showSavePalmModal(isHindi) {
        console.log(' Showing save modal...');
        const modal = document.getElementById('savePalmModal');
        console.log(' Modal element:', modal ? 'found' : 'not found');
        if (modal) {
            // Remove display:none first, then add active class for animation
            modal.style.display = '';  // Clear inline display:none
            modal.style.removeProperty('display'); // Ensure it's removed

            // Force a reflow to ensure styles are applied
            modal.offsetHeight;

            // Now add active class for opacity/visibility animation
            modal.classList.add('maya-modal--active');

            const nameInput = document.getElementById('palmReadingName');
            if (nameInput) {
                nameInput.value = '';
                setTimeout(() => nameInput.focus(), 100); // Delay focus for animation
            }
            console.log(' Modal displayed, classes:', modal.className);
        } else {
            console.error(' Save modal not found in DOM!');
            MayaUtils.toast.error(isHindi ? 'मॉडल नहीं मिला' : 'Could not open save dialog');
        }
    },

    /**
     * Initialize save modal handlers
     */
    _initSavePalmModal(isHindi) {
        const modal = document.getElementById('savePalmModal');
        const closeBtn = document.getElementById('closeSavePalmModal');
        const cancelBtn = document.getElementById('cancelSavePalmBtn');
        const confirmBtn = document.getElementById('confirmSavePalmBtn');
        const nameInput = document.getElementById('palmReadingName');
        const backdrop = modal?.querySelector('.maya-modal__backdrop');

        const hideModal = () => {
            if (modal) {
                modal.classList.remove('maya-modal--active');
                // CSS handles opacity/visibility, no need for display:none
            }
            if (nameInput) nameInput.value = '';
        };

        if (closeBtn) closeBtn.onclick = hideModal;
        if (cancelBtn) cancelBtn.onclick = hideModal;
        if (backdrop) backdrop.onclick = hideModal;

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const name = nameInput?.value?.trim() || (isHindi ? 'अनाम' : 'Unnamed');
                console.log(' Saving palm reading as:', name);
                this._savePalmReading(name, isHindi);
                hideModal();
            };
        }

        // Enter key to save
        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn?.click();
                }
            });
        }
    },

    /**
     * Save palm reading to storage
     */
    _savePalmReading(name, isHindi) {
        const savedReadings = MayaUtils.storage.get('maya_palm_readings') || [];

        const reading = {
            name: name,
            date: new Date().toISOString(),
            leftHandImage: this._palmState.leftHandImage,
            rightHandImage: this._palmState.rightHandImage,
            leftHandProcessed: this._palmState.leftHandProcessed,
            rightHandProcessed: this._palmState.rightHandProcessed,
            combinedImage: this._palmState.combinedImage,
            analysisData: this._palmState.analysisData
        };

        // Add to beginning of array (newest first)
        savedReadings.unshift(reading);

        // Keep only last 10 readings
        if (savedReadings.length > 10) {
            savedReadings.pop();
        }

        MayaUtils.storage.set('maya_palm_readings', savedReadings);
        MayaUtils.toast.success(isHindi ? 'रीडिंग सहेज ली गई!' : 'Reading saved!');
    },

    /**
     * Analyze palm images using AI (both hands with user context)
     * Returns structured JSON data for card-based display
     */
    async _analyzePalm(leftHandImage, rightHandImage, isHindi) {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const lang = isHindi ? 'Hindi' : 'English';

        // Get zodiac/rashi info
        const zodiac = profile.birthDate ? window.MayaAstrology?.getZodiac(profile.birthDate, profile) : null;

        // Calculate age
        let age = null;
        if (profile.birthDate) {
            const birth = new Date(profile.birthDate);
            const today = new Date();
            age = today.getFullYear() - birth.getFullYear();
            if (today.getMonth() < birth.getMonth() ||
                (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
                age--;
            }
        }

        // Generate unique session identifier for this reading
        const uniqueSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const currentTimestamp = new Date().toISOString();

        // Build detailed user context for truly personalized reading
        const userContext = [];
        if (profile.name) userContext.push(`Name: ${profile.name}`);
        if (age) userContext.push(`Age: ${age} years old`);
        if (profile.gender) userContext.push(`Gender: ${profile.gender}`);
        if (profile.birthDate) {
            const birthDate = new Date(profile.birthDate);
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][birthDate.getDay()];
            const birthDay = birthDate.getDate();
            const birthMonth = birthDate.getMonth() + 1;
            userContext.push(`Date of Birth: ${profile.birthDate} (Born on ${dayOfWeek})`);
            userContext.push(`Birth Day Number: ${birthDay}`);
            userContext.push(`Birth Month: ${birthMonth}`);

            // Calculate Life Path Number
            const lifePathNum = this._calculateLifePathNumber(profile.birthDate);
            userContext.push(`Numerology Life Path Number: ${lifePathNum}`);
        }
        if (profile.birthTime) {
            userContext.push(`Time of Birth: ${profile.birthTime}`);
            // Determine time period
            const [hours] = profile.birthTime.split(':').map(Number);
            const timePeriod = hours < 6 ? 'Brahma Muhurta/Early Dawn' :
                hours < 12 ? 'Morning/Pratah Kaal' :
                    hours < 15 ? 'Afternoon/Madhyahna' :
                        hours < 18 ? 'Evening/Sayahna' : 'Night/Ratri Kaal';
            userContext.push(`Birth Time Period: ${timePeriod}`);
        }
        if (profile.birthPlace) userContext.push(`Place of Birth: ${profile.birthPlace}`);
        if (zodiac) {
            userContext.push(`Rashi/Zodiac: ${zodiac.name} (${zodiac.nameHi || zodiac.name})`);
            userContext.push(`Zodiac Element: ${zodiac.element || 'Unknown'}`);
            userContext.push(`Ruling Planet: ${zodiac.rulingPlanet || 'Unknown'}`);
        }

        // Life stage context based on age
        let lifeStageContext = '';
        if (age) {
            if (age < 25) lifeStageContext = 'Early adulthood - Focus on education, career foundation, and self-discovery';
            else if (age < 35) lifeStageContext = 'Peak building years - Career advancement, relationships, and financial growth';
            else if (age < 45) lifeStageContext = 'Consolidation phase - Family responsibilities, leadership roles, and stability';
            else if (age < 55) lifeStageContext = 'Wisdom years - Experience-based decisions, mentoring others, and legacy building';
            else lifeStageContext = 'Spiritual maturity - Inner peace, sharing wisdom, and life fulfillment';
            userContext.push(`Life Stage: ${lifeStageContext}`);
        }

        const userContextStr = userContext.length > 0
            ? `\n\nUSER CONTEXT FOR HIGHLY PERSONALIZED READING:\n${userContext.join('\n')}\n\nCRITICAL: Use ALL this information to create a 100% UNIQUE reading specific to this person's life circumstances, age, zodiac traits, and numerology. NO GENERIC STATEMENTS.`
            : '\n\nNote: No user profile available. Analyze the palm images directly for unique physical characteristics.';

        const prompt = `You are MAYA, a master female Vedic palmist with 50+ years expertise in Samudrik Shastra. You are analyzing BOTH hands of a real person at timestamp: ${currentTimestamp}, Session: ${uniqueSessionId}

STEP 1 - IMAGE VALIDATION (do this FIRST before any analysis):
Check BOTH images carefully:
- Image 1 MUST be a LEFT hand palm (inner side visible, thumb pointing RIGHT)
- Image 2 MUST be a RIGHT hand palm (inner side visible, thumb pointing LEFT)
If EITHER image is NOT a human palm, or the hands are swapped (wrong hand), respond ONLY with:
{"validationError": "Brief description of what's wrong - e.g. 'Image 1 is not a palm' or 'Image 1 appears to be a right hand, not left'"}
Do NOT proceed with analysis if images are invalid.

STEP 2 - If both images are valid palms of correct hands, proceed with FULL READING:

CRITICAL INSTRUCTION - GENERATE 100% UNIQUE READING:
This reading MUST be completely unique to THIS specific person's palm. Study the actual physical characteristics visible in the images:
- Exact length, depth, color, and curvature of each line
- Presence/absence of islands, breaks, chains, branches, crosses, stars, squares on lines  
- Mount formations (Jupiter, Saturn, Apollo, Mercury, Venus, Mars, Moon) - their development
- Finger shapes, lengths, and spacing
- Thumb flexibility and angle
- Skin texture, color variations, and markings

LEFT HAND (image 1): Inherited potential, past life karma, innate abilities, what destiny gave them
RIGHT HAND (image 2): Self-made karma, current life choices, how they've shaped their destiny
${userContextStr}

ANALYZE ACTUAL VISUAL DIFFERENCES between both hands - this reveals personal evolution!

Return ONLY valid JSON, absolutely no markdown or code blocks:

{
  "lines": [
    {"name": "Life Line", "nameHi": "जीवन रेखा", "icon": "heart-pulse", "status": "positive|negative|neutral", "leftHand": "Specific observation about THIS person's left hand life line - mention actual characteristics like length, depth, curves, islands, breaks visible in the image", "rightHand": "Specific observation about right hand - note any differences from left that show personal growth or challenges faced", "summary": "25-35 word personalized analysis comparing both hands, mentioning specific features unique to THIS palm and relating to user's age/life stage", "summaryHi": "Hindi translation with equal detail"},
    {"name": "Heart Line", "nameHi": "हृदय रेखा", "icon": "heart", "status": "...", "leftHand": "Describe actual curve, starting point, ending point, any branches or chains visible", "rightHand": "Note emotional evolution shown by differences", "summary": "Personalized emotional/relationship insight based on actual line features and user's current life stage", "summaryHi": "..."},
    {"name": "Head Line", "nameHi": "मस्तिष्क रेखा", "icon": "lightbulb", "status": "...", "leftHand": "Describe actual line - straight/curved, long/short, connected to life line or separate", "rightHand": "Mental development and current thinking style", "summary": "Unique intellectual analysis based on visible features and user's profession/age context", "summaryHi": "..."},
    {"name": "Fate Line", "nameHi": "भाग्य रेखा", "icon": "star", "status": "...", "leftHand": "Origin point, strength, any breaks or changes in direction visible", "rightHand": "Career path changes and current trajectory", "summary": "Career and destiny prediction specific to user's current age and life circumstances", "summaryHi": "..."},
    {"name": "Sun Line", "nameHi": "सूर्य रेखा", "icon": "brightness-high", "status": "...", "leftHand": "Presence/absence, starting point, clarity of the Apollo line", "rightHand": "Fame and recognition potential developed through effort", "summary": "Success and recognition prediction personalized to user's zodiac and current phase", "summaryHi": "..."},
    {"name": "Marriage Line", "nameHi": "विवाह रेखा", "icon": "heart-half", "status": "...", "leftHand": "Number of lines, their depth, any crosses or islands", "rightHand": "Current relationship status and future partnership", "summary": "Relationship insight appropriate for user's age and life stage", "summaryHi": "..."}
  ],
  "traits": {
    "positive": [
      {"text": "UNIQUE strength #1 based on actual palm features AND user's zodiac/numerology - be specific!", "textHi": "Hindi"},
      {"text": "UNIQUE strength #2 - reference specific mount development or line quality visible", "textHi": "Hindi"},
      {"text": "UNIQUE strength #3 - connect palm feature to user's current life stage", "textHi": "Hindi"},
      {"text": "UNIQUE strength #4 - personalized to user's birth day/numerology", "textHi": "Hindi"},
      {"text": "UNIQUE strength #5 - specific to their zodiac element and ruling planet", "textHi": "Hindi"},
      {"text": "UNIQUE strength #6 - based on thumb/finger characteristics visible", "textHi": "Hindi"}
    ],
    "negative": [
      {"text": "Specific caution #1 based on actual challenging marks seen in palm, with practical advice for their age", "textHi": "Hindi"},
      {"text": "Specific caution #2 - health or habit concern visible, appropriate remedy for their life stage", "textHi": "Hindi"},
      {"text": "Specific caution #3 - personal growth area with zodiac-specific guidance", "textHi": "Hindi"}
    ],
    "neutral": [
      {"text": "Balanced observation #1 - unique characteristic that can go either way based on choices", "textHi": "Hindi"},
      {"text": "Balanced observation #2 - transition or transformation visible, relevant to current age", "textHi": "Hindi"},
      {"text": "Balanced observation #3 - inherited vs self-made balance observation", "textHi": "Hindi"},
      {"text": "Balanced observation #4 - potential for growth in specific area", "textHi": "Hindi"}
    ]
  },
  "remedies": [
    {"icon": "gem", "title": "Gemstone", "titleHi": "रत्न", "text": "SPECIFIC gemstone based on user's rashi AND weak/challenged areas seen in palm - include wearing instructions", "textHi": "Hindi with detailed instructions"},
    {"icon": "mantra", "title": "Mantra", "titleHi": "मंत्र", "text": "Specific mantra for user's ruling planet and current challenges - include count and timing", "textHi": "Hindi"},
    {"icon": "color", "title": "Color Therapy", "titleHi": "रंग चिकित्सा", "text": "Lucky colors based on zodiac AND palm analysis - specific days to wear", "textHi": "Hindi"},
    {"icon": "practice", "title": "Daily Practice", "titleHi": "दैनिक अभ्यास", "text": "Specific spiritual/wellness practice addressing challenges seen in their palm, suitable for their age", "textHi": "Hindi"},
    {"icon": "donation", "title": "Charity", "titleHi": "दान", "text": "Specific donation recommendation based on weak planet/area in their chart, with day and items", "textHi": "Hindi"}
  ],
  "overallSummary": "3-4 sentence highly personalized summary that: 1) Addresses user by name if available, 2) References their specific age/life stage, 3) Highlights the most unique feature of THEIR palm, 4) Gives a powerful prediction for their near future based on all factors",
  "overallSummaryHi": "Equally detailed and personalized Hindi summary"
}

OUTPUT RULES:
- Keep every leftHand/rightHand field to one short sentence, maximum 18 words.
- Keep every summary/summaryHi field to one short sentence, maximum 22 words.
- Keep every trait text/textHi to maximum 12 words.
- Keep every remedy text/textHi to maximum 18 words.
- Keep overallSummary/overallSummaryHi to exactly 2 short sentences.
- Do not use quotation marks inside field values.
- For every *Hi field*, write natural Hindi in Devanagari only. Do not mix English words except proper names like MAYA or the user's name.

REMEMBER: 
- Every statement must be UNIQUE to THIS person's actual palm features
- Reference specific visual characteristics you observe
- Connect observations to user's zodiac, age, numerology, and life circumstances  
- Absolutely NO generic fortune cookie statements
- Make predictions specific to their current life phase
- Each remedy must address something specific seen in THEIR palm`;

        try {
            // Send both images to vision API
            const response = await this._callGeminiVisionMulti(prompt, [leftHandImage, rightHandImage]);

            if (response) {
                // Extract JSON from response - try multiple patterns
                let jsonStr = response;

                // Try to find JSON in code blocks first
                const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (codeBlockMatch) {
                    jsonStr = codeBlockMatch[1].trim();
                } else {
                    // Check for validation error first
                    const validationMatch = response.match(/\{\s*"validationError"\s*:\s*"[^"]*"\s*\}/);
                    if (validationMatch) {
                        jsonStr = validationMatch[0];
                    } else {
                        // Try to find the main JSON object starting with {"lines"
                        const jsonMatch = response.match(/\{\s*"lines"\s*:\s*\[[\s\S]*\}/);
                        if (jsonMatch) {
                            jsonStr = jsonMatch[0];
                        } else {
                            // Fallback: find any JSON object
                            const fallbackMatch = response.match(/\{[\s\S]*\}/);
                            if (fallbackMatch) jsonStr = fallbackMatch[0];
                        }
                    }
                }

                // Clean up common issues
                jsonStr = jsonStr
                    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
                    .replace(/,\s*}/g, '}')          // Remove trailing commas in objects
                    .replace(/,\s*]/g, ']')          // Remove trailing commas in arrays
                    .replace(/\n/g, ' ')             // Replace newlines with spaces
                    .replace(/\r/g, '')              // Remove carriage returns
                    .trim();

                console.log(' Cleaned JSON (first 300 chars):', jsonStr.substring(0, 300));

                try {
                    const data = JSON.parse(jsonStr);
                    console.log(' Parsed data keys:', Object.keys(data));

                    // Check for validation error from AI
                    if (data.validationError) {
                        console.log(' AI validation error:', data.validationError);
                        return { validationError: data.validationError };
                    }

                    return { ...data, isFallback: false };
                } catch (e) {
                    console.warn('Palm JSON parse failed:', e.message);
                    console.log(' JSON string length:', jsonStr.length);

                    // Try to find where the JSON is malformed
                    try {
                        // Find matching braces to extract complete JSON
                        let braceCount = 0;
                        let startIdx = jsonStr.indexOf('{');
                        let endIdx = -1;

                        for (let i = startIdx; i < jsonStr.length; i++) {
                            if (jsonStr[i] === '{') braceCount++;
                            else if (jsonStr[i] === '}') braceCount--;

                            if (braceCount === 0) {
                                endIdx = i + 1;
                                break;
                            }
                        }

                        if (endIdx > startIdx) {
                            const balancedJson = jsonStr.substring(startIdx, endIdx);
                            console.log(' Attempting balanced JSON parse, length:', balancedJson.length);
                            const data = JSON.parse(balancedJson);
                            console.log(' Balanced parse succeeded, keys:', Object.keys(data));
                            return { ...data, isFallback: false };
                        }
                    } catch (e2) {
                        console.warn('Balanced JSON repair also failed:', e2.message);
                    }

                    // Try to extract partial data from truncated JSON
                    try {
                        console.log(' Attempting partial JSON extraction...');
                        const partialData = this._extractPartialPalmData(jsonStr, isHindi);
                        if (partialData && partialData.lines && partialData.lines.length > 0) {
                            console.log(' Partial extraction succeeded with', partialData.lines.length, 'lines');
                            return partialData;
                        }
                    } catch (e3) {
                        console.warn('Partial extraction failed:', e3.message);
                    }

                    // Use fallback as last resort
                    console.log(' Using fallback palm data');
                    return this._fallbackPalmData(isHindi);
                }
            }
            throw new Error('No response from AI');
        } catch (error) {
            console.error('Palm AI error:', error);
            // Use fallback data instead of throwing
            console.log(' Using fallback palm data due to error');
            return this._fallbackPalmData(isHindi);
        }
    },

    /**
     * Call Gemini Vision API with multiple images
     * Uses the single paid Gemini key to avoid fallback-key rate limit delays.
     */
    async _callGeminiVisionMulti(prompt, images) {
        // Use only the primary paid Gemini key.
        const apiKeys = [
            MAYA_CONFIG.API_KEYS.GEMINI
        ].filter(Boolean);

        console.log(`Using single Gemini API key: ${apiKeys.length}`);

        // Same models as Vastu calibrator
        const models = MAYA_CONFIG.GEMINI_MODELS || [
            'gemini-2.5-flash-lite'
        ];

        // Build parts array with both images
        const parts = [
            { text: prompt },
            { text: "\n\n=== LEFT HAND IMAGE (Image 1) ===" }
        ];

        // Add left hand image
        if (images[0]) {
            const mimeMatch = images[0].match(/^data:(image\/[\w-]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const leftBase64 = images[0].replace(/^data:image\/[\w-]+;base64,/, '');
            parts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: leftBase64
                }
            });
        }

        // Add right hand label and image
        parts.push({ text: "\n\n=== RIGHT HAND IMAGE (Image 2) ===" });

        if (images[1]) {
            const mimeMatch = images[1].match(/^data:(image\/[\w-]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const rightBase64 = images[1].replace(/^data:image\/[\w-]+;base64,/, '');
            parts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: rightBase64
                }
            });
        }

        const payload = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 6000,
                responseMimeType: 'application/json'
            },
            // Same safety settings as Vastu
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        let lastError = null;

        // Try the primary API key and configured model only.
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            const keyLabel = keyIndex === 0 ? 'Primary' : `Fallback-${keyIndex}`;

            for (const model of models) {
                try {
                    const url = `${MAYA_CONFIG.ENDPOINTS.GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
                    console.log(` Trying Gemini [${keyLabel}] model: ${model}`);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();

                    // Handle rate limit (429) without cycling through fallback keys.
                    if (response.status === 429) {
                        console.warn(`⚠️ Gemini [${keyLabel}] rate limited on ${model}. No fallback keys will be tried.`);
                        lastError = data.error?.message || 'Rate limited';
                        break;
                    }

                    // Handle 404 - model not found
                    if (response.status === 404) {
                        console.warn(`⚠️ Gemini [${keyLabel}] model ${model} not found, trying next...`);
                        continue;
                    }

                    // Handle 503 - overloaded
                    if (response.status === 503) {
                        console.warn(`⚠️ Gemini [${keyLabel}] model ${model} overloaded, trying next...`);
                        continue;
                    }

                    if (!response.ok) {
                        console.warn(`Gemini [${keyLabel}] ${model} error:`, data.error?.message || response.status);
                        lastError = data.error?.message || `HTTP ${response.status}`;
                        continue;
                    }

                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        console.log(`✅ Palm Vision success [${keyLabel}] with ${model}`);
                        return data.candidates[0].content.parts[0].text;
                    } else {
                        console.warn(`Gemini [${keyLabel}] ${model} - No text in response`, data);
                        lastError = 'No content in response';
                    }
                } catch (e) {
                    console.warn(`Gemini [${keyLabel}] ${model} failed:`, e.message);
                    lastError = e.message;
                }
            }
        }

        console.error(`❌ Gemini Vision failed with the configured key/model. Last error:`, lastError);
        throw new Error(`Palm vision analysis failed: ${lastError}`);
    },

    /**
     * Render palm results as interactive cards
     */
    _renderPalmResults(data, isHindi) {
        const container = document.getElementById('palmResultsContent');
        if (!container) {
            console.error('Palm results container not found!');
            return;
        }

        console.log(' Rendering palm results:', data);
        console.log(' Lines data:', data?.lines);
        console.log(' Traits data:', data?.traits);
        console.log(' Remedies data:', data?.remedies);

        const badgeText = document.getElementById('palmResultBadgeText');
        const badgeIcon = document.getElementById('palmResultBadgeIcon');
        if (badgeText) {
            badgeText.textContent = data?.isFallback
                ? (isHindi ? 'मार्गदर्शित रीडिंग' : 'Guided Reading')
                : (isHindi ? 'विश्लेषण पूर्ण' : 'Analysis Complete');
        }
        if (badgeIcon) {
            badgeIcon.className = data?.isFallback ? 'bi bi-info-circle-fill' : 'bi bi-check-circle-fill';
        }

        // Store data for tab switching
        this._palmData = data;
        this._palmIsHindi = isHindi;

        // Render lines tab by default
        this._renderPalmTab('lines');
    },

    /**
     * Render specific palm tab content
     */
    _renderPalmTab(tab) {
        const container = document.getElementById('palmResultsContent');
        if (!container || !this._palmData) {
            console.error('Cannot render tab - container:', !!container, 'data:', !!this._palmData);
            return;
        }

        const data = this._palmData;
        const isHindi = this._palmIsHindi;
        let html = '';

        console.log(' Rendering tab:', tab, 'with data:', data);

        if (tab === 'lines') {
            const lines = data.lines || [];
            console.log(' Rendering', lines.length, 'lines');

            if (lines.length === 0) {
                html = `<div class="maya-palm__empty-state">
                    <i class="bi bi-hand-index"></i>
                    <p>${isHindi ? 'कोई रेखा विश्लेषण उपलब्ध नहीं' : 'No line analysis available'}</p>
                </div>`;
            } else {
                html = '<div class="maya-palm__lines-grid">';
                lines.forEach(line => {
                    const statusClass = line.status === 'positive' ? 'positive' : line.status === 'negative' ? 'negative' : 'neutral';
                    const statusIcon = line.status === 'positive' ? 'check-circle-fill' : line.status === 'negative' ? 'exclamation-circle-fill' : 'dash-circle-fill';
                    const hasHandDetails = line.leftHand || line.rightHand;
                    html += `
                        <div class="maya-palm__line-card maya-palm__line-card--${statusClass} ${hasHandDetails ? 'maya-palm__line-card--expandable' : ''}" data-line="${line.name}">
                            <div class="maya-palm__line-header">
                                <div class="maya-palm__line-icon">
                                    <i class="bi bi-${line.icon || 'hand-index'}"></i>
                                </div>
                                <div class="maya-palm__line-info">
                                    <h4>${isHindi ? (line.nameHi || line.name) : line.name}</h4>
                                    <p>${isHindi ? (line.summaryHi || line.summary) : line.summary}</p>
                                </div>
                                <div class="maya-palm__line-status">
                                    <i class="bi bi-${statusIcon}"></i>
                                </div>
                            </div>
                            ${hasHandDetails ? `
                            <div class="maya-palm__line-details">
                                <div class="maya-palm__hand-detail maya-palm__hand-detail--left">
                                    <span class="maya-palm__hand-label">${isHindi ? 'बायां हाथ' : 'Left Hand'}</span>
                                    <p>${line.leftHand || (isHindi ? 'विश्लेषण उपलब्ध नहीं' : 'Analysis not available')}</p>
                                </div>
                                <div class="maya-palm__hand-detail maya-palm__hand-detail--right">
                                    <span class="maya-palm__hand-label">${isHindi ? 'दायां हाथ' : 'Right Hand'}</span>
                                    <p>${line.rightHand || (isHindi ? 'विश्लेषण उपलब्ध नहीं' : 'Analysis not available')}</p>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `;
                });
                html += '</div>';
            }
        } else if (tab === 'traits') {
            const traits = data.traits || { positive: [], negative: [], neutral: [] };
            console.log(' Rendering traits:', traits);

            // Check if any traits exist
            const hasAnyTraits = traits.positive?.length || traits.negative?.length || traits.neutral?.length;

            if (!hasAnyTraits) {
                html = `<div class="maya-palm__empty-state">
                    <i class="bi bi-person-check"></i>
                    <p>${isHindi ? 'कोई गुण विश्लेषण उपलब्ध नहीं' : 'No traits analysis available'}</p>
                </div>`;
            } else {
                // Positive traits
                if (traits.positive?.length) {
                    html += `<div class="maya-palm__trait-section">
                        <h4 class="maya-palm__trait-title maya-palm__trait-title--positive">
                            <i class="bi bi-check-circle-fill"></i> ${isHindi ? 'सकारात्मक' : 'Strengths'}
                        </h4>
                        <div class="maya-palm__trait-chips">`;
                    traits.positive.forEach(t => {
                        const text = isHindi ? (t.textHi || t.text) : t.text;
                        html += `<span class="maya-palm__chip maya-palm__chip--positive">${text}</span>`;
                    });
                    html += '</div></div>';
                }

                // Neutral traits
                if (traits.neutral?.length) {
                    html += `<div class="maya-palm__trait-section">
                        <h4 class="maya-palm__trait-title maya-palm__trait-title--neutral">
                            <i class="bi bi-info-circle-fill"></i> ${isHindi ? 'जानकारी' : 'Insights'}
                        </h4>
                        <div class="maya-palm__trait-chips">`;
                    traits.neutral.forEach(t => {
                        const text = isHindi ? (t.textHi || t.text) : t.text;
                        html += `<span class="maya-palm__chip maya-palm__chip--neutral">${text}</span>`;
                    });
                    html += '</div></div>';
                }

                // Negative/Caution traits
                if (traits.negative?.length) {
                    html += `<div class="maya-palm__trait-section">
                        <h4 class="maya-palm__trait-title maya-palm__trait-title--negative">
                            <i class="bi bi-exclamation-triangle-fill"></i> ${isHindi ? 'सावधानी' : 'Cautions'}
                        </h4>
                        <div class="maya-palm__trait-chips">`;
                    traits.negative.forEach(t => {
                        const text = isHindi ? (t.textHi || t.text) : t.text;
                        html += `<span class="maya-palm__chip maya-palm__chip--negative">${text}</span>`;
                    });
                    html += '</div></div>';
                }
            }
        } else if (tab === 'remedies') {
            // Icon mapping for remedies (ensures valid Bootstrap Icons)
            const iconMap = {
                'gem': 'gem',
                'gemstone': 'gem',
                'stone': 'gem',
                'crystal': 'gem',
                'sun': 'sun-fill',
                'mantra': 'mic-fill',
                'chant': 'mic-fill',
                'prayer': 'mic-fill',
                'palette': 'palette-fill',
                'color': 'palette-fill',
                'colours': 'palette-fill',
                'colors': 'palette-fill',
                'droplet': 'droplet-fill',
                'water': 'droplet-fill',
                'practice': 'sunrise-fill',
                'ritual': 'sunrise-fill',
                'gift': 'gift-fill',
                'donation': 'gift-fill',
                'donate': 'gift-fill',
                'charity': 'gift-fill',
                'moon': 'moon-stars-fill',
                'star': 'star-fill',
                'flower': 'flower1',
                'temple': 'building',
                'default': 'check-circle-fill'
            };

            const remedies = data.remedies || [];
            console.log(' Rendering remedies:', remedies);

            if (remedies.length === 0) {
                html = `<div class="maya-palm__empty-state">
                    <i class="bi bi-gem"></i>
                    <p>${isHindi ? 'कोई उपाय उपलब्ध नहीं' : 'No remedies available'}</p>
                </div>`;
            } else {
                html = '<div class="maya-palm__remedies-grid">';
                remedies.forEach(remedy => {
                    // Get mapped icon or use default
                    const iconKey = (remedy.icon || 'default').toLowerCase();
                    const iconName = iconMap[iconKey] || iconMap['default'];

                    html += `
                        <div class="maya-palm__remedy-card">
                            <div class="maya-palm__remedy-icon">
                                <i class="bi bi-${iconName}"></i>
                            </div>
                            <div class="maya-palm__remedy-info">
                                <h5>${isHindi ? (remedy.titleHi || remedy.title) : remedy.title}</h5>
                                <p>${isHindi ? (remedy.textHi || remedy.text) : remedy.text}</p>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }

        console.log(' Final HTML length:', html.length);
        container.innerHTML = html;
    },

    /**
     * Initialize palm result tabs
     */
    _initPalmTabs() {
        // Tab switching
        document.querySelectorAll('.maya-palm__tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.maya-palm__tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._renderPalmTab(tab.dataset.tab);
            };
        });

        // Expandable line cards - click to show left/right hand details
        document.querySelectorAll('.maya-palm__line-card--expandable').forEach(card => {
            card.onclick = () => {
                card.classList.toggle('maya-palm__line-card--expanded');
            };
        });
    },

    /**
     * Extract partial palm data from truncated JSON
     */
    _extractPartialPalmData(jsonStr, isHindi) {
        const result = { lines: [], traits: { positive: [], negative: [], neutral: [] }, remedies: [] };

        // Try to extract lines array
        const linesMatch = jsonStr.match(/"lines"\s*:\s*\[([\s\S]*?)(?:\]|\}$)/);
        if (linesMatch) {
            const linesContent = linesMatch[1];
            // Extract individual line objects
            const lineMatches = linesContent.matchAll(/\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*\}/g);
            for (const match of lineMatches) {
                try {
                    const lineObj = JSON.parse(match[0]);
                    result.lines.push(lineObj);
                } catch (e) {
                    // Try to extract key fields manually
                    const nameMatch = match[0].match(/"name"\s*:\s*"([^"]+)"/);
                    const summaryMatch = match[0].match(/"summary"\s*:\s*"([^"]+)"/);
                    const statusMatch = match[0].match(/"status"\s*:\s*"([^"]+)"/);
                    const iconMatch = match[0].match(/"icon"\s*:\s*"([^"]+)"/);

                    if (nameMatch && summaryMatch) {
                        result.lines.push({
                            name: nameMatch[1],
                            nameHi: nameMatch[1],
                            icon: iconMatch ? iconMatch[1] : 'hand-index',
                            status: statusMatch ? statusMatch[1] : 'neutral',
                            summary: summaryMatch[1],
                            summaryHi: summaryMatch[1]
                        });
                    }
                }
            }
        }

        // If we got at least 2 lines, fill in with fallback for rest
        if (result.lines.length >= 2) {
            const fallback = this._fallbackPalmData(isHindi);
            result.isFallback = true;
            result.traits = fallback.traits;
            result.remedies = fallback.remedies;
            result.overallSummary = fallback.overallSummary;
            result.overallSummaryHi = fallback.overallSummaryHi;
            return result;
        }

        return null;
    },

    /**
     * Fallback palm data when AI fails - personalized based on user profile
     */
    _fallbackPalmData(isHindi) {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const zodiac = profile.birthDate ? window.MayaAstrology?.getZodiac(profile.birthDate, profile) : null;
        const userName = profile.name || (isHindi ? 'प्रिय' : 'Dear seeker');

        // Calculate age for personalized content
        let age = null;
        if (profile.birthDate) {
            const birth = new Date(profile.birthDate);
            const today = new Date();
            age = today.getFullYear() - birth.getFullYear();
        }

        // Personalized gemstone based on zodiac
        const gemstoneRecommendations = {
            'Aries': { gem: 'Red Coral (Moonga)', gemHi: 'मूंगा', day: 'Tuesday', finger: 'ring finger' },
            'Taurus': { gem: 'Diamond or White Sapphire', gemHi: 'हीरा या सफेद पुखराज', day: 'Friday', finger: 'middle finger' },
            'Gemini': { gem: 'Emerald (Panna)', gemHi: 'पन्ना', day: 'Wednesday', finger: 'little finger' },
            'Cancer': { gem: 'Pearl (Moti)', gemHi: 'मोती', day: 'Monday', finger: 'little finger' },
            'Leo': { gem: 'Ruby (Manik)', gemHi: 'माणिक', day: 'Sunday', finger: 'ring finger' },
            'Virgo': { gem: 'Emerald (Panna)', gemHi: 'पन्ना', day: 'Wednesday', finger: 'little finger' },
            'Libra': { gem: 'Diamond or Opal', gemHi: 'हीरा या ओपल', day: 'Friday', finger: 'middle finger' },
            'Scorpio': { gem: 'Red Coral (Moonga)', gemHi: 'मूंगा', day: 'Tuesday', finger: 'ring finger' },
            'Sagittarius': { gem: 'Yellow Sapphire (Pukhraj)', gemHi: 'पुखराज', day: 'Thursday', finger: 'index finger' },
            'Capricorn': { gem: 'Blue Sapphire (Neelam)', gemHi: 'नीलम', day: 'Saturday', finger: 'middle finger' },
            'Aquarius': { gem: 'Blue Sapphire (Neelam)', gemHi: 'नीलम', day: 'Saturday', finger: 'middle finger' },
            'Pisces': { gem: 'Yellow Sapphire (Pukhraj)', gemHi: 'पुखराज', day: 'Thursday', finger: 'index finger' }
        };

        const gemRec = zodiac ? gemstoneRecommendations[zodiac.name] || gemstoneRecommendations['Sagittarius'] : gemstoneRecommendations['Sagittarius'];

        // Life stage based traits
        let lifeStageInsight = age && age < 30
            ? { text: 'Your youth brings tremendous energy for ambitious pursuits', textHi: 'आपकी युवावस्था महत्वाकांक्षी लक्ष्यों के लिए जबरदस्त ऊर्जा लाती है' }
            : age && age < 45
                ? { text: 'Peak years of achievement - your efforts will bear rich fruits', textHi: 'उपलब्धि के शिखर वर्ष - आपके प्रयास समृद्ध फल देंगे' }
                : { text: 'Wisdom years bring clarity and respect from others', textHi: 'ज्ञान के वर्ष स्पष्टता और दूसरों से सम्मान लाते हैं' };

        return {
            isFallback: true,
            lines: [
                { name: 'Life Line', nameHi: 'जीवन रेखा', icon: 'heart-pulse', status: 'positive', leftHand: 'Strong innate vitality present from birth, blessed with natural resilience.', rightHand: 'Your active choices have enhanced your life force significantly.', summary: `${userName}, your Life Line shows excellent vitality and suggests a long, healthy life with strong recuperative powers when facing challenges.`, summaryHi: `${userName}, आपकी जीवन रेखा उत्कृष्ट जीवन शक्ति दर्शाती है और चुनौतियों का सामना करते समय मजबूत पुनर्प्राप्ति शक्ति के साथ एक लंबा, स्वस्थ जीवन सुझाती है।` },
                { name: 'Heart Line', nameHi: 'हृदय रेखा', icon: 'heart', status: 'positive', leftHand: 'Born with deep capacity for love and emotional bonding.', rightHand: 'Life experiences have deepened your emotional maturity beautifully.', summary: `Your Heart Line reveals deep emotional intelligence. ${zodiac ? `As a ${zodiac.name}, ` : ''}you form lasting bonds and your loyalty in relationships is exceptional.`, summaryHi: `आपकी हृदय रेखा गहरी भावनात्मक बुद्धिमत्ता प्रकट करती है। ${zodiac ? `एक ${zodiac.nameHi || zodiac.name} के रूप में, ` : ''}आप स्थायी बंधन बनाते हैं और रिश्तों में आपकी वफादारी असाधारण है।` },
                { name: 'Head Line', nameHi: 'मस्तिष्क रेखा', icon: 'lightbulb', status: 'neutral', leftHand: 'Natural analytical abilities with creative thinking potential.', rightHand: 'Developed practical wisdom through life experiences.', summary: `${userName}, your Head Line shows a balanced mind capable of both logical analysis and creative thinking. Trust your decision-making abilities.`, summaryHi: `${userName}, आपकी मस्तिष्क रेखा एक संतुलित मन दर्शाती है जो तार्किक विश्लेषण और रचनात्मक सोच दोनों में सक्षम है। अपनी निर्णय क्षमताओं पर भरोसा रखें।` },
                { name: 'Fate Line', nameHi: 'भाग्य रेखा', icon: 'star', status: 'positive', leftHand: 'Destined for meaningful achievements with inherent determination.', rightHand: 'Your self-made efforts are strengthening your success path.', summary: `Your Fate Line indicates self-made success. ${age ? `At ${age}, ` : ''}you're building a legacy through your own determination and hard work.`, summaryHi: `आपकी भाग्य रेखा स्वनिर्मित सफलता का संकेत देती है। ${age ? `${age} वर्ष की आयु में, ` : ''}आप अपने दृढ़ संकल्प और कड़ी मेहनत से विरासत बना रहे हैं।` },
                { name: 'Sun Line', nameHi: 'सूर्य रेखा', icon: 'brightness-high', status: 'positive', leftHand: 'Innate creative talents and potential for recognition.', rightHand: 'Your work is bringing you closer to well-deserved appreciation.', summary: `${userName}, your Sun Line promises recognition and success. ${zodiac ? `${zodiac.name}'s ` : 'Your '}natural talents will bring fame in your chosen field.`, summaryHi: `${userName}, आपकी सूर्य रेखा पहचान और सफलता का वादा करती है। ${zodiac ? `${zodiac.nameHi || zodiac.name} की ` : 'आपकी '}प्राकृतिक प्रतिभाएं आपके चुने हुए क्षेत्र में प्रसिद्धि लाएंगी।` },
                { name: 'Marriage Line', nameHi: 'विवाह रेखा', icon: 'heart-half', status: 'neutral', leftHand: 'Born with capacity for deep, meaningful partnership.', rightHand: 'Your choices are shaping fulfilling relationships.', summary: `Your Marriage Line suggests one profound, meaningful relationship marked by deep understanding and lasting commitment.`, summaryHi: `आपकी विवाह रेखा गहरी समझ और स्थायी प्रतिबद्धता से चिह्नित एक गहन, सार्थक रिश्ते का सुझाव देती है।` }
            ],
            traits: {
                positive: [
                    { text: `${userName}, you possess exceptional willpower and determination to achieve your goals`, textHi: `${userName}, आपके पास अपने लक्ष्यों को प्राप्त करने के लिए असाधारण इच्छाशक्ति और दृढ़ संकल्प है` },
                    { text: `Natural creative abilities that ${zodiac ? `enhance your ${zodiac.name} ` : ''}artistic expression`, textHi: `प्राकृतिक रचनात्मक क्षमताएं जो ${zodiac ? `आपकी ${zodiac.nameHi || zodiac.name} ` : ''}कलात्मक अभिव्यक्ति को बढ़ाती हैं` },
                    { text: 'Born leadership qualities - others naturally look to you for guidance', textHi: 'जन्मजात नेतृत्व गुण - दूसरे स्वाभाविक रूप से आपसे मार्गदर्शन की अपेक्षा करते हैं' },
                    { text: 'Deep loyalty and unwavering commitment in all your relationships', textHi: 'आपके सभी रिश्तों में गहरी वफादारी और अटल प्रतिबद्धता' },
                    lifeStageInsight,
                    { text: 'Strong intuition - trust your inner voice in important decisions', textHi: 'मजबूत अंतर्ज्ञान - महत्वपूर्ण निर्णयों में अपनी आंतरिक आवाज पर भरोसा करें' }
                ],
                neutral: [
                    { text: 'You prefer calculated risks over impulsive decisions - this serves you well', textHi: 'आप आवेगी निर्णयों की तुलना में गणनात्मक जोखिम पसंद करते हैं - यह आपके लिए अच्छा है' },
                    { text: 'Introspective nature helps you understand yourself and others deeply', textHi: 'आत्मनिरीक्षण स्वभाव आपको खुद को और दूसरों को गहराई से समझने में मदद करता है' },
                    { text: `${zodiac ? zodiac.name + ' ' : ''}perfectionist tendencies drive excellence in your work`, textHi: `${zodiac ? zodiac.nameHi + ' ' : ''}पूर्णतावादी प्रवृत्तियां आपके काम में उत्कृष्टता लाती हैं` },
                    { text: 'Balance between tradition and innovation guides your approach', textHi: 'परंपरा और नवाचार के बीच संतुलन आपके दृष्टिकोण का मार्गदर्शन करता है' }
                ],
                negative: [
                    { text: `${userName}, tendency to overthink can delay action - practice mindful decision-making`, textHi: `${userName}, अधिक सोचने की प्रवृत्ति कार्रवाई में देरी कर सकती है - सचेत निर्णय लेने का अभ्यास करें` },
                    { text: 'Watch for stress accumulation - schedule regular relaxation and self-care', textHi: 'तनाव संचय पर ध्यान दें - नियमित विश्राम और स्व-देखभाल का समय निर्धारित करें' },
                    { text: 'During busy periods, don\'t neglect your health - it\'s your foundation', textHi: 'व्यस्त अवधि में अपने स्वास्थ्य की उपेक्षा न करें - यह आपकी नींव है' }
                ]
            },
            remedies: [
                { icon: 'gem', title: 'Gemstone', titleHi: 'रत्न', text: `Wear ${gemRec.gem} in gold/silver ring on ${gemRec.finger} on ${gemRec.day} morning after sunrise`, textHi: `${gemRec.day === 'Thursday' ? 'गुरुवार' : gemRec.day === 'Tuesday' ? 'मंगलवार' : gemRec.day === 'Wednesday' ? 'बुधवार' : gemRec.day === 'Friday' ? 'शुक्रवार' : gemRec.day === 'Saturday' ? 'शनिवार' : gemRec.day === 'Sunday' ? 'रविवार' : 'सोमवार'} सुबह सूर्योदय के बाद ${gemRec.finger === 'index finger' ? 'तर्जनी' : gemRec.finger === 'middle finger' ? 'मध्यमा' : gemRec.finger === 'ring finger' ? 'अनामिका' : 'कनिष्ठिका'} उंगली पर सोने/चांदी की अंगूठी में ${gemRec.gemHi} पहनें` },
                { icon: 'mantra', title: 'Mantra Chanting', titleHi: 'मंत्र जाप', text: `${userName}, chant "Om Gum Ganapataye Namaha" 108 times daily for removing obstacles from your path`, textHi: `${userName}, अपने मार्ग से बाधाओं को दूर करने के लिए रोज "ॐ गं गणपतये नमः" 108 बार जपें` },
                { icon: 'color', title: 'Color Therapy', titleHi: 'रंग चिकित्सा', text: `Wear ${zodiac && zodiac.name === 'Leo' ? 'gold/orange' : zodiac && zodiac.name === 'Cancer' ? 'white/silver' : 'yellow'} on ${gemRec.day} and green on Wednesday for enhanced luck`, textHi: `भाग्य बढ़ाने के लिए ${gemRec.day === 'Thursday' ? 'गुरुवार' : gemRec.day} को ${zodiac && zodiac.name === 'Leo' ? 'सुनहरा/नारंगी' : 'पीला'} और बुधवार को हरा पहनें` },
                { icon: 'practice', title: 'Daily Practice', titleHi: 'दैनिक अभ्यास', text: 'Offer water to Sun at sunrise facing East while chanting Gayatri Mantra for clarity and success', textHi: 'स्पष्टता और सफलता के लिए सूर्योदय पर पूर्व दिशा में गायत्री मंत्र जपते हुए सूर्य को जल अर्पित करें' },
                { icon: 'donation', title: 'Charity', titleHi: 'दान', text: `Donate ${zodiac && zodiac.name === 'Sagittarius' ? 'yellow items/turmeric' : 'grains and clothes'} to needy on ${gemRec.day}s for planetary blessings`, textHi: `ग्रहों की कृपा के लिए ${gemRec.day === 'Thursday' ? 'गुरुवार' : gemRec.day} को जरूरतमंदों को ${zodiac && zodiac.name === 'Sagittarius' ? 'पीली वस्तुएं/हल्दी' : 'अनाज और कपड़े'} दान करें` }
            ],
            overallSummary: `${userName}, your palms reveal a destiny of achievement and fulfillment. ${zodiac ? `As a ${zodiac.name}, ` : ''}you possess natural talents that, combined with your determination, will lead to success. ${age ? `At ${age}, ` : ''}you are in a powerful phase for manifesting your goals.`,
            overallSummaryHi: `${userName}, आपकी हथेलियां उपलब्धि और पूर्णता की नियति प्रकट करती हैं। ${zodiac ? `एक ${zodiac.nameHi || zodiac.name} के रूप में, ` : ''}आपके पास प्राकृतिक प्रतिभाएं हैं जो आपके दृढ़ संकल्प के साथ मिलकर सफलता की ओर ले जाएंगी। ${age ? `${age} वर्ष की आयु में, ` : ''}आप अपने लक्ष्यों को प्रकट करने के लिए एक शक्तिशाली चरण में हैं।`
        };
    },

    /**
     * Calculate Life Path Number from birth date (Numerology)
     */
    _calculateLifePathNumber(birthDate) {
        try {
            const date = new Date(birthDate);
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            // Reduce each component to single digit (or master number)
            const reduceToSingle = (num) => {
                while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
                    num = String(num).split('').reduce((a, b) => a + parseInt(b), 0);
                }
                return num;
            };

            const dayNum = reduceToSingle(day);
            const monthNum = reduceToSingle(month);
            const yearNum = reduceToSingle(String(year).split('').reduce((a, b) => a + parseInt(b), 0));

            return reduceToSingle(dayNum + monthNum + yearNum);
        } catch (e) {
            return null;
        }
    },

    /**
     * Initialize Vastu page (main page with saved analyses)
     */
    initVastuPage() {
        const isHindi = false; // UI always English
        console.log('🏠 Initializing Vastu Page');

        // New calibration button
        const newCalibrationBtn = document.getElementById('startNewCalibration');
        console.log('🔘 New Calibration Button found:', !!newCalibrationBtn);

        if (newCalibrationBtn) {
            // Remove any existing listeners first
            newCalibrationBtn.replaceWith(newCalibrationBtn.cloneNode(true));
            const freshBtn = document.getElementById('startNewCalibration');

            freshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚀 Starting Vastu Calibration...');
                this._startVastuCalibration(isHindi);
            });
        }

        // View analysis handlers
        document.querySelectorAll('[data-view-analysis]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.viewAnalysis);
                this._viewSavedAnalysis(index, isHindi);
            });
        });

        // Delete analysis handlers
        document.querySelectorAll('[data-delete-analysis]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.deleteAnalysis);
                this._deleteSavedAnalysis(index, isHindi);
            });
        });
    },

    /**
     * Start Vastu Calibration (fullscreen flow)
     */
    _startVastuCalibration(isHindi) {
        console.log('🏠 _startVastuCalibration called');
        const mainContent = document.querySelector('#main-content');
        console.log('🏠 mainContent found:', mainContent);
        if (mainContent) {
            mainContent.innerHTML = this.renderVastuCalibration(isHindi);
            this._initVastuCalibrationPage(isHindi);
        } else {
            console.error('🏠 Could not find #main-content element!');
        }
    },

    /**
     * Initialize Vastu Calibration page (fullscreen)
     * Handles geolocation, compass, camera, and AI analysis
     */
    _initVastuCalibrationPage(isHindi) {
        // Hide header and footer for fullscreen experience
        document.querySelector('.maya-header')?.classList.add('maya-header--hidden');
        document.querySelector('#bottom-nav')?.classList.add('bottom-nav--hidden');
        document.querySelector('#main-content')?.classList.add('main-content--fullscreen');

        // State management for Vastu flow
        this._vastuState = {
            currentStep: 1,
            latitude: null,
            longitude: null,
            direction: null,
            directionDegree: 0,
            photoData: null,
            areaType: 'entrance',
            customAreaName: null, // Custom area name when "Other" is selected
            compassActive: false,
            compassMode: null, // 'auto' or 'manual'
            cameraStream: null,
            compassHandler: null,
            cameraStarting: false // Prevent multiple camera starts
        };

        // Back button handler
        const backBtn = document.getElementById('vastuBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this._exitVastuPage();
            });
        }

        // Initialize step 1 - Location
        this._initVastuLocationStep(isHindi);

        // Initialize step 2 - Camera with Compass
        this._initVastuCameraStep(isHindi);

        // Initialize area selection step
        this._initVastuAreaStep(isHindi);

        // Initialize step 3 - Analysis
        this._initVastuAnalysisStep(isHindi);
    },

    /**
     * View a saved Vastu analysis
     */
    _viewSavedAnalysis(index, isHindi) {
        const savedAnalyses = MayaUtils.storage.get('maya_vastu_analyses') || [];
        const analysis = savedAnalyses[index];

        if (!analysis) return;

        const areaLabels = {
            entrance: { en: 'Main Entrance', hi: 'मुख्य द्वार' },
            living_room: { en: 'Living Room', hi: 'बैठक' },
            bedroom: { en: 'Bedroom', hi: 'शयनकक्ष' },
            kitchen: { en: 'Kitchen', hi: 'रसोई' },
            bathroom: { en: 'Bathroom', hi: 'बाथरूम' },
            pooja_room: { en: 'Pooja Room', hi: 'पूजा कक्ष' },
            office: { en: 'Office', hi: 'कार्यालय' },
            other: { en: 'Other', hi: 'अन्य' }
        };

        const area = areaLabels[analysis.areaType] || areaLabels.other;

        // Show analysis in a fullscreen modal
        const modalHtml = `
            <div class="maya-modal maya-modal--vastu maya-modal--fullscreen" id="vastuAnalysisModal">
                <div class="maya-modal__overlay" id="vastuModalOverlay"></div>
                <div class="maya-modal__container maya-modal__container--fullscreen">
                    <div class="maya-modal__header maya-modal__header--sticky">
                        <button class="maya-modal__back" id="closeVastuModal">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                        <h3>${isHindi ? area.hi : area.en}</h3>
                        <span class="maya-modal__header-badge">${analysis.score}/10</span>
                    </div>
                    <div class="maya-modal__body maya-modal__body--scroll">
                        <div class="maya-vastu__analysis-meta-bar">
                            <div class="maya-vastu__meta-chip">
                                <i class="bi bi-geo-alt-fill"></i>
                                ${parseFloat(analysis.latitude).toFixed(4)}°, ${parseFloat(analysis.longitude).toFixed(4)}°
                            </div>
                            <div class="maya-vastu__meta-chip">
                                <i class="bi bi-compass-fill"></i>
                                ${analysis.direction} (${analysis.directionDegree}°)
                            </div>
                        </div>
                        <div class="maya-vastu__analysis-result">
                            ${analysis.analysisHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Activate the modal (base .maya-modal is hidden by default)
        requestAnimationFrame(() => {
            document.getElementById('vastuAnalysisModal')?.classList.add('maya-modal--active');
        });

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        // Close modal handlers
        const closeModal = () => {
            const modal = document.getElementById('vastuAnalysisModal');
            if (modal) {
                modal.classList.remove('maya-modal--active');
                setTimeout(() => modal.remove(), 300);
            }
            document.body.style.overflow = '';
        };

        document.getElementById('closeVastuModal')?.addEventListener('click', closeModal);
        document.getElementById('vastuModalOverlay')?.addEventListener('click', closeModal);

        // Also handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    /**
     * Delete a saved Vastu analysis
     */
    _deleteSavedAnalysis(index, isHindi) {
        if (!confirm(isHindi ? 'क्या आप इस विश्लेषण को हटाना चाहते हैं?' : 'Delete this analysis?')) {
            return;
        }

        const savedAnalyses = MayaUtils.storage.get('maya_vastu_analyses') || [];
        savedAnalyses.splice(index, 1);
        MayaUtils.storage.set('maya_vastu_analyses', savedAnalyses);

        MayaUtils.toast.success(isHindi ? 'विश्लेषण हटाया गया' : 'Analysis deleted');
        this.render('vastu');
    },

    /**
     * Exit Vastu page and restore header/footer
     */
    _exitVastuPage() {
        // Stop camera and compass
        this._stopCameraAndCompass();

        // Restore header and footer
        document.querySelector('.maya-header')?.classList.remove('maya-header--hidden');
        document.querySelector('#bottom-nav')?.classList.remove('bottom-nav--hidden');
        document.querySelector('#main-content')?.classList.remove('main-content--fullscreen');

        // Go back to home
        this.render('home');
    },

    /**
     * Initialize Vastu Location Step
     */
    _initVastuLocationStep(isHindi) {
        const getLocationBtn = document.getElementById('getLocationBtn');
        const locationDisplay = document.getElementById('locationDisplay');

        if (getLocationBtn) {
            getLocationBtn.addEventListener('click', async () => {
                getLocationBtn.disabled = true;
                getLocationBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> <span>${isHindi ? 'प्राप्त हो रहा है...' : 'Getting location...'}</span>`;

                console.log('📍 Location button clicked');

                // Helper: try geolocation with given options + manual timeout
                const tryGeolocation = (options, label) => {
                    return new Promise((resolve, reject) => {
                        if (!navigator.geolocation) {
                            reject(new Error('Geolocation not supported'));
                            return;
                        }

                        console.log(`📍 Trying ${label}...`);

                        // Manual timeout safety net (in case browser timeout doesn't fire)
                        const safetyTimer = setTimeout(() => {
                            console.warn(`📍 ${label} safety timeout hit`);
                            reject(new Error('Manual timeout'));
                        }, (options.timeout || 10000) + 3000);

                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                clearTimeout(safetyTimer);
                                console.log(`📍 ${label} success:`, pos.coords.latitude, pos.coords.longitude);
                                resolve(pos);
                            },
                            (err) => {
                                clearTimeout(safetyTimer);
                                console.warn(`📍 ${label} failed:`, err.code, err.message);
                                reject(err);
                            },
                            options
                        );
                    });
                };

                // Helper: IP-based fallback
                const tryIPGeolocation = async () => {
                    console.log('📍 Trying IP-based geolocation fallback...');
                    try {
                        const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(8000) });
                        const data = await resp.json();
                        if (data.latitude && data.longitude) {
                            return { coords: { latitude: data.latitude, longitude: data.longitude } };
                        }
                    } catch (e) { console.warn('📍 ipapi.co failed:', e); }

                    try {
                        const resp = await fetch('https://ip-api.com/json/?fields=lat,lon', { signal: AbortSignal.timeout(8000) });
                        const data = await resp.json();
                        if (data.lat && data.lon) {
                            return { coords: { latitude: data.lat, longitude: data.lon } };
                        }
                    } catch (e) { console.warn('📍 ip-api.com failed:', e); }

                    throw new Error('All location methods failed');
                };

                try {
                    let position;

                    try {
                        // Attempt 1: Fast coarse location (cached OK, low accuracy)
                        position = await tryGeolocation({
                            enableHighAccuracy: false,
                            timeout: 8000,
                            maximumAge: 300000 // 5 min cache OK
                        }, 'coarse location');
                    } catch (coarseErr) {
                        // Only try high accuracy if coarse wasn't a permission denial
                        if (coarseErr.code === 1) throw coarseErr; // permission denied - don't retry

                        try {
                            // Attempt 2: High accuracy GPS
                            getLocationBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> <span>${isHindi ? 'GPS खोज रहा है...' : 'Searching GPS...'}</span>`;
                            position = await tryGeolocation({
                                enableHighAccuracy: true,
                                timeout: 12000,
                                maximumAge: 0
                            }, 'high accuracy GPS');
                        } catch (gpsErr) {
                            // Attempt 3: IP-based fallback
                            getLocationBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> <span>${isHindi ? 'अनुमानित स्थान...' : 'Estimating location...'}</span>`;
                            position = await tryIPGeolocation();
                            MayaUtils.toast.info(isHindi ? 'अनुमानित स्थान का उपयोग' : 'Using approximate location');
                        }
                    }

                    this._vastuState.latitude = parseFloat(position.coords.latitude).toFixed(6);
                    this._vastuState.longitude = parseFloat(position.coords.longitude).toFixed(6);

                    // Update display with success
                    locationDisplay.innerHTML = `
                        <i class="bi bi-check-circle-fill" style="color:var(--maya-success);font-size:1.25rem"></i>
                        <span style="color:var(--maya-text-primary);font-size:0.85rem">${this._vastuState.latitude}°, ${this._vastuState.longitude}°</span>
                    `;
                    locationDisplay.style.gap = '8px';

                    MayaUtils.toast.success(isHindi ? 'स्थान प्राप्त!' : 'Location found!');

                    // Go to Enable Compass step (Step 1.5)
                    setTimeout(() => {
                        this._goToVastuStep(1.5);
                        this._initCompassEnableStep(isHindi);
                    }, 400);

                } catch (error) {
                    console.error('📍 All location attempts failed:', error);
                    let errorMsg = isHindi ? 'स्थान प्राप्त करने में विफल' : 'Failed to get location';
                    if (error.code === 1) {
                        errorMsg = isHindi ? 'कृपया सेटिंग्स में स्थान की अनुमति दें' : 'Please allow location access in settings';
                    } else if (error.code === 2) {
                        errorMsg = isHindi ? 'स्थान सेवा उपलब्ध नहीं' : 'Location service unavailable';
                    } else if (error.code === 3 || error.message?.includes('timeout')) {
                        errorMsg = isHindi ? 'स्थान प्राप्त करने में समय लगा, पुनः प्रयास करें' : 'Location timed out, please try again';
                    }

                    MayaUtils.toast.error(errorMsg);
                    getLocationBtn.disabled = false;
                    getLocationBtn.innerHTML = `<i class="bi bi-arrow-clockwise"></i> <span>${isHindi ? 'पुनः प्रयास करें' : 'Try Again'}</span>`;
                }
            });
        }
    },

    /**
     * Initialize Compass Enable Step (step 1.5)
     * Shows Enable Compass button, on click requests permission and proceeds to compass page
     */
    async _initCompassEnableStep(isHindi) {
        const compassIcon = document.getElementById('compassInitIcon');
        const compassTitle = document.getElementById('compassStepTitle');
        const compassDesc = document.getElementById('compassStepDesc');
        const compassStatus = document.getElementById('compassStatus');
        const enableCompassBtn = document.getElementById('enableCompassBtn');
        const retryCompassBtn = document.getElementById('retryCompassBtn');
        const manualSection = document.getElementById('compassManualSection');
        const proceedWithManualBtn = document.getElementById('proceedWithManualBtn');

        // Direction names helper
        const directionNames = {
            en: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'],
            hi: ['उत्तर', 'ईशान', 'पूर्व', 'आग्नेय', 'दक्षिण', 'नैऋत्य', 'पश्चिम', 'वायव्य']
        };

        this._getDirectionName = (degree) => {
            const names = isHindi ? directionNames.hi : directionNames.en;
            const index = Math.round(degree / 45) % 8;
            return names[index];
        };

        // Check if device orientation is available
        const hasDeviceOrientation = typeof DeviceOrientationEvent !== 'undefined';
        const requiresPermission = hasDeviceOrientation && typeof DeviceOrientationEvent.requestPermission === 'function';

        console.log('🧭 Compass Enable Step - hasDeviceOrientation:', hasDeviceOrientation, 'requiresPermission:', requiresPermission);

        // Reset UI state
        compassIcon.classList.remove('maya-vastu__panel-icon--success', 'maya-vastu__panel-icon--warning');
        compassIcon.innerHTML = '<i class="bi bi-compass"></i>';
        compassTitle.textContent = isHindi ? 'कंपास सक्रिय करें' : 'Enable Compass';
        compassDesc.textContent = isHindi ? 'वास्तु विश्लेषण के लिए सही दिशा जानना आवश्यक है' : 'Accurate direction is needed for Vastu analysis';

        // Hide retry and manual initially
        if (retryCompassBtn) retryCompassBtn.style.display = 'none';
        if (manualSection) manualSection.style.display = 'none';

        if (!hasDeviceOrientation) {
            // No compass support - show manual fallback
            compassStatus.innerHTML = `
                <div class="maya-vastu__compass-status-icon maya-vastu__compass-status-icon--warning">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                </div>
                <span style="text-align:center;">${isHindi ? 'कंपास उपलब्ध नहीं है' : 'Compass not available on this device'}</span>
            `;
            enableCompassBtn.style.display = 'none';
            manualSection.style.display = 'block';
        } else {
            // Show Enable Compass button - always show it for clear user action
            compassStatus.innerHTML = `
                <div class="maya-vastu__compass-status-icon">
                    <i class="bi bi-compass" style="font-size: 2rem; color: var(--maya-primary);"></i>
                </div>
                <span style="text-align:center; color: var(--maya-text-secondary);">${isHindi ? 'कंपास को सक्रिय करने के लिए नीचे बटन दबाएं' : 'Tap the button below to enable compass'}</span>
            `;
            enableCompassBtn.style.display = 'block';
            enableCompassBtn.innerHTML = isHindi ? 'कंपास सक्रिय करें' : 'Enable Compass';
            enableCompassBtn.disabled = false;
        }

        // Enable compass button handler
        if (enableCompassBtn) {
            enableCompassBtn.onclick = async () => {
                enableCompassBtn.disabled = true;
                enableCompassBtn.innerHTML = isHindi ? 'सक्रिय हो रहा है...' : 'Enabling...';

                try {
                    // Request permission if needed (iOS 13+)
                    if (requiresPermission) {
                        const permission = await DeviceOrientationEvent.requestPermission();
                        console.log('🧭 Compass permission result:', permission);

                        if (permission === 'granted') {
                            this._vastuState.compassPermissionGranted = true;
                        } else {
                            MayaUtils.toast.error(isHindi ? 'कंपास अनुमति अस्वीकृत' : 'Compass permission denied');
                            this._showCompassManualFallbackInEnableStep(isHindi);
                            enableCompassBtn.disabled = false;
                            enableCompassBtn.innerHTML = isHindi ? 'पुनः प्रयास' : 'Try Again';
                            return;
                        }
                    } else {
                        this._vastuState.compassPermissionGranted = true;
                    }

                    // Test if compass actually works
                    const compassWorks = await this._testCompassWorks();

                    if (compassWorks) {
                        // Success! Show brief success message
                        compassStatus.innerHTML = `
                            <div class="maya-vastu__compass-status-icon maya-vastu__compass-status-icon--success">
                                <i class="bi bi-check-circle-fill" style="font-size: 2rem;"></i>
                            </div>
                            <span style="text-align:center; font-weight: 600; color: var(--maya-success);">${isHindi ? 'कंपास सक्रिय!' : 'Compass enabled!'}</span>
                        `;
                        compassIcon.classList.add('maya-vastu__panel-icon--success');
                        compassIcon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';

                        MayaUtils.toast.success(isHindi ? 'कंपास सक्रिय!' : 'Compass enabled!');

                        // Request camera permission now (before going to compass page)
                        await this._requestCameraPermission(isHindi);

                        // Proceed to compass direction lock page after short delay
                        setTimeout(() => {
                            this._goToVastuStep(2);
                            this._initDirectionLock(isHindi);
                        }, 600);
                    } else {
                        // Compass doesn't work - show manual fallback
                        MayaUtils.toast.warning(isHindi ? 'कंपास काम नहीं कर रहा' : 'Compass not working');
                        this._showCompassManualFallbackInEnableStep(isHindi);
                        enableCompassBtn.disabled = false;
                        enableCompassBtn.innerHTML = isHindi ? 'पुनः प्रयास' : 'Try Again';
                    }
                } catch (error) {
                    console.error('🧭 Compass enable error:', error);
                    MayaUtils.toast.error(isHindi ? 'कंपास त्रुटि' : 'Compass error');
                    this._showCompassManualFallbackInEnableStep(isHindi);
                    enableCompassBtn.disabled = false;
                    enableCompassBtn.innerHTML = isHindi ? 'पुनः प्रयास' : 'Try Again';
                }
            };
        }

        // Manual direction selection
        document.querySelectorAll('#compassManualSection .maya-vastu__dir-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#compassManualSection .maya-vastu__dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const degree = parseInt(btn.dataset.deg);
                this._vastuState.directionDegree = degree;
                this._vastuState.direction = this._getDirectionName(degree);
                this._vastuState.compassMode = 'manual';

                // Show proceed button
                if (proceedWithManualBtn) proceedWithManualBtn.style.display = 'block';
            };
        });

        // Proceed with manual selection - request camera permission then go to compass
        if (proceedWithManualBtn) {
            proceedWithManualBtn.onclick = async () => {
                this._vastuState.compassPermissionGranted = false;

                // Request camera permission first
                await this._requestCameraPermission(isHindi);

                this._goToVastuStep(2);
                this._initDirectionLock(isHindi);
            };
        }
    },

    /**
     * Test if compass actually provides data
     */
    _testCompassWorks() {
        return new Promise((resolve) => {
            let dataReceived = false;

            const timeout = setTimeout(() => {
                if (!dataReceived) {
                    window.removeEventListener('deviceorientation', testHandler);
                    resolve(false);
                }
            }, 2000);

            const testHandler = (event) => {
                const hasHeading = event.alpha !== null || event.webkitCompassHeading !== undefined;
                if (hasHeading) {
                    dataReceived = true;
                    clearTimeout(timeout);
                    window.removeEventListener('deviceorientation', testHandler);
                    resolve(true);
                }
            };

            window.addEventListener('deviceorientation', testHandler, true);
        });
    },

    /**
     * Request camera permission early (before camera step)
     * This ensures the camera opens directly without asking again
     */
    async _requestCameraPermission(isHindi) {
        try {
            console.log('📷 Requesting camera permission early...');

            // Request camera access to trigger permission prompt
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                }
            });

            // Stop the stream immediately - we just needed the permission
            stream.getTracks().forEach(track => track.stop());

            console.log('📷 Camera permission granted!');
            MayaUtils.toast.success(isHindi ? 'कैमरा अनुमति मिली!' : 'Camera permission granted!');
            return true;
        } catch (error) {
            console.warn('📷 Camera permission not granted:', error.message);
            // Don't show error - the file input will handle it
            return false;
        }
    },

    /**
     * Show manual fallback in enable step
     */
    _showCompassManualFallbackInEnableStep(isHindi) {
        const compassStatus = document.getElementById('compassStatus');
        const compassIcon = document.getElementById('compassInitIcon');
        const compassTitle = document.getElementById('compassStepTitle');
        const compassDesc = document.getElementById('compassStepDesc');
        const manualSection = document.getElementById('compassManualSection');

        compassStatus.innerHTML = `
            <div class="maya-vastu__compass-status-icon maya-vastu__compass-status-icon--warning">
                <i class="bi bi-exclamation-triangle-fill" style="font-size: 2rem;"></i>
            </div>
            <span style="text-align:center; color: var(--maya-warning);">${isHindi ? 'कंपास उपलब्ध नहीं' : 'Compass not available'}</span>
        `;

        compassIcon.classList.add('maya-vastu__panel-icon--warning');
        compassTitle.textContent = isHindi ? 'मैन्युअल दिशा चुनें' : 'Select Direction Manually';
        compassDesc.textContent = isHindi ? 'कृपया नीचे से दिशा चुनें' : 'Please select direction below';

        if (manualSection) manualSection.style.display = 'block';
    },

    /**
     * Initialize Compass Step (step 1.5) - OLD VERSION
     * Handles compass permission, retry logic, and manual fallback
     */
    async _initCompassStep(isHindi) {
        const compassIcon = document.getElementById('compassInitIcon');
        const compassTitle = document.getElementById('compassStepTitle');
        const compassDesc = document.getElementById('compassStepDesc');
        const compassStatus = document.getElementById('compassStatus');
        const compassStatusText = document.getElementById('compassStatusText');
        const enableCompassBtn = document.getElementById('enableCompassBtn');
        const retryCompassBtn = document.getElementById('retryCompassBtn');
        const manualSection = document.getElementById('compassManualSection');
        const proceedWithManualBtn = document.getElementById('proceedWithManualBtn');

        // Direction names helper
        const directionNames = {
            en: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'],
            hi: ['उत्तर', 'ईशान', 'पूर्व', 'आग्नेय', 'दक्षिण', 'नैऋत्य', 'पश्चिम', 'वायव्य']
        };

        this._getDirectionName = (degree) => {
            const names = isHindi ? directionNames.hi : directionNames.en;
            const index = Math.round(degree / 45) % 8;
            return names[index];
        };

        // Check if device orientation is available
        const hasDeviceOrientation = typeof DeviceOrientationEvent !== 'undefined';
        const requiresPermission = hasDeviceOrientation && typeof DeviceOrientationEvent.requestPermission === 'function';

        console.log('🧭 Compass check - hasDeviceOrientation:', hasDeviceOrientation, 'requiresPermission:', requiresPermission);

        // If permission required (iOS 13+), show the enable button
        if (requiresPermission) {
            compassStatusText.textContent = isHindi ? 'कंपास के लिए अनुमति आवश्यक' : 'Compass permission required';
            compassStatus.querySelector('.maya-spinner')?.remove();
            enableCompassBtn.style.display = 'block';
            manualSection.style.display = 'block';
        } else if (hasDeviceOrientation) {
            // Try to initialize compass automatically
            await this._tryInitializeCompass(isHindi, 0);
        } else {
            // No device orientation support - show manual only
            this._showCompassManualFallback(isHindi);
        }

        // Enable compass button handler (for iOS)
        if (enableCompassBtn) {
            enableCompassBtn.addEventListener('click', async () => {
                enableCompassBtn.disabled = true;
                enableCompassBtn.innerHTML = `<div class="maya-spinner maya-spinner--sm"></div><span>${isHindi ? 'अनुमति मांग रहा है...' : 'Requesting...'}</span>`;

                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    console.log('🧭 Compass permission result:', permission);

                    if (permission === 'granted') {
                        await this._tryInitializeCompass(isHindi, 0);
                    } else {
                        MayaUtils.toast.error(isHindi ? 'कंपास अनुमति अस्वीकृत' : 'Compass permission denied');
                        this._showCompassManualFallback(isHindi);
                    }
                } catch (error) {
                    console.error('🧭 Compass permission error:', error);
                    MayaUtils.toast.error(isHindi ? 'कंपास त्रुटि' : 'Compass error');
                    this._showCompassManualFallback(isHindi);
                }

                enableCompassBtn.disabled = false;
                enableCompassBtn.innerHTML = isHindi ? 'पुनः प्रयास' : 'Try Again';
            });
        }

        // Retry button handler
        if (retryCompassBtn) {
            retryCompassBtn.addEventListener('click', async () => {
                retryCompassBtn.disabled = true;
                retryCompassBtn.innerHTML = isHindi ? 'प्रयास कर रहा है...' : 'Trying...';

                await this._tryInitializeCompass(isHindi, 0);

                retryCompassBtn.disabled = false;
                retryCompassBtn.innerHTML = isHindi ? 'पुनः प्रयास करें' : 'Retry';
            });
        }

        // Manual direction selection
        document.querySelectorAll('#compassManualSection .maya-vastu__dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#compassManualSection .maya-vastu__dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const degree = parseInt(btn.dataset.deg);
                this._vastuState.directionDegree = degree;
                this._vastuState.direction = this._getDirectionName(degree);
                this._vastuState.compassMode = 'manual';

                // Show proceed button
                if (proceedWithManualBtn) proceedWithManualBtn.style.display = 'block';
            });
        });

        // Proceed with manual selection
        if (proceedWithManualBtn) {
            proceedWithManualBtn.addEventListener('click', () => {
                this._proceedToCamera(isHindi);
            });
        }
    },

    /**
     * Try to initialize compass with retry logic
     */
    async _tryInitializeCompass(isHindi, retryCount) {
        const maxRetries = 3;
        const compassStatus = document.getElementById('compassStatus');
        const compassStatusText = document.getElementById('compassStatusText');
        const compassIcon = document.getElementById('compassInitIcon');
        const retryCompassBtn = document.getElementById('retryCompassBtn');
        const manualSection = document.getElementById('compassManualSection');

        // Show loading state
        if (compassStatus.querySelector('.maya-spinner') === null) {
            compassStatus.innerHTML = `<div class="maya-vastu__compass-status-icon"><div class="maya-spinner maya-spinner--sm"></div></div><span id="compassStatusText">${isHindi ? 'कंपास शुरू हो रहा है...' : 'Starting compass...'}</span>`;
        }

        return new Promise((resolve) => {
            let dataReceived = false;
            let testHandler = null;

            const timeout = setTimeout(() => {
                if (!dataReceived) {
                    window.removeEventListener('deviceorientation', testHandler);
                    console.log(`🧭 Compass timeout - retry ${retryCount + 1}/${maxRetries}`);

                    if (retryCount < maxRetries - 1) {
                        // Retry
                        compassStatusText.textContent = isHindi ? `पुनः प्रयास ${retryCount + 2}/${maxRetries}...` : `Retry ${retryCount + 2}/${maxRetries}...`;
                        setTimeout(() => this._tryInitializeCompass(isHindi, retryCount + 1).then(resolve), 500);
                    } else {
                        // Max retries reached - show manual fallback
                        console.log('🧭 Compass failed after max retries');
                        this._showCompassManualFallback(isHindi);
                        resolve(false);
                    }
                }
            }, 2000);

            testHandler = (event) => {
                const heading = event.alpha !== null || event.webkitCompassHeading !== undefined;

                if (heading) {
                    dataReceived = true;
                    clearTimeout(timeout);
                    window.removeEventListener('deviceorientation', testHandler);

                    console.log('🧭 Compass working!');
                    this._vastuState.compassMode = 'auto';

                    // Success! Update UI
                    compassStatus.innerHTML = `
                        <div class="maya-vastu__compass-status-icon maya-vastu__compass-status-icon--success">
                            <i class="bi bi-check-circle-fill"></i>
                        </div>
                        <span id="compassStatusText">${isHindi ? 'कंपास सक्रिय!' : 'Compass active!'}</span>
                    `;
                    compassIcon.classList.add('maya-vastu__panel-icon--success');
                    compassIcon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';

                    // Proceed to camera after short delay
                    setTimeout(() => {
                        this._proceedToCamera(isHindi);
                    }, 800);

                    resolve(true);
                }
            };

            window.addEventListener('deviceorientation', testHandler, true);
        });
    },

    /**
     * Show manual compass fallback
     */
    _showCompassManualFallback(isHindi) {
        const compassStatus = document.getElementById('compassStatus');
        const compassStatusText = document.getElementById('compassStatusText');
        const compassIcon = document.getElementById('compassInitIcon');
        const compassTitle = document.getElementById('compassStepTitle');
        const compassDesc = document.getElementById('compassStepDesc');
        const enableCompassBtn = document.getElementById('enableCompassBtn');
        const retryCompassBtn = document.getElementById('retryCompassBtn');
        const manualSection = document.getElementById('compassManualSection');

        compassStatus.innerHTML = `
            <div class="maya-vastu__compass-status-icon maya-vastu__compass-status-icon--warning">
                <i class="bi bi-exclamation-triangle-fill"></i>
            </div>
            <span>${isHindi ? 'कंपास उपलब्ध नहीं' : 'Compass not available'}</span>
        `;

        compassIcon.classList.add('maya-vastu__panel-icon--warning');
        compassTitle.textContent = isHindi ? 'मैन्युअल दिशा चुनें' : 'Select Direction Manually';
        compassDesc.textContent = isHindi ? 'कंपास उपलब्ध नहीं है, कृपया दिशा चुनें' : 'Compass not available, please select direction';

        if (enableCompassBtn) enableCompassBtn.style.display = 'none';
        if (retryCompassBtn) retryCompassBtn.style.display = 'block';
        if (manualSection) manualSection.style.display = 'block';
    },

    /**
     * Proceed to direction lock step
     */
    _proceedToCamera(isHindi) {
        this._goToVastuStep(2);
        this._initDirectionLock(isHindi);
    },

    /**
     * Initialize Direction Lock Screen (Compass Only - No Camera)
     * Auto-requests compass permission if needed
     */
    async _initDirectionLock(isHindi) {
        this._vastuState = this._vastuState || {};
        this._vastuState.compassActive = true;
        this._vastuState.isHindi = isHindi;

        const lockBtn = document.getElementById('lockDirectionBtn');
        const nativeInput = document.getElementById('nativeCameraInput');
        const directionHeader = document.querySelector('.maya-vastu__direction-header');

        // Update instructions - now says "Lock Direction" then camera opens
        if (directionHeader) {
            directionHeader.innerHTML = `
                <h3>${isHindi ? '📍 दिशा सेट करें' : '📍 Set Direction'}</h3>
                <p>${isHindi ? 'फोन को स्कैन करने वाले क्षेत्र की ओर इशारा करें, फिर "दिशा लॉक करें" दबाएं' : 'Point phone towards area to scan, then tap "Lock Direction"'}</p>
            `;
        }

        // Back button - go back to location step
        const backBtn = document.getElementById('directionBackBtn');
        if (backBtn) {
            backBtn.onclick = () => {
                this._stopCompass();
                this._goToVastuStep(1);
            };
        }

        // Setup native camera handler - camera only, no gallery picker
        if (nativeInput) {
            // Reset input value to allow re-selection of same file
            nativeInput.value = '';

            // Force camera capture only (no gallery)
            nativeInput.setAttribute('accept', 'image/*');
            nativeInput.setAttribute('capture', 'environment');

            // Remove any onclick that might trigger gallery
            nativeInput.onclick = null;

            nativeInput.onchange = (e) => {
                console.log('📷 Camera input changed, files:', e.target.files?.length);
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    console.log('📷 File selected:', file.name, file.type, Math.round(file.size / 1024) + 'KB');
                    this._processNativePhoto(file, isHindi);
                }
            };
        }

        // Lock button - locks direction and opens camera
        if (lockBtn) {
            lockBtn.onclick = () => {
                // Store locked direction
                this._vastuState.lockedDirection = this._vastuState.direction || 'North';
                this._vastuState.lockedDegree = this._vastuState.directionDegree || 0;

                // Stop compass
                this._stopCompass();

                // Show feedback - direction locked
                MayaUtils.toast.success(isHindi ? `दिशा लॉक: ${this._vastuState.lockedDirection} ${this._vastuState.lockedDegree}°` : `Direction locked: ${this._vastuState.lockedDirection} ${this._vastuState.lockedDegree}°`);

                // Open camera after a short delay
                if (nativeInput) {
                    setTimeout(() => {
                        MayaUtils.toast.info(isHindi ? 'कैमरा खुल रहा है...' : 'Opening camera...');
                        nativeInput.click();
                    }, 300);
                }
            };
        }

        // If permission already granted, start compass immediately
        if (this._vastuState.compassPermissionGranted) {
            this._startLiveCompass(isHindi);
        }
    },

    /**
     * Request compass permission immediately (called right after getting location)
     * This ensures compass starts as soon as the compass step is shown
     */
    async _requestCompassPermissionAndStart(isHindi) {
        const hasDeviceOrientation = 'DeviceOrientationEvent' in window;
        const requiresPermission = typeof DeviceOrientationEvent?.requestPermission === 'function';

        console.log('🧭 Requesting compass permission - hasDeviceOrientation:', hasDeviceOrientation, 'requiresPermission:', requiresPermission);

        if (!hasDeviceOrientation) {
            MayaUtils.toast.info(isHindi ? 'कंपास उपलब्ध नहीं' : 'Compass not available');
            return false;
        }

        if (requiresPermission) {
            // iOS 13+ - request permission
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                console.log('🧭 Compass permission result:', permission);

                if (permission === 'granted') {
                    this._vastuState.compassPermissionGranted = true;
                    MayaUtils.toast.success(isHindi ? 'कंपास सक्रिय!' : 'Compass active!');
                    return true;
                } else {
                    MayaUtils.toast.warning(isHindi ? 'कंपास अनुमति अस्वीकृत' : 'Compass permission denied');
                    return false;
                }
            } catch (error) {
                console.error('🧭 Compass permission error:', error);
                // On some devices, this may fail silently - still allow proceeding
                return false;
            }
        } else {
            // Android or older iOS - permission not required
            this._vastuState.compassPermissionGranted = true;
            return true;
        }
    },

    /**
     * Initialize compass for direction lock
     * On iOS, permission will be requested on first interaction with lock button
     */
    async _initCompassForDirectionLock(isHindi) {
        const hasDeviceOrientation = 'DeviceOrientationEvent' in window;
        const requiresPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
        const lockBtn = document.getElementById('lockDirectionBtn');

        // Set default direction
        this._vastuState.direction = isHindi ? 'उत्तर' : 'North';
        this._vastuState.directionDegree = 0;

        if (!hasDeviceOrientation) {
            // No compass support - will use default
            MayaUtils.toast.info(isHindi ? 'कंपास उपलब्ध नहीं' : 'Compass unavailable');
            return;
        }

        // If permission already granted (from _requestCompassPermissionAndStart), start compass
        if (this._vastuState.compassPermissionGranted) {
            this._startLiveCompass(isHindi);
            return;
        }

        if (requiresPermission) {
            // iOS 13+ - need to request on user gesture
            // Wrap lock button to request permission first time
            const originalOnClick = lockBtn?.onclick;
            if (lockBtn && !this._vastuState.compassPermissionGranted) {
                lockBtn.onclick = async (e) => {
                    try {
                        const permission = await DeviceOrientationEvent.requestPermission();
                        if (permission === 'granted') {
                            this._vastuState.compassPermissionGranted = true;
                            this._startLiveCompass(isHindi);
                            // Wait a moment for compass to get reading
                            await new Promise(r => setTimeout(r, 500));
                        }
                    } catch (err) {
                        console.warn('Compass permission error:', err);
                    }
                    // Now run original action
                    if (originalOnClick) originalOnClick.call(lockBtn, e);
                };
            } else if (this._vastuState.compassPermissionGranted) {
                // Permission already granted, start compass
                this._startLiveCompass(isHindi);
            }
        } else {
            // Android or older iOS - just start compass
            this._startLiveCompass(isHindi);
        }
    },

    /**
     * Process photo from native camera
     * Supports HEIC, HEIF, JPEG, PNG, WebP, BMP, GIF
     * Converts all to JPEG for maximum compatibility
     */
    async _processNativePhoto(file, isHindi) {
        console.log('📷 Processing photo:', file.name, file.type, Math.round(file.size / 1024) + 'KB');

        // Show loading indicator
        MayaUtils.toast.info(isHindi ? 'फोटो प्रोसेस हो रही है...' : 'Processing photo...');

        try {
            let processedFile = file;

            // Check if HEIC/HEIF and convert using heic2any library
            const isHEIC = file.type === 'image/heic' ||
                file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif');

            if (isHEIC && typeof heic2any !== 'undefined') {
                console.log('📷 Converting HEIC to JPEG...');
                try {
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.7  // Good balance of quality and size
                    });
                    // heic2any may return array for multi-image HEIC
                    processedFile = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    console.log('📷 HEIC converted successfully:', Math.round(processedFile.size / 1024) + 'KB');
                    // Mark that we successfully converted - not raw HEIC anymore
                    this._vastuState.heicConverted = true;
                } catch (heicError) {
                    console.warn('📷 HEIC conversion failed, trying fallback:', heicError);
                    this._vastuState.heicConverted = false;
                    // Continue with original file - will try other methods
                }
            }

            // Read file and process
            const dataUrl = await this._readFileAsDataURL(processedFile);
            console.log('📷 File read, size:', Math.round(dataUrl.length / 1024) + 'KB');

            // Try to decode and resize using canvas (pass original file for HEIC detection)
            const finalDataUrl = await this._decodeAndResizeImage(dataUrl, file.type, file);

            this._vastuState.photoData = finalDataUrl;
            this._vastuState.photoIsHEIC = file.type === 'image/heic' || file.type === 'image/heif' ||
                file.name?.toLowerCase().endsWith('.heic');
            console.log('📷 Final image ready:', Math.round(finalDataUrl.length / 1024) + 'KB',
                this._vastuState.photoIsHEIC ? '(HEIC)' : '(JPEG)');

            this._goToVastuStep('2b');
            this._showPhotoConfirmation(isHindi);

        } catch (error) {
            console.error('📷 Photo processing error:', error);
            MayaUtils.toast.error(isHindi ? 'फोटो प्रोसेस नहीं हुई, कृपया JPEG फोटो लें' : 'Photo processing failed, please take a JPEG photo');
        }
    },

    /**
     * Read file as data URL
     */
    _readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Decode image and resize to max 1200px, convert to JPEG
     * For HEIC that browser can't decode, preserve original for Gemini (which supports HEIC)
     */
    _decodeAndResizeImage(dataUrl, originalType, originalFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                console.log('📷 Image decoded:', img.width, 'x', img.height);

                // Resize to reduce API token usage
                // 1024px max provides good quality while keeping size reasonable
                const maxSize = 1024;
                let width = img.width;
                let height = img.height;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                // Draw to canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // White background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG - target ~200-400KB for optimal Gemini token usage
                const jpeg = canvas.toDataURL('image/jpeg', 0.8);
                console.log('📷 Resized to:', width, 'x', height, 'Size:', Math.round(jpeg.length / 1024), 'KB');
                resolve(jpeg);
            };

            img.onerror = () => {
                // Browser can't decode (HEIC on Chrome/Firefox)
                console.warn('📷 Browser cannot decode image');

                // Check file size - if too large, we need to compress
                const sizeKB = Math.round(dataUrl.length / 1024);

                if (sizeKB > 500) {
                    // File is too large - Gemini will use too many input tokens
                    console.warn(`📷 Image too large (${sizeKB}KB), need compression`);

                    // For HEIC, try using heic2any one more time with lower quality
                    const isHEIC = originalType === 'image/heic' || originalType === 'image/heif' ||
                        (originalFile?.name?.toLowerCase().endsWith('.heic')) ||
                        (originalFile?.name?.toLowerCase().endsWith('.heif'));

                    if (isHEIC && typeof heic2any !== 'undefined' && originalFile) {
                        console.log('📷 Retrying HEIC conversion with lower quality...');
                        heic2any({
                            blob: originalFile,
                            toType: 'image/jpeg',
                            quality: 0.5  // Lower quality for smaller size
                        }).then(convertedBlob => {
                            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const result = e.target.result;
                                console.log('📷 HEIC retry successful:', Math.round(result.length / 1024), 'KB');
                                // Try to resize the converted image
                                this._decodeAndResizeImage(result, 'image/jpeg', null).then(resolve).catch(() => resolve(result));
                            };
                            reader.onerror = () => resolve(dataUrl);
                            reader.readAsDataURL(blob);
                        }).catch(() => {
                            // heic2any completely failed - send original but warn
                            console.warn('📷 HEIC conversion failed completely, using original');
                            const correctedUrl = dataUrl.replace(/^data:application\/octet-stream/, 'data:image/heic');
                            resolve(correctedUrl);
                        });
                        return;
                    }
                }

                // For small files or non-HEIC, keep original
                const isHEIC = originalType === 'image/heic' || originalType === 'image/heif' ||
                    (originalFile?.name?.toLowerCase().endsWith('.heic')) ||
                    (originalFile?.name?.toLowerCase().endsWith('.heif'));

                if (isHEIC) {
                    const correctedUrl = dataUrl.replace(/^data:application\/octet-stream/, 'data:image/heic')
                        .replace(/^data:image\/heif/, 'data:image/heic');
                    console.log('📷 Preserved HEIC format for Gemini API');
                    resolve(correctedUrl);
                } else {
                    resolve(dataUrl);
                }
            };

            img.src = dataUrl;
        });
    },

    /**
     * Show photo confirmation screen
     */
    _showPhotoConfirmation(isHindi) {
        const capturedPhoto = document.getElementById('capturedPhoto');
        const reviewDirection = document.getElementById('reviewDirection');
        const photoReview = document.getElementById('photoReview');
        const retakeBtn = document.getElementById('retakeBtn');
        const usePhotoBtn = document.getElementById('usePhotoBtn');

        // For HEIC that browser can't display, show placeholder immediately
        if (this._vastuState.photoIsHEIC && capturedPhoto) {
            console.log('📷 HEIC detected, showing placeholder');
            capturedPhoto.style.display = 'none';

            // Remove any existing placeholder
            const existingPlaceholder = capturedPhoto.parentNode.querySelector('.maya-vastu__photo-placeholder');
            if (existingPlaceholder) existingPlaceholder.remove();

            const placeholder = document.createElement('div');
            placeholder.className = 'maya-vastu__photo-placeholder';
            placeholder.innerHTML = `
                <i class="bi bi-image-fill" style="font-size:3rem;color:var(--maya-primary)"></i>
                <p style="margin:0.75rem 0 0;color:#fff;font-size:1rem;font-weight:600">${isHindi ? 'फोटो तैयार!' : 'Photo Ready!'}</p>
                <p style="margin:0.25rem 0 0;color:rgba(255,255,255,0.6);font-size:0.8rem">${isHindi ? 'HEIC फॉर्मेट - AI विश्लेषण के लिए तैयार' : 'HEIC format - Ready for AI analysis'}</p>
            `;
            placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;background:linear-gradient(180deg,#1a1b1d 0%,#0b0b0c 100%);min-height:300px';
            capturedPhoto.parentNode.insertBefore(placeholder, capturedPhoto);
        } else if (capturedPhoto && this._vastuState.photoData) {
            // For displayable formats (JPEG, PNG)
            capturedPhoto.onerror = () => {
                console.warn('📷 Cannot display image, showing placeholder');
                capturedPhoto.style.display = 'none';

                const existingPlaceholder = capturedPhoto.parentNode.querySelector('.maya-vastu__photo-placeholder');
                if (existingPlaceholder) existingPlaceholder.remove();

                const placeholder = document.createElement('div');
                placeholder.className = 'maya-vastu__photo-placeholder';
                placeholder.innerHTML = `
                    <i class="bi bi-check-circle-fill" style="font-size:3rem;color:var(--maya-success)"></i>
                    <p style="margin:0.5rem 0 0;color:#fff;font-size:0.9rem">${isHindi ? 'फोटो कैप्चर!' : 'Photo Captured!'}</p>
                `;
                placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;background:#1a1b1d;min-height:300px';
                capturedPhoto.parentNode.insertBefore(placeholder, capturedPhoto);
            };

            capturedPhoto.onload = () => {
                console.log('📷 Photo displayed successfully');
                capturedPhoto.style.display = 'block';
            };

            capturedPhoto.src = this._vastuState.photoData;
        }

        // Show locked direction
        if (reviewDirection) {
            reviewDirection.textContent = `${this._vastuState.lockedDirection} ${this._vastuState.lockedDegree}°`;
        }

        // Show review panel
        if (photoReview) photoReview.style.display = 'flex';

        // Retake - go back to direction lock and retrigger camera
        if (retakeBtn) {
            retakeBtn.onclick = () => {
                this._goToVastuStep(2);
                this._initDirectionLock(isHindi);
            };
        }

        // Use photo - proceed to area selection
        if (usePhotoBtn) {
            usePhotoBtn.onclick = () => this._goToAreaSelection(isHindi);
        }
    },

    /**
     * Stop compass
     */
    _stopCompass() {
        console.log('🧭 Stopping compass...');
        this._vastuState.compassActive = false;
        if (this._vastuState && this._vastuState.compassHandler) {
            window.removeEventListener('deviceorientation', this._vastuState.compassHandler, true);
            window.removeEventListener('deviceorientationabsolute', this._vastuState.compassHandler, true);
            this._vastuState.compassHandler = null;
        }
    },

    /**
     * Stop camera stream (cleanup)
     */
    _stopCameraStream() {
        if (this._vastuState && this._vastuState.cameraStream) {
            this._vastuState.cameraStream.getTracks().forEach(track => track.stop());
            this._vastuState.cameraStream = null;
        }
    },

    /**
     * Start live compass updates
     * Image-based compass - dial rotates based on device heading, needle stays fixed
     * Uses low-pass filter for smooth, stable readings
     */
    _startLiveCompass(isHindi) {
        const compassDial = document.getElementById('compassDial');
        const directionDegree = document.getElementById('directionDegree');
        const directionName = document.getElementById('directionName');

        console.log('🧭 Starting live compass...');
        this._vastuState.compassActive = true;

        // Low-pass filter variables for smooth compass readings
        let smoothedHeading = null;
        const smoothingFactor = 0.12; // Lower = smoother (0.05-0.2 range)
        let lastDisplayUpdate = 0;
        const displayUpdateInterval = 100; // Update display every 100ms (10 FPS)

        // Remove any existing listener first
        if (this._vastuState.compassHandler) {
            window.removeEventListener('deviceorientation', this._vastuState.compassHandler, true);
            window.removeEventListener('deviceorientationabsolute', this._vastuState.compassHandler, true);
        }

        this._vastuState.compassHandler = (event) => {
            if (!this._vastuState.compassActive) return;

            let heading = null;

            // iOS uses webkitCompassHeading (true north)
            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
                heading = event.webkitCompassHeading;
            } else if (event.alpha !== null && event.alpha !== undefined) {
                // Android/other - alpha is relative to initial position
                // For absolute heading, use (360 - alpha) as approximation
                heading = (360 - event.alpha) % 360;
            }

            if (heading !== null && !isNaN(heading)) {
                // Apply low-pass filter for smooth readings
                if (smoothedHeading === null) {
                    // First reading - initialize directly
                    smoothedHeading = heading;
                } else {
                    // Calculate shortest angular difference (handle 0°/360° wrap-around)
                    let delta = heading - smoothedHeading;

                    // Normalize delta to [-180, 180] range for shortest path
                    if (delta > 180) delta -= 360;
                    if (delta < -180) delta += 360;

                    // Apply exponential smoothing
                    smoothedHeading = (smoothedHeading + delta * smoothingFactor + 360) % 360;
                }

                // Throttle display updates to reduce jitter
                const now = Date.now();
                if (now - lastDisplayUpdate >= displayUpdateInterval) {
                    lastDisplayUpdate = now;

                    const roundedHeading = Math.round(smoothedHeading);

                    // Rotate the compass dial (background) opposite to heading
                    // So North on the dial aligns with where device is pointing
                    if (compassDial) {
                        compassDial.style.transform = `rotate(${-smoothedHeading}deg)`;
                        compassDial.style.webkitTransform = `rotate(${-smoothedHeading}deg)`;
                    }

                    // Update display
                    if (directionDegree) directionDegree.textContent = `${roundedHeading}°`;
                    if (directionName) directionName.textContent = this._getDirectionName(roundedHeading);

                    this._vastuState.directionDegree = roundedHeading;
                    this._vastuState.direction = this._getDirectionName(roundedHeading);
                }
            }
        };

        // Try deviceorientationabsolute first (more accurate on Android)
        if ('ondeviceorientationabsolute' in window) {
            console.log('🧭 Using deviceorientationabsolute');
            window.addEventListener('deviceorientationabsolute', this._vastuState.compassHandler, true);
        }
        // Always also listen to deviceorientation for iOS
        window.addEventListener('deviceorientation', this._vastuState.compassHandler, true);

        console.log('🧭 Compass listeners attached with low-pass filter');
    },

    /**
     * Initialize Camera Step with Compass
     */
    _initVastuCameraStep(isHindi) {
        const capturePhotoBtn = document.getElementById('capturePhotoBtn');
        const retakePhotoBtn = document.getElementById('retakePhotoBtn');
        const proceedToAreaBtn = document.getElementById('proceedToAreaBtn');

        // Direction names
        const directionNames = {
            en: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'],
            hi: ['उत्तर', 'ईशान', 'पूर्व', 'आग्नेय', 'दक्षिण', 'नैऋत्य', 'पश्चिम', 'वायव्य']
        };

        this._getDirectionName = (degree) => {
            const names = isHindi ? directionNames.hi : directionNames.en;
            const index = Math.round(degree / 45) % 8;
            return names[index];
        };

        // Manual direction selection (fallback)
        document.querySelectorAll('.maya-vastu__dir-btn-overlay').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.maya-vastu__dir-btn-overlay').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const degree = parseInt(btn.dataset.deg);
                this._vastuState.directionDegree = degree;
                this._vastuState.direction = this._getDirectionName(degree);

                // Update compass display - rotate ring, keep needle fixed
                const compassRing = document.querySelector('.maya-vastu__compass-ring-3d');
                const directionDegree = document.getElementById('directionDegree');
                const directionName = document.getElementById('directionName');

                if (compassRing) compassRing.style.transform = `rotate(${-degree}deg)`;
                if (directionDegree) directionDegree.textContent = `${degree}°`;
                if (directionName) directionName.textContent = this._vastuState.direction;

                // Hide manual selection, enable capture
                document.getElementById('manualDirectionSection')?.classList.add('maya-vastu__manual-overlay--selected');
                capturePhotoBtn.disabled = false;
            });
        });

        // Capture photo
        if (capturePhotoBtn) {
            capturePhotoBtn.addEventListener('click', () => {
                this._capturePhoto(isHindi);
            });
        }

        // Retake photo
        if (retakePhotoBtn) {
            retakePhotoBtn.addEventListener('click', () => {
                this._retakePhoto(isHindi);
            });
        }

        // Proceed to area selection
        if (proceedToAreaBtn) {
            proceedToAreaBtn.addEventListener('click', () => {
                this._goToAreaSelection(isHindi);
            });
        }
    },

    /**
     * Initialize Area Selection Step
     */
    _initVastuAreaStep(isHindi) {
        const customAreaSection = document.getElementById('customAreaSection');
        const customAreaInput = document.getElementById('customAreaInput');
        const proceedWithCustomAreaBtn = document.getElementById('proceedWithCustomAreaBtn');

        document.querySelectorAll('.maya-vastu__area-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.maya-vastu__area-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this._vastuState.areaType = btn.dataset.area;
                this._vastuState.customAreaName = null; // Reset custom area

                // If "Other" is selected, show custom input instead of proceeding
                if (btn.dataset.area === 'other') {
                    if (customAreaSection) {
                        customAreaSection.style.display = 'block';
                        customAreaInput?.focus();
                    }
                    return; // Don't proceed automatically
                }

                // Hide custom area section for other options
                if (customAreaSection) customAreaSection.style.display = 'none';

                // Proceed to analysis after selection (now step 4)
                setTimeout(() => {
                    this._stopCameraAndCompass();
                    this._goToVastuStep(4);
                    this._startVastuAnalysis(isHindi);
                }, 300);
            });
        });

        // Handle custom area submission
        if (proceedWithCustomAreaBtn) {
            proceedWithCustomAreaBtn.addEventListener('click', () => {
                const customValue = customAreaInput?.value?.trim();
                if (customValue) {
                    this._vastuState.customAreaName = customValue;
                }

                this._stopCameraAndCompass();
                this._goToVastuStep(4);
                this._startVastuAnalysis(isHindi);
            });
        }

        // Also allow Enter key to submit
        if (customAreaInput) {
            customAreaInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    proceedWithCustomAreaBtn?.click();
                }
            });
        }
    },

    /**
     * Capture photo
     */
    _capturePhoto(isHindi) {
        const videoEl = document.getElementById('vastuCamera');
        const canvasEl = document.getElementById('vastuCanvas');
        const capturedPhotoEl = document.getElementById('capturedPhoto');
        const compassOverlay = document.getElementById('compassOverlay');
        const directionLocked = document.getElementById('directionLocked');
        const lockedDirectionText = document.getElementById('lockedDirectionText');
        const captureControls = document.getElementById('captureControls');
        const postCaptureActions = document.getElementById('postCaptureActions');
        const directionBadge = document.getElementById('directionBadge');
        const manualSection = document.getElementById('manualDirectionSection');

        if (!videoEl || !videoEl.videoWidth) {
            MayaUtils.toast.error(isHindi ? 'कैमरा तैयार नहीं' : 'Camera not ready');
            return;
        }

        // Lock current direction
        this._vastuState.compassActive = false;

        // Capture photo to canvas
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(videoEl, 0, 0);

        // Get base64 image
        const photoData = canvasEl.toDataURL('image/jpeg', 0.8);
        this._vastuState.photoData = photoData;

        // Show captured photo
        capturedPhotoEl.src = photoData;
        capturedPhotoEl.style.display = 'block';
        videoEl.style.display = 'none';

        // Stop camera stream to free resources
        this._stopCamera();

        // Update UI
        if (compassOverlay) compassOverlay.style.display = 'none';
        if (directionBadge) directionBadge.style.display = 'none';
        if (manualSection) manualSection.style.display = 'none';
        if (directionLocked) {
            directionLocked.style.display = 'flex';
            if (lockedDirectionText) {
                lockedDirectionText.textContent = `${this._vastuState.direction} (${this._vastuState.directionDegree}°)`;
            }
        }
        if (captureControls) captureControls.style.display = 'none';
        if (postCaptureActions) postCaptureActions.style.display = 'flex';

        MayaUtils.toast.success(isHindi ? `${this._vastuState.direction} में फोटो कैप्चर` : `Photo captured facing ${this._vastuState.direction}`);
    },

    /**
     * Retake photo - restart camera for new capture
     */
    async _retakePhoto(isHindi) {
        const capturedPhotoEl = document.getElementById('capturedPhoto');
        const directionLocked = document.getElementById('directionLocked');
        const directionBadge = document.getElementById('directionBadge');
        const postCaptureActions = document.getElementById('postCaptureActions');

        this._vastuState.photoData = null;
        this._vastuState.compassActive = true;

        // Hide captured photo and related UI
        if (capturedPhotoEl) capturedPhotoEl.style.display = 'none';
        if (directionLocked) directionLocked.style.display = 'none';
        if (directionBadge) directionBadge.style.display = 'flex';
        if (postCaptureActions) postCaptureActions.style.display = 'none';

        // Restart camera
        await this._startCameraOnly(isHindi);
    },

    /**
     * Go to area selection
     */
    _goToAreaSelection(isHindi) {
        const previewImage = document.getElementById('previewImage');
        const previewDirection = document.getElementById('previewDirection');

        // Set preview with LOCKED direction values
        if (previewImage) previewImage.src = this._vastuState.photoData;
        if (previewDirection) {
            previewDirection.textContent = `${this._vastuState.lockedDirection || this._vastuState.direction} (${this._vastuState.lockedDegree || this._vastuState.directionDegree}°)`;
        }

        // Go to area selection step
        this._goToVastuStep(2.5);
    },

    /**
     * Stop camera and compass - cleanup resources
     */
    _stopCameraAndCompass() {
        // Cleanup global UI state
        document.body.classList.remove('maya-vastu-active');

        // Stop camera stream
        this._stopCameraStream();

        // Stop compass
        this._vastuState.compassActive = false;
        if (this._vastuState.compassHandler) {
            window.removeEventListener('deviceorientation', this._vastuState.compassHandler);
            this._vastuState.compassHandler = null;
        }

        // Clear captured photo
        this._vastuState.capturedPhoto = null;
    },

    /**
     * Navigate between Vastu steps
     */
    _goToVastuStep(step) {
        this._vastuState.currentStep = step;

        // Hide all panels
        document.querySelectorAll('.maya-vastu__panel').forEach(p => {
            p.classList.remove('maya-vastu__panel--active');
        });

        // Show target panel
        let panelId;
        if (step === 1.5) {
            panelId = 'vastuStepCompass';
        } else if (step === '2b') {
            panelId = 'vastuStep2b';
        } else if (step === 2.5) {
            panelId = 'vastuStepArea';
        } else {
            panelId = `vastuStep${step}`;
        }
        document.getElementById(panelId)?.classList.add('maya-vastu__panel--active');

        // Update step indicator
        this._updateStepIndicator(step);
    },

    /**
     * Update step indicator dots
     */
    _updateStepIndicator(step) {
        const dots = document.querySelectorAll('.maya-vastu__step-dot');

        // Map steps to dot indices:
        // Dot 0: Location (step 1)
        // Dot 1: Compass (step 1.5)
        // Dot 2: Direction Lock & Camera (step 2, 2b) and Area (step 2.5)
        // Dot 3: Analysis (step 4)
        let activeIndex;
        if (step <= 1) activeIndex = 0;
        else if (step <= 1.5) activeIndex = 1;
        else if (step === 2 || step === '2b' || step <= 2.5) activeIndex = 2;
        else activeIndex = 3;

        dots.forEach((dot, index) => {
            dot.classList.remove('maya-vastu__step-dot--active', 'maya-vastu__step-dot--completed');

            if (index < activeIndex) {
                dot.classList.add('maya-vastu__step-dot--completed');
            } else if (index === activeIndex) {
                dot.classList.add('maya-vastu__step-dot--active');
            }
        });
    },

    /**
     * Initialize Vastu Analysis Step
     */
    _initVastuAnalysisStep(isHindi) {
        const doneBtn = document.getElementById('doneVastuBtn');
        const newAnalysisBtn = document.getElementById('newAnalysisBtn');

        if (doneBtn) {
            doneBtn.addEventListener('click', () => {
                this._exitVastuPage();
            });
        }

        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => {
                // Reset and restart calibration
                this._stopCameraAndCompass();
                this._startVastuCalibration(isHindi);
            });
        }
    },

    /**
     * Start AI Vastu Analysis with retry logic
     */
    async _startVastuAnalysis(isHindi, retryCount = 0) {
        const maxRetries = 3;
        const loadingDiv = document.getElementById('analysisLoading');
        const resultDiv = document.getElementById('analysisResult');
        const actionsDiv = document.getElementById('analysisActions');
        const metaDiv = document.getElementById('analysisMetaInfo');
        const scrollArea = document.getElementById('analysisScrollArea');

        // Show meta information
        const areaLabels = {
            entrance: isHindi ? 'मुख्य प्रवेश द्वार' : 'Main Entrance',
            living_room: isHindi ? 'बैठक' : 'Living Room',
            bedroom: isHindi ? 'शयनकक्ष' : 'Bedroom',
            kitchen: isHindi ? 'रसोई' : 'Kitchen',
            bathroom: isHindi ? 'शौचालय' : 'Bathroom',
            pooja_room: isHindi ? 'पूजा कक्ष' : 'Pooja Room',
            study: isHindi ? 'अध्ययन कक्ष' : 'Study Room',
            office: isHindi ? 'कार्यालय' : 'Home Office',
            garden: isHindi ? 'बगीचा' : 'Garden',
            staircase: isHindi ? 'सीढ़ियां' : 'Staircase',
            other: isHindi ? 'अन्य' : 'Other'
        };

        // Get display label for area - use custom name if provided
        const areaDisplayLabel = this._vastuState.customAreaName
            ? this._vastuState.customAreaName
            : areaLabels[this._vastuState.areaType];

        if (metaDiv) {
            metaDiv.innerHTML = `
                <span class="maya-vastu__meta-chip"><i class="bi bi-geo-alt"></i> ${this._vastuState.latitude}°, ${this._vastuState.longitude}°</span>
                <span class="maya-vastu__meta-chip"><i class="bi bi-compass"></i> ${this._vastuState.direction} ${this._vastuState.directionDegree}°</span>
                <span class="maya-vastu__meta-chip"><i class="bi bi-house"></i> ${areaDisplayLabel}</span>
            `;
        }

        // Reset and show loading
        if (loadingDiv) loadingDiv.style.display = 'flex';
        if (scrollArea) scrollArea.style.display = 'none';
        if (resultDiv) resultDiv.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'none';

        // Show retry count if retrying
        const loadingText = loadingDiv?.querySelector('p');
        if (retryCount > 0 && loadingText) {
            loadingText.textContent = isHindi
                ? `पुनः प्रयास ${retryCount}/${maxRetries}...`
                : `Retry attempt ${retryCount}/${maxRetries}...`;
        }

        try {
            // Generate Vastu analysis using AI
            const { analysisHtml, score } = await this._generateVastuAnalysis(isHindi);

            // Validate we got a real analysis (not empty/minimal)
            if (!analysisHtml || analysisHtml.length < 200) {
                throw new Error('Insufficient analysis generated');
            }

            // Save the analysis
            this._saveVastuAnalysis(analysisHtml, score);

            setTimeout(() => {
                if (loadingDiv) loadingDiv.style.display = 'none';
                if (scrollArea) scrollArea.style.display = 'block';
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = analysisHtml;
                }
                if (actionsDiv) actionsDiv.style.display = 'flex';
            }, 300);

        } catch (error) {
            console.error('Vastu analysis error:', error);

            // Check if it's a rate limit error - be thorough with detection
            const errorMsg = (error.message || '').toLowerCase();
            const isRateLimitError = errorMsg.includes('quota') ||
                errorMsg.includes('429') ||
                errorMsg.includes('rate limit') ||
                errorMsg.includes('exceeded') ||
                errorMsg.includes('too many requests');

            console.log('🔍 Rate limit detection:', { isRateLimitError, errorMsg: error.message?.substring(0, 100) });

            // For rate limits, use fallback immediately instead of retrying
            if (isRateLimitError) {
                console.log('⚠️ Rate limited - using fallback Vastu analysis');
                MayaUtils.toast.warning(isHindi ? 'AI व्यस्त है, बेसिक विश्लेषण दिखा रहे हैं' : 'AI busy, showing basic analysis');

                try {
                    // Use fallback analysis
                    const { analysisHtml, score } = await this._fallbackVastuAnalysis(isHindi);
                    console.log('✅ Fallback analysis generated, score:', score);
                    this._saveVastuAnalysis(analysisHtml, score);

                    if (loadingDiv) loadingDiv.style.display = 'none';
                    if (scrollArea) scrollArea.style.display = 'block';
                    if (resultDiv) {
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = analysisHtml;
                    }
                    if (actionsDiv) actionsDiv.style.display = 'flex';
                    return;
                } catch (fallbackError) {
                    console.error('Fallback analysis also failed:', fallbackError);
                }
            }

            // Retry if we haven't exceeded max retries (for non-rate-limit errors)
            if (retryCount < maxRetries && !isRateLimitError) {
                console.log(`🔄 Retrying Vastu analysis (${retryCount + 1}/${maxRetries})...`);
                MayaUtils.toast.warning(isHindi ? `पुनः प्रयास हो रहा है...` : `Retrying analysis...`);

                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this._startVastuAnalysis(isHindi, retryCount + 1);
            }

            // Max retries reached or rate limited - show fallback or error
            if (loadingDiv) loadingDiv.style.display = 'none';

            // Try fallback one more time
            try {
                const { analysisHtml, score } = await this._fallbackVastuAnalysis(isHindi);
                this._saveVastuAnalysis(analysisHtml, score);

                if (scrollArea) scrollArea.style.display = 'block';
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = analysisHtml;
                }
                if (actionsDiv) actionsDiv.style.display = 'flex';
            } catch (e) {
                // Show error with retry button
                if (scrollArea) scrollArea.style.display = 'block';
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `
                        <div class="maya-error-state">
                            <div class="maya-error-state__icon">
                                <i class="bi bi-exclamation-triangle"></i>
                            </div>
                            <h5>${isHindi ? 'विश्लेषण विफल' : 'Analysis Failed'}</h5>
                            <p>${isHindi ? 'AI सेवा व्यस्त है। कृपया कुछ मिनट बाद पुनः प्रयास करें।' : 'AI service is busy. Please try again in a few minutes.'}</p>
                            <button class="maya-btn maya-btn--primary" id="retryAnalysisBtn">
                                <i class="bi bi-arrow-clockwise"></i>
                                <span>${isHindi ? 'पुनः प्रयास करें' : 'Retry Analysis'}</span>
                            </button>
                        </div>
                    `;

                    document.getElementById('retryAnalysisBtn')?.addEventListener('click', () => {
                        this._startVastuAnalysis(isHindi, 0);
                    });
                }
                if (actionsDiv) actionsDiv.style.display = 'flex';
            }
        }
    },

    /**
     * Generate Vastu Analysis using AI with vision
     */
    async _generateVastuAnalysis(isHindi) {
        const profile = MayaUtils.storage.get('maya_profile') || {};
        const language = isHindi ? 'Hindi (Hinglish in Devanagari)' : 'English';

        // Area-specific Vastu considerations
        const areaVastuPoints = {
            entrance: 'Main entrance direction, placement of door, threshold, shoe rack placement, nameplate position, welcome elements',
            living_room: 'Seating arrangement, TV placement, furniture direction, ceiling beam effects, mirror placement, plant positions',
            bedroom: 'Bed direction and placement, headboard orientation, mirror placement, wardrobe position, electronics placement',
            kitchen: 'Stove/burner direction, sink placement, refrigerator position, exhaust location, storage arrangement',
            bathroom: 'Toilet seat direction, shower placement, drainage direction, ventilation, mirror placement',
            pooja_room: 'Deity placement, lamp position, prayer seat direction, sacred items arrangement, door direction',
            study: 'Desk direction, bookshelf placement, lighting, seating orientation, window placement',
            office: 'Work desk direction, chair placement, storage, electronics, plants for prosperity',
            garden: 'Water features, plant placement, pathways, seating areas, tulsi and sacred plants',
            staircase: 'Direction of stairs, landing placement, space under stairs, lighting',
            other: 'General Vastu principles for the space'
        };

        // Get area name - use custom name if provided, otherwise use area type
        const areaName = this._vastuState.customAreaName
            ? this._vastuState.customAreaName
            : this._vastuState.areaType.replace('_', ' ');

        // Get Vastu points - for custom areas, use both "other" general points and the custom description
        const vastuPoints = this._vastuState.customAreaName
            ? `General Vastu principles for ${this._vastuState.customAreaName}. User specified this area as: ${this._vastuState.customAreaName}`
            : areaVastuPoints[this._vastuState.areaType];

        const vastuPrompt = `You are MAYA, an expert in Vastu Shastra (ancient Indian architectural science). Analyze this space photo according to Vastu principles.

**Context:**
- User: ${profile.name || 'Friend'}
- Location: ${this._vastuState.latitude}° N, ${this._vastuState.longitude}° E
- Photo Direction: ${this._vastuState.direction} (${this._vastuState.directionDegree}° from North)
- Area Type: ${areaName}
- Key Vastu Points for this area: ${vastuPoints}

**Instructions:**
1. Analyze the visible elements in the photo according to Vastu Shastra
2. Consider the direction the photo is facing (${this._vastuState.direction}) for directional analysis
3. Identify any Vastu doshas (defects) visible
4. Provide remedies and corrections

**IMPORTANT: You MUST respond in valid JSON format only. No markdown, no extra text.**

Respond ONLY with this exact JSON structure (in ${language} for all text values):
{
  "score": 7,
  "scoreSummary": "Brief 1-line explanation of the score",
  "positives": [
    {"title": "Short title", "desc": "1-2 sentence description"},
    {"title": "Short title", "desc": "1-2 sentence description"}
  ],
  "doshas": [
    {"title": "Dosha name", "desc": "Brief description", "severity": "high|medium|low"},
    {"title": "Dosha name", "desc": "Brief description", "severity": "high|medium|low"}
  ],
  "remedies": [
    {"action": "Short actionable remedy", "icon": "emoji"},
    {"action": "Short actionable remedy", "icon": "emoji"}
  ],
  "placements": [
    {"item": "Item name", "where": "Where to place it", "icon": "emoji"},
    {"item": "Item name", "where": "Where to place it", "icon": "emoji"}
  ]
}

Rules:
- Score must be 1-10
- Keep 2-4 items per array. Be concise.
- Each description should be 1-2 sentences max
- Use practical, specific advice based on what you see in the photo
- Reference actual Vastu Shastra principles`;

        try {
            // Call Gemini with vision capability
            const response = await this._callGeminiVision(vastuPrompt, this._vastuState.photoData);
            console.log('📝 Gemini response length:', response?.length, 'chars');
            console.log('📝 Response preview:', response?.substring(0, 500));
            const { html, score } = this._formatVastuResponse(response, isHindi);
            return { analysisHtml: html, score };
        } catch (error) {
            console.error('Gemini Vision error:', error);
            // Fallback to text-only analysis
            return await this._fallbackVastuAnalysis(isHindi);
        }
    },

    /**
     * Call Gemini Vision API for image analysis
     * Includes retry logic for rate limits
     */
    async _callGeminiVision(prompt, imageData) {
        // Use only the primary paid Gemini key.
        const apiKeys = [
            MAYA_CONFIG.API_KEYS.GEMINI
        ].filter(Boolean);

        console.log(`🔑 Using single Gemini API key: ${apiKeys.length}`);

        // Recommended models for image analysis (multimodal understanding)
        const models = [
            'gemini-2.5-flash-lite'
        ];

        // Check if we have valid image data
        if (!imageData || !imageData.startsWith('data:image/')) {
            console.error('Invalid image data provided to Gemini Vision');
            throw new Error('No valid image data');
        }

        // Extract MIME type and base64 data properly
        const mimeMatch = imageData.match(/^data:(image\/[\w-]+);base64,/);
        let mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        // Gemini supports: PNG, JPEG, WEBP, HEIC, HEIF
        if (mimeType === 'image/heif') mimeType = 'image/heic';

        const base64Image = imageData.replace(/^data:image\/[\w-]+;base64,/, '');

        console.log('🖼️ Gemini Vision - Image size:', Math.round(base64Image.length / 1024), 'KB, MIME:', mimeType);

        const payload = {
            contents: [{
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Image
                        }
                    },
                    { text: prompt }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 16384  // Maximum length for comprehensive analysis
            },
            // Safety settings to be more permissive (like the working project)
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        let lastError = null;

        // Try the primary API key and configured model only.
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            const keyLabel = keyIndex === 0 ? 'Primary' : `Fallback-${keyIndex}`;

            for (const model of models) {
                try {
                    const url = `${MAYA_CONFIG.ENDPOINTS.GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
                    console.log(`🤖 Trying Gemini [${keyLabel}] model: ${model}`);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();

                    // Handle rate limit (429) without cycling through fallback keys.
                    if (response.status === 429) {
                        console.warn(`⚠️ Gemini [${keyLabel}] rate limited on ${model}. No fallback keys will be tried.`);
                        lastError = data.error?.message || 'Rate limited';
                        break;
                    }

                    // Handle 404 - model not found
                    if (response.status === 404) {
                        console.warn(`⚠️ Gemini [${keyLabel}] model ${model} not found, trying next...`);
                        continue;
                    }

                    // Handle 503 - overloaded
                    if (response.status === 503) {
                        console.warn(`⚠️ Gemini [${keyLabel}] model ${model} overloaded, trying next...`);
                        continue;
                    }

                    if (!response.ok) {
                        console.warn(`Gemini [${keyLabel}] ${model} error:`, data.error?.message || response.status);
                        lastError = data.error?.message || `HTTP ${response.status}`;
                        continue;
                    }

                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        console.log(`✅ Gemini Vision success [${keyLabel}] with ${model}`);
                        return data.candidates[0].content.parts[0].text;
                    } else {
                        console.warn(`Gemini [${keyLabel}] ${model} - No text in response`, data);
                        lastError = 'No content in response';
                    }
                } catch (e) {
                    console.warn(`Gemini [${keyLabel}] ${model} failed:`, e.message);
                    lastError = e.message;
                }
            }
        }

        console.error(`❌ Gemini Vision failed with the configured key/model. Last error:`, lastError);
        throw new Error(`Vision analysis failed: ${lastError}`);
    },

    /**
     * Fallback Vastu analysis without image (when API is rate limited)
     * Provides comprehensive guidance based on direction and area type
     */
    async _fallbackVastuAnalysis(isHindi) {
        const fallbackAnalysisHtml = isHindi
            ? `
                <div class="maya-empty-state">
                    <div class="maya-empty-state__icon"><i class="bi bi-house-door"></i></div>
                    <h3>लाइव वास्तु विश्लेषण अभी उपलब्ध नहीं है</h3>
                    <p>Fresh image-based guidance के लिए इसे थोड़ी देर बाद फिर चलाएं।</p>
                </div>
            `
            : `
                <div class="maya-empty-state">
                    <div class="maya-empty-state__icon"><i class="bi bi-house-door"></i></div>
                    <h3>Live Vastu analysis is not available right now</h3>
                    <p>Run this again shortly for fresh image-based guidance.</p>
                </div>
            `;

        return {
            analysisHtml: fallbackAnalysisHtml,
            score: 0
        };

        // Comprehensive Vastu guidance for each area
        const areaGuidance = {
            entrance: {
                ideal: ['North', 'East', 'North-East'],
                avoid: ['South', 'South-West'],
                tips: isHindi
                    ? [
                        '🚪 मुख्य द्वार पर शुभ स्वास्तिक या ॐ चिन्ह लगाएं',
                        '🌺 तोरण या बंदनवार लगाएं',
                        '👟 जूते-चप्पल रैक द्वार के बाईं ओर रखें',
                        '💡 प्रवेश द्वार हमेशा रोशन रखें',
                        '🪴 तुलसी या मनी प्लांट रखें',
                        '🔔 घंटी या विंड चाइम लगाएं'
                    ]
                    : [
                        '🚪 Place Swastik or Om symbol at entrance',
                        '🌺 Hang a toran or decorative bandanwar',
                        '👟 Keep shoe rack on the left side of door',
                        '💡 Keep entrance well-lit always',
                        '🪴 Place Tulsi or Money plant near entrance',
                        '🔔 Hang a bell or wind chime'
                    ],
                remedies: isHindi
                    ? ['द्वार के बाहर गणेश जी की प्रतिमा रखें', 'नमक-पानी से साप्ताहिक सफाई करें']
                    : ['Place Ganesh idol outside door', 'Weekly cleansing with salt water']
            },
            living_room: {
                ideal: ['North', 'East', 'North-East'],
                avoid: ['South-East'],
                tips: isHindi
                    ? [
                        '🛋️ भारी फर्नीचर दक्षिण-पश्चिम कोने में रखें',
                        '📺 TV पूर्व या उत्तर दीवार पर लगाएं',
                        '🪞 दर्पण उत्तर दीवार पर लगाएं',
                        '🪴 पौधे उत्तर-पूर्व कोने में रखें',
                        '🎨 पारिवारिक फोटो दक्षिण-पश्चिम में लगाएं',
                        '💡 उत्तर-पूर्व कोना खुला और रोशन रखें'
                    ]
                    : [
                        '🛋️ Place heavy furniture in South-West corner',
                        '📺 Mount TV on East or North wall',
                        '🪞 Place mirror on North wall only',
                        '🪴 Keep plants in North-East corner',
                        '🎨 Family photos should be in South-West',
                        '💡 Keep North-East corner open and bright'
                    ],
                remedies: isHindi
                    ? ['क्रिस्टल या पिरामिड रखें', 'सप्ताह में एक बार धूप-दीप जलाएं']
                    : ['Place crystal or pyramid', 'Light incense weekly']
            },
            bedroom: {
                ideal: ['South-West', 'South', 'West'],
                avoid: ['North-East'],
                tips: isHindi
                    ? [
                        '🛏️ सिर दक्षिण या पूर्व दिशा में रखकर सोएं',
                        '🪞 बिस्तर के सामने दर्पण न रखें',
                        '📱 इलेक्ट्रॉनिक्स बिस्तर से दूर रखें',
                        '🚪 बिस्तर को दरवाजे के सीधे सामने न रखें',
                        '🎨 हल्के और सुखदायक रंग चुनें',
                        '💑 जोड़े की फोटो दक्षिण-पश्चिम में रखें'
                    ]
                    : [
                        '🛏️ Sleep with head towards South or East',
                        '🪞 Avoid mirror facing the bed',
                        '📱 Keep electronics away from bed',
                        '🚪 Don\'t place bed directly facing door',
                        '🎨 Choose light and soothing colors',
                        '💑 Couple\'s photo in South-West'
                    ],
                remedies: isHindi
                    ? ['शयनकक्ष में गुलाबी रंग की वस्तुएं रखें', 'लैवेंडर या चंदन की खुशबू रखें']
                    : ['Keep pink colored items in bedroom', 'Use lavender or sandalwood fragrance']
            },
            kitchen: {
                ideal: ['South-East'],
                avoid: ['North-East', 'South-West'],
                tips: isHindi
                    ? [
                        '🔥 चूल्हा दक्षिण-पूर्व कोने में रखें',
                        '🚰 सिंक और चूल्हे के बीच दूरी रखें',
                        '❄️ फ्रिज दक्षिण-पश्चिम में रखें',
                        '💨 एग्जॉस्ट पूर्व दिशा में लगाएं',
                        '🍽️ पूर्व की ओर मुख करके खाना बनाएं',
                        '🌿 तुलसी या अन्य जड़ी-बूटी रखें'
                    ]
                    : [
                        '🔥 Place stove in South-East corner',
                        '🚰 Keep distance between sink and stove',
                        '❄️ Refrigerator in South-West',
                        '💨 Exhaust fan towards East',
                        '🍽️ Cook facing East direction',
                        '🌿 Keep Tulsi or herbs in kitchen'
                    ],
                remedies: isHindi
                    ? ['रसोई में पीले रंग का उपयोग करें', 'नमक का कटोरा रखें']
                    : ['Use yellow color in kitchen', 'Keep a bowl of salt']
            },
            bathroom: {
                ideal: ['North-West', 'West'],
                avoid: ['North-East', 'South-West'],
                tips: isHindi
                    ? [
                        '🚽 शौचालय उत्तर-दक्षिण दिशा में रखें',
                        '🚿 शॉवर पूर्व या उत्तर में हो',
                        '🪞 दर्पण उत्तर या पूर्व दीवार पर',
                        '💧 नल टपकना नहीं चाहिए',
                        '🪟 हवादार और सूखा रखें',
                        '🚪 दरवाजा हमेशा बंद रखें'
                    ]
                    : [
                        '🚽 Toilet seat in North-South direction',
                        '🚿 Shower in East or North',
                        '🪞 Mirror on North or East wall',
                        '💧 No leaking taps (drains wealth)',
                        '🪟 Keep well-ventilated and dry',
                        '🚪 Always keep door closed'
                    ],
                remedies: isHindi
                    ? ['समुद्री नमक से साप्ताहिक सफाई', 'ताजे फूल या पौधे रखें']
                    : ['Weekly cleansing with sea salt', 'Keep fresh flowers or plants']
            },
            pooja_room: {
                ideal: ['North-East', 'East', 'North'],
                avoid: ['South', 'South-West'],
                tips: isHindi
                    ? [
                        '🕉️ देवता का मुख पूर्व या पश्चिम की ओर हो',
                        '🙏 पूजा करते समय पूर्व या उत्तर की ओर मुख करें',
                        '🪔 दीपक दक्षिण-पूर्व में रखें',
                        '🌸 ताजे फूल और जल रोज बदलें',
                        '📿 मूर्तियां जमीन से ऊपर रखें',
                        '🧹 नियमित स्वच्छता बनाए रखें'
                    ]
                    : [
                        '🕉️ Deity should face East or West',
                        '🙏 Face East or North while praying',
                        '🪔 Place lamp in South-East',
                        '🌸 Change flowers and water daily',
                        '📿 Keep idols above ground level',
                        '🧹 Maintain regular cleanliness'
                    ],
                remedies: isHindi
                    ? ['रोज घी का दीपक जलाएं', 'गंगाजल छिड़कें']
                    : ['Light ghee lamp daily', 'Sprinkle Gangajal']
            },
            office: {
                ideal: ['North', 'East', 'North-East'],
                avoid: ['South-West for sitting'],
                tips: isHindi
                    ? [
                        '💼 उत्तर या पूर्व की ओर मुख करके बैठें',
                        '🖥️ कंप्यूटर दक्षिण-पूर्व में रखें',
                        '📚 किताबें दक्षिण-पश्चिम में रखें',
                        '🪴 मनी प्लांट उत्तर में रखें',
                        '⏰ घड़ी उत्तर या पूर्व दीवार पर',
                        '🎯 प्रेरणादायक चित्र उत्तर में'
                    ]
                    : [
                        '💼 Sit facing North or East',
                        '🖥️ Place computer in South-East',
                        '📚 Books in South-West',
                        '🪴 Money plant in North',
                        '⏰ Clock on North or East wall',
                        '🎯 Inspirational images in North'
                    ],
                remedies: isHindi
                    ? ['क्रिस्टल पिरामिड रखें', 'लाफिंग बुद्धा उत्तर में रखें']
                    : ['Keep crystal pyramid', 'Place laughing Buddha in North']
            },
            other: {
                ideal: ['North', 'East'],
                avoid: ['South-West for main activities'],
                tips: isHindi
                    ? [
                        '✨ उत्तर-पूर्व कोना साफ और खुला रखें',
                        '🌿 पौधे लगाएं जो सकारात्मक ऊर्जा लाएं',
                        '💡 पर्याप्त रोशनी रखें',
                        '🧹 अनावश्यक सामान हटाएं',
                        '🎨 सुखदायक रंग चुनें',
                        '🔔 सकारात्मक ध्वनियां रखें'
                    ]
                    : [
                        '✨ Keep North-East corner clean and open',
                        '🌿 Place plants that bring positive energy',
                        '💡 Ensure adequate lighting',
                        '🧹 Remove unnecessary clutter',
                        '🎨 Choose soothing colors',
                        '🔔 Keep positive sounds'
                    ],
                remedies: isHindi
                    ? ['समुद्री नमक से सफाई', 'कपूर जलाएं']
                    : ['Cleanse with sea salt', 'Burn camphor']
            }
        };

        const areaType = this._vastuState.areaType || 'other';
        const guidance = areaGuidance[areaType] || areaGuidance.other;
        const direction = this._vastuState.direction || 'North';

        // Calculate direction score
        const isIdeal = guidance.ideal.some(d => direction.toLowerCase().includes(d.toLowerCase().split('-')[0]));
        const isAvoided = guidance.avoid.some(d => direction.toLowerCase().includes(d.toLowerCase().split('-')[0]));

        let score = 6; // Default neutral
        if (isIdeal) score = 8;
        if (isAvoided) score = 4;

        // Get area label
        const areaLabels = {
            entrance: isHindi ? 'प्रवेश द्वार' : 'Entrance',
            living_room: isHindi ? 'बैठक' : 'Living Room',
            bedroom: isHindi ? 'शयनकक्ष' : 'Bedroom',
            kitchen: isHindi ? 'रसोई' : 'Kitchen',
            bathroom: isHindi ? 'बाथरूम' : 'Bathroom',
            pooja_room: isHindi ? 'पूजा कक्ष' : 'Pooja Room',
            office: isHindi ? 'कार्यालय' : 'Office',
            other: this._vastuState.customAreaName || (isHindi ? 'क्षेत्र' : 'Area')
        };

        const areaLabel = areaLabels[areaType] || areaLabels.other;

        // Build comprehensive analysis HTML with improved card-based UI
        const analysisHtml = `
            <!-- Score Hero Card -->
            <div class="maya-vastu-result__hero maya-vastu-result__hero--${score >= 7 ? 'good' : score >= 5 ? 'neutral' : 'improve'}">
                <div class="maya-vastu-result__score-ring">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6" opacity="0.15"/>
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6" 
                            stroke-dasharray="${(score / 10) * 283} 283" stroke-linecap="round" 
                            transform="rotate(-90 50 50)"/>
                    </svg>
                    <div class="maya-vastu-result__score-value">
                        <span class="maya-vastu-result__score-num">${score}</span>
                        <span class="maya-vastu-result__score-max">/10</span>
                    </div>
                </div>
                <div class="maya-vastu-result__hero-info">
                    <h3 class="maya-vastu-result__area-name">${areaLabel}</h3>
                    <div class="maya-vastu-result__direction-badge">
                        <i class="bi bi-compass"></i>
                        ${direction} • ${this._vastuState.directionDegree}°
                    </div>
                    <span class="maya-vastu-result__status-tag">
                        ${score >= 7
                ? (isHindi ? '✨ शुभ' : '✨ Auspicious')
                : score >= 5
                    ? (isHindi ? '⚖️ तटस्थ' : '⚖️ Neutral')
                    : (isHindi ? '⚠️ सुधार आवश्यक' : '⚠️ Needs Improvement')}
                    </span>
                </div>
            </div>

            <!-- Direction Analysis Card -->
            <div class="maya-vastu-result__card">
                <div class="maya-vastu-result__card-header">
                    <div class="maya-vastu-result__card-icon maya-vastu-result__card-icon--direction">
                        <i class="bi bi-compass"></i>
                    </div>
                    <h4>${isHindi ? 'दिशा विश्लेषण' : 'Direction Analysis'}</h4>
                </div>
                <div class="maya-vastu-result__card-body">
                    <div class="maya-vastu-result__status-box maya-vastu-result__status-box--${isIdeal ? 'good' : isAvoided ? 'warning' : 'neutral'}">
                        <i class="bi bi-${isIdeal ? 'check-circle-fill' : isAvoided ? 'exclamation-triangle-fill' : 'info-circle-fill'}"></i>
                        <p>${isIdeal
                ? (isHindi ? `${direction} दिशा ${areaLabel} के लिए शुभ है!` : `${direction} is auspicious for ${areaLabel}!`)
                : isAvoided
                    ? (isHindi ? `${direction} दिशा ${areaLabel} के लिए आदर्श नहीं है।` : `${direction} is not ideal for ${areaLabel}.`)
                    : (isHindi ? `${direction} दिशा ${areaLabel} के लिए तटस्थ है।` : `${direction} is neutral for ${areaLabel}.`)
            }</p>
                    </div>
                    <div class="maya-vastu-result__ideal-directions">
                        <span class="maya-vastu-result__label">${isHindi ? 'आदर्श दिशाएं' : 'Ideal Directions'}</span>
                        <div class="maya-vastu-result__direction-chips">
                            ${guidance.ideal.map(d => `<span class="maya-vastu-result__chip">${d}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tips Card -->
            <div class="maya-vastu-result__card">
                <div class="maya-vastu-result__card-header">
                    <div class="maya-vastu-result__card-icon maya-vastu-result__card-icon--tips">
                        <i class="bi bi-lightbulb"></i>
                    </div>
                    <h4>${isHindi ? 'वास्तु टिप्स' : 'Vastu Tips'}</h4>
                </div>
                <div class="maya-vastu-result__card-body">
                    <ul class="maya-vastu-result__checklist">
                        ${guidance.tips.map(tip => `
                            <li>
                                <i class="bi bi-check2-circle"></i>
                                <span>${tip}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>

            <!-- Remedies Card -->
            <div class="maya-vastu-result__card">
                <div class="maya-vastu-result__card-header">
                    <div class="maya-vastu-result__card-icon maya-vastu-result__card-icon--remedies">
                        <i class="bi bi-magic"></i>
                    </div>
                    <h4>${isHindi ? 'उपाय' : 'Remedies'}</h4>
                    <span class="maya-vastu-result__badge">${guidance.remedies.length} ${isHindi ? 'उपाय' : 'Actions'}</span>
                </div>
                <div class="maya-vastu-result__card-body">
                    <ul class="maya-vastu-result__action-list">
                        ${guidance.remedies.map((remedy, i) => `
                            <li>
                                <span class="maya-vastu-result__action-num">${i + 1}</span>
                                <span>${remedy}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>

            <!-- CTA Card -->
            <div class="maya-vastu-result__cta-card" onclick="window.MayaPages?.render('home'); setTimeout(() => document.querySelector('#showMaya')?.click(), 300);">
                <div class="maya-vastu-result__cta-icon">
                    <i class="bi bi-chat-heart"></i>
                </div>
                <div class="maya-vastu-result__cta-text">
                    <strong>${isHindi ? 'MAYA से पूछें' : 'Ask MAYA'}</strong>
                    <span>${isHindi ? 'विस्तृत वास्तु परामर्श के लिए' : 'For detailed Vastu consultation'}</span>
                </div>
                <i class="bi bi-chevron-right"></i>
            </div>
        `;

        return { analysisHtml, score };
    },

    /**
     * Format Vastu response for display and extract score
     */
    _formatVastuResponse(response, isHindi) {
        let data;

        try {
            // Try to parse JSON response - strip markdown code fences if present
            let cleaned = response.trim();
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
            data = JSON.parse(cleaned);
        } catch (e) {
            console.warn('⚠️ Failed to parse Vastu JSON, falling back to text format:', e.message);
            // Fallback: extract what we can from raw text
            let score = 5;
            const scoreMatch = response.match(/SCORE:\s*(\d+)\/10/i) || response.match(/["']?score["']?\s*:\s*(\d+)/i) || response.match(/(\d+)\/10/);
            if (scoreMatch) score = Math.min(10, Math.max(1, parseInt(scoreMatch[1])));

            data = {
                score: score,
                scoreSummary: isHindi ? 'वास्तु विश्लेषण पूर्ण' : 'Vastu analysis complete',
                positives: [{ title: isHindi ? 'विश्लेषण' : 'Analysis', desc: response.substring(0, 300) }],
                doshas: [],
                remedies: [{ action: isHindi ? 'विस्तार के लिए MAYA से पूछें' : 'Ask MAYA for detailed consultation', icon: '💬' }],
                placements: []
            };
        }

        const score = Math.min(10, Math.max(1, data.score || 5));
        const scoreClass = score >= 7 ? 'good' : score >= 5 ? 'neutral' : 'improve';
        const scoreColor = score >= 7 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';
        const scoreLabel = score >= 7
            ? (isHindi ? '✨ शुभ' : '✨ Auspicious')
            : score >= 5
                ? (isHindi ? '⚖️ ठीक है' : '⚖️ Moderate')
                : (isHindi ? '⚠️ सुधार आवश्यक' : '⚠️ Needs Improvement');

        // Get area name
        const areaName = this._vastuState.customAreaName || this._vastuState.areaType?.replace('_', ' ') || 'Space';
        const direction = this._vastuState.direction || '';
        const degree = this._vastuState.directionDegree || '';

        // Build score ring SVG
        const circumference = 2 * Math.PI * 40;
        const dashLen = (score / 10) * circumference;

        // Build HTML
        const html = `
            <!-- Score Hero -->
            <div class="vastu-r__hero vastu-r__hero--${scoreClass}">
                <div class="vastu-r__score-ring">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="7"/>
                        <circle cx="50" cy="50" r="40" fill="none" stroke="${scoreColor}" stroke-width="7" 
                            stroke-dasharray="${dashLen} ${circumference}" stroke-linecap="round" 
                            transform="rotate(-90 50 50)" style="transition: stroke-dasharray 1s ease;"/>
                    </svg>
                    <div class="vastu-r__score-num">${score}<small>/10</small></div>
                </div>
                <div class="vastu-r__hero-text">
                    <div class="vastu-r__area-name">${areaName}</div>
                    <div class="vastu-r__direction"><i class="bi bi-compass"></i> ${direction} ${degree}°</div>
                    <span class="vastu-r__badge vastu-r__badge--${scoreClass}">${scoreLabel}</span>
                </div>
            </div>
            <p class="vastu-r__summary">${data.scoreSummary || ''}</p>

            ${data.positives && data.positives.length ? `
            <!-- Positives -->
            <div class="vastu-r__section">
                <div class="vastu-r__section-head">
                    <span class="vastu-r__section-icon vastu-r__section-icon--green"><i class="bi bi-check-circle-fill"></i></span>
                    <h4>${isHindi ? 'शुभ पहलू' : 'Positive Aspects'}</h4>
                    <span class="vastu-r__count">${data.positives.length}</span>
                </div>
                <div class="vastu-r__items">
                    ${data.positives.map(p => `
                        <div class="vastu-r__item vastu-r__item--good">
                            <div class="vastu-r__item-dot vastu-r__item-dot--green"></div>
                            <div>
                                <strong>${p.title}</strong>
                                <p>${p.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            ${data.doshas && data.doshas.length ? `
            <!-- Doshas -->
            <div class="vastu-r__section">
                <div class="vastu-r__section-head">
                    <span class="vastu-r__section-icon vastu-r__section-icon--red"><i class="bi bi-exclamation-triangle-fill"></i></span>
                    <h4>${isHindi ? 'वास्तु दोष' : 'Vastu Doshas'}</h4>
                    <span class="vastu-r__count">${data.doshas.length}</span>
                </div>
                <div class="vastu-r__items">
                    ${data.doshas.map(d => `
                        <div class="vastu-r__item vastu-r__item--dosha">
                            <span class="vastu-r__severity vastu-r__severity--${d.severity || 'medium'}">${d.severity === 'high' ? '!' : d.severity === 'low' ? '~' : '•'
            }</span>
                            <div>
                                <strong>${d.title}</strong>
                                <p>${d.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            ${data.remedies && data.remedies.length ? `
            <!-- Remedies -->
            <div class="vastu-r__section">
                <div class="vastu-r__section-head">
                    <span class="vastu-r__section-icon vastu-r__section-icon--purple"><i class="bi bi-magic"></i></span>
                    <h4>${isHindi ? 'उपाय' : 'Remedies'}</h4>
                    <span class="vastu-r__count">${data.remedies.length}</span>
                </div>
                <div class="vastu-r__remedies">
                    ${data.remedies.map((r, i) => `
                        <div class="vastu-r__remedy">
                            <span class="vastu-r__remedy-icon">${r.icon || '🔮'}</span>
                            <span class="vastu-r__remedy-text">${r.action}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            ${data.placements && data.placements.length ? `
            <!-- Placements -->
            <div class="vastu-r__section">
                <div class="vastu-r__section-head">
                    <span class="vastu-r__section-icon vastu-r__section-icon--blue"><i class="bi bi-geo-alt-fill"></i></span>
                    <h4>${isHindi ? 'आदर्श स्थान' : 'Optimal Placements'}</h4>
                </div>
                <div class="vastu-r__placements">
                    ${data.placements.map(p => `
                        <div class="vastu-r__placement">
                            <span class="vastu-r__placement-icon">${p.icon || '📍'}</span>
                            <div>
                                <strong>${p.item}</strong>
                                <span>${p.where}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Ask MAYA CTA -->
            <div class="vastu-r__cta" onclick="window.MayaPages?.render('home'); setTimeout(() => document.querySelector('#showMaya')?.click(), 300);">
                <div class="vastu-r__cta-icon"><i class="bi bi-chat-heart"></i></div>
                <div class="vastu-r__cta-body">
                    <strong>${isHindi ? 'MAYA से पूछें' : 'Ask MAYA'}</strong>
                    <span>${isHindi ? 'विस्तृत वास्तु परामर्श' : 'Detailed Vastu consultation'}</span>
                </div>
                <i class="bi bi-chevron-right"></i>
            </div>
        `;

        return { html, score };
    },

    /**
     * Save Vastu analysis to storage
     */
    _saveVastuAnalysis(analysisHtml, score) {
        const savedAnalyses = MayaUtils.storage.get('maya_vastu_analyses') || [];

        const newAnalysis = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            areaType: this._vastuState.areaType,
            latitude: this._vastuState.latitude,
            longitude: this._vastuState.longitude,
            direction: this._vastuState.direction,
            directionDegree: this._vastuState.directionDegree,
            score: score,
            analysisHtml: analysisHtml,
            photoData: this._vastuState.photoData // Optional: store thumbnail
        };

        // Add to beginning of array (most recent first)
        savedAnalyses.unshift(newAnalysis);

        // Keep only last 20 analyses
        if (savedAnalyses.length > 20) {
            savedAnalyses.pop();
        }

        MayaUtils.storage.set('maya_vastu_analyses', savedAnalyses);
    },

    /**
     * Initialize Chat History page
     */
    initChatHistoryPage() {
        const isHindi = false; // UI always English

        // Delete individual chat
        document.querySelectorAll('[data-delete-chat]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chatId = e.currentTarget.dataset.deleteChat;
                this.deleteChatItem(chatId, isHindi);
            });
        });

        // Clear all chats
        const clearAllBtn = document.getElementById('clearAllChats');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm(isHindi ? 'क्या आप सभी चैट हटाना चाहते हैं?' : 'Are you sure you want to delete all chat history?')) {
                    MayaUtils.storage.remove('maya_chat_history');
                    MayaUtils.toast.success(isHindi ? 'सभी चैट हटा दी गईं' : 'All chats cleared');
                    this.render('chat-history');
                }
            });
        }

        // Click on chat item to view full conversation
        document.querySelectorAll('.maya-chat-history__item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('[data-delete-chat]')) {
                    const chatId = item.dataset.chatId;
                    this.showChatDetailModal(chatId, isHindi);
                }
            });
        });
    },

    /**
     * Resolve a chat entry from its rendered history ID.
     */
    _resolveChatHistoryEntry(chatId) {
        const chatHistory = MayaUtils.storage.get('maya_chat_history') || [];
        const normalizedId = String(chatId);

        const actualIndex = chatHistory.findIndex((chat, index) => {
            const fallbackId = `legacy-${index}`;
            return String(chat.id || fallbackId) === normalizedId;
        });

        if (actualIndex === -1) {
            return { chatHistory, actualIndex: -1, chat: null };
        }

        return {
            chatHistory,
            actualIndex,
            chat: chatHistory[actualIndex]
        };
    },

    /**
     * Show chat detail modal with full conversation
     */
    showChatDetailModal(chatId, isHindi) {
        const { chat } = this._resolveChatHistoryEntry(chatId);

        if (!chat) return;

        const modal = document.createElement('div');
        modal.className = 'maya-modal maya-modal--active';
        modal.id = 'chatDetailModal';
        modal.innerHTML = `
            <div class="maya-modal__backdrop"></div>
            <div class="maya-modal__content maya-modal__content--lg">
                <div class="maya-modal__header">
                    <h3 class="maya-modal__title">
                        <i class="bi bi-chat-dots"></i>
                        ${isHindi ? 'पूरी बातचीत' : 'Full Conversation'}
                    </h3>
                    <button class="maya-modal__close" id="closeChatDetail">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="maya-modal__body">
                    <div class="maya-chat-detail">
                        <div class="maya-chat-detail__date">
                            <i class="bi bi-calendar3"></i>
                            ${this.formatChatDate(chat.timestamp)}
                        </div>
                        
                        <div class="maya-chat-detail__message maya-chat-detail__message--user">
                            <div class="maya-chat-detail__avatar">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <div class="maya-chat-detail__bubble">
                                <div class="maya-chat-detail__label">${isHindi ? 'आपने पूछा' : 'You asked'}</div>
                                <div class="maya-chat-detail__text">${chat.question}</div>
                            </div>
                        </div>
                        
                        <div class="maya-chat-detail__message maya-chat-detail__message--maya">
                            <div class="maya-chat-detail__avatar">
                                <span>M</span>
                            </div>
                            <div class="maya-chat-detail__bubble">
                                <div class="maya-chat-detail__label">MAYA</div>
                                <div class="maya-chat-detail__text">${chat.answer}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="maya-modal__footer">
                    <button class="maya-btn maya-btn--outline" id="closeChatDetailBtn">
                        ${isHindi ? 'बंद करें' : 'Close'}
                    </button>
                    <button class="maya-btn maya-btn--primary" id="speakChatBtn">
                        <i class="bi bi-volume-up-fill"></i>
                        ${isHindi ? 'सुनें' : 'Listen'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeModal = () => {
            if (window.MayaVoice) MayaVoice.stop();
            modal.classList.remove('maya-modal--active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.maya-modal__backdrop').addEventListener('click', closeModal);
        modal.querySelector('#closeChatDetail').addEventListener('click', closeModal);
        modal.querySelector('#closeChatDetailBtn').addEventListener('click', closeModal);

        // Speak button
        const speakBtn = modal.querySelector('#speakChatBtn');
        let isSpeaking = false;

        speakBtn.addEventListener('click', async () => {
            if (isSpeaking) {
                MayaVoice.stop();
                speakBtn.innerHTML = `<i class="bi bi-volume-up-fill"></i> ${isHindi ? 'सुनें' : 'Listen'}`;
                isSpeaking = false;
            } else {
                speakBtn.innerHTML = `<i class="bi bi-stop-fill"></i> ${isHindi ? 'रुकें' : 'Stop'}`;
                isSpeaking = true;
                try {
                    await MayaVoice.speak(chat.answer);
                } catch (e) {
                    console.error('TTS error:', e);
                }
                speakBtn.innerHTML = `<i class="bi bi-volume-up-fill"></i> ${isHindi ? 'सुनें' : 'Listen'}`;
                isSpeaking = false;
            }
        });
    },

    /**
     * Delete a single chat item
     */
    deleteChatItem(chatId, isHindi) {
        const { chatHistory, actualIndex } = this._resolveChatHistoryEntry(chatId);

        if (actualIndex >= 0 && actualIndex < chatHistory.length) {
            chatHistory.splice(actualIndex, 1);
            MayaUtils.storage.set('maya_chat_history', chatHistory);
            MayaUtils.toast.success(isHindi ? 'चैट हटा दी गई' : 'Chat deleted');
            this.render('chat-history');
        }
    },

    /**
     * Initialize Horoscope page - speak button with subtitle display
     */
    initHoroscopePage() {
        console.log('🎤 initHoroscopePage called');
        const speakBtn = document.getElementById('speakHoroscope');
        const horoscopeText = document.getElementById('horoscopeText');
        const subtitleEl = document.getElementById('horoscopeSubtitle');

        console.log('🎤 Elements found:', { speakBtn: !!speakBtn, horoscopeText: !!horoscopeText, MayaVoice: !!window.MayaVoice });

        if (speakBtn && horoscopeText && window.MayaVoice) {
            let isSpeaking = false;

            speakBtn.addEventListener('click', async () => {
                console.log('🎤 Speak button clicked, isSpeaking:', isSpeaking, 'isMuted:', MayaVoice.isMuted);

                if (isSpeaking) {
                    // Stop speaking
                    MayaVoice.stop();
                    speakBtn.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
                    speakBtn.classList.remove('speaking');
                    if (subtitleEl) {
                        subtitleEl.style.display = 'none';
                        subtitleEl.textContent = '';
                    }
                    horoscopeText.style.display = 'block';
                    isSpeaking = false;
                } else {
                    // Start speaking - fast streaming mode
                    const text = horoscopeText.textContent;
                    console.log('🎤 Speaking text:', text.substring(0, 50) + '...');

                    speakBtn.innerHTML = '<i class="bi bi-stop-fill"></i>';
                    speakBtn.classList.add('speaking');
                    isSpeaking = true;

                    // Hide full text, show subtitle immediately
                    horoscopeText.style.display = 'none';
                    if (subtitleEl) {
                        subtitleEl.style.display = 'block';
                        subtitleEl.textContent = 'Starting...';
                    }

                    try {
                        // Use fast chunked speak with progress callback for subtitle display
                        await MayaVoice.speak(text, (currentSentence, isComplete) => {
                            if (subtitleEl && !isComplete) {
                                subtitleEl.textContent = currentSentence;
                            }
                            if (isComplete) {
                                // Show full text again when done
                                horoscopeText.style.display = 'block';
                                if (subtitleEl) {
                                    subtitleEl.style.display = 'none';
                                    subtitleEl.textContent = '';
                                }
                            }
                        });
                    } catch (e) {
                        console.error('Error speaking horoscope:', e);
                        // Show text again on error
                        horoscopeText.style.display = 'block';
                        if (subtitleEl) {
                            subtitleEl.style.display = 'none';
                        }
                    }

                    // Reset button when done
                    speakBtn.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
                    speakBtn.classList.remove('speaking');
                    isSpeaking = false;
                }
            });
        }

        // Initialize aspect card click handlers
        this.initAspectCards();
    },

    /**
     * Initialize Aspect Cards with popup functionality
     */
    initAspectCards() {
        const aspectCards = document.querySelectorAll('.maya-rating-item--clickable');

        aspectCards.forEach(card => {
            card.addEventListener('click', async () => {
                const aspect = card.dataset.aspect;
                const rating = parseInt(card.dataset.rating);
                const zodiac = card.dataset.zodiac;
                const horoscope = decodeURIComponent(card.dataset.horoscope || '');
                const profile = MayaUtils.storage.get('maya_profile') || {};

                this.showAspectModal(aspect, rating, zodiac, horoscope, profile);
            });
        });
    },

    /**
     * Show Aspect Detail Modal with AI-generated insights
     */
    async showAspectModal(aspect, rating, zodiac, horoscope, profile) {
        const isHindi = false; // UI always English

        const aspectIcons = {
            love: 'bi-heart-fill',
            career: 'bi-briefcase-fill',
            finance: 'bi-currency-rupee',
            health: 'bi-activity',
            family: 'bi-people-fill',
            luck: 'bi-suit-club-fill'
        };

        const aspectLabels = {
            love: isHindi ? 'प्रेम और रिश्ते' : 'Love & Relationships',
            career: isHindi ? 'करियर और काम' : 'Career & Work',
            finance: isHindi ? 'धन और वित्त' : 'Finance & Money',
            health: isHindi ? 'स्वास्थ्य और ऊर्जा' : 'Health & Energy',
            family: isHindi ? 'परिवार और घर' : 'Family & Home',
            luck: isHindi ? 'भाग्य और अवसर' : 'Luck & Opportunities'
        };

        const renderStarsHtml = (r) => {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<i class="bi bi-star${i <= r ? '-fill' : ''} ${i <= r ? 'active' : ''}"></i>`;
            }
            return stars;
        };

        // Remove any existing modal first
        const existingModal = document.getElementById('aspectModal');
        if (existingModal) existingModal.remove();

        // Create modal with loading state
        const modal = document.createElement('div');
        modal.id = 'aspectModal';
        modal.className = 'maya-modal maya-modal--active';
        modal.innerHTML = `
            <div class="maya-modal__backdrop"></div>
            <div class="maya-modal__container maya-aspect-modal">
                <div class="maya-modal__header">
                    <div class="maya-aspect-modal__icon ${rating <= 2 ? 'maya-aspect-modal__icon--warning' : 'maya-aspect-modal__icon--good'}">
                        <i class="bi ${aspectIcons[aspect]}"></i>
                    </div>
                    <div class="maya-modal__header-text">
                        <h3 class="maya-modal__title">${aspectLabels[aspect]}</h3>
                        <div class="maya-aspect-modal__rating">
                            ${renderStarsHtml(rating)}
                            <span class="maya-aspect-modal__rating-label">${rating}/5</span>
                        </div>
                    </div>
                    <button class="maya-modal__close" id="closeAspectModal">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="maya-modal__body maya-aspect-modal__body">
                    <div class="maya-aspect-modal__loading">
                        <div class="maya-spinner"></div>
                        <p>${isHindi ? 'अंतर्दृष्टि प्राप्त कर रहा हूँ...' : 'Getting insights...'}</p>
                    </div>
                </div>
                <div class="maya-modal__footer">
                    <button class="maya-btn maya-btn--outline" id="closeAspectModalBtn">
                        ${isHindi ? 'बंद करें' : 'Close'}
                    </button>
                    <button class="maya-btn maya-btn--primary" id="speakAspectBtn">
                        <i class="bi bi-volume-up-fill"></i>
                        ${isHindi ? 'सुनें' : 'Listen'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeModal = () => {
            if (window.MayaVoice) MayaVoice.stop();
            modal.classList.remove('maya-modal--active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.maya-modal__backdrop').addEventListener('click', closeModal);
        modal.querySelector('#closeAspectModal').addEventListener('click', closeModal);
        modal.querySelector('#closeAspectModalBtn').addEventListener('click', closeModal);

        // Fetch AI insight
        let insightText = '';
        try {
            const insight = await MayaHoroscopeAPI.generateAspectInsight(aspect, rating, horoscope, zodiac, profile);

            const bodyEl = modal.querySelector('.maya-aspect-modal__body');

            // Build content based on rating
            const statusClass = rating <= 2 ? 'warning' : rating >= 4 ? 'positive' : 'neutral';
            const statusIcon = rating <= 2 ? 'bi-exclamation-triangle-fill' : rating >= 4 ? 'bi-check-circle-fill' : 'bi-info-circle-fill';
            const statusLabel = rating <= 2
                ? (isHindi ? 'सावधानी आवश्यक' : 'Caution Needed')
                : rating >= 4
                    ? (isHindi ? 'अनुकूल दिन' : 'Favorable Day')
                    : (isHindi ? 'संतुलित दिन' : 'Balanced Day');

            insightText = insight.explanation + (insight.advice ? ' ' + insight.advice : '') + (insight.timing ? ' ' + insight.timing : '');

            bodyEl.innerHTML = `
                <div class="maya-aspect-modal__status maya-aspect-modal__status--${statusClass}">
                    <i class="bi ${statusIcon}"></i>
                    <span>${statusLabel}</span>
                </div>
                <div class="maya-aspect-modal__content">
                    <p>${insight.explanation}</p>
                    ${insight.advice ? `<div class="maya-aspect-modal__advice"><strong>${isHindi ? '💡 सलाह:' : '💡 Advice:'}</strong> ${insight.advice}</div>` : ''}
                    ${insight.timing ? `<div class="maya-aspect-modal__timing"><strong>${isHindi ? '⏰ समय:' : '⏰ Timing:'}</strong> ${insight.timing}</div>` : ''}
                </div>
            `;
        } catch (error) {
            console.error('Error fetching aspect insight:', error);
            const bodyEl = modal.querySelector('.maya-aspect-modal__body');
            bodyEl.innerHTML = `
                <div class="maya-aspect-modal__error">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>${isHindi ? 'अंतर्दृष्टि लोड करने में त्रुटि। कृपया पुनः प्रयास करें।' : 'Error loading insight. Please try again.'}</p>
                </div>
            `;
        }

        // Speak button
        const speakBtn = modal.querySelector('#speakAspectBtn');
        let isSpeaking = false;

        speakBtn.addEventListener('click', async () => {
            if (!insightText) return;

            if (isSpeaking) {
                MayaVoice.stop();
                speakBtn.innerHTML = `<i class="bi bi-volume-up-fill"></i> ${isHindi ? 'सुनें' : 'Listen'}`;
                isSpeaking = false;
            } else {
                speakBtn.innerHTML = `<i class="bi bi-stop-fill"></i> ${isHindi ? 'रुकें' : 'Stop'}`;
                isSpeaking = true;
                try {
                    await MayaVoice.speak(insightText);
                } catch (e) {
                    console.error('TTS error:', e);
                }
                speakBtn.innerHTML = `<i class="bi bi-volume-up-fill"></i> ${isHindi ? 'सुनें' : 'Listen'}`;
                isSpeaking = false;
            }
        });
    },

    /**
     * Initialize Home page
     */
    async initHomePage() {
        const insightEl = document.getElementById('dailyInsight');
        const profile = MayaUtils.storage.get('maya_profile') || {};
        if (insightEl) {
            insightEl.textContent = this.getDailyPractice(profile, false).summary;
        }

        // Full reading button
        const readingBtn = document.getElementById('getFullReading');
        if (readingBtn) {
            readingBtn.addEventListener('click', () => {
                if (window.MayaApp) {
                    MayaApp.showMaya();
                }
            });
        }

        // Lucky element cards click handlers
        this.initLuckyCards();
    },

    initJournalPage() {
        let selectedMood = document.querySelector('[data-journal-mood].active')?.dataset.journalMood || 'steady';
        let selectedFocus = document.querySelector('[data-journal-focus].active')?.dataset.journalFocus || 'clarity';

        const bindChipGroup = (selector, dataKey, onSelect) => {
            document.querySelectorAll(selector).forEach((chip) => {
                chip.addEventListener('click', () => {
                    document.querySelectorAll(selector).forEach((item) => item.classList.remove('active'));
                    chip.classList.add('active');
                    onSelect(chip.dataset[dataKey]);
                });
            });
        };

        bindChipGroup('[data-journal-mood]', 'journalMood', (value) => {
            selectedMood = value || selectedMood;
        });
        bindChipGroup('[data-journal-focus]', 'journalFocus', (value) => {
            selectedFocus = value || selectedFocus;
        });

        document.getElementById('saveJournalEntry')?.addEventListener('click', () => {
            const date = document.getElementById('journalDate')?.value || this._getLocalDate();
            const intention = document.getElementById('journalIntention')?.value?.trim() || '';
            const reflection = document.getElementById('journalReflection')?.value?.trim() || '';
            const isHindi = false; // UI always English

            if (!intention && !reflection) {
                MayaUtils.toast?.info(isHindi ? 'एक इरादा या प्रतिबिंब लिखें' : 'Write an intention or reflection first');
                return;
            }

            const entries = this.getJournalEntries();
            const entry = {
                id: date,
                date,
                mood: selectedMood,
                focus: selectedFocus,
                intention,
                reflection,
                updatedAt: new Date().toISOString()
            };
            const existingIndex = entries.findIndex((item) => item.date === date);

            if (existingIndex >= 0) {
                entries[existingIndex] = entry;
            } else {
                entries.unshift(entry);
            }

            MayaUtils.storage.set('maya_journal_entries', entries.slice(0, 60));
            MayaUtils.toast?.success(isHindi ? 'जर्नल सेव हो गया' : 'Journal saved');
            this.render('journal');
        });

        document.getElementById('coachJournalBtn')?.addEventListener('click', () => {
            const intention = document.getElementById('journalIntention')?.value?.trim() || '';
            const reflection = document.getElementById('journalReflection')?.value?.trim() || '';
            const prompt = `Use my Mayalogy journal to coach me with one clear next step. Mood: ${selectedMood}. Focus: ${selectedFocus}. Intention: ${intention || 'not set'}. Reflection: ${reflection || 'not written yet'}.`;

            if (window.MayaApp) {
                MayaApp.showMaya();
                window.setTimeout(() => {
                    const input = document.getElementById('maya-input');
                    if (input) {
                        input.value = prompt;
                        input.focus();
                    }
                }, 350);
            }
        });
    },

    /**
     * Initialize Lucky Element Cards with popup functionality
     */
    initLuckyCards() {
        const luckyCards = document.querySelectorAll('.maya-lucky-card');

        luckyCards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.luckyType;
                const value = card.dataset.luckyValue;
                const name = card.dataset.luckyName;
                this.showLuckyModal(type, value, name);
            });
        });
    },

    /**
     * Show Lucky Element Modal with details
     */
    showLuckyModal(type, value, name) {
        // Remove any existing lucky modal first
        const existingModal = document.getElementById('luckyModal');
        if (existingModal) existingModal.remove();

        const isHindi = false; // UI always English

        const modalData = this.getLuckyModalData(type, value, name, isHindi);

        // Create modal HTML - show display name for colors, not hex value
        const displayValue = type === 'color' ? (name || value) : value;

        const modalHTML = `
            <div class="maya-lucky-modal" id="luckyModal">
                <div class="maya-lucky-modal__backdrop" id="luckyModalBackdrop"></div>
                <div class="maya-lucky-modal__content">
                    <div class="maya-lucky-modal__header">
                        <h3 class="maya-lucky-modal__title">${modalData.title}</h3>
                        <button type="button" class="maya-lucky-modal__close" id="closeLuckyModal" aria-label="Close">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="maya-lucky-modal__icon">
                        ${modalData.icon}
                    </div>
                    <div class="maya-lucky-modal__body">
                        <div class="maya-lucky-modal__value">${displayValue}</div>
                        <p class="maya-lucky-modal__description">${modalData.description}</p>
                        <div class="maya-lucky-modal__tips">
                            <div class="maya-lucky-modal__tips-title">${isHindi ? 'कैसे उपयोग करें' : 'How to Use'}</div>
                            <ul class="maya-lucky-modal__tips-list">
                                ${modalData.tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get elements
        const modal = document.getElementById('luckyModal');
        const closeBtn = document.getElementById('closeLuckyModal');
        const backdrop = document.getElementById('luckyModalBackdrop');

        // Show modal with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        const closeModal = () => {
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            }
            document.removeEventListener('keydown', escHandler);
        };

        // Close button click (including icon inside)
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            });
        }

        // Close on backdrop click
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }

        // Also close on modal wrapper click (outside content)
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    /**
     * Get Lucky Modal Data based on type
     */
    getLuckyModalData(type, value, name, isHindi) {
        const data = {
            color: {
                title: isHindi ? 'आपका शुभ रंग' : 'Your Lucky Color',
                icon: `<div class="maya-lucky-modal__icon--color" style="background: ${value}; box-shadow: 0 0 30px ${value}80;"></div>`,
                description: isHindi
                    ? `${name || value} आपके राशि के लिए शुभ रंग है। यह रंग आपकी ऊर्जा को बढ़ाता है और सकारात्मकता लाता है।`
                    : `${name || value} is your auspicious color based on your zodiac sign. This color enhances your energy and brings positivity.`,
                tips: isHindi ? [
                    'इस रंग के कपड़े महत्वपूर्ण दिनों में पहनें',
                    'अपने कार्यस्थल पर इस रंग की वस्तुएं रखें',
                    'ध्यान करते समय इस रंग की कल्पना करें'
                ] : [
                    'Wear this color on important days for success',
                    'Keep items of this color in your workspace',
                    'Visualize this color during meditation'
                ]
            },
            number: {
                title: isHindi ? 'आपके शुभ अंक' : 'Your Lucky Numbers',
                icon: `<span class="maya-lucky-modal__icon--number">${value.split(',')[0]}</span>`,
                description: isHindi
                    ? `${value} आपके शुभ अंक हैं। ये संख्याएं आपके जीवन में सौभाग्य और सफलता लाती हैं।`
                    : `${value} are your lucky numbers. These numbers bring fortune and success in various aspects of your life.`,
                tips: isHindi ? [
                    'महत्वपूर्ण निर्णय इन तारीखों पर लें',
                    'इन अंकों को पासवर्ड में शामिल करें',
                    'लॉटरी या प्रतियोगिताओं में इनका उपयोग करें'
                ] : [
                    'Schedule important decisions on these dates',
                    'Include these numbers in passwords or PINs',
                    'Use these for lottery or competition entries'
                ]
            },
            day: {
                title: isHindi ? 'आपका शुभ दिन' : 'Your Lucky Day',
                icon: `<i class="bi bi-calendar-check"></i>`,
                description: isHindi
                    ? `${value} आपके लिए सबसे शुभ दिन है। इस दिन शुरू किए गए काम सफल होते हैं।`
                    : `${value} is your most auspicious day of the week. Activities started on this day are more likely to succeed.`,
                tips: isHindi ? [
                    'नए प्रोजेक्ट इसी दिन शुरू करें',
                    'महत्वपूर्ण मीटिंग इस दिन रखें',
                    'बड़े निर्णय इस दिन लें'
                ] : [
                    'Start new projects or ventures on this day',
                    'Schedule important meetings on this day',
                    'Make major decisions on this day'
                ]
            },
            gemstone: {
                title: isHindi ? 'आपका रत्न' : 'Your Gemstone',
                icon: `<img src="images/gemstones/${value.toLowerCase().replace(/\s+/g, '-')}.png" alt="${value}" class="maya-lucky-modal__gem-img" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'bi bi-gem\\'></i>'">`,
                description: isHindi
                    ? `${value} आपके राशि का रत्न है। इसे धारण करने से ग्रहों की शुभ ऊर्जा प्राप्त होती है।`
                    : `${value} is your zodiac gemstone. Wearing it channels positive planetary energies and brings balance.`,
                tips: isHindi ? [
                    'इसे अनामिका उंगली में पहनें',
                    'शुभ मुहूर्त में धारण करें',
                    'नियमित रूप से साफ करें और ऊर्जावान करें'
                ] : [
                    'Wear it on your ring finger for best results',
                    'Consecrate it during an auspicious time',
                    'Cleanse and energize it regularly'
                ]
            }
        };

        return data[type] || data.color;
    },

    /**
     * Initialize Google Places Autocomplete for birth place inputs
     */
    initPlacesAutocomplete() {
        // Check if Google Maps API is loaded
        if (!window.google || !window.google.maps || !window.google.maps.places) {
            console.log('Google Places API not loaded, using fallback search');
            this.initFallbackPlaceSearch();
            return;
        }

        const placeInputs = document.querySelectorAll('.maya-place-autocomplete');

        placeInputs.forEach(input => {
            const clearStoredPlaceMeta = () => {
                const wrapper = input.closest('.maya-place-autocomplete-wrapper');
                if (!wrapper) return;

                const latInput = wrapper.querySelector('input[id$="BirthLat"]');
                const lngInput = wrapper.querySelector('input[id$="BirthLng"]');
                const tzInput = wrapper.querySelector('input[id$="Timezone"]');

                if (latInput) latInput.value = '';
                if (lngInput) lngInput.value = '';
                if (tzInput) tzInput.value = '';
            };

            input.addEventListener('input', clearStoredPlaceMeta);

            const autocomplete = new google.maps.places.Autocomplete(input, {
                types: ['(cities)'],
                fields: ['geometry', 'name', 'formatted_address', 'utc_offset_minutes']
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();

                if (place.geometry) {
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    const timezone = place.utc_offset_minutes || 0;

                    // Store coordinates in hidden fields
                    const wrapper = input.closest('.maya-place-autocomplete-wrapper');
                    if (wrapper) {
                        const latInput = wrapper.querySelector('input[id$="BirthLat"]');
                        const lngInput = wrapper.querySelector('input[id$="BirthLng"]');
                        const tzInput = wrapper.querySelector('input[id$="Timezone"]');

                        if (latInput) latInput.value = lat;
                        if (lngInput) lngInput.value = lng;
                        if (tzInput) tzInput.value = timezone;
                    }

                    console.log(`📍 Place selected: ${place.formatted_address} (${lat}, ${lng})`);
                }
            });
        });
    },

    /**
     * Fallback place search using Nominatim (OpenStreetMap) - free API
     */
    initFallbackPlaceSearch() {
        const placeInputs = document.querySelectorAll('.maya-place-autocomplete');

        placeInputs.forEach(input => {
            let debounceTimer;
            let dropdown = null;
            const wrapper = input.closest('.maya-place-autocomplete-wrapper') || input.parentElement;

            // Create dropdown container
            const createDropdown = () => {
                if (!dropdown) {
                    dropdown = document.createElement('div');
                    dropdown.className = 'maya-place-dropdown';
                    wrapper.appendChild(dropdown);
                }
                return dropdown;
            };

            // Hide dropdown
            const hideDropdown = () => {
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            };

            // Search places using Nominatim API
            const searchPlaces = async (query) => {
                if (query.length < 3) {
                    hideDropdown();
                    return;
                }

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                        {
                            cache: 'no-store',
                            headers: { Accept: 'application/json' }
                        }
                    );
                    const results = await response.json();

                    const dd = createDropdown();
                    dd.style.display = 'block';

                    if (results.length === 0) {
                        dd.innerHTML = '<div class="maya-place-dropdown__item maya-place-dropdown__item--empty">No places found</div>';
                        return;
                    }

                    dd.innerHTML = results.map((place, idx) => `
                        <div class="maya-place-dropdown__item" data-idx="${idx}">
                            <i class="bi bi-geo-alt-fill"></i>
                            <span>${place.display_name}</span>
                        </div>
                    `).join('');

                    // Use pointerdown as well as click so mobile taps do not lose the selection on blur.
                    dd.querySelectorAll('.maya-place-dropdown__item[data-idx]').forEach(item => {
                        const handleSelection = (event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            const idx = parseInt(item.dataset.idx);
                            const place = results[idx];

                            input.value = place.display_name;

                            // Store coordinates
                            if (wrapper) {
                                const latInput = wrapper.querySelector('input[id$="BirthLat"]');
                                const lngInput = wrapper.querySelector('input[id$="BirthLng"]');
                                const tzInput = wrapper.querySelector('input[id$="Timezone"]');

                                if (latInput) latInput.value = place.lat;
                                if (lngInput) lngInput.value = place.lon;
                                // Nominatim doesn't provide timezone, calculate from longitude
                                if (tzInput) tzInput.value = Math.round(parseFloat(place.lon) / 15) * 60;
                            }

                            console.log(`📍 Place selected: ${place.display_name} (${place.lat}, ${place.lon})`);
                            hideDropdown();
                        };

                        item.addEventListener('pointerdown', handleSelection);
                        item.addEventListener('click', handleSelection);
                    });
                } catch (error) {
                    console.error('Place search error:', error);
                }
            };

            // Input event with debounce
            input.addEventListener('input', (e) => {
                const wrapper = input.closest('.maya-place-autocomplete-wrapper');
                if (wrapper) {
                    const latInput = wrapper.querySelector('input[id$="BirthLat"]');
                    const lngInput = wrapper.querySelector('input[id$="BirthLng"]');
                    const tzInput = wrapper.querySelector('input[id$="Timezone"]');
                    if (latInput) latInput.value = '';
                    if (lngInput) lngInput.value = '';
                    if (tzInput) tzInput.value = '';
                }
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    searchPlaces(e.target.value);
                }, 300);
            });

            // Hide dropdown on blur (with delay for click)
            input.addEventListener('blur', () => {
                setTimeout(hideDropdown, 200);
            });

            // Show dropdown on focus if has value
            input.addEventListener('focus', () => {
                if (input.value.length >= 3) {
                    searchPlaces(input.value);
                }
            });
        });
    },

    /**
     * Initialize Compatibility page
     */
    initCompatibilityPage() {
        // Initialize place autocomplete
        this.initPlacesAutocomplete();

        const checkBtn = document.getElementById('checkCompatibility');
        if (checkBtn) {
            checkBtn.addEventListener('click', async () => {
                const yourName = document.getElementById('yourName')?.value.trim() || 'Person 1';
                const yourGender = document.getElementById('yourGender')?.value || '';
                const yourDate = document.getElementById('yourBirthDate').value;
                const partnerName = document.getElementById('partnerName')?.value.trim() || 'Person 2';
                const partnerGender = document.getElementById('partnerGender')?.value || '';
                const partnerDate = document.getElementById('partnerBirthDate').value;

                if (!yourDate || !partnerDate) {
                    MayaUtils.toast.error('Please enter both birth dates');
                    return;
                }

                // Get zodiac signs from full birth context
                const yourZodiac = MayaAstrology.getZodiac(yourDate, {
                    birthTime: document.getElementById('yourBirthTime')?.value || '',
                    birthPlace: document.getElementById('yourBirthPlace')?.value || '',
                    birthLat: document.getElementById('yourBirthLat')?.value || '',
                    birthLon: document.getElementById('yourBirthLng')?.value || ''
                });
                const partnerZodiac = MayaAstrology.getZodiac(partnerDate, {
                    birthTime: document.getElementById('partnerBirthTime')?.value || '',
                    birthPlace: document.getElementById('partnerBirthPlace')?.value || '',
                    birthLat: document.getElementById('partnerBirthLat')?.value || '',
                    birthLon: document.getElementById('partnerBirthLng')?.value || ''
                });

                if (!yourZodiac || !partnerZodiac) {
                    MayaUtils.toast.error('Invalid birth dates');
                    return;
                }

                const compatibility = MayaAstrology.getCompatibility(yourZodiac.name, partnerZodiac.name);
                const resultDiv = document.getElementById('compatibilityResult');

                // Determine color based on score
                const getScoreColor = (score) => {
                    if (score >= 75) return '#22c55e';
                    if (score >= 50) return '#f59e0b';
                    return '#ef4444';
                };

                // Gender icons
                const getGenderIcon = (gender) => {
                    if (gender === 'male') return '<i class="bi bi-gender-male"></i>';
                    if (gender === 'female') return '<i class="bi bi-gender-female"></i>';
                    if (gender === 'other') return '<i class="bi bi-gender-ambiguous"></i>';
                    return '';
                };

                // Zodiac image helper
                const getZodiacImage = (zodiac) => {
                    if (zodiac.image) {
                        return `<img src="${zodiac.image}" alt="${zodiac.name}" class="maya-compat-result__sign-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                                <span class="maya-compat-result__sign-fallback" style="display:none;">${zodiac.symbol || '♈'}</span>`;
                    }
                    return `<span class="maya-compat-result__sign-fallback">${zodiac.symbol || '♈'}</span>`;
                };

                // Get guna score color
                const getGunaColor = (score, max) => {
                    const percent = (score / max) * 100;
                    if (percent >= 75) return '#22c55e';
                    if (percent >= 50) return '#f59e0b';
                    if (percent > 0) return '#f97316';
                    return '#ef4444';
                };

                if (resultDiv) {
                    resultDiv.innerHTML = `
                        <div class="maya-compat-result">
                            <div class="maya-compat-result__signs">
                                <div class="maya-compat-result__sign">
                                    <span class="maya-compat-result__sign-emoji">${getZodiacImage(yourZodiac)}</span>
                                    <span class="maya-compat-result__sign-name">${yourName}</span>
                                    <span class="maya-compat-result__sign-info">${yourZodiac.name} ${getGenderIcon(yourGender)}</span>
                                </div>
                                <div class="maya-compat-result__heart">
                                    <i class="bi bi-heart-fill"></i>
                                </div>
                                <div class="maya-compat-result__sign">
                                    <span class="maya-compat-result__sign-emoji">${getZodiacImage(partnerZodiac)}</span>
                                    <span class="maya-compat-result__sign-name">${partnerName}</span>
                                    <span class="maya-compat-result__sign-info">${partnerZodiac.name} ${getGenderIcon(partnerGender)}</span>
                                </div>
                            </div>
                            
                            <div class="maya-compat-result__score-ring" style="--score-color: ${getScoreColor(compatibility.score)}">
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="${getScoreColor(compatibility.score)}" stroke-width="8"
                                            stroke-dasharray="${compatibility.score * 2.83} 283" stroke-linecap="round"
                                            transform="rotate(-90 50 50)"/>
                                </svg>
                                <div class="maya-compat-result__score-value">${compatibility.totalGunas}/${compatibility.maxGunas}</div>
                            </div>
                            <h4 class="maya-compat-result__level">${compatibility.level}</h4>
                            <p class="maya-compat-result__desc">${compatibility.description}</p>
                            
                            ${compatibility.doshas && compatibility.doshas.length > 0 ? `
                                <div class="maya-compat-result__doshas">
                                    <span class="maya-compat-result__dosha-label">⚠️ Doshas:</span>
                                    ${compatibility.doshas.map(d => `<span class="maya-compat-result__dosha">${d}</span>`).join('')}
                                </div>
                            ` : ''}
                            
                            <div class="maya-compat-result__gunas">
                                <h5 class="maya-compat-result__gunas-title">अष्टकूट गुण मिलान (Ashtakoot Guna Milan)</h5>
                                ${Object.entries(compatibility.aspects).map(([key, data]) => `
                                    <div class="maya-compat-guna">
                                        <div class="maya-compat-guna__header">
                                            <span class="maya-compat-guna__name">${key}</span>
                                            <span class="maya-compat-guna__score" style="color: ${getGunaColor(data.score, data.max)}">${data.score}/${data.max}</span>
                                        </div>
                                        <div class="maya-compat-guna__bar">
                                            <div class="maya-compat-guna__fill" style="width: ${(data.score / data.max) * 100}%; background: ${getGunaColor(data.score, data.max)};"></div>
                                        </div>
                                        <span class="maya-compat-guna__desc">${data.desc}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="maya-compat-result__summary">
                                <div class="maya-compat-summary-item">
                                    <span class="maya-compat-summary-label">Total Gunas</span>
                                    <span class="maya-compat-summary-value" style="color: ${getScoreColor(compatibility.score)}">${compatibility.totalGunas} / 36</span>
                                </div>
                                <div class="maya-compat-summary-item">
                                    <span class="maya-compat-summary-label">Match Percentage</span>
                                    <span class="maya-compat-summary-value" style="color: ${getScoreColor(compatibility.score)}">${compatibility.score}%</span>
                                </div>
                            </div>
                            
                            <button class="maya-btn maya-btn--primary maya-btn--block maya-compat-share-btn" id="shareCompatibility">
                                <i class="bi bi-share-fill"></i>
                                <span>Share Match Result</span>
                            </button>
                        </div>
                    `;

                    // Scroll to result
                    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    // Add share button listener
                    const shareBtn = document.getElementById('shareCompatibility');
                    if (shareBtn) {
                        shareBtn.addEventListener('click', () => {
                            this.shareCompatibilityResult(yourName, partnerName, yourZodiac, partnerZodiac, compatibility);
                        });
                    }
                }
            });
        }
    },

    /**
     * Generate and share compatibility result as image
     */
    async shareCompatibilityResult(name1, name2, zodiac1, zodiac2, compatibility) {
        try {
            // Create canvas for the share image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size (optimized for social sharing)
            canvas.width = 600;
            canvas.height = 800;

            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0f0f23');
            gradient.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Add subtle pattern
            ctx.fillStyle = 'rgba(99, 102, 241, 0.05)';
            for (let i = 0; i < 20; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 50 + 10, 0, Math.PI * 2);
                ctx.fill();
            }

            // Title - MAYALOGY
            ctx.fillStyle = '#c79a3a';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('MAYALOGY', canvas.width / 2, 50);

            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.fillText('Ashtakoot Guna Milan', canvas.width / 2, 75);

            // Names and signs
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(name1 || 'Person 1', 150, 140);
            ctx.fillText(name2 || 'Person 2', 450, 140);

            ctx.fillStyle = '#c79a3a';
            ctx.font = '18px Arial';
            ctx.fillText(zodiac1.name, 150, 170);
            ctx.fillText(zodiac2.name, 450, 170);

            // Heart in the middle
            ctx.fillStyle = '#ef4444';
            ctx.font = '40px Arial';
            ctx.fillText('❤️', canvas.width / 2, 155);

            // Score circle
            const centerX = canvas.width / 2;
            const centerY = 280;
            const radius = 70;

            // Background circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 12;
            ctx.stroke();

            // Score arc
            const scoreColor = compatibility.score >= 75 ? '#22c55e' : compatibility.score >= 50 ? '#f59e0b' : '#ef4444';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * compatibility.score / 100));
            ctx.strokeStyle = scoreColor;
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Score text
            ctx.fillStyle = scoreColor;
            ctx.font = 'bold 36px Arial';
            ctx.fillText(`${compatibility.totalGunas}/36`, centerX, centerY + 10);

            // Match level
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(compatibility.level, centerX, 390);

            // Gunas breakdown
            let gunaY = 440;
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';

            Object.entries(compatibility.aspects).forEach(([key, data]) => {
                // Guna name
                ctx.fillStyle = '#ffffff';
                ctx.fillText(key.split(' ')[0], 50, gunaY);

                // Bar background
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(200, gunaY - 10, 300, 14);

                // Bar fill
                const barColor = (data.score / data.max) >= 0.75 ? '#22c55e' : (data.score / data.max) >= 0.5 ? '#f59e0b' : '#ef4444';
                ctx.fillStyle = barColor;
                ctx.fillRect(200, gunaY - 10, 300 * (data.score / data.max), 14);

                // Score
                ctx.fillStyle = barColor;
                ctx.textAlign = 'right';
                ctx.fillText(`${data.score}/${data.max}`, 560, gunaY);
                ctx.textAlign = 'left';

                gunaY += 35;
            });

            // Footer
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Generated by Mayalogy - Personal Guidance Journal', centerX, canvas.height - 30);
            ctx.fillText('mayalogy.com', centerX, canvas.height - 12);

            // Convert canvas to blob
            canvas.toBlob(async (blob) => {
                const file = new File([blob], 'mayalogy-compatibility.png', { type: 'image/png' });

                // Try native share if available
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            title: 'Mayalogy Match Result',
                            text: `${name1} & ${name2} - ${compatibility.totalGunas}/36 Gunas (${compatibility.level})`,
                            files: [file]
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            this.downloadCompatibilityImage(canvas);
                        }
                    }
                } else {
                    // Fallback: download the image
                    this.downloadCompatibilityImage(canvas);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error generating share image:', error);
            MayaUtils.toast.error('Unable to generate share image');
        }
    },

    /**
     * Download compatibility image as fallback
     */
    downloadCompatibilityImage(canvas) {
        const link = document.createElement('a');
        link.download = 'mayalogy-compatibility.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        MayaUtils.toast.success('Image saved! Share it from your gallery.');
    },

    /**
     * Initialize Chat page
     */
    initChatPage() {
        // Unified chat - open the MAYA overlay (same as funnel-end chat)
        if (window.MayaApp) {
            MayaApp.showMaya();
        }
    },

    /**
     * Send chat message
     */
    async sendChatMessage(input, messagesDiv, profile) {
        const message = input.value.trim();
        if (!message) return;

        // Hide welcome screen
        const welcome = messagesDiv.querySelector('.maya-chat__welcome');
        if (welcome) welcome.style.display = 'none';

        // Add user message
        messagesDiv.innerHTML += `
            <div class="maya-chat__message maya-chat__message--user">
                <div class="maya-chat__bubble">
                    <p>${message}</p>
                </div>
            </div>
        `;

        input.value = '';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // Show typing indicator
        messagesDiv.innerHTML += `
            <div class="maya-chat__message maya-chat__message--maya" id="typingIndicator">
                <div class="maya-chat__avatar">
                    <div class="maya-avatar maya-avatar--sm">M</div>
                </div>
                <div class="maya-chat__bubble maya-chat__bubble--typing">
                    <div class="maya-typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;

        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        try {
            const response = await MayaAI.askMaya(message, {
                fullName: profile.name || 'Friend',
                birthDate: profile.birthDate,
                birthTime: profile.birthTime,
                birthPlace: profile.birthPlace,
                language: MayaUtils.storage.get('maya_language') || 'en'
            });

            // Remove typing indicator
            document.getElementById('typingIndicator')?.remove();

            // Add MAYA response
            messagesDiv.innerHTML += `
                <div class="maya-chat__message maya-chat__message--maya">
                    <div class="maya-chat__avatar">
                        <div class="maya-avatar maya-avatar--sm">M</div>
                    </div>
                    <div class="maya-chat__bubble">
                        <p>${response}</p>
                    </div>
                </div>
            `;

            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Speak response
            if (window.MayaVoice && !MayaVoice.isMuted) {
                MayaVoice.speakWithFallback(response);
            }
        } catch (error) {
            console.error('Chat error:', error);
            document.getElementById('typingIndicator')?.remove();
            messagesDiv.innerHTML += `
                <div class="maya-chat__message maya-chat__message--maya">
                    <div class="maya-chat__avatar">
                        <div class="maya-avatar maya-avatar--sm">M</div>
                    </div>
                    <div class="maya-chat__bubble maya-chat__bubble--error">
                        <p>I apologize, I'm having trouble connecting right now. Please try again.</p>
                    </div>
                </div>
            `;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    },

    /**
     * Initialize Profile page
     */
    initProfilePage() {
        const isHindi = false; // UI always English
        this.initPlacesAutocomplete();

        // Photo upload handling
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        const photoInput = document.getElementById('profilePhotoInput');
        const removePhotoBtn = document.getElementById('removePhotoBtn');

        if (changePhotoBtn && photoInput) {
            changePhotoBtn.addEventListener('click', () => photoInput.click());

            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validate file size (max 20MB)
                if (file.size > 20 * 1024 * 1024) {
                    MayaUtils.toast.error(isHindi ? 'फोटो 20MB से छोटी होनी चाहिए' : 'Photo must be smaller than 20MB');
                    return;
                }

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    MayaUtils.toast.error(isHindi ? 'कृपया एक छवि फ़ाइल चुनें' : 'Please select an image file');
                    return;
                }

                try {
                    // Convert to base64 and resize
                    const base64 = await this.resizeAndConvertImage(file, 200);
                    MayaUtils.storage.set('maya_profile_photo', base64);
                    MayaUtils.toast.success(isHindi ? 'फोटो अपडेट हो गई' : 'Photo updated');
                    this.render('profile');

                    // Update sidebar avatar if exists
                    this.updateSidebarAvatar();
                } catch (err) {
                    console.error('Photo upload error:', err);
                    MayaUtils.toast.error(isHindi ? 'फोटो अपलोड विफल' : 'Failed to upload photo');
                }
            });
        }

        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => {
                MayaUtils.storage.remove('maya_profile_photo');
                MayaUtils.toast.success(isHindi ? 'फोटो हटा दी गई' : 'Photo removed');
                this.render('profile');
                this.updateSidebarAvatar();
            });
        }

        // Zodiac System Toggle
        const zodiacToggle = document.getElementById('zodiacSystemToggle');
        if (zodiacToggle) {
            zodiacToggle.addEventListener('click', (e) => {
                const btn = e.target.closest('.maya-toggle-btn');
                if (btn && btn.dataset.system) {
                    const system = btn.dataset.system;
                    MayaAstrology.setZodiacSystem(system);

                    // Update active state
                    zodiacToggle.querySelectorAll('.maya-toggle-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Show toast
                    const systemName = system === 'vedic'
                        ? (isHindi ? 'वैदिक (सायन)' : 'Vedic (Sidereal)')
                        : (isHindi ? 'पाश्चात्य (निरयन)' : 'Western (Tropical)');
                    MayaUtils.toast.success(isHindi ? `${systemName} में बदला` : `Switched to ${systemName} zodiac`);

                    // Refresh page to update zodiac display
                    setTimeout(() => this.render('profile'), 500);
                }
            });
        }

        const saveBtn = document.getElementById('saveProfile');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const genderRadio = document.querySelector('input[name="profileGender"]:checked');
                const existingProfile = MayaUtils.storage.get('maya_profile') || {};
                const birthPlaceInput = document.getElementById('profileBirthPlace');
                const birthLatInput = document.getElementById('profileBirthLat');
                const birthLngInput = document.getElementById('profileBirthLng');
                const birthPlace = birthPlaceInput?.value?.trim() || '';

                let birthLat = Number.parseFloat(birthLatInput?.value || '');
                let birthLon = Number.parseFloat(birthLngInput?.value || '');

                if (!Number.isFinite(birthLat) || !Number.isFinite(birthLon)) {
                    const canReuseStoredCoords = (existingProfile.birthPlace || '').trim() === birthPlace;
                    birthLat = canReuseStoredCoords && Number.isFinite(Number(existingProfile.birthLat))
                        ? Number(existingProfile.birthLat)
                        : null;
                    birthLon = canReuseStoredCoords && Number.isFinite(Number(existingProfile.birthLon))
                        ? Number(existingProfile.birthLon)
                        : null;
                }

                let resolvedBirthPlace = {
                    birthPlace,
                    birthLat,
                    birthLon
                };

                if (birthPlace) {
                    resolvedBirthPlace = await MayaUtils.location.resolveBirthPlace(birthPlace, {
                        birthLat,
                        birthLon
                    });
                }

                const profileData = {
                    name: document.getElementById('profileName').value,
                    birthDate: document.getElementById('profileBirthDate').value,
                    birthTime: document.getElementById('profileBirthTime').value,
                    birthPlace: resolvedBirthPlace.birthPlace || birthPlace,
                    birthLat: Number.isFinite(resolvedBirthPlace.birthLat) ? resolvedBirthPlace.birthLat : null,
                    birthLon: Number.isFinite(resolvedBirthPlace.birthLon) ? resolvedBirthPlace.birthLon : null,
                    gender: genderRadio ? genderRadio.value : null,
                    language: MayaUtils.storage.get('maya_language') || existingProfile.language || 'en'
                };

                await MayaAuth.saveBirthDetails(profileData);
                MayaUtils.toast.success(isHindi ? 'प्रोफ़ाइल सहेजी गई!' : 'Profile saved successfully!');

                // Refresh the page to show updated avatar
                this.render('profile');

                // Update sidebar
                if (window.MayaApp) {
                    MayaApp.updateSidebarUserInfo();
                }
            });
        }
    },

    /**
     * Resize and convert image to base64
     */
    resizeAndConvertImage(file, maxSize) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions maintaining aspect ratio
                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Update sidebar avatar with profile photo
     */
    updateSidebarAvatar() {
        // Just call the main app function to keep it consistent
        if (window.MayaApp) {
            MayaApp.updateSidebarUserInfo();
        }
    },

    /**
     * Initialize Settings page
     */
    initSettingsPage() {
        const isHindi = false; // UI always English

        // Initialize custom dropdowns
        this._initCustomDropdowns();

        // Language dropdown handler
        const langSelect = document.getElementById('settingLanguage');
        if (langSelect) {
            const langWrapper = langSelect.closest('.maya-select-wrapper');
            if (langWrapper) {
                langWrapper.querySelectorAll('.maya-select-option').forEach(option => {
                    option.addEventListener('click', async (e) => {
                        const value = e.target.dataset.value === 'hi' ? 'hi' : 'en';

                        if (window.MayaApp?.applyLanguagePreference) {
                            await MayaApp.applyLanguagePreference(value, {
                                rerenderCurrentPage: true,
                                force: true,
                                syncProfile: true
                            });
                        } else {
                            if (window.MayaDBSync?.set) {
                                MayaDBSync.set('maya_language', value);
                            } else {
                                MayaUtils.storage.set('maya_language', value);
                            }

                            const profile = MayaUtils.storage.get('maya_profile') || {};
                            MayaUtils.storage.set('maya_profile', { ...profile, language: value });

                            if (window.MayaI18n) {
                                await MayaI18n.setLanguage(value, { force: true });
                            }

                            if (window.MayaAuth?.isAuthenticated && typeof MayaAuth.updateProfile === 'function') {
                                try {
                                    await MayaAuth.updateProfile({ language: value });
                                } catch (error) {
                                    console.warn('Failed to sync language preference:', error);
                                }
                            }

                            await this.render(this.currentPage || 'settings');
                        }

                        const newIsHindi = value === 'hi';
                        MayaUtils.toast.success(newIsHindi ? 'भाषा हिंदी में बदल गई' : 'Language changed to English');
                    });
                });
            }
        }

        // Theme dropdown handler
        const themeSelect = document.getElementById('settingTheme');
        if (themeSelect) {
            const themeWrapper = themeSelect.closest('.maya-select-wrapper');
            if (themeWrapper) {
                themeWrapper.querySelectorAll('.maya-select-option').forEach(option => {
                    option.addEventListener('click', (e) => {
                        const value = e.target.dataset.value;
                        MayaUtils.storage.set('maya_theme', value);
                        if (window.MayaApp) {
                            MayaApp.applyTheme(value);
                        }
                        const themeName = value === 'dark' ? (isHindi ? 'डार्क' : 'Dark') :
                            value === 'light' ? (isHindi ? 'लाइट' : 'Light') :
                                (isHindi ? 'सिस्टम' : 'System');
                        MayaUtils.toast.success(isHindi ? `थीम ${themeName} में बदली` : `Theme changed to ${themeName}`);
                    });
                });
            }
        }

        // Voice
        const voiceToggle = document.getElementById('settingVoice');
        if (voiceToggle) {
            voiceToggle.addEventListener('change', (e) => {
                const muted = !e.target.checked;
                MayaUtils.storage.set('maya_voice_muted', muted);
                if (window.MayaVoice) {
                    MayaVoice.setMute(muted);
                }
                MayaUtils.toast.success(isHindi
                    ? (muted ? 'आवाज़ बंद' : 'आवाज़ चालू')
                    : (muted ? 'Voice disabled' : 'Voice enabled'));
            });
        }

        // Notifications
        const notifToggle = document.getElementById('settingNotifications');
        if (notifToggle) {
            notifToggle.addEventListener('change', (e) => {
                MayaUtils.storage.set('maya_notifications', e.target.checked);
                MayaUtils.toast.success(isHindi
                    ? (e.target.checked ? 'सूचनाएं चालू' : 'सूचनाएं बंद')
                    : (e.target.checked ? 'Notifications enabled' : 'Notifications disabled'));
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Logout button clicked');
                if (confirm(isHindi ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Are you sure you want to logout?')) {
                    console.log('Logging out...');
                    MayaAuth.logout();
                    // Clear all relevant storage
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = window.location.origin + window.location.pathname;
                }
            });
        }

        // Clear Cache & Reload
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                clearCacheBtn.disabled = true;
                clearCacheBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> <span>${isHindi ? 'कृपया प्रतीक्षा करें...' : 'Please wait...'}</span>`;

                MayaUtils.toast.info(isHindi ? 'कैश साफ़ हो रहा है...' : 'Clearing cache...');

                // Small delay for UX
                await new Promise(r => setTimeout(r, 500));

                // Clear and reload
                await MayaUtils.forceReload();
            });
        }
    },

    /**
     * Initialize custom dropdown behaviors
     */
    _initCustomDropdowns() {
        const dropdowns = document.querySelectorAll('.maya-select-wrapper');

        dropdowns.forEach(wrapper => {
            const select = wrapper.querySelector('.maya-select');
            const dropdown = wrapper.querySelector('.maya-select-dropdown');
            const options = wrapper.querySelectorAll('.maya-select-option');

            if (!select || !dropdown) return;

            // Toggle dropdown on click
            select.addEventListener('click', (e) => {
                e.stopPropagation();

                // Close other open dropdowns & reset their wrapper z-index
                document.querySelectorAll('.maya-select.open').forEach(s => {
                    if (s !== select) {
                        s.classList.remove('open');
                        s.closest('.maya-select-wrapper')?.style.removeProperty('z-index');
                    }
                });

                select.classList.toggle('open');
                // Raise wrapper z-index when open so dropdown paints above siblings
                const w = select.closest('.maya-select-wrapper');
                if (w) w.style.zIndex = select.classList.contains('open') ? '100' : '';
            });

            // Handle option selection
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = option.dataset.value;
                    const text = option.textContent;

                    // Update select display
                    select.textContent = text;
                    select.dataset.value = value;

                    // Update selected state
                    options.forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');

                    // Close dropdown & reset z-index
                    select.classList.remove('open');
                    select.closest('.maya-select-wrapper')?.style.removeProperty('z-index');
                });
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.maya-select.open').forEach(s => {
                s.classList.remove('open');
                s.closest('.maya-select-wrapper')?.style.removeProperty('z-index');
            });
        });
    }
};

// Make globally available
window.MayaPages = MayaPages;