/**
 * MAYA - Onboarding Module
 * User Onboarding Flow - Collects details then shows AI reading
 */

const MayaOnboarding = {
    currentStep: 0,
    totalSteps: 6,
    userData: {},
    isComplete: false,
    locationOutsideHandler: null,

    // Ritual voice lines spoken at each onboarding step (micro-confirmations)
    ritualVoiceLines: {
        language: {
            en: null, // No voice before language is chosen
            hi: null
        },
        welcome: {
            en: "Good. Let me note that down.",
            hi: "अच्छा। लिख लेती हूँ।"
        },
        gender: {
            en: "Noted.",
            hi: "ठीक है।"
        },
        birthDate: {
            en: "This is where your visible timeline begins.",
            hi: "यहीं से आपकी timeline शुरू होती है।"
        },
        birthTime: {
            en: "This helps me see your chart more clearly.",
            hi: "इससे chart और साफ़ दिखेगा।"
        },
        birthPlace: {
            en: "I have what I need. Let me begin.",
            hi: "जो चाहिए था, मिल गया। शुरू करती हूँ।"
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
        openMyChart: { en: 'Open My Chart', hi: 'मेरी कुंडली खोलें' },
        unknownBirthTime: { en: "I don't know my birth time", hi: 'मुझे अपना जन्म समय नहीं पता' },
        confirmReveal: { en: 'Yes, tell me!', hi: 'हाँ, बताइए!' },
        existingAccount: { en: 'Already have an account?', hi: 'क्या आपका पहले से अकाउंट है?' },
        login: { en: 'Login', hi: 'लॉगिन' },
        welcomeBack: { en: 'Welcome Back!', hi: 'फिर से स्वागत है!' },
        loginPrompt: { en: 'Login with your email and password', hi: 'अपना email और password डालकर लॉगिन करें' },
        email: { en: 'Email', hi: 'ईमेल' },
        password: { en: 'Password', hi: 'पासवर्ड' },
        enterEmail: { en: 'Enter your email', hi: 'अपना ईमेल दर्ज करें' },
        enterPassword: { en: 'Enter your password', hi: 'अपना पासवर्ड दर्ज करें' },
        backToReading: { en: 'Back to Reading!', hi: 'रीडिंग पर वापस जाएँ!' },
        loggingIn: { en: 'Logging in...', hi: 'लॉगिन हो रहा है...' },
        enterEmailPassword: { en: 'Please enter both email and password', hi: 'कृपया email और password दोनों भरें' },
        invalidLogin: { en: 'Invalid email or password', hi: 'ईमेल या पासवर्ड सही नहीं है' },
        welcomeBackToast: { en: 'Welcome back!', hi: 'फिर से स्वागत है!' },
        invalidValue: { en: 'Please enter a valid value', hi: 'कृपया सही जानकारी भरें' },
        missingRequired: { en: 'Please provide your name and birth date', hi: 'कृपया अपना नाम और जन्म तिथि भरें' }
    },

    steps: [
        {
            id: 'language',
            question: "Welcome! Please choose your preferred language",
            questionHi: "स्वागत है! कृपया अपनी पसंदीदा भाषा चुनें",
            field: 'language',
            type: 'select',
            options: [
                { value: 'en', label: 'English', labelHi: 'English' },
                { value: 'hi', label: 'हिन्दी (Hindi)', labelHi: 'हिन्दी' }
            ],
            validation: (value) => ['en', 'hi'].includes(value)
        },
        {
            id: 'welcome',
            question: "What name should I use when I read your chart?",
            questionHi: "मैं आपकी chart पढ़ते समय आपको किस नाम से बुलाऊँ?",
            field: 'name',
            type: 'text',
            placeholder: 'Enter your name',
            placeholderHi: 'अपना नाम दर्ज करें',
            validation: (value) => value && value.length >= 2
        },
        {
            id: 'gender',
            question: (name) => `${name}, I want to speak to you correctly and personally. What's your gender?`,
            questionHi: (name) => `${name}, मैं आपसे सही और personal तरीके से बात करना चाहती हूँ। आपका लिंग क्या है?`,
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
            questionHi: "यहीं से आपकी timeline शुरू होती है। आपकी जन्म तिथि क्या है?",
            field: 'birthDate',
            type: 'date',
            validation: (value) => value && value.length > 0
        },
        {
            id: 'birthTime',
            question: "Do you know your birth time? (Optional but helps accuracy)",
            questionHi: "क्या आपको अपना जन्म समय पता है? (वैकल्पिक)",
            field: 'birthTime',
            type: 'time',
            optional: true,
            showUnknown: true,
            validation: () => true
        },
        {
            id: 'birthPlace',
            question: "Place matters. It changes how the sky was arranged around you. Where were you born?",
            questionHi: "जगह मायने रखती है। इससे आसमान की स्थिति बदलती है। आप कहाँ पैदा हुए थे?",
            field: 'birthPlace',
            type: 'location',
            placeholder: 'Enter your birth city',
            placeholderHi: 'अपना जन्म शहर दर्ज करें',
            validation: (value) => value && value.length >= 2
        }
    ],

    /**
     * Initialize onboarding
     */
    init() {
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

    isHindiUI() {
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
     * Cosmic gradient, headline, subtext, "Begin My Reading" button, voice line
     */
    async showLandingScreen() {
        const container = document.getElementById('onboardingContent');
        if (!container) return;

        // Hide progress bar on landing
        const progressBar = document.querySelector('.onboarding-progress');
        if (progressBar) progressBar.style.display = 'none';

        container.innerHTML = `
            <div class="maya-landing-screen text-center">
                <div class="landing-visual">
                    <div class="landing-glow"></div>
                    <img src="/images/maya-logo.png" alt="Mayalogy" class="landing-logo-img">
                </div>
                <h2 class="landing-headline">Open Your Personal<br>Astrology Reading</h2>
                <p class="landing-subtext">Your birth chart holds patterns most people never see.<br>MAYA will read yours — live, in her own voice.</p>
                <button type="button" class="btn btn-primary btn-lg landing-begin-btn" id="landingBeginBtn">
                    Begin My Reading
                </button>
            </div>
        `;

        // Speak landing voice line
        try {
            if (window.MayaVoice?.speak) {
                MayaVoice.speak("Your birth chart holds patterns most people never see. Let me read yours.");
            } else if (window.MayaFunnel?.speak) {
                MayaFunnel.speak("Your birth chart holds patterns most people never see. Let me read yours.");
            }
        } catch (e) {
            console.warn('Landing voice line failed:', e.message);
        }

        document.getElementById('landingBeginBtn').addEventListener('click', () => {
            MayaUtils.storage.set('maya_landing_seen', true);
            // Restore progress bar
            if (progressBar) progressBar.style.display = '';
            this.showStep(0);
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
                ${step.type === 'text' || step.type === 'date' || step.type === 'time' || step.type === 'location' ? `
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

        container.innerHTML = `
            <div class="direct-login-container">
                <div class="onboarding-question mb-4">
                    <h4 class="mb-3"><i class="bi bi-person-check me-2"></i>${this.t('welcomeBack')}</h4>
                    <p class="text-muted">${this.t('loginPrompt')}</p>
                </div>
                
                <div class="login-form">
                    <div class="mb-3">
                        <label class="form-label">${this.t('email')}</label>
                        <input type="email" 
                               class="form-control form-control-lg" 
                               id="loginEmail"
                               placeholder="${this.t('enterEmail')}"
                               autocomplete="email">
                    </div>
                    <div class="mb-4">
                        <label class="form-label">${this.t('password')}</label>
                        <input type="password" 
                               class="form-control form-control-lg" 
                               id="loginPassword"
                               placeholder="${this.t('enterPassword')}"
                               autocomplete="current-password">
                    </div>
                    
                    <div id="loginError" class="alert alert-danger d-none mb-3"></div>
                    
                    <button type="button" class="btn btn-primary btn-lg w-100 mb-3" id="loginSubmitBtn">
                        ${this.t('login')}
                    </button>
                    
                    <button type="button" class="btn btn-link text-muted" id="backToOnboardingBtn">
                        ${this.t('backToReading')}
                    </button>
                </div>
            </div>
        `;

        // Add login event listeners
        const loginBtn = document.getElementById('loginSubmitBtn');
        const backBtn = document.getElementById('backToOnboardingBtn');
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.handleDirectLogin());
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => this.showStep(0));
        }

        // Enter key to login
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleDirectLogin();
            });
        }

        // Focus email input
        if (emailInput) {
            setTimeout(() => emailInput.focus(), 100);
        }
    },

    /**
     * Handle direct login submission
     */
    async handleDirectLogin() {
        const email = document.getElementById('loginEmail')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginSubmitBtn');

        // Validate
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = this.t('enterEmailPassword');
                errorDiv.classList.remove('d-none');
            }
            return;
        }

        // Show loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${this.t('loggingIn')}`;
        }

        try {
            // Use Firebase Auth
            if (window.MayaAuth && MayaAuth.login) {
                const result = await MayaAuth.login(email, password);
                
                if (result.success) {
                    console.log('✅ Direct login successful');
                    
                    // Load user data
                    if (result.userData) {
                        this.userData = result.userData;
                        MayaUtils.storage.set('maya_user_data', result.userData);
                    }
                    
                    // Mark funnel as complete
                    MayaUtils.storage.set(this.STORAGE_KEYS.FUNNEL_COMPLETE, true);
                    
                    // Show success message
                    MayaUtils.toast.success(this.t('welcomeBackToast'));
                    
                    // Always reload page after successful login to refresh session
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    throw new Error(result.error || 'Login failed');
                }
            } else {
                throw new Error('Authentication system not available');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (errorDiv) {
                errorDiv.textContent = error.message || this.t('invalidLogin');
                errorDiv.classList.remove('d-none');
            }
            
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = this.t('login');
            }
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
        const input = document.getElementById('onboardingInput');
        if (!input) return;

        const value = input.value.trim();
        
        if (!step.optional && !step.validation(value)) {
            MayaUtils.toast.error(this.t('invalidValue'));
            input.classList.add('is-invalid');
            return;
        }

        input.classList.remove('is-invalid');
        
        if (step.field) {
            this.userData[step.field] = value;
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
        const isHindi = this.isHindiUI();
        const lines = this.ritualVoiceLines[stepId];
        if (!lines) return;
        const line = isHindi ? lines.hi : lines.en;
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
