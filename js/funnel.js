/**
 * MAYA - Storytelling Funnel Module
 * Voice-First Experience with Animated Calculations & Flowing Narrative
 */

console.log('🔧 funnel.js loading...');

const MayaFunnel = {
    isActive: false,
    isPaused: false,
    pausePromiseResolve: null,
    currentPhase: 0,
    userData: null,
    calculations: null,
    firstName: '',
    hasRevealedTeaser: false,
    isUserLoggedIn: false,
    emailGateShown: false,
    emailSubmissionInProgress: false,
    teaserGateNarrated: false,
    spokenNarrations: [],
    authRequestId: 0,
    authPromptedFields: new Set(),
    backgroundMusic: null,
    calculationOverlay: null,
    kundliChart: null,
    personalization: null,

    // --- New funnel redesign state ---
    validationResponses: [],
    emotionalAnchor: null,
    strongestAccurateHit: null,
    chosenDeepDiveTopic: null,
    unresolvedThread: null,
    returnHookType: null,
    chapterOrder: null,

    stageTiming: {
        introSettle: 600,
        calculationLeadIn: 180,
        calcStepDelay: 500,
        letterDelay: 100,
        vowelDelay: 130,
        kundliSignalDelay: 240,
        kundliInsightDelay: 200,
        stageSettle: 600,
        validationSettle: 500,
        suspensePause: 800
    },
    
    // Funnel phases
    PHASES: {
        CALCULATING: 'calculating',
        VALIDATION: 'validation',
        TEASER_REVEAL: 'teaser_reveal',
        SUSPENSE_BRIDGE: 'suspense_bridge',
        EMAIL_GATE: 'email_gate',
        LOGIN_OR_REGISTER: 'login_or_register',
        DEEP_REVEAL: 'deep_reveal',
        COMPLETE: 'complete'
    },

    // ============================================================
    //  PROGRESS STAGES for gamification meter
    // ============================================================
    PROGRESS_STAGES: [
        { key: 'chart_opened', en: 'Chart', hi: 'चार्ट' },
        { key: 'first_impression', en: 'Impression', hi: 'झलक' },
        { key: 'kundli', en: 'Kundli', hi: 'कुंडली' },
        { key: 'life_path', en: 'Life Path', hi: 'जीवन पथ' },
        { key: 'destiny', en: 'Destiny', hi: 'भाग्य' },
        { key: 'soul_urge', en: 'Soul', hi: 'आत्मा' },
        { key: 'accuracy_hit', en: 'Accuracy', hi: 'सटीकता' },
        { key: 'deep_patterns', en: 'Patterns', hi: 'पैटर्न' },
        { key: 'full_reading', en: 'Complete', hi: 'पूर्ण' }
    ],
    currentProgressIndex: -1,

    // ============================================================
    //  SESSION MEMORY — tracks user reactions for personalization
    // ============================================================
    sessionMemory: {
        validationAnswers: {},
        emotionalAnchors: [],
        strongHits: [],
        userQuestions: [],
        unresolvedTopics: [],
        progressUnlocks: []
    },

    resetSessionMemory() {
        this.sessionMemory = {
            validationAnswers: {},
            emotionalAnchors: [],
            strongHits: [],
            userQuestions: [],
            unresolvedTopics: [],
            progressUnlocks: []
        };
    },

    recordValidation(question, answer) {
        this.sessionMemory.validationAnswers[question] = answer;
        if (answer === 'yes') {
            this.sessionMemory.strongHits.push(question);
        }
    },

    recordEmotionalAnchor(text) {
        if (text && text.length > 5) {
            this.sessionMemory.emotionalAnchors.push({ text, timestamp: Date.now() });
        }
    },

    buildMemoryContext(isHindi) {
        const mem = this.sessionMemory;
        const parts = [];
        if (mem.strongHits.length) {
            const hits = mem.strongHits.slice(-3).join('; ');
            parts.push(isHindi
                ? `User ने इन बातों पर "हाँ" कहा: ${hits}`
                : `User confirmed these as accurate: ${hits}`);
        }
        if (mem.emotionalAnchors.length) {
            const anchors = mem.emotionalAnchors.slice(-2).map(a => a.text).join('; ');
            parts.push(isHindi
                ? `User ने ये emotional reactions दिए: ${anchors}`
                : `User showed emotional response to: ${anchors}`);
        }
        if (Object.keys(mem.validationAnswers).length) {
            const negative = Object.entries(mem.validationAnswers)
                .filter(([, v]) => v === 'no')
                .map(([q]) => q)
                .slice(-2);
            if (negative.length) {
                parts.push(isHindi
                    ? `User ने इन बातों से असहमति जताई: ${negative.join('; ')}`
                    : `User disagreed with: ${negative.join('; ')}`);
            }
        }
        return parts.length ? parts.join('\n') : '';
    },

    // ============================================================
    //  MAYA VOICE LIBRARY — 100+ bilingual personality lines
    // ============================================================
    voiceLibrary: {
        opening: {
            en: [
                "Welcome. I'm opening your chart now.",
                "I'm glad you came here today.",
                "Let's take this step slowly.",
                "This reading begins with your birth pattern.",
                "I'll start with what stands out the most.",
                "Every chart begins by revealing one quiet truth.",
                "Your chart is already showing a strong signal.",
                "Let me look at the structure carefully.",
                "I want to confirm something before I say it clearly.",
                "I'm tracing the shape of your chart now."
            ],
            hi: [
                "स्वागत है। मैं अभी आपकी chart खोल रही हूँ।",
                "अच्छा हुआ कि आप आज यहाँ आए।",
                "चलिए, ये कदम धीरे-धीरे उठाते हैं।",
                "ये reading आपके birth pattern से शुरू होती है।",
                "सबसे पहले वो बताऊँगी जो सबसे ज्यादा दिख रहा है।",
                "हर chart एक शांत सच्चाई से खुलती है।",
                "आपकी chart में पहले से एक मजबूत signal दिख रहा है।",
                "ध्यान से structure देख रही हूँ।",
                "पहले कुछ confirm कर लूँ, फिर साफ बताऊँगी।",
                "आपकी chart का ढाँचा trace कर रही हूँ।"
            ]
        },
        analysis: {
            en: [
                "I'm checking the balance between your planets.",
                "There is a repeating pattern here.",
                "One part of your chart is louder than the rest.",
                "I'm looking closely at your timing cycles.",
                "There's an emotional pattern underneath this.",
                "This part of the chart usually speaks about inner life.",
                "I'm confirming the relationship indicators.",
                "I'm checking how your personal numbers interact.",
                "This combination is interesting.",
                "I want to see how these patterns connect."
            ],
            hi: [
                "आपके ग्रहों का balance check कर रही हूँ।",
                "यहाँ एक repeating pattern है।",
                "आपकी chart का एक हिस्सा बाकियों से ज्यादा बोल रहा है।",
                "आपके timing cycles ध्यान से देख रही हूँ।",
                "इसके नीचे एक emotional pattern छिपा है।",
                "chart का ये हिस्सा अंदर की जिंदगी के बारे में बोलता है।",
                "relationship indicators confirm कर रही हूँ।",
                "देख रही हूँ कि आपके numbers कैसे interact करते हैं।",
                "ये combination दिलचस्प है।",
                "देखती हूँ ये patterns कैसे जुड़ते हैं।"
            ]
        },
        emotionalMirror: {
            en: [
                "You tend to hold more inside than people realize.",
                "You often appear steady even when you are thinking deeply.",
                "There is strength in your chart, but it comes with pressure.",
                "You understand people quickly, but trust takes longer.",
                "You sometimes carry responsibility quietly.",
                "Part of you wants clarity before you move forward.",
                "You are not someone who makes careless decisions.",
                "You notice more than you usually say.",
                "You probably think about things long after conversations end.",
                "Your chart shows a thoughtful nature."
            ],
            hi: [
                "आप अंदर बहुत कुछ रखते हैं जो लोगों को पता नहीं होता।",
                "बाहर से stable लगते हैं, पर अंदर गहरी सोच चलती रहती है।",
                "आपकी chart में ताकत है, पर उसके साथ pressure भी है।",
                "लोगों को जल्दी समझ लेते हैं, पर भरोसा करने में वक्त लगता है।",
                "आप चुपचाप जिम्मेदारी उठा लेते हैं।",
                "आगे बढ़ने से पहले आप clarity चाहते हैं।",
                "आप लापरवाही से फैसले नहीं लेते।",
                "आप जितना बोलते हैं उससे ज्यादा notice करते हैं।",
                "बात खत्म होने के बाद भी आप उसके बारे में सोचते रहते हैं।",
                "आपकी chart एक सोचने-समझने वाला स्वभाव दिखाती है।"
            ]
        },
        validation: {
            en: [
                "I want to check something with you.",
                "Tell me honestly.",
                "Does this feel familiar to you?",
                "Have you experienced something like this?",
                "Does this pattern show up in your life?",
                "I'd like your honest answer here.",
                "Only you would know this part.",
                "Does this feel accurate?",
                "Think about this carefully.",
                "Does this match your experience?"
            ],
            hi: [
                "एक बात confirm करना चाहती हूँ।",
                "ईमानदारी से बताइए।",
                "क्या ये सुनकर कुछ familiar लगा?",
                "क्या कभी ऐसा महसूस हुआ है?",
                "क्या ये pattern आपकी जिंदगी में दिखता है?",
                "यहाँ आपका सच्चा जवाब चाहिए।",
                "ये हिस्सा सिर्फ आप जानते हैं।",
                "क्या ये सही लग रहा है?",
                "इसके बारे में ध्यान से सोचिए।",
                "क्या ये आपके experience से मिलता है?"
            ]
        },
        suspense: {
            en: [
                "There is one more thing I want to look at.",
                "This part of your chart becomes more personal.",
                "I want to say this carefully.",
                "There's something unusual here.",
                "This pattern doesn't appear in every chart.",
                "I don't want to rush this explanation.",
                "This is where your chart becomes more specific.",
                "I'm noticing something that deserves attention.",
                "There's another layer I haven't opened yet.",
                "This part connects to something important."
            ],
            hi: [
                "एक और चीज है जो देखना चाहती हूँ।",
                "chart का ये हिस्सा ज्यादा personal हो जाता है।",
                "ये ध्यान से कहना चाहती हूँ।",
                "यहाँ कुछ unusual दिख रहा है।",
                "ये pattern हर chart में नहीं आता।",
                "इसे जल्दबाजी में नहीं समझाना चाहती।",
                "यहाँ से आपकी chart ज्यादा specific हो जाती है।",
                "कुछ ऐसा notice हुआ है जो ध्यान माँगता है।",
                "एक और layer है जो अभी खोली नहीं है।",
                "ये हिस्सा किसी अहम चीज से जुड़ा है।"
            ]
        },
        kundliTransition: {
            en: [
                "Based on everything you've shared with me, I now have what I need. Let me plot your kundli and we'll go deep into it together.",
                "I have your details. Now let me map your birth chart — once the kundli forms, I'll walk you through what it reveals.",
                "Good. With this information and what I already know, let me trace your kundli now. We'll read it together, step by step.",
                "Thank you. Now I'm going to form your kundli from this data. Once it's ready, I'll tell you exactly what I see.",
                "I have everything I need. Let me plot your birth chart now — the real reading begins once the kundli takes shape.",
                "Now comes the real part. Let me form your kundli — and then I'll show you what your chart actually says about you."
            ],
            hi: [
                "आपने जो जानकारी दी है, उसके आधार पर अब मेरे पास सब कुछ है। चलिए, आपकी कुंडली बनाते हैं और उसे साथ मिलकर पढ़ते हैं।",
                "अच्छा, अब मेरे पास आपकी details हैं। पहले कुंडली बनती है — फिर मैं बताऊँगी कि उसमें क्या दिख रहा है।",
                "ठीक है। आपकी जानकारी और MAYA के ज्ञान को मिलाकर, अब मैं आपकी कुंडली trace कर रही हूँ। साथ मिलकर पढ़ेंगे।",
                "शुक्रिया। अब इस data से आपकी जन्म कुंडली बना रही हूँ। जैसे ही तैयार होगी, मैं बताऊँगी कि क्या दिखता है।",
                "मेरे पास सब कुछ है जो चाहिए। अब कुंडली बनाती हूँ — असली reading कुंडली बनने के बाद शुरू होगी।",
                "अब असली हिस्सा आता है। पहले कुंडली बनती है — फिर मैं बताऊँगी कि आपकी chart आपके बारे में क्या कहती है।"
            ]
        },
        relationship: {
            en: [
                "Your emotional world is deeper than most people see.",
                "You tend to attract people who need stability.",
                "You sometimes give more than you receive.",
                "You value loyalty more than excitement.",
                "You are careful with your heart.",
                "You may need emotional clarity before you trust.",
                "You notice emotional shifts quickly.",
                "You are not someone who takes relationships lightly.",
                "Your chart suggests strong emotional awareness.",
                "You look for sincerity more than drama."
            ],
            hi: [
                "आपकी भावनाओं की दुनिया लोगों की सोच से गहरी है।",
                "आपकी तरफ ऐसे लोग आते हैं जिन्हें stability चाहिए।",
                "आप कभी-कभी उतना वापस नहीं पाते जितना देते हैं।",
                "आपके लिए loyalty, excitement से ज्यादा जरूरी है।",
                "आप अपना दिल सँभालकर रखते हैं।",
                "भरोसा करने से पहले आपको emotional clarity चाहिए।",
                "आप emotional बदलाव जल्दी भाँप लेते हैं।",
                "आप रिश्तों को हल्के में नहीं लेते।",
                "आपकी chart मजबूत emotional awareness दिखाती है।",
                "आप drama नहीं, सच्चाई ढूँढते हैं।"
            ]
        },
        career: {
            en: [
                "You work best when your thinking is respected.",
                "You are not designed for meaningless work.",
                "Your strengths grow when you are trusted.",
                "You often notice solutions before others do.",
                "You prefer depth over superficial activity.",
                "You are capable of shaping outcomes.",
                "You function well when there is purpose.",
                "You may feel restless when your work lacks meaning.",
                "You think in patterns, not fragments.",
                "Your direction becomes clearer when you trust your instincts."
            ],
            hi: [
                "जब आपकी सोच की कदर होती है, तो आप सबसे अच्छा काम करते हैं।",
                "आप बेमतलब के काम के लिए नहीं बने।",
                "जब भरोसा मिलता है तो आपकी ताकत बढ़ती है।",
                "आप अक्सर दूसरों से पहले solution देख लेते हैं।",
                "आप ऊपरी activity से ज्यादा गहराई पसंद करते हैं।",
                "आप नतीजे बदलने की क्षमता रखते हैं।",
                "जब मकसद हो तो आप बेहतरीन काम करते हैं।",
                "जब काम में meaning न हो तो बेचैनी होती है।",
                "आप टुकड़ों में नहीं, patterns में सोचते हैं।",
                "जब अपनी instinct पर भरोसा करते हैं तो रास्ता साफ दिखता है।"
            ]
        },
        timing: {
            en: [
                "There are a few timing windows ahead.",
                "One period looks especially active.",
                "I would pay attention to this phase.",
                "This window could bring movement.",
                "Your chart shows a shift approaching.",
                "There may be an opportunity in this cycle.",
                "This period deserves patience.",
                "This timing could change direction.",
                "One window looks stronger than the rest.",
                "I want you to watch this moment closely."
            ],
            hi: [
                "आगे कुछ timing windows दिख रही हैं।",
                "एक दौर खास तौर पर active लग रहा है।",
                "इस phase पर ध्यान देना चाहिए।",
                "ये window कुछ हरकत ला सकती है।",
                "आपकी chart में एक shift करीब आ रहा है।",
                "इस cycle में कोई मौका हो सकता है।",
                "इस दौर में सब्र चाहिए।",
                "ये timing direction बदल सकती है।",
                "एक window बाकी सबसे मजबूत दिख रही है।",
                "इस पल को ध्यान से देखिए।"
            ]
        },
        warning: {
            en: [
                "I want to say this carefully.",
                "There is one pattern that deserves attention.",
                "This is not a mistake, but it is a pattern.",
                "You may recognize this when it happens.",
                "This part of your chart asks for awareness.",
                "It's better to see this early.",
                "This pattern repeats when pressure rises.",
                "I would approach this situation slowly.",
                "Pay attention to your reactions here.",
                "Awareness is your advantage."
            ],
            hi: [
                "ये ध्यान से कहना चाहती हूँ।",
                "एक pattern है जो ध्यान माँगता है।",
                "ये गलती नहीं है, पर ये एक pattern है।",
                "जब ऐसा हो तो शायद आप पहचान जाएँ।",
                "chart का ये हिस्सा जागरूकता माँगता है।",
                "इसे जल्दी देख लेना बेहतर है।",
                "जब pressure बढ़ता है तो ये pattern लौटता है।",
                "इस situation में धीरे-धीरे चलिए।",
                "यहाँ अपने reactions पर ध्यान दीजिए।",
                "जागरूकता आपकी सबसे बड़ी ताकत है।"
            ]
        },
        completion: {
            en: [
                "You've now heard the deeper layer.",
                "Let the reading settle for a moment.",
                "This is not fate. It's a pattern.",
                "Patterns can be changed.",
                "I'm here if you want to explore more.",
                "We can go deeper whenever you want.",
                "There are still parts of your chart we can explore.",
                "You can ask me anything.",
                "This reading belongs to you now.",
                "I'll stay here with you."
            ],
            hi: [
                "अब आपने गहरी layer सुन ली है।",
                "reading को एक पल settle होने दीजिए।",
                "ये भाग्य नहीं है। ये एक pattern है।",
                "patterns बदले जा सकते हैं।",
                "और जानना चाहें तो मैं यहाँ हूँ।",
                "जब चाहें, और गहराई में जा सकते हैं।",
                "आपकी chart के कुछ हिस्से अभी बाकी हैं।",
                "कुछ भी पूछ सकते हैं।",
                "ये reading अब आपकी है।",
                "मैं आपके साथ यहाँ हूँ।"
            ]
        }
    },

    /**
     * Pick a random line from the voice library for a given category.
     */
    getVoiceLine(category) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const pool = this.voiceLibrary[category];
        if (!pool) return '';
        const lines = isHindi ? pool.hi : pool.en;
        return lines[Math.floor(Math.random() * lines.length)];
    },

    /**
     * Toggle pause state for funnel
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('maya-pause-btn');
        
        if (this.isPaused) {
            // Pause
            console.log('⏸️ Funnel paused');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
                pauseBtn.classList.add('paused');
                pauseBtn.dataset.i18nTitle = 'Resume';
                pauseBtn.dataset.i18nTitleOriginal = 'Resume';
                pauseBtn.title = window.MayaI18n?.t('Resume') || 'Resume';
            }
            // Stop current voice
            if (window.MayaVoice) {
                MayaVoice.stop();
            }
            // Pause background music
            if (this.backgroundMusic) {
                this.backgroundMusic.pause();
            }
        } else {
            // Resume
            console.log('▶️ Funnel resumed');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                pauseBtn.classList.remove('paused');
                pauseBtn.dataset.i18nTitle = 'Pause';
                pauseBtn.dataset.i18nTitleOriginal = 'Pause';
                pauseBtn.title = window.MayaI18n?.t('Pause') || 'Pause';
            }
            // Resume background music
            if (this.backgroundMusic) {
                this.backgroundMusic.play().catch(() => {});
            }
            // Resolve the pause promise to continue execution
            if (this.pausePromiseResolve) {
                this.pausePromiseResolve();
                this.pausePromiseResolve = null;
            }
        }
    },

    /**
     * Wait if paused - call this in the funnel flow to respect pause state
     */
    async waitIfPaused() {
        if (this.isPaused) {
            await new Promise(resolve => {
                this.pausePromiseResolve = resolve;
            });
        }
    },

    async waitForNarrationToFinish(bufferMs = 140) {
        if (window.MayaVoice?.waitForSpeechComplete) {
            await MayaVoice.waitForSpeechComplete();
        }

        let guard = 0;
        while ((window.MayaVoice?.isPlaying || window.MayaVoice?.speakingLock) && guard < 80) {
            await MayaUtils.sleep(60);
            guard++;
        }

        if (bufferMs > 0) {
            await MayaUtils.sleep(bufferMs);
        }
    },

    /**
     * Show/hide funnel controls
     */
    showFunnelControls(show = true) {
        const controls = document.getElementById('maya-funnel-controls');
        if (controls) {
            controls.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Initialize pause button event listener
     */
    initPauseButton() {
        const pauseBtn = document.getElementById('maya-pause-btn');
        if (pauseBtn && !pauseBtn._bound) {
            pauseBtn._bound = true;
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
    },

    /**
     * Extract first name from full name
     */
    getFirstName(fullName) {
        if (!fullName) return 'friend';
        const parts = fullName.trim().split(/\s+/);
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    },


    /**
     * Build short prediction hooks from the 12-month personal month chart.
     * These items are fed into AI prompts to create a more “specific” and hooking narrative.
     */
    buildPredictionItems() {
        const lang = MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';

        const reduce = (n) => {
            // Use MayaNumerology reducer if available for consistency
            if (window.MayaNumerology?.reduceNumber) return MayaNumerology.reduceNumber(n);
            // Basic reducer fallback (keeps master numbers)
            const keepMaster = (x) => [11, 22, 33].includes(x);
            let x = Math.abs(parseInt(n, 10) || 0);
            while (x > 9 && !keepMaster(x)) {
                x = String(x).split('').reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
            }
            return x || 1;
        };

        const personalYear = this.calculations?.personalYear || 1;
        const months = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            return { month, pm: reduce(personalYear + month) };
        });

        // Prefer “strong” and “caution” months based on common numerology timing logic
        const strongOrder = [8, 1, 6, 3];
        const cautionOrder = [4, 7, 9, 5];

        const strong = strongOrder
            .map((n) => months.find((m) => m.pm === n))
            .find(Boolean);

        const caution = cautionOrder
            .map((n) => months.find((m) => m.pm === n))
            .find(Boolean);

        const monthName = (m) => {
            const d = new Date();
            d.setMonth(m - 1);
            return d.toLocaleString(isHindi ? 'hi-IN' : 'en-US', { month: 'long' });
        };

        const theme = (pm) => {
            const mapEn = {
                1: 'fresh start / new move',
                2: 'relationships / partnerships',
                3: 'visibility / communication',
                4: 'pressure + foundations',
                5: 'change / surprise turn',
                6: 'home / responsibility',
                7: 'inner work / clarity',
                8: 'money + power window',
                9: 'closure / release',
                11: 'intuition spike',
                22: 'build something big',
                33: 'service / leadership'
            };
            const mapHi = {
                1: 'नई शुरुआत या नया कदम',
                2: 'रिश्ते और साझेदारी',
                3: 'दिखाई देना और संवाद',
                4: 'दबाव और नींव मजबूत करना',
                5: 'बदलाव और अप्रत्याशित मोड़',
                6: 'घर और जिम्मेदारी',
                7: 'भीतरी स्पष्टता',
                8: 'धन और प्रभाव का मजबूत समय',
                9: 'समापन और मुक्त होना',
                11: 'अंतर्ज्ञान का उभार',
                22: 'बड़ा निर्माण',
                33: 'सेवा और नेतृत्व'
            };
            return (isHindi ? mapHi : mapEn)[pm] || (isHindi ? 'एक बड़ा संकेत' : 'a major signal');
        };

        const items = [];
        if (strong) {
            items.push({
                kind: 'strong',
                month: strong.month,
                monthName: monthName(strong.month),
                pm: strong.pm,
                theme: theme(strong.pm),
                summary: isHindi
                    ? `${monthName(strong.month)} के आस-पास आपकी ऊर्जा ${strong.pm} जैसी होगी - ${theme(strong.pm)}.`
                    : `Around ${monthName(strong.month)} your chart hits a ${strong.pm} phase - ${theme(strong.pm)}.`
            });
        }
        if (caution) {
            items.push({
                kind: 'caution',
                month: caution.month,
                monthName: monthName(caution.month),
                pm: caution.pm,
                theme: theme(caution.pm),
                summary: isHindi
                    ? `${monthName(caution.month)} के आस-पास सावधानी रखिए - ${caution.pm} चरण में ${theme(caution.pm)} उभर सकता है।`
                    : `Watch ${monthName(caution.month)} - a ${caution.pm} phase (${theme(caution.pm)}).`
            });
        }

        return items.slice(0, 3);
    },

    /**
     * Resolve the best usable birth time for chart calculations.
     */
    getResolvedBirthTime() {
        return this.userData?.birthTime && this.userData.birthTime !== 'unknown'
            ? this.userData.birthTime
            : '12:00';
    },

    /**
     * Whether the user supplied an exact birth time.
     */
    hasExactBirthTime() {
        return !!(this.userData?.birthTime && this.userData.birthTime !== 'unknown');
    },

    hasBirthCoordinates() {
        return Number.isFinite(Number(this.userData?.birthLat))
            && Number.isFinite(Number(this.userData?.birthLon));
    },

    hasReliableAscendant() {
        return this.hasExactBirthTime() && this.hasBirthCoordinates();
    },

    /**
     * Short label for the birth place.
     */
    getBirthPlaceShort() {
        return (this.userData?.birthPlace || '')
            .split(',')[0]
            .trim();
    },

    /**
     * Pick the narrative lens that should dominate the funnel for this user.
     */
    selectNarrativeLens(chartSummary = {}) {
        if (chartSummary?.currentDasha?.planet === 'Saturn') return 'discipline, overdue foundations, and karmic cleanup';
        if (chartSummary?.currentDasha?.planet === 'Jupiter') return 'expansion, wise opportunities, and a bigger life chapter';
        if ([2, 6, 9].includes(this.calculations?.soulUrge)) return 'relationships, vulnerability, and emotional honesty';
        if ([7, 11, 33].includes(this.calculations?.lifePath) || chartSummary?.dominantElement === 'Water') return 'inner clarity, intuition, and the private self';
        if ([1, 5, 8].includes(this.calculations?.personalYear)) return 'change, decisive action, and momentum';
        return 'identity, direction, and the next chapter';
    },

    /**
     * Build a chart-aware personalization profile from collected funnel data.
     */
    buildPersonalizationProfile() {
        const canUseAscendant = this.hasReliableAscendant();
        const birthContext = {
            birthTime: this.hasExactBirthTime() ? this.userData.birthTime : 'unknown',
            birthPlace: this.userData.birthPlace || '',
            birthLat: this.userData.birthLat,
            birthLon: this.userData.birthLon
        };
        const western = window.MayaAstrology?.getWesternZodiac?.(this.userData.birthDate) || {};
        const vedic = window.MayaAstrology?.getVedicZodiac?.(this.userData.birthDate, birthContext) || {};
        const kundliChart = window.MayaKundli?.generateBirthChart
            ? MayaKundli.generateBirthChart(
                this.userData.birthDate,
                birthContext.birthTime,
                birthContext.birthPlace || 'Unknown',
                birthContext.birthLat,
                birthContext.birthLon
            )
            : null;
        const chartSummary = kundliChart && window.MayaKundli?.summarizeBirthChart
            ? MayaKundli.summarizeBirthChart(kundliChart)
            : { planetGroups: [], yogaNames: [], highlights: [] };
        const highlights = Array.isArray(chartSummary.highlights)
            ? chartSummary.highlights.filter((item) => canUseAscendant || !/ascendant/i.test(String(item || '')))
            : [];

        this.kundliChart = kundliChart;

        return {
            ...chartSummary,
            ascendant: canUseAscendant ? chartSummary.ascendant : null,
            western,
            vedic,
            highlights,
            birthPlaceShort: this.getBirthPlaceShort(),
            hasExactBirthTime: this.hasExactBirthTime(),
            hasBirthCoordinates: this.hasBirthCoordinates(),
            hasReliableAscendant: canUseAscendant,
            narrativeLens: this.selectNarrativeLens(chartSummary)
        };
    },

    /**
     * Build the user object passed into AI story generation.
     */
    buildScriptUserData(predictionItems = null) {
        const profile = this.personalization || {};
        const items = Array.isArray(predictionItems) ? predictionItems : this.buildPredictionItems();
        return {
            name: this.firstName,
            fullName: this.userData?.name || this.firstName,
            gender: this.userData?.gender || '',
            dob: this.formatDateSpoken(this.userData.birthDate),
            rawBirthDate: this.userData.birthDate,
            birthTime: this.hasExactBirthTime() ? this.userData.birthTime : 'unknown',
            birthPlace: this.userData.birthPlace || '',
            birthPlaceShort: profile.birthPlaceShort || '',
            zodiac: profile.western?.name || MayaAstrology.getZodiac(this.userData.birthDate, {
                birthTime: this.getResolvedBirthTime(),
                birthPlace: this.userData.birthPlace || '',
                birthLat: this.userData.birthLat,
                birthLon: this.userData.birthLon
            })?.name || '',
            westernZodiac: profile.western?.name || '',
            vedicZodiac: profile.vedic?.name || '',
            ascendant: profile.hasReliableAscendant ? (profile.ascendant?.name || '') : '',
            moonSign: profile.moonSign || '',
            dominantElement: profile.dominantElement || '',
            currentDasha: profile.currentDasha?.vedic || profile.currentDasha?.planet || '',
            narrativeLens: profile.narrativeLens || '',
            chartHighlights: profile.highlights || [],
            predictionItems: items
        };
    },

    /**
     * Shared context block for AI and prompt helpers.
     */
    buildBaseAIContext(predictionItems = null) {
        const profile = this.personalization || {};
        const items = Array.isArray(predictionItems) ? predictionItems : this.buildPredictionItems();
        const lang = MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';

        // Full kundli planetary data for AI
        const detailedChartFacts = (this.kundliChart && window.MayaKundli?.buildDetailedChartFacts)
            ? MayaKundli.buildDetailedChartFacts(this.kundliChart, this.userData?.birthDate)
            : '';

        // Lal Kitab planet-in-house analysis specific to this user's chart
        const lalKitabContext = (this.kundliChart?.planets?.length && this.kundliChart?.ascendant?.name && window.getLalKitabForChart)
            ? getLalKitabForChart(this.kundliChart.planets, this.kundliChart.ascendant.name)
            : '';

        // MCQ answers context so AI can personalize based on user selections
        const memoryContext = this.buildMemoryContext(isHindi);

        return {
            ...this.calculations,
            gender: this.userData?.gender || '',
            westernZodiac: profile.western?.name,
            vedicZodiac: profile.vedic?.name,
            ascendant: profile.hasReliableAscendant ? profile.ascendant?.name : '',
            moonSign: profile.moonSign,
            sunSign: profile.western?.name || '',
            dominantElement: profile.dominantElement,
            currentDasha: profile.currentDasha?.vedic || profile.currentDasha?.planet,
            yogaNames: profile.yogaNames || [],
            birthPlace: this.userData?.birthPlace || '',
            birthPlaceShort: profile.birthPlaceShort || '',
            hasExactBirthTime: profile.hasExactBirthTime,
            hasReliableAscendant: profile.hasReliableAscendant,
            narrativeLens: profile.narrativeLens || '',
            chartHighlights: profile.highlights || [],
            predictionItems: items,
            detailedChartFacts,
            lalKitabContext,
            memoryContext,
            validationResponses: this.validationResponses || [],
            userData: {
                gender: this.userData?.gender || '',
                westernZodiac: profile.western?.name || '',
                vedicZodiac: profile.vedic?.name || '',
                ascendant: profile.hasReliableAscendant ? profile.ascendant?.name : '',
                moonSign: profile.moonSign,
                currentDasha: profile.currentDasha?.vedic || profile.currentDasha?.planet,
                birthPlaceShort: profile.birthPlaceShort || '',
                narrativeLens: profile.narrativeLens || ''
            }
        };
    },

    escapeRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    localizeHindiText(text) {
        const astroRules = MAYA_CONFIG?.LANGUAGE?.HINDI_ASTRO_TERM_RULES || [];

        return astroRules.reduce((localized, rule) => {
            try {
                return localized.replace(new RegExp(rule.pattern, 'gi'), rule.replacement);
            } catch (_error) {
                return localized;
            }
        }, String(text || ''))
            .replace(/\bjson\b/gi, '')
            .replace(/लाइफ\s*पाथ/gi, 'Life Path')
            .replace(/डेस्टिनी/gi, 'Destiny')
            .replace(/सोल\s*अर्ज/gi, 'Soul Urge')
            .replace(/पर्सनल\s*ईयर/gi, 'Personal Year')
            .replace(/ईमेल/gi, 'email')
            .replace(/पासवर्ड/gi, 'password')
            .replace(/लॉगिन/gi, 'login')
            .replace(/चार्ट/gi, 'chart')
            .replace(/टाइमिंग/gi, 'timing')
            .replace(/पैटर्न/gi, 'pattern')
            .replace(/प्रेशर/gi, 'pressure')
            .replace(/करियर|कैरियर/gi, 'career')
            .replace(/रिलेशनशिप्स/gi, 'relationships')
            .replace(/रिलेशनशिप/gi, 'relationship')
            .replace(/मनी/gi, 'money')
            .replace(/एनर्जी/gi, 'energy')
            .replace(/\s+/g, ' ')
            .trim();
    },

    sanitizeNarrationText(text) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const rawName = this.firstName || (isHindi ? 'आप' : 'you');
        const name = rawName || (isHindi ? 'आप' : 'you');
        let cleaned = String(text || '').trim();

        if (!cleaned) return cleaned;

        cleaned = cleaned
            .replace(/\bfriend\s*ji\b/gi, name)
            .replace(/\bfrend\s*ji\b/gi, name)
            .replace(/फ्रेंड\s*जी/gi, name)
            .replace(/दोस्त\s*जी/gi, name)
            .replace(/your celestial guide sees that\s*/gi, '')
            .replace(/आपका celestial guide देखता है कि\s*/gi, '')
            .replace(/today'?s cosmic alignment shows that\s*/gi, '')
            .replace(/आज का cosmic alignment दिखाता है कि\s*/gi, '')
            .replace(/the universe whispers that\s*/gi, '')
            .replace(/ब्रह्मांड कहता है कि\s*/gi, '')
            .replace(/तारे बताते हैं कि\s*/gi, '')
            .replace(/आज\s+\d{1,2}\s+[^\s,.!?।]+\s+\d{4}\s+का\s+दिन/gi, isHindi ? 'यह चरण' : 'this phase')
            .replace(/today'?s verdict/gi, isHindi ? 'यह पैटर्न' : 'this pattern')
            .replace(/आज का verdict/gi, 'यह पैटर्न')
            .replace(/([A-Za-z\u0900-\u097F]+)\s*जी(?=[\s,.!?।]|$)/g, '$1')
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.!?।])/g, '$1')
            .trim();

        if (isHindi) {
            cleaned = this.localizeHindiText(cleaned)
                .replace(/मैं([^.!?\n]{0,80}?)रहा हूँ/g, 'मैं$1रही हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)सकता हूँ/g, 'मैं$1सकती हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)बताता हूँ/g, 'मैं$1बताती हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)कहता हूँ/g, 'मैं$1कहती हूँ')
                .replace(/\bबताऊँगा\b/g, 'बताऊँगी')
                .replace(/\bकहूँगा\b/g, 'कहूँगी')
                .replace(/\bकरूँगा\b/g, 'करूँगी')
                .replace(/\s+/g, ' ')
                .trim();
        }

        return cleaned;
    },

    async getOpeningNarration() {
        try {
            const freshOpening = await this.generateWarmWelcome();
            if (freshOpening && freshOpening.length > 40) {
                return freshOpening;
            }
        } catch (error) {
            console.warn('Fresh opening generation failed:', error.message);
        }

        console.log('✨ Falling back to direct AI opening generation');
        return await this.generateDirectReadingSection('opening', this.buildBaseAIContext());
    },

    getKundliInsightItems(isHindi = false) {
        const profile = this.personalization || {};
        const items = [];
        const ascendant = profile.ascendant || {};
        const dasha = profile.currentDasha || {};
        const yoga = profile.yogaNames?.[0];
        const dominantElement = profile.dominantElement;
        const localize = (value) => isHindi ? this.localizeHindiText(value) : value;

        if (ascendant.name) {
            items.push({
                key: 'ascendant',
                title: isHindi ? 'लग्न' : 'Ascendant',
                value: localize(ascendant.name),
                detail: ''
            });
        }

        if (profile.moonSign) {
            items.push({
                key: 'moon',
                title: isHindi ? 'चंद्र राशि' : 'Moon Sign',
                value: localize(profile.moonSign),
                detail: ''
            });
        }

        if (profile.western?.name) {
            items.push({
                key: 'sun',
                title: isHindi ? 'सूर्य राशि' : 'Sun Sign',
                value: localize(profile.western.name),
                detail: ''
            });
        }

        if (dasha.vedic || dasha.planet) {
            const dashaName = dasha.vedic || dasha.planet;
            items.push({
                key: 'dasha',
                title: isHindi ? 'वर्तमान दशा' : 'Current Dasha',
                value: localize(dashaName),
                detail: ''
            });
        }

        if (dominantElement) {
            items.push({
                key: 'element',
                title: isHindi ? 'Dominant Element' : 'Dominant Element',
                value: localize(dominantElement),
                detail: ''
            });
        }

        if (yoga) {
            items.push({
                key: 'yoga',
                title: isHindi ? 'योग' : 'Yoga',
                value: localize(yoga),
                detail: ''
            });
        }

        return items.slice(0, 4);
    },

    getNearFutureNarrationHint(isHindi = false) {
        const nextSignal = this.buildPredictionItems()[0];
        if (!nextSignal) return '';

        if (isHindi) {
            return nextSignal.kind === 'strong'
                ? `${nextSignal.monthName} के आस-पास एक सहायक मोड़ खुल रहा है, जहाँ ${nextSignal.theme} की दिशा और साफ दिखेगी।`
                : `${nextSignal.monthName} के आस-पास थोड़ा संभलकर चलना होगा, क्योंकि वहीं ${nextSignal.theme} का दबाव उभर सकता है।`;
        }

        return nextSignal.kind === 'strong'
            ? `Around ${nextSignal.monthName}, a supportive opening becomes clearer, especially around ${nextSignal.theme}.`
            : `Around ${nextSignal.monthName}, move more carefully because the pressure around ${nextSignal.theme} is likely to rise.`;
    },

    appendResultCard(resultKey, label, value, extraClass = '') {
        const resultArea = document.getElementById('calc-result');
        if (!resultArea || value == null || value === '') return;

        resultArea.style.display = 'flex';
        const classList = String(extraClass || '').split(/\s+/).filter(Boolean);
        const resultGroupKey = classList.includes('kundli') || String(resultKey || '').startsWith('kundli-')
            ? 'kundli'
            : 'numbers';
        const resultGroup = resultArea.querySelector(`[data-result-group="${resultGroupKey}"]`) || resultArea;
        let card = resultGroup.querySelector(`[data-result-key="${resultKey}"]`);

        if (!card) {
            card = document.createElement('div');
            card.className = `number-reveal ${extraClass}`.trim();
            card.dataset.resultKey = resultKey;
            resultGroup.appendChild(card);
        }

        card.innerHTML = `
            <span class="number-label">${label}</span>
            <span class="number-value glow-pulse">${value}</span>
        `;
    },

    /**
     * Initialize the funnel with user data
     */
    init(userData) {
        console.log('🎭 Funnel init() called with:', userData);
        
        // Validate required data
        if (!userData || !userData.name || !userData.birthDate) {
            console.error('❌ Invalid userData for funnel:', userData);
            throw new Error('Missing required user data (name and birthDate)');
        }
        
        this.userData = userData;
        this.firstName = this.getFirstName(userData.name);
        this.isActive = true;
        this.currentPhase = 0;
        this.hasRevealedTeaser = false;
        this.emailGateShown = false;
        this.emailSubmissionInProgress = false;
        this.teaserGateNarrated = false;
        this.spokenNarrations = [];
        this.authRequestId = 0;
        this.authPromptedFields = new Set();
        
        // Save language preference to storage immediately
        const language = userData.language || MayaUtils.storage.get('maya_language') || 'en';
        this.userData.language = language;
        MayaUtils.storage.set('maya_language', language);
        
        // IMPORTANT: Save ALL user data to localStorage immediately
        // This ensures data persists even before email gate
        const profileData = {
            name: userData.name,
            gender: userData.gender || null,
            birthDate: userData.birthDate,
            birthTime: userData.birthTime || null,
            birthPlace: userData.birthPlace || null,
            birthLat: userData.birthLat || null,
            birthLon: userData.birthLon || null,
            language: language
        };
        
        // Merge with existing profile (don't overwrite email if already set)
        const existingProfile = MayaUtils.storage.get('maya_profile') || {};
        MayaUtils.storage.set('maya_profile', { ...existingProfile, ...profileData });
        
        // Also save to funnel_data for backup/recovery
        MayaUtils.storage.set('funnel_data', userData);
        
        console.log('🎭 Storytelling Funnel initialized with:', userData);
        console.log('💾 Profile saved to localStorage:', profileData);
        
        // Set language for all modules
        if (window.MayaStatements) {
            MayaStatements.setLanguage(language);
        }
        if (window.MayaDynamicContent) {
            MayaDynamicContent.setLanguage(language);
        }

        void window.MayaApp?.applyLanguagePreference?.(language, { force: true });
        
        console.log('👤 First name:', this.firstName);
        console.log('🌐 Language:', language);
        
        // Calculate all numerology numbers with error handling
        try {
            if (!window.MayaNumerology || !window.MayaNumerology.calculateAll) {
                throw new Error('MayaNumerology module not loaded');
            }
            
            this.calculations = MayaNumerology.calculateAll(
                userData.name,
                userData.birthDate
            );
            
            if (!this.calculations) {
                throw new Error('calculateAll returned null/undefined');
            }
        } catch (error) {
            console.error('❌ Numerology calculation failed:', error);
            // Provide fallback calculations to prevent funnel crash
            this.calculations = {
                lifePath: 7,
                destiny: 5,
                soulUrge: 3,
                personality: 4,
                personalYear: 1,
                currentMonthNumber: 5,
                currentDayNumber: 3
            };
            console.warn('⚠️ Using fallback calculations');
        }
        
        // Save calculations to localStorage as well
        MayaUtils.storage.set('maya_calculations', this.calculations);
        
        console.log('🔢 Calculations:', this.calculations);

        try {
            this.personalization = this.buildPersonalizationProfile();
            console.log('🪐 Personalization profile:', this.personalization);
        } catch (error) {
            console.error('❌ Personalization profile failed:', error);
            this.personalization = {
                western: MayaAstrology.getWesternZodiac?.(this.userData.birthDate) || {},
                vedic: MayaAstrology.getVedicZodiac?.(this.userData.birthDate, {
                    birthTime: this.getResolvedBirthTime(),
                    birthPlace: this.userData.birthPlace || '',
                    birthLat: this.userData.birthLat,
                    birthLon: this.userData.birthLon
                }) || {},
                birthPlaceShort: this.getBirthPlaceShort(),
                hasExactBirthTime: this.hasExactBirthTime(),
                narrativeLens: 'identity, direction, and the next chapter',
                planetGroups: [],
                yogaNames: [],
                highlights: []
            };
        }
        
        // Initialize content cache for pre-generated content
        this.contentCache = {};
        this.contentGenerating = {};

        // Reset session memory for fresh funnel run
        this.resetSessionMemory();
        
        // Pre-generate ALL AI content in background for smooth delivery
        this.pregenerateAllContent();
        
        return this;
    },

    /**
     * Pre-generate ALL funnel content in background for seamless playback
     */
    async pregenerateAllContent() {
        this.contentGenerating = {};
        console.log('🎭 Live generation mode active; skipping narration pre-cache.');
        return [];
    },

    /**
     * Pre-generate a single piece of content with caching
     */
    async pregenerateContent(key, generator) {
        if (this.contentGenerating[key]) return this.contentGenerating[key];
        
        this.contentGenerating[key] = (async () => {
            try {
                const content = await Promise.race([
                    generator(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
                return content;
            } catch (e) {
                console.warn(`⚠️ Pre-generation failed for ${key}:`, e.message);
                return null;
            } finally {
                delete this.contentGenerating[key];
            }
        })();
        
        return this.contentGenerating[key];
    },

    /**
     * Get content from cache or generate on-demand (fast path)
     */
    async getContent(key, fallbackGenerator) {
        if (this.contentGenerating[key]) {
            console.log(`⏳ Waiting for: ${key}`);
            return await this.contentGenerating[key];
        }

        console.log(`🔄 Generating fresh narration: ${key}`);
        this.contentGenerating[key] = (async () => {
            try {
                return await MayaUtils.retry(
                    async (attempt) => {
                        console.log(`🔁 Narration attempt ${attempt} for ${key}`);
                        const content = await MayaUtils.withTimeout(
                            Promise.resolve().then(() => fallbackGenerator()),
                            28000,
                            `${key} generation`
                        );

                        if (!content || String(content).trim().length < 20) {
                            throw new Error(`Empty narration for ${key}`);
                        }

                        return content;
                    },
                    {
                        maxRetries: 3,
                        baseDelay: 200,
                        maxDelay: 1200,
                        backoffMultiplier: 1.5,
                        label: `${key} narration`,
                        retryCondition: (error, attempt) => {
                            const message = error?.message || '';
                            return attempt < 3
                                && (MayaUtils.isRetryableError(error) || /timeout|timed out|empty|rate limit|all content sources failed/i.test(message));
                        },
                        onRetry: (_attempt, _max, error) => {
                            console.warn(`⚠️ Fresh generation retry for ${key}:`, error.message);
                        }
                    }
                );
            } catch (e) {
                console.warn(`⚠️ Fresh generation exhausted for ${key}:`, e.message);
                return null;
            } finally {
                delete this.contentGenerating[key];
            }
        })();

        return await this.contentGenerating[key];
    },

    /**
     * Build AI Summary prompt
     */
    buildAISummaryPrompt(isHindi) {
        const chartSummary = this.personalization || {};
        const localize = (value) => isHindi ? this.localizeHindiText(value) : value;
        // Use detailed chart facts if available, fall back to simple summary
        const detailedFacts = (this.kundliChart && window.MayaKundli?.buildDetailedChartFacts)
            ? MayaKundli.buildDetailedChartFacts(this.kundliChart, this.userData?.birthDate)
            : '';
        const lalKitabFacts = (this.kundliChart?.planets?.length && this.kundliChart?.ascendant?.name && window.getLalKitabForChart)
            ? getLalKitabForChart(this.kundliChart.planets, this.kundliChart.ascendant.name)
            : '';
        const chartLines = [detailedFacts, lalKitabFacts].filter(Boolean).join('\n') || [
            chartSummary?.ascendant?.name ? `${isHindi ? 'लग्न' : 'Ascendant'}: ${localize(chartSummary.ascendant.name)}` : '',
            chartSummary?.moonSign ? `${isHindi ? 'चंद्र राशि' : 'Moon sign'}: ${localize(chartSummary.moonSign)}` : '',
            chartSummary?.currentDasha?.vedic || chartSummary?.currentDasha?.planet
                ? `${isHindi ? 'वर्तमान दशा' : 'Current dasha'}: ${localize(chartSummary.currentDasha?.vedic || chartSummary.currentDasha?.planet)}`
                : '',
            chartSummary?.birthPlaceShort ? `${isHindi ? 'जन्म स्थान' : 'Birth place'}: ${localize(chartSummary.birthPlaceShort)}` : '',
            chartSummary?.highlights?.length ? `${isHindi ? 'कुंडली संकेत' : 'Chart highlights'}: ${chartSummary.highlights.map((item) => localize(item)).join('; ')}` : ''
        ].filter(Boolean).join('\n');

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentYear = now.getFullYear();
        const currentMonthStr = now.toLocaleDateString('en-US', { month: 'long' });

        // Include MCQ answers so AI can refine reading
        const memCtx = this.buildMemoryContext(isHindi);
        const mcqBlock = memCtx
            ? (isHindi
                ? `\n\n## USER के जवाब (PERSONALISE करने के लिए use करें):\n${memCtx}`
                : `\n\n## USER RESPONSES (use to PERSONALISE):\n${memCtx}`)
            : '';

        // Include already spoken context so the summary doesn't repeat opening/kundli narration
        const alreadySpoken = this.spokenNarrations?.length
            ? this.spokenNarrations.map(n => {
                const cleaned = (n.text || '').replace(/\[\[pause-\d+\]\]/g, '').trim();
                return `[${n.stage}]: ${cleaned}`;
            }).join('\n')
            : '';
        const alreadySpokenBlock = alreadySpoken
            ? (isHindi
                ? `\n\n## पहले बताया जा चुका है (REPEAT मत करें):\n${alreadySpoken}`
                : `\n\n## ALREADY TOLD (DO NOT REPEAT):\n${alreadySpoken}`)
            : '';

        return isHindi 
            ? `आप MAYA हैं - एक wise female Vedic numerology expert। आप ${this.firstName} से बात कर रहे हैं जिन्होंने अभी अपने numbers देखे।
User gender: ${this.userData?.gender === 'male' ? 'Male (पुरुष)' : this.userData?.gender === 'female' ? 'Female (महिला)' : 'Not specified'}

आज: ${todayStr}
⚠️ जो months बीत चुके हैं (January-${currentMonthStr} ${currentYear}) उन्हें PAST tense में refer करें। Future predictions में specific month + year बोलें।
${alreadySpokenBlock}${mcqBlock}

अब numbers repeat मत कीजिए। इसके बजाय, नीचे दिए गए EXACT planetary positions और dasha timeline को use करके एक SPECIFIC past event predict कीजिए जो सिर्फ इस user पर fit हो।

Numbers (reference): LP ${this.calculations.lifePath}, Destiny ${this.calculations.destiny}, Soul Urge ${this.calculations.soulUrge}, Year ${this.calculations.personalYear}
${chartLines ? `\n${chartLines}` : ''}

RULES:
- सिर्फ 2-3 वाक्य लिखिए। छोटा और sharp रखिए।
- Numbers repeat मत कीजिए - वो देख चुके हैं।
- ऊपर "ALREADY TOLD" section में जो कुछ कहा गया वो repeat/rephrase मत कीजिए। बिल्कुल नई बात कहिए।
- ऊपर दिए गए planetary positions और dasha transition years को EXACTLY reference करके predict कीजिए। जैसे: "आपकी कुंडली में शनि मकर राशि में 28.5° पर है और राहु दशा ${currentYear - 3} में शुरू हुई - मुझे दिख रहा है कि उस साल..."
- ऐसा कुछ बताइए जो सुनकर user को लगे "ये तो सच में मेरे बारे में जानती है!"
- Vague generic बातें मत कहिए जो किसी पर भी fit हो। SPECIFIC रहिए - actual planet names, signs, dasha years बोलिए।
- energy feel या mind reading claim मत कीजिए। Chart और numbers पर based rakhein।
- MAYA feminine forms: हूँ, रही, सकती, देख रही (ये MAYA के लिए हैं)।
- ⚠️ USER GENDER: User को address करते वक्त उनका ACTUAL gender use करें। अगर user MALE है तो: "आप जानते हैं", "आप समझते हैं", "आपको मिलेगा"। अगर user FEMALE है तो: "आप जानती हैं", "आप समझती हैं", "आपको मिलेगा"। Male user को feminine forms में address करना FORBIDDEN है।
- "आप" use करें। नाम MAX 1 बार use करें। TTS-safe रखिए।
- भाषा simple light Hinglish - सिर्फ भारी/शुद्ध/किताबी Sanskrit-laden Hindi बदलिए (जैसे "सम्भावना" → "मौका", "परिस्थिति" → "हालात")। आम बोलचाल के Hindi words (जिंदगी, दिल, वक्त, दिक्कत, हिम्मत, फैसला, रिश्ता) देवनागरी में ही रखिए - ये Hindi-origin हैं।
- 🚫 URDU BAN: उर्दू/अरबी/फारसी शब्द FORBIDDEN। Nuqta sounds (za, qa, kha, gha, fa) FORBIDDEN - ये Urdu हैं Hindi नहीं। Banned: इश्क/मोहब्बत→प्यार, ख्वाब→सपना, शख्सियत→personality, सुकून→शांति, हौसला→हिम्मत, वजह→कारण, खुदा→भगवान। Plain Hindi बोलिए।
- एक ही शब्द लगातार 2 sentences में repeat मत करें - synonyms use करें।`
            : `You are MAYA - a wise female Vedic numerology expert. You're speaking to ${this.firstName} who just saw their numbers.
User gender: ${this.userData?.gender === 'male' ? 'Male' : this.userData?.gender === 'female' ? 'Female' : 'Not specified'}

Today: ${todayStr}
⚠️ Months already passed (January-${currentMonthStr} ${currentYear}) must be referenced in past tense. Future predictions must include specific month + year.
${alreadySpokenBlock}${mcqBlock}

DO NOT repeat the numbers or anything from the ALREADY TOLD section above. Instead, use the EXACT planetary positions and dasha timeline below to predict ONE SPECIFIC past event that feels deeply personal.

Numbers (reference): LP ${this.calculations.lifePath}, Destiny ${this.calculations.destiny}, Soul Urge ${this.calculations.soulUrge}, Year ${this.calculations.personalYear}
${chartLines ? `\n${chartLines}` : ''}

RULES:
- Write ONLY 2-3 sentences. Keep it short and striking.
- DO NOT repeat numbers - they just saw them.
- DO NOT repeat or rephrase anything from the ALREADY TOLD section. Say something completely new.
- Use the EXACT planetary positions and dasha transition years from above to predict a SPECIFIC past event. Example: "Saturn in Capricorn at 28.5° combined with your Rahu dasha starting ${currentYear - 3} tells me that year..."
- The user should think "how does she know this about me?!" - that is the goal.
- Do NOT say vague things that could apply to anyone. Be SPECIFIC - name actual planets, signs, degrees, dasha years.
- Do not claim psychic access or energy reading. Base it on chart + numbers.
- You (MAYA) are FEMALE - warm but confident. Use feminine forms for yourself (मैं देख रही हूँ, मुझे दिखा).
- ⚠️ USER GENDER: Address the user with THEIR correct gender. If user is MALE, use masculine forms in Hindi ("आप जानते हैं", "आप समझते हैं"). If user is FEMALE, use feminine forms ("आप जानती हैं", "आप समझती हैं"). Addressing a male user with feminine forms is FORBIDDEN.
- Continue naturally from previous narration, no new greeting. TTS-safe.
- Use the user's name MAX 1 time. Use "you/your" everywhere else.
- Do NOT repeat the same word in back-to-back sentences - use synonyms.
- Speak naturally, complete your thoughts.`;
    },

    /**
     * Pre-generate AI scripts + audio in background for smooth voice delivery
     */
    pregenerateScripts() {
        // Stage-script pre-generation is disabled so all live narration stays AI-prompted.
    },

    /**
     * Get AI-generated script for a stage (uses pre-cached if available)
     */
    async getAIScript(stage, extraContext = null) {
        const predictionItems = this.buildPredictionItems();
        const baseContext = this.buildBaseAIContext(predictionItems);
        const context = extraContext ? { ...baseContext, ...extraContext } : baseContext;

        if (stage === 'kundliFormation') {
            return await this.generateDirectReadingSection('kundli', context);
        }

        return '';
    },

    /**
     * Start background music
     */
    startBackgroundMusic() {
        if (this.backgroundMusic) return;
        
        this.backgroundMusic = new Audio();
        this.backgroundMusic.loop = true;
        // iOS treats all audio at similar perceptual loudness. Use very low
        // volume so background music never competes with TTS narration.
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        this.backgroundMusic.volume = isIOS ? 0.02 : 0.18;
        
        // Try multiple audio formats for better compatibility
        const audioFormats = [
            { src: 'funnel.mp3', type: 'audio/mpeg' },
            { src: 'funnel.ogg', type: 'audio/ogg' },
            { src: 'funnel.wav', type: 'audio/wav' }
        ];
        
        // Find first supported format
        for (const format of audioFormats) {
            if (this.backgroundMusic.canPlayType(format.type)) {
                this.backgroundMusic.src = format.src;
                break;
            }
        }
        
        // If no supported format found, default to mp3
        if (!this.backgroundMusic.src) {
            this.backgroundMusic.src = 'funnel.mp3';
        }
        
        // Attempt to play - handle autoplay restrictions
        const playPromise = this.backgroundMusic.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('🎵 Background music playing');
            }).catch(e => {
                console.log('🎵 Background music autoplay blocked, will retry on user interaction:', e.name);
                // Store reference for retry on user interaction
                this.musicPendingPlay = true;
                
                // Add one-time event listeners to start music on user interaction
                const startMusicOnInteraction = () => {
                    if (this.musicPendingPlay && this.backgroundMusic) {
                        this.backgroundMusic.play().then(() => {
                            console.log('🎵 Background music started after user interaction');
                            this.musicPendingPlay = false;
                        }).catch(() => {
                            console.log('🎵 Background music still blocked');
                        });
                    }
                    // Remove listeners after first interaction
                    document.removeEventListener('click', startMusicOnInteraction);
                    document.removeEventListener('touchstart', startMusicOnInteraction);
                    document.removeEventListener('keydown', startMusicOnInteraction);
                };
                
                document.addEventListener('click', startMusicOnInteraction, { once: true });
                document.addEventListener('touchstart', startMusicOnInteraction, { once: true });
                document.addEventListener('keydown', startMusicOnInteraction, { once: true });
            });
        }
    },

    /**
     * Fade out background music
     */
    fadeOutMusic(duration = 2000) {
        if (!this.backgroundMusic) return;
        
        const startVolume = this.backgroundMusic.volume;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = startVolume / steps;
        
        const fadeInterval = setInterval(() => {
            if (this.backgroundMusic && this.backgroundMusic.volume > volumeStep) {
                this.backgroundMusic.volume -= volumeStep;
            } else {
                if (this.backgroundMusic) {
                    this.backgroundMusic.pause();
                    this.backgroundMusic = null;
                }
                clearInterval(fadeInterval);
            }
        }, stepTime);
    },

    /**
     * Generate a warm, personalized welcome that creates goosebumps
     * Uses AI to create deeply personal content based on Life Path
     */
    
    async generateWarmWelcome() {
        const lang = MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en';
        const name = this.firstName;

        // Ensure MayaStatements uses correct language
        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        const predictionItems = this.buildPredictionItems();
        const aiContext = this.buildBaseAIContext(predictionItems);
        const birthDate = window.MayaAstrology ? MayaAstrology.parseDate(this.userData.birthDate) : new Date(this.userData.birthDate);
        const birthDay = birthDate?.getDate?.();
        const birthMonth = birthDate ? birthDate.getMonth() + 1 : null;

        try {
            const directOpening = await this.generateDirectReadingSection('opening', {
                ...aiContext,
                birthDay,
                birthMonth
            });
            if (directOpening && directOpening.length > 40) return directOpening;
        } catch (e) {
            console.warn('AI warm welcome failed:', e.message);
        }

        return '';
    },

    getNarrativeStageGuide(sectionKey, isHindi = false) {
        const guides = isHindi
            ? {
                opening: 'Act 1. Invitation phase. ऐसा लगे जैसे एक sealed personal file खुल रही है. सिर्फ पहला hard clue दीजिए, पूरा verdict नहीं। आखिर में ऐसा thread छोड़िए जो kundli layer की तरफ खींचे।',
                kundli: 'Act 2. Chart structure phase. ऐसे बोलिए जैसे chart live trace हो रहा है. Ascendant, चंद्र राशि, दशा, या planetary clustering से life structure दिखाइए, और numbers की तरफ unresolved handoff दीजिए।',
                identityTruth: 'Teaser segment 1. एक grounded identity observation — "आप ऐसे इंसान हैं जो..." format में। Pattern-based, flattery-free।',
                emotionalPattern: 'Teaser segment 2. एक emotional pattern जो user daily जीता है — ऐसा कुछ जो उन्हें inside-out describe करे।',
                unresolvedThread: 'Teaser segment 3. एक open loop — ऐसा unresolved thread जो naturally resolution माँगे और user को आगे सुनने पर मजबूर करे।',
                combinedTeaser: 'Combined teaser arc. तीन layers: पहले identity truth ("आप ऐसे इंसान हैं जो..."), फिर emotional pattern (inside-out), फिर unresolved thread (open loop)। तीनों एक कहानी की तरह बहें, अलग-अलग टुकड़े नहीं। हर layer chart evidence पर based हो।',
                accuracyShock: 'Act 3. "How does she know?" moment. Chart data से एक SPECIFIC past event predict कीजिए — timing (month/year), nature, और emotional impact सहित। यह reader को चौंकाने वाला हो।',
                suspenseBridge: 'Gate transition. Controlled tension — 1 sentence जो सबसे intense unresolved pattern name करे, 1 sentence जो कहे "इसे अभी यहीं नहीं बताऊँगी", और 1 sentence जो reading save करने की sense of importance पैदा करे।',
                loveIntro: 'Act 4 transition. Emotional layer अब खुल रही है. Tone intimate हो, लेकिन reset नहीं।',
                love: 'Act 4. Relationship layer. User के emotional pattern का एक private but believable contradiction खोलिए. Curiosity बनी रहे।',
                careerIntro: 'Act 5 transition. अब outer world, work, aur money pattern की तरफ lens shift हो रही है. Momentum same रहना चाहिए।',
                career: 'Act 5. Outer path layer. Talent, friction, aur practical direction को एक ही narrative thread में जोड़िए।',
                yearIntro: 'Act 6 transition. अब timing windows करीब आ रही हैं. Voice में measured anticipation रहे।',
                year: 'Act 6. Timing layer. आने वाले महीनों को living timeline की तरह बोलिए, और एक window को बाकी से ज्यादा charged feel कराइए।',
                warningIntro: 'Act 7 transition. पहले trust hold कीजिए, फिर caution खोलिए. Tone protective हो, dramatic नहीं।',
                warning: 'Act 7. Shadow layer. एक specific trigger, उसका pattern, और protective boundary बताइए. यह same story का honest underside लगे।',
                emailGate: 'Save gate. ऐसा feel कराइए कि reading save करना जरूरी है — private file जो सिर्फ उनकी है। "Save my file" framing।',
                deepRevealPrep: 'Deep reveal threshold. User को feel होना चाहिए कि अब reading deeper और more personal होने वाली है, without sounding salesy.',
                returnHook: 'Return trigger. एक unresolved timing shift बताइए — "अभी नहीं बता सकती, पर आपकी chart में [month] में कुछ shift है — कल इसके बारे में और बात करते हैं।"',
                completion: 'Closing beat. Reading को softly settle कराइए, लेकिन curiosity और conversation का दरवाजा खुला रखिए।',
                authCheck: 'Operational interlude. Mystery टूटे नहीं; बस short, calm continuity रखिए।',
                welcomeBack: 'Re-entry beat. ऐसा लगे जैसे वही file फिर से खोली जा रही है, शुरुआत से नहीं।',
                newUser: 'Protection beat. Reading को valuable personal file की तरह frame कीजिए जिसे सुरक्षित रखना जरूरी है।',
                calculationRecovery: 'Recovery beat. Momentum पूरी तरह मत तोड़िए; बस बताइए कि alignment दोबारा हो रहा है।'
            }
            : {
                opening: 'Act 1. Invitation phase. Sound like a sealed personal file is being opened. Give only the first hard clue, not the whole verdict, and leave a thread that pulls naturally into the kundli layer.',
                kundli: 'Act 2. Chart-structure phase. Speak as if the chart is being traced live. Use ascendant, moon sign, dasha, or planetary clustering to show the structure of the life, then leave an unresolved handoff toward the numbers.',
                identityTruth: 'Teaser segment 1. A grounded identity observation — "You are someone who..." format. Pattern-based, flattery-free.',
                emotionalPattern: 'Teaser segment 2. An emotional pattern the user lives with daily — something that describes them from the inside out.',
                unresolvedThread: 'Teaser segment 3. An open loop — an unresolved thread that naturally demands resolution and compels the user to keep listening.',
                combinedTeaser: 'Combined teaser arc. Three layers: identity truth ("You are someone who..."), then emotional pattern (inside-out), then unresolved thread (open loop). All three must flow as one connected narrative, not isolated observations. Every layer must be grounded in specific chart evidence.',
                accuracyShock: 'Act 3. "How does she know?" moment. Predict a SPECIFIC past event from chart data — with timing (month/year), nature, and emotional impact. This should genuinely surprise the user.',
                suspenseBridge: 'Gate transition. Controlled tension — 1 sentence naming the most intense unresolved pattern, 1 sentence saying "I will not tell you this here", and 1 sentence creating a sense of importance around saving the reading.',
                loveIntro: 'Act 4 transition. The emotional layer is opening now. Keep it intimate without resetting the scene.',
                love: 'Act 4. Relationship layer. Reveal one private but believable contradiction in the user\'s emotional pattern and keep curiosity alive.',
                careerIntro: 'Act 5 transition. Shift the lens toward work, money, and outer direction while keeping the same momentum.',
                career: 'Act 5. Outer-path layer. Tie talent, friction, and practical direction into one narrative thread.',
                yearIntro: 'Act 6 transition. The timing windows are getting closer. Let the voice carry measured anticipation.',
                year: 'Act 6. Timing layer. Speak about the coming months like a living timeline, and make one window feel more charged than the rest.',
                warningIntro: 'Act 7 transition. Hold trust first, then open the caution. Sound protective, not dramatic.',
                warning: 'Act 7. Shadow layer. Name one specific trigger, its repeating pattern, and a protective boundary. It must feel like the honest underside of the same story.',
                emailGate: 'Save gate. Make the user feel the reading deserves to be saved — a private file that belongs only to them. Use "save my file" framing.',
                deepRevealPrep: 'Deep reveal threshold. The user should feel that the reading is about to become deeper and more personal without sounding salesy.',
                returnHook: 'Return trigger. Name one unresolved timing shift — "I cannot tell you yet, but your chart shows a shift in [month] — let us talk about this tomorrow."',
                completion: 'Closing beat. Let the reading settle softly while leaving the door open for further conversation.',
                authCheck: 'Operational interlude. Do not break the atmosphere; keep continuity calm and brief.',
                welcomeBack: 'Re-entry beat. It should feel like reopening the same file, not starting from scratch.',
                newUser: 'Protection beat. Frame the reading like a valuable personal file that deserves to be secured.',
                calculationRecovery: 'Recovery beat. Do not break momentum completely; simply explain that the alignment is being restored.'
            };

        return guides[sectionKey] || guides.completion;
    },

    buildDirectSectionPrompt(sectionKey, context = {}) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const profile = this.personalization || {};
        const numbers = this.calculations || {};
        const predictionItems = Array.isArray(context.predictionItems) ? context.predictionItems : this.buildPredictionItems();
        const visibleKundliFacts = Array.isArray(context.kundliDisplayFacts)
            ? context.kundliDisplayFacts.filter(Boolean).join('\n')
            : String(context.kundliDisplayFacts || '').trim();
        // Build detailed chart facts from actual kundli calculations if available
        const detailedChartFacts = (this.kundliChart && window.MayaKundli?.buildDetailedChartFacts)
            ? MayaKundli.buildDetailedChartFacts(this.kundliChart, this.userData?.birthDate)
            : '';
        const fallbackChartFacts = [
            profile.western?.name ? `Western zodiac: ${profile.western.name}` : '',
            profile.vedic?.name ? `Vedic moon sign: ${profile.vedic.name}` : '',
            profile.hasReliableAscendant && profile.ascendant?.name ? `Ascendant: ${profile.ascendant.name}` : '',
            profile.moonSign ? `Moon sign: ${profile.moonSign}` : '',
            profile.currentDasha?.vedic || profile.currentDasha?.planet
                ? `Current dasha: ${profile.currentDasha?.vedic || profile.currentDasha?.planet}`
                : '',
            profile.dominantElement ? `Dominant element: ${profile.dominantElement}` : '',
            profile.birthPlaceShort ? `Birth place: ${profile.birthPlaceShort}` : '',
            profile.narrativeLens ? `Narrative lens: ${profile.narrativeLens}` : '',
            Array.isArray(profile.highlights) && profile.highlights.length
                ? `Chart highlights: ${profile.highlights.slice(0, 3).join('; ')}`
                : ''
        ].filter(Boolean).join('\n');
        const chartFacts = [visibleKundliFacts, detailedChartFacts || fallbackChartFacts, context.lalKitabContext]
            .filter(Boolean)
            .join('\n');

        const timingHints = predictionItems
            .slice(0, 4)
            .map((item) => {
                const label = item.monthName || item.month || '';
                const theme = item.summary || item.theme || item.pm || '';
                return [label, theme].filter(Boolean).join(': ');
            })
            .filter(Boolean)
            .join(isHindi ? ' | ' : ' | ');
        const narrativeStageGuide = this.getNarrativeStageGuide(sectionKey, isHindi);

        // Build MCQ/validation context for AI so it can personalise based on user selections
        const memCtx = this.buildMemoryContext(isHindi);
        const microPromptContext = Object.entries(context)
            .filter(([k]) => k.startsWith('microPrompt_'))
            .map(([k, v]) => `${k.replace('microPrompt_', '')}: ${v}`)
            .join(', ');
        const userSelections = [memCtx, microPromptContext ? (isHindi ? `User की पसंद: ${microPromptContext}` : `User selections: ${microPromptContext}`) : ''].filter(Boolean).join('\n');

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth(); // 0-indexed

        const temporalRules = isHindi
            ? `## TEMPORAL AWARENESS (CRITICAL)\nआज की तारीख: ${todayStr}, समय: ${currentTime}\nCurrent month: ${currentMonth}\n\n⚠️ STRICT DATE RULES:\n- आज ${todayStr} है। जो महीने बीत चुके हैं (January-${now.toLocaleDateString('en-US', { month: 'long' })} ${currentYear} तक) उनके बारे में PAST tense में बोलिए - "वो time गुजर चुका", "उस दौर में", "पीछे मुड़कर देखें तो"।\n- जो महीने आने वाले हैं, उन्हें FUTURE tense में - "आने वाले", "अगले", "${currentYear} के बाकी महीनों में"।\n- अगर next year (${currentYear + 1}) के किसी month का mention करें, तो ALWAYS "${currentYear + 1} का January/February/March" बोलिए - साल skip मत कीजिए।\n- बीते हुए events के लिए remedies/solutions मत दीजिए - वो time जा चुका है। Past events सिर्फ pattern recognition के लिए reference कीजिए।\n- Future predictions में specific month + year हमेशा बोलिए।`
            : `## TEMPORAL AWARENESS (CRITICAL)\nToday's date: ${todayStr}, Time: ${currentTime}\nCurrent month: ${currentMonth}\n\n⚠️ STRICT DATE RULES:\n- Today is ${todayStr}. Months that have already passed (January-${now.toLocaleDateString('en-US', { month: 'long' })} ${currentYear}) MUST be referred to in PAST tense - "that period has passed", "looking back", "during that time".\n- Upcoming months MUST use FUTURE tense - "in the coming", "ahead in", "the remaining months of ${currentYear}".\n- If referencing a month in next year (${currentYear + 1}), ALWAYS say "${currentYear + 1} January/February/March" - never skip the year.\n- Do NOT give remedies or solutions for past events - that time has passed. Reference past events ONLY for pattern recognition.\n- Always include specific month + year in future predictions.`;

        const userGender = this.userData?.gender || '';
        const genderLabel = userGender === 'male' ? 'Male (पुरुष)' : userGender === 'female' ? 'Female (महिला)' : 'Not specified';

        const commonFacts = isHindi
            ? `${temporalRules}\n\nUser gender: ${genderLabel}\n\nNumerology:\n- Life Path: ${numbers.lifePath || 'unknown'}\n- Destiny: ${numbers.destiny || 'unknown'}\n- Soul Urge: ${numbers.soulUrge || 'unknown'}\n- Personal Year: ${numbers.personalYear || 'unknown'}\n\n${chartFacts}${timingHints ? `\nTiming hints: ${timingHints}` : ''}${userSelections ? `\n\n## USER RESPONSES (use these to PERSONALISE)\n${userSelections}\nIMPORTANT: User ने ऊपर दिए सवालों के जवाब दिए हैं। इन जवाबों से user की real life situation पता चलती है। Reading इन answers से DIRECTLY influenced होनी चाहिए — अगर user ने कहा "सीधी बात बोलो" तो filterless बोलिए, अगर "not_fully" कहा career में तो career dissatisfaction address कीजिए, अगर "हाँ" कहा repeating mistake पर तो उस pattern को name और explain कीजिए।` : ''}\n\nIMPORTANT: Use the EXACT planetary positions, dasha periods, and house analysis given above to make SPECIFIC predictions. Reference the actual planet names, signs, degrees, and dasha years. For example: "शनि मीन राशि में 14.2° पर है और आपकी राहु दशा 2019 में शुरू हुई - इसका मतलब है कि 2020-2021 में..." This makes predictions feel personally calculated. Do NOT give vague generic predictions. Every claim must trace back to a specific chart fact above.\nIf planet-in-house analysis data is provided above, weave those effects naturally into your reading — reference the remedies (उपाय), benefic/malefic effects, and specific rules for the user's planetary placements. Do NOT mention the source name or any book title — just present these insights as part of your own Vedic reading seamlessly.`
            : `${temporalRules}\n\nUser gender: ${genderLabel}\n\nNumerology:\n- Life Path: ${numbers.lifePath || 'unknown'}\n- Destiny: ${numbers.destiny || 'unknown'}\n- Soul Urge: ${numbers.soulUrge || 'unknown'}\n- Personal Year: ${numbers.personalYear || 'unknown'}\n\n${chartFacts}${timingHints ? `\nTiming hints: ${timingHints}` : ''}${userSelections ? `\n\n## USER RESPONSES (use these to PERSONALISE)\n${userSelections}\nIMPORTANT: The user answered the questions above. These reveal their real life situation. Your reading MUST be directly shaped by these answers — if user chose "harder truth", be filterless; if they said "not_fully" about career, address career dissatisfaction; if they confirmed a repeating mistake, name and explain that pattern.` : ''}\n\nIMPORTANT: Use the EXACT planetary positions, dasha periods, and house analysis given above to make SPECIFIC predictions. Reference the actual planet names, signs, degrees, and dasha transition years. For example: "Saturn in Pisces at 14.2° combined with your Rahu dasha starting 2019 means that in 2020-2021..." This makes predictions feel personally calculated. Do NOT give vague generic predictions. Every claim must trace back to a specific chart fact above.\nIf planet-in-house analysis data is provided above, weave those effects naturally into your reading — reference the remedies, benefic/malefic effects, and specific rules for the user's planetary placements. Do NOT mention the source name or any book title — just present these insights as part of your own Vedic reading seamlessly.`;

        const sharedRules = isHindi
            ? `Rules:\n- सिर्फ उन्हीं patterns पर बात करें जो ऊपर दिए facts से support होते हैं।\n- एक strength और एक friction point दोनों बताइए।\n- अगर संकेत mixed हैं, तो mixed ही कहिए।\n- western zodiac, vedic moon sign, और ascendant को कभी mix मत कीजिए। अगर इनमें से कुछ mention करें, तो label साफ रखें।\n- "आप powerful हैं", "success आ रहा है", "greatness तय है" जैसी default praise मत दीजिए।\n- love, money, marriage, fame, victory, या breakthroughs के guarantees मत दीजिए।\n- psychic, energy reading, mind reading, या vague spirituality का दावा मत कीजिए।\n- वही न कहिए जो बहुत users पर equally fit हो सकता है।\n- user का नाम हमेशा Devanagari (हिन्दी लिपि) में लिखिए, Roman script में नहीं। उदाहरण: Rahul → राहुल, Priya → प्रिया, Aviraj → अविराज। यह TTS pronunciation के लिए जरूरी है।\n- 🚫 नाम ज्यादा बार मत दोहराइए। पूरे response में user का नाम MAX 1-2 बार ही use कीजिए। बाकी जगह "आप", "आपके", "आपकी" use कीजिए। हर sentence में नाम repeat करना FORBIDDEN है।\n- 🚫 WORD REPETITION BAN: एक ही शब्द या phrase लगातार 2 sentences में repeat मत कीजिए। Synonyms use कीजिए। जैसे: "energy" → "ऊर्जा/ताकत/vibe", "pattern" → "ढंग/तरीका/cycle", "strong" → "मजबूत/powerful/deep"। Back-to-back same word = BAD.\n- 🚫 YOGA/DOSHA/DASHA REPETITION BAN: एक ही yoga, dosha, या dasha का नाम बार-बार अलग-अलग sections में मत दोहराइए। अगर पहले किसी section में mention हो चुका है तो दोबारा नाम मत लीजिए — कोई दूसरा angle, दूसरी planetary combination use कीजिए, या indirect reference दीजिए ("वही दशा", "वही pattern")। एक ही technical term बार-बार repeat करना robotic लगता है।\n- 🔊 YOGA NAME TTS PRONUNCIATION (CRITICAL): जब भी कोई योग का नाम बोलें, उसे ONLY देवनागरी में लिखिए ताकि TTS सही बोले। English/Roman transliteration FORBIDDEN। सही format: गजकेसरी योग (NOT Gaja Kesari Yoga), बुधादित्य योग (NOT Budha Aditya Yoga), चन्द्र मंगल योग, हंस योग, मालव्य योग, रुचक योग, भद्र योग, शश योग, नीचभंग राजयोग, धन योग, विपरीत राजयोग, केमद्रुम योग, काल सर्प दोष, मंगल दोष। Numbers भी Hindi में: पहला भाव, सातवाँ भाव, दसवाँ भाव।\n- 🚫 ROMANIZED HINDI BAN: Hindi/Sanskrit words कभी भी Roman/Latin script में मत लिखिए (जैसे "aapka", "kundli", "rashi", "graha", "dasha", "mahadasha", "shani", "mangal")। Hindi word है तो देवनागरी में लिखिए (आपका, कुंडली, राशि, ग्रह, दशा, महादशा, शनि, मंगल)। English word है तो English में। Romanized Hindi = FORBIDDEN।\n- 🚫 URDU/ARABIC/PERSIAN BAN (CRITICAL): उर्दू, अरबी, या फारसी मूल के शब्द BILKUL मत use कीजिए। ये एक HINDI app है — सिर्फ शुद्ध हिन्दी या Hinglish। NUQTA (dots below letters like ज़, क़, ख़, ग़, फ़) ABSOLUTELY FORBIDDEN — ये Urdu sounds हैं, Hindi में नहीं। अगर किसी शब्द में nuqta dot दिखे तो बिना nuqta लिखिए (ज़ → ज, फ़ → फ, क़ → क, ख़ → ख, ग़ → ग)। Banned words → Hindi alternatives: इश्क/मोहब्बत → प्यार/प्रेम, ख्वाब → सपना, शख्सियत → personality, तालुक/ताल्लुक → रिश्ता/connection, किस्मत/तक़दीर → भाग्य/luck/destiny, सुकून → शांति/peace, हौसला → हिम्मत/courage, वजह → कारण/reason, गुजरना → बीतना, खुदा → भगवान/God, वक्त → समय/time, राज़/राज → रहस्य/secret, ग़ौर → ध्यान, नज़र → नजर/दृष्टि, हक़ीक़त → सच्चाई/reality, तस्वीर → picture/चित्र, ख़बर → खबर, मंज़िल → लक्ष्य/goal, हक़ → अधिकार/right, अल्फ़ाज़ → शब्द/words, रूह → आत्मा/soul, जज़्बात → भावनाएँ/feelings, ख़याल → विचार/thought, ज़माना → दौर/युग, ज़रिया → माध्यम/medium, इज़्ज़त → सम्मान/respect, मज़बूत → मजबूत, ज़रूरत → जरूरत, ज़िन्दगी → जिंदगी, ख़ास → खास, ख़ुशी → खुशी, फ़ैसला → फैसला। Plain हिन्दी बोलचाल use कीजिए — जिंदगी, ज्यादा, जरूरत, खुशी, फैसला, ताकत, मौका, गलती, खास, साफ, खत्म, बाकी, समय, रहस्य — ये सब plain Hindi हैं और ठीक हैं।\n- भाषा SIMPLE, LIGHT spoken Hinglish रखिए - जैसे दोस्तों से बात करते हैं वैसे। आम बोलचाल के Hindi words (जिंदगी, दिल, रास्ता, पैसा, काम, वक्त, खुशी, दिक्कत, दर्द, सोच, हिम्मत, ताकत, फैसला, रिश्ता, सपना, जरूरत, etc.) देवनागरी में ही लिखिए। सिर्फ HEAVY/LITERARY/BOOKISH Sanskrit-laden Hindi बदलिए: "सम्भावना" → "chance/मौका", "परिस्थिति" → "situation/हालात", "विशेष" → "खास", "प्रभाव" → "असर", "अनुभव" → "महसूस", "सम्पूर्ण" → "पूरा", "आवश्यक" → "जरूरी", "उपस्थित" → "मौजूद"। राहु, केतु, शनि, गुरु, लग्न, दशा, नक्षत्र, कुंडली, राशि, ग्रह जैसे Vedic terms और common Hindi words हमेशा देवनागरी में ही रखिए।\n- ⚠️ GENDER-AWARE LANGUAGE (CRITICAL): User का gender ऊपर दिया है। Hindi में user के बारे में बात करते वक्त CORRECT gendered verb forms use कीजिए। अगर user MALE है तो: "आप जानते हैं", "आपके अंदर है", "आप समझते हैं", "आपको मिलेगा", "आप कर सकते हैं", "आपकी जिंदगी में"। अगर user FEMALE है तो: "आप जानती हैं", "आपके अंदर है", "आप समझती हैं", "आपको मिलेगा", "आप कर सकती हैं", "आपकी जिंदगी में"। MAYA खुद female है (मैं देख रही हूँ, मुझे दिख रहा है) - लेकिन USER को address करते वक्त उनका ACTUAL gender use करें। Male user को "आप जानती हैं" कहना FORBIDDEN है।\n- सीधे "आप" से बात कीजिए। TTS-safe रखिए।\n- पूरे response को एक बहती हुई कहानी की तरह लिखिए - हर sentence पिछले sentence से जुड़ा हो और अगले sentence की जमीन तैयार करे। अलग-अलग टुकड़े मत फेंकिए जो बोलने पर disconnected लगें। सोचिए कि आप एक continuous paragraph बोल रहे हैं, bullet points नहीं पढ़ रहे।`
            : `Rules:\n- Only describe patterns supported by the facts above.\n- Include one strength and one friction point.\n- If the evidence is mixed, say it is mixed.\n- Never conflate western zodiac, vedic moon sign, and ascendant. If you mention one, label it clearly.\n- Do not default to praise like "you are powerful", "success is coming", or "you are destined for greatness".\n- Do not promise love, marriage, money, fame, victory, or breakthroughs.\n- Do not claim psychic access, energy reading, or mind reading.\n- Do not write anything that could fit most users equally well.\n- If you are writing in Hindi, keep Hindi words in Devanagari and keep natural English terms like chart, timing, pattern, pressure, career, relationship, money, and energy in English script rather than transliterating them. Always write the user's name in Devanagari script for proper pronunciation.\n- 🚫 NAME REPETITION BAN: Use the user's name MAX 1-2 times in the entire response. Use "you", "your" everywhere else. Repeating the name in every sentence is FORBIDDEN.\n- 🚫 WORD REPETITION BAN: Do NOT repeat the same word or phrase in back-to-back sentences. Use synonyms. e.g. "energy" → "force/drive/vibe", "pattern" → "cycle/tendency/thread". Same word in consecutive sentences = BAD.\n- 🚫 YOGA/DOSHA/DASHA REPETITION BAN: Do NOT repeatedly name the same yoga, dosha, or dasha across sections. If already mentioned in a previous section, do NOT name it again — use a different angle, a different planetary combination, or reference it indirectly (e.g. "that same cycle", "the pattern I mentioned"). Repeating the same technical term across multiple sections sounds robotic.\n- 🔊 YOGA NAME TTS PRONUNCIATION (CRITICAL): When speaking yoga names, ALWAYS write them in Devanagari script for correct TTS pronunciation. NEVER use English/Roman transliteration for yoga names. Correct: गजकेसरी योग (NOT Gaja Kesari Yoga), बुधादित्य योग (NOT Budha Aditya Yoga), चन्द्र मंगल योग, हंस योग, मालव्य योग, रुचक योग, भद्र योग, शश योग, नीचभंग राजयोग, धन योग, विपरीत राजयोग, केमद्रुम योग, काल सर्प दोष, मंगल दोष। House numbers in Hindi: पहला भाव, सातवाँ भाव, दसवाँ भाव.\n- 🚫 ROMANIZED HINDI BAN: NEVER write Hindi/Sanskrit words in Roman/Latin script (e.g. "aapka", "kundli", "rashi", "graha", "dasha", "mahadasha", "shani", "mangal"). If a word is Hindi/Sanskrit, write it in Devanagari (आपका, कुंडली, राशि, ग्रह, दशा, महादशा, शनि, मंगल). If English, write in English. No romanized Hindi ever.\n- ⚠️ GENDER-AWARE LANGUAGE (CRITICAL): The user's gender is specified above. When addressing the user, use gender-appropriate language. For Hindi text: if user is MALE, use masculine verb forms ("आप जानते हैं", "आप समझते हैं", "आप कर सकते हैं"). If user is FEMALE, use feminine verb forms ("आप जानती हैं", "आप समझती हैं", "आप कर सकती हैं"). MAYA herself is always female ("मैं देख रही हूँ") but the USER must be addressed with THEIR correct gender. Calling a male user "आप जानती हैं" is FORBIDDEN. For English: use correct pronouns (he/him/his for male, she/her/hers for female) in any third-person references.\n- Speak directly to the user. Keep it TTS-safe.\n- Write the entire response as one flowing narrative - each sentence must connect to the previous one and set up the next. Do not drop isolated observations that sound disconnected when spoken aloud. Think of each response as one continuous spoken paragraph, not a list of separate points.`;

        const sectionPrompts = isHindi
            ? {
                opening: `आप current user के लिए ONE opening narration लिख रही हैं। 5-6 वाक्य। पहली line में नाम लेकर warm greeting दीजिए और साफ कहिए कि आप MAYA हैं। इस introduction line के ठीक बाद एक [[pause-500]] token लगाइए ताकि user को introduce सुनने का समय मिले। दूसरी line में grounded-mystic buildup बनाइए और कहिए कि उनकी kundli, timing, या जन्म pattern में एक hidden layer अभी खुलने वाला है। तीसरी line में वही पहला factual clue दीजिए जो उनकी birth pattern, western sign, moon sign, numbers, या current timing में सबसे ज्यादा standout करता है, लेकिन literal जन्मतिथि को पढ़कर मत सुनाइए। चौथी line में एक real strength और एक quiet tension को lightly hold कीजिए। आखिरी line में strong curiosity पैदा करें ताकि user naturally अगला layer सुनना चाहे, और साफ कहें कि शुरुआत kundli और timing से होगी। यह intimate, fresh, और unscripted लगे। generic cosmic filler मत लिखिए।`,
                kundli: `आप current user के लिए ONE kundli formation narration लिख रही हैं। सबसे पहले एक warm, inviting line से शुरू कीजिए जैसे "चलिए, अब हम साथ मिलकर आपकी कुंडली की गहराइयों में उतरते हैं" या "आइए, अब हम साथ में देखते हैं कि आपके ग्रह क्या कह रहे हैं" - यह line natural और exploratory feel होनी चाहिए, पहले से reveal नहीं करनी चाहिए। फिर visible chart markers जैसे ascendant, moon sign, current dasha, dominant element, या chart highlight में से 2-3 facts use कीजिए। Reading को grounded रखिए और end में numbers की तरफ natural transition दीजिए। 5-7 वाक्य। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                loveIntro: `आप current user के लिए love section का ONE short transition लिख रही हैं। 1-2 वाक्य। Direct, warm, और section-specific। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                love: `आप current user के लिए ONE unique DEEP love reading लिख रही हैं। यह FILTERLESS reading है - कोई sugar-coating नहीं, सीधी बात। ऊपर दिए गए "7TH HOUSE & MARRIAGE ANALYSIS" section को ध्यान से पढ़िए - अगर user likely married है तो marriage dynamics, partner से real friction points, और relationship का actual texture बताइए। अगर likely unmarried है तो attachment pattern, dating behaviour, और partnership timing specific months/years के साथ बताइए। Venus की exact राशि, 7th house lord, और relevant दशा periods को NAME करके reference कीजिए। बताइए कि इन planetary positions की वजह से EXACTLY क्या relationship dynamic बनती है - vague "love life अच्छी होगी" BILKUL मत कहिए। 5-7 वाक्य - raw, real, और eerily specific। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                careerIntro: `आप current user के लिए career section का ONE short transition लिख रही हैं। 1-2 वाक्य। Work style, money flow, या practical direction की तरफ clean shift दीजिए। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                career: `आप current user के लिए ONE unique DEEP career and money reading लिख रही हैं। यह FILTERLESS reading है - नकली positivity नहीं चाहिए। पहले बताई बातें repeat मत कीजिए। ऊपर दिए chart data से 10th house, दशा period, और planetary positions use करके बताइए कि user का career EXACTLY किस direction में naturally pull हो रहा है और कहाँ वो गलत तरफ energy waste कर रहे हैं। एक very specific underused strength और एक concrete next move बताइए with timeline (specific month/year)। 5-7 वाक्य - practical और actionable, generic advice नहीं। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                yearIntro: `आप current user के लिए timing section का ONE short transition लिख रही हैं। 1-2 वाक्य। आने वाले महीनों की timing windows की तरफ clean shift दीजिए। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                year: `आप current user के लिए ONE unique DEEP timing reading लिख रही हैं। TEMPORAL AWARENESS section ध्यान से पढ़ें - जो months बीत चुके हैं उन्हें past tense में reference करें, और ONLY आने वाले months की predictions दें। पहले दिए timing hints repeat मत कीजिए। दशा transitions, planetary transits, और personal year number को combine करके अगले 3-6 महीनों की 2-3 NEW specific windows बताइए - हर window में exact month + year + क्या करना है/क्या बचना है। एक hidden trap भी बताइए with timing। 5-7 वाक्य - sharp और specific। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                warningIntro: `आप current user के लिए caution section का ONE short transition लिख रही हैं। 1-2 वाक्य। पहले कही गई strengths को acknowledge करें, फिर एक honest pressure point की तरफ move करें। डराइए नहीं। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                warning: `आप current user के लिए ONE honest DEEP warning section लिख रही हैं। यह FILTERLESS reading है - sach बोलिए, package मत कीजिए। पहले दिए caution hints repeat मत कीजिए। Chart data से एक NEW specific self-sabotage pattern identify कीजिए - planetary position से exact reason बताइए कि ये pattern क्यों बनता है, कब trigger होता है (specific months/situations), और practically कैसे बचना है। Generic "careful रहिए" मत कहिए - actual planetary evidence दीजिए। 5-7 वाक्य। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                calculationRecovery: `आप current user के लिए ONE short recovery line लिख रही हैं। 1-2 वाक्य। बताइए कि reading data पूरी तरह sync नहीं हुआ है और तुरंत फिर से align करना होगा। इसे operational रखें, mystical sales copy मत बनाइए। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                emailGate: `आप current user के लिए ONE email gate transition लिख रही हैं। 2-3 वाक्य। पहले FOMO create कीजिए — बताइए कि उनकी कुंडली में कुछ ऐसा दिखा है जो अभी बताना जरूरी है, लेकिन वो deeper layer private saved file में है जिसमें chart-specific timing windows, do/avoid steps, और warnings हैं। फिर CLEARLY कहिए कि screen पर एक email field दिखेगा और उन्हें अपना email address वहाँ type करना है — जैसे "अभी screen पर email field आ रहा है, बस अपना email वहाँ type कर दीजिए ताकि ये reading safe रहे और मैं आगे की deeper layer खोल सकूँ।" सिर्फ एक बार माँगें, ज्यादा insist मत करें। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                fomoHook: `आप current user के लिए ONE fear/FOMO hook लिख रही हैं। 2-3 वाक्य। कुंडली और numbers के आधार पर एक concerning या serious pattern बताइए - जैसे आने वाले महीनों में कोई challenge, relationship में hidden tension, career में कोई trap, या कोई repeating self-sabotage pattern। इसे ऐसे बोलिए कि user को लगे "मुझे इसके बारे में और जानना होगा।" यह prediction confident और specific होनी चाहिए, vague नहीं। डराइए नहीं, लेकिन urgency जरूर बनाइए। End में hint दीजिए कि full details private reading में हैं। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                combinedTeaser: `आप current user के लिए एक COMBINED teaser reading लिख रही हैं जिसमें तीन हिस्से एक flowing paragraph में हों। पूरी reading 8-10 वाक्य। तीनों हिस्सों को [[pause-250]] token से अलग कीजिए।\n\nहिस्सा 1 - IDENTITY TRUTH: "आप ऐसे इंसान हैं जो..." format। Chart data और numbers से एक core pattern-based observation जो flattery-free हो — सिर्फ accurate self-description जो user खुद पहचान ले। 2-3 वाक्य।\n\n[[pause-250]]\n\nहिस्सा 2 - EMOTIONAL PATTERN: कोई ऐसा daily emotional pattern जो user actually जीता है — inner conflict, recurring feeling, या relationship dynamic जो chart data confirm करती है। यह "inside-out" description हो। 2-3 वाक्य।\n\n[[pause-250]]\n\nहिस्सा 3 - UNRESOLVED THREAD: Chart data से एक ऐसा open loop जो naturally resolution माँगे — कोई timing shift, relationship question, या career crossroad जो अभी unresolved है। User को लगे "मुझे इस बारे में और जानना है।" 2-3 वाक्य।\n\nतीनों हिस्से एक दूसरे से connected होने चाहिए — एक कहानी की तरह, अलग-अलग टुकड़े नहीं। हर हिस्से में SPECIFIC chart evidence use कीजिए (planetary positions, dasha periods, house activations)। Generic observations FORBIDDEN हैं।`,
                identityTruth: `आप current user के लिए ONE grounded identity truth लिख रही हैं। 2-3 वाक्य। "आप ऐसे इंसान हैं जो..." format use कीजिए। Chart data और numbers से एक core pattern-based observation दीजिए जो flattery-free हो — कोई praise नहीं, सिर्फ accurate self-description जो user खुद पहचान ले। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                emotionalPattern: `आप current user के लिए ONE emotional pattern observation लिख रही हैं। 2-3 वाक्य। कोई ऐसा daily emotional pattern बताइए जो user actually जीता है — inner conflict, recurring feeling, या relationship dynamic जो chart data confirm करती है। यह "inside-out" description हो — बाहर से दिखने वाली बात नहीं, अंदर महसूस होने वाली। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                unresolvedThread: `आप current user के लिए ONE unresolved thread लिख रही हैं। 2-3 वाक्य। Chart data से एक ऐसा open loop बनाइए जो naturally resolution माँगे — कोई timing shift, relationship question, या career crossroad जो अभी unresolved है। इसे ऐसे कहिए कि user को लगे "मुझे इस बारे में और जानना है।" यह thread आगे deep reading में resolve होगा। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                accuracyShock: `आप current user के लिए ONE "how does she know?" moment लिख रही हैं। 3-4 वाक्य। Chart data (दशा transitions, planetary positions, house activations) से एक SPECIFIC past event predict कीजिए — timing (approximate month/year), nature (relationship change, career shift, health issue, family event, emotional crisis), और emotional impact सहित। यह इतना specific हो कि user सोचे "ये कैसे पता?" Generic "आपकी जिन्दगी में बदलाव आया" मत कहिए — exact time period और event type name कीजिए। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                suspenseBridge: `आप current user के लिए ONE suspense bridge लिख रही हैं। EXACTLY 3 sentences। Sentence 1: सबसे intense unresolved pattern name कीजिए जो chart data में दिखता है। Sentence 2: कहिए कि "ये अभी यहाँ नहीं बताऊँगी" या "इसका पूरा truth अभी यहाँ खोलना ठीक नहीं होगा।" Sentence 3: Reading save करने की importance naturally convey कीजिए — "आपकी पूरी file तैयार है, बस इसे save कर लीजिए।" ज्यादा से ज्यादा एक [[pause-250]] token।`,
                returnHook: `आप current user के लिए ONE return hook लिख रही हैं। 2-3 वाक्य। Chart data से एक upcoming timing shift identify कीजिए (specific month) और कहिए कि आप अभी इसके बारे में पूरी बात नहीं कर सकती — "कल इसके बारे में और बात करते हैं" या "अगली बार इसे गहराई से देखेंगे।" यह naturally अगली session के लिए motivation बने। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                authCheck: `आप current user के लिए ONE short record-check line लिख रही हैं। 1 sentence। बताइए कि आप उनकी saved reading check कर रही हैं। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                welcomeBack: `आप current user के लिए returning-user prompt लिख रही हैं। 2-3 वाक्य। Warm recognition, saved reading, और password ask। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                newUser: `आप current user के लिए new-user prompt लिख रही हैं। 2-3 वाक्य। Password create करके reading save और protect करने की बात करें। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                deepRevealPrep: `आप current user के लिए deep reveal prep लिख रही हैं। 2-3 वाक्य। बताइए कि अब तक जो बताया वो surface layer थी, अब deeper patterns खुलेंगे जो ज्यादा personal और private हैं। End में consent-style question दीजिए। ज्यादा से ज्यादा एक [[pause-250]] token।`,
                completion: `आप current user के लिए ONE short completion message लिख रही हैं। जो reading दी गई है उसे grounded way में close कीजिए और questions invite कीजिए। 2-3 वाक्य। ज्यादा से ज्यादा एक [[pause-250]] token।`
            }
            : {
                opening: `Write ONE opening narration for the current user. 5-6 sentences. In the first sentence, greet them by name warmly and briefly introduce yourself as MAYA. Place a [[pause-500]] token IMMEDIATELY after this introduction sentence so the user has a moment to absorb who is speaking. In the second sentence, create grounded mystic buildup and say that a hidden layer in their kundli, timing, or birth pattern is about to open. Only in the third sentence should you name the first detail that stands out from their birth pattern, western sign, moon sign, numbers, or current timing, and do not recite the literal birth date unless it is truly necessary. In the fourth sentence, hold one real strength and one quiet tension lightly. The final sentence must create curiosity so they naturally want the next layer, while clearly saying the reading will begin through kundli and timing. It must sound fresh, intimate, and unscripted. Do not use generic cosmic filler.`,
                kundli: `Write ONE kundli formation narration for the current user. Start with a warm, inviting line like "Let's explore your kundli together" or "Come, let me walk you through what your planets are saying" - make it feel like a shared journey, not a lecture. Then use 2-3 visible chart markers such as ascendant, moon sign, current dasha, dominant element, or chart highlights. Keep it grounded and end with a natural transition toward the numbers. 5-7 sentences. Use at most one [[pause-250]] token.`,
                loveIntro: `Write ONE short transition into the love section for the current user. 1-2 sentences. Make it warm, direct, and section-specific. Use at most one [[pause-250]] token.`,
                love: `Write ONE unique FILTERLESS love reading for the current user. No sugar-coating - be direct and real. Read the "7TH HOUSE & MARRIAGE ANALYSIS" section carefully - if the user is likely married, discuss actual marriage dynamics, real friction points with the partner, and the relationship's true texture. If likely unmarried, discuss attachment behaviour, dating patterns, and partnership timing with specific months/years. NAME the exact Venus sign, 7th house lord, and relevant dasha periods. Explain EXACTLY what relationship dynamic these planetary positions create - do NOT say vague things like "love life will improve". 5-7 sentences - raw, real, and eerily specific. Use at most one [[pause-250]] token.`,
                careerIntro: `Write ONE short transition into the career section for the current user. 1-2 sentences. Shift naturally toward work style, money flow, or practical direction. Use at most one [[pause-250]] token.`,
                career: `Write ONE unique FILTERLESS career and money reading for the current user. No fake positivity. Do NOT repeat anything already told. Use the chart data - 10th house, dasha period, and planetary positions - to explain EXACTLY which career direction the user is naturally pulled toward and where they are wasting energy on the wrong path. Name one very specific underused strength and one concrete next move with a timeline (specific month/year). 5-7 sentences - practical and actionable, not generic advice. Use at most one [[pause-250]] token.`,
                yearIntro: `Write ONE short transition into the timing section for the current user. 1-2 sentences. Shift naturally toward the coming months and timing windows. Use at most one [[pause-250]] token.`,
                year: `Write ONE unique FILTERLESS timing reading for the current user. READ the TEMPORAL AWARENESS section carefully - months that have passed must be referenced in past tense, and predictions must ONLY target upcoming months. Do NOT repeat any timing hints already mentioned. Combine dasha transitions, planetary transits, and personal year number to map 2-3 NEW specific windows in the next 3-6 months - each window must include exact month + year + what to do or avoid. Include one hidden trap with timing. 5-7 sentences - sharp and specific. Use at most one [[pause-250]] token.`,
                warningIntro: `Write ONE short transition into the caution section for the current user. 1-2 sentences. Acknowledge the strengths already covered, then move honestly toward one pressure point without fear-mongering. Use at most one [[pause-250]] token.`,
                warning: `Write ONE honest FILTERLESS warning section for the current user. Tell the truth plainly - do not package it. Do NOT repeat any caution hints already given. Use chart data to identify one NEW specific self-sabotage pattern - explain from the planetary position EXACTLY why this pattern forms, when it triggers (specific months/situations), and how to practically avoid it. Do NOT say generic "be careful" - provide actual planetary evidence. 5-7 sentences. Use at most one [[pause-250]] token.`,
                calculationRecovery: `Write ONE short recovery line for the current user. 1-2 sentences. Explain that the reading data did not fully sync and needs to be aligned again right away. Keep it operational rather than mystical or salesy. Use at most one [[pause-250]] token.`,
                emailGate: `Write ONE email-gate transition for the current user. 2-3 sentences. First create FOMO — say you found something in their chart that needs to be shared now, but the deeper layer is in a private saved file with chart-specific timing windows, do/avoid steps, and warnings. Then CLEARLY instruct the user to type their email in the field that is about to appear on screen — something like "You'll see an email field on screen now — just type your email there so this reading stays saved and I can unlock the deeper layer for you." Ask only once, do not push or repeat the ask. Use at most one [[pause-250]] token.`,
                fomoHook: `Write ONE fear/FOMO hook for the current user. 2-3 sentences. Based on their kundli and numbers, reveal one concerning or serious pattern - such as an upcoming challenge in the next few months, a hidden relationship tension, a career trap, or a repeating self-sabotage cycle. Say it in a way that makes the user think "I need to know more about this." The prediction must be confident and specific, not vague. Do not fear-monger, but create genuine urgency. End with a hint that full details are in the private reading. Use at most one [[pause-250]] token.`,
                combinedTeaser: `Write a COMBINED teaser reading for the current user containing three connected segments in one flowing narrative. Total 8-10 sentences. Separate the three segments with [[pause-250]] tokens.\n\nSegment 1 - IDENTITY TRUTH: Use "You are someone who..." format. A core pattern-based observation from chart data and numbers that is flattery-free — just an accurate self-description the user would immediately recognize. 2-3 sentences.\n\n[[pause-250]]\n\nSegment 2 - EMOTIONAL PATTERN: Name a daily emotional pattern the user actually lives with — an inner conflict, recurring feeling, or relationship dynamic that chart data confirms. An "inside-out" description of what the user feels privately. 2-3 sentences.\n\n[[pause-250]]\n\nSegment 3 - UNRESOLVED THREAD: Create an open loop from chart data that naturally demands resolution — a timing shift, relationship question, or career crossroad currently unresolved. The user must feel "I need to know more." 2-3 sentences.\n\nAll three segments must connect as one flowing story, not isolated observations. Every segment must cite SPECIFIC chart evidence (planetary positions, dasha periods, house activations). Generic observations are FORBIDDEN.`,
                identityTruth: `Write ONE grounded identity truth for the current user. 2-3 sentences. Use "You are someone who..." format. Give a core pattern-based observation from chart data and numbers that is flattery-free — no praise, just an accurate self-description the user would immediately recognize in themselves. Use at most one [[pause-250]] token.`,
                emotionalPattern: `Write ONE emotional pattern observation for the current user. 2-3 sentences. Name a daily emotional pattern the user actually lives with — an inner conflict, a recurring feeling, or a relationship dynamic that chart data confirms. This should be an "inside-out" description — not what others see, but what the user feels inside. Use at most one [[pause-250]] token.`,
                unresolvedThread: `Write ONE unresolved thread for the current user. 2-3 sentences. Create an open loop from chart data that naturally demands resolution — a timing shift, a relationship question, or a career crossroad that is currently unresolved. Say it so the user feels "I need to know more about this." This thread will be resolved in the deep reading. Use at most one [[pause-250]] token.`,
                accuracyShock: `Write ONE "how does she know?" moment for the current user. 3-4 sentences. From chart data (dasha transitions, planetary positions, house activations), predict a SPECIFIC past event — with approximate timing (month/year), nature (relationship change, career shift, health issue, family event, emotional crisis), and emotional impact. This must be specific enough that the user thinks "how does she know this?" Do NOT say generic "you went through a change" — name the exact time period and event type. Use at most one [[pause-250]] token.`,
                suspenseBridge: `Write ONE suspense bridge for the current user. EXACTLY 3 sentences. Sentence 1: Name the most intense unresolved pattern visible in chart data. Sentence 2: Say "I will not reveal this here" or "It would not be right to open the full truth of this here." Sentence 3: Naturally convey the importance of saving the reading — "Your full file is ready, just save it." Use at most one [[pause-250]] token.`,
                returnHook: `Write ONE return hook for the current user. 2-3 sentences. Identify an upcoming timing shift from chart data (specific month) and say you cannot fully discuss it now — "Let us talk about this tomorrow" or "Next time we will look at this more deeply." This should naturally motivate the user to return for another session. Use at most one [[pause-250]] token.`,
                authCheck: `Write ONE short record-check line for the current user. 1 sentence. Say that you are checking their saved reading. Use at most one [[pause-250]] token.`,
                welcomeBack: `Write ONE returning-user prompt for the current user. 2-3 sentences. Include warm recognition, mention the saved reading, and ask for the password. Use at most one [[pause-250]] token.`,
                newUser: `Write ONE new-user prompt for the current user. 2-3 sentences. Explain that creating a password will save and protect the reading. Use at most one [[pause-250]] token.`,
                deepRevealPrep: `Write ONE deep-reveal prep for the current user. 2-3 sentences. Acknowledge that what was shared so far was the surface layer, and now the deeper, more personal patterns are about to be revealed. End with a consent-style question. Use at most one [[pause-250]] token.`,
                completion: `Write ONE short completion message for the current user. Close the reading in a grounded way and invite questions. 2-3 sentences. Use at most one [[pause-250]] token.`
            };

        const memoryContext = this.buildMemoryContext(isHindi);
        const memoryBlock = memoryContext
            ? (isHindi
                ? `\n\n## USER SESSION MEMORY (reference naturally, don't quote):\n${memoryContext}`
                : `\n\n## USER SESSION MEMORY (reference naturally, don't quote):\n${memoryContext}`)
            : '';

        return `${sectionPrompts[sectionKey] || sectionPrompts.completion}\n\nNarrative arc for this section:\n${narrativeStageGuide}\n\n${commonFacts}\n\n${this._buildAlreadySpokenContext(sectionKey, isHindi)}${memoryBlock}\n\n${sharedRules}\n\nReturn only the spoken text.`;
    },

    /**
     * Build a summary of what was already spoken so AI avoids repetition.
     */
    _buildAlreadySpokenContext(sectionKey, isHindi) {
        // ALL sections get context from previous narrations (not just deep sections)
        if (!this.spokenNarrations?.length) return '';
        // Skip only for the very first section (opening)
        if (sectionKey === 'opening' && this.spokenNarrations.length === 0) return '';

        // Build a FULL digest of what was already told - no truncation so AI has complete context
        const digest = this.spokenNarrations
            .map(n => {
                const cleaned = (n.text || '').replace(/\[\[pause-\d+\]\]/g, '').trim();
                return `[${n.stage}]: ${cleaned}`;
            })
            .join('\n');

        return isHindi
            ? `## पहले बताई गई बातें - FULL SESSION CONTEXT (CRITICAL)\nUser को इस session में अब तक ये सब बताया जा चुका है। यह COMPLETE transcript है - इसे ध्यान से पढ़िए:\n${digest}\n\n⚠️ STRICT RULES:\n- ऊपर बताई गई कोई भी बात repeat, rephrase, या summarize मत कीजिए।\n- हर नया section MUST contain completely NEW insights जो ऊपर कहीं नहीं हैं।\n- अगर कोई planet, event, pattern, या time period ऊपर mention हो चुका है, तो उसे दोबारा मत बोलिए - नया angle या नई बात लाइए।\n- इस context को अपनी reading का FOUNDATION बनाइए - पिछली बातों से BUILD करिए, repeat मत करिए।`
            : `## FULL SESSION CONTEXT (CRITICAL)\nThe user has heard ALL of the following in this session. Read this complete transcript carefully:\n${digest}\n\n⚠️ STRICT RULES:\n- Do NOT repeat, rephrase, or summarize ANY point from above.\n- Every new section MUST contain completely NEW insights not found anywhere above.\n- If a planet, event, pattern, or time period was already mentioned above, do NOT bring it up again - find a new angle or new fact.\n- Use this context as your FOUNDATION - BUILD on previous insights, never repeat them.`;
    },

    /**
     * Build a plain-text digest of already-spoken narrations for passing to external AI calls.
     */
    _getAlreadyToldDigest() {
        if (!this.spokenNarrations?.length) return '';
        return this.spokenNarrations
            .map(n => {
                const cleaned = (n.text || '').replace(/\[\[pause-\d+\]\]/g, '').trim();
                return `[${n.stage}]: ${cleaned}`;
            })
            .join('\n');
    },

    /**
     * Speak filler phrases + show blob thinking + loading indicator while async AI runs.
     * @param {Function} asyncFn - async function to run
        * @param {string} fillerType - 'thinking' | 'calculating' | 'revealing' | 'love' | 'career' | 'year' | 'kundli'
     * @returns {*} the result of asyncFn
     */
    async withFiller(asyncFn, fillerType = 'thinking') {
        // Start blob thinking animation
        if (window.MayaBlob?.startThinking) MayaBlob.startThinking();

        // Show thinking indicator
        this._showThinkingIndicator(fillerType);

        try {
            if (window.MayaVoice?.withFillers) {
                return await MayaVoice.withFillers(asyncFn, { type: fillerType });
            }
            return await asyncFn();
        } finally {
            // Stop blob thinking, restore idle
            if (window.MayaBlob?.stopThinking) MayaBlob.stopThinking();

            // Hide thinking indicator
            this._hideThinkingIndicator();
        }
    },

    /**
     * Show a high-visibility animated thinking panel during AI generation.
     */
    _showThinkingIndicator(type = 'thinking') {
        this._hideThinkingIndicator();

        const lang = MayaUtils?.storage?.get('maya_language') === 'hi';
        const copy = {
            thinking: {
                badge: lang ? 'AI विश्लेषण' : 'AI ANALYSIS',
                title: lang ? 'आपकी chart layers पढ़ रही हूँ' : 'Reading the deeper layers of your chart',
                subtitle: lang ? 'ग्रह, houses और current timing को cross-check कर रही हूँ।' : 'Cross-checking planets, houses, and current timing.'
            },
            calculating: {
                badge: lang ? 'सटीक गणना' : 'PRECISION CALCULATION',
                title: lang ? 'आपकी exact chart math run हो रही है' : 'Running your exact chart calculations',
                subtitle: lang ? 'birth time, degrees और numerology reductions verify हो रहे हैं।' : 'Verifying birth time, degrees, and numerology reductions.'
            },
            revealing: {
                badge: lang ? 'डीप रीडिंग' : 'DEEP READING',
                title: lang ? 'छिपा हुआ pattern निकाल रही हूँ' : 'Pulling out the hidden pattern',
                subtitle: lang ? 'आपके सवाल से जुड़ी सबसे गहरी line पकड़ रही हूँ।' : 'Finding the thread most relevant to your question.'
            },
            love: {
                badge: lang ? 'लव रीडिंग' : 'LOVE READING',
                title: lang ? 'आपका relationship pattern पढ़ रही हूँ' : 'Reading your relationship pattern',
                subtitle: lang ? 'Venus, सातवां भाव और emotional timing को देख रही हूँ।' : 'Checking Venus, the seventh house, and emotional timing.'
            },
            career: {
                badge: lang ? 'करियर रीडिंग' : 'CAREER READING',
                title: lang ? 'आपकी professional line decode कर रही हूँ' : 'Decoding your professional line',
                subtitle: lang ? 'tenth house, Saturn और money indicators align कर रही हूँ।' : 'Aligning the tenth house, Saturn, and money indicators.'
            },
            year: {
                badge: lang ? 'आने वाला समय' : 'YEAR AHEAD',
                title: lang ? 'आने वाले महीनों की theme पढ़ रही हूँ' : 'Reading the theme of the coming months',
                subtitle: lang ? 'transits, windows और timing shifts को map कर रही हूँ।' : 'Mapping transits, timing windows, and major shifts.'
            },
            kundli: {
                badge: lang ? 'कुंडली ALIGNMENT' : 'KUNDLI ALIGNMENT',
                title: lang ? 'पूरी birth chart align कर रही हूँ' : 'Aligning your full birth chart',
                subtitle: lang ? 'लग्न, houses और graha placements को lock कर रही हूँ।' : 'Locking your lagna, houses, and graha placements.'
            }
        };
        const content = copy[type] || copy.thinking;

        const indicator = document.createElement('div');
        indicator.id = 'maya-thinking-indicator';
        indicator.className = `maya-thinking-indicator maya-thinking-indicator--${type}`;
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');
        indicator.innerHTML = `
            <div class="maya-thinking-indicator__accent-line"></div>
            <span class="maya-thinking-indicator__badge">
                <span class="maya-thinking-indicator__badge-dot"></span>
                ${content.badge}
            </span>
            <div class="maya-thinking-indicator__content">
                <strong class="maya-thinking-indicator__title">${content.title}</strong>
                <span class="maya-thinking-indicator__subtitle">${content.subtitle}</span>
                <div class="maya-thinking-indicator__progress" aria-hidden="true">
                    <div class="maya-thinking-indicator__progress-bar"></div>
                </div>
            </div>
        `;

        const blobContainer = document.getElementById('maya-blob-container');
        const overlay = document.getElementById('maya-overlay');
        if (blobContainer) {
            blobContainer.classList.add('maya-blob-container--thinking');
            blobContainer.parentElement.insertBefore(indicator, blobContainer.nextSibling);
        } else if (overlay) {
            overlay.appendChild(indicator);
        }
        overlay?.classList.add('maya-overlay--thinking');
    },

    _hideThinkingIndicator() {
        const el = document.getElementById('maya-thinking-indicator');
        if (el) el.remove();
        document.getElementById('maya-overlay')?.classList.remove('maya-overlay--thinking');
        document.getElementById('maya-blob-container')?.classList.remove('maya-blob-container--thinking');
    },

    async generateDirectReadingSection(sectionKey, context = {}) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        if (!window.MayaAI) {
            return '';
        }

        try {
            MayaAI.init({
                fullName: this.userData?.name || this.firstName,
                name: this.userData?.name || this.firstName,
                birthDate: this.userData?.birthDate,
                birthTime: this.userData?.birthTime || '12:00',
                birthPlace: this.userData?.birthPlace || '',
                gender: this.userData?.gender || '',
                language: lang
            });

            const prompt = this.buildDirectSectionPrompt(sectionKey, context);
            const sources = [];

            if (window.MayaAI?.callGemini) {
                sources.push(async () => MayaAI.callGemini(prompt));
            }

            if (!sources.length && window.MayaAI?.sendMessage) {
                sources.push(async () => MayaAI.sendMessage(prompt));
            }

            if (!sources.length) {
                return '';
            }

            const generated = await MayaUtils.retryWithFallbacks(sources, {
                retriesPerFunction: 2,
                baseDelay: 800,
                label: `${sectionKey} direct reading`
            });

            return this.sanitizeNarrationText(generated);
        } catch (error) {
            console.warn(`Direct ${sectionKey} reading failed:`, error.message);
            return '';
        }
    },


    /**
     * Start the funnel experience
     */
    async start() {
        console.log('🎭 MayaFunnel.start() called');
        
        if (!this.userData || !this.calculations) {
            console.error('❌ Funnel not initialized properly - userData:', !!this.userData, 'calculations:', !!this.calculations);
            // Try to recover by initializing with saved data
            const savedProfile = MayaUtils.storage.get('maya_profile');
            const savedFunnelData = MayaUtils.storage.get('funnel_data');
            const userData = savedFunnelData || savedProfile;
            
            if (userData && userData.name && userData.birthDate) {
                console.log('🔄 Recovering funnel with saved data...');
                this.init(userData);
            } else {
                console.error('❌ Cannot recover funnel - no saved data');
                return;
            }
        }

        try {
            // Show the MAYA overlay IMMEDIATELY for fast perceived loading
            const overlay = document.getElementById('maya-overlay');
            if (overlay) {
                overlay.classList.add('show');
                // Hide back and close buttons during funnel to ensure completion
                overlay.classList.add('funnel-mode');
            }

            // Hide text display - we use calculation overlay instead
            const textDisplay = document.getElementById('maya-text-display');
            if (textDisplay) textDisplay.style.display = 'none';

            // Hide input area
            const inputArea = document.getElementById('maya-input-area');
            if (inputArea) inputArea.style.display = 'none';

            // Initialize blob animation
            if (window.MayaBlob && !MayaBlob.isAnimating) {
                MayaBlob.init('maya-blob-container');
            }

            // Initialize and show pause button
            this.initPauseButton();
            this.showFunnelControls(true);
            this.isPaused = false;

            // PRE-WARM TTS in the background, but do not block the first spoken line on it.
            window.MayaVoice?.preWarmTTS?.();

            // Unmute voice
            if (window.MayaVoice) {
                MayaVoice.setMute(false);
                await MayaVoice.resumeContext();
            }

            // Start background music
            this.startBackgroundMusic();

            console.log('🎭 Funnel UI ready, beginning journey...');
            
            // Begin the journey with flowing narrative
            await this.beginJourney();
            
        } catch (error) {
            console.error('❌ Funnel start error:', error);
            // Try to continue with basic flow even if something fails
            this.handleFunnelError(error);
        }
    },

    /**
     * Handle funnel errors gracefully
     */
    handleFunnelError(error) {
        console.error('🚨 Funnel error handler:', error);
        
        // Show a basic message to the user
        const overlay = document.getElementById('maya-overlay');
        if (overlay) {
            overlay.classList.add('show');
            
            const textDisplay = document.getElementById('maya-text-display');
            if (textDisplay) {
                textDisplay.style.display = 'block';
                textDisplay.innerHTML = `
                    <div class="maya-error-recovery">
                        <p>Something went wrong. Let me try again...</p>
                        <button class="btn btn-primary" onclick="MayaFunnel.retryStart()">
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    },

    /**
     * Retry funnel start
     */
    async retryStart() {
        console.log('🔄 Retrying funnel...');
        const savedData = MayaUtils.storage.get('funnel_data') || MayaUtils.storage.get('maya_profile');
        if (savedData) {
            this.init(savedData);
            await this.start();
        }
    },

    /**
     * Create and show the calculation overlay
     */
    showCalculationOverlay() {
        // Make blob small during calculations
        const blobContainer = document.getElementById('maya-blob-container');
        if (blobContainer) {
            blobContainer.classList.remove('blob-centered', 'blob-top');
            blobContainer.classList.add('blob-small');
        }
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        
        this.calculationOverlay = document.createElement('div');
        this.calculationOverlay.id = 'calculation-overlay';
        this.calculationOverlay.className = 'calculation-overlay';
        this.calculationOverlay.innerHTML = `
            <div class="calculation-container">
                <div class="calculation-title">
                    <h2>${isHindi ? 'आपकी कुंडली और अंक तैयार हो रहे हैं' : 'Forming Your Kundli and Numbers'}</h2>
                    <p class="calc-rotating-status" id="calc-rotating-status">${isHindi ? 'ग्रहों की स्थिति ट्रेस हो रही है…' : 'Tracing planetary positions…'}</p>
                </div>
                <div class="calculation-display" id="calc-display">
                    <div class="calc-waiting">
                        <div class="cosmic-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <p>${isHindi ? 'आपकी जन्म कुंडली तैयार हो रही है...' : 'Forming your birth chart...'}</p>
                    </div>
                </div>
                <div class="calculation-result" id="calc-result">
                    <div class="calculation-result__group calculation-result__group--kundli" data-result-group="kundli"></div>
                    <div class="calculation-result__group calculation-result__group--numbers" data-result-group="numbers"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.calculationOverlay);

        // Start rotating status text
        this._startRotatingStatus(isHindi);
    },

    /**
     * Rotating status text for calculation overlay (Screen 8)
     */
    _startRotatingStatus(isHindi) {
        const statusMessages = isHindi
            ? [
                'ग्रहों की स्थिति ट्रेस हो रही है…',
                'भावनात्मक पैटर्न मैप हो रहे हैं…',
                'समय चक्र की समीक्षा हो रही है…'
            ]
            : [
                'Tracing planetary positions…',
                'Mapping emotional patterns…',
                'Reviewing timing cycles…'
            ];

        let index = 0;
        this._rotatingStatusTimer = setInterval(() => {
            index = (index + 1) % statusMessages.length;
            const el = document.getElementById('calc-rotating-status');
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => {
                    el.textContent = statusMessages[index];
                    el.style.opacity = '1';
                }, 300);
            } else {
                clearInterval(this._rotatingStatusTimer);
            }
        }, 3000);
    },

    /**
     * Hide calculation overlay
     */
    async hideCalculationOverlay() {
        // Clear rotating status timer
        if (this._rotatingStatusTimer) {
            clearInterval(this._rotatingStatusTimer);
            this._rotatingStatusTimer = null;
        }

        if (this.calculationOverlay) {
            this.calculationOverlay.classList.add('fade-out');
            await MayaUtils.sleep(500);
            this.calculationOverlay.remove();
            this.calculationOverlay = null;
        }
        
        // Restore blob to centered position
        const blobContainer = document.getElementById('maya-blob-container');
        if (blobContainer) {
            blobContainer.classList.remove('blob-small');
            blobContainer.classList.add('blob-centered');
        }
    },

    // ============================================================
    //  VALIDATION LOOPS & INTERACTIVE UI
    // ============================================================

    /**
     * Show a validation question with 2-3 option buttons.
     * Returns the user's chosen option value.
     * @param {string} question - Spoken + displayed question
     * @param {Array<{label:string, value:string}>} options
     * @param {string} [spokenQuestion] - If provided, spoken instead of question text
     * @returns {Promise<string>} selected value
     */
    async showValidationQuestion(question, options, spokenQuestion) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';

        // Speak the question while building the UI
        const speakPromise = this.speak(spokenQuestion || question);

        // Always render as a fixed centered overlay
        const overlay = document.createElement('div');
        overlay.className = 'maya-validation-overlay';
        overlay.innerHTML = `
            <div class="maya-validation-container">
                <p class="maya-validation-question">${question}</p>
                <div class="maya-validation-options" id="maya-validation-options">
                    ${options.map(opt => `
                        <button class="maya-validation-btn" data-value="${opt.value}">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        await speakPromise;

        return new Promise((resolve) => {
            const container = overlay.querySelector('#maya-validation-options');
            if (!container) { overlay.remove(); resolve(options[0]?.value || 'yes'); return; }

            container.querySelectorAll('.maya-validation-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;
                    // Highlight selected
                    container.querySelectorAll('.maya-validation-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    // Store response
                    this.validationResponses.push({ question, answer: value, timestamp: Date.now() });
                    this.recordValidation(question, value);
                    // Animate out then remove
                    setTimeout(() => {
                        overlay.classList.add('closing');
                        setTimeout(() => overlay.remove(), 300);
                        resolve(value);
                    }, 350);
                });
            });
        });
    },

    /**
     * Respond to a validation answer with a short AI-aware acknowledgement.
     */
    async respondToValidation(answer, context = '') {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const profile = this.personalization || {};
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';

        // Build chart-specific acknowledgment that references their actual data
        let response = '';
        if (answer === 'yes') {
            if (isHindi) {
                const yesPool = [
                    dasha ? `बिल्कुल। आपकी ${dasha} दशा यही इशारा कर रही है — ये random नहीं है, chart में clearly दिख रहा है।` : '',
                    moonSign ? `मुझे यही दिख रहा था। ${moonSign} चन्द्र राशि और आपकी current timing मिलकर यही बता रही है।` : '',
                    ascendant ? `हाँ, ${ascendant} लग्न वालों में ये pattern बहुत specific तरीके से आता है — और आपने confirm कर दिया।` : '',
                    `यही chart में सबसे तेज signal है। इसका मतलब अगली layers और भी accurate होंगी।`
                ].filter(Boolean);
                response = yesPool[Math.floor(Math.random() * yesPool.length)];
            } else {
                const yesPool = [
                    dasha ? `Exactly. Your ${dasha} dasha is driving this — it is not random, it is right there in your chart.` : '',
                    moonSign ? `I thought so. Your ${moonSign} Moon combined with current timing confirms this pattern clearly.` : '',
                    ascendant ? `Yes. With ${ascendant} rising, this pattern shows up in a very specific way — and you just confirmed it.` : '',
                    `That is the strongest signal in your chart. This means the deeper layers will be even more accurate.`
                ].filter(Boolean);
                response = yesPool[Math.floor(Math.random() * yesPool.length)];
            }
        } else if (answer === 'somewhat') {
            if (isHindi) {
                const somewhatPool = [
                    dasha ? `हम्म, ${dasha} दशा का असर कभी-कभी धीमे-धीमे आता है — शायद ये अंदर ज्यादा चल रहा है बाहर कम दिख रहा है।` : '',
                    `समझ आता है। ये pattern अभी बन रहा है — पूरा खुलेगा तो आप खुद पहचान लेंगे।`,
                    `ठीक है, इसका मतलब ये अभी surface पर नहीं आया पूरी तरह — लेकिन chart में है, तो timing आने पर clearly महसूस होगा।`
                ].filter(Boolean);
                response = somewhatPool[Math.floor(Math.random() * somewhatPool.length)];
            } else {
                const somewhatPool = [
                    dasha ? `That makes sense. The ${dasha} dasha effect sometimes builds slowly — it may be running deeper than you realize.` : '',
                    `I see. This pattern is still forming — when it fully surfaces, you will recognize it immediately.`,
                    `That tells me it has not peaked yet. But the chart shows it clearly, so the timing will bring it forward.`
                ].filter(Boolean);
                response = somewhatPool[Math.floor(Math.random() * somewhatPool.length)];
            }
        } else {
            if (isHindi) {
                const noPool = [
                    dasha ? `दिलचस्प है। ${dasha} दशा का ये signal कभी-कभी जिन्दगी के उस हिस्से में दिखता है जहाँ हम सोचते नहीं — relationships, health, या inner restlessness में।` : '',
                    `अच्छा, तो शायद ये किसी और angle से आ रहा है। Chart में तो दिख रहा है — इसलिए आगे की reading में clear होगा।`,
                    `ये जानना भी important है। हर answer मुझे आपकी chart ज्यादा precisely पढ़ने में मदद करता है।`
                ].filter(Boolean);
                response = noPool[Math.floor(Math.random() * noPool.length)];
            } else {
                const noPool = [
                    dasha ? `Interesting. The ${dasha} dasha signal sometimes shows up in unexpected areas — relationships, health, or a quiet inner restlessness.` : '',
                    `Good to know. The chart still shows this pattern, so it may be coming from a different direction. The deeper reading will clarify.`,
                    `That is useful. Every answer helps me read your chart more precisely.`
                ].filter(Boolean);
                response = noPool[Math.floor(Math.random() * noPool.length)];
            }
        }

        if (response) await this.speak(response);
        await MayaUtils.sleep(this.stageTiming.validationSettle);
    },

    /**
     * Show a lightweight mini-check after a number reveal.
     * @param {string} checkQuestion
     * @returns {Promise<string>}
     */
    /**
     * Show a "Continue" button gate that pauses the flow until user taps.
     * Used between calculation reveals to give user control over pacing.
     */
    async showContinueGate() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const overlayActive = !!this.calculationOverlay && document.body.contains(this.calculationOverlay);
        
        // If we're in the calculation overlay, show button inside it
        if (overlayActive) {
            const calcContainer = this.calculationOverlay.querySelector('.calculation-container');
            if (!calcContainer) return;
            return new Promise((resolve) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'calc-overlay-continue text-center';
                wrapper.innerHTML = `<button class="btn btn-primary btn-lg maya-continue-gate-btn">${isHindi ? 'आगे बढ़ें' : 'Continue'}</button>`;
                calcContainer.appendChild(wrapper);
                wrapper.querySelector('button').addEventListener('click', () => {
                    wrapper.remove();
                    resolve();
                });
            });
        }

        // Otherwise show in the text display area
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');
        if (!textDisplay) return;

        if (blobContainer) {
            blobContainer.classList.remove('blob-centered');
            blobContainer.classList.add('blob-top');
        }
        textDisplay.style.display = 'flex';

        return new Promise((resolve) => {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'maya-continue-wrapper text-center py-3';
            btnContainer.innerHTML = `<button class="btn btn-primary btn-lg maya-continue-gate-btn">${isHindi ? 'आगे बढ़ें' : 'Continue'}</button>`;
            textDisplay.innerHTML = '';
            textDisplay.appendChild(btnContainer);
            btnContainer.querySelector('button').addEventListener('click', () => {
                textDisplay.style.display = 'none';
                if (blobContainer) {
                    blobContainer.classList.remove('blob-top');
                    blobContainer.classList.add('blob-centered');
                }
                resolve();
            });
        });
    },

    async showMiniCheck(checkQuestion) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const options = isHindi
            ? [
                { label: 'हाँ, बिल्कुल', value: 'yes' },
                { label: 'थोड़ा-बहुत', value: 'somewhat' },
                { label: 'नहीं', value: 'no' }
            ]
            : [
                { label: 'Yes, very true', value: 'yes' },
                { label: 'Somewhat true', value: 'somewhat' },
                { label: 'Not really', value: 'no' }
            ];

        const answer = await this.showValidationQuestion(checkQuestion, options);
        await this.respondToValidation(answer);
        return answer;
    },

    /**
     * Run the "How does she know?" moment — predict a past event.
     */
    async showAccuracyShockMoment() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const aiContext = this.buildBaseAIContext();

        const shockNarration = await this.withFiller(
            () => this.generateDirectReadingSection('accuracyShock', aiContext),
            'revealing'
        );

        if (shockNarration && shockNarration.length > 20) {
            await this.speak(shockNarration);
            this.spokenNarrations.push({ stage: 'accuracyShock', text: shockNarration });
            this.strongestAccurateHit = shockNarration;
        }

        // Ask validation
        const question = isHindi
            ? 'क्या ऐसा कोई दौर आपकी जिन्दगी में आया था जिसने आपको बदल दिया?'
            : 'Did a phase like that change you?';

        const answer = await this.showMiniCheck(question);
        this.emotionalAnchor = answer;
        if (answer === 'yes' && shockNarration) {
            this.recordEmotionalAnchor(shockNarration);
            this.sessionMemory.strongHits.push('accuracy_shock_confirmed');
        }
    },

    /**
     * Show the suspense bridge — controlled tension before the gate.
     */
    async showSuspenseBridge() {
        this.currentPhase = this.PHASES.SUSPENSE_BRIDGE;
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';

        // If already logged in, skip email gate entirely and go to deep reveal
        if (this.isUserLoggedIn || window.MayaAuth?.isAuthenticated) {
            await this.showDeepReveal();
            return;
        }

        // Speak email gate narration, then go straight to email form — no extra button
        const predictionItems = this.buildPredictionItems();
        const emailAiCtx = this.buildBaseAIContext(predictionItems);
        const emailNarration = await this.withFiller(
            () => this.generateDirectReadingSection('emailGate', emailAiCtx),
            'thinking'
        );
        if (emailNarration && emailNarration.length > 20) {
            await this.speak(emailNarration);
            this.spokenNarrations.push({ stage: 'emailGate', text: emailNarration });
        } else {
            // Fallback if AI fails
            const fallback = isHindi
                ? `आपकी chart में कुछ ऐसा दिखा है जिसे अभी privately बताना जरूरी है। Screen पर email field आ रहा है — बस अपना email type कर दीजिए ताकि ये reading safe रहे और मैं आगे की deeper layer खोल सकूँ।`
                : `There is something in your chart I need to share privately. You will see an email field on screen — just type your email so this reading stays saved and I can unlock the deeper layer for you.`;
            await this.speak(fallback);
        }

        // Flow into the save-my-file gate
        await this.showEmailGate();
        const emailInput = document.getElementById('gate-email');
        if (emailInput && document.body.contains(emailInput)) {
            this.focusAuthField(emailInput);
        }
    },

    /**
     * Show the deep reveal with chapter choice — user picks starting topic.
     * @returns {string[]} ordered chapter keys
     */
    async showDeepRevealWithChoice() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');

        if (blobContainer) {
            blobContainer.classList.remove('blob-centered');
            blobContainer.classList.add('blob-top');
        }

        if (textDisplay) {
            textDisplay.style.display = 'flex';
            textDisplay.innerHTML = `
                <div class="deep-reveal-prompt text-center py-4">
                    <div class="deep-reveal-choice-grid" id="deep-reveal-choices">
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="love">
                            <i class="bi bi-heart-fill"></i>
                            ${isHindi ? 'प्रेम' : 'Love'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="career">
                            <i class="bi bi-briefcase-fill"></i>
                            ${isHindi ? 'करियर' : 'Career'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="year">
                            <i class="bi bi-clock-fill"></i>
                            ${isHindi ? 'समय' : 'Timing'}
                        </button>
                    </div>
                </div>
            `;
        }

        return new Promise((resolve) => {
            const container = document.getElementById('deep-reveal-choices');
            if (!container) { resolve('default'); return; }

            container.querySelectorAll('.deep-chapter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const chapter = btn.dataset.chapter;
                    this.chosenDeepDiveTopic = chapter;
                    if (textDisplay) textDisplay.style.display = 'none';
                    if (blobContainer) {
                        blobContainer.classList.remove('blob-top');
                        blobContainer.classList.add('blob-centered');
                    }
                    resolve(chapter);
                });
            });
        });
    },

    /**
     * Show a micro-prompt between deep reading chapters.
     * @param {string} chapterKey e.g. 'love', 'career'
     * @returns {Promise<string>}
     */
    async showChapterMicroPrompt(chapterKey) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const prompts = {
            love: {
                question: isHindi
                    ? 'मैं हल्के में बताऊँ या बिल्कुल सीधी बात करूँ?'
                    : 'Do you want the softer truth or the harder truth?',
                options: isHindi
                    ? [{ label: 'सीधी बात बोलो', value: 'harder' }, { label: 'हल्के में बताओ', value: 'softer' }]
                    : [{ label: 'Softer', value: 'softer' }, { label: 'Harder', value: 'harder' }]
            },
            career: {
                question: isHindi
                    ? 'क्या आपका मौजूदा काम आपकी इस खासियत को सच में इस्तेमाल करता है?'
                    : 'Does your current work actually use this side of you?',
                options: isHindi
                    ? [{ label: 'हाँ', value: 'yes' }, { label: 'पूरी तरह नहीं', value: 'not_fully' }, { label: 'नहीं', value: 'no' }]
                    : [{ label: 'Yes', value: 'yes' }, { label: 'Not fully', value: 'not_fully' }, { label: 'No', value: 'no' }]
            },
            year: {
                question: isHindi
                    ? 'आने वाले महीनों में आप किस चीज पर सबसे ज्यादा ध्यान देना चाहते हैं?'
                    : 'What matters most to you in the coming months?',
                options: isHindi
                    ? [{ label: 'पैसा और growth', value: 'money' }, { label: 'रिश्ते और प्यार', value: 'relationships' }, { label: 'सेहत और शांति', value: 'health' }]
                    : [{ label: 'Money & growth', value: 'money' }, { label: 'Relationships', value: 'relationships' }, { label: 'Health & peace', value: 'health' }]
            },
            warning: {
                question: isHindi
                    ? 'क्या आपको लगता है कि कोई एक गलती आप बार-बार दोहराते हैं?'
                    : 'Do you feel there is one mistake you keep repeating?',
                options: isHindi
                    ? [{ label: 'हाँ, पता है कौनसी', value: 'aware' }, { label: 'हाँ, पर समझ नहीं आती', value: 'unaware' }, { label: 'नहीं लगता', value: 'no' }]
                    : [{ label: 'Yes, I know which one', value: 'aware' }, { label: 'Yes, but can\'t pinpoint', value: 'unaware' }, { label: 'Not really', value: 'no' }]
            }
        };

        const prompt = prompts[chapterKey];
        if (!prompt) return 'default';

        return await this.showValidationQuestion(prompt.question, prompt.options);
    },

    /**
     * Build the chapter delivery order based on user choice.
     */
    getChapterOrder(choice) {
        const allChapters = ['love', 'career', 'year', 'warning'];
        if (choice === 'love') return allChapters;
        if (choice === 'career') return ['career', 'love', 'year', 'warning'];
        if (choice === 'year') return ['year', 'love', 'career', 'warning'];
        return allChapters; // default
    },

    /**
     * Show the return hook at the end of the session.
     */
    async showReturnHook() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const aiContext = this.buildBaseAIContext();

        const hookNarration = await this.withFiller(
            () => this.generateDirectReadingSection('returnHook', aiContext),
            'thinking'
        );

        if (hookNarration && hookNarration.length > 20) {
            await this.speak(hookNarration);
            this.returnHookType = 'timing_shift';
        }
    },

    // ============================================================
    //  LIVE ANALYSIS THEATRE — Filler lines during calculations
    // ============================================================

    /**
     * Speak a contextual live-analysis filler line during calculation phases.
     * Uses the voice library for richer, more varied lines.
     */
    async speakAnalysisFiller(phase) {
        // Map phases to voice library categories
        const categoryMap = {
            kundli: 'analysis',
            lifePath: 'analysis',
            destiny: 'analysis',
            soulUrge: 'emotionalMirror',
            love: 'relationship',
            career: 'career',
            year: 'timing',
            warning: 'warning',
            thinking: 'suspense',
            revealing: 'suspense'
        };
        const category = categoryMap[phase] || 'analysis';
        const line = this.getVoiceLine(category);
        if (line) await this.speak(line);
    },

    /**
     * Build a personalized validation question using actual chart data.
     */
    buildPersonalizedValidation() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const profile = this.personalization || {};
        const lp = this.calculations?.lifePath;
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const isMale = this.userData?.gender === 'male';
        const dashaStartYear = profile.currentDasha?.startYear || '';

        // Saturn dasha — multiple variants
        if (dasha && /saturn|shani/i.test(dasha)) {
            const variants = isHindi ? [
                `आपकी शनि दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है — क्या पिछले कुछ सालों में जिम्मेदारियाँ अचानक बढ़ गई हैं, जैसे सब कुछ आप पर आ गया?`,
                `शनि दशा में अक्सर एक phase आता है जहाँ लगता है कि मेहनत का result नहीं मिल रहा — क्या आपने ये महसूस किया?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ सालों में'} कोई relationship या family situation ऐसी बनी जिसने आपको अंदर से mature कर दिया?`
            ] : [
                `Your Saturn dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} — have you felt responsibilities suddenly multiply, as if everything landed on your shoulders?`,
                `During Saturn dasha there is often a phase where hard work does not seem to pay off — have you experienced that?`,
                `Has a relationship or family situation ${dashaStartYear ? `since ${dashaStartYear}` : 'in recent years'} forced you to grow up faster than you wanted?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Rahu dasha — multiple variants
        if (dasha && /rahu/i.test(dasha)) {
            const variants = isHindi ? [
                `राहु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है — क्या आपको लगा कि जिन्दगी में अचानक direction बदल गई, बिना plan किए?`,
                `राहु period में अक्सर एक ऐसी चीज से obsession हो जाता है जो पहले कभी matter नहीं करती थी — क्या ये हुआ?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के आसपास` : 'कुछ समय पहले'} कोई बड़ा change आया — job, city, या जिन्दगी का पूरा setup बदला?`
            ] : [
                `Your Rahu dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} — have you felt life suddenly shift direction without any plan?`,
                `During Rahu periods, people often develop an unexpected obsession with something that never mattered before — has that happened?`,
                `Did a major change happen ${dashaStartYear ? `around ${dashaStartYear}` : 'recently'} — a job shift, a city move, or your entire life setup changed?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Jupiter dasha
        if (dasha && /jupiter|guru/i.test(dasha)) {
            const variants = isHindi ? [
                `गुरु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है — क्या हाल ही में कोई मौका आया जो उम्मीद से बड़ा निकला?`,
                `गुरु period में अक्सर teaching, mentoring या spiritual interest बढ़ता है — क्या आपने ये अपने अंदर notice किया?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ समय से'} लगता है कि आप पहले से ज्यादा wise decisions ले रहे हैं — लेकिन दुनिया ने अभी recognize नहीं किया?`
            ] : [
                `Your Jupiter dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} — did an opportunity show up recently that turned out bigger than expected?`,
                `Jupiter periods often spark interest in teaching, mentoring, or spirituality — have you noticed this shift in yourself?`,
                `Have you felt ${dashaStartYear ? `since ${dashaStartYear}` : 'lately'} that you are making wiser decisions but the world has not caught up to recognize it?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Ketu dasha
        if (dasha && /ketu/i.test(dasha)) {
            const variants = isHindi ? [
                `केतु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है — क्या कभी लगता है कि कुछ छूट रहा है, पर समझ नहीं आता क्या?`,
                `केतु period में अक्सर पुरानी चीजें टूटती हैं — कोई attachment, koi belief, या कोई रिश्ता। क्या ऐसा कुछ हुआ?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ समय से'} किसी चीज से naturally detach हो गए जो पहले बहुत matter करती थी?`
            ] : [
                `Your Ketu dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} — do you feel something is missing but you cannot name what it is?`,
                `Ketu periods often break old attachments — a belief, a habit, or a relationship. Has something like that happened?`,
                `Have you ${dashaStartYear ? `since ${dashaStartYear}` : 'recently'} naturally detached from something that used to matter a lot?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Mercury dasha
        if (dasha && /mercury|budh/i.test(dasha)) {
            const variants = isHindi ? [
                `बुध दशा चल रही है — क्या आपने notice किया कि हाल में communication या learning से जुड़ा कोई बड़ा shift आया?`,
                `बुध period में overthinking बढ़ जाती है — क्या रात को सोते वक्त दिमाग बंद नहीं होता, हजार thoughts चलते रहते हैं?`
            ] : [
                `Your Mercury dasha is active — have you noticed a major shift in how you communicate or learn?`,
                `Mercury periods amplify overthinking — do you find your mind racing at night, unable to switch off?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Venus dasha
        if (dasha && /venus|shukra/i.test(dasha)) {
            const variants = isHindi ? [
                `शुक्र दशा चल रही है — क्या relationships या comfort से जुड़ा कोई बड़ा change आया हाल में?`,
                `शुक्र period में अक्सर luxury या beauty की तरफ pull बढ़ता है — क्या आपने ये अपने अंदर देखा?`
            ] : [
                `Your Venus dasha is active — has there been a major shift in relationships or your comfort zone recently?`,
                `Venus periods often increase a pull toward luxury or beauty — have you noticed this?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Mars dasha
        if (dasha && /mars|mangal/i.test(dasha)) {
            const variants = isHindi ? [
                `मंगल दशा चल रही है — क्या हाल में गुस्सा या impatience बढ़ा है, छोटी-छोटी बातों पर react हो जाता है?`,
                `मंगल period में energy तो बढ़ती है लेकिन conflicts भी — क्या किसी से टकराव हुआ हाल में?`
            ] : [
                `Your Mars dasha is active — have you noticed more anger or impatience flaring up over small things?`,
                `Mars periods bring energy but also conflict — have you had an unexpected clash with someone recently?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Moon dasha
        if (dasha && /moon|chandra/i.test(dasha)) {
            const variants = isHindi ? [
                `चन्द्र दशा चल रही है — क्या emotions ज्यादा intense हो गए हैं, जैसे mood swings या sudden emotional waves?`,
                `चन्द्र period में home और family matters ज्यादा surface पर आते हैं — क्या घर से जुड़ा कोई बड़ा change हुआ?`
            ] : [
                `Your Moon dasha is active — have your emotions become more intense, with unexpected mood shifts?`,
                `Moon periods bring home and family matters to the surface — has something major shifted at home?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Sun dasha
        if (dasha && /sun|surya/i.test(dasha)) {
            const variants = isHindi ? [
                `सूर्य दशा चल रही है — क्या career या authority से जुड़ा कोई major shift आया, जैसे promotion, recognition, या किसी से टकराव?`,
            ] : [
                `Your Sun dasha is active — has there been a career shift, a recognition moment, or an authority clash?`,
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Lifepath based (fallback)
        if ([7, 11, 22].includes(lp)) {
            return isHindi
                ? `Life path ${lp} — क्या आप अक्सर दूसरों से अलग सोचते हैं, और इसकी वजह से एक तरह का अकेलापन महसूस होता है?`
                : `As a life path ${lp} — do you often think differently from others and feel a quiet loneliness because of it?`;
        }
        if ([2, 6, 9].includes(lp)) {
            return isHindi
                ? `Life path ${lp} — क्या आप दूसरों की जरूरतें अपनी से पहले रख देते हैं, अक्सर बिना सोचे?`
                : `As a life path ${lp} — do you put others' needs before your own, often without thinking?`;
        }
        if ([1, 5, 8].includes(lp)) {
            return isHindi
                ? `Life path ${lp} — क्या कभी लगता है कि pace तो आपकी तेज है, पर दुनिया साथ नहीं दे रही?`
                : `As a life path ${lp} — do you sometimes feel your pace is fast but the world is not keeping up?`;
        }
        if ([3, 33].includes(lp)) {
            return isHindi
                ? `Life path ${lp} — क्या लोग आपसे कहते हैं कि आप बहुत expressive हैं, लेकिन अंदर एक part है जो कोई नहीं जानता?`
                : `As a life path ${lp} — do people say you are very expressive, but there is a part inside that nobody knows?`;
        }
        if ([4].includes(lp)) {
            return isHindi
                ? `Life path 4 — क्या आपने महसूस किया कि आप structure और stability में ज्यादा comfortable हैं, लेकिन जिन्दगी बार-बार uncertainty फेंकती है?`
                : `As a life path 4 — do you find comfort in structure, but life keeps throwing uncertainty at you?`;
        }
        // Ultimate fallback with moon sign
        return isHindi
            ? `${moonSign ? `${moonSign} चन्द्र राशि` : 'आपकी कुंडली'} में जो pattern दिख रहा है — क्या जिन्दगी में कोई चीज बार-बार repeat होती है, एक ही तरह की situation बार-बार आती है?`
            : `Based on what ${moonSign ? `your ${moonSign} Moon` : 'your chart'} is showing — do you feel certain situations keep repeating in your life, the same kind of thing happening again and again?`;
    },

    /**
     * Begin the cosmic journey - STREAMLINED flowing narrative
     * Flow: Opening → Early Suspense Hit → Kundli → Validation → Numbers → Accuracy Shock → Teaser → Gate
     */
    async beginJourney() {
        console.log('🌟 Beginning cosmic journey...');
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        this.resetSessionMemory();

        try {
            // Show progress meter
            this.showProgressMeter();

            // STEP 1: Opening hit — personalized, specific, grounded
            console.log('🗣️ Speaking personalized opening...');
            const openingNarration = await this.getOpeningNarration();
            await this.speak(openingNarration);
            if (openingNarration) this.spokenNarrations.push({ stage: 'opening', text: openingNarration });
            this.advanceProgress('chart_opened');
            await MayaUtils.sleep(this.stageTiming.introSettle);

            // STEP 2: Transition to kundli — tell user we're about to plot their chart
            console.log('🪐 Kundli transition...');
            const kundliTransitionLine = this.getVoiceLine('kundliTransition');
            await this.speak(kundliTransitionLine);
            this.advanceProgress('first_impression');

            // STEP 3: Show calculation overlay
            console.log('📊 Showing calculation overlay...');
            this.showCalculationOverlay();
            await MayaUtils.sleep(this.stageTiming.calculationLeadIn);

            // STEP 4: Kundli formation — personalized AI narration plays over chart animation
            console.log('🪐 Animating Kundli...');
            await this.animateKundliFormation();
            this.advanceProgress('kundli');

            // STEP 5: ONE personalized validation based on actual chart data
            console.log('✅ Personalized validation...');
            this.currentPhase = this.PHASES.VALIDATION;
            const personalQ = this.buildPersonalizedValidation();
            await this.showMiniCheck(personalQ);

            // STEP 6-8: Number calculations flow without interruption
            console.log('📊 Flowing through number calculations...');
            await this.animateLifePathCalculation();
            this.advanceProgress('life_path');
            await this.animateDestinyCalculation();
            this.advanceProgress('destiny');
            await this.animateSoulUrgeCalculation();
            this.advanceProgress('soul_urge');

            // STEP 9: Hide overlay
            console.log('📊 Hiding overlay...');
            await this.hideCalculationOverlay();

            // STEP 10: Teaser reveal (includes accuracy shock + identity + emotional pattern)
            console.log('🎁 Showing teaser reveal...');
            await this.showTeaserReveal();
            this.advanceProgress('accuracy_hit');
            this.advanceProgress('deep_patterns');

            // STEP 11: Suspense bridge → email gate
            console.log('🌉 Suspense bridge...');
            await this.showSuspenseBridge();
            this.advanceProgress('full_reading');

            console.log('✅ Cosmic journey complete!');

        } catch (error) {
            console.error('❌ Error in beginJourney:', error);
            // Try to continue even if something fails
            await this.hideCalculationOverlay();
            await this.showTeaserReveal();
        }
    },

    // ============================================================
    //  PROGRESS METER — visual gamification during funnel
    // ============================================================

    showProgressMeter() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const overlay = document.getElementById('maya-overlay');
        if (!overlay) return;

        // Remove existing if any
        const existing = document.getElementById('maya-progress-meter');
        if (existing) existing.remove();

        const meter = document.createElement('div');
        meter.id = 'maya-progress-meter';
        meter.className = 'maya-progress-meter';
        meter.innerHTML = `
            <div class="progress-meter-track">
                ${this.PROGRESS_STAGES.map((stage, i) => `
                    <div class="progress-stage" data-stage="${stage.key}" data-index="${i}">
                        <div class="progress-dot"></div>
                        <span class="progress-label">${isHindi ? stage.hi : stage.en}</span>
                    </div>
                `).join('')}
                <div class="progress-fill-line" id="progressFillLine"></div>
            </div>
        `;
        overlay.appendChild(meter);
        this.currentProgressIndex = -1;
    },

    advanceProgress(stageKey) {
        const index = this.PROGRESS_STAGES.findIndex(s => s.key === stageKey);
        if (index < 0 || index <= this.currentProgressIndex) return;
        this.currentProgressIndex = index;
        this.sessionMemory.progressUnlocks.push({ key: stageKey, timestamp: Date.now() });

        const meter = document.getElementById('maya-progress-meter');
        if (!meter) return;

        // Light up all dots up to current
        meter.querySelectorAll('.progress-stage').forEach((el, i) => {
            el.classList.toggle('completed', i < index);
            el.classList.toggle('active', i === index);
        });

        // Animate fill line
        const fillLine = document.getElementById('progressFillLine');
        if (fillLine) {
            const totalStages = this.PROGRESS_STAGES.length - 1;
            const pct = totalStages > 0 ? (index / totalStages) * 100 : 0;
            fillLine.style.width = `${pct}%`;
        }
    },

    hideProgressMeter() {
        const meter = document.getElementById('maya-progress-meter');
        if (meter) {
            meter.classList.add('fade-out');
            setTimeout(() => meter.remove(), 500);
        }
    },

    /**
     * Show a loading spinner in the calc-display while preparing the next stage.
     */
    showCalcLoading(message) {
        const display = document.getElementById('calc-display');
        if (!display) return;
        display.innerHTML = `
            <div class="calc-loading-indicator">
                <div class="calc-spinner"></div>
                <p class="calc-loading-text">${message || 'Preparing...'}</p>
            </div>
        `;
    },

    /**
     * Animate Life Path calculation with visuals
     */
    async animateLifePathCalculation() {
        const display = document.getElementById('calc-display');
        const resultArea = document.getElementById('calc-result');

        const isHindiLoading = MayaUtils?.storage?.get('maya_language') === 'hi';
        this.showCalcLoading(isHindiLoading ? 'Life Path की गणना हो रही है...' : 'Calculating Life Path...');
        
        // Use consistent date parsing across the app
        const date = window.MayaAstrology ? MayaAstrology.parseDate(this.userData.birthDate) : new Date(this.userData.birthDate);
        if (!date) {
            console.error('Invalid birth date');
            return;
        }
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const lifePath = this.calculations.lifePath;

        // Calculate reductions
        const dayReduced = MayaNumerology.reduceNumber(day, false);
        const monthReduced = MayaNumerology.reduceNumber(month, false);
        const yearSum = String(year).split('').reduce((s, d) => s + parseInt(d), 0);
        const yearReduced = MayaNumerology.reduceNumber(year, false);
        const total = dayReduced + monthReduced + yearReduced;

        // Show visual breakdown with explanation
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const explanationText = isHindi 
            ? 'हर birth date में एक cosmic code छिपा होता है। हम Day, Month, और Year को single digits में reduce करके आपका Life Path निकालते हैं।'
            : 'Every birth date contains a cosmic code. We reduce the Day, Month, and Year to single digits using Pythagorean numerology to reveal your Life Path.';
        
        display.innerHTML = `
            <div class="calc-section life-path-calc">
                <h3><i class="bi bi-star-fill"></i> Life Path Number</h3>
                <p class="calc-explanation">${explanationText}</p>
                <div class="date-breakdown">
                    <div class="date-part day">
                        <span class="label">Day</span>
                        <span class="value animate-in">${day}</span>
                    </div>
                    <div class="date-part month">
                        <span class="label">Month</span>
                        <span class="value animate-in">${month}</span>
                    </div>
                    <div class="date-part year">
                        <span class="label">Year</span>
                        <span class="value animate-in">${year}</span>
                    </div>
                </div>
                <div class="calculation-steps" id="life-path-steps"></div>
            </div>
        `;

        const aiContext = this.buildBaseAIContext();
        const spokenDate = this.formatDateSpoken(this.userData.birthDate);

        // Keep the narration strictly on the Life Path math and meaning while this stage is on screen.
        const isHindiLP = MayaUtils?.storage?.get('maya_language') === 'hi';
        let narrative = await this.withFiller(() => this.getContent('lifePathCalculationNarrative', async () => {
            if (window.MayaStatements?.getLifePathMeaningAI) {
                const explanation = await MayaStatements.getLifePathExplanation(
                    day,
                    month,
                    year,
                    dayReduced,
                    monthReduced,
                    yearSum,
                    yearReduced,
                    total,
                    lifePath,
                    this.firstName,
                    spokenDate,
                    aiContext
                );
                if (explanation && explanation.length > 20) return explanation;
            }
            
            return null;
        }), 'calculating');
        
        const speakPromise = narrative && narrative.length > 20
            ? (console.log('📢 Life Path narrative:', narrative.substring(0, 60) + '...'), this.speak(narrative))
            : Promise.resolve();
        
        // Animate steps while speaking (faster pace)
        const stepsContainer = document.getElementById('life-path-steps');
        
        await MayaUtils.sleep(this.stageTiming.calcStepDelay + 120);
        this.addCalculationStep(stepsContainer, `${day} → ${dayReduced}`, 'Day');
        
        await MayaUtils.sleep(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${month} → ${monthReduced}`, 'Month');
        
        await MayaUtils.sleep(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${year} → ${yearSum} → ${yearReduced}`, 'Year');
        
        await MayaUtils.sleep(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${dayReduced} + ${monthReduced} + ${yearReduced} = ${total} → ${lifePath}`, 'Life Path', true);

        // Keep prior visual reveals visible and append the Life Path card instead of replacing them.
        this.appendResultCard('life-path', 'Your Life Path', lifePath, 'life-path');

        // Wait for speech to complete
        await speakPromise;
        await MayaUtils.sleep(this.stageTiming.stageSettle);
    },

    /**
     * Animate Destiny Number calculation with visuals
     */
    async animateDestinyCalculation() {
        const display = document.getElementById('calc-display');
        const resultArea = document.getElementById('calc-result');

        const isHindiLoadDest = MayaUtils?.storage?.get('maya_language') === 'hi';
        this.showCalcLoading(isHindiLoadDest ? 'Destiny Number निकाल रहे हैं...' : 'Calculating Destiny Number...');
        
        const destiny = this.calculations.destiny;
        const name = this.userData.name.toUpperCase();
        const letters = name.replace(/[^A-Z]/g, '');
        const breakdown = MayaNumerology.getNameBreakdown(this.userData.name);
        const sum = breakdown.reduce((s, item) => s + item.value, 0);

        const aiContext = this.buildBaseAIContext();

        // Show name breakdown with explanation
        const isHindiDest = MayaUtils?.storage?.get('maya_language') === 'hi';
        const destinyExplanation = isHindiDest
            ? 'आपके नाम का हर letter एक vibration carry करता है। Pythagorean system में values जोड़कर जो total बनता है, वही आपकी long-term direction और public role को reveal करता है।'
            : 'Each letter in your name carries a vibration. When we add those values through the Pythagorean system, the total reveals the direction your life keeps growing toward.';
        
        display.innerHTML = `
            <div class="calc-section destiny-calc">
                <h3><i class="bi bi-bullseye"></i> Destiny Number</h3>
                <p class="calc-explanation">${destinyExplanation}</p>
                <div class="name-display">
                    <span class="name-text">${this.userData.name}</span>
                </div>
                <div class="letter-breakdown" id="letter-grid"></div>
                <div class="calculation-steps" id="destiny-steps"></div>
            </div>
        `;

        // Keep this stage focused only on the Destiny calculation and its meaning.
        const isHindiDN = MayaUtils?.storage?.get('maya_language') === 'hi';
        let narrative = await this.withFiller(() => this.getContent('destinyCalculationNarrative', async () => {
            if (window.MayaStatements?.getDestinyMeaningAI) {
                const explanation = await MayaStatements.getDestinyExplanation(sum, destiny, this.firstName, aiContext);
                if (explanation && explanation.length > 20) return explanation;
            }
            
            return null;
        }), 'calculating');
        
        const speakPromise = narrative && narrative.length > 20
            ? (console.log('📢 Destiny narrative:', narrative.substring(0, 60) + '...'), this.speak(narrative))
            : Promise.resolve();
        
        // Animate letters
        const letterGrid = document.getElementById('letter-grid');
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const value = MayaNumerology.getLetterValue(letter);
            
            const letterEl = document.createElement('div');
            letterEl.className = 'letter-value-pair animate-in';
            letterEl.innerHTML = `
                <span class="letter">${letter}</span>
                <span class="value">${value}</span>
            `;
            letterGrid.appendChild(letterEl);
            
            await MayaUtils.sleep(this.stageTiming.letterDelay);
        }

        await MayaUtils.sleep(this.stageTiming.calcStepDelay - 200);
        
        // Show sum
        const stepsContainer = document.getElementById('destiny-steps');
        this.addCalculationStep(stepsContainer, `Sum = ${sum} → ${destiny}`, 'Destiny', true);

        this.appendResultCard('destiny', 'Your Destiny', destiny, 'destiny');

        await speakPromise;
        await MayaUtils.sleep(this.stageTiming.stageSettle);
    },

    /**
     * Animate Soul Urge calculation with visuals
     */
    async animateSoulUrgeCalculation() {
        const display = document.getElementById('calc-display');
        const resultArea = document.getElementById('calc-result');

        const isHindiLoadSU = MayaUtils?.storage?.get('maya_language') === 'hi';
        this.showCalcLoading(isHindiLoadSU ? 'Soul Urge Number निकाल रहे हैं...' : 'Calculating Soul Urge...');
        
        const soulUrge = this.calculations.soulUrge;
        const name = this.userData.name.toUpperCase();
        const letters = name.replace(/[^A-Z]/g, '');
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        
        let vowelSum = 0;
        for (const letter of letters) {
            if (vowels.includes(letter)) {
                vowelSum += MayaNumerology.getLetterValue(letter);
            }
        }

        const aiContext = this.buildBaseAIContext();

        // Show vowels breakdown with detailed explanation
        const isHindiSoul = MayaUtils?.storage?.get('maya_language') === 'hi';
        const soulExplanation = isHindiSoul
            ? 'Vowels (A, E, I, O, U) आपके नाम की "साँस" हैं - ये inner voice carry करते हैं। Consonants outer role दिखाते हैं, पर vowels inner desire और emotional pull reveal करते हैं।'
            : 'Vowels (A, E, I, O, U) are the breath of the name. Consonants show the outer role, but vowels reveal the inner desire and emotional pull beneath it.';
        
        display.innerHTML = `
            <div class="calc-section soul-urge-calc">
                <h3><i class="bi bi-heart-pulse-fill"></i> Soul Urge Number</h3>
                <p class="calc-explanation">${soulExplanation}</p>
                <div class="letter-breakdown vowel-display" id="vowel-grid"></div>
                <div class="calculation-steps" id="soul-steps"></div>
            </div>
        `;

        // Keep this stage focused only on the Soul Urge calculation and hidden motivation.
        const isHindiSU = MayaUtils?.storage?.get('maya_language') === 'hi';
        let narrative = await this.withFiller(() => this.getContent('soulUrgeCalculationNarrative', async () => {
            if (window.MayaStatements?.getSoulUrgeMeaningAI) {
                const explanation = await MayaStatements.getSoulUrgeExplanation(vowelSum, soulUrge, this.firstName, aiContext);
                if (explanation && explanation.length > 20) return explanation;
            }
            
            return null;
        }), 'calculating');
        
        const speakPromise = narrative && narrative.length > 20
            ? (console.log('📢 Soul Urge narrative:', narrative.substring(0, 60) + '...'), this.speak(narrative))
            : Promise.resolve();
        
        // Animate vowels
        const vowelGrid = document.getElementById('vowel-grid');
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const isVowel = vowels.includes(letter);
            const value = MayaNumerology.getLetterValue(letter);
            
            const letterEl = document.createElement('div');
            letterEl.className = `letter-value-pair ${isVowel ? 'is-vowel animate-in' : 'is-consonant'}`;
            letterEl.innerHTML = `
                <span class="letter">${letter}</span>
                <span class="value">${isVowel ? value : '-'}</span>
            `;
            vowelGrid.appendChild(letterEl);
            
            await MayaUtils.sleep(isVowel ? this.stageTiming.vowelDelay : Math.max(70, this.stageTiming.letterDelay - 40));
        }

        await MayaUtils.sleep(this.stageTiming.calcStepDelay - 200);
        
        // Show sum
        const stepsContainer = document.getElementById('soul-steps');
        this.addCalculationStep(stepsContainer, `Vowels = ${vowelSum} → ${soulUrge}`, 'Soul Urge', true);

        this.appendResultCard('soul-urge', 'Your Soul Urge', soulUrge, 'soul-urge');

        await speakPromise;
        await MayaUtils.sleep(this.stageTiming.stageSettle);
    },

    /**
     * Render the kundli cells used in the animated funnel reveal.
     */
    renderKundliFormationCells(planetGroups = [], ascendantName = '') {
        const groups = new Map((planetGroups || []).map((group) => [group.signName, group]));
        return MAYA_CONFIG.ZODIAC.SIGNS.map((sign) => {
            const group = groups.get(sign.name) || { planets: [] };
            const shortName = window.MayaKundli?.signShortNames?.[sign.name] || sign.name.slice(0, 3);
            const isAscendant = sign.name === ascendantName;

            return `
                <div class="kundli-formation-cell ${isAscendant ? 'kundli-formation-cell--asc' : ''}" data-kundli-sign="${sign.name}">
                    <div class="kundli-formation-cell__header">
                        <span class="kundli-formation-cell__sign">${sign.symbol} ${shortName}</span>
                        ${isAscendant ? '<span class="kundli-formation-cell__badge">Asc</span>' : ''}
                    </div>
                    <div class="kundli-formation-cell__planets"></div>
                </div>
            `;
        }).join('');
    },

    /**
     * Add a small live signal chip during kundli formation.
     */
    pushKundliSignal(container, text) {
        if (!container || !text) return;
        const chip = document.createElement('div');
        chip.className = 'kundli-formation-signal animate-in';
        chip.textContent = text;
        container.appendChild(chip);
    },

    /**
     * Animate the user's kundli taking shape from their birth data.
     */
    async animateKundliFormation() {
        const display = document.getElementById('calc-display');
        const resultArea = document.getElementById('calc-result');
        const profile = this.personalization || {};
        const birthChart = this.kundliChart;

        if (!display || !resultArea || !birthChart?.planets?.length) {
            return;
        }

        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const ascendant = profile.hasReliableAscendant ? (profile.ascendant || birthChart.ascendant || {}) : {};
        const westernSign = profile.western?.name || '';
        const moonSign = profile.moonSign || '';
        const placeLabel = profile.birthPlaceShort || this.userData.birthPlace || (isHindi ? 'जन्म स्थान' : 'birth place');
        const timeLabel = this.hasExactBirthTime()
            ? this.userData.birthTime
            : (isHindi ? 'अनुमानित समय' : 'approximate time');
        const dashaLabel = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const insightItems = this.getKundliInsightItems(isHindi);
        const planetGroups = Array.isArray(profile.planetGroups) && profile.planetGroups.length
            ? profile.planetGroups
            : (window.MayaKundli?.groupPlanetsBySign?.(birthChart.planets) || []);
        const squareChartMarkup = window.MayaKundli?.generateChart
            && ascendant.name
            ? MayaKundli.generateChart(birthChart.planets, ascendant.name, 'south', {
                animateFormation: true,
                durationMs: 5500
            })
            : '';
        const ascendantLabel = isHindi ? this.localizeHindiText(ascendant.name || '--') : (ascendant.name || '--');
        const westernLabel = isHindi ? this.localizeHindiText(westernSign || '--') : (westernSign || '--');
        const moonSignLabel = isHindi ? this.localizeHindiText(moonSign || '--') : (moonSign || '--');
        const dashaText = isHindi ? this.localizeHindiText(dashaLabel || '--') : (dashaLabel || '--');
        const visibleKundliFacts = [
            westernSign ? `Sun sign: ${westernSign}` : '',
            ascendant.name ? `Ascendant: ${ascendant.name}` : '',
            moonSign ? `Moon sign: ${moonSign}` : '',
            dashaLabel ? `Current dasha: ${dashaLabel}` : ''
        ].filter(Boolean);
        const metaItems = [
            westernSign
                ? `<span class="kundli-formation-meta__item"><span class="kundli-formation-meta__label">${isHindi ? 'सूर्य राशि' : 'Sun Sign'}</span><strong class="kundli-formation-meta__value">${westernLabel}</strong></span>`
                : '',
            ascendant.name
                ? `<span class="kundli-formation-meta__item"><span class="kundli-formation-meta__label">${isHindi ? 'लग्न' : 'Ascendant'}</span><strong class="kundli-formation-meta__value">${ascendantLabel}</strong></span>`
                : '',
            moonSign
                ? `<span class="kundli-formation-meta__item"><span class="kundli-formation-meta__label">${isHindi ? 'चंद्र राशि' : 'Moon Sign'}</span><strong class="kundli-formation-meta__value">${moonSignLabel}</strong></span>`
                : '',
            dashaLabel
                ? `<span class="kundli-formation-meta__item"><span class="kundli-formation-meta__label">${isHindi ? 'दशा' : 'Dasha'}</span><strong class="kundli-formation-meta__value">${dashaText}</strong></span>`
                : ''
        ].filter(Boolean).join('');
        const explanationText = isHindi
            ? ascendant.name
                ? `सबसे पहले मैं ${this.localizeHindiText(placeLabel)} और ${timeLabel} के आधार पर आपकी कुंडली का विन्यास देख रही हूँ। लग्न, चंद्र राशि, दशा और ग्रहों की सघनता मिलकर यह दिखा रही हैं कि आपके जीवन का ढाँचा कैसे बनता है और आने वाले महीनों में कौन-सा मोड़ उभर सकता है।`
                : `सबसे पहले मैं ${this.localizeHindiText(placeLabel)} और ${timeLabel} के आधार पर आपकी कुंडली के visible संकेत देख रही हूँ। अभी मैं चंद्र राशि, दशा और ग्रहों की सघनता पर grounded reading रखूँगी।`
            : ascendant.name
                ? `First I’m forming your square kundli from ${placeLabel} and ${timeLabel}. Your ascendant, moon sign, dasha, and planetary clustering show the structure of your life patterns and the chapters ahead.`
                : `First I’m looking at the visible kundli markers from ${placeLabel} and ${timeLabel}. For now I’m keeping the reading grounded in your moon sign, dasha, and planetary clustering.`;

        display.innerHTML = `
            <div class="calc-section kundli-formation-calc">
                <h3><i class="bi bi-grid-3x3-gap-fill"></i> ${isHindi ? 'कुंडली विन्यास बन रहा है' : 'Forming Your Square Kundli'}</h3>
                <p class="calc-explanation">${explanationText}</p>
                ${metaItems ? `<div class="kundli-formation-meta">${metaItems}</div>` : ''}
                <div class="kundli-formation-chart-card">
                    <div class="kundli-formation-chart-shell" id="kundliFormationChartShell">
                        <div class="maya-kundli-chart kundli-formation-chart">
                            ${squareChartMarkup || `<div class="kundli-formation-chart-fallback">${isHindi ? 'कुंडली का चित्र तैयार हो रहा है...' : 'Kundli chart is forming...'}</div>`}
                        </div>
                    </div>
                </div>
                <div class="kundli-formation-signals" id="kundliFormationSignals"></div>
            </div>
        `;

        await MayaUtils.sleep(180);
        window.MayaKundli?.renderAllPendingCharts?.();
        document.getElementById('kundliFormationChartShell')?.classList.add('is-visible');

        let narrative = await this.withFiller(() => this.getContent('kundliStageNarrative', () => this.getAIScript('kundliFormation', {
            ascendant: ascendant.name,
            moonSign,
            currentDasha: dashaLabel,
            kundliDisplayFacts: visibleKundliFacts,
            yogaNames: profile.yogaNames,
            dominantElement: profile.dominantElement,
            chartHighlights: profile.highlights,
            predictionItems: this.buildPredictionItems()
        })), 'kundli');

        if (!narrative) {
            narrative = await this.withFiller(() => this.generateDirectReadingSection('kundli', {
                ...this.buildBaseAIContext(),
                kundliDisplayFacts: visibleKundliFacts,
                predictionItems: this.buildPredictionItems()
            }), 'kundli');
        }

        if (narrative) this.spokenNarrations.push({ stage: 'kundli', text: narrative });
        const speakPromise = this.speak(narrative);
        const signals = document.getElementById('kundliFormationSignals');
        const insights = document.getElementById('kundliFormationInsights');
        const headlineSignals = [
            ascendant.name ? (isHindi ? `${ascendantLabel} लग्न सक्रिय` : `${ascendant.name} ascendant rising`) : '',
            moonSign ? (isHindi ? `${moonSignLabel} चंद्र राशि सक्रिय` : `${moonSign} moon sign active`) : '',
            dashaLabel ? (isHindi ? `${dashaText} दशा सक्रिय` : `${dashaLabel} dasha active`) : ''
        ].filter(Boolean);

        for (const signal of headlineSignals) {
            this.pushKundliSignal(signals, signal);
            await MayaUtils.sleep(this.stageTiming.kundliSignalDelay);
        }

        const activeGroups = planetGroups.filter((group) => group.planets.length > 0).slice(0, 6);

        for (const group of activeGroups) {
            const groupSignLabel = isHindi ? this.localizeHindiText(group.signName) : group.signName;
            const summary = group.planets
                .slice(0, 3)
                .map((planet) => {
                    const planetLabel = planet.info?.vedic || planet.name;
                    return isHindi ? this.localizeHindiText(planetLabel) : planetLabel;
                })
                .join(', ');
            if (!summary) continue;

            this.pushKundliSignal(
                signals,
                isHindi ? `${groupSignLabel} में ${summary}` : `${summary} in ${group.signName}`
            );
            await MayaUtils.sleep(this.stageTiming.kundliSignalDelay + 40);
        }

        for (const item of insightItems) {
            if (!insights) break;
            const card = document.createElement('div');
            card.className = 'kundli-formation-insight animate-in';
            card.innerHTML = `
                <span class="kundli-formation-insight__title">${item.title}</span>
                <strong class="kundli-formation-insight__value">${item.value}</strong>
                ${item.detail ? `<span class="kundli-formation-insight__text">${item.detail}</span>` : ''}
            `;
            insights.appendChild(card);
            await MayaUtils.sleep(this.stageTiming.kundliInsightDelay);
        }

        await speakPromise;
        await MayaUtils.sleep(this.stageTiming.stageSettle);
    },

    /**
     * Add a calculation step with animation
     */
    addCalculationStep(container, text, label, isFinal = false) {
        const step = document.createElement('div');
        step.className = `calc-step ${isFinal ? 'final' : ''} animate-in`;
        step.innerHTML = `
            <span class="step-text">${text}</span>
            ${label ? `<span class="step-label">${label}</span>` : ''}
        `;
        container.appendChild(step);
    },

    /**
     * Format date for spoken delivery
     */
    formatDateSpoken(dateStr) {
        const date = new Date(dateStr);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        const suffix = ['th', 'st', 'nd', 'rd'][(day % 100 > 10 && day % 100 < 14) ? 0 : (day % 10 < 4 ? day % 10 : 0)];
        
        return `${month} ${day}${suffix}, ${year}`;
    },

    // NOTE: Hardcoded quick meaning dictionaries removed.
    // All meanings are now AI-generated via MayaStatements.getLifePathMeaningAI / getDestinyMeaningAI / getSoulUrgeMeaningAI
    // with tiny inline fallbacks in the call sites above.

    /**
     * Show teaser reveal with AI Summary, FOMO, then Email Gate
     */
    async showTeaserReveal() {
        if ([this.PHASES.EMAIL_GATE, this.PHASES.LOGIN_OR_REGISTER, this.PHASES.DEEP_REVEAL, this.PHASES.COMPLETE].includes(this.currentPhase)) {
            return;
        }

        this.hasRevealedTeaser = true;
        this.currentPhase = this.PHASES.TEASER_REVEAL;
        
        const blobContainer = document.getElementById('maya-blob-container');
        if (blobContainer) {
            blobContainer.classList.add('blob-centered');
        }

        const lang = MayaUtils.storage.get('maya_language') || this.userData.language || 'en';
        if (window.MayaStatements) MayaStatements.setLanguage(lang);
        const predictionItems = this.buildPredictionItems();
        const aiContext = this.buildBaseAIContext(predictionItems);

        // Single combined AI call for all 3 teaser segments + email ask
        const teaserNarration = await this.getContent('teaserRevealNarration', async () => {
            const combined = await this.withFiller(
                () => this.generateDirectReadingSection('combinedTeaser', aiContext),
                'revealing'
            );
            if (combined && combined.length > 40) {
                // Extract unresolved thread for later reference (last segment)
                const parts = combined.split(/\[\[pause-250\]\]/i).map(s => s.trim()).filter(Boolean);
                if (parts.length >= 3) this.unresolvedThread = parts[parts.length - 1];
                return combined;
            }
            // Fallback: try individual calls if combined fails
            const segments = [];
            const identityTruth = await this.generateDirectReadingSection('identityTruth', aiContext);
            if (identityTruth?.length > 20) segments.push(identityTruth.trim());
            const emotionalPattern = await this.generateDirectReadingSection('emotionalPattern', aiContext);
            if (emotionalPattern?.length > 20) segments.push(emotionalPattern.trim());
            const unresolvedThread = await this.generateDirectReadingSection('unresolvedThread', aiContext);
            if (unresolvedThread?.length > 20) { segments.push(unresolvedThread.trim()); this.unresolvedThread = unresolvedThread; }
            return segments.join(' [[pause-250]] ');
        });

        try {
            if (teaserNarration && teaserNarration.length > 20) {
                await this.speak(teaserNarration);
                this.spokenNarrations.push({ stage: 'teaser', text: teaserNarration });
            }
        } finally {
            // Skip the separate emailGate AI narration — the suspense bridge + email form handle the ask.
            // Speaking "enter your email" AND showing the form felt like asking twice.
            this.teaserGateNarrated = true;
        }
    },

    /**
     * Generate AI Summary - Personal stunning insight AFTER numbers (narrative, not number-focused)
     */
    async generateAISummary() {
        // Always get language from storage to ensure consistency
        const lang = MayaUtils.storage.get('maya_language') || this.userData.language || 'en';
        const isHindi = lang === 'hi';
        
        // Ensure MayaStatements has correct language set
        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        if (!window.MayaAI) {
            return '';
        }

        try {
            const prompt = this.buildAISummaryPrompt(isHindi);
            MayaAI.init({
                fullName: this.userData.name,
                birthDate: this.userData.birthDate,
                birthTime: this.userData.birthTime || '12:00',
                birthPlace: this.userData.birthPlace || 'Unknown',
                gender: this.userData.gender || 'unknown',
                language: lang
            });

            const summary = await MayaAI.sendMessage(prompt);
            return summary && summary.length > 20 ? summary : '';
        } catch (error) {
            console.warn('AI summary generation failed:', error.message);
            return '';
        }
    },

    /**
     * Fallback summary if AI fails - minimal, non-hardcoded
     */
    getFallbackAISummary() {
        return '';
    },

    /**
     * Get personalized curiosity hook (minimal fallback)
     */
    getPersonalizedHook() {
        return '';
    },

    /**
     * Show email gate with proper form
     */
    async showEmailGate({ deferFocus = false } = {}) {
        if (this.isUserLoggedIn || window.MayaAuth?.isAuthenticated) {
            return;
        }

        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');
        const existingInput = document.getElementById('gate-email');

        if (this.currentPhase === this.PHASES.EMAIL_GATE && existingInput) {
            if (!deferFocus) {
                this.focusAuthField(existingInput);
            }
            return;
        }

        this.currentPhase = this.PHASES.EMAIL_GATE;
        this.emailGateShown = true;
        this.emailSubmissionInProgress = false;
        this.authPromptedFields = new Set();
        
        if (blobContainer) {
            blobContainer.classList.remove('blob-centered');
            blobContainer.classList.add('blob-top');
        }
        
        if (textDisplay) {
            textDisplay.style.display = 'flex';
            textDisplay.classList.add('email-gate-active');
        }
        
        textDisplay.innerHTML = `
            <div class="email-gate-container">
                <div class="gate-header">
                    <h3>${isHindi ? 'अपनी निजी रीडिंग सेव करें' : 'Save Your Private Reading'}</h3>
                    <p class="gate-subtitle">${isHindi ? 'आपकी पूरी फाइल तैयार है — इसे अपने पास रखें' : `${this.firstName}, your full file is ready — keep it safe`}</p>
                </div>
                <div class="gate-benefits">
                    <div class="benefit-item">
                        <i class="bi bi-heart-fill"></i>
                        <span>${isHindi ? 'प्रेम और रिश्तों का समय-संकेत' : 'Love and relationship timing'}</span>
                    </div>
                    <div class="benefit-item">
                        <i class="bi bi-briefcase-fill"></i>
                        <span>${isHindi ? 'करियर और धन का अनुमान' : 'Career and wealth forecast'}</span>
                    </div>
                    <div class="benefit-item">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        <span>${isHindi ? 'सावधानी वाले बिंदु' : 'Pressure points and cautions'}</span>
                    </div>
                    <div class="benefit-item">
                        <i class="bi bi-calendar-event-fill"></i>
                        <span>${isHindi ? 'आने वाले चरणों की समय-रेखा' : 'Your next chapters timing map'}</span>
                    </div>
                </div>
                <form id="email-gate-form" class="gate-form">
                    <div class="form-group">
                        <input type="email" id="gate-email" class="form-control form-control-lg" 
                               placeholder="${isHindi ? 'अपनी ईमेल आईडी भरिए' : 'Enter your email address'}" required autocomplete="email">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg w-100 mt-3">
                        <i class="bi bi-unlock-fill me-2"></i>${isHindi ? 'पूरी रीडिंग अनलॉक करें' : 'Unlock Full Reading'}
                    </button>
                    <p class="gate-note mt-3">
                        <i class="bi bi-shield-check"></i> ${isHindi ? 'आपकी रीडिंग निजी और सुरक्षित रहेगी' : 'Your reading stays private and secure'}
                    </p>
                </form>
            </div>
        `;

        document.getElementById('email-gate-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.emailSubmissionInProgress) return;

            const email = document.getElementById('gate-email').value.trim();
            
            if (this.isValidEmail(email)) {
                await this.handleEmailSubmission(email);
            } else {
                MayaUtils.toast.error(isHindi ? 'कृपया सही ईमेल पता भरिए' : 'Please enter a valid email address');
            }
        });

        const emailInput = document.getElementById('gate-email');
        // No voice prompt on email focus - the spoken teaser already conveyed value.
        // The form + privacy note is enough. Avoid nagging for email.
        if (!deferFocus) {
            this.focusAuthField(emailInput);
        }
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Get random cosmic search statement
     */
    async getCosmicSearchStatement() {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const aiContext = this.buildAuthPromptContext();

        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        return await this.generateDirectReadingSection('authCheck', aiContext);
    },

    /**
     * Get random welcome back statement
     */
    async getWelcomeBackStatement() {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const aiContext = this.buildAuthPromptContext();

        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        return await this.generateDirectReadingSection('welcomeBack', aiContext);
    },

    /**
     * Get random new user statement
     */
    async getNewUserStatement() {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const aiContext = this.buildAuthPromptContext();

        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        return await this.generateDirectReadingSection('newUser', aiContext);
    },

    /**
     * Get random email gate transition statement
     */
    async getEmailGateTransition() {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const predictionItems = this.buildPredictionItems();
        const aiContext = this.buildBaseAIContext(predictionItems);
        return await this.generateDirectReadingSection('emailGate', aiContext);
    },

    /**
     * Shared AI context for auth and field prompts.
     */
    buildAuthPromptContext() {
        const predictionItems = this.buildPredictionItems();
        return this.buildBaseAIContext(predictionItems);
    },

    /**
     * Get spoken guidance for a specific auth field.
     */
    async getAuthFieldPrompt(fieldType) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const aiContext = this.buildAuthPromptContext();

        if (window.MayaStatements) {
            MayaStatements.setLanguage(lang);
        }

        try {
            if (fieldType === 'email' && window.MayaStatements?.getEmailFieldPrompt) {
                const text = await MayaStatements.getEmailFieldPrompt(this.firstName, aiContext);
                if (text && text.length > 20) return text;
            }

            if (fieldType === 'password' && window.MayaStatements?.getPasswordFieldPrompt) {
                const text = await MayaStatements.getPasswordFieldPrompt(this.firstName, aiContext);
                if (text && text.length > 20) return text;
            }

            if (fieldType === 'new-password' && window.MayaStatements?.getNewPasswordFieldPrompt) {
                const text = await MayaStatements.getNewPasswordFieldPrompt(this.firstName, aiContext);
                if (text && text.length > 20) return text;
            }

            if (fieldType === 'confirm-password' && window.MayaStatements?.getConfirmPasswordFieldPrompt) {
                const text = await MayaStatements.getConfirmPasswordFieldPrompt(this.firstName, aiContext);
                if (text && text.length > 20) return text;
            }
        } catch (error) {
            console.warn(`AI auth field prompt failed for ${fieldType}:`, error.message);
        }

        return '';
    },

    /**
     * Speak field guidance the first time an auth field receives focus.
     */
    bindVoicePromptOnFocus(input, fieldType) {
        if (!input) return;

        if (input.dataset.voicePromptBound === 'true') return;
        input.dataset.voicePromptBound = 'true';

        input.addEventListener('focus', () => {
            void (async () => {
                const promptKey = `${this.currentPhase || 'unknown'}:${fieldType}`;
                if (this.emailSubmissionInProgress || this.authPromptedFields.has(promptKey)) {
                    return;
                }

                this.authPromptedFields.add(promptKey);
                const prompt = await this.getAuthFieldPrompt(fieldType);
                if (prompt && document.body.contains(input)) {
                    await this.speak(prompt);
                }
            })();
        }, { once: true });
    },

    /**
     * Move focus into an auth field once it is rendered.
     */
    focusAuthField(input) {
        if (!input) return;
        requestAnimationFrame(() => {
            try {
                input.focus({ preventScroll: true });
            } catch {
                input.focus();
            }
        });
    },

    /**
     * Handle email submission
     */
    async handleEmailSubmission(email) {
        if (this.emailSubmissionInProgress) {
            console.warn('⚠️ Ignoring duplicate email submission');
            return;
        }

        const form = document.getElementById('email-gate-form');
        const emailInput = document.getElementById('gate-email');
        const submitButton = form?.querySelector('button[type="submit"]');
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const checkingText = lang === 'hi' 
            ? 'आपकी सुरक्षित रीडिंग जाँची जा रही है...'
            : 'Checking your saved reading...';

        this.emailSubmissionInProgress = true;
        this.currentPhase = this.PHASES.LOGIN_OR_REGISTER;
        const requestId = ++this.authRequestId;

        if (emailInput) emailInput.disabled = true;
        if (submitButton) submitButton.disabled = true;

        if (form) {
            form.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3 text-muted">${checkingText}</p>
                </div>
            `;
        }

        try {
            // Use Firebase through MayaAuth
            const exists = await MayaAuth.checkEmail(email);
            if (requestId !== this.authRequestId) return;
            
            if (exists) {
                await this.showLoginFlow(email);
            } else {
                await this.showRegistrationFlow(email);
            }
        } catch (error) {
            console.error('Email check failed:', error);
            if (requestId !== this.authRequestId) return;
            await this.showRegistrationFlow(email);
        } finally {
            if (!this.isUserLoggedIn) {
                this.emailSubmissionInProgress = false;
            }
        }
    },

    /**
     * Show login flow for existing users
     */
    async showLoginFlow(email) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        this.currentPhase = this.PHASES.LOGIN_OR_REGISTER;
        this.emailSubmissionInProgress = false;
        this.authPromptedFields = new Set();
        
        const textDisplay = document.getElementById('maya-text-display');
        textDisplay.style.display = 'flex';
        textDisplay.classList.add('email-gate-active');
        textDisplay.innerHTML = `
            <div class="auth-flow-container">
                <div class="auth-header">
                    <div class="auth-icon">👋</div>
                    <h3>${isHindi ? `फिर से स्वागत है, ${this.firstName}` : `Welcome Back, ${this.firstName}!`}</h3>
                    <p class="auth-email">${email}</p>
                </div>
                <form id="login-flow-form" class="auth-form">
                    <div class="form-group">
                        <input type="password" id="flow-password" class="form-control form-control-lg" 
                               placeholder="${isHindi ? 'अपना पासवर्ड भरिए' : 'Enter your password'}" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg w-100 mt-3">
                        ${isHindi ? 'आगे बढ़िए' : 'Continue My Journey'}
                    </button>
                    <p class="auth-link mt-3">
                        <a href="#" id="forgot-password-link" class="text-muted">${isHindi ? 'पासवर्ड भूल गए?' : 'Forgot password?'}</a>
                    </p>
                </form>
            </div>
        `;

        document.getElementById('login-flow-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('flow-password').value;
            await this.processLogin(email, password);
        });

        const passwordInput = document.getElementById('flow-password');
        this.bindVoicePromptOnFocus(passwordInput, 'password');
        this.focusAuthField(passwordInput);
    },

    /**
     * Show registration flow for new users
     */
    async showRegistrationFlow(email) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        this.currentPhase = this.PHASES.LOGIN_OR_REGISTER;
        this.emailSubmissionInProgress = false;
        this.authPromptedFields = new Set();
        
        const textDisplay = document.getElementById('maya-text-display');
        textDisplay.style.display = 'flex';
        textDisplay.classList.add('email-gate-active');
        textDisplay.innerHTML = `
            <div class="auth-flow-container">
                <div class="auth-header">
                    <div class="auth-icon"><i class="bi bi-stars"></i></div>
                    <h3>${isHindi ? 'अपनी रीडिंग सुरक्षित कीजिए' : 'Secure Your Reading'}</h3>
                    <p class="auth-email">${email}</p>
                </div>
                <form id="register-flow-form" class="auth-form">
                    <div class="form-group mb-3">
                        <input type="password" id="flow-new-password" class="form-control form-control-lg" 
                               placeholder="${isHindi ? 'नया पासवर्ड बनाइए' : 'Create a password'}" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <input type="password" id="flow-confirm-password" class="form-control form-control-lg" 
                               placeholder="${isHindi ? 'पासवर्ड की पुष्टि कीजिए' : 'Confirm password'}" required autocomplete="new-password">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg w-100 mt-3">
                        ${isHindi ? 'खाता बनाइए और आगे बढ़िए' : 'Create Account and Continue'}
                    </button>
                    <p class="auth-terms mt-3 text-muted small">
                        ${isHindi ? 'आगे बढ़कर आप सेवा की शर्तों से सहमत होते हैं' : 'By continuing, you agree to our Terms of Service'}
                    </p>
                </form>
            </div>
        `;

        document.getElementById('register-flow-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('flow-new-password').value;
            const confirm = document.getElementById('flow-confirm-password').value;
            
            if (password !== confirm) {
                MayaUtils.toast.error(isHindi ? 'दोनों पासवर्ड एक जैसे नहीं हैं' : 'Passwords do not match');
                return;
            }
            
            await this.processRegistration(email, password);
        });

        const newPasswordInput = document.getElementById('flow-new-password');
        const confirmPasswordInput = document.getElementById('flow-confirm-password');
        this.bindVoicePromptOnFocus(newPasswordInput, 'new-password');
        this.bindVoicePromptOnFocus(confirmPasswordInput, 'confirm-password');
        this.focusAuthField(newPasswordInput);
    },

    /**
     * Process login
     */
    async processLogin(email, password) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const btn = document.querySelector('#login-flow-form button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = isHindi
            ? '<span class="spinner-border spinner-border-sm me-2"></span>जुड़ रहा है...'
            : '<span class="spinner-border spinner-border-sm me-2"></span>Connecting...';

        const result = await MayaAuth.login(email, password);
        
        if (result.success) {
            this.isUserLoggedIn = true;
            
            // Show full app UI now that user is authenticated
            if (window.MayaApp?.onUserAuthenticated) {
                MayaApp.onUserAuthenticated();
            }
            
            // Preserve language preference - CRITICAL: restore from storage
            const language = MayaUtils.storage.get('maya_language') || this.userData.language || 'en';
            
            // IMPORTANT: Set language on MayaStatements after login
            if (window.MayaStatements) {
                MayaStatements.setLanguage(language);
                console.log('🌐 Language restored after login:', language);
            }
            
            // Get existing funnel data from localStorage to ensure nothing is lost
            const funnelData = MayaUtils.storage.get('funnel_data') || {};
            
            // Merge ALL funnel data with any existing profile - prioritize server data for returning users
            const existingProfile = MayaUtils.storage.get('maya_profile') || {};
            const serverUserData = result.user || {};
            
            const updatedProfile = {
                ...existingProfile,
                name: serverUserData.name || this.userData.name || funnelData.name || existingProfile.name,
                email: email,
                birthDate: serverUserData.birthDate || this.userData.birthDate || funnelData.birthDate || existingProfile.birthDate,
                birthTime: serverUserData.birthTime || this.userData.birthTime || funnelData.birthTime || existingProfile.birthTime,
                birthPlace: serverUserData.birthPlace || this.userData.birthPlace || funnelData.birthPlace || existingProfile.birthPlace,
                birthLat: serverUserData.birthLat || this.userData.birthLat || funnelData.birthLat || existingProfile.birthLat,
                birthLon: serverUserData.birthLon || this.userData.birthLon || funnelData.birthLon || existingProfile.birthLon,
                gender: serverUserData.gender || this.userData.gender || funnelData.gender || existingProfile.gender,
                language: language
            };
            
            MayaUtils.storage.set('maya_profile', updatedProfile);
            MayaUtils.storage.set('maya_language', language);
            MayaUtils.storage.set('funnel_complete', false);

            await window.MayaApp?.applyLanguagePreference?.(language, { force: true });
            
            console.log('✅ Profile synced on login:', updatedProfile);
            
            // Check if this is a returning user with complete profile
            // Returning users should go directly to homepage, not through funnel again
            const hasCompleteBirthData = updatedProfile.birthDate && updatedProfile.name;
            const isReturningUser = serverUserData.birthDate || serverUserData.name;
            
            console.log('🔍 Login check:', { hasCompleteBirthData, isReturningUser, serverUserData });
            
            // Save ALL birth details to API (only if we have birth data)
            if (MayaAuth.isAuthenticated && updatedProfile.birthDate) {
                try {
                    await MayaAuth.saveBirthDetails({
                        name: updatedProfile.name,
                        birthDate: updatedProfile.birthDate,
                        birthTime: updatedProfile.birthTime || null,
                        birthPlace: updatedProfile.birthPlace || null,
                        birthLat: updatedProfile.birthLat || null,
                        birthLon: updatedProfile.birthLon || null,
                        gender: updatedProfile.gender || null,
                        language: language
                    });
                    console.log('✅ Birth details saved to cloud');
                } catch (e) {
                    console.error('Failed to save birth details to API:', e);
                }
            }
            
            MayaUtils.toast.success(isHindi ? 'फिर से स्वागत है!' : 'Welcome back!');

            console.log('📊 Login complete - continuing funnel flow into deep reveal', { hasCompleteBirthData, isReturningUser });
            await this.showDeepReveal();
        } else {
            btn.disabled = false;
            btn.innerHTML = isHindi ? 'आगे बढ़िए' : 'Continue My Journey';
            MayaUtils.toast.error(result.error || (isHindi ? 'गलत password' : 'Invalid password'));
        }
    },

    /**
     * Process registration
     */
    async processRegistration(email, password) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const btn = document.querySelector('#register-flow-form button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = isHindi
            ? '<span class="spinner-border spinner-border-sm me-2"></span>बनाया जा रहा है...'
            : '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

        // Get existing funnel data from localStorage to ensure nothing is lost
        const funnelData = MayaUtils.storage.get('funnel_data') || {};
        
        // Merge all data sources for registration
        const userData = {
            name: this.userData.name || funnelData.name,
            email: email,
            password: password,
            birthDate: this.userData.birthDate || funnelData.birthDate,
            birthTime: this.userData.birthTime || funnelData.birthTime || null,
            birthPlace: this.userData.birthPlace || funnelData.birthPlace || null,
            birthLat: this.userData.birthLat || funnelData.birthLat || null,
            birthLon: this.userData.birthLon || funnelData.birthLon || null,
            gender: this.userData.gender || funnelData.gender || null
        };

        const result = await MayaAuth.register(userData);
        
        if (result.success) {
            this.isUserLoggedIn = true;
            
            // Show full app UI now that user is authenticated
            if (window.MayaApp?.onUserAuthenticated) {
                MayaApp.onUserAuthenticated();
            }
            
            // Preserve language preference - CRITICAL: restore from storage
            const language = MayaUtils.storage.get('maya_language') || this.userData.language || 'en';
            
            // IMPORTANT: Set language on MayaStatements after registration
            if (window.MayaStatements) {
                MayaStatements.setLanguage(language);
                console.log('🌐 Language restored after registration:', language);
            }
            
            // Save COMPLETE profile including ALL birth details
            const fullProfile = {
                name: userData.name,
                email: email,
                birthDate: userData.birthDate,
                birthTime: userData.birthTime,
                birthPlace: userData.birthPlace,
                birthLat: userData.birthLat,
                birthLon: userData.birthLon,
                gender: userData.gender,
                language: language
            };
            
            MayaUtils.storage.set('maya_profile', fullProfile);
            MayaUtils.storage.set('maya_language', language);
            MayaUtils.storage.set('funnel_complete', false);

            await window.MayaApp?.applyLanguagePreference?.(language, { force: true });
            
            console.log('✅ Profile saved on registration:', fullProfile);
            
            // Save ALL birth details to API
            if (MayaAuth.isAuthenticated) {
                try {
                    await MayaAuth.saveBirthDetails({
                        name: userData.name,
                        birthDate: userData.birthDate,
                        birthTime: userData.birthTime,
                        birthPlace: userData.birthPlace,
                        birthLat: userData.birthLat,
                        birthLon: userData.birthLon,
                        gender: userData.gender,
                        language: language
                    });
                    console.log('✅ Birth details saved to cloud');
                } catch (e) {
                    console.error('Failed to save birth details to API:', e);
                }
            }
            
            MayaUtils.toast.success(isHindi ? 'Account बन गया!' : 'Account created!');
            await this.showDeepReveal();
        } else {
            btn.disabled = false;
            btn.innerHTML = isHindi ? 'Account बनाइए और आगे बढ़िए' : 'Create Account and Continue';
            MayaUtils.toast.error(result.error || (isHindi ? 'Registration पूरा नहीं हो सका' : 'Registration failed'));
        }
    },

    /**
     * Show deep reveal - prep message with "Are you ready" button
     */
    async showDeepReveal() {
        if (!this.isUserLoggedIn && !window.MayaAuth?.isAuthenticated) {
            console.warn('🔒 Deep reveal blocked until auth completes');
            await this.showEmailGate();
            return;
        }

        this.currentPhase = this.PHASES.DEEP_REVEAL;
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');
        const lang = MayaUtils.storage.get('maya_language') || 'en';
        const predictionItems = this.buildPredictionItems();
        const aiContext = this.buildBaseAIContext(predictionItems);
        
        textDisplay.style.display = 'none';
        textDisplay.classList.remove('email-gate-active');
        
        if (blobContainer) {
            blobContainer.classList.remove('blob-top');
            blobContainer.classList.add('blob-centered');
        }
        
        let prepMsg = '';

        try {
            if (window.MayaStatements?.getDeepRevealPrep) {
                const scriptedPrep = await MayaStatements.getDeepRevealPrep(this.firstName, aiContext);
                if (scriptedPrep && scriptedPrep.length > 20) {
                    prepMsg = scriptedPrep;
                }
            }
        } catch (e) {
            console.warn('AI deep reveal prep failed:', e.message);
        }

        if (!prepMsg) {
            prepMsg = await this.generateDirectReadingSection('deepRevealPrep', aiContext);
        }
        
        if (prepMsg) {
            await this.speak(prepMsg);
        }

        // Chapter choice — let user pick starting direction
        const choice = await this.showDeepRevealWithChoice();
        this.chapterOrder = this.getChapterOrder(choice);

        // Deliver reading with chosen order
        await this.deliverDeepReading();
    },

    /**
     * Deliver the comprehensive deep reading - FLOWING BILINGUAL STORYTELLING
     */
    async deliverDeepReading() {
        if (!this.isUserLoggedIn && !window.MayaAuth?.isAuthenticated) {
            console.warn('🔒 Refusing to deliver deep reading before auth');
            await this.showEmailGate();
            return;
        }

        const numbers = this.calculations || MayaUtils.storage.get('maya_calculations') || {};
        const lang = MayaUtils.storage.get('maya_language') || 'en';
        const predictionItems = this.buildPredictionItems();
        const aiContext = this.buildBaseAIContext(predictionItems);
        // Pass what was already spoken so AI avoids repetition
        aiContext.alreadyToldDigest = this._getAlreadyToldDigest();
        
        // Safety check - ensure we have valid numbers
        if (!numbers.lifePath) {
            console.warn('No calculations available for deep reading');
            const recoveryNarration = await this.generateDirectReadingSection('calculationRecovery', aiContext);
            if (recoveryNarration) {
                await this.speak(recoveryNarration);
            } else {
                const speakingText = document.getElementById('maya-speaking-text');
                if (speakingText) {
                    speakingText.textContent = lang === 'hi'
                        ? 'रीडिंग डेटा उपलब्ध नहीं है। कृपया फिर से प्रयास करें।'
                        : 'Reading data is unavailable. Please try again.';
                }
            }
            return;
        }

        // Deliver chapters in user-chosen order with micro-prompts
        const chapters = this.chapterOrder || ['love', 'career', 'year', 'warning'];

        for (const chapter of chapters) {
            await this._deliverChapter(chapter, numbers, aiContext);

            // Micro-prompt after each chapter — answers feed into AI for next chapters
            const microAnswer = await this.showChapterMicroPrompt(chapter);
            if (microAnswer && microAnswer !== 'default') {
                aiContext[`microPrompt_${chapter}`] = microAnswer;
            }
        }
        
        // COMPLETION — AI outro
        let completionText = null;
        try {
            if (window.MayaStatements?.getCompletionOutro) {
                completionText = await this.withFiller(() => MayaStatements.getCompletionOutro(this.firstName, aiContext), 'thinking');
            }
        } catch (e) {
            console.warn('AI completion outro failed:', e.message);
        }

        if (!completionText) {
            completionText = await this.withFiller(() => this.generateDirectReadingSection('completion', aiContext), 'thinking');
        }

        if (completionText) {
            await this.speak(completionText);
        }
        
        // Mark complete
        MayaUtils.storage.set('funnel_complete', true);
        
        // Fade out music
        this.fadeOutMusic();

        // Return hook — leave an open thread for next session
        await this.showReturnHook();
        
        // Show chat interface with guided prompts
        this.showChatInterface();
    },

    /**
     * Deliver a single deep reading chapter (love / career / year / warning)
     */
    async _deliverChapter(chapter, numbers, aiContext) {
        const introSection = `${chapter}Intro`;
        const intro = await this.withFiller(() => this.generateDirectReadingSection(introSection, aiContext), chapter === 'warning' ? 'thinking' : chapter);
        if (intro) {
            await this.speak(intro);
            await MayaUtils.sleep(300);
        }

        let reading = null;
        try {
            if (chapter === 'love' && window.MayaStatements?.getLoveReadingAI) {
                reading = await this.withFiller(() => MayaStatements.getLoveReadingAI(numbers.lifePath, numbers.soulUrge, this.firstName, aiContext), 'love');
            } else if (chapter === 'career' && window.MayaStatements?.getCareerReadingAI) {
                reading = await this.withFiller(() => MayaStatements.getCareerReadingAI(numbers.destiny, numbers.lifePath, this.firstName, aiContext), 'career');
            } else if (chapter === 'year' && window.MayaStatements?.getYearReadingAI) {
                reading = await this.withFiller(() => MayaStatements.getYearReadingAI(numbers.personalYear, this.buildPredictionItems(), this.firstName, aiContext), 'year');
            } else if (chapter === 'warning' && window.MayaStatements?.getWarningReadingAI) {
                reading = await this.withFiller(() => MayaStatements.getWarningReadingAI(numbers.lifePath, numbers.personalYear, this.firstName, aiContext), 'revealing');
            }
        } catch (e) {
            console.warn(`AI ${chapter} reading failed:`, e.message);
        }

        if (!reading) {
            reading = await this.withFiller(() => this.generateDirectReadingSection(chapter, aiContext), chapter === 'warning' ? 'revealing' : chapter);
        }

        if (reading) {
            await this.speak(reading);
            this.spokenNarrations.push({ stage: chapter, text: reading });
            await MayaUtils.sleep(800);
        }
    },

    /**
     * Show chat interface
     */
    showChatInterface() {
        const inputArea = document.getElementById('maya-input-area');
        const textDisplay = document.getElementById('maya-text-display');
        const blobContainer = document.getElementById('maya-blob-container');
        const overlay = document.getElementById('maya-overlay');
        
        // Hide progress bar — chat mode doesn't need it
        this.hideProgressMeter();
        
        // Hide funnel controls (pause button)
        this.showFunnelControls(false);
        
        // Switch overlay to chat mode
        if (overlay) {
            overlay.classList.remove('funnel-mode');
            overlay.classList.add('maya-overlay--chat');
        }
        
        if (blobContainer) {
            blobContainer.classList.remove('blob-centered');
            blobContainer.classList.add('blob-top');
            blobContainer.classList.add('blob-chat-mini');
        }
        
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';

        // Build guided conversation chips (Screen 24 completion chips)
        const chips = isHindi
            ? [
                { label: 'मेरा प्रेम पैटर्न', query: 'मेरे love और relationship patterns के बारे में detail में बताओ' },
                { label: 'मेरे अगले 3 महीने', query: 'मेरे अगले 3 महीनों में क्या होने वाला है? Timing और events बताओ' },
                { label: 'मेरी छिपी ताकत', query: 'मेरी सबसे बड़ी hidden strength क्या है जो मेरे numbers में दिखती है?' },
                { label: 'मेरा सबसे बड़ा गलती पैटर्न', query: 'मेरा सबसे बड़ा repeating mistake pattern क्या है जो मुझे रोकता है?' }
            ]
            : [
                { label: 'My Love Pattern', query: 'Tell me about my love and relationship patterns in detail' },
                { label: 'My Next 3 Months', query: 'What is going to happen in my next 3 months? Tell me about timing and events' },
                { label: 'My Hidden Strength', query: 'What is my biggest hidden strength that shows up in my numbers?' },
                { label: 'My Biggest Mistake Pattern', query: 'What is my biggest repeating mistake pattern that holds me back?' }
            ];

        if (textDisplay) {
            textDisplay.style.display = 'flex';
            textDisplay.classList.add('maya-chat-mode');
            textDisplay.innerHTML = `
                <div class="maya-chat-messages" id="maya-chat-messages">
                    <div class="maya-guided-chips" id="maya-guided-chips">
                        ${chips.map(chip => `
                            <button class="maya-chip-btn" data-query="${chip.query}">${chip.label}</button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (inputArea) {
            inputArea.style.display = 'flex';
        }

        const sendBtn = document.getElementById('maya-send');
        const input = document.getElementById('maya-input');
        const micBtn = document.getElementById('maya-mic');
        if (input) input.placeholder = isHindi ? 'MAYA से कुछ भी पूछें...' : 'Ask MAYA anything...';

        const handleSend = async () => {
            const message = input.value.trim();
            if (!message) return;
            input.value = '';
            
            // Hide chips after first interaction
            const chipsContainer = document.getElementById('maya-guided-chips');
            if (chipsContainer) chipsContainer.remove();

            this._addChatBubble('user', message);
            await this.handleUserQuestion(message);
        };

        // Wire up guided chips
        const chipsContainer = document.getElementById('maya-guided-chips');
        if (chipsContainer) {
            chipsContainer.querySelectorAll('.maya-chip-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    input.value = btn.dataset.query;
                    chipsContainer.remove();
                    handleSend();
                });
            });
        }

        sendBtn?.addEventListener('click', handleSend);
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });

        // Set up voice recognition
        this.setupVoiceInput(micBtn, input, handleSend);
    },

    /**
     * Set up voice input with mic button (with retry mechanism)
     */
    setupVoiceInput(micBtn, input, onSend) {
        if (!micBtn || !window.MayaListener) {
            console.warn('🎤 MayaListener not available, will retry...');
            // Retry after a short delay
            setTimeout(() => this.setupVoiceInput(micBtn, input, onSend), 1000);
            return;
        }

        // Initialize listener with retry mechanism
        const initSuccess = MayaListener.init();
        if (!initSuccess) {
            console.warn('🎤 MayaListener init failed, will retry...');
            setTimeout(() => this.setupVoiceInput(micBtn, input, onSend), 1500);
            return;
        }
        
        MayaListener.setLanguage(this.language);
        
        // Store auto-listen preference
        this.autoListenEnabled = true;

        // Handle recognition errors with retry
        MayaListener.onError = (errorType) => {
            if (errorType === 'permission_denied') {
                console.warn('🎤 Microphone permission denied - voice input unavailable');
                if (input) input.placeholder = this.language === 'hi' ? 'माइक्रोफोन अनुमति नहीं दी गई' : 'Microphone permission denied';
                micBtn.style.opacity = '0.5';
                micBtn.title = 'Microphone permission denied';
            } else if (errorType === 'max_retries') {
                console.warn('🎤 Max retries reached - voice input may be unstable');
            }
        };

        // Handle recognition results
        MayaListener.onResult = (transcript) => {
            if (input) {
                input.value = transcript;
                // Auto-send voice input immediately
                onSend();
            }
        };

        MayaListener.onStart = () => {
            micBtn.classList.add('listening');
            micBtn.querySelector('i').className = 'bi bi-mic-fill';
            if (input) input.placeholder = this.language === 'hi' ? 'सुन रही हूँ...' : 'Listening...';
        };

        MayaListener.onEnd = () => {
            micBtn.classList.remove('listening');
            micBtn.querySelector('i').className = 'bi bi-mic';
            if (input) input.placeholder = this.language === 'hi' ? 'MAYA से कुछ भी पूछें...' : 'Ask MAYA anything...';
            // No auto-restart - user clicks mic to start listening again
        };

        // Click to toggle listening with retry on failure
        micBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (MayaVoice.isPlaying) return;
            
            if (MayaListener.isListening) {
                MayaListener.stop();
            } else {
                const started = await MayaListener.start();
                if (!started) {
                    // Show feedback that mic couldn't start
                    micBtn.classList.add('error');
                    setTimeout(() => micBtn.classList.remove('error'), 1000);
                    console.warn('🎤 Could not start listening - tap again to retry');
                }
            }
        });
        
        console.log('🎤 Voice input setup complete with retry mechanism');
    },

    /**
     * Handle user questions
     */
    /**
     * Add a chat bubble to the conversation.
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

    async handleUserQuestion(question) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';

        // Initialize AI if not already done
        if (window.MayaAI && !MayaAI.userContext) {
            MayaAI.init({
                fullName: this.userData.name,
                birthDate: this.userData.birthDate,
                birthTime: this.userData.birthTime,
                birthPlace: this.userData.birthPlace,
                gender: this.userData.gender,
                language: lang
            });
        }

        // Show typing indicator
        const typing = this._showTypingIndicator();

        try {
            const response = await MayaAI.askMaya(question, {
                fullName: this.userData.name,
                birthDate: this.userData.birthDate,
                birthTime: this.userData.birthTime,
                birthPlace: this.userData.birthPlace,
                language: lang
            });

            // Remove typing indicator and add response bubble
            typing?.remove();
            this._addChatBubble('maya', response);
            await this.speak(response);
        } catch (error) {
            console.error('AI response error:', error);
            typing?.remove();
            const errorMsg = lang === 'hi'
                ? 'उत्तर अभी उपलब्ध नहीं है। कृपया फिर से पूछें।'
                : 'The response is unavailable right now. Please ask again.';
            this._addChatBubble('maya', errorMsg);
        }
    },

    /**
     * Speak text using ElevenLabs
     * Disables mic listening while speaking
     * Has timeout protection to prevent infinite hangs
     * Properly handles pause/resume during speech
     */
    async speak(text) {
        if (!text) {
            console.warn('⚠️ speak() called with empty text');
            return;
        }

        const normalizedText = this.sanitizeNarrationText(text);
        if (!normalizedText) return;

        // Wait if funnel is paused before starting
        await this.waitIfPaused();
        
        console.log('🗣️ Speaking:', normalizedText.substring(0, 50) + '...');

        // Duck background music while speaking
        const savedVolume = this.backgroundMusic?.volume;
        if (this.backgroundMusic && !this.backgroundMusic.paused) {
            this.backgroundMusic.volume = Math.max(savedVolume * 0.3, 0.005);
        }

        // Disable mic while MAYA speaks
        if (window.MayaListener) {
            MayaListener.disable();
            this.updateMicButton(true);
        }

        if (window.MayaVoice && !MayaVoice.isMuted) {
            try {
                // Let speech complete naturally - no hard timeout
                // The voice module handles its own chunking and completion
                await MayaVoice.speak(normalizedText);
                
                // If speech was aborted (paused), wait for resume then replay
                if (MayaVoice.aborted && this.isPaused) {
                    console.log('⏸️ Speech was paused, waiting for resume...');
                    await this.waitIfPaused();
                    // Replay the text from beginning after resume
                    console.log('▶️ Resuming speech...');
                    await MayaVoice.speak(normalizedText);
                }
            } catch (error) {
                console.error('Voice error:', error);
                await MayaUtils.sleep(Math.min(Math.max(normalizedText.length * 22, 900), 4000));
            }
        } else {
            // No voice available, simulate reading time
            await MayaUtils.sleep(Math.max(1200, Math.min(normalizedText.length * 28, 6000)));
        }

        // Restore background music volume after speaking
        if (this.backgroundMusic && !this.backgroundMusic.paused && savedVolume != null) {
            this.backgroundMusic.volume = savedVolume;
        }

        // Re-enable mic after MAYA finishes speaking
        if (window.MayaListener) {
            MayaListener.enable();
            this.updateMicButton(false);
            
            // Auto-restart listening if auto-listen is enabled
            if (this.autoListenEnabled) {
                setTimeout(() => {
                    if (this.autoListenEnabled && !MayaVoice.isPlaying && !MayaListener.isListening) {
                        MayaListener.start();
                    }
                }, 500);
            }
        }
    },

    /**
     * Close funnel and return to main app
     * Used when returning user logs in
     */
    closeFunnel() {
        console.log('🚪 Closing funnel overlay...');
        
        const overlay = document.getElementById('maya-overlay');
        const textDisplay = document.getElementById('maya-text-display');
        const inputArea = document.getElementById('maya-input-area');
        const blobContainer = document.getElementById('maya-blob-container');
        
        // Stop any ongoing speech
        if (window.MayaVoice) {
            MayaVoice.stop();
        }
        
        // Hide funnel controls
        this.showFunnelControls(false);
        
        // Hide the overlay
        if (overlay) {
            overlay.classList.remove('show', 'funnel-mode');
        }
        
        // Reset text display
        if (textDisplay) {
            textDisplay.style.display = 'none';
            textDisplay.innerHTML = '';
            textDisplay.classList.remove('email-gate-active');
        }
        
        // Reset input area
        if (inputArea) {
            inputArea.style.display = 'none';
        }
        
        // Reset blob
        if (blobContainer) {
            blobContainer.classList.remove('blob-top', 'blob-centered');
        }
        
        // Reset funnel state
        this.isActive = false;
        this.currentPhase = null;
        this.emailGateShown = false;
        this.emailSubmissionInProgress = false;
        this.teaserGateNarrated = false;
        this.authPromptedFields = new Set();
        
        console.log('✅ Funnel closed successfully');
    },

    /**
     * Update mic button state
     */
    updateMicButton(disabled) {
        const micBtn = document.getElementById('maya-mic');
        if (micBtn) {
            if (disabled) {
                micBtn.classList.add('disabled');
                micBtn.title = this.language === 'hi' ? 'MAYA बोल रहे हैं...' : 'MAYA is speaking...';
            } else {
                micBtn.classList.remove('disabled');
                const isAutoListen = this.autoListenEnabled;
                micBtn.title = isAutoListen 
                    ? (this.language === 'hi' ? 'ऑटो-सुनना चालू - बंद करने के लिए क्लिक करें' : 'Auto-listen on - click to turn off')
                    : (this.language === 'hi' ? 'सुनना शुरू करने के लिए क्लिक करें' : 'Click to start listening');
            }
        }
    }
};

