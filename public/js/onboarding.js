/**
 * MAYA - Onboarding Module
 * User Onboarding Flow - Collects details then shows AI reading
 */

const MayaOnboarding = {
    currentStep: 0,
    userData: {},
    isComplete: false,
    locationOutsideHandler: null,

    get totalSteps() {
        return this.steps.length;
    },

    // Ritual voice lines spoken at each onboarding step (micro-confirmations)
    ritualVoiceLines: {
        language: {
            en: null, // No voice before language is chosen
            hi: null
        },
        welcome: {
            en: "Good. Let me note that down.",
            hi: "अच्छा। लिख लेता हूँ।",
            hi_f: "अच्छा। लिख लेती हूँ।"
        },
        gender: {
            en: "Noted.",
            hi: "ठीक है।"
        },
        birthDate: {
            en: "This is where your visible timeline begins.",
            hi: "यहीं से आपकी समयरेखा शुरू होती है।"
        },
        birthTime: {
            en: "This helps me see your chart more clearly.",
            hi: "इससे कुंडली और साफ़ दिखेगी।"
        },
        birthPlace: {
            en: "Got it. One more thing.",
            hi: "समझ गया। एक बात और।",
            hi_f: "समझ गई। एक बात और।"
        },
        maritalStatus: {
            en: "I have what I need. Let me begin.",
            hi: "जो चाहिए था, मिल गया। शुरू करता हूँ।",
            hi_f: "जो चाहिए था, मिल गया। शुरू करती हूँ।"
        }
    },

    // Funnel State Keys
    STORAGE_KEYS: {
        FUNNEL_STATE: 'funnel_state',
        FUNNEL_STEP: 'funnel_step',
        FUNNEL_DATA: 'funnel_data',
        FUNNEL_COMPLETE: 'funnel_complete'
    },

    uiText: {
        progress: { en: 'Step', hi: 'चरण' },
        of: { en: 'of', hi: 'में से' },
        back: { en: 'Back', hi: 'वापस' },
        continue: { en: 'Continue', hi: 'आगे बढ़ें' },
        openMyChart: { en: 'Open My Plan', hi: 'मेरी योजना खोलें' },
        unknownBirthTime: { en: "I don't know my birth time", hi: 'मुझे अपना जन्म समय नहीं पता' },
        confirmReveal: { en: 'Yes, tell me!', hi: 'हाँ, बताइए!' },
        existingAccount: { en: 'Already have an account?', hi: 'क्या आपका पहले से खाता है?' },
        login: { en: 'Login', hi: 'प्रवेश करें' },
        welcomeBack: { en: 'Welcome Back!', hi: 'फिर से स्वागत है!' },
        loginPrompt: { en: 'Login with your WhatsApp number', hi: 'अपने WhatsApp नंबर से प्रवेश करें' },
        email: { en: 'WhatsApp Number', hi: 'WhatsApp नंबर' },
        password: { en: 'OTP', hi: 'OTP' },
        enterEmail: { en: 'Enter your WhatsApp number', hi: 'अपना WhatsApp नंबर दर्ज करें' },
        enterPassword: { en: 'Enter OTP', hi: 'OTP दर्ज करें' },
        backToReading: { en: 'Back to Reading!', hi: 'वापस जाएँ!' },
        loggingIn: { en: 'Logging in...', hi: 'प्रवेश हो रहा है...' },
        enterEmailPassword: { en: 'Please enter a valid WhatsApp number', hi: 'कृपया सही WhatsApp नंबर भरें' },
        invalidLogin: { en: 'Invalid OTP or phone number', hi: 'OTP या नंबर सही नहीं है' },
        welcomeBackToast: { en: 'Welcome back!', hi: 'फिर से स्वागत है!' },
        invalidValue: { en: 'Please enter a valid value', hi: 'कृपया सही जानकारी भरें' },
        missingRequired: { en: 'Please provide your name and birth date', hi: 'कृपया अपना नाम और जन्म तिथि भरें' }
    },

    steps: [
        {
            id: 'language',
            question: "Which language should I speak to you in?",
            questionHi: "Which language should I speak to you in?",
            field: 'language',
            type: 'select',
            options: [
                { value: 'en', label: 'English', labelHi: 'English' },
                { value: 'hi', label: 'हिन्दी (Hindi)', labelHi: 'हिन्दी (Hindi)' }
            ],
            validation: (value) => ['en', 'hi'].includes(value)
        },
        {
            id: 'welcome',
            question: "What name should I use for your guidance journal?",
            questionHi: "आपके मार्गदर्शन जर्नल में मैं आपको किस नाम से बुलाऊँ?",
            field: 'name',
            type: 'name',
            placeholder: 'First name',
            placeholderHi: 'पहला नाम',
            placeholder2: 'Last name',
            placeholder2Hi: 'उपनाम (सरनेम)',
            validation: (value) => value && value.length >= 2
        },
        {
            id: 'gender',
            question: (name) => `${name}, I want to speak to you correctly and personally. What's your gender?`,
            questionHi: (name) => `${name}, मैं आपसे सही और व्यक्तिगत तरीके से बात करना चाहती हूँ। आपका लिंग क्या है?`,
            field: 'gender',
            type: 'select',
            options: [
                { value: 'male', label: 'Male', labelHi: 'पुरुष' },
                { value: 'female', label: 'Female', labelHi: 'महिला' },
                { value: 'other', label: 'Other', labelHi: 'अन्य' }
            ],
            validation: (value) => ['male', 'female', 'other'].includes(value)
        },
        {
            id: 'birthDate',
            question: "This is where your visible timeline begins. What's your date of birth?",
            questionHi: "यहीं से आपकी समयरेखा शुरू होती है। आपकी जन्म तिथि क्या है?",
            field: 'birthDate',
            type: 'date',
            validation: (value) => value && value.length > 0
        },
        {
            id: 'birthTime',
            question: "Do you know your birth time? (Optional, used for personalized timing)",
            questionHi: "क्या आपको अपना जन्म समय पता है? (ज़रूरी नहीं, व्यक्तिगत समय-सुझाव के लिए)",
            field: 'birthTime',
            type: 'time',
            optional: true,
            showUnknown: true,
            validation: () => true
        },
        {
            id: 'birthPlace',
            question: "Where were you born? This helps personalize timing and location-aware guidance.",
            questionHi: "आप कहाँ पैदा हुए थे? इससे समय और स्थान आधारित मार्गदर्शन बेहतर होता है।",
            field: 'birthPlace',
            type: 'location',
            placeholder: 'Enter your birth city',
            placeholderHi: 'अपना जन्म शहर दर्ज करें',
            validation: (value) => value && value.length >= 2
        },
        {
            id: 'maritalStatus',
            question: "What's your current relationship status?",
            questionHi: "आपकी वर्तमान रिश्ते की स्थिति क्या है?",
            field: 'maritalStatus',
            type: 'select',
            options: [
                { value: 'married', label: 'Married', labelHi: 'विवाहित' },
                { value: 'unmarried', label: 'Unmarried', labelHi: 'अविवाहित' },
                { value: 'divorced', label: 'Divorced', labelHi: 'विवाह विच्छेद' }
            ],
            validation: (value) => ['married', 'unmarried', 'divorced'].includes(value)
        },
        {
            id: 'agentGender',
            question: "One last thing -choose your guide",
            questionHi: "आख़िरी बात -अपना मार्गदर्शक चुनिए",
            field: 'agentGender',
            type: 'agentSelect',
            options: [
                { value: 'female', label: 'Maya', labelHi: 'Maya' },
                { value: 'male', label: 'Moksh', labelHi: 'Moksh' }
            ],
            validation: (value) => ['male', 'female'].includes(value)
        }
    ],

    /**
     * Initialize onboarding
     */
    init() {
        // Warm-download the language-choice audio so it's already on-device
        // by the time the user reaches the language step. Uses HTTP cache via
        // a hidden <audio preload="auto">; idempotent across calls.
        this._prefetchLanguageChoiceAudio();

        // Check if funnel was already completed
        const funnelComplete = MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_COMPLETE);
        if (funnelComplete) {
            this.isComplete = true;
            console.log('📊 Funnel already completed');
            return;
        }

        // Restore saved funnel state
        const savedStep = MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_STEP);
        const savedData = MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_DATA);

        this.currentStep = savedStep || 0;
        this.userData = savedData || {};
        this.isComplete = false;

        console.log('📊 Funnel state restored:', {
            step: this.currentStep,
            stepName: this.steps[this.currentStep]?.id || 'unknown',
            userData: this.userData,
            isComplete: this.isComplete
        });
    },

    // UI is always English regardless of narration language choice.
    isHindiUI() {
        return false;
    },

    // Narration language choice (used only for spoken voice lines).
    isHindiNarration() {
        return (this.userData.language || MayaUtils.storage.get('maya_language') || 'en') === 'hi';
    },

    t(key) {
        const isHindi = this.isHindiUI();
        const entry = this.uiText[key];
        return entry ? (isHindi ? entry.hi : entry.en) : key;
    },

    getStepText(step, key) {
        const isHindi = this.isHindiUI();
        const fallback = step?.[key];
        const hindiValue = step?.[`${key}Hi`];

        if (typeof fallback === 'function' || typeof hindiValue === 'function') {
            const baseArg = this.userData.name || (isHindi ? 'मित्र' : 'Friend');
            const resolver = isHindi && typeof hindiValue === 'function'
                ? hindiValue
                : typeof fallback === 'function'
                    ? fallback
                    : null;
            return resolver ? resolver(baseArg) : (isHindi ? hindiValue : fallback);
        }

        return isHindi ? (hindiValue || fallback || '') : (fallback || hindiValue || '');
    },

    getStepOptions(step) {
        const isHindi = this.isHindiUI();
        return (step.options || []).map((opt) => ({
            ...opt,
            displayLabel: isHindi ? (opt.labelHi || opt.label) : (opt.label || opt.labelHi)
        }));
    },

    /**
     * Get funnel state summary
     */
    getFunnelState() {
        return {
            isComplete: MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_COMPLETE) || false,
            currentStep: MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_STEP) || 0,
            currentStepName: this.steps[MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_STEP) || 0]?.id || 'language',
            userData: MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_DATA) || {},
            totalSteps: this.totalSteps,
            progress: Math.round(((MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_STEP) || 0) / this.totalSteps) * 100)
        };
    },

    /**
     * Check if funnel needs to be shown
     */
    shouldShowFunnel() {
        const isAuthenticated = window.MayaAuth ? MayaAuth.isAuthenticated : false;
        const funnelComplete = MayaUtils.storage.get(this.STORAGE_KEYS.FUNNEL_COMPLETE);
        const profile = MayaUtils.storage.get('maya_profile');

        // ALWAYS show funnel if user is not logged in
        if (!isAuthenticated) {
            return true;
        }

        // For logged-in users, show funnel only if not complete or no profile
        return !funnelComplete || !profile || !profile.birthDate;
    },

    /**
     * Reset funnel (for testing or re-onboarding)
     */
    resetFunnel() {
        MayaUtils.storage.remove(this.STORAGE_KEYS.FUNNEL_STATE);
        MayaUtils.storage.remove(this.STORAGE_KEYS.FUNNEL_STEP);
        MayaUtils.storage.remove(this.STORAGE_KEYS.FUNNEL_DATA);
        MayaUtils.storage.remove(this.STORAGE_KEYS.FUNNEL_COMPLETE);
        MayaUtils.storage.remove('maya_profile');
        this.currentStep = 0;
        this.userData = {};
        this.isComplete = false;
        console.log('📊 Funnel reset complete');
    },

    /**
     * Start onboarding
     */
    async start() {
        console.log('📝 MayaOnboarding.start() called');
        this.init();
        console.log('📝 init done');

        // Show pre-funnel landing if user hasn't seen any step yet
        if (this.currentStep === 0 && !MayaUtils.storage.get('maya_landing_seen')) {
            await this.showLandingScreen();
        } else {
            this.showStep(this.currentStep);
        }
    },

    /**
     * Show pre-funnel landing screen (Screen 1)
    * Branded landing screen with headline, subtext, journal CTA, and voice line
     */
    async showLandingScreen() {
        const container = document.getElementById('onboardingContent');
        if (!container) return;

        // Hide progress bar on landing
        const progressBar = document.querySelector('.onboarding-progress');
        if (progressBar) progressBar.style.display = 'none';

        container.innerHTML = `
            <div class="maya-landing-screen">
                <div class="landing-visual">
                    <div class="landing-glow"></div>
                    <img src="/images/maya-logo.png" alt="Mayalogy" class="landing-logo-img">
                </div>

                <h2 class="landing-headline">Build Your Personal<br>Guidance Journal</h2>
                <p class="landing-subtext">Maya combines daily reflection, voice coaching, timing, and mindful routines into one practical plan.</p>

                <form class="ask-maya-field-wrap" id="landingAskMayaForm" autocomplete="off" novalidate>
                    <div class="ask-maya-glow"></div>
                    <span class="ask-maya-particle p1"></span>
                    <span class="ask-maya-particle p2"></span>
                    <span class="ask-maya-particle p3"></span>
                    <span class="ask-maya-particle p4"></span>
                    <span class="ask-maya-particle p5"></span>
                    <span class="ask-maya-particle p6"></span>
                    <input
                        type="text"
                        class="ask-maya-input"
                        id="landingAskMayaInput"
                        placeholder="Ask Maya anything…"
                        maxlength="240"
                        aria-label="Ask Maya anything"
                    />
                    <button type="submit" class="ask-maya-submit" id="landingAskMayaSubmit" aria-label="Ask Maya">
                        <i class="bi bi-arrow-right"></i>
                    </button>
                </form>

                <div class="landing-actions">
                    <button type="button" class="btn btn-primary btn-lg landing-begin-btn" id="landingBeginBtn">
                        Start My Journal
                    </button>
                    <button type="button" class="landing-login-btn" id="landingLoginBtn">
                        I already have an account
                    </button>
                </div>
            </div>
        `;

        // Speak landing voice line
        try {
            if (window.MayaVoice?.speak) {
                MayaVoice.speak("Let us build a daily guidance journal around what you want to understand and practice.");
            } else if (window.MayaFunnel?.speak) {
                MayaFunnel.speak("Let us build a daily guidance journal around what you want to understand and practice.");
            }
        } catch (e) {
            console.warn('Landing voice line failed:', e.message);
        }

        document.getElementById('landingBeginBtn').addEventListener('click', () => {
            MayaUtils.storage.set('maya_landing_seen', true);
            // Clear any prior ask-maya question so a normal start is unbiased
            try { MayaUtils.storage.remove('maya_user_question'); } catch (_e) { /* ignore */ }
            // Restore progress bar
            if (progressBar) progressBar.style.display = '';
            this.showStep(0);
        });

        const askForm = document.getElementById('landingAskMayaForm');
        const askInput = document.getElementById('landingAskMayaInput');
        if (askForm && askInput) {
            askForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const question = (askInput.value || '').trim();
                if (question.length < 3) {
                    askInput.focus();
                    askForm.classList.remove('ask-maya-shake');
                    // Trigger reflow to restart animation
                    void askForm.offsetWidth;
                    askForm.classList.add('ask-maya-shake');
                    return;
                }
                try {
                    MayaUtils.storage.set('maya_user_question', question);
                    MayaUtils.storage.set('maya_landing_seen', true);
                } catch (_e) { /* ignore */ }
                if (progressBar) progressBar.style.display = '';
                // Proceed through the same funnel (DOB, agent choice, etc.).
                // funnel.js will pick up maya_user_question and bias narration around it.
                this.showStep(0);
            });
        }

        document.getElementById('landingLoginBtn')?.addEventListener('click', () => {
            if (window.MayaApp?.showAuthModal) {
                MayaApp.showAuthModal('login');
            }
        });
    },

    /**
     * Show current step
     */
    showStep(stepIndex) {
        console.log('📝 showStep called with index:', stepIndex);

        const step = this.steps[stepIndex];
        if (!step) {
            console.error('📝 Invalid step index:', stepIndex, 'Total steps:', this.steps.length);
            return;
        }

        console.log('📝 Showing step:', stepIndex, step.id);

        const question = this.getStepText(step, 'question');

        console.log('📝 Question to show:', question);

        // Update UI
        this.updateProgressBar(stepIndex);
        this.showQuestion(question, step);

        // Play the pre-recorded language-choice voice prompt when the first
        // language-selection step appears. The asset is preloaded at app boot
        // via <link rel="preload"> + the Cache API, so playback is instant.
        if (step.id === 'language') {
            this._playLanguageChoicePrompt();
        }
    },

    /**
     * Eagerly download the language-choice prompt into the browser's HTTP
     * cache (and Cache Storage where available) so the audio is ready offline
     * before the user even reaches the language step.
     */
    _prefetchLanguageChoiceAudio() {
        if (this._languageChoicePrefetched) return;
        this._languageChoicePrefetched = true;
        const url = '/Language-choice.mp3';
        try {
            // 1) Cache Storage -survives reloads, available offline.
            if (typeof caches !== 'undefined' && caches.open) {
                caches.open('maya-audio-v1').then(async (cache) => {
                    const hit = await cache.match(url);
                    if (!hit) {
                        try {
                            await cache.add(url);
                            console.log('🎙️ Language-choice audio cached on device');
                        } catch (e) {
                            console.debug('Language-choice cache add failed:', e?.message);
                        }
                    }
                }).catch(() => { /* non-fatal */ });
            }
            // 2) HTTP cache primer via a hidden Audio element.
            const primer = new Audio(url);
            primer.preload = 'auto';
            primer.load();
            this._languageChoiceAudio = primer;
        } catch (e) {
            console.debug('Language-choice prefetch skipped:', e?.message);
        }
    },

    /**
     * Play the pre-recorded language selection prompt audio.
     * Falls back silently if the browser blocks autoplay or the file is missing.
     */
    _playLanguageChoicePrompt() {
        try {
            // Cancel any other voice currently speaking so the prompt isn't talked over.
            if (window.MayaVoice?.cancel) {
                try { MayaVoice.cancel(); } catch (_e) { /* non-fatal */ }
            }
            if (this._languageChoiceAudio) {
                try { this._languageChoiceAudio.pause(); } catch (_e) { /* non-fatal */ }
                this._languageChoiceAudio.currentTime = 0;
            } else {
                this._languageChoiceAudio = new Audio('/Language-choice.mp3');
                this._languageChoiceAudio.preload = 'auto';
            }
            const audio = this._languageChoiceAudio;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((err) => {
                    console.debug('Language-choice audio autoplay blocked:', err?.message);
                    // If autoplay is blocked, retry once on next user interaction.
                    const retry = () => {
                        document.removeEventListener('pointerdown', retry, true);
                        document.removeEventListener('keydown', retry, true);
                        audio.play().catch(() => { /* give up silently */ });
                    };
                    document.addEventListener('pointerdown', retry, { once: true, capture: true });
                    document.addEventListener('keydown', retry, { once: true, capture: true });
                });
            }
        } catch (e) {
            console.warn('Language-choice audio failed:', e?.message);
        }
    },

    /**
     * Update progress bar
     */
    updateProgressBar(stepIndex) {
        const progress = ((stepIndex + 1) / this.totalSteps) * 100;
        const progressBar = document.querySelector('.onboarding-progress-bar');
        const progressText = document.querySelector('.onboarding-progress-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${this.t('progress')} ${stepIndex + 1} ${this.t('of')} ${this.totalSteps}`;
        }
    },

    /**
     * Show question with input
     */
    showQuestion(question, step) {
        const container = document.getElementById('onboardingContent');
        if (!container) {
            console.error('Onboarding container not found! Looking for #onboardingContent');
            return;
        }

        if (this.locationOutsideHandler) {
            document.removeEventListener('pointerdown', this.locationOutsideHandler);
            this.locationOutsideHandler = null;
        }

        console.log('Showing question in container:', question);

        let inputHtml = '';
        const placeholder = this.getStepText(step, 'placeholder');
        const options = this.getStepOptions(step);

        switch (step.type) {
            case 'name':
                const placeholder2 = this.getStepText(step, 'placeholder2');
                inputHtml = `
                    <div class="onboarding-name-fields">
                        <input type="text" 
                               class="form-control form-control-lg onboarding-input onboarding-name-input" 
                               id="onboardingFirstName"
                               placeholder="${placeholder}"
                               autocomplete="given-name">
                        <input type="text" 
                               class="form-control form-control-lg onboarding-input onboarding-name-input" 
                               id="onboardingLastName"
                               placeholder="${placeholder2}"
                               autocomplete="family-name">
                    </div>
                `;
                break;

            case 'text':
                inputHtml = `
                    <input type="text" 
                           class="form-control form-control-lg onboarding-input" 
                           id="onboardingInput"
                           placeholder="${placeholder}"
                           autocomplete="off">
                `;
                break;

            case 'select':
                inputHtml = `
                    <div class="onboarding-options">
                        ${options.map(opt => `
                            <button type="button" 
                                    class="btn btn-outline-primary btn-lg onboarding-option" 
                                    data-value="${opt.value}">
                                ${opt.displayLabel}
                            </button>
                        `).join('')}
                    </div>
                `;
                break;

            case 'date':
                inputHtml = `
                    <input type="date" 
                           class="form-control form-control-lg onboarding-input" 
                           id="onboardingInput"
                           max="${new Date().toISOString().split('T')[0]}">
                `;
                break;

            case 'time':
                inputHtml = `
                    <input type="time" 
                           class="form-control form-control-lg onboarding-input" 
                           id="onboardingInput">
                    ${step.showUnknown ? `
                        <button type="button" class="btn btn-link mt-2 text-muted" id="unknownTimeBtn">
                            ${this.t('unknownBirthTime')}
                        </button>
                    ` : ''}
                `;
                break;

            case 'location':
                inputHtml = `
                    <div class="position-relative onboarding-location-wrapper">
                        <input type="text" 
                               class="form-control form-control-lg onboarding-input" 
                               id="onboardingInput"
                               placeholder="${placeholder}"
                               autocomplete="off">
                        <div id="locationSuggestions" class="location-suggestions"></div>
                    </div>
                `;
                break;

            case 'confirm':
                inputHtml = `
                    <div class="onboarding-options">
                        <button type="button" class="btn btn-primary btn-lg onboarding-confirm" data-value="yes">
                            ${this.t('confirmReveal')}
                        </button>
                    </div>
                `;
                break;

            case 'agentSelect':
                inputHtml = `
                    <div class="gc-slider-viewport">
                        <div class="gc-slider-track" id="gcSliderTrack">

                            <!-- Maya Card -->
                            <div class="gc-slide" data-value="female">
                                <div class="gc-card" style="--electric-border-color:#dd8448">
                                    <div class="gc-card-inner">
                                        <div class="gc-border-outer">
                                            <div class="gc-main-card"></div>
                                        </div>
                                        <div class="gc-glow-1"></div>
                                        <div class="gc-glow-2"></div>
                                    </div>
                                    <div class="gc-content">
                                        <div class="gc-content-top">
                                            <div class="gc-glass-badge">${this.isHindiUI() ? 'महिला मार्गदर्शक' : 'Female Guide'}</div>
                                            <div class="gc-avatar">
                                                <img src="images/maya-guide.png" alt="Maya" draggable="false"/>
                                            </div>
                                            <p class="gc-name">Maya</p>
                                        </div>
                                        <hr class="gc-divider"/>
                                        <div class="gc-content-bottom">
                                            <p class="gc-desc">${this.isHindiUI() ? 'आपकी दिव्य मार्गदर्शक' : 'Your divine guide'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Moksh Card -->
                            <div class="gc-slide" data-value="male">
                                <div class="gc-card" style="--electric-border-color:#6b8cce">
                                    <div class="gc-card-inner">
                                        <div class="gc-border-outer">
                                            <div class="gc-main-card"></div>
                                        </div>
                                        <div class="gc-glow-1"></div>
                                        <div class="gc-glow-2"></div>
                                    </div>
                                    <div class="gc-content">
                                        <div class="gc-content-top">
                                            <div class="gc-glass-badge">${this.isHindiUI() ? 'पुरुष मार्गदर्शक' : 'Male Guide'}</div>
                                            <div class="gc-avatar">
                                                <img src="images/moksh-guide.png" alt="Moksh" draggable="false"/>
                                            </div>
                                            <p class="gc-name">Moksh</p>
                                        </div>
                                        <hr class="gc-divider"/>
                                        <div class="gc-content-bottom">
                                            <p class="gc-desc">${this.isHindiUI() ? 'आपके वैदिक मार्गदर्शक' : 'Your vedic guide'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div class="gc-slider-dots">
                            <span class="gc-dot active" data-index="0"></span>
                            <span class="gc-dot" data-index="1"></span>
                        </div>
                        <button type="button" class="gc-choose-btn" id="gcChooseBtn">
                            ${this.isHindiUI() ? 'इन्हें चुनें' : 'Choose'}
                        </button>
                    </div>
                `;
                break;
        }

        container.innerHTML = `
            <div class="onboarding-question mb-4">
                <p class="lead">${question}</p>
            </div>
            <div class="onboarding-input-container">
                ${inputHtml}
            </div>
            <div class="onboarding-actions mt-4">
                ${this.currentStep > 0 ? `
                    <button type="button" class="btn btn-outline-secondary" id="prevStepBtn">
                        ${this.t('back')}
                    </button>
                ` : ''}
                ${step.type === 'text' || step.type === 'name' || step.type === 'date' || step.type === 'time' || step.type === 'location' ? `
                    <button type="button" class="btn btn-primary" id="nextStepBtn">
                        ${step.id === 'birthPlace' ? this.t('openMyChart') : this.t('continue')}
                    </button>
                ` : ''}
            </div>
            ${step.id === 'language' ? `
                <div class="existing-user-login mt-5 pt-4 border-top border-secondary">
                    <p class="text-muted mb-3">${this.t('existingAccount')}</p>
                    <button type="button" class="btn btn-outline-light" id="directLoginBtn">
                        ${this.t('login')}
                    </button>
                </div>
            ` : ''}
        `;

        // Add event listeners
        this.attachEventListeners(step);
    },

    /**
     * Attach event listeners
     */
    attachEventListeners(step) {
        // Next button
        const nextBtn = document.getElementById('nextStepBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.handleNext(step));
        }

        // Previous button
        const prevBtn = document.getElementById('prevStepBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.handlePrevious());
        }

        // Enter key on input
        const input = document.getElementById('onboardingInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleNext(step);
                }
            });

            // Focus input
            setTimeout(() => input.focus(), 100);
        }

        // Name fields - Enter key + focus
        const firstName = document.getElementById('onboardingFirstName');
        const lastName = document.getElementById('onboardingLastName');
        if (firstName && lastName) {
            firstName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') lastName.focus();
            });
            lastName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleNext(step);
            });
            setTimeout(() => firstName.focus(), 100);
        }

        // Select options
        const options = document.querySelectorAll('.onboarding-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.handleSelection(step, value);
            });
        });

        // Confirm button
        const confirmBtn = document.querySelector('.onboarding-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.completeOnboarding());
        }

        // Guide card slider -swipe to browse, button to select (mobile); click to select (desktop)
        const gcTrack = document.getElementById('gcSliderTrack');
        if (gcTrack) {
            const gcSlides = gcTrack.querySelectorAll('.gc-slide');
            const gcDots = document.querySelectorAll('.gc-dot');
            const gcBtn = document.getElementById('gcChooseBtn');
            const isDesktop = window.matchMedia('(min-width: 600px)').matches;
            let gcCurrent = 0;
            let gcStartX = 0, gcDragX = 0, gcDragging = false;
            let gcSubmitting = false;

            const gcBindTap = (element, handler) => {
                if (!element) return;

                let gcTouchHandled = false;

                element.addEventListener('touchend', (event) => {
                    gcTouchHandled = true;
                    event.preventDefault();
                    handler(event);

                    window.setTimeout(() => {
                        gcTouchHandled = false;
                    }, 400);
                }, { passive: false });

                element.addEventListener('click', (event) => {
                    if (gcTouchHandled) {
                        event.preventDefault();
                        return;
                    }

                    handler(event);
                });
            };

            const gcChooseLabel = (slide) => {
                if (!slide) {
                    return this.isHindiUI() ? 'इन्हें चुनें' : 'Choose';
                }

                const option = step.options?.find((entry) => entry.value === slide.dataset.value);
                if (!option) {
                    return this.isHindiUI() ? 'इन्हें चुनें' : 'Choose';
                }

                const label = this.isHindiUI() ? (option.labelHi || option.label) : (option.label || option.labelHi);
                return this.isHindiUI() ? `${label} चुनें` : `Choose ${label}`;
            };

            const gcRefreshUI = () => {
                gcSlides.forEach((slide, index) => {
                    slide.classList.toggle('is-active', index === gcCurrent);
                });

                gcDots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === gcCurrent);
                });

                if (gcBtn) {
                    const label = gcChooseLabel(gcSlides[gcCurrent]);
                    gcBtn.textContent = label;
                    gcBtn.setAttribute('aria-label', label);
                    gcBtn.classList.remove('gc-choose-btn--pressed');
                }
            };

            const gcCommitSelection = () => {
                const value = gcSlides[gcCurrent]?.dataset.value;
                if (!value || gcSubmitting) return;

                gcSubmitting = true;

                if (gcBtn) {
                    gcBtn.classList.add('gc-choose-btn--pressed');
                }

                window.setTimeout(() => {
                    // Surface any error from the selection handler so the user
                    // is never silently dropped onto the dashboard if the
                    // funnel handoff fails.
                    this.handleSelection(step, value).catch((err) => {
                        console.error('❌ Agent selection handoff failed:', err);
                        // Last-ditch retry: directly start the funnel.
                        try { this.completeOnboarding(); } catch (_) { /* noop */ }
                    });
                }, 180);
            };

            const gcGo = (idx) => {
                gcCurrent = Math.max(0, Math.min(idx, gcSlides.length - 1));
                gcTrack.style.transform = `translateX(-${gcCurrent * 100}%)`;
                gcRefreshUI();
            };

            if (isDesktop) {
                // Desktop: click card to select directly.
                gcSlides.forEach((slide, index) => {
                    gcBindTap(slide, () => {
                        gcGo(index);
                        gcCommitSelection();
                    });
                });
            } else {
                // Mobile: swipe to browse, or tap the visible card / CTA to select.
                let gcSwiped = false;
                gcTrack.addEventListener('touchstart', (e) => {
                    gcStartX = e.touches[0].clientX;
                    gcDragX = gcStartX;
                    gcDragging = true;
                    gcSwiped = false;
                    gcTrack.style.transition = 'none';
                }, { passive: true });
                gcTrack.addEventListener('touchmove', (e) => {
                    if (!gcDragging) return;
                    gcDragX = e.touches[0].clientX;
                    const diff = gcDragX - gcStartX;
                    if (Math.abs(diff) > 8) gcSwiped = true;
                    const base = -gcCurrent * gcTrack.parentElement.offsetWidth;
                    gcTrack.style.transform = `translateX(${base + diff}px)`;
                }, { passive: true });
                gcTrack.addEventListener('touchend', () => {
                    if (!gcDragging) return;
                    gcDragging = false;
                    gcTrack.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)';
                    const diff = gcDragX - gcStartX;
                    if (Math.abs(diff) > 50) {
                        gcGo(gcCurrent + (diff < 0 ? 1 : -1));
                    } else {
                        gcGo(gcCurrent);
                    }
                });

                // Dot tap
                gcDots.forEach((dot, i) => {
                    gcBindTap(dot, () => gcGo(i));
                });

                gcSlides.forEach((slide, index) => {
                    gcBindTap(slide, () => {
                        if (gcSwiped) return; // ignore taps that were actually swipes
                        if (index !== gcCurrent) {
                            gcGo(index);
                            return;
                        }
                        gcCommitSelection();
                    });
                });

                // Choose button -explicit mobile CTA for the currently visible guide.
                if (gcBtn) {
                    gcBindTap(gcBtn, () => gcCommitSelection());
                }

                gcGo(0);
            }

            gcRefreshUI();
        }

        // Unknown time button
        const unknownBtn = document.getElementById('unknownTimeBtn');
        if (unknownBtn) {
            unknownBtn.addEventListener('click', () => {
                this.handleSelection(step, 'unknown');
            });
        }

        // Location autocomplete
        if (step.type === 'location') {
            this.setupLocationAutocomplete();
        }

        // Direct login button (for existing users on language step)
        const directLoginBtn = document.getElementById('directLoginBtn');
        if (directLoginBtn) {
            directLoginBtn.addEventListener('click', () => this.showDirectLogin());
        }
    },

    /**
     * Show direct login page for existing users
     */
    showDirectLogin() {
        const container = document.getElementById('onboardingContent');
        if (!container) return;

        const isHindi = this.isHindiUI();
        const countries = [
            { code: '+91', iso: 'in', name: 'India' },
            { code: '+1', iso: 'us', name: 'USA' },
            { code: '+44', iso: 'gb', name: 'UK' },
            { code: '+971', iso: 'ae', name: 'UAE' },
            { code: '+61', iso: 'au', name: 'Australia' },
            { code: '+65', iso: 'sg', name: 'Singapore' },
            { code: '+60', iso: 'my', name: 'Malaysia' },
            { code: '+1', iso: 'ca', name: 'Canada' },
            { code: '+49', iso: 'de', name: 'Germany' },
            { code: '+33', iso: 'fr', name: 'France' },
            { code: '+55', iso: 'br', name: 'Brazil' },
            { code: '+92', iso: 'pk', name: 'Pakistan' },
            { code: '+880', iso: 'bd', name: 'Bangladesh' },
            { code: '+94', iso: 'lk', name: 'Sri Lanka' },
            { code: '+977', iso: 'np', name: 'Nepal' }
        ];
        const countryOptions = countries.map((country) =>
            `<option value="${country.code}" data-iso="${country.iso}" ${country.iso === 'in' ? 'selected' : ''}>${country.code} ${country.name}</option>`
        ).join('');

        container.innerHTML = `
            <div class="direct-login-container">
                <div class="onboarding-question mb-4">
                    <h4 class="mb-3"><i class="bi bi-whatsapp me-2"></i>${isHindi ? 'WhatsApp से लॉगिन करें' : 'Log in with WhatsApp'}</h4>
                    <p class="text-muted">${isHindi ? 'अपना WhatsApp नंबर डालें, OTP तुरंत भेजा जाएगा' : 'Enter your WhatsApp number and we will send an OTP instantly'}</p>
                </div>

                <div class="login-form">
                    <div class="mb-3">
                        <div class="phone-input-wrapper">
                            <div class="country-code-selector" id="ob-country-selector">
                                <span class="fi fi-in country-flag" id="ob-selected-flag"></span>
                                <span class="selected-code" id="ob-selected-code">+91</span>
                                <i class="bi bi-chevron-down country-chevron"></i>
                            </div>
                            <input type="tel" id="loginPhone" name="phone"
                                class="form-control form-control-lg phone-number-input"
                                placeholder="${this.t('enterEmail')}"
                                inputmode="numeric" maxlength="15"
                                pattern="[0-9]*"
                                autocomplete="tel"
                                aria-label="WhatsApp phone number"
                                data-form-type="other"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true">
                            <select id="ob-country-select" class="country-code-hidden-select" aria-label="Country code">
                                ${countryOptions}
                            </select>
                        </div>
                    </div>

                    <div id="loginError" class="alert alert-danger d-none mb-3"></div>

                    <button type="button" class="btn btn-primary btn-lg w-100 mb-3" id="loginSubmitBtn">
                        <i class="bi bi-whatsapp me-2"></i>${isHindi ? 'OTP भेजें' : 'Send OTP'}
                    </button>

                    <button type="button" class="btn btn-link text-muted" id="backToOnboardingBtn">
                        ${this.t('backToReading')}
                    </button>
                </div>
            </div>
        `;

        const selector = document.getElementById('ob-country-selector');
        const hiddenSelect = document.getElementById('ob-country-select');
        const selectedFlag = document.getElementById('ob-selected-flag');
        const selectedCode = document.getElementById('ob-selected-code');

        selector?.addEventListener('click', () => hiddenSelect?.focus());
        hiddenSelect?.addEventListener('change', () => {
            const option = hiddenSelect.options[hiddenSelect.selectedIndex];
            selectedCode.textContent = option.value;
            selectedFlag.className = `fi fi-${option.dataset.iso || 'in'} country-flag`;
        });

        document.getElementById('loginSubmitBtn')?.addEventListener('click', () => this.handleDirectLogin());
        document.getElementById('backToOnboardingBtn')?.addEventListener('click', () => this.showStep(0));
        document.getElementById('loginPhone')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleDirectLogin();
        });

        setTimeout(() => document.getElementById('loginPhone')?.focus(), 100);
    },

    /**
     * Handle direct login submission
     */
    async handleDirectLogin() {
        const phone = document.getElementById('loginPhone')?.value?.replace(/\D/g, '').trim();
        const countryCode = document.getElementById('ob-selected-code')?.textContent?.trim() || '+91';
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginSubmitBtn');
        const isHindi = this.isHindiUI();

        if (!phone || phone.length < 6) {
            if (errorDiv) {
                errorDiv.textContent = this.t('enterEmailPassword');
                errorDiv.classList.remove('d-none');
            }
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isHindi ? 'OTP भेजा जा रहा है...' : 'Sending OTP...'}`;
        }

        try {
            if (!window.MayaAuth?.sendOTP) throw new Error('Authentication system not available');
            const result = await MayaAuth.sendOTP(phone, countryCode);
            if (!result.success) throw new Error(result.error || 'OTP send failed');
            this._showOBOTPVerification(phone, countryCode);
        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = error.message || (isHindi ? 'OTP नहीं भेजा जा सका' : 'Could not send OTP');
                errorDiv.classList.remove('d-none');
            }

            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = `<i class="bi bi-whatsapp me-2"></i>${isHindi ? 'OTP भेजें' : 'Send OTP'}`;
            }
        }
    },

    /**
     * Show OTP verification for direct login
     */
    _showOBOTPVerification(phone, countryCode) {
        const container = document.getElementById('onboardingContent');
        if (!container) return;

        const isHindi = this.isHindiUI();
        container.innerHTML = `
            <div class="direct-login-container">
                <div class="onboarding-question mb-4">
                    <i class="bi bi-whatsapp otp-whatsapp-icon d-block mb-2"></i>
                    <h4 class="mb-2">${isHindi ? 'OTP दर्ज करें' : 'Enter OTP'}</h4>
                    <p class="text-muted small">${isHindi ? `${countryCode} ${phone} पर OTP भेजा गया` : `OTP sent to ${countryCode} ${phone}`}</p>
                </div>

                <div class="otp-input-group mb-3">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                </div>

                <div id="loginError" class="alert alert-danger d-none mb-3"></div>

                <button type="button" class="btn btn-primary btn-lg w-100 mb-3" id="ob-otp-verify-btn" disabled>
                    <i class="bi bi-unlock-fill me-2"></i>${isHindi ? 'पुष्टि करें' : 'Verify'}
                </button>

                <p class="text-center">
                    <a href="#" id="ob-resend-link" class="text-muted small me-3">${isHindi ? 'फिर से भेजें' : 'Resend OTP'}</a>
                    <a href="#" id="ob-change-num" class="text-muted small">${isHindi ? 'नंबर बदलें' : 'Change number'}</a>
                </p>
            </div>
        `;

        const digits = Array.from(document.querySelectorAll('.otp-digit'));
        const verifyBtn = document.getElementById('ob-otp-verify-btn');
        const errorDiv = document.getElementById('loginError');
        const getOTP = () => digits.map((digit) => digit.value).join('');
        const updateButton = () => {
            verifyBtn.disabled = getOTP().length < 6;
        };

        digits.forEach((input, index) => {
            input.addEventListener('input', () => {
                input.value = input.value.replace(/\D/g, '').slice(-1);
                if (input.value && index < digits.length - 1) digits[index + 1].focus();
                updateButton();
                if (getOTP().length === 6) verifyBtn.click();
            });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Backspace' && !input.value && index > 0) {
                    digits[index - 1].focus();
                }
            });

            input.addEventListener('paste', (event) => {
                event.preventDefault();
                const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                pasted.split('').forEach((char, charIndex) => {
                    if (digits[charIndex]) digits[charIndex].value = char;
                });
                updateButton();
                if (getOTP().length === 6) verifyBtn.click();
            });
        });

        digits[0]?.focus();

        verifyBtn.addEventListener('click', async () => {
            const otp = getOTP();
            if (otp.length < 6) return;

            verifyBtn.disabled = true;
            verifyBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isHindi ? 'जाँचा जा रहा है...' : 'Verifying...'}`;
            digits.forEach((digit) => { digit.disabled = true; });

            const result = await MayaAuth.verifyOTP(phone, countryCode, otp);
            if (!result.success) {
                digits.forEach((digit) => {
                    digit.value = '';
                    digit.disabled = false;
                });
                digits[0]?.focus();
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = `<i class="bi bi-unlock-fill me-2"></i>${isHindi ? 'पुष्टि करें' : 'Verify'}`;
                errorDiv.textContent = result.error || this.t('invalidLogin');
                errorDiv.classList.remove('d-none');
                return;
            }

            // Decide where to send the freshly-authenticated user.
            // - Returning user (profile + birthDate present): drop them into the app.
            // - New user (no profile yet): show a clean step-by-step form to
            //   collect their birth details, then drop them into the app —
            //   bypass the dramatic vocal funnel.
            const profile = MayaUtils.storage.get('maya_profile') || {};
            const remoteProfile = MayaAuth.currentUser || {};
            const hasProfile = !!(profile?.birthDate || remoteProfile?.birthDate);

            if (hasProfile) {
                MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_COMPLETE, true);
            }
            MayaUtils.toast.success(this.t('welcomeBackToast'));

            try {
                window.MayaApp?.onUserAuthenticated?.();
            } catch (err) {
                console.warn('onUserAuthenticated failed after OTP login:', err);
            }

            setTimeout(() => {
                if (hasProfile && window.MayaPages?.render) {
                    this._closeOnboardingModal();
                    const targetPage = MayaUtils.storage.get('maya_current_page') || 'home';
                    MayaPages.render(targetPage);
                } else {
                    // New user -collect required details via a simple form,
                    // then enter the app directly (no vocal funnel).
                    this.showPostLoginProfileForm();
                }
            }, 500);
        });

        document.getElementById('ob-resend-link')?.addEventListener('click', async (event) => {
            event.preventDefault();
            const result = await MayaAuth.sendOTP(phone, countryCode);
            if (result.success) {
                MayaUtils.toast.success(isHindi ? 'नया OTP भेजा गया' : 'New OTP sent');
                digits.forEach((digit) => {
                    digit.value = '';
                    digit.disabled = false;
                });
                digits[0]?.focus();
                updateButton();
            } else {
                MayaUtils.toast.error(result.error || (isHindi ? 'OTP नहीं भेजा जा सका' : 'Could not resend OTP'));
            }
        });

        document.getElementById('ob-change-num')?.addEventListener('click', (event) => {
            event.preventDefault();
            this.showDirectLogin();
        });
    },

    /**
     * Close the onboarding modal (used after a successful direct login).
     */
    _closeOnboardingModal() {
        const modalEl = document.getElementById('onboardingModal');
        if (!modalEl) return;
        try {
            const modal = (typeof bootstrap !== 'undefined' && bootstrap.Modal)
                ? bootstrap.Modal.getInstance(modalEl)
                : null;
            if (modal) {
                modal.hide();
            }
        } catch (err) {
            console.warn('Failed to hide onboarding modal cleanly:', err);
        }
        // Hard fallback in case bootstrap state is stale.
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
        this.isOpen = false;
        if (window.MayaApp) {
            window.MayaApp.isOnboardingActive = false;
        }
    },

    /**
     * Step-by-step profile form for users who logged in directly (via OTP)
     * but don't yet have a saved astrology profile. Collects the minimum
     * required birth details, then drops them into the app -no vocal funnel.
     */
    async showPostLoginProfileForm(startStep = 0) {
        // Make sure the onboarding modal/container is on screen.
        const modalEl = document.getElementById('onboardingModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) {
                    modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
                }
                modal.show();
            } catch (err) {
                console.warn('Could not open onboarding modal for profile form:', err);
            }
        }
        if (window.MayaApp) {
            window.MayaApp.isOnboardingActive = true;
        }

        // Hide the funnel-style progress bar; we draw our own.
        const progressBar = document.querySelector('.onboarding-progress');
        if (progressBar) progressBar.style.display = 'none';

        // Seed userData from any prior funnel data and the auth profile so
        // refreshing or revisiting doesn't lose what was already entered.
        const existingProfile = MayaUtils.storage.get('maya_profile') || {};
        const existingFunnel = MayaUtils.storage.get('funnel_data') || {};
        const authUser = (window.MayaAuth && MayaAuth.currentUser) || {};
        this.userData = {
            ...this.userData,
            ...existingFunnel,
            ...existingProfile,
            name: this.userData.name || existingProfile.name || existingFunnel.name || authUser.name || '',
            language: this.userData.language || existingProfile.language || MayaUtils.storage.get('maya_language') || 'en'
        };

        this._postLoginFormSteps = [
            'name', 'gender', 'birthDate', 'birthTime',
            'birthPlace', 'maritalStatus', 'agentGender'
        ];
        this._postLoginStep = Math.max(0, Math.min(startStep, this._postLoginFormSteps.length - 1));

        // Wait one tick so the modal DOM is mounted before we paint into it.
        await new Promise((resolve) => setTimeout(resolve, 50));
        this._renderPostLoginStep();
    },

    _renderPostLoginStep() {
        const container = document.getElementById('onboardingContent');
        if (!container) {
            console.warn('onboardingContent not found; cannot render profile form');
            return;
        }

        const isHindi = this.isHindiUI();
        const stepKey = this._postLoginFormSteps[this._postLoginStep];
        const stepIndex = this._postLoginStep;
        const totalSteps = this._postLoginFormSteps.length;
        const progressPct = Math.round(((stepIndex + 1) / totalSteps) * 100);

        const titles = {
            name: { en: 'What should we call you?', hi: 'हम आपको क्या कहकर बुलाएँ?' },
            gender: { en: 'Your gender', hi: 'आपका लिंग' },
            birthDate: { en: 'Your date of birth', hi: 'आपकी जन्म तिथि' },
            birthTime: { en: 'Your time of birth', hi: 'आपके जन्म का समय' },
            birthPlace: { en: 'Where were you born?', hi: 'आप कहाँ पैदा हुए थे?' },
            maritalStatus: { en: 'Relationship status', hi: 'वैवाहिक स्थिति' },
            agentGender: { en: 'Choose your guide', hi: 'अपना मार्गदर्शक चुनिए' }
        };
        const subtitles = {
            name: { en: 'A first name we can use across your readings.', hi: 'एक नाम जो आपकी रीडिंग में इस्तेमाल होगा।' },
            gender: { en: 'Helps tailor predictions to you.', hi: 'भविष्यवाणियाँ सटीक करने में मदद करता है।' },
            birthDate: { en: 'Required to build your chart.', hi: 'कुंडली बनाने के लिए आवश्यक।' },
            birthTime: { en: 'Optional, but improves accuracy.', hi: 'वैकल्पिक, पर सटीकता बढ़ाता है।' },
            birthPlace: { en: 'City of birth so we can compute the right ascendant.', hi: 'जन्म स्थान सही लग्न के लिए।' },
            maritalStatus: { en: 'Used in love and family insights.', hi: 'रिश्तों के विश्लेषण में मददगार।' },
            agentGender: { en: 'Pick the voice that will read your chart.', hi: 'वह आवाज़ चुनिए जो आपकी कुंडली पढ़ेगी।' }
        };

        const backLabel = isHindi ? 'वापस' : 'Back';
        const nextLabel = isHindi ? 'आगे बढ़ें' : 'Next';
        const finishLabel = isHindi ? 'पूरा करें' : 'Finish';
        const isLast = stepIndex === totalSteps - 1;

        container.innerHTML = `
            <div class="post-login-form-wrap" style="display:flex;flex-direction:column;gap:1.25rem;padding:0.75rem 0.25rem;width:100%;max-width:420px;margin:0 auto;box-sizing:border-box;">
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <small class="text-muted">${isHindi ? 'चरण' : 'Step'} ${stepIndex + 1} / ${totalSteps}</small>
                        <small class="text-muted">${progressPct}%</small>
                    </div>
                    <div class="progress" style="height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;">
                        <div class="progress-bar" role="progressbar" style="width:${progressPct}%;background:linear-gradient(90deg,#a48bff,#7c5cff);" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>

                <div>
                    <h4 class="mb-1">${titles[stepKey][isHindi ? 'hi' : 'en']}</h4>
                    <p class="text-muted mb-3" style="font-size:0.9rem;">${subtitles[stepKey][isHindi ? 'hi' : 'en']}</p>
                </div>

                <div id="plf-step-body" style="width:100%;min-height:120px;box-sizing:border-box;">${this._renderPostLoginField(stepKey, isHindi)}</div>

                <div id="plf-error" class="alert alert-danger d-none" style="margin-bottom:0;"></div>

                <div style="display:flex;gap:0.5rem;justify-content:space-between;margin-top:0.5rem;">
                    <button type="button" class="btn btn-outline-secondary" id="plf-back" ${stepIndex === 0 ? 'disabled' : ''}>
                        <i class="bi bi-arrow-left me-1"></i>${backLabel}
                    </button>
                    <button type="button" class="btn btn-primary" id="plf-next">
                        ${isLast ? finishLabel : nextLabel}${isLast ? '' : ' <i class="bi bi-arrow-right ms-1"></i>'}
                    </button>
                </div>
            </div>
        `;

        // Wire up controls for the current step.
        this._wirePostLoginStep(stepKey, isHindi);

        document.getElementById('plf-back')?.addEventListener('click', () => {
            if (this._postLoginStep > 0) {
                this._postLoginStep -= 1;
                this._renderPostLoginStep();
            }
        });
        document.getElementById('plf-next')?.addEventListener('click', () => this._handlePostLoginNext());
    },

    _renderPostLoginField(stepKey, isHindi) {
        const ud = this.userData || {};
        switch (stepKey) {
            case 'name': {
                // Split any previously-stored full name back into first + last
                // so editing a saved profile doesn't lose the surname.
                const fullName = (ud.firstName || ud.lastName)
                    ? `${ud.firstName || ''} ${ud.lastName || ''}`.trim()
                    : (ud.name || '');
                const parts = fullName.split(/\s+/).filter(Boolean);
                const firstName = ud.firstName || parts[0] || '';
                const lastName = ud.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : '');
                return `
                    <div style="display:flex;flex-direction:column;gap:0.75rem;width:100%;">
                        <input type="text" id="plf-firstName" class="form-control form-control-lg"
                            placeholder="${isHindi ? 'पहला नाम' : 'First name'}"
                            value="${firstName.replace(/"/g, '&quot;')}" autocomplete="given-name" style="width:100%;">
                        <input type="text" id="plf-lastName" class="form-control form-control-lg"
                            placeholder="${isHindi ? 'उपनाम (सरनेम)' : 'Last name'}"
                            value="${lastName.replace(/"/g, '&quot;')}" autocomplete="family-name" style="width:100%;">
                    </div>
                `;
            }
            case 'gender': {
                const opts = [
                    { v: 'male', en: 'Male', hi: 'पुरुष' },
                    { v: 'female', en: 'Female', hi: 'महिला' },
                    { v: 'other', en: 'Other', hi: 'अन्य' }
                ];
                return `<div class="d-grid gap-2">${opts.map((o) => `
                    <button type="button" class="btn ${ud.gender === o.v ? 'btn-primary' : 'btn-outline-light'} plf-choice" data-field="gender" data-value="${o.v}">
                        ${isHindi ? o.hi : o.en}
                    </button>`).join('')}</div>`;
            }
            case 'birthDate':
                return `
                    <input type="date" id="plf-birthDate" class="form-control form-control-lg"
                        value="${ud.birthDate || ''}" max="${new Date().toISOString().slice(0, 10)}">
                `;
            case 'birthTime':
                return `
                    <input type="time" id="plf-birthTime" class="form-control form-control-lg"
                        value="${ud.birthTime && ud.birthTime !== 'unknown' ? ud.birthTime : ''}">
                    <button type="button" class="btn btn-link mt-2 p-0" id="plf-unknownTime">
                        ${isHindi ? 'मुझे अपना जन्म समय नहीं पता' : "I don't know my birth time"}
                    </button>
                `;
            case 'birthPlace':
                return `
                    <div class="onboarding-location-wrapper position-relative">
                        <input type="text" id="onboardingInput" class="form-control form-control-lg"
                            placeholder="${isHindi ? 'जन्म का शहर' : 'Enter your birth city'}"
                            value="${(ud.birthPlace || '').replace(/"/g, '&quot;')}" autocomplete="off">
                        <div id="locationSuggestions" class="location-suggestions" style="display:none;position:absolute;left:0;right:0;top:100%;background:#1e1b2e;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;margin-top:0.25rem;max-height:240px;overflow-y:auto;z-index:1080;"></div>
                    </div>
                `;
            case 'maritalStatus': {
                const opts = [
                    { v: 'unmarried', en: 'Unmarried', hi: 'अविवाहित' },
                    { v: 'married', en: 'Married', hi: 'विवाहित' },
                    { v: 'divorced', en: 'Divorced', hi: 'विवाह विच्छेद' }
                ];
                return `<div class="d-grid gap-2">${opts.map((o) => `
                    <button type="button" class="btn ${ud.maritalStatus === o.v ? 'btn-primary' : 'btn-outline-light'} plf-choice" data-field="maritalStatus" data-value="${o.v}">
                        ${isHindi ? o.hi : o.en}
                    </button>`).join('')}</div>`;
            }
            case 'agentGender': {
                const opts = [
                    { v: 'female', en: 'Maya', desc: { en: 'Your divine guide', hi: 'आपकी दिव्य मार्गदर्शक' } },
                    { v: 'male', en: 'Moksh', desc: { en: 'Your vedic guide', hi: 'आपके वैदिक मार्गदर्शक' } }
                ];
                return `<div class="d-grid gap-2">${opts.map((o) => `
                    <button type="button" class="btn ${ud.agentGender === o.v ? 'btn-primary' : 'btn-outline-light'} plf-choice text-start" data-field="agentGender" data-value="${o.v}">
                        <div class="fw-bold">${o.en}</div>
                        <small class="text-muted">${isHindi ? o.desc.hi : o.desc.en}</small>
                    </button>`).join('')}</div>`;
            }
            default:
                return '';
        }
    },

    _wirePostLoginStep(stepKey, isHindi) {
        // Choice-button steps: clicking sets value and auto-advances after a short pause.
        document.querySelectorAll('#plf-step-body .plf-choice').forEach((btn) => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const value = btn.dataset.value;
                if (!field) return;
                this.userData[field] = value;
                document.querySelectorAll(`#plf-step-body .plf-choice[data-field="${field}"]`).forEach((el) => {
                    el.classList.remove('btn-primary');
                    el.classList.add('btn-outline-light');
                });
                btn.classList.remove('btn-outline-light');
                btn.classList.add('btn-primary');
                // Auto-advance for choice fields.
                setTimeout(() => this._handlePostLoginNext(), 220);
            });
        });

        if (stepKey === 'birthPlace') {
            try {
                this.setupLocationAutocomplete();
            } catch (err) {
                console.warn('Location autocomplete setup failed:', err);
            }
        }

        if (stepKey === 'birthTime') {
            document.getElementById('plf-unknownTime')?.addEventListener('click', () => {
                this.userData.birthTime = 'unknown';
                this._handlePostLoginNext();
            });
        }

        // Enter-to-advance for text/date/time inputs.
        const inputs = Array.from(document.querySelectorAll('#plf-step-body input'));
        if (inputs.length) {
            setTimeout(() => inputs[0].focus(), 120);
            inputs.forEach((inp) => {
                inp.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    // If there's another visible text input after this one,
                    // jump to it instead of advancing the step.
                    const idx = inputs.indexOf(inp);
                    const next = inputs.slice(idx + 1).find((el) => !el.disabled && el.type !== 'hidden');
                    if (next) {
                        next.focus();
                    } else {
                        this._handlePostLoginNext();
                    }
                });
            });
        }
    },

    _handlePostLoginNext() {
        const isHindi = this.isHindiUI();
        const stepKey = this._postLoginFormSteps[this._postLoginStep];
        const errorBox = document.getElementById('plf-error');
        const showError = (msg) => {
            if (errorBox) {
                errorBox.textContent = msg;
                errorBox.classList.remove('d-none');
            }
        };
        if (errorBox) errorBox.classList.add('d-none');

        switch (stepKey) {
            case 'name': {
                const first = (document.getElementById('plf-firstName')?.value || '').trim();
                const last = (document.getElementById('plf-lastName')?.value || '').trim();
                if (first.length < 2) {
                    showError(isHindi ? 'कृपया पहला नाम दर्ज करें' : 'Please enter your first name');
                    return;
                }
                if (last.length < 1) {
                    showError(isHindi ? 'कृपया उपनाम दर्ज करें' : 'Please enter your last name');
                    return;
                }
                this.userData.firstName = first;
                this.userData.lastName = last;
                this.userData.name = `${first} ${last}`.trim();
                break;
            }
            case 'gender':
                if (!this.userData.gender) {
                    showError(isHindi ? 'कृपया एक विकल्प चुनें' : 'Please choose an option');
                    return;
                }
                break;
            case 'birthDate': {
                const v = document.getElementById('plf-birthDate')?.value || '';
                if (!v) {
                    showError(isHindi ? 'कृपया जन्म तिथि चुनें' : 'Please pick your date of birth');
                    return;
                }
                this.userData.birthDate = v;
                break;
            }
            case 'birthTime': {
                const v = document.getElementById('plf-birthTime')?.value || '';
                if (!v && this.userData.birthTime !== 'unknown') {
                    // Birth time is optional; treat empty as unknown.
                    this.userData.birthTime = 'unknown';
                } else if (v) {
                    this.userData.birthTime = v;
                }
                break;
            }
            case 'birthPlace': {
                const v = (document.getElementById('onboardingInput')?.value || '').trim();
                if (v.length < 2) {
                    showError(isHindi ? 'कृपया जन्म स्थान दर्ज करें' : 'Please enter your birth city');
                    return;
                }
                this.userData.birthPlace = v;
                break;
            }
            case 'maritalStatus':
                if (!this.userData.maritalStatus) {
                    showError(isHindi ? 'कृपया एक विकल्प चुनें' : 'Please choose an option');
                    return;
                }
                break;
            case 'agentGender':
                if (!this.userData.agentGender) {
                    showError(isHindi ? 'कृपया एक मार्गदर्शक चुनें' : 'Please choose a guide');
                    return;
                }
                break;
        }

        if (this._postLoginStep < this._postLoginFormSteps.length - 1) {
            this._postLoginStep += 1;
            this._renderPostLoginStep();
        } else {
            this._submitPostLoginProfile();
        }
    },

    async _submitPostLoginProfile() {
        const isHindi = this.isHindiUI();
        const nextBtn = document.getElementById('plf-next');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isHindi ? 'सहेजा जा रहा है...' : 'Saving...'}`;
        }

        // Resolve the birth place to lat/lon if needed.
        let resolved = {
            birthPlace: this.userData.birthPlace || '',
            birthLat: Number.isFinite(Number(this.userData.birthLat)) ? Number(this.userData.birthLat) : null,
            birthLon: Number.isFinite(Number(this.userData.birthLon)) ? Number(this.userData.birthLon) : null
        };
        try {
            if (this.userData.birthPlace && window.MayaUtils?.location?.resolveBirthPlace) {
                resolved = await MayaUtils.location.resolveBirthPlace(this.userData.birthPlace, {
                    birthLat: this.userData.birthLat,
                    birthLon: this.userData.birthLon
                });
            }
        } catch (err) {
            console.warn('Birth place resolve failed:', err);
        }

        const language = this.userData.language || MayaUtils.storage.get('maya_language') || 'en';
        const profileData = {
            name: this.userData.name,
            firstName: this.userData.firstName || (this.userData.name || '').split(/\s+/)[0] || null,
            lastName: this.userData.lastName || (this.userData.name || '').split(/\s+/).slice(1).join(' ') || null,
            gender: this.userData.gender,
            agentGender: this.userData.agentGender || 'female',
            birthDate: this.userData.birthDate,
            birthTime: this.userData.birthTime || 'unknown',
            birthPlace: resolved.birthPlace || this.userData.birthPlace,
            birthLat: Number.isFinite(resolved.birthLat) ? resolved.birthLat : null,
            birthLon: Number.isFinite(resolved.birthLon) ? resolved.birthLon : null,
            maritalStatus: this.userData.maritalStatus,
            language
        };

        // Persist locally and remotely.
        const existingProfile = MayaUtils.storage.get('maya_profile') || {};
        const merged = { ...existingProfile, ...profileData };
        MayaUtils.storage.set('maya_profile', merged);
        MayaUtils.storage.set('funnel_data', { ...this.userData, ...profileData });
        MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_COMPLETE, true);
        MayaUtils.storage.set('funnel_complete', true);

        try {
            if (window.MayaAuth?.saveBirthDetails) {
                await MayaAuth.saveBirthDetails(merged);
            }
        } catch (err) {
            console.warn('saveBirthDetails failed (will rely on local copy):', err);
        }

        try {
            await window.MayaApp?.applyLanguagePreference?.(language, { force: true });
        } catch (err) {
            console.warn('applyLanguagePreference failed:', err);
        }

        // Reveal the app chrome and send the user straight to home -no vocal funnel.
        try {
            window.MayaApp?.onUserAuthenticated?.();
        } catch (err) {
            console.warn('onUserAuthenticated failed:', err);
        }

        this._closeOnboardingModal();
        MayaUtils.toast.success(isHindi ? 'स्वागत है!' : 'Welcome!');

        if (window.MayaPages?.render) {
            const targetPage = MayaUtils.storage.get('maya_current_page') || 'home';
            MayaPages.render(targetPage);
        }
    },

    /**
     * Setup location autocomplete
     */
    setupLocationAutocomplete() {
        const input = document.getElementById('onboardingInput');
        const suggestions = document.getElementById('locationSuggestions');
        const wrapper = input?.closest('.onboarding-location-wrapper');

        if (!input || !suggestions || !wrapper) return;

        let debounceTimer;
        const hideSuggestions = () => {
            suggestions.style.display = 'none';
        };
        const queueSearch = (query, delay = 300) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const results = await this.searchLocation(query);
                if (document.getElementById('onboardingInput') !== input) {
                    return;
                }
                this.showLocationSuggestions(results);
            }, delay);
        };

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.userData.birthLat = null;
            this.userData.birthLon = null;

            if (query.length < 2) {
                suggestions.innerHTML = '';
                hideSuggestions();
                return;
            }

            queueSearch(query);
        });

        input.addEventListener('focus', () => {
            const query = input.value.trim();
            if (query.length >= 2) {
                queueSearch(query, 0);
            }
        });

        // Close suggestions on tap outside the current location field.
        this.locationOutsideHandler = (e) => {
            const currentWrapper = document.querySelector('.onboarding-location-wrapper');
            const currentSuggestions = document.getElementById('locationSuggestions');

            if (!currentWrapper || !currentSuggestions) {
                document.removeEventListener('pointerdown', this.locationOutsideHandler);
                this.locationOutsideHandler = null;
                return;
            }

            if (!currentWrapper.contains(e.target)) {
                currentSuggestions.style.display = 'none';
            }
        };

        document.addEventListener('pointerdown', this.locationOutsideHandler);
    },

    /**
     * Search location using OpenStreetMap Nominatim
     */
    async searchLocation(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
                { cache: 'no-store' }
            );
            return await response.json();
        } catch (error) {
            console.error('Location search error:', error);
            return [];
        }
    },

    /**
     * Show location suggestions
     */
    showLocationSuggestions(results) {
        const suggestions = document.getElementById('locationSuggestions');
        if (!suggestions) return;

        if (results.length === 0) {
            suggestions.style.display = 'none';
            return;
        }

        suggestions.innerHTML = results.map(loc => `
            <div class="location-suggestion" 
                 data-name="${loc.display_name}"
                 data-lat="${loc.lat}"
                 data-lon="${loc.lon}">
                <i class="bi bi-geo-alt"></i>
                ${loc.display_name}
            </div>
        `).join('');

        suggestions.style.display = 'block';

        const selectSuggestion = (item) => {
            const input = document.getElementById('onboardingInput');
            if (input) {
                input.value = item.dataset.name;
                this.userData.birthLat = parseFloat(item.dataset.lat);
                this.userData.birthLon = parseFloat(item.dataset.lon);
            }
            suggestions.style.display = 'none';
        };

        // Use pointerdown as well as click so mobile taps select reliably before blur.
        suggestions.querySelectorAll('.location-suggestion').forEach(item => {
            const handleSelection = (event) => {
                event.preventDefault();
                event.stopPropagation();
                selectSuggestion(item);
            };

            item.addEventListener('pointerdown', handleSelection);
            item.addEventListener('click', handleSelection);
        });
    },

    /**
     * Handle next button
     */
    async handleNext(step) {
        let value;

        // Handle dual-field name input
        if (step.type === 'name') {
            const firstInput = document.getElementById('onboardingFirstName');
            const lastInput = document.getElementById('onboardingLastName');
            if (!firstInput || !lastInput) return;

            const firstName = firstInput.value.trim();
            const lastName = lastInput.value.trim();

            if (!firstName || firstName.length < 2) {
                MayaUtils.toast.error(this.t('invalidValue'));
                firstInput.classList.add('is-invalid');
                return;
            }
            if (!lastName || lastName.length < 2) {
                MayaUtils.toast.error(this.t('invalidValue'));
                lastInput.classList.add('is-invalid');
                return;
            }

            firstInput.classList.remove('is-invalid');
            lastInput.classList.remove('is-invalid');
            value = `${firstName} ${lastName}`;

            if (step.field) {
                this.userData[step.field] = value;
                this.userData.firstName = firstName;
                this.userData.lastName = lastName;
            }
        } else {
            const input = document.getElementById('onboardingInput');
            if (!input) return;

            value = input.value.trim();

            if (!step.optional && !step.validation(value)) {
                MayaUtils.toast.error(this.t('invalidValue'));
                input.classList.add('is-invalid');
                return;
            }

            input.classList.remove('is-invalid');

            if (step.field) {
                this.userData[step.field] = value;
            }
        }

        console.log('User data after step:', this.userData);

        this.saveProgress();

        // Speak ritual micro-confirmation before advancing
        await this.speakRitualLine(step.id);

        this.currentStep++;

        if (this.currentStep < this.steps.length) {
            this.showStep(this.currentStep);
        } else {
            this.completeOnboarding();
        }
    },

    /**
     * Speak a ritual micro-confirmation voice line after a step is completed.
     */
    async speakRitualLine(stepId) {
        const isHindi = this.isHindiNarration();
        const lines = this.ritualVoiceLines[stepId];
        if (!lines) return;
        let line;
        if (isHindi) {
            // Use gender-specific Hindi variant if available
            const isMale = this._isGuideMale();
            line = (!isMale && lines.hi_f) ? lines.hi_f : lines.hi;
        } else {
            line = lines.en;
        }
        if (!line) return;
        try {
            if (window.MayaVoice?.speak) {
                await MayaVoice.speak(line);
            } else if (window.MayaFunnel?.speak) {
                await MayaFunnel.speak(line);
            }
        } catch (e) {
            console.warn('Ritual voice line failed:', e.message);
        }
    },

    /**
     * Check if guide is male
     */
    _isGuideMale() {
        const profile = window.MayaUtils?.storage?.get('maya_profile') || {};
        const funnelData = window.MayaUtils?.storage?.get('funnel_data') || {};
        const g = this.userData?.agentGender || profile.agentGender || funnelData.agentGender || 'female';
        return g === 'male';
    },

    /**
     * Handle selection
     */
    async handleSelection(step, value) {
        if (step.field) {
            this.userData[step.field] = value;

            // If language was selected, save it immediately
            if (step.field === 'language') {
                MayaUtils.storage.set('maya_language', value);
                this.userData.language = value;
                if (window.MayaApp?.applyLanguagePreference) {
                    void MayaApp.applyLanguagePreference(value, { force: true });
                } else if (window.MayaI18n?.setLanguage) {
                    void MayaI18n.setLanguage(value, { force: true });
                }
                console.log('Language set to:', value);
            }

            // If the guide gender was selected, swap the voice immediately so the
            // very next ritual line (and the funnel) use the chosen voice.
            if (step.field === 'agentGender') {
                if (window.MayaVoice?.setAgentGender) {
                    MayaVoice.setAgentGender(value);
                }
                const existingProfile = MayaUtils.storage.get('maya_profile') || {};
                existingProfile.agentGender = value;
                MayaUtils.storage.set('maya_profile', existingProfile);
                console.log('Guide gender set to:', value);
            }
        }

        console.log('User data after selection:', this.userData);

        this.saveProgress();

        // Speak ritual micro-confirmation before advancing
        await this.speakRitualLine(step.id);

        this.currentStep++;

        if (this.currentStep < this.steps.length) {
            this.showStep(this.currentStep);
        } else {
            this.completeOnboarding();
        }
    },

    /**
     * Handle previous button
     */
    handlePrevious() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    },

    /**
     * Save progress
     */
    saveProgress() {
        // Save current step
        MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_STEP, this.currentStep);

        // Save user data collected so far
        MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_DATA, this.userData);

        // Save overall state
        MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_STATE, {
            step: this.currentStep,
            stepName: this.steps[this.currentStep]?.id || 'unknown',
            userData: this.userData,
            lastUpdated: new Date().toISOString()
        });

        console.log('📊 Funnel progress saved:', {
            step: this.currentStep,
            stepName: this.steps[this.currentStep]?.id
        });
    },

    /**
     * Complete onboarding with graceful error handling
     */
    async completeOnboarding() {
        console.log('🎉 Completing onboarding...');
        this.isComplete = true;

        // CRITICAL: clear any stale funnel_complete flag from a previous session.
        // If this is true, MayaApp.checkUserState routes the user straight to
        // the dashboard the next render, which is exactly the "after agent
        // selection it goes to dashboard" bug. The vocal funnel is the next
        // step -only mark funnel_complete=true when it actually finishes.
        try {
            MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_COMPLETE, false);
            MayaUtils.storage.set('funnel_complete', false);
            MayaUtils.storage.remove?.('funnel_complete');
        } catch (_) { /* noop */ }

        // Force-show the MAYA overlay immediately so the dashboard underneath
        // can never flash through while the funnel boots.
        const _overlay = document.getElementById('maya-overlay');
        if (_overlay) {
            _overlay.classList.add('show');
            _overlay.classList.add('funnel-mode');
        }

        // Validate required data
        if (!this.userData.name || !this.userData.birthDate) {
            console.error('❌ Missing required data:', this.userData);
            MayaUtils.toast.error(this.t('missingRequired'));
            return;
        }

        let resolvedBirthPlace = {
            birthPlace: this.userData.birthPlace || '',
            birthLat: Number.isFinite(Number(this.userData.birthLat)) ? Number(this.userData.birthLat) : null,
            birthLon: Number.isFinite(Number(this.userData.birthLon)) ? Number(this.userData.birthLon) : null
        };

        if (this.userData.birthPlace) {
            resolvedBirthPlace = await MayaUtils.location.resolveBirthPlace(this.userData.birthPlace, {
                birthLat: this.userData.birthLat,
                birthLon: this.userData.birthLon
            });
            this.userData.birthPlace = resolvedBirthPlace.birthPlace || this.userData.birthPlace;
            this.userData.birthLat = Number.isFinite(resolvedBirthPlace.birthLat) ? resolvedBirthPlace.birthLat : null;
            this.userData.birthLon = Number.isFinite(resolvedBirthPlace.birthLon) ? resolvedBirthPlace.birthLon : null;
        }

        // Save birth details
        const profileData = {
            name: this.userData.name,
            gender: this.userData.gender,
            agentGender: this.userData.agentGender || 'female',
            birthDate: this.userData.birthDate,
            birthTime: this.userData.birthTime || 'unknown',
            birthPlace: resolvedBirthPlace.birthPlace || this.userData.birthPlace,
            birthLat: Number.isFinite(resolvedBirthPlace.birthLat) ? resolvedBirthPlace.birthLat : null,
            birthLon: Number.isFinite(resolvedBirthPlace.birthLon) ? resolvedBirthPlace.birthLon : null,
            language: this.userData.language || MayaUtils.storage.get('maya_language') || 'en'
        };

        // Save to local storage
        MayaUtils.storage.set('maya_profile', profileData);
        MayaUtils.storage.set('funnel_data', this.userData);

        console.log('✅ Profile saved:', profileData);

        // Close modal with better handling
        const modalEl = document.getElementById('onboardingModal');
        if (modalEl) {
            try {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) {
                    console.log('🚪 Closing modal...');
                    modal.hide();

                    // Wait for modal to fully hide
                    await new Promise(resolve => {
                        modalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
                        // Timeout fallback in case event doesn't fire
                        setTimeout(resolve, 500);
                    });
                }
            } catch (e) {
                console.warn('Modal close error:', e);
                // Force hide
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        }

        // Start the storytelling funnel with animated calculations
        console.log('🚀 Preparing to start storytelling funnel...');

        // Small delay to ensure modal is fully closed
        await MayaUtils.sleep(300);

        if (window.MayaFunnel) {
            // Use retry wrapper for funnel initialization
            try {
                await MayaUtils.retry(
                    async (attempt) => {
                        console.log(`🎭 Initializing MayaFunnel${attempt > 1 ? ` (attempt ${attempt})` : ''}...`);
                        MayaFunnel.init(this.userData);

                        // Prompt user to enable audio (required for autoplay)
                        console.log('🔊 Requesting audio permission...');
                        try {
                            await this.requestAudioPermission();
                        } catch (audioError) {
                            console.warn('⚠️ Audio permission skipped:', audioError.message);
                            // Continue without audio - not a critical error
                        }

                        // Start the funnel experience
                        console.log('🎭 Starting MayaFunnel.start()...');
                        await MayaFunnel.start();
                    },
                    {
                        maxRetries: 3,
                        baseDelay: 1000,
                        label: 'Funnel initialization',
                        retryCondition: (error) => {
                            // Don't retry user-cancelled actions
                            if (error.message?.includes('cancelled') || error.message?.includes('denied')) {
                                return false;
                            }
                            return true;
                        },
                        onRetry: (attempt, max, error) => {
                            console.log(`🔄 Retrying funnel (${attempt}/${max}): ${error.message}`);
                        }
                    }
                );
            } catch (error) {
                console.error('❌ Funnel start failed after retries:', error);
                // Fallback to simple reading
                if (window.MayaApp?.showInitialReading) {
                    console.log('📖 Falling back to simple reading...');
                    MayaApp.showInitialReading();
                }
            }
        } else {
            console.error('❌ MayaFunnel not found! Falling back to simple reading...');
            if (window.MayaApp?.showInitialReading) {
                MayaApp.showInitialReading();
            }
        }
    },

    /**
     * Request audio permission from user - Directly enable voice without modal
     */
    async requestAudioPermission() {
        // Skip the modal - directly enable voice
        if (window.MayaVoice) {
            MayaVoice.setMute(false);
            await MayaVoice.resumeContext();
        }
        return Promise.resolve(true);
    },

    /**
     * Check if onboarding is needed
     */
    isNeeded() {
        return this.shouldShowFunnel();
    },

    /**
     * Get collected data
     */
    getData() {
        return this.userData;
    },

    /**
     * Debug helper - log current funnel state
     */
    debugState() {
        const state = this.getFunnelState();
        console.log('📊 ====== FUNNEL STATE DEBUG ======');
        console.log('Complete:', state.isComplete);
        console.log('Current Step:', state.currentStep + 1, '/', state.totalSteps);
        console.log('Step Name:', state.currentStepName);
        console.log('Progress:', state.progress + '%');
        console.log('User Data:', state.userData);
        console.log('📊 ==================================');
        return state;
    }
};

// Make globally available
window.MayaOnboarding = MayaOnboarding;