// Make globally available
window.MayaFunnel = MayaFunnel;

// Debug function to check funnel status
window.checkFunnelStatus = function() {
    console.log('=== MAYA FUNNEL STATUS CHECK ===');
    console.log('MayaFunnel available:', !!window.MayaFunnel);
    console.log('MayaNumerology available:', !!window.MayaNumerology);
    console.log('MayaUtils available:', !!window.MayaUtils);
    console.log('MayaVoice available:', !!window.MayaVoice);
    console.log('MayaStatements available:', !!window.MayaStatements);
    console.log('Bootstrap Modal available:', !!window.bootstrap?.Modal);
    console.log('');
    console.log('Funnel state:');
    console.log('  isActive:', MayaFunnel.isActive);
    console.log('  currentPhase:', MayaFunnel.currentPhase);
    console.log('  userData:', MayaFunnel.userData);
    console.log('  calculations:', MayaFunnel.calculations);
    console.log('');
    console.log('Storage:');
    console.log('  maya_profile:', MayaUtils?.storage?.get('maya_profile'));
    console.log('  funnel_data:', MayaUtils?.storage?.get('funnel_data'));
    console.log('  funnel_state:', MayaUtils?.storage?.get('funnel_state'));
    console.log('================================');
    return 'Use MayaFunnel.retryStart() to manually retry if stuck';
};
