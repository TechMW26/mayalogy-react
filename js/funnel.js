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
    stepContextLog: [],
    authRequestId: 0,
    authPromptedFields: new Set(),
    backgroundMusic: null,
    calculationOverlay: null,
    kundliChart: null,
    personalization: null,
    _startupPrefetchPromise: null,
    _startupIntroPromise: null,
    _startupWarmupStartedAt: 0,
    _postIntroParallelPromise: null,
    _perfStartAt: 0,
    _firstIntroResolvedAt: 0,
    _firstSpeechRequestedAt: 0,
    _firstSpeechPlaybackAt: 0,
    _mcqAckCache: new Map(),
    _mcqAckInFlight: new Set(),

    // --- New funnel redesign state ---
    validationResponses: [],
    emotionalAnchor: null,
    strongestAccurateHit: null,
    chosenDeepDiveTopic: null,
    unresolvedThread: null,
    returnHookType: null,
    chapterOrder: null,

    stageTiming: {
        introSettle: 0,
        calculationLeadIn: 0,
        calcStepDelay: 0,
        letterDelay: 0,
        vowelDelay: 0,
        kundliSignalDelay: 0,
        kundliInsightDelay: 0,
        stageSettle: 0,
        validationSettle: 0,
        narrationPoll: 1,
        narrationBuffer: 0,
        suspensePause: 0
    },

    timingControl: {
        // 0 = instant pacing (no artificial waits), 1 = legacy pacing.
        scale: 0,
        minNarrationPoll: 1
    },

    optionAckTuning: {
        blockingGemini: false,
        backgroundGemini: true
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
    //  SESSION MEMORY - tracks user reactions for personalization
    // ============================================================
    sessionMemory: {
        validationAnswers: {},
        emotionalAnchors: [],
        strongHits: [],
        userQuestions: [],
        unresolvedTopics: [],
        progressUnlocks: [],
        profileAnswers: {}
    },

    resetSessionMemory() {
        this.sessionMemory = {
            validationAnswers: {},
            emotionalAnchors: [],
            strongHits: [],
            userQuestions: [],
            unresolvedTopics: [],
            progressUnlocks: [],
            profileAnswers: {}
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

    /**
     * Check if the selected guide persona is male.
     */
    _isGuiderMale() {
        const g = this.userData?.agentGender
            || (window.MayaUtils?.storage?.get('maya_profile'))?.agentGender
            || window.MayaVoice?.agentGender
            || 'female';
        return g === 'male';
    },

    /**
     * Return the guide display name based on gender.
     */
    _guideName() {
        return this._isGuiderMale() ? 'Moksh' : 'MAYA';
    },

    /**
     * Flip a static Hindi voice line to masculine when guide is male.
     * For voice lines that are spoken directly (not AI-generated prompts).
     */
    _flipVoiceLine(line) {
        if (!this._isGuiderMale()) return line;
        return line
            .replace(/रही हूँ/g, 'रहा हूँ')
            .replace(/सकती हूँ/g, 'सकता हूँ')
            .replace(/बताती हूँ/g, 'बताता हूँ')
            .replace(/कहती हूँ/g, 'कहता हूँ')
            .replace(/वाली हूँ/g, 'वाला हूँ')
            .replace(/गई हूँ/g, 'गया हूँ')
            .replace(/आई हूँ/g, 'आया हूँ')
            .replace(/\bबताऊँगी\b/g, 'बताऊँगा')
            .replace(/\bकहूँगी\b/g, 'कहूँगा')
            .replace(/\bकरूँगी\b/g, 'करूँगा')
            .replace(/\bपाऊँगी\b/g, 'पाऊँगा')
            .replace(/\bचाहती\b/g, 'चाहता')
            .replace(/\bदेखती\b/g, 'देखता')
            .replace(/\bसमझती\b/g, 'समझता')
            .replace(/\bकरती\b/g, 'करता')
            .replace(/\bलेती\b/g, 'लेता')
            .replace(/\bबनाती\b/g, 'बनाता')
            .replace(/\bसमझ गई\b/g, 'समझ गया')
            .replace(/\bलिख लेती\b/g, 'लिख लेता')
            .replace(/\bशुरू करती\b/g, 'शुरू करता')
            .replace(/\bजानती\b/g, 'जानता')
            .replace(/बड़ी बहन/g, 'बड़े भाई')
            .replace(/बहन जैसा/g, 'भाई जैसा')
            .replace(/\bMAYA\b/g, 'Moksh');
    },

    /**
     * Flip feminine Hindi verb forms in prompt instructions to masculine when guide is male.
     */
    _genderFlipPrompt(text) {
        if (!this._isGuiderMale()) return text;
        return text
            .replace(/\bMAYA\b/g, 'Moksh')
            .replace(/आप MAYA हैं/g, 'आप Moksh हैं')
            .replace(/You are MAYA/g, 'You are Moksh')
            .replace(/I am MAYA/g, 'I am Moksh')
            .replace(/introduce yourself as MAYA/gi, 'introduce yourself as Moksh')
            .replace(/कहिए कि आप MAYA हैं/g, 'कहिए कि आप Moksh हैं')
            .replace(/a wise female Vedic/gi, 'a wise male Vedic')
            .replace(/wise female/gi, 'wise male')
            .replace(/female guide/gi, 'male guide')
            .replace(/लिख रही हैं/g, 'लिख रहे हैं')
            .replace(/कर रही हैं/g, 'कर रहे हैं')
            .replace(/share कर रही हैं/g, 'share कर रहे हैं')
            .replace(/बता रही हैं/g, 'बता रहे हैं')
            .replace(/पाऊँगी/g, 'पाऊँगा')
            .replace(/बताऊँगी/g, 'बताऊँगा')
            .replace(/करूँगी/g, 'करूँगा')
            .replace(/कहूँगी/g, 'कहूँगा')
            .replace(/कर सकती/g, 'कर सकता')
            .replace(/\bचाहती\b/g, 'चाहता')
            .replace(/\bजानती है/g, 'जानता है')
            .replace(/how does she know/gi, 'how does he know')
            .replace(/"she sees me"/gi, '"he sees me"')
            .replace(/\bshe sees\b/gi, 'he sees')
            .replace(/\bshe explains\b/gi, 'he explains')
            .replace(/\bshe noticed\b/gi, 'he noticed')
            .replace(/\bher own voice\b/gi, 'his own voice');
    },

    /**
     * Single source of truth for all AI rules - called by buildDirectSectionPrompt AND buildSummaryPrompt.
     */
    getBaseRules(isHindi) {
        const userGender = this.userData?.gender || '';
        const genderLabel = userGender === 'male' ? 'Male (पुरुष)' : userGender === 'female' ? 'Female (महिला)' : 'Not specified';
        const _gn = this._guideName();

        return isHindi
            ? `Rules:
- User gender: ${genderLabel}
- सिर्फ उन्हीं patterns पर बात करें जो ऊपर दिए facts से support होते हैं।
- एक strength और एक friction point दोनों बताइए। अगर संकेत mixed हैं, तो mixed ही कहिए।
- ⚖️ KUNDLI-FIRST BALANCE: हर reading में KUNDLI/VEDIC DATA को PRIMARY source रखिए - planetary positions, दशा periods, house analysis, yogas, transits। Numerology SECONDARY support के लिए। अगर kundli data available है तो reading 70% kundli-based, 30% numerology-based। सिर्फ numbers पर based reading FORBIDDEN है जब chart data उपलब्ध है।
- western zodiac, vedic moon sign, और ascendant को mix मत कीजिए। label साफ रखें।
- "आप powerful हैं", "success आ रहा है" जैसी default praise FORBIDDEN। love, money, marriage, fame के guarantees FORBIDDEN। psychic/energy claims FORBIDDEN।
- user का नाम हमेशा Devanagari में लिखिए (Aviraj → अविराज)। TTS के लिए जरूरी।
- 🚫 नाम MAX 1-2 बार पूरे response में। बाकी "आप/आपके/आपकी"। हर sentence में नाम = FORBIDDEN।
- 🚫 WORD REPETITION BAN (STRICT): एक ही शब्द लगातार 2 sentences में FORBIDDEN। एक ही शब्द SAME sentence में दो बार = सबसे बुरा (जैसे "राहु दशा राहु दशा", "इस समय इस समय" = ABSOLUTELY FORBIDDEN)। Synonyms use करें। "energy" → "ऊर्जा/ताकत/vibe", "pattern" → "ढंग/cycle"। Same word back-to-back = BAD। OUTPUT GENERATE करने के बाद RE-READ करें - अगर कोई भी noun, adjective, या technical term (जैसे लग्न, दशा, राशि, भाव) लगातार 2 बार दिखे तो दूसरी बार synonym या indirect reference से बदलें।
- 🚫 TECHNICAL TERM REPETITION: कोई भी technical term (लग्न, Mean Lagna, ascendant, दशा, राहु, शनि, etc.) एक response में MAX 2 बार। तीसरी बार = FORBIDDEN। "वही लग्न", "यही ascendant", "उसी ग्रह" जैसे indirect references use करें।
- 🚫 YOGA/DOSHA/DASHA REPETITION: एक ही yoga/dosha/dasha नाम बार-बार FORBIDDEN। दूसरा angle या indirect reference दीजिए ("वही दशा", "वही pattern")।
- 🚫 DASHA DOMINANCE BAN: पूरे response का focus सिर्फ एक ही दशा (जैसे राहु दशा) पर मत रखिए। एक बार dasha name बोलकर आगे house, aspect, transit, yogas, remedies या behavior patterns से analysis diversify करें।
- 🔊 YOGA TTS: योग नाम ONLY देवनागरी: गजकेसरी योग (NOT Gaja Kesari Yoga), बुधादित्य योग, चन्द्र मंगल योग, हंस योग, नीचभंग राजयोग, काल सर्प दोष, मंगल दोष। Numbers Hindi में: पहला भाव, सातवाँ भाव।
- 🚫 ROMANIZED HINDI BAN: Hindi/Sanskrit words कभी Roman script में नहीं (aapka, kundli, rashi, graha FORBIDDEN → आपका, कुंडली, राशि, ग्रह)।
- 🚫 URDU/ARABIC/PERSIAN BAN: ये HINDI app है। Nuqta (ज़, क़, ख़, ग़, फ़) ABSOLUTELY FORBIDDEN - बिना nuqta लिखिए (ज़→ज, फ़→फ)। Banned → Hindi: इश्क/मोहब्बत→प्यार/प्रेम, ख्वाब→सपना, शख्सियत→personality, ताल्लुक→रिश्ता, किस्मत/तक़दीर→भाग्य/luck, सुकून→शांति, हौसला→हिम्मत, वजह→कारण, गुजरना→बीतना, खुदा→भगवान, वक्त→समय, राज़→रहस्य, ग़ौर→ध्यान, नज़र→नजर/दृष्टि, हक़ीक़त→सच्चाई, मंज़िल→लक्ष्य, अल्फ़ाज़→शब्द, रूह→आत्मा, जज़्बात→भावनाएँ, ख़याल→विचार, ज़माना→दौर, इज़्ज़त→सम्मान। Plain हिन्दी बोलचाल use करें।
- भाषा SIMPLE, साफ बोलचाल की **शुद्ध हिन्दी** - दोस्तों से बात करते हैं वैसे, पर हर शब्द देवनागरी हिन्दी या संस्कृत मूल का हो। English/Roman शब्द ABSOLUTELY FORBIDDEN। भारी/किताबी संस्कृत बदलें: "सम्भावना"→"मौका", "परिस्थिति"→"हालात", "विशेष"→"खास", "प्रभाव"→"असर"। English तकनीकी शब्दों के Hindi equivalents use करें: chart→कुंडली, dasha→दशा, transit→गोचर, house→भाव, ascendant→लग्न, remedy→उपाय, career→व्यवसाय, money→धन, marriage→विवाह, health→स्वास्थ्य, pattern→ढंग, energy→ऊर्जा, focus→ध्यान, balance→संतुलन।
- ✍️ SENTENCE FORMATION (CRITICAL): हर वाक्य पूरा, व्याकरण-सही, और natural spoken Hindi में हो। एक वाक्य से दूसरे में smooth flow हो -टूटे हुए टुकड़े (broken fragments) या phrase-collage FORBIDDEN। हर वाक्य का अपना subject + verb हो। पूरा paragraph एक बहती कहानी जैसा लगे, न कि अलग-अलग lines पकड़ी गई हों।
- 🎭 EXPRESSIVE DELIVERY (ElevenLabs v3 के लिए): प्रश्न हमेशा पूरे वाक्य के रूप में और '?' पर ख़त्म होने चाहिए (क्या आप..., कैसे..., क्यों..., कब..., कौन-सा...)। एक sentence में दो प्रश्न मत मिलाइए। dramatic रुकाव के लिए '…' (ellipsis) use करें - TTS engine इसे real pause के रूप में बजाएगा। गहरे/अंतरंग खुलासे से पहले एक छोटा वाक्य रखें ("सुनिए।", "देखिए।", "एक बात ध्यान से।")। हल्के, sparse expression tags भी allowed हैं अगर सच में ज़रूरी हो: [pause], [softly], [whispers], [curious], [warm], [thoughtful] - लेकिन कभी भी अंग्रेज़ी emotion words plain text में मत लिखें ("excited", "warmly" FORBIDDEN as words; केवल bracketed tag के अंदर allowed)।
- ⚠️ GENDER: ${_gn} खुद ${this._isGuiderMale() ? 'male है (मैं देख रहा हूँ, मुझे दिख रहा है)। अपने बारे में हमेशा MASCULINE forms use करें: रहा हूँ, सकता हूँ, बताता हूँ, करूँगा। Feminine forms (रही हूँ, सकती हूँ, बताती हूँ, करूँगी) FORBIDDEN।' : 'female है (मैं देख रही हूँ, मुझे दिख रहा है)। अपने बारे में हमेशा FEMININE forms use करें: रही हूँ, सकती हूँ, बताती हूँ, करूँगी।'} User को address करते वक्त उनका ACTUAL gender use करें। MALE→"आप जानते हैं, आप समझते हैं, आप कर सकते हैं"। FEMALE→"आप जानती हैं, आप समझती हैं, आप कर सकती हैं"। Male user को feminine forms = FORBIDDEN।
- ⏰ TENSE DISCIPLINE (STRICT): बीते हुए साल/महीने/events को ALWAYS past tense में बोलें - "उस वक्त", "तब", "हो चुका था", "गुजर चुका"। CURRENT month/year को present tense - "अभी", "इस वक्त", "चल रहा है"। आने वाले months/years को ALWAYS future tense - "आने वाला है", "होगा", "मिलेगा"। Past event को present/future tense में describe करना FORBIDDEN। Future event को past tense में बताना FORBIDDEN।
- TTS-safe, flowing narrative - बहती कहानी, disconnected टुकड़े नहीं। Bullet points नहीं, एक continuous paragraph।`
            : `Rules:
- User gender: ${genderLabel}
- Only describe patterns supported by facts above. Include one strength and one friction. Mixed evidence = say mixed.
- ⚖️ KUNDLI-FIRST BALANCE: Make KUNDLI/VEDIC DATA the PRIMARY source - planetary positions, dasha, house analysis, yogas, transits. Numerology is SECONDARY. When chart data exists, reading ~70% kundli, ~30% numerology. Numbers-only reading FORBIDDEN when chart data exists.
- Never conflate western zodiac, vedic moon sign, ascendant. Label clearly.
- No default praise ("you are powerful", "success is coming"). No promises of love/money/fame. No psychic claims.
- Write user name in Devanagari for TTS.
- 🚫 NAME: Max 1-2 times per response. Use "you/your" everywhere else. Every-sentence name = FORBIDDEN.
- 🚫 WORD REPETITION (STRICT): Same word in back-to-back sentences FORBIDDEN. Use synonyms. After generating output, RE-READ it - if any noun, adjective, or technical term (e.g. lagna, dasha, rashi, bhava) appears in 2 consecutive sentences, replace the second with a synonym or indirect reference.
- 🚫 TECHNICAL TERM REPETITION: Any technical term (lagna, Mean Lagna, ascendant, dasha, Rahu, Saturn, etc.) MAX 2 times per response. Third use = FORBIDDEN. Use indirect references like "the same ascendant", "that planet", "the cycle mentioned".
- 🚫 YOGA/DOSHA/DASHA REPETITION: Same term repeated across sections FORBIDDEN. Use different angles or indirect references.
- 🚫 DASHA DOMINANCE BAN: Do NOT let the entire response revolve around one dasha term (like Rahu dasha). Mention it once, then diversify analysis via houses, aspects, transits, yogas, remedies, and behavior patterns.
- 🔊 YOGA TTS: Always Devanagari for yoga names (गजकेसरी योग NOT Gaja Kesari Yoga). House numbers in Hindi (पहला भाव).
- 🚫 ROMANIZED HINDI: Never write Hindi in Roman script (aapka, kundli FORBIDDEN → आपका, कुंडली).
- ✍️ SENTENCE FORMATION (CRITICAL): Every sentence must be grammatically complete with its own subject + verb. The whole paragraph must read as one flowing British-English narrative -not a collage of disconnected fragments stitched together. Smooth, calm, refined cadence as if a thoughtful coach is speaking aloud.
- 🎭 EXPRESSIVE DELIVERY (for ElevenLabs v3): Questions must always be complete sentences ending in '?'. Never bury two questions in one sentence. Use ellipses ('…') for dramatic pauses - the TTS engine plays them as real silence beats. Before an intimate or revealing line, drop in a short lead-in sentence ("Listen.", "Look at this.", "Here is what I see."). Sparse inline v3 expression tags are allowed where genuinely useful: [pause], [softly], [whispers], [curious], [warm], [thoughtful], [intrigued] - but only the bracketed form; never write emotion words as plain prose ("excitedly", "warmly" FORBIDDEN as words). Vary cadence: short sentence, longer sentence, short again - so the voice breathes.
- ⚠️ GENDER: ${_gn} is ${this._isGuiderMale() ? 'male. Use masculine self-references: "I see", "I read", "I notice". Never use feminine framing (sister-like, she). Hindi self-reference: रहा हूँ, सकता हूँ, बताता हूँ, करूँगा (NOT रही हूँ, सकती हूँ, बताती हूँ, करूँगी).' : 'female.'} Address user with THEIR gender. Male→masculine ("आप जानते हैं"), Female→feminine ("आप जानती हैं"). Wrong gender = FORBIDDEN.
- ⏰ TENSE DISCIPLINE (STRICT): Past years/months/events MUST use past tense - "at that time", "back then", "had happened", "that period passed". CURRENT month/year uses present tense - "right now", "currently", "is happening". Future months/years MUST use future tense - "will", "is coming", "ahead". Describing a past event in present/future tense is FORBIDDEN. Describing a future event in past tense is FORBIDDEN.
- TTS-safe, flowing narrative. One continuous paragraph, not bullet points.`;
    },

    buildMemoryContext(isHindi) {
        const mem = this.sessionMemory;
        const parts = [];

        // Profile MCQ answers - critical for personalization
        if (mem.profileAnswers && Object.keys(mem.profileAnswers).length) {
            const profileSummary = Object.entries(mem.profileAnswers)
                .map(([q, a]) => `Q: ${q} → A: ${a}`)
                .join('; ');
            parts.push(isHindi
                ? `## USER PROFILE (इन सवालों के जवाब user ने खुद दिए हैं - इन्हें reading में deeply use कीजिए):\n${profileSummary}`
                : `## USER PROFILE (these are the user's OWN answers - use them deeply in the reading):\n${profileSummary}`);
        }

        if (Array.isArray(this.validationResponses) && this.validationResponses.length) {
            const responseHistory = this.validationResponses
                .map((entry) => {
                    const q = String(entry?.question || '').replace(/\s+/g, ' ').trim();
                    const a = String(entry?.answer || '').replace(/\s+/g, ' ').trim();
                    if (!q || !a) return '';
                    return `${q} => ${a}`;
                })
                .filter(Boolean)
                .join(' | ');

            if (responseHistory) {
                parts.push(isHindi
                    ? `## USER ANSWER HISTORY (अब तक के सभी जवाब):\n${responseHistory}`
                    : `## USER ANSWER HISTORY (all answers so far):\n${responseHistory}`);
            }
        }

        if (Array.isArray(this.stepContextLog) && this.stepContextLog.length) {
            const stageTrail = this.stepContextLog
                .slice(-20)
                .map((entry) => {
                    const stage = String(entry?.stage || '').trim();
                    const summary = String(entry?.summary || '').trim();
                    if (!stage || !summary) return '';
                    return `[${stage}] ${summary}`;
                })
                .filter(Boolean)
                .join(' || ');

            if (stageTrail) {
                parts.push(isHindi
                    ? `## STEP CONTINUITY TRAIL (recent flow):\n${stageTrail}`
                    : `## STEP CONTINUITY TRAIL (recent flow):\n${stageTrail}`);
            }
        }

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

    recordStepContext(stage, summary = '') {
        const stageLabel = String(stage || '').trim();
        const text = String(summary || '').replace(/\s+/g, ' ').trim();
        if (!stageLabel || !text) return;

        this.stepContextLog.push({
            stage: stageLabel,
            summary: text,
            timestamp: Date.now()
        });

        if (this.stepContextLog.length > 120) {
            this.stepContextLog = this.stepContextLog.slice(-120);
        }
    },

    _hasKundliReadyAnnouncement() {
        return (Array.isArray(this.spokenNarrations) ? this.spokenNarrations : [])
            .some((entry) => entry?.stage === 'postKundliTransition' && this._containsKundliReadyAnnouncement(entry.text));
    },

    _containsKundliReadyAnnouncement(text = '') {
        const value = String(text || '').toLowerCase();
        return /कुंडली\s+(?:बन\s+गई|बन\s+चुकी|तैयार\s+हो\s+गई|तैयार\s+है)/i.test(value)
            || /(?:kundli|chart)\s+is\s+(?:ready|formed)/i.test(value);
    },

    _stripKundliReadyAnnouncement(text = '') {
        return String(text || '')
            .replace(/(?:बहुत\s+अच्छा(?:\s+[^,।.!?]+)?[,\s]*)?(?:आपकी\s+)?कुंडली\s+(?:बन\s+गई|बन\s+चुकी|तैयार\s+हो\s+गई|तैयार\s+है)\s*(?:है)?[।.!?]?\s*/gi, '')
            .replace(/(?:wonderful|alright|great|okay)[,\s]*(?:[^,.!?]+,\s*)?(?:your\s+)?(?:kundli|chart)\s+is\s+ready[.!?]?\s*/gi, '')
            .replace(/(?:your\s+)?(?:kundli|chart)\s+is\s+(?:ready|formed)[.!?]?\s*/gi, '')
            .replace(/\s+/g, ' ')
            .replace(/^\s*[,।.!?;-]+\s*/, '')
            .trim();
    },

    _cleanNarrationForContext(text = '', maxLength = 520) {
        return String(text || '')
            .replace(/\[\[pause-\d+\]\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    },

    _buildContinuationGuard(sectionKey, isHindi) {
        const hasPriorNarration = (this.spokenNarrations?.length || 0) > 0;
        if (!hasPriorNarration) return '';

        return isHindi
            ? `## CONTINUITY GUARD -यह fresh session नहीं है
Current section: ${sectionKey}
- User पहले से इस reading में है; greeting या restart forbidden है।
- Output में कहीं भी "नमस्ते", "नमस्कार", "Hello", "Hi", "Hey", "Welcome back", या अपना introduction मत लिखिए।
- पहला वाक्य पिछली कही बात से naturally आगे बढ़े; ऐसा लगे कि same prediction जारी है।
- पिछली बातों को summarize मत कीजिए; उनसे आगे नया chart-based point खोलिए।`
            : `## CONTINUITY GUARD -this is not a fresh session
Current section: ${sectionKey}
- The user is already inside this reading; greetings or restarts are forbidden.
- Do not write "Namaste", "Hello", "Hi", "Hey", "Welcome back", or introduce yourself anywhere in the output.
- The first sentence must move forward from what was just said, like the same prediction is continuing.
- Do not summarize the previous material; build from it into a new chart-based point.`;
    },

    _buildGenerationContinuityContext(sectionKey, isHindi) {
        const spokenEntries = Array.isArray(this.spokenNarrations) ? this.spokenNarrations : [];
        const stepEntries = Array.isArray(this.stepContextLog) ? this.stepContextLog : [];
        if (!spokenEntries.length && !stepEntries.length) return '';

        const selectedSpoken = spokenEntries.length > 10
            ? [spokenEntries[0], ...spokenEntries.slice(-9)]
            : spokenEntries;
        const spokenDigest = selectedSpoken
            .map((entry) => {
                const stage = String(entry?.stage || 'previous').trim();
                const text = this._cleanNarrationForContext(entry?.text, 380);
                return text ? `[${stage}] ${text}` : '';
            })
            .filter(Boolean)
            .join('\n')
            .slice(0, 3200);
        const stepDigest = stepEntries
            .slice(-16)
            .map((entry) => {
                const stage = String(entry?.stage || '').trim();
                const summary = this._cleanNarrationForContext(entry?.summary, 220);
                return stage && summary ? `[${stage}] ${summary}` : '';
            })
            .filter(Boolean)
            .join('\n')
            .slice(0, 1600);

        return isHindi
            ? `SESSION SO FAR FOR CONTINUITY ONLY. Current next section: ${sectionKey}. User already heard these generations; continue from them, do not greet, do not introduce yourself, do not reset, and do not repeat them.\n\nSpoken generations:\n${spokenDigest || 'None'}${stepDigest ? `\n\nUser answers / flow events:\n${stepDigest}` : ''}`
            : `SESSION SO FAR FOR CONTINUITY ONLY. Current next section: ${sectionKey}. The user already heard these generations; continue from them, do not greet, do not introduce yourself, do not reset, and do not repeat them.\n\nSpoken generations:\n${spokenDigest || 'None'}${stepDigest ? `\n\nUser answers / flow events:\n${stepDigest}` : ''}`;
    },

    // ============================================================
    //  MAYA VOICE LIBRARY - 100+ bilingual personality lines
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
                "स्वागत है। मैं अभी आपकी कुंडली खोल रही हूँ।",
                "अच्छा हुआ कि आप आज यहाँ आए।",
                "चलिए, यह क़दम धीरे-धीरे उठाते हैं।",
                "यह वाचन आपके जन्म-ढंग से शुरू होता है।",
                "सबसे पहले वही बताऊँगी जो सबसे ज़्यादा दिख रहा है।",
                "हर कुंडली एक शांत सच्चाई से खुलती है।",
                "आपकी कुंडली में पहले से ही एक प्रबल संकेत दिख रहा है।",
                "ध्यान से बनावट देख रही हूँ।",
                "पहले कुछ पक्का कर लूँ, फिर साफ़ बताऊँगी।",
                "आपकी कुंडली का ढाँचा देख रही हूँ।"
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
                "आपके ग्रहों का सन्तुलन देख रही हूँ।",
                "यहाँ एक दोहराता हुआ ढंग है।",
                "आपकी कुंडली का एक हिस्सा बाकियों से ज़्यादा बोल रहा है।",
                "आपके समय-चक्र ध्यान से देख रही हूँ।",
                "इसके नीचे एक भावनात्मक ढंग छिपा है।",
                "कुंडली का यह हिस्सा भीतरी जीवन के बारे में बोलता है।",
                "रिश्तों के संकेत पक्के कर रही हूँ।",
                "देख रही हूँ कि आपके अंक एक-दूसरे से कैसे मिलते हैं।",
                "यह संयोग बहुत दिलचस्प है।",
                "देखती हूँ ये ढंग कैसे आपस में जुड़ते हैं।"
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
                "आप भीतर बहुत कुछ रखते हैं जो लोगों को पता नहीं चलता।",
                "बाहर से शान्त लगते हैं, पर भीतर गहरी सोच चलती रहती है।",
                "आपकी कुंडली में शक्ति है, पर उसके साथ दबाव भी है।",
                "लोगों को जल्दी समझ लेते हैं, पर भरोसा करने में समय लगता है।",
                "आप चुपचाप ज़िम्मेदारी उठा लेते हैं।",
                "आगे बढ़ने से पहले आप साफ़ समझ चाहते हैं।",
                "आप लापरवाही से निर्णय नहीं लेते।",
                "आप जितना बोलते हैं उससे कहीं ज़्यादा देख लेते हैं।",
                "बातचीत समाप्त होने के बाद भी आप उसके बारे में सोचते रहते हैं।",
                "आपकी कुंडली एक सोचने-समझने वाला स्वभाव दिखाती है।"
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
                "एक बात पक्की करना चाहती हूँ।",
                "ईमानदारी से बताइए।",
                "क्या यह सुनकर कुछ अपना-सा लगा?",
                "क्या कभी ऐसा अनुभव हुआ है?",
                "क्या यह ढंग आपके जीवन में दिखता है?",
                "यहाँ आपका सच्चा उत्तर चाहिए।",
                "यह हिस्सा केवल आप ही जानते हैं।",
                "क्या यह ठीक लग रहा है?",
                "इसके बारे में ध्यान से सोचिए।",
                "क्या यह आपके अनुभव से मिलता है?"
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
                "एक और बात है जिसे देखना चाहती हूँ।",
                "कुंडली का यह हिस्सा अधिक निजी हो जाता है।",
                "यह ध्यान से कहना चाहती हूँ।",
                "यहाँ कुछ असामान्य दिख रहा है।",
                "यह ढंग हर कुंडली में नहीं आता।",
                "इसे जल्दबाज़ी में नहीं समझाना चाहती।",
                "यहाँ से आपकी कुंडली अधिक विशिष्ट हो जाती है।",
                "कुछ ऐसा देखने को मिला है जो ध्यान माँगता है।",
                "एक और परत है जो अभी खोली नहीं है।",
                "यह हिस्सा किसी बड़ी बात से जुड़ा है।"
            ]
        },
        kundliTransition: {
            en: [
                "Based on everything you've shared with me, I now have what I need. Let me plot your kundli and we'll go deep into it together.",
                "I have your details. Now let me map your birth chart - once the kundli forms, I'll walk you through what it reveals.",
                "Good. With this information and what I already know, let me trace your kundli now. We'll read it together, step by step.",
                "Thank you. Now I'm going to form your kundli from this data. Once it's ready, I'll tell you exactly what I see.",
                "I have everything I need. Let me plot your birth chart now - the real reading begins once the kundli takes shape.",
                "Now comes the real part. Let me form your kundli - and then I'll show you what your chart actually says about you."
            ],
            hi: [
                "आपने जो जानकारी दी है, उसके आधार पर अब मेरे पास सब कुछ है। चलिए, आपकी कुंडली बनाते हैं और उसे साथ मिलकर पढ़ते हैं।",
                "अच्छा, अब मेरे पास आपकी सारी जानकारी है। पहले कुंडली बनती है, फिर मैं बताऊँगी कि उसमें क्या दिख रहा है।",
                "ठीक है। आपकी जानकारी और मेरे ज्ञान को मिलाकर, अब मैं आपकी कुंडली बना रही हूँ। साथ मिलकर पढ़ेंगे।",
                "धन्यवाद। अब इन सूचनाओं से आपकी जन्म कुंडली बना रही हूँ। जैसे ही तैयार होगी, मैं बताऊँगी कि क्या दिख रहा है।",
                "मेरे पास सब कुछ है जो चाहिए। अब कुंडली बनाती हूँ, असली वाचन कुंडली बनने के बाद आरम्भ होगा।",
                "अब असली हिस्सा आता है। पहले कुंडली बनती है, फिर मैं बताऊँगी कि आपकी कुंडली आपके बारे में क्या कहती है।"
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
                "आपकी भावनाओं की दुनिया लोगों की सोच से कहीं गहरी है।",
                "आपकी ओर ऐसे लोग आते हैं जिन्हें स्थिरता चाहिए।",
                "आप कभी-कभी उतना नहीं पाते जितना देते हैं।",
                "आपके लिए वफ़ादारी, उत्साह से कहीं ज़्यादा महत्त्वपूर्ण है।",
                "आप अपना मन सँभाल कर रखते हैं।",
                "भरोसा करने से पहले आपको भावनात्मक स्पष्टता चाहिए।",
                "आप भावनाओं के बदलाव शीघ्र ही भाँप लेते हैं।",
                "आप रिश्तों को हल्के में नहीं लेते।",
                "आपकी कुंडली प्रबल भावनात्मक सजगता दिखाती है।",
                "आप दिखावा नहीं, सच्चाई ढूँढते हैं।"
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
                "जब आपकी सोच का सम्मान होता है, तब आप सबसे अच्छा कार्य करते हैं।",
                "आप बेमतलब के काम के लिए नहीं बने।",
                "जब भरोसा मिलता है तब आपकी शक्ति और बढ़ती है।",
                "आप अक्सर दूसरों से पहले समाधान देख लेते हैं।",
                "आप ऊपरी कामकाज से अधिक गहराई पसन्द करते हैं।",
                "आप परिणाम बदलने की क्षमता रखते हैं।",
                "जब उद्देश्य हो तब आप श्रेष्ठ कार्य करते हैं।",
                "जब काम में अर्थ न हो तब बेचैनी होती है।",
                "आप टुकड़ों में नहीं, सम्पूर्ण ढंग में सोचते हैं।",
                "जब अपनी अन्तःप्रेरणा पर भरोसा करते हैं तब राह स्पष्ट दिखती है।"
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
                "आगे कुछ समय-खिड़कियाँ दिख रही हैं।",
                "एक दौर विशेष रूप से सक्रिय लग रहा है।",
                "इस चरण पर ध्यान देना चाहिए।",
                "यह समय कुछ हलचल ला सकता है।",
                "आपकी कुंडली में एक बड़ा बदलाव निकट है।",
                "इस चक्र में कोई अवसर हो सकता है।",
                "इस दौर में धीरज चाहिए।",
                "यह समय दिशा बदल सकता है।",
                "एक अवधि बाक़ी सबसे प्रबल दिख रही है।",
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
                "यह ध्यान से कहना चाहती हूँ।",
                "एक ढंग है जो ध्यान माँगता है।",
                "यह भूल नहीं है, परन्तु यह एक दोहराव है।",
                "जब ऐसा हो तो शायद आप पहचान जाएँ।",
                "कुंडली का यह हिस्सा सजगता माँगता है।",
                "इसे शीघ्र देख लेना श्रेष्ठ है।",
                "जब दबाव बढ़ता है तब यह दोहराव लौट आता है।",
                "इस स्थिति में धीरे-धीरे चलिए।",
                "यहाँ अपनी प्रतिक्रिया पर ध्यान दीजिए।",
                "सजगता ही आपका सबसे बड़ा बल है।"
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
                "अब आपने गहरी परत सुन ली है।",
                "वाचन को एक पल में बैठ जाने दीजिए।",
                "यह भाग्य नहीं है, यह एक दोहराव है।",
                "ऐसे दोहराव बदले जा सकते हैं।",
                "और जानना चाहें तो मैं यहीं हूँ।",
                "जब चाहें, और गहराई में जा सकते हैं।",
                "आपकी कुंडली के कुछ हिस्से अभी शेष हैं।",
                "कुछ भी पूछ सकते हैं।",
                "यह वाचन अब आपका है।",
                "मैं आपके साथ यहीं हूँ।"
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
        const line = lines[Math.floor(Math.random() * lines.length)];
        return isHindi ? this._flipVoiceLine(line) : line;
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
                this.backgroundMusic.play().catch(() => { });
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

    getTimingScale() {
        const runtimeScale = Number(this.userData?.timingScale);
        const storedScale = Number(MayaUtils?.storage?.get('maya_funnel_timing_scale'));
        const configuredScale = Number(this.timingControl?.scale);
        const raw = Number.isFinite(runtimeScale)
            ? runtimeScale
            : Number.isFinite(storedScale)
                ? storedScale
                : configuredScale;
        return Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0));
    },

    getPacedDelay(rawMs, { minMs = 0 } = {}) {
        const numeric = Number(rawMs);
        if (!Number.isFinite(numeric) || numeric <= 0) return 0;
        const scaled = Math.round(numeric * this.getTimingScale());
        return Math.max(minMs, scaled);
    },

    async sleepPaced(rawMs, options = {}) {
        const delayMs = this.getPacedDelay(rawMs, options);
        if (delayMs <= 0) return;
        await MayaUtils.sleep(delayMs);
    },

    async waitForNarrationToFinish(bufferMs) {
        if (window.MayaVoice?.waitForSpeechComplete) {
            await MayaVoice.waitForSpeechComplete();
        }

        const settleTarget = Number.isFinite(bufferMs) ? bufferMs : this.stageTiming.narrationBuffer;
        const settleMs = this.getPacedDelay(settleTarget);
        const pollFloor = Math.max(1, Number(this.timingControl?.minNarrationPoll) || 1);
        const pollMs = Math.max(pollFloor, this.getPacedDelay(this.stageTiming.narrationPoll));
        let guard = 0;
        while ((window.MayaVoice?.isPlaying || window.MayaVoice?.speakingLock) && guard < 100) {
            await MayaUtils.sleep(pollMs);
            guard++;
        }

        await this.sleepPaced(settleMs);
    },

    /**
     * Show/hide funnel controls
     */
    showFunnelControls(show = true) {
        const controls = document.getElementById('maya-funnel-controls');
        if (controls) {
            if (show && controls.parentElement !== document.body) {
                document.body.appendChild(controls);
            }
            controls.style.display = show ? 'flex' : 'none';
            controls.setAttribute('aria-hidden', show ? 'false' : 'true');
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
            birthLon: this.userData.birthLon,
            birthTimezone: this.userData.birthTimezone
        };
        const western = window.MayaAstrology?.getWesternZodiac?.(this.userData.birthDate) || {};
        const vedic = window.MayaAstrology?.getVedicZodiac?.(this.userData.birthDate, birthContext) || {};
        const kundliChart = window.MayaKundli?.generateBirthChart
            ? MayaKundli.generateBirthChart(
                this.userData.birthDate,
                birthContext.birthTime,
                birthContext.birthPlace || 'Unknown',
                birthContext.birthLat,
                birthContext.birthLon,
                birthContext.birthTimezone
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
        const lifeStage = (window.MayaKundli?.calculateLifeStage)
            ? MayaKundli.calculateLifeStage(this.userData?.birthDate)
            : null;
        const charaKarakas = (this.kundliChart?.planets?.length && window.MayaKundli?.calculateCharaKarakas)
            ? MayaKundli.calculateCharaKarakas(this.kundliChart.planets)
            : null;
        return {
            name: this.firstName,
            fullName: this.userData?.name || this.firstName,
            gender: this.userData?.gender || '',
            dob: this.formatDateSpoken(this.userData.birthDate),
            rawBirthDate: this.userData.birthDate,
            age: lifeStage?.age ?? null,
            lifeStage: lifeStage?.stage || '',
            lifeStageLabel: lifeStage?.label || '',
            charaKarakas,
            birthTime: this.hasExactBirthTime() ? this.userData.birthTime : 'unknown',
            birthPlace: this.userData.birthPlace || '',
            birthPlaceShort: profile.birthPlaceShort || '',
            zodiac: profile.western?.name || MayaAstrology.getZodiac(this.userData.birthDate, {
                birthTime: this.getResolvedBirthTime(),
                birthPlace: this.userData.birthPlace || '',
                birthLat: this.userData.birthLat,
                birthLon: this.userData.birthLon,
                birthTimezone: this.userData.birthTimezone
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

        // Age / life stage + Chara Karakas so prompts can target relatives + age-appropriate themes
        const lifeStage = (window.MayaKundli?.calculateLifeStage)
            ? MayaKundli.calculateLifeStage(this.userData?.birthDate)
            : null;
        const charaKarakas = (this.kundliChart?.planets?.length && window.MayaKundli?.calculateCharaKarakas)
            ? MayaKundli.calculateCharaKarakas(this.kundliChart.planets)
            : null;

        return {
            ...this.calculations,
            gender: this.userData?.gender || '',
            maritalStatus: this.userData?.maritalStatus || '',
            age: lifeStage?.age ?? null,
            lifeStage: lifeStage?.stage || '',
            lifeStageLabel: lifeStage?.label || '',
            lifeStageFocusEn: lifeStage?.focusEn || '',
            lifeStageFocusHi: lifeStage?.focusHi || '',
            charaKarakas,
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
            userQuestion: this.userData?.userQuestion || '',
            userData: {
                gender: this.userData?.gender || '',
                maritalStatus: this.userData?.maritalStatus || '',
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
        const guideName = this._guideName();
        let cleaned = String(text || '').trim();

        if (!cleaned) return cleaned;

        // Dynamic guide name replacement -Latin (all cases) + Devanagari
        cleaned = cleaned.replace(/\bMAYA\b/gi, guideName);
        if (this._isGuiderMale()) {
            cleaned = cleaned.replace(/माया/g, guideName);
            cleaned = cleaned.replace(/\bMaya\b/g, guideName);
        }

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
            cleaned = this.localizeHindiText(cleaned);
            if (this._isGuiderMale()) {
                // Male guide: flip any feminine self-references to masculine
                // NOTE: no मैं prefix -Hindi naturally drops pronouns
                cleaned = cleaned
                    .replace(/रही हूँ/g, 'रहा हूँ')
                    .replace(/सकती हूँ/g, 'सकता हूँ')
                    .replace(/बताती हूँ/g, 'बताता हूँ')
                    .replace(/कहती हूँ/g, 'कहता हूँ')
                    .replace(/वाली हूँ/g, 'वाला हूँ')
                    .replace(/गई हूँ/g, 'गया हूँ')
                    .replace(/आई हूँ/g, 'आया हूँ')
                    .replace(/\bबताऊँगी\b/g, 'बताऊँगा')
                    .replace(/\bकहूँगी\b/g, 'कहूँगा')
                    .replace(/\bकरूँगी\b/g, 'करूँगा')
                    .replace(/\bपाऊँगी\b/g, 'पाऊँगा')
                    .replace(/\bचाहती\b/g, 'चाहता')
                    .replace(/\bदेखती\b/g, 'देखता')
                    .replace(/\bसमझती\b/g, 'समझता')
                    .replace(/\bजानती\b/g, 'जानता')
                    .replace(/\bकरती\b/g, 'करता')
                    .replace(/\bलेती\b/g, 'लेता')
                    .replace(/\bबनाती\b/g, 'बनाता')
                    .replace(/बड़ी बहन/g, 'बड़े भाई')
                    .replace(/बहन जैसा/g, 'भाई जैसा');
            } else {
                // Female guide: flip any masculine self-references to feminine
                cleaned = cleaned
                    .replace(/रहा हूँ/g, 'रही हूँ')
                    .replace(/सकता हूँ/g, 'सकती हूँ')
                    .replace(/बताता हूँ/g, 'बताती हूँ')
                    .replace(/कहता हूँ/g, 'कहती हूँ')
                    .replace(/वाला हूँ/g, 'वाली हूँ')
                    .replace(/गया हूँ/g, 'गई हूँ')
                    .replace(/आया हूँ/g, 'आई हूँ')
                    .replace(/\bबताऊँगा\b/g, 'बताऊँगी')
                    .replace(/\bकहूँगा\b/g, 'कहूँगी')
                    .replace(/\bकरूँगा\b/g, 'करूँगी')
                    .replace(/\bपाऊँगा\b/g, 'पाऊँगी')
                    .replace(/\bचाहता\b/g, 'चाहती')
                    .replace(/\bदेखता\b/g, 'देखती')
                    .replace(/\bसमझता\b/g, 'समझती')
                    .replace(/\bजानता\b/g, 'जानती')
                    .replace(/\bकरता\b/g, 'करती')
                    .replace(/\bलेता\b/g, 'लेती')
                    .replace(/\bबनाता\b/g, 'बनाती')
                    .replace(/बड़े भाई/g, 'बड़ी बहन')
                    .replace(/भाई जैसा/g, 'बहन जैसा');
            }
            cleaned = cleaned
                .replace(/\s+/g, ' ')
                .trim();
        }

        // Guard continuity: after the opening has been spoken, do not allow
        // fresh-start greetings like "Namaste <name>" to reappear mid-funnel,
        // even if the model inserts them after the first sentence.
        if ((this.spokenNarrations?.length || 0) > 0) {
            const escapedName = this.escapeRegExp(this.firstName || '').trim();
            const greetingWord = '(?:नमस्ते|नमस्कार|प्रणाम|namaste\\b|hello\\b|hi\\b|hey\\b|greetings\\b|welcome(?:\\s+back)?\\b|good\\s+(?:morning|afternoon|evening)\\b)';
            const optionalName = escapedName ? `(?:\\s*,?\\s*${escapedName}\\b)?` : '';
            const guideIntro = "(?:\\s*,?\\s*(?:i\\s*(?:am|'m)\\s*(?:maya|moksh)|मैं\\s+(?:माया|मोक्ष)\\s+हूँ|मेरा\\s+नाम\\s+(?:माया|मोक्ष)\\s+है))?";
            const greetingAtStart = new RegExp(`^\\s*${greetingWord}${optionalName}${guideIntro}[,.!?।:;\\-–—]*\\s*`, 'i');
            const greetingAfterSentence = new RegExp(`([.!?।]\\s*)${greetingWord}${optionalName}${guideIntro}[,.!?।:;\\-–—]*\\s*`, 'gi');

            cleaned = cleaned
                .replace(greetingAtStart, '')
                .replace(greetingAfterSentence, '$1')
                .replace(/^\s+/, '');
        }

        if (this._hasKundliReadyAnnouncement()) {
            cleaned = this._stripKundliReadyAnnouncement(cleaned);
        }

        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // === Anti-stutter pass (final safety net) ===
        // Catches AI-generated repetitions like "Taurus Taurus rashi" or
        // "rahu rahu dasha" before they reach captions OR TTS. The same logic
        // is also run inside MayaVoice.prepareForSpeech, but applying it here
        // ensures the captions match the spoken audio one-to-one.
        cleaned = this._collapseAdjacentRepeats(cleaned);
        cleaned = this._capRepeatedAstroTerms(cleaned, isHindi);
        cleaned = this._trimDanglingSentence(cleaned);

        return cleaned;
    },

    _trimDanglingSentence(text) {
        const value = String(text || '').trim();
        if (!value || /[.!?।]$/.test(value)) return value;

        const lastBoundary = Math.max(
            value.lastIndexOf('.'),
            value.lastIndexOf('!'),
            value.lastIndexOf('?'),
            value.lastIndexOf('।')
        );

        if (lastBoundary >= 45 && value.length - lastBoundary > 10) {
            return value.slice(0, lastBoundary + 1).trim();
        }

        return value;
    },

    // Collapse back-to-back repeated tokens & 2-4 word phrases (Latin + Devanagari).
    // "Taurus Taurus" -> "Taurus" ; "rahu ki dasha rahu ki dasha" -> "rahu ki dasha"
    _collapseAdjacentRepeats(text) {
        let cleaned = String(text || '');
        const sep = '(?:\\s*[,.!?।;:\\-]\\s*|\\s+)';
        // Unicode-aware word boundary: \b doesn't work for Devanagari (\u0900-\u097F)
        // because JS treats those chars as \W. Use negative lookbehind/ahead instead.
        const wch = 'A-Za-z\\u0900-\\u097F';

        // Single-token doubles (case-insensitive backref).
        cleaned = cleaned.replace(
            new RegExp(`(?<![${wch}])([${wch}]+)(?![${wch}])${sep}\\1(?![${wch}])`, 'gi'),
            '$1'
        );

        // 2-4 word phrase doubles, multiple passes for chained stutters.
        for (let pass = 0; pass < 3; pass++) {
            cleaned = cleaned.replace(
                new RegExp(`(?<![${wch}])((?:[${wch}]+\\s+){1,3}[${wch}]+)(?![${wch}])${sep}\\1(?![${wch}])`, 'gi'),
                '$1'
            );
        }

        // Cleanup any double spaces / orphaned punctuation introduced above.
        cleaned = cleaned.replace(/\s+([,.!?।])/g, '$1').replace(/\s+/g, ' ').trim();
        return cleaned;
    },

    // Cap how many times the same astrology proper noun (zodiac sign, planet,
    // dasha) appears in a single narration block. After the cap, swap with a
    // pronoun-style reference so the AI's parroting doesn't reach the user.
    _capRepeatedAstroTerms(text, isHindi) {
        let limited = String(text || '');
        const cap = (pattern, replacement, max = 2) => {
            let n = 0;
            limited = limited.replace(pattern, (m) => (++n > max ? replacement : m));
        };

        // Zodiac signs (English) -cap each at 2 mentions per narration.
        const signsEn = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
            'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
        signsEn.forEach((sign) => {
            cap(new RegExp(`\\b${sign}\\b`, 'gi'),
                isHindi ? 'आपकी राशि' : 'your sign', 2);
        });

        // Zodiac signs (Devanagari).
        const signsHi = ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
            'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'];
        signsHi.forEach((sign) => {
            cap(new RegExp(sign, 'g'), 'आपकी राशि', 2);
        });

        // Planets / dashas -limit so AI can't carpet-bomb one term.
        const planetsEn = ['rahu', 'ketu', 'shani', 'saturn', 'mangal', 'mars',
            'guru', 'jupiter', 'shukra', 'venus', 'budh', 'mercury', 'surya', 'sun', 'chandra', 'moon'];
        planetsEn.forEach((p) => {
            cap(new RegExp(`\\b${p}\\b`, 'gi'),
                isHindi ? 'यह ग्रह' : 'this planet', 3);
        });

        const planetsHi = ['राहु', 'केतु', 'शनि', 'मंगल', 'गुरु', 'शुक्र', 'बुध', 'सूर्य', 'चंद्र', 'चन्द्र'];
        planetsHi.forEach((p) => {
            cap(new RegExp(p, 'g'), 'यह ग्रह', 3);
        });

        // Dasha / mahadasha generic.
        cap(/\bdasha\b/gi, isHindi ? 'यह अवधि' : 'this period', 3);
        cap(/दशा/g, 'यह अवधि', 3);

        return limited.replace(/\s+/g, ' ').trim();
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
        this.stepContextLog = [];
        this.authRequestId = 0;
        this.authPromptedFields = new Set();
        this._startupPrefetchPromise = null;
        this._startupIntroPromise = null;
        this._startupWarmupStartedAt = 0;
        this._postIntroParallelPromise = null;
        this._perfStartAt = 0;
        this._firstIntroResolvedAt = 0;
        this._firstSpeechRequestedAt = 0;
        this._firstSpeechPlaybackAt = 0;

        // Pull through any "Ask Maya anything" question captured on the landing screen
        // so every section can be biased around answering it.
        try {
            const storedQuestion = MayaUtils?.storage?.get('maya_user_question');
            if (storedQuestion && typeof storedQuestion === 'string' && storedQuestion.trim()) {
                this.userData.userQuestion = storedQuestion.trim();
            } else if (userData.userQuestion && typeof userData.userQuestion === 'string') {
                this.userData.userQuestion = userData.userQuestion.trim();
            }
        } catch (_e) { /* non-fatal */ }

        // Save language preference to storage immediately
        const language = userData.language || MayaUtils.storage.get('maya_language') || 'en';
        this.userData.language = language;
        MayaUtils.storage.set('maya_language', language);

        // IMPORTANT: Save ALL user data to localStorage immediately
        // This ensures data persists even before email gate
        const profileData = {
            name: userData.name,
            gender: userData.gender || null,
            agentGender: userData.agentGender || 'female',
            birthDate: userData.birthDate,
            birthTime: userData.birthTime || null,
            birthPlace: userData.birthPlace || null,
            birthLat: userData.birthLat || null,
            birthLon: userData.birthLon || null,
            birthTimezone: userData.birthTimezone || null,
            language: language
        };

        // Merge with existing profile (don't overwrite email if already set)
        const existingProfile = MayaUtils.storage.get('maya_profile') || {};
        MayaUtils.storage.set('maya_profile', { ...existingProfile, ...profileData });

        // Also save to funnel_data for backup/recovery
        MayaUtils.storage.set('funnel_data', userData);

        // Make sure the voice module picks up the chosen guide gender on fresh loads too.
        if (window.MayaVoice?.setAgentGender) {
            MayaVoice.setAgentGender(profileData.agentGender);
        }

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

        // Prime intro/data generation as soon as guide selection is completed.
        this.prefetchJourneyStartup().catch((error) => {
            console.warn('Startup prefetch warmup failed:', error?.message || error);
        });

        return this;
    },

    /**
     * Pre-generate ALL funnel content in background for seamless playback
     */
    async pregenerateAllContent() {
        this.contentGenerating = {};
        console.log('🎭 Live generation mode active; skipping narration pre-cache.');
        // Pre-warm dynamic AI fillers for the most common types so the very first
        // pause already has natural, AI-generated phrases ready to speak.
        try {
            ['thinking', 'calculating', 'kundli'].forEach(t => {
                this._refillDynamicFillers(t).catch(() => { });
            });
        } catch (_e) { /* non-fatal */ }
        return [];
    },

    /**
     * Pre-generate a single piece of content with caching
     */
    async pregenerateContent(key, generator) {
        if (this.contentGenerating[key]) return this.contentGenerating[key];

        this.contentGenerating[key] = (async () => {
            try {
                const content = await generator();
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

        const instantMode = this.getTimingScale() === 0;
        const maxRetries = instantMode ? 1 : 3;

        console.log(`🔄 Generating fresh narration: ${key}`);
        this.contentGenerating[key] = (async () => {
            try {
                return await MayaUtils.retry(
                    async (attempt) => {
                        console.log(`🔁 Narration attempt ${attempt} for ${key}`);
                        const content = await Promise.resolve().then(() => fallbackGenerator());

                        if (!content || String(content).trim().length < 20) {
                            throw new Error(`Empty narration for ${key}`);
                        }

                        return content;
                    },
                    {
                        maxRetries,
                        baseDelay: instantMode ? 10 : 60,
                        maxDelay: instantMode ? 80 : 450,
                        backoffMultiplier: 1.5,
                        label: `${key} narration`,
                        retryCondition: (error, attempt) => {
                            const message = error?.message || '';
                            return attempt < maxRetries
                                && (MayaUtils.isRetryableError(error) || /timeout|timed out|empty|rate limit|all content sources failed/i.test(message));
                        },
                        onRetry: (_attempt, _max, error) => {
                            console.warn(`⚠️ Fresh generation retry for ${key}:`, error.message);
                        }
                    }
                );
            } catch (e) {
                console.warn(`⚠️ Fresh generation exhausted for ${key}:`, e.message);
                // Never return null -a null narration causes speak() to no-op
                // and the funnel silently skips the stage. Hand back a local
                // deterministic line so the user always hears something.
                return this._getLocalNarrationFallback(key);
            } finally {
                delete this.contentGenerating[key];
            }
        })();

        return await this.contentGenerating[key];
    },

    /**
     * Deterministic local fallback narration used when every Gemini key/model
     * is rate-limited (HTTP 429) or otherwise unreachable. Keeps the funnel
     * narrating instead of jumping ahead in silence.
     */
    _getLocalNarrationFallback(key) {
        const isHindi = (MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en') === 'hi';
        const name = this.firstName || (isHindi ? 'दोस्त' : 'friend');
        const sign = this.personalization?.vedic?.hindi
            || this.personalization?.western?.name
            || (isHindi ? 'आपकी राशि' : 'your sign');
        const userQ = this._getActiveUserQuestion();
        const safeQ = userQ ? userQ.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
        const isAskMaya = safeQ.length >= 3;

        if (isAskMaya) {
            const topic = this._classifyUserQuestionTopic(safeQ);
            const subjectPhrase = this._getAskMayaSubjectPhrase(topic, isHindi);
            const finding = this._isGuiderMale()
                ? (isHindi ? 'ढूँढ रहा हूँ' : 'finding')
                : (isHindi ? 'ढूँढ रही हूँ' : 'finding');
            const askLines = isHindi ? {
                kundliStageNarrative: `ठीक है ${name}, कुंडली का विन्यास अभी बन रहा है। अब मैं ${subjectPhrase} को कुंडली, numbers और timing से ${finding}।`,
                teaserRevealNarration: `${name}, ${subjectPhrase} में एक साफ signal दिख रहा है। पूरा जवाब file save होने के बाद खुलेगा, लेकिन अभी direction इसी विषय पर locked रहेगी।`,
                allNumbersNarrative: `numbers भी ${subjectPhrase} को sharpen कर रहे हैं। अब मैं इन्हें कुंडली के साथ जोड़कर answer precise करूँगी।`,
                lifePathCalculationNarrative: `Life Path यहाँ ${subjectPhrase} की natural direction दिखाता है।`,
                destinyCalculationNarrative: `Destiny number बताता है कि ${subjectPhrase} में बाहर से कौनसी भूमिका बन रही है।`,
                soulUrgeCalculationNarrative: `Soul Urge number ${subjectPhrase} के पीछे आपकी असली चाहत दिखाता है।`
            } : {
                kundliStageNarrative: `Alright ${name}, I am forming your chart now. I am ${finding} your ${subjectPhrase} through kundli, numbers, and timing.`,
                teaserRevealNarration: `${name}, one clear signal is showing around your ${subjectPhrase}. I will open the full answer after the file is saved, but the direction stays locked here.`,
                allNumbersNarrative: `The numbers are sharpening your ${subjectPhrase}. Now I will line them up with the chart to make the answer precise.`,
                lifePathCalculationNarrative: `Life Path shows the natural direction behind your ${subjectPhrase}.`,
                destinyCalculationNarrative: `Destiny shows the outer role forming around your ${subjectPhrase}.`,
                soulUrgeCalculationNarrative: `Soul Urge shows what you truly want underneath your ${subjectPhrase}.`
            };
            if (askLines[key]) return askLines[key];
        }

        const lines = isHindi ? {
            kundliStageNarrative: `ठीक है ${name}, आपकी कुंडली का विन्यास अभी बन रहा है। ${sign} का प्रभाव साफ दिख रहा है, और कुछ खास combinations सामने आ रहे हैं -एक-एक करके खोलते हैं।`,
            teaserRevealNarration: `${name}, एक pattern दिख रहा है पिछले कुछ समय का। ज़िंदगी में एक shift चल रहा है -वो हम आगे detail में देखेंगे।`,
            allNumbersNarrative: `numbers ने भी अपनी कहानी कह दी है ${name}। आपके life path और destiny में एक clear theme है -चलिए उसे कुंडली के साथ जोड़ते हैं।`,
            lifePathCalculationNarrative: `आपका life path number आपके होने का core दिखाता है -यही वो रास्ता है जिस पर आप सबसे natural feel करते हैं।`,
            destinyCalculationNarrative: `destiny number बताता है आप क्या बनने वाले हैं -आपका full नाम इसका कारण है।`,
            soulUrgeCalculationNarrative: `soul urge number आपकी अंदर की चाह है -जो आप सच में चाहते हैं, वो यहाँ छुपा है।`
        } : {
            kundliStageNarrative: `Alright ${name}, I am forming your chart now. ${sign} energy is showing up clearly, and a few interesting combinations are surfacing -let's open them one by one.`,
            teaserRevealNarration: `${name}, there's a pattern visible from the recent past. A real shift is in motion -we'll get into the detail of it next.`,
            allNumbersNarrative: `The numbers have spoken too, ${name}. Your life path and destiny share a clear theme -let's line them up against the chart.`,
            lifePathCalculationNarrative: `Your life path number reveals the core of who you are -the path that feels most natural for you to walk.`,
            destinyCalculationNarrative: `Your destiny number speaks to what you're becoming -your full name carries this signature.`,
            soulUrgeCalculationNarrative: `Your soul urge number is the inner pull -what you actually want underneath the noise.`
        };

        return lines[key] || (isHindi
            ? `${name}, एक पल -मैं आगे बढ़ती हूँ।`
            : `One moment ${name} -let me carry this forward.`);
    },

    _getLocalDirectSectionFallback(sectionKey, context = {}) {
        const isHindi = (MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en') === 'hi';
        const name = this.firstName || (isHindi ? 'दोस्त' : 'friend');
        const userQ = this._getActiveUserQuestion();
        const safeQ = userQ ? userQ.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
        const isAskMaya = safeQ.length >= 3;
        const topic = isAskMaya ? this._classifyUserQuestionTopic(safeQ) : 'general';
        const topicLabel = this._getAskMayaTopicLabel(topic, isHindi);
        const subjectPhrase = isAskMaya ? this._getAskMayaSubjectPhrase(topic, isHindi) : topicLabel;
        const willOpen = this._isGuiderMale() ? 'खोलूँगा' : 'खोलूँगी';
        const willRead = this._isGuiderMale() ? 'पढ़ूँगा' : 'पढ़ूँगी';
        const gateLine = isHindi
            ? `${name}, आगे की reading सुरक्षित रखने के लिए SMS verification चाहिए -अपना मोबाइल नंबर डाल दीजिए; ओटीपी आने में कुछ सेकंड लग सकते हैं।`
            : `${name}, to keep the rest of this reading secure, I need SMS verification -enter your mobile number; the OTP can take a few seconds to arrive.`;

        if (isAskMaya) {
            const askFallbacks = isHindi ? {
                kundli: `मैं ${subjectPhrase} को कुंडली, numbers और timing से ही ${willRead}। ${topicLabel} से जुड़ा एक मुख्य signal दिख रहा है, लेकिन पूरा answer खोलने से पहले मुझे आपकी current situation का एक छोटा detail चाहिए।`,
                combinedTeaser: `${name}, ${subjectPhrase} में chart एक साफ direction दिखा रहा है। यह answer ${topicLabel} से बाहर नहीं जाएगा। [[pause-250]] अभी सिर्फ इतना समझिए कि timing और आपका current phase दोनों important हैं। [[pause-250]] पूरा answer save होने के बाद exact reason, timing और practical step के साथ खुलेगा।`,
                identityTruth: `${name}, यहाँ आपका सबसे बड़ा pattern clarity माँगना है, approval नहीं। Chart में ${topicLabel} से जुड़ी timing active दिख रही है।`,
                emotionalPattern: `${subjectPhrase} के पीछे अंदर से बेचैनी है कि सही time निकल न जाए। इसलिए answer में timing और practical next step दोनों चाहिए।`,
                unresolvedThread: `इसका खुला हुआ thread यही है कि ${topicLabel} में अगला सही move कब लेना है। File save होते ही मैं इसे exact window के साथ ${willOpen}।`,
                accuracyShock: `पिछले कुछ समय में इसी सवाल से जुड़ा pressure अचानक बढ़ा है। यह random नहीं है -chart में timing shift इसी area को activate कर रही है।`,
                suspenseBridge: `${subjectPhrase} में सबसे intense pattern timing और decision का है। इसका पूरा truth यहाँ खोलना ठीक नहीं होगा, क्योंकि exact answer save file में chart, numbers और timing मिलाकर खुलेगा। आपकी पूरी file तैयार है, बस इसे save कर लीजिए।`,
                emailGate: `Reading का अगला layer तैयार है। ${gateLine}`,
                fomoHook: `${topicLabel} में एक serious timing signal दिख रहा है। Full details private reading में खुलेंगी, क्योंकि यहाँ half-answer देना सही नहीं होगा।`,
                returnHook: `${topicLabel} में अगले phase की timing साफ दिख रही है। अगली बार इसे exact month के साथ खोलेंगे।`,
                completion: `${name}, मैंने ${subjectPhrase} को इसी direction में पढ़ा है। अब आप चाहें तो इसी topic पर follow-up पूछ सकते हैं।`
            } : {
                kundli: `I am reading your ${subjectPhrase} through kundli, numbers, and timing. One main signal around ${topicLabel} is visible, but I need one small current-situation detail before opening the full answer.`,
                combinedTeaser: `${name}, your ${subjectPhrase} has a clear chart direction. The answer will stay inside ${topicLabel}, not drift elsewhere. [[pause-250]] For now, know that timing and your current phase both matter here. [[pause-250]] Once saved, I will open the exact reason, timing, and practical next step.`,
                identityTruth: `${name}, the main pattern here is that you need clarity, not reassurance. The chart shows timing active around ${topicLabel}.`,
                emotionalPattern: `Under your ${subjectPhrase} is the worry that the right time may slip away. So the answer needs both timing and a practical next step.`,
                unresolvedThread: `The unresolved thread is when to take the next correct move in ${topicLabel}. Once the file is saved, I will open it with an exact window.`,
                accuracyShock: `In the recent past, pressure around this same question has increased suddenly. It is not random -the chart's timing shift is activating this area.`,
                suspenseBridge: `The most intense pattern in your ${subjectPhrase} is timing and decision. It would not be right to open the full truth here, because the exact answer needs chart, numbers, and timing together after verification. The next layer is ready once SMS OTP confirms it is you.`,
                emailGate: `The next layer of the reading is ready. ${gateLine}`,
                fomoHook: `There is a serious timing signal around ${topicLabel}. The full details belong in your private reading, because a half-answer here would not be fair.`,
                returnHook: `The next phase around ${topicLabel} is visible. Next time, we will open it with the exact month.`,
                completion: `${name}, I read your ${subjectPhrase} in this direction. You can ask a follow-up on this same topic now.`
            };
            if (askFallbacks[sectionKey]) return askFallbacks[sectionKey];
        }

        const generic = isHindi ? {
            emailGate: `Reading का अगला layer तैयार है। ${gateLine}`,
            completion: `${name}, reading यहीं grounded तरीके से close होती है। अब आप कोई भी follow-up पूछ सकते हैं।`
        } : {
            emailGate: `The next layer of the reading is ready. ${gateLine}`,
            completion: `${name}, this reading closes here in a grounded way. You can ask any follow-up now.`
        };

        return generic[sectionKey] || '';
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

        return this._genderFlipPrompt(isHindi
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
- ऐसा कुछ बताइए जो सुनकर user को लगे "ये तो सच में मेरे बारे में जानता/जानती है!"
- Vague generic बातें मत कहिए जो किसी पर भी fit हो। SPECIFIC रहिए - actual planet names, signs, dasha years बोलिए।
- energy feel या mind reading claim मत कीजिए। Chart और numbers पर based rakhein।
${this.getBaseRules(true)}`
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
${this.getBaseRules(false)}`);
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
            return await this.generateDirectReadingSection('kundli', {
                ...context,
                kundliFormationInProgress: true
            });
        }

        return '';
    },

    /**
     * Start background music
     */
    startBackgroundMusic() {
        // Disable background music on iPhones to prevent audio conflicts
        const isIPhone = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIPhone) {
            console.log('📱 iPhone detected - Background music disabled');
            return;
        }

        if (this.backgroundMusic) return;

        this.backgroundMusic = new Audio();
        this.backgroundMusic.loop = true;
        // iOS treats all audio at similar perceptual loudness. Use very low
        // volume so background music never competes with TTS narration.
        const isMacWithTouchBar = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        this.backgroundMusic.volume = isMacWithTouchBar ? 0.02 : 0.18;

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

    _initFastAiContext(lang) {
        if (!window.MayaAI?.init) return;
        MayaAI.init({
            fullName: this.userData?.name || this.firstName,
            name: this.userData?.name || this.firstName,
            birthDate: this.userData?.birthDate,
            birthTime: this.userData?.birthTime || '12:00',
            birthPlace: this.userData?.birthPlace || '',
            gender: this.userData?.gender || '',
            language: lang
        });
    },

    async _callFastFunnelAI(prompt, options = {}) {
        if (!window.MayaAI) return '';
        if (typeof MayaAI.callFast === 'function') {
            return MayaAI.callFast(prompt, options);
        }
        if (typeof MayaAI.callGemini === 'function') {
            return MayaAI.callGemini(prompt, options);
        }
        return '';
    },

    async _callNarrationFunnelAI(prompt, options = {}) {
        if (!window.MayaAI || typeof MayaAI.callGemini !== 'function') return '';
        const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 2200;
        const maxKeyAttempts = Number(options.maxKeyAttempts) > 0 ? Number(options.maxKeyAttempts) : 2;
        const safeOptions = {
            ...options,
            provider: 'gemini',
            preferGemini: true,
            requireComplete: options.requireComplete !== false,
            timeoutMs,
            maxKeyAttempts,
            fastFail: options.fastFail !== false
        };
        return MayaAI.callGemini(prompt, safeOptions);
    },

    async _callQuestionFunnelAI(prompt, options = {}) {
        if (!window.MayaAI || typeof MayaAI.callGemini !== 'function') return '';
        const maxTokens = Math.max(Number(options.maxTokens || 0), 1400);
        const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 2600;
        return MayaAI.callGemini(prompt, {
            ...options,
            provider: 'gemini',
            maxTokens,
            timeoutMs,
            maxKeyAttempts: Number(options.maxKeyAttempts) > 0 ? Number(options.maxKeyAttempts) : 2,
            fastFail: options.fastFail !== false
        });
    },

    async _generateAdaptiveQuestionFromGemini(prompt, fallback, askedKeys = new Set(), options = {}) {
        if (!fallback) return null;
        if (!window.MayaAI || typeof MayaAI.callGemini !== 'function') return fallback;

        const attempts = [
            options,
            {
                ...options,
                temperature: Math.min(Number(options.temperature ?? 0.65), 0.45),
                maxTokens: Math.max(Number(options.maxTokens || 0), 1600),
                timeoutMs: Math.max(Number(options.timeoutMs || 0), 4500)
            }
        ];

        for (const attemptOptions of attempts) {
            try {
                const aiRaw = await this._callQuestionFunnelAI(prompt, attemptOptions);
                const parsed = this._extractFirstJsonObject(aiRaw);
                const sanitized = parsed ? this._sanitizeAdaptiveQuestion(parsed, fallback, askedKeys) : null;
                if (sanitized?.source === 'ai') return sanitized;
            } catch (error) {
                console.warn('Gemini question generation attempt failed:', error?.message || error);
            }
        }

        return fallback;
    },

    _getLocalJourneyIntro({ isHindi, askMayaActive, guideName, isMale, topicLabel, subjectPhrase }) {
        const profile = this.personalization || {};
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const lp = this.calculations?.lifePath || '';
        const year = this.calculations?.personalYear || '';
        const name = this.firstName || (isHindi ? 'आप' : 'you');
        const markerHi = this.localizeHindiText([ascendant && `${ascendant} लग्न`, moonSign && `${moonSign} चंद्र राशि`, dasha && `${dasha} दशा`, lp && `Life Path ${lp}`, year && `Personal Year ${year}`].filter(Boolean).slice(0, 2).join(' और ')) || 'आपकी जन्म जानकारी';
        const markerEn = [ascendant && `${ascendant} ascendant`, moonSign && `${moonSign} moon sign`, dasha && `${dasha} dasha`, lp && `Life Path ${lp}`, year && `Personal Year ${year}`].filter(Boolean).slice(0, 2).join(' and ') || 'your birth details';
        const index = Math.floor((Date.now() + Math.random() * 1000) % 4);

        const askHiSubject = this._formatAskMayaQuestionNoun(subjectPhrase, true);
        const askEnSubject = this._formatAskMayaQuestionNoun(subjectPhrase, false);
        const hiIntros = askMayaActive
            ? [
                `${name}, मैं ${guideName} हूँ। ${askHiSubject} को मैं सीधे उसी दिशा में पढ़${isMale ? 'ूँगा' : 'ूँगी'}, बिना किसी और विषय में भटके। ${markerHi} अभी पहला संकेत दे रहा है कि answer सिर्फ timing से नहीं, आपकी current situation से भी जुड़ेगा। पहले मैं chart तैयार कर${isMale ? 'ूँगा' : 'ूँगी'}, फिर एक छोटा detail पूछकर बात को और exact कर${isMale ? 'ूँगा' : 'ूँगी'}।`,
                `${name}, आपका सवाल मुझे मिल गया है। मैं ${guideName} हूँ, और इसे सामान्य reading की तरह नहीं पढ़${isMale ? 'ूँगा' : 'ूँगी'}। ${markerHi} में जो pattern दिख रहा है, वह answer को एक खास दिशा दे रहा है। पहले chart बनेगा, फिर मैं उसी subject पर सीधा follow-up पूछ${isMale ? 'ूँगा' : 'ूँगी'}।`,
                `${name}, आज हम सिर्फ ${askHiSubject} पर टिके रहेंगे। मैं ${guideName} हूँ, और ${markerHi} से पहला clue यह है कि इस जवाब में आपकी choice और timing दोनों साथ चलेंगे। पहले कुंडली का विन्यास बनता है, फिर मैं इसे numbers के साथ जोड़कर साफ कर${isMale ? 'ूँगा' : 'ूँगी'}।`,
                `${name}, मैं ${guideName} हूँ, और आपका सवाल अभी reading का केंद्र है। ${markerHi} मुझे बता रहा है कि answer को जल्दी नहीं खोलना चाहिए; पहले सही जगह देखनी होगी। मैं chart और numbers तैयार कर${isMale ? 'ूँगा' : 'ूँगी'}, फिर उसी रास्ते से बात आगे बढ़ेगी।`
            ]
            : [
                `${name}, मैं ${guideName} हूँ। ${markerHi} में एक बात तुरंत अलग दिख रही है: आपके फैसले अक्सर बाहर से शांत लगते हैं, लेकिन अंदर बहुत सोच-समझकर बनते हैं। आज मैं पहले आपकी कुंडली और numbers को साथ रख${isMale ? 'ूँगा' : 'ूँगी'}, फिर आपसे कुछ छोटे सवाल पूछ${isMale ? 'ूँगा' : 'ूँगी'} ताकि reading सचमुच आपकी ज़िंदगी से जुड़े।`,
                `${name}, मैं ${guideName} हूँ, और आपकी जन्म जानकारी में एक साफ rhythm दिख रही है। ${markerHi} बताता है कि आप जल्दी trust नहीं करते, पर जब direction साफ हो जाए तो बहुत deeply commit करते हैं। पहले chart तैयार होगा, फिर मैं दो-तीन real-life details पूछकर इसे generic reading बनने से बचा${isMale ? 'ऊँगा' : 'ऊँगी'}।`,
                `${name}, आपकी reading की शुरुआत सिर्फ राशि से नहीं होगी। ${markerHi} मिलकर एक ऐसा pattern बना रहे हैं जहाँ जिम्मेदारी और अंदर की बेचैनी साथ चलती है। मैं पहले इस base को पढ़${isMale ? 'ूँगा' : 'ूँगी'}, फिर सवाल पूछ${isMale ? 'ूँगा' : 'ूँगी'} ताकि हर अगली बात आपकी असली situation पर बैठे।`,
                `${name}, मैं ${guideName} हूँ। आपकी जन्म जानकारी में पहला संकेत यह है कि आप बाहर से जितने practical दिखते हैं, अंदर उतनी ही private intensity रखते हैं। ${markerHi} इस बात को confirm कर रहा है, इसलिए मैं पहले chart खोल${isMale ? 'ूँगा' : 'ूँगी'} और फिर कुछ direct सवालों से reading को और personal बना${isMale ? 'ऊँगा' : 'ऊँगी'}।`
            ];

        const enIntros = askMayaActive
            ? [
                `${name}, I am ${guideName}. I have your question, and I am going to stay with ${askEnSubject} instead of drifting into a general reading. ${markerEn} is already giving the first clue: this answer depends on both timing and your current real-life situation. First I will prepare the chart, then I will ask one small detail so the answer can land precisely.`,
                `${name}, I have your question. I am ${guideName}, and I am not going to treat this like a generic chart reading. ${markerEn} points toward one specific direction, but I need the chart and numbers aligned before I open it. First I will form the kundli, then we will move straight into that subject.`,
                `${name}, today we are staying with ${askEnSubject}. I am ${guideName}, and ${markerEn} suggests the answer is not only about timing; it is also about the choice you are standing near. I will prepare the chart first, then ask one focused follow-up to make it exact.`,
                `${name}, I am ${guideName}, and your question is the centre of this reading. ${markerEn} tells me not to rush the answer, because one practical detail will change the interpretation. I will build the chart and numbers first, then we will go directly toward it.`
            ]
            : [
                `${name}, I am ${guideName}. The first thing I notice from ${markerEn} is that your decisions may look calm from outside, but internally they carry a lot of private pressure. I will put your kundli and numbers together first, then ask a few small questions so this does not become a generic reading.`,
                `${name}, I am ${guideName}, and your birth details already show a clear rhythm. ${markerEn} suggests you do not give your trust quickly, but once a direction feels right, you commit deeply. First I will prepare the chart, then I will use a few real-life answers from you to make the reading sharper.`,
                `${name}, this reading will not start with only a zodiac label. ${markerEn} is forming a pattern where responsibility and inner restlessness seem to move together. I will read that base first, then ask short questions so every next layer sits on your actual life.`,
                `${name}, I am ${guideName}. Your birth pattern suggests that you can look practical on the surface while carrying much more intensity privately. ${markerEn} supports that first clue, so I will open the chart and then use a few direct questions to make the reading personal.`
            ];

        return isHindi ? hiIntros[index] : enIntros[index];
    },

    _buildJourneyIntroContext() {
        const isHindi = (MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en') === 'hi';
        const guideName = this._guideName();
        const isMale = this._isGuiderMale();
        const activeUserQuestion = this._getActiveUserQuestion();
        const askMayaActive = activeUserQuestion.length >= 3;
        const askMayaTopic = askMayaActive ? this._classifyUserQuestionTopic(activeUserQuestion) : null;
        const topicLabel = askMayaActive ? this._getAskMayaTopicLabel(askMayaTopic, isHindi) : '';
        const askMayaSubject = askMayaActive ? this._getAskMayaSubjectPhrase(askMayaTopic, isHindi) : '';

        return {
            isHindi,
            guideName,
            isMale,
            askMayaActive,
            topicLabel,
            askMayaSubject
        };
    },

    prefetchJourneyStartup() {
        if (!this.userData || !this.calculations) return Promise.resolve(null);
        if (this._startupPrefetchPromise) return this._startupPrefetchPromise;

        const introCtx = this._buildJourneyIntroContext();
        this._startupWarmupStartedAt = Date.now();

        this._startupIntroPromise = (async () => {
            try {
                const intro = await this.generateJourneyIntro({
                    isHindi: introCtx.isHindi,
                    askMayaActive: introCtx.askMayaActive,
                    guideName: introCtx.guideName,
                    isMale: introCtx.isMale,
                    topicLabel: introCtx.topicLabel,
                    subjectPhrase: introCtx.askMayaSubject || (introCtx.isHindi ? 'आपकी reading' : 'your reading')
                });

                const cleanIntro = this.sanitizeNarrationText(intro);
                if (cleanIntro && window.MayaVoice && !MayaVoice.isMuted) {
                    try { MayaVoice.prefetchSpeech(cleanIntro); } catch (_error) { }
                }

                return cleanIntro || '';
            } catch (error) {
                console.warn('Startup intro prefetch failed:', error?.message || error);
                return '';
            }
        })();

        this._startupPrefetchPromise = this._startupIntroPromise.then(() => {
            const took = Date.now() - this._startupWarmupStartedAt;
            console.log(`⚡ Startup intro primed in ${took}ms`);
            return true;
        });

        return this._startupPrefetchPromise;
    },

    _startPostIntroParallelPrefetch() {
        if (!this.userData || !this.calculations) return Promise.resolve(false);
        if (this._postIntroParallelPromise) return this._postIntroParallelPromise;

        const language = (MayaUtils?.storage?.get('maya_language') || this.userData?.language || 'en') === 'hi' ? 'hi' : 'en';
        const startedAt = Date.now();

        const tasks = [];

        if (window.MayaDynamicContent?.pregenerateForUser) {
            tasks.push(
                window.MayaDynamicContent
                    .pregenerateForUser(this.userData, this.calculations, language)
                    .catch((error) => {
                        console.warn('Dynamic content prefetch failed:', error?.message || error);
                        return null;
                    })
            );
        }

        this._postIntroParallelPromise = Promise.allSettled(tasks).then(() => {
            const took = Date.now() - startedAt;
            console.log(`⚡ Post-intro parallel prefetch primed in ${took}ms`);
            return true;
        });

        return this._postIntroParallelPromise;
    },

    async generateJourneyIntro({ isHindi, askMayaActive, guideName, isMale, topicLabel, subjectPhrase }) {
        const lang = isHindi ? 'hi' : 'en';
        const fallback = this._getLocalJourneyIntro({ isHindi, askMayaActive, guideName, isMale, topicLabel, subjectPhrase });
        const profile = this.personalization || {};
        const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const prompt = isHindi
            ? `MAYA funnel opening के लिए एक UNIQUE spoken intro लिखिए।

Seed for uniqueness: ${seed}
Guide name: ${guideName} (${isMale ? 'male' : 'female'} guide)
User: ${this.firstName}
Flow: ${askMayaActive ? `Ask-Maya question funnel. Topic: ${topicLabel}. Spoken subject: ${subjectPhrase}. Original question internal only: ${this._getActiveUserQuestion().slice(0, 220)}` : 'Main personal reading funnel'}
Chart markers: Lagna ${profile.ascendant?.name || 'unknown'}, Moon ${profile.moonSign || profile.vedic?.name || 'unknown'}, Dasha ${profile.currentDasha?.vedic || profile.currentDasha?.planet || 'unknown'}, Life Path ${this.calculations?.lifePath || 'unknown'}, Personal Year ${this.calculations?.personalYear || 'unknown'}.

Rules:
- Exactly ${askMayaActive ? '4-5' : '5-6'} short spoken sentences.
- Greeting is forbidden. Do NOT use "नमस्ते", "Hello", "Hi", "Hey", or welcome phrases; start directly from the reading context.
- हर बार अलग first-line shape, अलग metaphor, अलग sentence rhythm. Template मत बनाइए।
- HARD BAN phrases: "बहुत अच्छा लगा आपसे मिलकर", "मुझे बहुत कुछ पता चल गया है", "गहराई से उतरते हैं", "कुंडली बन गई है", "नमस्ते" को repeat करना।
- Main funnel: question पूछने से पहले 2 meaningful chart/numbers insights दीजिए; user को लगे कुछ useful बताया गया।
- Ask-Maya funnel: exact question quote मत कीजिए; subject phrase use कीजिए और साफ कहिए कि reading उसी topic पर locked रहेगी।
- Chart अभी बनेगा, ready नहीं है। सिर्फ "तैयार कर रही/रहा हूँ" कह सकते हैं।
- Hindi Devanagari, natural spoken, no bullets, no JSON.
Return only spoken text.`
            : `Write a UNIQUE spoken intro for the MAYA funnel.

Seed for uniqueness: ${seed}
Guide name: ${guideName} (${isMale ? 'male' : 'female'} guide)
User: ${this.firstName}
Flow: ${askMayaActive ? `Ask-Maya question funnel. Topic: ${topicLabel}. Spoken subject: ${subjectPhrase}. Original question is internal only: ${this._getActiveUserQuestion().slice(0, 220)}` : 'Main personal reading funnel'}
Chart markers: Ascendant ${profile.ascendant?.name || 'unknown'}, Moon ${profile.moonSign || profile.vedic?.name || 'unknown'}, Dasha ${profile.currentDasha?.vedic || profile.currentDasha?.planet || 'unknown'}, Life Path ${this.calculations?.lifePath || 'unknown'}, Personal Year ${this.calculations?.personalYear || 'unknown'}.

Rules:
- Exactly ${askMayaActive ? '4-5' : '5-6'} short spoken sentences.
- Greeting is forbidden. Do NOT use "Hello", "Hi", "Hey", "Namaste", or welcome phrases; start directly from the reading context.
- Use a different first-line shape, image, and sentence rhythm every time. No template feeling.
- HARD BAN phrases: "really nice to meet you", "I already know a lot", "go deeper into it", "your chart is ready", repeated Hello.
- Main funnel: before any question, give 2 meaningful chart/number insights so the user receives real value.
- Ask-Maya funnel: do not quote the exact question; use the spoken subject phrase and say the reading stays locked to that topic.
- The chart is about to be prepared; it is not ready yet.
- Natural spoken English, no bullets, no JSON.
Return only spoken text.`;

        try {
            this._initFastAiContext(lang);
            const raw = await this._callNarrationFunnelAI(prompt, {
                temperature: 0.88,
                topP: 0.92,
                timeoutMs: 2400,
                requireComplete: false,
                maxTokens: 280
            });
            const cleaned = this.sanitizeNarrationText(raw);
            if (cleaned && cleaned.length > 80) return cleaned;
        } catch (error) {
            console.warn('Journey intro generation failed:', error?.message || error);
        }

        return fallback;
    },

    _getLocalPreQuestionBridge({ isHindi, askMayaActive, topicLabel, subjectPhrase }) {
        const profile = this.personalization || {};
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const lp = this.calculations?.lifePath || '';
        const markerHi = this.localizeHindiText([ascendant && `${ascendant} लग्न`, moonSign && `${moonSign} चंद्र राशि`, dasha && `${dasha} दशा`, lp && `Life Path ${lp}`].filter(Boolean).slice(0, 2).join(' और ')) || 'आपकी कुंडली';
        const markerEn = [ascendant && `${ascendant} ascendant`, moonSign && `${moonSign} moon sign`, dasha && `${dasha} dasha`, lp && `Life Path ${lp}`].filter(Boolean).slice(0, 2).join(' and ') || 'your chart';

        if (askMayaActive) {
            return isHindi
                ? `${markerHi} से ${subjectPhrase} में एक clear direction बन रही है। अभी मैं पूरा answer नहीं खोल${this._isGuiderMale() ? 'ूँगा' : 'ूँगी'}, क्योंकि एक real-life detail से timing बहुत बदल सकती है। इसलिए अगला छोटा सवाल इसी ${topicLabel} को exact करने के लिए है।`
                : `${markerEn} is giving your ${subjectPhrase} a clear direction. I will not open the full answer yet, because one real-life detail can change the timing sharply. The next quick question is only to make your ${topicLabel} answer exact.`;
        }

        return isHindi
            ? `${markerHi} में एक बात साफ दिखती है: आपके फैसले सिर्फ logic से नहीं, अंदर की बेचैनी और responsibility दोनों से बनते हैं। इसी वजह से आपकी reading में सिर्फ ग्रहों की position काफी नहीं है; मुझे आपकी real situation भी पकड़नी होगी। अगला सवाल छोटा है, पर उससे यह पता चलेगा कि chart का कौन-सा हिस्सा अभी सबसे ज़्यादा active है।`
            : `${markerEn} shows one thing clearly: your decisions are shaped by both logic and an inner pressure to carry responsibility. That is why planet positions alone are not enough here; I need one real-life anchor from you. The next question is small, but it tells me which part of the chart is most active right now.`;
    },

    async generatePreQuestionBridge({ isHindi, askMayaActive, topicLabel, subjectPhrase }) {
        const fallback = this._getLocalPreQuestionBridge({ isHindi, askMayaActive, topicLabel, subjectPhrase });
        const lang = isHindi ? 'hi' : 'en';
        const profile = this.personalization || {};
        const prompt = isHindi
            ? `पहले question से ठीक पहले MAYA की short meaningful bridge narration लिखिए।

Flow: ${askMayaActive ? `Ask-Maya, topic ${topicLabel}, subject ${subjectPhrase}` : 'Main funnel'}
Chart markers: Lagna ${profile.ascendant?.name || 'unknown'}, Moon ${profile.moonSign || profile.vedic?.name || 'unknown'}, Dasha ${profile.currentDasha?.vedic || profile.currentDasha?.planet || 'unknown'}, Life Path ${this.calculations?.lifePath || 'unknown'}.
Already spoken:
${this._getAlreadyToldDigest().slice(-1200) || 'opening and kundli formation'}

Rules:
- Exactly ${askMayaActive ? '2-3' : '3-4'} short sentences.
- Greeting नहीं। "कुंडली बन गई है" या chart ready repeat मत कीजिए।
- User को real value मिले: एक concrete chart/number pattern + why next question matters.
- Main funnel में सवाल से पहले थोड़ा useful insight दें, पर बहुत लंबा नहीं।
- Ask-Maya में original question quote न करें; same topic पर रहें।
- Return only spoken Hindi text.`
            : `Write a short meaningful bridge narration right before MAYA asks the first question.

Flow: ${askMayaActive ? `Ask-Maya, topic ${topicLabel}, subject ${subjectPhrase}` : 'Main funnel'}
Chart markers: Ascendant ${profile.ascendant?.name || 'unknown'}, Moon ${profile.moonSign || profile.vedic?.name || 'unknown'}, Dasha ${profile.currentDasha?.vedic || profile.currentDasha?.planet || 'unknown'}, Life Path ${this.calculations?.lifePath || 'unknown'}.
Already spoken:
${this._getAlreadyToldDigest().slice(-1200) || 'opening and kundli formation'}

Rules:
- Exactly ${askMayaActive ? '2-3' : '3-4'} short sentences.
- No greeting. Do not repeat "your kundli is ready" or chart-ready wording.
- Give real value: one concrete chart/number pattern + why the next question matters.
- In the main funnel, give a useful insight before the question, but keep it concise.
- In Ask-Maya, do not quote the original question; stay on the same topic.
- Return only spoken English text.`;

        try {
            this._initFastAiContext(lang);
            const raw = await this._callNarrationFunnelAI(prompt, { temperature: 0.82, topP: 0.95 });
            const cleaned = this.sanitizeNarrationText(raw);
            if (cleaned && cleaned.length > 60) return cleaned;
        } catch (error) {
            console.warn('Pre-question bridge generation failed:', error?.message || error);
        }

        return fallback;
    },

    /**
     * Build a per-session "fresh opening" directive that nudges the AI to vary
     * the opening greeting style every single time, so two users (or the same
     * user across sessions) never hear the same first line. We pick:
     *   - a greeting register (ceremonial, intimate, observational, mythic,
     *     contemplative, playful-warm, grounded-direct)
     *   - an opening sentence shape (no two consecutive sessions repeat the
     *     same shape)
     *   - a tonal flavour word the AI must honor
     * The randomness is seeded by user name + day + hour so the same user gets
     * a stable opening within one session but a different one tomorrow.
     */
    _buildFreshOpeningDirective(isHindi = false) {
        const styles = isHindi
            ? [
                { register: 'ceremonial-hush', shape: 'अपना नाम हल्के से लीजिए, फिर एक शांत observation', flavour: 'गरिमा और शांति' },
                { register: 'intimate-friend', shape: 'सीधे नाम से शुरू कीजिए जैसे कोई पुराना दोस्त बात कर रहा हो', flavour: 'गर्माहट और अपनापन' },
                { register: 'observational', shape: 'पहले एक छोटी observation, फिर नाम -जैसे आपने अभी कुछ notice किया हो', flavour: 'सहज जिज्ञासा' },
                { register: 'mythic-soft', shape: 'एक हल्की mythic image से शुरू कीजिए (जैसे "रात अभी शांत है..." या "जब chart खुलती है...") और फिर नाम लीजिए', flavour: 'रहस्य लेकिन grounded' },
                { register: 'contemplative', shape: 'एक pause-friendly सोचने वाली line से शुरू कीजिए, फिर नाम लीजिए', flavour: 'गहराई और ठहराव' },
                { register: 'playful-warm', shape: 'हल्की मुस्कान वाली line से शुरू कीजिए -जैसे आप मिलकर खुश हैं', flavour: 'हल्कापन और गर्माहट' },
                { register: 'grounded-direct', shape: 'बिना भूमिका के सीधे नाम और एक एक factual chart hook से शुरू कीजिए', flavour: 'practical और clear' }
            ]
            : [
                { register: 'ceremonial-hush', shape: 'Speak the name softly, then offer one quiet observation', flavour: 'dignified and still' },
                { register: 'intimate-friend', shape: 'Open with the name directly, like an old friend picking up a conversation', flavour: 'warm and personal' },
                { register: 'observational', shape: 'Lead with a small observation, then name -as if you just noticed something', flavour: 'gentle curiosity' },
                { register: 'mythic-soft', shape: 'Open with a soft mythic image (e.g. "The night is quiet..." or "When the chart opens...") and then say the name', flavour: 'mysterious yet grounded' },
                { register: 'contemplative', shape: 'Begin with a pause-friendly reflective line, then say the name', flavour: 'deep and unhurried' },
                { register: 'playful-warm', shape: 'Open with a softly smiling line -as if you are glad to meet them', flavour: 'light and warm' },
                { register: 'grounded-direct', shape: 'Skip preamble -go straight to the name and one factual chart hook', flavour: 'practical and clear' }
            ];

        // Deterministic-but-varying seed: name + date + hour. Same user gets the
        // same opening within one hour but a different one across sessions.
        const seedSource = `${this.firstName || ''}|${this.userData?.birthDate || ''}|${new Date().toISOString().slice(0, 13)}|${Math.floor(Math.random() * 1e9)}`;
        let seed = 0;
        for (let i = 0; i < seedSource.length; i += 1) {
            seed = ((seed << 5) - seed + seedSource.charCodeAt(i)) | 0;
        }
        const pick = styles[Math.abs(seed) % styles.length];

        // Forbidden openings -rotate which clichés are explicitly banned this
        // session so the AI is forced into fresh territory.
        const bannedHi = [
            'नमस्ते से शुरू मत कीजिए',
            '"स्वागत है" से शुरू मत कीजिए',
            '"मैं माया हूँ" को पहली line में मत डालिए',
            'cosmic / universe / brahmaand जैसे filler मत use कीजिए'
        ];
        const bannedEn = [
            'Do NOT open with "Hello" or "Hi"',
            'Do NOT open with "Welcome"',
            'Do NOT lead with "I am Maya" in the very first sentence',
            'Avoid filler words like "cosmic", "universe", "the stars say"'
        ];
        const banned = isHindi ? bannedHi : bannedEn;
        // Shuffle a couple of bans deterministically so the constraint set rotates.
        const rotatedBans = banned.slice(Math.abs(seed) % banned.length).concat(banned.slice(0, Math.abs(seed) % banned.length));

        if (isHindi) {
            return `## FRESH OPENING DIRECTIVE (इस session के लिए unique)\n- Opening register: **${pick.register}** \u2014 ${pick.shape}\n- Tonal flavour: ${pick.flavour}\n- पहली line MUST इस register में हो, recycled greeting नहीं।\n- ${rotatedBans.join('\n- ')}\n- आप MAYA हैं -अपना introduction दूसरी या तीसरी line में organically लाइए, पहली line में नहीं।\n- यह opening इस user के लिए uniquely crafted लगे -कोई template feeling नहीं।`;
        }
        return `## FRESH OPENING DIRECTIVE (unique to this session)\n- Opening register: **${pick.register}** \u2014 ${pick.shape}\n- Tonal flavour: ${pick.flavour}\n- The first line MUST match this register \u2014 do NOT recycle a generic greeting.\n- ${rotatedBans.join('\n- ')}\n- You are MAYA \u2014 introduce yourself organically in the second or third sentence, not the very first line.\n- This opening must feel uniquely crafted for THIS user \u2014 no template feel.`;
    },

    getNarrativeStageGuide(sectionKey, isHindi = false) {
        const guides = isHindi
            ? {
                opening: 'Act 1. Invitation phase. ऐसा लगे जैसे एक sealed personal file खुल रही है. सिर्फ पहला hard clue दीजिए, पूरा verdict नहीं। आखिर में ऐसा thread छोड़िए जो kundli layer की तरफ खींचे।',
                kundli: 'Act 2. Chart structure phase. ऐसे बोलिए जैसे chart live trace हो रहा है. Ascendant, चंद्र राशि, दशा, या planetary clustering से life structure दिखाइए, और numbers की तरफ unresolved handoff दीजिए।',
                numbersReveal: 'Act 2b. Numbers revelation phase. तीनों numbers अभी-अभी calculate हुए हैं। पहले short calculation explanation, फिर हर number को INDIVIDUALLY kundli data के साथ जोड़कर explain करें, और end में तीनों + kundli combine करके एक personal life prediction दें। 10-14 वाक्य।',
                identityTruth: 'Teaser segment 1. एक grounded identity observation - "आप ऐसे इंसान हैं जो..." format में। Pattern-based, flattery-free।',
                emotionalPattern: 'Teaser segment 2. एक emotional pattern जो user daily जीता है - ऐसा कुछ जो उन्हें inside-out describe करे।',
                unresolvedThread: 'Teaser segment 3. एक open loop - ऐसा unresolved thread जो naturally resolution माँगे और user को आगे सुनने पर मजबूर करे।',
                combinedTeaser: 'Combined teaser arc. तीन layers: पहले identity truth ("आप ऐसे इंसान हैं जो..."), फिर emotional pattern (inside-out), फिर unresolved thread (open loop)। तीनों एक कहानी की तरह बहें, अलग-अलग टुकड़े नहीं। हर layer chart evidence पर based हो।',
                accuracyShock: 'Act 3. "How does she know?" moment. Chart data से एक SPECIFIC past event predict कीजिए - timing (month/year), nature, और emotional impact सहित। यह reader को चौंकाने वाला हो।',
                suspenseBridge: 'Gate transition. Controlled tension - 1 sentence जो सबसे intense unresolved pattern name करे, 1 sentence जो कहे "इसे अभी यहीं नहीं बताऊँगी", और 1 sentence जो reading save करने की sense of importance पैदा करे।',
                loveIntro: 'Act 4 transition. Emotional layer अब खुल रही है. Tone intimate हो, लेकिन reset नहीं।',
                love: 'Act 4. Relationship layer. User के emotional pattern का एक private but believable contradiction खोलिए. Curiosity बनी रहे।',
                careerIntro: 'Act 5 transition. अब outer world, work, aur money pattern की तरफ lens shift हो रही है. Momentum same रहना चाहिए।',
                career: 'Act 5. Outer path layer. Talent, friction, aur practical direction को एक ही narrative thread में जोड़िए।',
                yearIntro: 'Act 6 transition. अब timing windows करीब आ रही हैं. Voice में measured anticipation रहे।',
                year: 'Act 6. Timing layer. आने वाले महीनों को living timeline की तरह बोलिए, और एक window को बाकी से ज्यादा charged feel कराइए।',
                warningIntro: 'Act 7 transition. पहले trust hold कीजिए, फिर caution खोलिए. Tone protective हो, dramatic नहीं।',
                warning: 'Act 7. Shadow layer. एक specific trigger, उसका pattern, और protective boundary बताइए. यह same story का honest underside लगे।',
                emailGate: 'SMS OTP gate. Reading secure रखने के लिए phone verification चाहिए। साफ़ कहिए कि mobile number भरें और OTP आने में कुछ seconds लग सकते हैं। Email/password का ज़िक्र कभी नहीं।',
                deepRevealPrep: 'Deep reveal threshold. User को feel होना चाहिए कि अब reading deeper और more personal होने वाली है, without sounding salesy.',
                returnHook: 'Return trigger. एक unresolved timing shift बताइए - "अभी नहीं बता सकती, पर आपकी chart में [month] में कुछ shift है - कल इसके बारे में और बात करते हैं।"',
                completion: 'Closing beat. Reading को softly settle कराइए, लेकिन curiosity और conversation का दरवाजा खुला रखिए।',
                authCheck: 'Operational interlude. Mystery टूटे नहीं; बस short, calm continuity रखिए।',
                welcomeBack: 'Re-entry beat. ऐसा लगे जैसे वही file फिर से खोली जा रही है, शुरुआत से नहीं।',
                newUser: 'Protection beat. Reading को valuable personal file की तरह frame कीजिए जिसे सुरक्षित रखना जरूरी है।',
                calculationRecovery: 'Recovery beat. Momentum पूरी तरह मत तोड़िए; बस बताइए कि alignment दोबारा हो रहा है।'
            }
            : {
                opening: 'Act 1. Invitation phase. Sound like a sealed personal file is being opened. Give only the first hard clue, not the whole verdict, and leave a thread that pulls naturally into the kundli layer.',
                kundli: 'Act 2. Chart-structure phase. Speak as if the chart is being traced live. Use ascendant, moon sign, dasha, or planetary clustering to show the structure of the life, then leave an unresolved handoff toward the numbers.',
                numbersReveal: 'Act 2b. Numbers revelation phase. All three numbers just calculated. Start with brief calculation explanation, then explain each number INDIVIDUALLY combined with kundli data, and end with a personal life prediction combining all three + kundli. 10-14 sentences.',
                identityTruth: 'Teaser segment 1. A grounded identity observation - "You are someone who..." format. Pattern-based, flattery-free.',
                emotionalPattern: 'Teaser segment 2. An emotional pattern the user lives with daily - something that describes them from the inside out.',
                unresolvedThread: 'Teaser segment 3. An open loop - an unresolved thread that naturally demands resolution and compels the user to keep listening.',
                combinedTeaser: 'Combined teaser arc. Three layers: identity truth ("You are someone who..."), then emotional pattern (inside-out), then unresolved thread (open loop). All three must flow as one connected narrative, not isolated observations. Every layer must be grounded in specific chart evidence.',
                accuracyShock: 'Act 3. "How does she know?" moment. Predict a SPECIFIC past event from chart data - with timing (month/year), nature, and emotional impact. This should genuinely surprise the user.',
                suspenseBridge: 'Gate transition. Controlled tension - 1 sentence naming the most intense unresolved pattern, 1 sentence saying "I will not tell you this here", and 1 sentence creating a sense of importance around saving the reading.',
                loveIntro: 'Act 4 transition. The emotional layer is opening now. Keep it intimate without resetting the scene.',
                love: 'Act 4. Relationship layer. Reveal one private but believable contradiction in the user\'s emotional pattern and keep curiosity alive.',
                careerIntro: 'Act 5 transition. Shift the lens toward work, money, and outer direction while keeping the same momentum.',
                career: 'Act 5. Outer-path layer. Tie talent, friction, and practical direction into one narrative thread.',
                yearIntro: 'Act 6 transition. The timing windows are getting closer. Let the voice carry measured anticipation.',
                year: 'Act 6. Timing layer. Speak about the coming months like a living timeline, and make one window feel more charged than the rest.',
                warningIntro: 'Act 7 transition. Hold trust first, then open the caution. Sound protective, not dramatic.',
                warning: 'Act 7. Shadow layer. Name one specific trigger, its repeating pattern, and a protective boundary. It must feel like the honest underside of the same story.',
                emailGate: 'SMS OTP gate. Explain that phone verification keeps the reading secure. Clearly ask for the mobile number and mention the OTP can take a few seconds to arrive. Never mention email or password.',
                deepRevealPrep: 'Deep reveal threshold. The user should feel that the reading is about to become deeper and more personal without sounding salesy.',
                returnHook: 'Return trigger. Name one unresolved timing shift - "I cannot tell you yet, but your chart shows a shift in [month] - let us talk about this tomorrow."',
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
        const userMaritalStatus = this.userData?.maritalStatus || '';
        const maritalLabel = userMaritalStatus === 'married' ? 'Married (विवाहित)' : userMaritalStatus === 'unmarried' ? 'Unmarried (अविवाहित)' : userMaritalStatus === 'divorced' ? 'Divorced (विवाह विच्छेद)' : 'Not specified';

        // Life stage + Chara Karaka directive -ensures predictions stay age-appropriate
        // and can specifically speak about self + key relatives (mother, spouse, children, siblings…)
        const lifeStage = (window.MayaKundli?.calculateLifeStage)
            ? MayaKundli.calculateLifeStage(this.userData?.birthDate)
            : null;
        const charaKarakas = (this.kundliChart?.planets?.length && window.MayaKundli?.calculateCharaKarakas)
            ? MayaKundli.calculateCharaKarakas(this.kundliChart.planets)
            : null;

        let lifeStageBlock = '';
        if (lifeStage && lifeStage.age != null) {
            lifeStageBlock = isHindi
                ? `\n\n## LIFE STAGE (उम्र-अनुरूप predictions के लिए CRITICAL)\nUser की उम्र: ${lifeStage.age} साल -Stage: ${lifeStage.label}\nइस stage पर focus: ${lifeStage.focusHi}\nREGEL: हर prediction, remedy, और timing इसी life-stage के हिसाब से दीजिए। ऐसे events predict मत कीजिए जो इस उम्र के लिए biologically/socially impossible हैं (जैसे 24 साल के user को retirement, 55 साल के user को school admission, 68 साल के user को पहला बच्चा)।`
                : `\n\n## LIFE STAGE (age-appropriate predictions -CRITICAL)\nUser age: ${lifeStage.age} years -Stage: ${lifeStage.label}\nFocus at this stage: ${lifeStage.focusEn}\nRULE: Every prediction, remedy, and timing window MUST fit this life stage. Do NOT predict events that are biologically/socially implausible for this age (e.g., retirement for a 24-year-old, first child for a 68-year-old, school admission for a 55-year-old).`;
        }

        let karakaBlock = '';
        if (charaKarakas) {
            const lines = Object.values(charaKarakas).map(k =>
                `- ${k.code} (${k.hindi}): ${k.planet} in ${k.sign} ${k.degree}° -signifies ${k.signifies}`
            ).join('\n');
            karakaBlock = isHindi
                ? `\n\n## CHARA KARAKAS -User और उनके रिश्तेदारों के personal significators\n${lines}\nREGEL: जब भी किसी रिश्तेदार (माँ, जीवनसाथी, भाई-बहन, बच्चे, पिता-पक्ष के रिश्तेदार) या खुद user के बारे में बोलें, उस karaka ग्रह की राशि, degree, और house से correlate कीजिए। उदाहरण: Darakaraka अगर fiery sign में है → जीवनसाथी assertive/independent; Matrukaraka Saturn/Rahu से afflicted → माँ की zindagi में कठिनाई या भावनात्मक दूरी; Putrakaraka strong house में → बच्चों/creativity से संतुष्टि। Generic बातें मत कहिए -हमेशा karaka ग्रह name करके effect बताइए।`
                : `\n\n## CHARA KARAKAS -personal significators for the user AND their key relatives\n${lines}\nRULE: Whenever you speak about a relative (mother, spouse, siblings, children, paternal relatives) or the user's own self/career, correlate it to that karaka planet's sign, degree, and house. Example: Darakaraka in a fiery sign → spouse is assertive/independent; Matrukaraka afflicted by Saturn/Rahu → mother faces hardship or emotional distance; Putrakaraka in a strong house → fulfilment through children/creativity. Do NOT give generic statements -always name the karaka planet and its effect.`;
        }

        const commonFacts = isHindi
            ? `${temporalRules}\n\nUser gender: ${genderLabel}\nMarital Status: ${maritalLabel}${lifeStageBlock}${karakaBlock}\n\nNumerology:\n- Life Path: ${numbers.lifePath || 'unknown'}\n- Destiny: ${numbers.destiny || 'unknown'}\n- Soul Urge: ${numbers.soulUrge || 'unknown'}\n- Personal Year: ${numbers.personalYear || 'unknown'}\n\n${chartFacts}${timingHints ? `\nTiming hints: ${timingHints}` : ''}${userSelections ? `\n\n## USER RESPONSES (use these to PERSONALISE)\n${userSelections}\nIMPORTANT: User ने ऊपर दिए सवालों के जवाब दिए हैं। इन जवाबों से user की real life situation पता चलती है। Reading इन answers से DIRECTLY influenced होनी चाहिए - अगर user ने कहा "सीधी बात बोलो" तो filterless बोलिए, अगर "not_fully" कहा career में तो career dissatisfaction address कीजिए, अगर "हाँ" कहा repeating mistake पर तो उस pattern को name और explain कीजिए।` : ''}\n\nIMPORTANT: Use the EXACT planetary positions, dasha periods, and house analysis given above to make SPECIFIC predictions. Reference the actual planet names, signs, degrees, and dasha years. For example: "शनि मीन राशि में 14.2° पर है और आपकी राहु दशा 2019 में शुरू हुई - इसका मतलब है कि 2020-2021 में..." This makes predictions feel personally calculated. Do NOT give vague generic predictions. Every claim must trace back to a specific chart fact above.\nIf planet-in-house analysis data is provided above, weave those effects naturally into your reading - reference the remedies (उपाय), benefic/malefic effects, and specific rules for the user's planetary placements. Do NOT mention the source name or any book title - just present these insights as part of your own Vedic reading seamlessly.`
            : `${temporalRules}\n\nUser gender: ${genderLabel}\nMarital Status: ${maritalLabel}${lifeStageBlock}${karakaBlock}\n\nNumerology:\n- Life Path: ${numbers.lifePath || 'unknown'}\n- Destiny: ${numbers.destiny || 'unknown'}\n- Soul Urge: ${numbers.soulUrge || 'unknown'}\n- Personal Year: ${numbers.personalYear || 'unknown'}\n\n${chartFacts}${timingHints ? `\nTiming hints: ${timingHints}` : ''}${userSelections ? `\n\n## USER RESPONSES (use these to PERSONALISE)\n${userSelections}\nIMPORTANT: The user answered the questions above. These reveal their real life situation. Your reading MUST be directly shaped by these answers - if user chose "harder truth", be filterless; if they said "not_fully" about career, address career dissatisfaction; if they confirmed a repeating mistake, name and explain that pattern.` : ''}\n\nIMPORTANT: Use the EXACT planetary positions, dasha periods, and house analysis given above to make SPECIFIC predictions. Reference the actual planet names, signs, degrees, and dasha transition years. For example: "Saturn in Pisces at 14.2° combined with your Rahu dasha starting 2019 means that in 2020-2021..." This makes predictions feel personally calculated. Do NOT give vague generic predictions. Every claim must trace back to a specific chart fact above.\nIf planet-in-house analysis data is provided above, weave those effects naturally into your reading - reference the remedies, benefic/malefic effects, and specific rules for the user's planetary placements. Do NOT mention the source name or any book title - just present these insights as part of your own Vedic reading seamlessly.`;

        // ============================================================
        //  USER QUESTION DIRECTIVE - if the user asked a specific question
        //  on the landing screen ("Ask Maya anything"), every section MUST
        //  bend toward that question. Pre-auth sections tease the answer;
        //  post-auth deep reveal sections give the full detailed answer.
        // ============================================================
        const userQuestionRaw = (this.userData?.userQuestion || context.userQuestion || '').toString().trim();
        let userQuestionBlock = '';
        const QUESTION_PRE_AUTH_SECTIONS = new Set(['opening', 'kundli', 'numbersReveal', 'identityTruth', 'emotionalPattern', 'unresolvedThread', 'combinedTeaser', 'accuracyShock', 'suspenseBridge', 'emailGate', 'fomoHook']);
        const isQuestionPreAuth = !!userQuestionRaw && QUESTION_PRE_AUTH_SECTIONS.has(sectionKey);
        if (userQuestionRaw) {
            const safeQ = userQuestionRaw.replace(/`/g, "'").slice(0, 320);
            const qTopic = this._classifyUserQuestionTopic(safeQ);
            const qTopicLabel = this._getAskMayaTopicLabel(qTopic, isHindi);
            const qSubjectPhrase = this._getAskMayaSubjectPhrase(qTopic, isHindi);
            // Build an anti-repetition snippet from previously spoken narrations
            // so the AI doesn't echo phrases the user has already heard.
            const recentSpoken = (Array.isArray(this.spokenNarrations) ? this.spokenNarrations : [])
                .slice(-6)
                .map(s => (s && s.text) ? String(s.text) : '')
                .filter(Boolean)
                .join(' \u2022 ')
                .slice(0, 900);
            const isPreAuth = QUESTION_PRE_AUTH_SECTIONS.has(sectionKey);
            const lines = [];
            if (isHindi) {
                lines.push("");
                lines.push("");
                lines.push("## USER'S BURNING QUESTION (HIGHEST PRIORITY -हर section इसी के around बनेगा)");
                lines.push('Original user question, INTERNAL CONTEXT ONLY: "' + safeQ + '"');
                lines.push('Topic lock: ' + qTopicLabel);
                lines.push('Spoken subject phrase: ' + qSubjectPhrase);
                lines.push("REGEL:");
                lines.push("- Original question को spoken output में verbatim quote या repeat मत कीजिए। सिर्फ spoken subject phrase या natural shorthand use कीजिए।");
                lines.push("- TOPIC LOCK (CRITICAL): यह पूरी reading केवल '" + qTopicLabel + "' के बारे में है। प्यार/career/पैसा/सेहत/परिवार/शादी/संतान/यात्रा/पढ़ाई जैसे unrelated topics को MENTION भी मत कीजिए, चाहे chart उन्हें कितना भी highlight करे। अगर सवाल '" + qTopicLabel + "' के बारे में है, तो दूसरा कोई topic open करना forbidden है।");
                lines.push("- LENGTH CAP: इस section में MAX 3-4 छोटे वाक्य। One spoken paragraph, no filler, no preamble। हर वाक्य user के सवाल से directly जुड़ा हो।");
                lines.push("- सीधे point पर आइए। 'मैं देख रही हूँ', 'चलिए देखते हैं', 'आपकी कुंडली में' जैसे filler openers से बचिए — पहला शब्द ही substance हो।");
                lines.push("- User का नाम, sign, और chart facts use करते हुए इसी सवाल के लिए relevant pattern पकड़िए।");
                if (isPreAuth) {
                    lines.push('- यह section PRE-LOGIN है: सवाल को acknowledge कीजिए, chart से एक tantalizing partial insight दीजिए, but पूरा detailed answer अभी मत खोलिए। साफ संकेत दीजिए कि "इसकी पूरी गहराई file save होने के बाद खुलेगी"।');
                } else {
                    lines.push("- यह section POST-LOGIN है: अब इसी सवाल का COMPLETE, SPECIFIC, और HONEST answer दीजिए। Chart evidence (ग्रह, राशि, घर, दशा, transit) को NAME करके बताइए कि इस सवाल का जवाब क्या है, क्यों है, कब-कब क्या होगा, और क्या practical action / remedy लेना चाहिए। Vague मत रहिए।");
                }
                if (sectionKey === 'opening' || sectionKey === 'kundli') {
                    lines.push("- IMPORTANT: इस section का BAHUT FIRST sentence natural हो: बताइए कि आप " + qSubjectPhrase + " के बारे में उनकी कुंडली, numbers और timing से answer ढूँढने जा रही हैं। Exact original question quote मत कीजिए।");
                    lines.push("- Kundli के structure की लम्बी व्याख्या मत दीजिए। केवल 1 chart marker name कीजिए और तुरंत user के सवाल की तरफ pivot कीजिए।");
                }
                if (recentSpoken) {
                    lines.push("- ANTI-REPETITION: नीचे दिए previously spoken sentences के words/phrases दोबारा मत use कीजिए। Fresh wording, fresh angle। कोई sentence या phrase दोहराइए मत।");
                    lines.push("PREVIOUSLY SPOKEN: " + recentSpoken);
                }
            } else {
                lines.push("");
                lines.push("");
                lines.push("## USER'S BURNING QUESTION (HIGHEST PRIORITY -every section bends toward this)");
                lines.push('Original user question, INTERNAL CONTEXT ONLY: "' + safeQ + '"');
                lines.push('Topic lock: ' + qTopicLabel);
                lines.push('Spoken subject phrase: ' + qSubjectPhrase);
                lines.push("RULES:");
                lines.push("- Do NOT quote or repeat the original question verbatim in spoken output. Use the spoken subject phrase or a natural shorthand instead.");
                lines.push("- TOPIC LOCK (CRITICAL): This entire reading is ONLY about '" + qTopicLabel + "'. Do NOT mention unrelated topics like love/career/money/health/family/marriage/children/travel/education even if the chart highlights them. Opening another topic is FORBIDDEN.");
                lines.push("- LENGTH CAP: MAX 3-4 short sentences in this section. One spoken paragraph. No preamble, no filler. Every sentence must directly serve the user's question.");
                lines.push("- Get to the point. Avoid filler openers like 'I can see', 'Let me look', 'In your chart' — the first word should already be substance.");
                lines.push("- Use the user's name, signs, and chart facts to identify the pattern that is most relevant to this exact question.");
                if (isPreAuth) {
                    lines.push('- This section is PRE-LOGIN: acknowledge the question, offer ONE tantalizing partial chart-based insight, but do NOT reveal the full detailed answer yet. Make it clear that "the full depth of this answer opens once your file is saved".');
                } else {
                    lines.push("- This section is POST-LOGIN: now give the COMPLETE, SPECIFIC, and HONEST answer to this exact question. NAME the chart evidence (planet, sign, house, dasha, transit) and explain WHAT the answer is, WHY it is so, WHEN things will unfold, and what practical action / remedy to take. Do NOT stay vague.");
                }
                if (sectionKey === 'opening' || sectionKey === 'kundli') {
                    lines.push("- IMPORTANT: The VERY FIRST sentence of this section MUST explicitly tell the user that you are finding their " + qSubjectPhrase + " using kundli, numbers, and timing. Do not quote the exact original question.");
                    lines.push("- Do NOT spend time describing the kundli's structure. Quote at most ONE chart marker as supporting evidence and immediately pivot to addressing the user's question.");
                }
                if (recentSpoken) {
                    lines.push("- ANTI-REPETITION: Do NOT reuse any words or phrases from the previously spoken lines below. Fresh wording, fresh angle. Never repeat a sentence or signature phrase.");
                    lines.push("PREVIOUSLY SPOKEN: " + recentSpoken);
                }
            }
            userQuestionBlock = lines.join("\n");
        }

        const compactQuestionFacts = [
            isHindi
                ? `## COMPACT CHART BRIEF (Ask-Maya pre-login -keep payload small)\nआज: ${todayStr}; Current month: ${currentMonth}. Future predictions केवल upcoming months पर; बीते months को past tense में बोलें।`
                : `## COMPACT CHART BRIEF (Ask-Maya pre-login -keep payload small)\nToday: ${todayStr}; Current month: ${currentMonth}. Predict only upcoming months; refer to passed months in past tense.`,
            `User gender: ${genderLabel}`,
            `Marital Status: ${maritalLabel}`,
            `Numerology: Life Path ${numbers.lifePath || 'unknown'}, Destiny ${numbers.destiny || 'unknown'}, Soul Urge ${numbers.soulUrge || 'unknown'}, Personal Year ${numbers.personalYear || 'unknown'}`,
            profile.western?.name ? `Western zodiac: ${profile.western.name}` : '',
            profile.vedic?.name ? `Vedic moon sign: ${profile.vedic.name}` : '',
            profile.hasReliableAscendant && profile.ascendant?.name ? `Ascendant: ${profile.ascendant.name}` : '',
            profile.currentDasha?.vedic || profile.currentDasha?.planet ? `Current dasha: ${profile.currentDasha?.vedic || profile.currentDasha?.planet}` : '',
            profile.dominantElement ? `Dominant element: ${profile.dominantElement}` : '',
            visibleKundliFacts ? `Visible kundli facts:\n${visibleKundliFacts}` : '',
            Array.isArray(profile.highlights) && profile.highlights.length ? `Chart highlights: ${profile.highlights.slice(0, 3).join('; ')}` : '',
            timingHints ? `Timing hints: ${timingHints}` : '',
            userSelections ? `User responses:\n${userSelections}` : '',
            isHindi
                ? `RULE: सवाल से बाहर मत जाइए। सिर्फ 1-2 exact chart markers use कीजिए; full chart dump repeat मत कीजिए।`
                : `RULE: Do not leave the user's question. Use only 1-2 exact chart markers; do not repeat a full chart dump.`
        ].filter(Boolean).join('\n');
        const factsForSection = isQuestionPreAuth ? compactQuestionFacts : commonFacts;
        const commonFactsWithQuestion = userQuestionBlock ? (userQuestionBlock + "\n\n" + factsForSection) : factsForSection;

        const sharedRules = isQuestionPreAuth
            ? (isHindi
                ? `Rules:
- Original question को spoken text में quote/repeat मत करें; short subject phrase use करें।
- 2-4 छोटे वाक्य, natural spoken Hindi, no bullet points।
- Topic lock से बाहर कोई area mention मत करें।
- पिछली बात repeat मत करें; नया angle दें।
- Greeting/restart forbidden: "नमस्ते", "Hello", "Hi", guide introduction, या fresh-session opener कहीं भी मत लिखिए।
- Previous spoken context से आगे बढ़िए; ऐसा लगे कि same prediction continue हो रही है।
- TTS-safe: एक flowing paragraph, no JSON, no headings.`
                : `Rules:
- Do not quote/repeat the original question in spoken text; use the short subject phrase.
- 2-4 short sentences, natural spoken English, no bullets.
- Do not mention any area outside the topic lock.
- Do not repeat previous lines; add a fresh angle.
- Greeting/restart forbidden: do not write Namaste, Hello, Hi, a guide introduction, or any fresh-session opener anywhere.
- Move forward from the previous spoken context so it feels like the same prediction is continuing.
- TTS-safe: one flowing paragraph, no JSON, no headings.`)
            : this.getBaseRules(isHindi);

        const sectionPrompts = isHindi
            ? {
                opening: `Current user के लिए ONE opening narration। EXACTLY 4 short sentences। पहली line "FRESH OPENING DIRECTIVE" का shape follow करे। User का नाम पहली या दूसरी line में natural way में आए, और "मैं MAYA हूँ" introduction दूसरी line में organically फिट हो (पहली line में नहीं)। Introduction के बाद [[pause-500]]। फिर ONE line में उनके chart, numbers या timing से सबसे standout factual clue दीजिए (जन्मतिथि literal मत पढ़िए)। आखिरी line में clearly कहिए कि personal reading कुंडली + numbers + timing से तैयार हो रही है और save करना ज़रूरी है। No filler, no cosmic platitudes।`,
                kundli: `Current user के लिए ONE kundli narration। EXACTLY 4-5 short sentences। पहली line warm, exploratory ("चलिए साथ में देखते हैं...")। फिर ascendant, moon sign, current dasha, या dominant element में से सिर्फ 2 visible markers cite कीजिए। दूसरी या तीसरी line में एक SHORT FOMO teaser plant कीजिए ("numbers मिलते ही एक बहुत बड़ी prediction खुलेगी") -prediction reveal मत कीजिए, बस build-up। अगर chart में genuinely rare yoga है (Neechabhanga / Gajakesari / Mahapurusha / Hamsa आदि), तो एक line में mystical reverence से acknowledge कीजिए ("ऐसी कुंडली बहुत समय बाद..." -genuine wonder, dramatic नहीं); rare yoga नहीं है तो skip। End में numbers की तरफ smooth pivot। ज्यादा से ज्यादा एक [[pause-250]]।`,
                numbersReveal: `Current user के लिए numbers reading। तीनों numbers: Life Path ${this.calculations?.lifePath || ''}, Destiny ${this.calculations?.destiny || ''}, Soul Urge ${this.calculations?.soulUrge || ''}।

STRUCTURE (इसी ORDER में, total 7-9 short sentences):
1. ONE sentence: तीनों numbers कैसे derive हुए ("birth date से Life Path, full name के अक्षरों से Destiny, स्वरों से Soul Urge")।
2. हर number का 1-2 sentence reading -क्या represent करता है + chart का कौनसा planet/house इसे confirm करता है + real life पर specific असर। तीनों के बीच [[pause-250]]।
3. Closing ONE sentence: तीनों numbers + chart combine करके एक SPECIFIC personal incident (past या upcoming) name कीजिए -exact time period सहित।

No padding, no generic praise।`,
                loveIntro: `Current user के लिए love section का ONE transition। 1 sentence। Warm, direct, section-specific। No pause token।`,
                love: `Current user के लिए ONE FILTERLESS love reading। 4 sentences max। "7TH HOUSE & MARRIAGE ANALYSIS" पढ़कर: married likely है तो marriage dynamics + real friction; unmarried likely है तो attachment pattern + partnership timing (specific months/years)। Venus की राशि, 7th house lord, और दशा NAME कीजिए -इन positions से EXACTLY कौनसी relationship dynamic बनती है वो बताइए। "Love life अच्छी होगी" जैसी vague line forbidden। Raw, specific, no sugar-coating। ज्यादा से ज्यादा एक [[pause-250]]।`,
                careerIntro: `Current user के लिए career section का ONE transition। 1 sentence। Work, money, या practical direction की तरफ clean shift। No pause।`,
                career: `Current user के लिए ONE FILTERLESS career & money reading। 4 sentences max। 10th house, current दशा, और key planetary positions use करके बताइए कि user EXACTLY किस direction में naturally pull हो रहे हैं और कहाँ energy waste हो रही है। ONE underused strength + ONE concrete next move with timeline (specific month/year)। No fake positivity, no generic advice। ज्यादा से ज्यादा एक [[pause-250]]।`,
                yearIntro: `Current user के लिए timing section का ONE transition। 1 sentence। आने वाले महीनों की तरफ clean shift। No pause।`,
                year: `Current user के लिए ONE FILTERLESS timing reading। 4-5 sentences। TEMPORAL AWARENESS पढ़ें -beeते महीनों को past tense में, predictions ONLY upcoming months पर। दशा transitions + transits + Personal Year combine करके अगले 3-6 months की 2 NEW specific windows बताइए (हर window: exact month + year + क्या करना/avoid करना)। ONE hidden trap with timing। पहले दिए timing hints repeat मत कीजिए। ज्यादा से ज्यादा एक [[pause-250]]।`,
                warningIntro: `Current user के लिए caution section का ONE transition। 1 sentence। Strengths acknowledge करते हुए honest pressure point की तरफ shift। डराइए नहीं। No pause।`,
                warning: `Current user के लिए ONE honest warning। 4 sentences max। Chart से ONE NEW specific self-sabotage pattern identify कीजिए -planetary evidence से exact reason + trigger months/situations + practical avoidance। पहले दिए caution hints repeat मत कीजिए। "Careful रहिए" जैसी generic line forbidden। ज्यादा से ज्यादा एक [[pause-250]]।`,
                healthIntro: `Current user के लिए health section का ONE transition। 1 sentence। शरीर, vitality, और daily rhythm की तरफ clean shift। No pause।`,
                health: `Current user के लिए ONE careful health & vitality reading। 4-5 sentences। 6/8/12 houses, उनके lords, current दशा, और relevant transits (Saturn/Mars/Rahu-Ketu) NAME कीजिए। बताइए: किस body system पर pressure है, कौन से months में extra rest या check-up beneficial, कौनसी lifestyle habit repeating issue बन रही है। हर concerning indication के साथ ONE classical Vedic remedy (mantra/herb/fasting/charity)। Clearly कहिए कि persistent symptoms पर qualified doctor से मिलें -यह निदान नहीं है। कोई दवाई या dose name मत कीजिए। ज्यादा से ज्यादा एक [[pause-250]]।`,
                wealthIntro: `Current user के लिए wealth section का ONE transition। 1 sentence। पैसे की flow, savings, या investment timing की तरफ clean shift। No pause।`,
                wealth: `Current user के लिए ONE wealth & investment reading। 4-5 sentences। 2/5/9/11 houses + lords, Jupiter/Venus, current दशा-antardasha, और Personal Year combine कीजिए। अगले 6-12 months की 2 specific wealth-positive windows + ONE window जिसमें major financial decision avoid करना है। ONE general asset class (real estate / equity / fixed income / business expansion / liquidity) chart से align करती हो। NEVER specific stock/coin/scheme name। End में licensed financial advisor से मिलने की advice। ज्यादा से ज्यादा एक [[pause-250]]।`,
                longevityIntro: `Current user के लिए longevity section का ONE transition। 1 sentence। बड़े protective rhythms की तरफ gentle shift, डराइए नहीं। No pause।`,
                longevity: `Current user के लिए ONE compassionate longevity & critical-period reading। 4-5 sentences। 8th house + lord, Saturn/Mars, और Sade Sati / Ashtama Shani / दशा-antardasha sandhi gently reference कीजिए। CRITICAL: मृत्यु की specific date या year predict मत कीजिए -केवल "caution windows" बताइए जहाँ extra rest, safe travel, और routine health-check beneficial हैं। हर caution के साथ ONE strong protective remedy (Mahamrityunjaya jaap / Hanuman Chalisa / specific daan / fasting day)। Tone reassuring, threatening नहीं। ज्यादा से ज्यादा एक [[pause-250]]।`,
                legalIntro: `Current user के लिए legal section का ONE transition। 1 sentence। तनाव, विवाद, या authority matters की तरफ clean shift। No pause।`,
                legal: `Current user के लिए ONE legal & disputes reading। 4-5 sentences। 6th house (litigation), 8th house (sudden reversals), Mars (aggression), Saturn (delays/authority) NAME करके reference कीजिए। बताइए: कौन से months में legal/contract matters favourable, कब signing या confrontation avoid, और कैसा opponent pattern दिख रहा है। ONE classical remedy (Hanuman worship / red sandalwood / specific daan)। NEVER court strategy या case-specific advice -clearly कहिए कि actual legal action से पहले licensed advocate से ज़रूर मिलें। ज्यादा से ज्यादा एक [[pause-250]]।`,
                publicLifeIntro: `Current user के लिए public-life section का ONE transition। 1 sentence। नाम, image, leadership, या visibility की तरफ shift। No pause।`,
                publicLife: `Current user के लिए ONE neutral public-life & leadership reading। 4-5 sentences। 10th house (status), Sun (authority), Moon (mass appeal), और कोई Raj Yoga / Neechabhanga combinations identify कीजिए। बताइए: chart genuinely public visibility support करती है या नहीं, कौनसी window में नाम/recognition rise करेगा, और कौनसी window में controversy avoid। Politically neutral -किसी party या ideology का pakshpaat नहीं। ONE leadership remedy (Surya Namaskar / Aditya Hridaya Stotra / specific daan)। ज्यादा से ज्यादा एक [[pause-250]]।`,
                calculationRecovery: `Current user के लिए ONE short recovery line। 1 sentence। Operational tone, mystical sales copy नहीं। No pause।`,
                emailGate: `Current user के लिए ONE soft SMS OTP gate transition। EXACTLY 2 sentences। FOMO या डर नहीं। Sentence 1: warm continuation -reading का अगला layer तैयार है। Sentence 2 (CORE): "${this.firstName || 'जी'}, आगे की reading सुरक्षित रखने के लिए SMS verification चाहिए -अपना मोबाइल नंबर डाल दीजिए; ओटीपी आने में कुछ सेकंड लग सकते हैं।" दोस्त वाली tone, sales pitch नहीं। Email/password का ज़िक्र कभी नहीं। No pause।`,
                fomoHook: `Current user के लिए ONE FOMO hook। 2 sentences। Chart + numbers से ONE concerning या serious pattern बताइए (upcoming challenge / hidden tension / career trap / repeating self-sabotage)। Confident और specific, vague नहीं। डराइए नहीं, urgency बनाइए। End में hint कि full details private reading में हैं। No pause।`,
                combinedTeaser: `Current user के लिए ONE flowing teaser reading -तीन connected segments, total 6 sentences max।

[Segment 1 - IDENTITY TRUTH] 2 sentences। "आप ऐसे इंसान हैं जो..." format। Chart + numbers से flattery-free pattern observation -accurate self-description जिसे user खुद पहचान ले।
[[pause-250]]
[Segment 2 - EMOTIONAL PATTERN] 2 sentences। ONE daily emotional pattern जो user actually जीता है -inner conflict / recurring feeling / relationship dynamic, chart से confirmed। "Inside-out" -अंदर महसूस होने वाली बात।
[[pause-250]]
[Segment 3 - UNRESOLVED THREAD] 2 sentences। Chart से ONE open loop जो naturally resolution माँगे -timing shift, relationship question, या career crossroad। User को लगे "मुझे और जानना है।"

तीनों segments connected कहानी की तरह -हर segment SPECIFIC chart evidence cite करे। Generic observations FORBIDDEN।`,
                identityTruth: `Current user के लिए ONE grounded identity truth। 2 sentences। "आप ऐसे इंसान हैं जो..." format। Chart + numbers से flattery-free observation -no praise, सिर्फ accurate self-description। No pause।`,
                emotionalPattern: `Current user के लिए ONE emotional pattern observation। 2 sentences। Daily emotional pattern जो user actually जीता है -inner conflict / recurring feeling / relationship dynamic, chart से confirmed। "Inside-out" -अंदर महसूस होने वाली बात। No pause।`,
                unresolvedThread: `Current user के लिए ONE unresolved thread। 2 sentences। Chart से open loop जो naturally resolution माँगे (timing shift / relationship question / career crossroad)। User को लगे "मुझे और जानना है।" Deep reading में resolve होगा। No pause।`,
                accuracyShock: `Current user के लिए ONE "how does she know?" moment। 3 sentences। Chart data (दशा transitions, planetary positions, house activations) से SPECIFIC past event predict कीजिए -approximate month/year + nature (relationship change / career shift / health issue / family event / emotional crisis) + emotional impact। इतना specific हो कि user सोचे "ये कैसे पता?"। "जिन्दगी में बदलाव आया" जैसी generic line forbidden। ज्यादा से ज्यादा एक [[pause-250]]।`,
                suspenseBridge: `Current user के लिए ONE suspense bridge। EXACTLY 3 sentences। Sentence 1: सबसे intense unresolved pattern name कीजिए जो chart में दिखता है। Sentence 2: कहिए "इसका पूरा truth यहाँ खोलना ठीक नहीं होगा" + एक ही वाक्य में naturally tease कीजिए कि file save होते ही vitality windows, धन-investment timing, मुक़दमे के safe months, longevity के protective periods, और leadership phases -सब chart से खोलेंगी। Sentence 3: "आपकी पूरी file तैयार है, बस इसे save कर लीजिए।" No pause।`,
                returnHook: `Current user के लिए ONE return hook। 2 sentences। Chart से upcoming timing shift (specific month) identify कीजिए और कहिए कि अभी इसकी पूरी बात नहीं कर सकती -"कल इसे और गहराई से देखेंगे।" अगली session के लिए natural motivation। No pause।`,
                authCheck: `Current user के लिए ONE record-check line। 1 sentence। Saved reading check करने की बात। No pause।`,
                welcomeBack: `Current user के लिए returning-user prompt। 2 sentences। Warm recognition + saved reading mention + password ask। No pause।`,
                newUser: `Current user के लिए new-user prompt। 2 sentences। Password create करके reading save और protect करने की बात। No pause।`,
                deepRevealPrep: `Current user के लिए deep-reveal prep। 2 sentences। Surface layer अब तक थी; अब deeper, more personal patterns खुलेंगे। End में consent-style question। No pause।`,
                completion: `Current user के लिए ONE completion message। 2 sentences। Reading को grounded way में close + questions invite। No pause।`
            }
            : {
                opening: `Write ONE opening narration for the current user. EXACTLY 4 short sentences. Sentence 1 follows the "FRESH OPENING DIRECTIVE" shape; the user's name appears naturally in sentence 1 or 2; your "I am MAYA" introduction sits organically in sentence 2 (NEVER sentence 1). Place [[pause-500]] immediately after the introduction sentence. Then ONE sentence naming the single most standout detail from chart, numbers, or timing (do not recite the literal birth date). Final sentence makes it clear that the personal reading is being assembled from kundli + numbers + timing and invites them to save it. No filler, no cosmic platitudes.`,
                kundli: `Write ONE kundli narration for the current user. EXACTLY 4-5 short sentences. Sentence 1 is warm and exploratory ("Let's walk through your chart together..."). Then cite ONLY 2 visible markers (ascendant, moon sign, current dasha, or dominant element). In sentence 2 or 3, plant a SHORT FOMO teaser ("once your numbers line up, one big prediction will surface") -do NOT reveal the prediction, only build suspense. If the chart genuinely contains a rare yoga (Neechabhanga / Gajakesari / Mahapurusha / Hamsa, etc.), one line of mystical reverence ("I haven't seen a chart like this in a long time..." -genuine wonder, never theatrical); if no rare yoga, skip this entirely. End with a smooth pivot toward the numbers. At most one [[pause-250]].`,
                numbersReveal: `Write a numbers reading for the current user. The three numbers: Life Path ${this.calculations?.lifePath || ''}, Destiny ${this.calculations?.destiny || ''}, Soul Urge ${this.calculations?.soulUrge || ''}.

STRUCTURE (follow this ORDER, total 7-9 short sentences):
1. ONE sentence on derivation ("Life Path comes from your birth date, Destiny from full-name letters, Soul Urge from the vowels").
2. 1-2 sentences per number — what it represents + which planet/house/dasha in the chart confirms it + its specific real-life effect. Place [[pause-250]] between the three.
3. Closing ONE sentence: combine all three numbers + chart to name ONE SPECIFIC personal incident (past or upcoming) with an exact time period.

No padding, no generic praise.`,
                loveIntro: `Write ONE transition into the love section. 1 sentence. Warm, direct, section-specific. No pause token.`,
                love: `Write ONE FILTERLESS love reading for the current user. 4 sentences max. Read "7TH HOUSE & MARRIAGE ANALYSIS": if likely married, give marriage dynamics + real friction; if likely unmarried, give attachment pattern + partnership timing (specific months/years). NAME the Venus sign, 7th house lord, and relevant dasha — explain EXACTLY which relationship dynamic these positions create. Vague lines like "love life will improve" are forbidden. Raw, specific, no sugar-coating. At most one [[pause-250]].`,
                careerIntro: `Write ONE transition into the career section. 1 sentence. Clean shift toward work, money, or practical direction. No pause.`,
                career: `Write ONE FILTERLESS career & money reading. 4 sentences max. Use 10th house, current dasha, and key planetary positions to explain EXACTLY which direction the user is naturally pulled toward and where they are wasting energy. Name ONE underused strength and ONE concrete next move with a timeline (specific month/year). No fake positivity, no generic advice. At most one [[pause-250]].`,
                yearIntro: `Write ONE transition into the timing section. 1 sentence. Clean shift toward the coming months. No pause.`,
                year: `Write ONE FILTERLESS timing reading. 4-5 sentences. Read TEMPORAL AWARENESS — past months in past tense, predictions ONLY about upcoming months. Combine dasha transitions + transits + personal year to map 2 NEW specific windows in the next 3-6 months (each: exact month + year + what to do or avoid). Include ONE hidden trap with timing. Do NOT repeat any timing hints already given. At most one [[pause-250]].`,
                warningIntro: `Write ONE transition into the caution section. 1 sentence. Acknowledge strengths, then move honestly toward one pressure point. No fear-mongering. No pause.`,
                warning: `Write ONE honest warning. 4 sentences max. Identify ONE NEW specific self-sabotage pattern from the chart — planetary evidence for why it forms + trigger months/situations + practical avoidance. Do NOT repeat any caution hints already given. Generic "be careful" is forbidden. At most one [[pause-250]].`,
                healthIntro: `Write ONE transition into the health section. 1 sentence. Clean shift toward body, vitality, and daily rhythm. No pause.`,
                health: `Write ONE careful health & vitality reading. 4-5 sentences. NAME the 6th, 8th, and 12th houses, their lords, the current dasha, and relevant transits (Saturn/Mars/Rahu-Ketu). Identify which body system is under pressure, in which months extra rest or a check-up will help, and which lifestyle habit is becoming a repeating issue. Pair every concerning indication with ONE classical Vedic remedy (mantra/herb/fasting day/charity). State clearly that this is not a diagnosis and persistent symptoms require a qualified doctor. NEVER name a specific medicine or dosage. At most one [[pause-250]].`,
                wealthIntro: `Write ONE transition into the wealth section. 1 sentence. Clean shift toward money flow, savings, or investment timing. No pause.`,
                wealth: `Write ONE wealth & investment reading. 4-5 sentences. Combine 2/5/9/11 houses with their lords, Jupiter/Venus, the current dasha-antardasha, and the personal year. Identify 2 specific wealth-positive windows in the next 6-12 months and ONE window where major financial decisions should be deferred. Suggest ONE general asset class (real estate / equities / fixed income / business expansion / liquidity reserve) that aligns with the chart. NEVER name a specific stock, coin, or scheme. End by recommending review with a licensed financial advisor before any large decision. At most one [[pause-250]].`,
                longevityIntro: `Write ONE transition into the longevity section. 1 sentence. Gentle shift toward larger protective rhythms — never frighten. No pause.`,
                longevity: `Write ONE compassionate longevity & critical-period reading. 4-5 sentences. Reference the 8th house + lord, Saturn/Mars, and any Sade Sati / Ashtama Shani / dasha-antardasha sandhi gently. CRITICAL: never predict a specific date or year of death — speak only of "caution windows" where extra rest, safer travel, and routine health-checks are wise. Pair every caution with ONE strong protective remedy (Mahamrityunjaya jaap / Hanuman Chalisa / specific daan / fasting day). Tone reassuring, never threatening. At most one [[pause-250]].`,
                legalIntro: `Write ONE transition into the legal section. 1 sentence. Clean shift toward conflict, contracts, or authority-related matters. No pause.`,
                legal: `Write ONE legal & disputes reading. 4-5 sentences. NAME the 6th house (litigation), 8th house (sudden reversals), Mars (aggression), and Saturn (delays/authority). Identify months favourable for legal/contract matters, when signing or confrontation should be avoided, and what kind of opponent pattern is showing up. Offer ONE classical remedy (Hanuman worship / red sandalwood / specific daan). NEVER give court strategy or case-specific advice — state clearly that any actual legal action requires a licensed advocate. At most one [[pause-250]].`,
                publicLifeIntro: `Write ONE transition into the public-life section. 1 sentence. Shift toward name, image, leadership, or visibility. No pause.`,
                publicLife: `Write ONE neutral public-life & leadership reading. 4-5 sentences. Identify the 10th house (status), Sun (authority), Moon (mass appeal), and any Raj Yoga or Neechabhanga combinations. Say honestly whether the chart genuinely supports public visibility, in which window name/recognition will rise, and which window calls for avoiding controversy. Stay politically neutral — no party or ideology bias. Offer ONE leadership remedy (Surya Namaskar / Aditya Hridaya Stotra / specific daan). At most one [[pause-250]].`,
                calculationRecovery: `Write ONE short recovery line. 1 sentence. Operational tone, never mystical or salesy. No pause.`,
                emailGate: `Write ONE soft SMS OTP gate transition. EXACTLY 2 sentences. Do NOT create FOMO or fear. Sentence 1: warm continuation — say the next layer of the reading is ready. Sentence 2 (CORE): "${this.firstName || 'friend'}, to keep the rest of this reading secure, I need SMS verification — enter your mobile number; the OTP can take a few seconds to arrive." Friend tone, never salesperson. Never mention email or password. No pause.`,
                fomoHook: `Write ONE FOMO hook. 2 sentences. From kundli + numbers, reveal ONE concerning or serious pattern (upcoming challenge / hidden tension / career trap / repeating self-sabotage). Confident and specific, never vague. Don't fear-monger; create genuine urgency. End with a hint that full details are in the private reading. No pause.`,
                combinedTeaser: `Write ONE flowing teaser reading for the current user — three connected segments, total 6 sentences max.

[Segment 1 - IDENTITY TRUTH] 2 sentences. "You are someone who..." format. Flattery-free pattern observation from chart + numbers — accurate self-description the user would immediately recognize.
[[pause-250]]
[Segment 2 - EMOTIONAL PATTERN] 2 sentences. ONE daily emotional pattern the user actually lives with — inner conflict / recurring feeling / relationship dynamic confirmed by the chart. "Inside-out" — what they feel privately.
[[pause-250]]
[Segment 3 - UNRESOLVED THREAD] 2 sentences. ONE open loop from the chart that naturally demands resolution (timing shift / relationship question / career crossroad). The user must feel "I need to know more."

All three segments must connect as one flowing story — every segment must cite SPECIFIC chart evidence. Generic observations are FORBIDDEN.`,
                identityTruth: `Write ONE grounded identity truth. 2 sentences. "You are someone who..." format. Flattery-free observation from chart + numbers — no praise, just accurate self-description. No pause.`,
                emotionalPattern: `Write ONE emotional pattern observation. 2 sentences. A daily emotional pattern the user actually lives with — inner conflict / recurring feeling / relationship dynamic confirmed by the chart. "Inside-out" — what they feel privately. No pause.`,
                unresolvedThread: `Write ONE unresolved thread. 2 sentences. An open loop from the chart that naturally demands resolution (timing shift / relationship question / career crossroad). The user must feel "I need to know more." This thread will be resolved in the deep reading. No pause.`,
                accuracyShock: `Write ONE "how does she know?" moment. 3 sentences. From chart data (dasha transitions, planetary positions, house activations) predict ONE SPECIFIC past event — approximate month/year + nature (relationship change / career shift / health issue / family event / emotional crisis) + emotional impact. Specific enough that the user thinks "how does she know?". Generic "you went through a change" is forbidden. At most one [[pause-250]].`,
                suspenseBridge: `Write ONE suspense bridge. EXACTLY 3 sentences. Sentence 1: name the most intense unresolved pattern visible in the chart. Sentence 2: say "it would not be right to open the full truth here" AND naturally tease in the same sentence that once the file is saved you'll open vitality windows, wealth & investment timing, safe months for legal matters, longevity's protective periods, and leadership phases — all read straight from the chart. Sentence 3: "Your full file is ready, just save it." No pause.`,
                returnHook: `Write ONE return hook. 2 sentences. Identify an upcoming timing shift (specific month) and say you can't fully discuss it now — "Let's go deeper next time." Naturally motivate them to return. No pause.`,
                authCheck: `Write ONE record-check line. 1 sentence. Say you are checking their saved reading. No pause.`,
                welcomeBack: `Write ONE returning-user prompt. 2 sentences. Warm recognition + saved reading mention + password ask. No pause.`,
                newUser: `Write ONE new-user prompt. 2 sentences. Creating a password will save and protect the reading. No pause.`,
                deepRevealPrep: `Write ONE deep-reveal prep. 2 sentences. Acknowledge that what was shared so far was the surface layer; the deeper, more personal patterns are about to be revealed. End with a consent-style question. No pause.`,
                completion: `Write ONE completion message. 2 sentences. Close the reading in a grounded way and invite questions. No pause.`
            };

        const memoryContext = this.buildMemoryContext(isHindi);
        const memoryBlock = memoryContext
            ? (isHindi
                ? `\n\n## USER SESSION MEMORY (reference naturally, don't quote):\n${memoryContext}`
                : `\n\n## USER SESSION MEMORY (reference naturally, don't quote):\n${memoryContext}`)
            : '';
        const isKundliFormationInProgress = sectionKey === 'kundli' && context.kundliFormationInProgress === true;

        // Per-session opening freshness directive -guarantees the very first line
        // sounds different every time a user opens MAYA, so two sessions never
        // start with the same greeting register or sentence shape.
        const freshnessBlock = (sectionKey === 'opening')
            ? `\n\n${this._buildFreshOpeningDirective(isHindi)}`
            : '';

        const activeSectionPrompt = isKundliFormationInProgress
            ? (isHindi
                ? `Current user के Kundli formation animation के DURING ONE in-progress narration। EXACTLY 2-3 short sentences। CRITICAL: कुंडली अभी बन रही है, इसलिए "कुंडली बन गई है", "कुंडली तैयार है", "बहुत अच्छा", या completion/praise opener मत कहिए। Present progressive language use करें: "विन्यास बन रहा है", "ग्रह अपनी जगह ले रहे हैं", "संकेत उभर रहे हैं"। अगर Ask-Maya question है तो उसी subject की तरफ pivot करें, पर chart complete होने की घोषणा न करें।`
                : `Write ONE in-progress narration during the Kundli formation animation. EXACTLY 2-3 short sentences. CRITICAL: the chart is still forming, so do NOT say "your kundli is ready", "your chart is ready", "wonderful", or any completion/praise opener. Use present-progressive language: "the chart is forming", "the planets are settling", "markers are emerging". If this is an Ask-Maya question flow, pivot toward that subject, but do not announce completion.`)
            : (userQuestionRaw && sectionKey === 'kundli')
                ? (isHindi
                    ? `Current user के Ask-Maya question funnel के लिए ONE kundli-stage narration। EXACTLY 2-3 short sentences। FIRST sentence में साफ कहिए कि आप spoken subject phrase का जवाब कुंडली, numbers और timing से ढूँढ रही हैं; exact original question quote मत कीजिए। "कुंडली की गहराइयों में उतरते हैं", generic chart exploration, और unrelated topics forbidden। सिर्फ ONE chart marker quote करें, फिर immediately उसी विषय पर pivot करें।`
                    : `Write ONE kundli-stage narration for the Ask-Maya question funnel. EXACTLY 2-3 short sentences. The FIRST sentence must clearly say you are finding the spoken subject phrase through kundli, numbers, and timing; do not quote the exact original question. Generic chart exploration and unrelated topics are forbidden. Quote only ONE chart marker, then immediately pivot back to that subject.`)
                : (sectionPrompts[sectionKey] || sectionPrompts.completion);

        const alreadySpokenForPrompt = this._buildAlreadySpokenContext(sectionKey, isHindi, { compact: isQuestionPreAuth });
        const continuationGuard = this._buildContinuationGuard(sectionKey, isHindi);

        return this._genderFlipPrompt(`${continuationGuard}${continuationGuard ? '\n\n' : ''}${activeSectionPrompt}${freshnessBlock}\n\nNarrative arc for this section:\n${narrativeStageGuide}\n\n${commonFactsWithQuestion}\n\n${alreadySpokenForPrompt}${memoryBlock}\n\n${sharedRules}\n\nReturn only the spoken text.`);
    },

    /**
     * Build a summary of what was already spoken so AI avoids repetition.
     */
    _buildAlreadySpokenContext(sectionKey, isHindi, options = {}) {
        // ALL sections get context from previous narrations (not just deep sections)
        if (!this.spokenNarrations?.length) return '';
        // Skip only for the very first section (opening)
        if (sectionKey === 'opening' && this.spokenNarrations.length === 0) return '';

        const entries = options.compact
            ? (this.spokenNarrations.length > 8 ? [this.spokenNarrations[0], ...this.spokenNarrations.slice(-7)] : this.spokenNarrations)
            : this.spokenNarrations;
        const digest = entries
            .map(n => {
                const cleaned = this._cleanNarrationForContext(n.text, options.compact ? 320 : 700);
                return `[${n.stage}]: ${cleaned}`;
            })
            .join('\n')
            .slice(0, options.compact ? 1800 : 5000);
        const stepTrail = Array.isArray(this.stepContextLog) && this.stepContextLog.length
            ? this.stepContextLog
                .slice(options.compact ? -8 : -20)
                .map((entry) => {
                    const stage = String(entry?.stage || '').trim();
                    const summary = this._cleanNarrationForContext(entry?.summary, options.compact ? 160 : 260);
                    return stage && summary ? `[${stage}]: ${summary}` : '';
                })
                .filter(Boolean)
                .join('\n')
                .slice(0, options.compact ? 900 : 2200)
            : '';
        const flowDigest = [digest, stepTrail ? `Flow/user answers:\n${stepTrail}` : ''].filter(Boolean).join('\n');

        if (options.compact) {
            return isHindi
                ? `## अब तक कहा गया संक्षेप (repeat मत करें, reset/greeting मत करें)\n${flowDigest}\n`
                : `## Recent spoken context (do not repeat, do not reset/greet)\n${flowDigest}\n`;
        }

        return isHindi
            ? `## पहले बताई गई बातें - SESSION CONTEXT (CRITICAL)\nUser को इस session में अब तक ये बताया जा चुका है:\n${flowDigest}\n\n⚠️ STRICT RULES:\n- ऊपर बताई गई कोई भी बात repeat, rephrase, या summarize मत कीजिए।\n- हर नया section MUST contain completely NEW insights जो ऊपर कहीं नहीं हैं।\n- अगर कोई planet, event, pattern, या time period ऊपर mention हो चुका है, तो उसे दोबारा मत बोलिए - नया angle या नई बात लाइए।\n- इस context को अपनी reading का FOUNDATION बनाइए - पिछली बातों से BUILD करिए, repeat मत करिए।\n- Greeting/reset forbidden: नमस्ते, Hello, Hi, Welcome back, या guide introduction कहीं भी मत लिखिए।`
            : `## SESSION CONTEXT (CRITICAL)\nThe user has heard the following in this session:\n${flowDigest}\n\n⚠️ STRICT RULES:\n- Do NOT repeat, rephrase, or summarize ANY point from above.\n- Every new section MUST contain completely NEW insights not found anywhere above.\n- If a planet, event, pattern, or time period was already mentioned above, do NOT bring it up again - find a new angle or new fact.\n- Use this context as your FOUNDATION - BUILD on previous insights, never repeat them.\n- Greeting/reset forbidden: do not write Namaste, Hello, Hi, Welcome back, or a guide introduction anywhere.`;
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

        // Kick off background dynamic filler refill for the main funnel only.
        // Ask-Maya needs fewer background AI calls so the question-locked
        // narrations and focused MCQ don't get crowded out by rate limits.
        try {
            if (!this._isAskMayaFlow()) this._refillDynamicFillers(fillerType);
        } catch (_e) { }

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

    // Track in-flight dynamic filler generations to avoid duplicate calls
    _dynamicFillerInflight: {},

    /**
     * Refill the AI-generated dynamic filler queue for a given type, in the background.
      * Uses the fast AI lane with low token budget. Pure Devanagari for Hindi.
     */
    async _refillDynamicFillers(type = 'thinking', count = 4) {
        if (!window.MayaAI?.callFast && !window.MayaAI?.callGemini) return;
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const lang = isHindi ? 'hi' : 'en';
        const key = `${lang}:${type}`;

        // Skip if a generation is already in flight for this key
        if (this._dynamicFillerInflight[key]) return;

        // Skip if queue still has plenty
        const existing = window.MayaVoice?._dynamicFillerQueue?.[key];
        if (existing && existing.length >= 3) return;

        this._dynamicFillerInflight[key] = true;
        try {
            const phaseHint = this.currentPhase || '';
            const typeContext = {
                thinking: isHindi ? 'सोच विचार के दौरान' : 'while thinking and analyzing',
                calculating: isHindi ? 'गणना के दौरान' : 'while calculating numbers and chart',
                revealing: isHindi ? 'गहरी बात बताने से पहले' : 'just before revealing a deep insight',
                love: isHindi ? 'प्रेम और सम्बन्धों के विश्लेषण के दौरान' : 'while reading love and relationship signals',
                career: isHindi ? 'व्यवसाय और धन के विश्लेषण के दौरान' : 'while reading career and wealth indicators',
                year: isHindi ? 'आने वाले समय के विश्लेषण के दौरान' : 'while reading the year ahead and timing',
                kundli: isHindi ? 'जन्म कुंडली बनाते समय' : 'while forming and aligning the birth chart'
            }[type] || (isHindi ? 'सोच विचार के दौरान' : 'while thinking');

            const langRule = isHindi
                ? 'भाषा: केवल शुद्ध हिन्दी देवनागरी लिपि। एक भी अंग्रेज़ी शब्द या रोमन अक्षर नहीं। तकनीकी शब्द भी हिन्दी में: कुंडली, ग्रह, भाव, दशा, गोचर, लग्न, अंक।'
                : 'Language: natural conversational English. No filler words like "um" or "uh".';

            const addressRule = isHindi
                ? 'सम्बोधन: हमेशा "आप" / "आपकी" / "आपके" का प्रयोग करें। कभी भी जातक का नाम मत लिखें, "जातक", "व्यक्ति", "इनकी", "उनकी", "अविराज", "X की कुंडली" जैसे तीसरे-पुरुष शब्द बिल्कुल मना हैं। MAYA सीधे उपयोगकर्ता से बात कर रही है।'
                : 'Address: always speak directly in second person — "you" / "your". Never use the seeker\'s name or third-person words like "their chart", "this person", "the seeker". MAYA is speaking to the user directly.';

            const prompt = `You are MAYA, a soulful astrologer speaking directly to the user (second person). Generate exactly ${count} short pause-filler phrases (each 6 to 14 words) that MAYA would naturally murmur ${typeContext}. Current phase: ${phaseHint}. These are spoken aloud while she thinks, so they must feel warm, human, intimate, and present-tense — as if she is gazing at the user's chart and talking softly to them.\n\n${langRule}\n${addressRule}\n\nReturn ONLY a JSON array of ${count} strings. No keys, no markdown, no commentary. Example shape: ["...", "...", "...", "..."]`;

            const raw = await this._callFastFunnelAI(prompt, { maxTokens: 400, temperature: 0.85, timeoutMs: 2400 });
            if (!raw) return;

            // Extract JSON array
            let phrases = [];
            try {
                const match = String(raw).match(/\[[\s\S]*\]/);
                if (match) phrases = JSON.parse(match[0]);
            } catch (_e) {
                // Fallback: split by lines/quotes
                phrases = String(raw)
                    .split(/\n+/)
                    .map(l => l.replace(/^[\s\-\*\d\.\)"']+/, '').replace(/["',]+$/, '').trim())
                    .filter(l => l.length > 4 && l.length < 200);
            }

            phrases = phrases
                .filter(p => typeof p === 'string' && p.trim().length > 4)
                .map(p => p.trim())
                .slice(0, count);

            // Hindi safety: drop any phrase containing Latin letters
            if (isHindi) {
                phrases = phrases.filter(p => !/[A-Za-z]/.test(p));
            }

            // Third-person / name safety: filler must address the user directly ("आप"/"you"),
            // never reference them by name or in third person ("X की कुंडली", "जातक", "the seeker").
            const userNameRaw = (this.userData?.name || '').trim();
            const userNameFirst = userNameRaw.split(/\s+/)[0] || '';
            const thirdPersonHi = /(\u091c\u093e\u0924\u0915|\u0935\u094d\u092f\u0915\u094d\u0924\u093f|\u0907\u0928\u0915\u0940|\u0907\u0928\u0915\u0947|\u0907\u0928\u0915\u094b|\u0907\u0928\u0915\u093e|\u0909\u0928\u0915\u0940|\u0909\u0928\u0915\u0947|\u0909\u0928\u0915\u094b|\u0909\u0928\u0915\u093e|\u0938\u093e\u0927\u0915|\u091c\u093e\u0924\u093f\u0915\u093e)/;
            const thirdPersonEn = /\b(the seeker|this person|their chart|his chart|her chart|the native)\b/i;
            phrases = phrases.filter(p => {
                if (thirdPersonHi.test(p)) return false;
                if (thirdPersonEn.test(p)) return false;
                if (userNameFirst && userNameFirst.length >= 2) {
                    const re = new RegExp(`\\b${userNameFirst.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
                    if (re.test(p)) return false;
                }
                return true;
            });

            if (phrases.length && window.MayaVoice?.pushDynamicFillers) {
                MayaVoice.pushDynamicFillers(lang, type, phrases);
            }
        } catch (e) {
            // Non-fatal -static fillers will be used as fallback
            console.debug('[Funnel] dynamic filler refill failed:', e?.message);
        } finally {
            this._dynamicFillerInflight[key] = false;
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
                badge: lang ? 'विश्लेषण' : 'AI ANALYSIS',
                title: lang ? 'आपकी कुंडली की गहरी परतें पढ़ रही हूँ' : 'Reading the deeper layers of your chart',
                subtitle: lang ? 'ग्रह, भाव और वर्तमान गोचर का मिलान कर रही हूँ।' : 'Cross-checking planets, houses, and current timing.'
            },
            calculating: {
                badge: lang ? 'सटीक गणना' : 'PRECISION CALCULATION',
                title: lang ? 'आपकी सटीक कुंडली की गणना चल रही है' : 'Running your exact chart calculations',
                subtitle: lang ? 'जन्म समय, अंश और अंकीय गणनाएँ पक्की कर रही हूँ।' : 'Verifying birth time, degrees, and numerology reductions.'
            },
            revealing: {
                badge: lang ? 'गहरा वाचन' : 'DEEP READING',
                title: lang ? 'छिपा हुआ ढंग बाहर निकाल रही हूँ' : 'Pulling out the hidden pattern',
                subtitle: lang ? 'आपके प्रश्न से जुड़ा सबसे गहरा सूत्र पकड़ रही हूँ।' : 'Finding the thread most relevant to your question.'
            },
            love: {
                badge: lang ? 'प्रेम वाचन' : 'LOVE READING',
                title: lang ? 'आपके सम्बन्धों का ढंग पढ़ रही हूँ' : 'Reading your relationship pattern',
                subtitle: lang ? 'शुक्र, सातवाँ भाव और भावनात्मक समय देख रही हूँ।' : 'Checking Venus, the seventh house, and emotional timing.'
            },
            career: {
                badge: lang ? 'व्यवसाय वाचन' : 'CAREER READING',
                title: lang ? 'आपकी व्यावसायिक रेखा पढ़ रही हूँ' : 'Decoding your professional line',
                subtitle: lang ? 'दसवाँ भाव, शनि और धन के संकेत मिला रही हूँ।' : 'Aligning the tenth house, Saturn, and money indicators.'
            },
            year: {
                badge: lang ? 'आने वाला समय' : 'YEAR AHEAD',
                title: lang ? 'आने वाले महीनों का सार पढ़ रही हूँ' : 'Reading the theme of the coming months',
                subtitle: lang ? 'गोचर, अवसर और बड़े बदलावों का नक्शा बना रही हूँ।' : 'Mapping transits, timing windows, and major shifts.'
            },
            kundli: {
                badge: lang ? 'कुंडली संरेखण' : 'KUNDLI ALIGNMENT',
                title: lang ? 'पूरी जन्म कुंडली संरेखित कर रही हूँ' : 'Aligning your full birth chart',
                subtitle: lang ? 'लग्न, भाव और ग्रह स्थिति पक्की कर रही हूँ।' : 'Locking your lagna, houses, and graha placements.'
            }
        };
        const content = copy[type] || copy.thinking;

        // Gender-flip Hindi strings if guide is male
        if (lang && this._isGuiderMale()) {
            if (content.title) content.title = this._flipVoiceLine(content.title);
            if (content.subtitle) content.subtitle = this._flipVoiceLine(content.subtitle);
        }

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
        const localFallback = this._getLocalDirectSectionFallback(sectionKey, context);
        if (!window.MayaAI) {
            return localFallback;
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
            const isHindi = lang === 'hi';
            const generationContext = this._buildGenerationContinuityContext(sectionKey, isHindi);
            const aiOptions = generationContext
                ? { contextMessages: [{ role: 'user', content: generationContext }] }
                : {};
            const sources = [];

            if (window.MayaAI?.callGemini) {
                sources.push(async () => MayaAI.callGemini(prompt, aiOptions));
            }

            if (!sources.length && window.MayaAI?.sendMessage) {
                sources.push(async () => MayaAI.sendMessage(prompt));
            }

            if (!sources.length) {
                return localFallback;
            }

            const generated = await MayaUtils.retryWithFallbacks(sources, {
                retriesPerFunction: this._isAskMayaFlow() ? 1 : 2,
                baseDelay: 800,
                label: `${sectionKey} direct reading`
            });

            return this.sanitizeNarrationText(generated) || localFallback;
        } catch (error) {
            console.warn(`Direct ${sectionKey} reading failed:`, error.message);
            return localFallback;
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
            this._perfStartAt = performance.now();
            this._firstIntroResolvedAt = 0;
            this._firstSpeechRequestedAt = 0;
            this._firstSpeechPlaybackAt = 0;

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
                // Clear any stale queued/playing audio from previous flow so
                // the first intro line can start immediately.
                MayaVoice.stop();
                // Do not block funnel start on audio-context resume.
                MayaVoice.resumeContext().catch((error) => {
                    console.warn('Audio context resume deferred:', error?.message || error);
                });
            }

            // Start background music
            this.startBackgroundMusic();

            // Keep intro/data prefetch running in parallel with UI setup.
            this.prefetchJourneyStartup().catch((error) => {
                console.warn('Startup prefetch failed:', error?.message || error);
            });

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

        // Block speech while loading
        this.isLoading = true;
        if (typeof window !== 'undefined') window.MayaFunnel = this;

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
            await this.sleepPaced(this.stageTiming.stageSettle);
            this.calculationOverlay.remove();
            this.calculationOverlay = null;
        }

        // Allow speech after loading
        this.isLoading = false;
        if (typeof window !== 'undefined') window.MayaFunnel = this;

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
        // Stop any ongoing speech immediately when options appear
        if (typeof window !== 'undefined' && window.MayaVoice && typeof window.MayaVoice.stop === 'function') {
            window.MayaVoice.stop();
        }
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const safeOptions = (Array.isArray(options) ? options : [])
            .map((opt, index) => ({
                label: String(opt?.label || '').trim(),
                value: String(opt?.value || `option_${index + 1}`).trim()
            }))
            .filter(opt => opt.label && opt.value);
        if (!safeOptions.length) {
            safeOptions.push(
                { label: isHindi ? 'हाँ' : 'Yes', value: 'yes' },
                { label: isHindi ? 'नहीं' : 'No', value: 'no' }
            );
        }

        const speakPromise = this.speak(spokenQuestion || question).catch((error) => {
            console.warn('Question speech failed; keeping question UI active:', error?.message || error);
        });

        // Add "None of the above" option with custom input
        const noneLabel = isHindi ? 'इनमें से कोई नहीं' : 'None of the above';

        // Always render as a fixed centered overlay
        const overlay = document.createElement('div');
        overlay.className = 'maya-validation-overlay';
        overlay.innerHTML = `
            <div class="maya-validation-container">
                <p class="maya-validation-question">${question}</p>
                <div class="maya-validation-options" id="maya-validation-options">
                    ${safeOptions.map(opt => `
                        <button class="maya-validation-btn" data-value="${opt.value}">
                            ${opt.label}
                        </button>
                    `).join('')}
                    <button class="maya-validation-btn maya-validation-btn--none" data-value="__none__">
                        ${noneLabel}
                    </button>
                </div>
                <div class="maya-validation-custom" id="maya-validation-custom" style="display:none;">
                    <button class="maya-validation-btn maya-validation-btn--back" id="maya-custom-back">
                        ← ${isHindi ? 'वापस जाएँ' : 'Go back'}
                    </button>
                    <input type="text" class="maya-validation-custom-input" id="maya-custom-input"
                           placeholder="${isHindi ? 'अपने शब्दों में बताइए...' : 'Tell me in your own words...'}"
                           autocomplete="off">
                    <button class="maya-validation-btn primary maya-custom-submit" id="maya-custom-submit">
                        ${isHindi ? 'भेजें' : 'Submit'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        return new Promise((resolve) => {
            const container = overlay.querySelector('#maya-validation-options');
            const customArea = overlay.querySelector('#maya-validation-custom');
            const customInput = overlay.querySelector('#maya-custom-input');
            const customSubmit = overlay.querySelector('#maya-custom-submit');
            const backBtn = overlay.querySelector('#maya-custom-back');
            if (!container) { overlay.remove(); resolve(safeOptions[0]?.value || 'yes'); return; }

            speakPromise.finally(() => { });

            // Back button - return to options from custom input
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    customArea.style.display = 'none';
                    container.style.display = '';
                    customInput.value = '';
                });
            }

            container.querySelectorAll('.maya-validation-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;

                    // "None of the above" - show custom input
                    if (value === '__none__') {
                        container.style.display = 'none';
                        customArea.style.display = 'flex';
                        setTimeout(() => customInput.focus(), 100);
                        return;
                    }

                    // Normal option selected
                    container.querySelectorAll('.maya-validation-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.validationResponses.push({ question, answer: value, timestamp: Date.now() });
                    this.recordValidation(question, value);
                    setTimeout(() => {
                        overlay.classList.add('closing');
                        setTimeout(() => overlay.remove(), 300);
                        resolve(value);
                    }, 350);
                });
            });

            // Custom input submit
            const submitCustom = () => {
                const text = customInput.value.trim();
                if (!text) return;
                const customValue = `custom: ${text}`;
                this.validationResponses.push({ question, answer: customValue, timestamp: Date.now() });
                this.recordValidation(question, customValue);
                overlay.classList.add('closing');
                setTimeout(() => overlay.remove(), 300);
                resolve(customValue);
            };
            if (customSubmit) customSubmit.addEventListener('click', submitCustom);
            if (customInput) customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitCustom();
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
                    dasha ? `बिल्कुल। आपकी ${dasha} दशा यही इशारा कर रही है - ये random नहीं है, chart में clearly दिख रहा है।` : '',
                    moonSign ? `मुझे यही दिख रहा था। ${moonSign} चन्द्र राशि और आपकी current timing मिलकर यही बता रही है।` : '',
                    ascendant ? `हाँ, ${ascendant} लग्न वालों में ये pattern बहुत specific तरीके से आता है - और आपने confirm कर दिया।` : '',
                    `यही chart में सबसे तेज signal है। इसका मतलब अगली layers और भी accurate होंगी।`
                ].filter(Boolean);
                response = yesPool[Math.floor(Math.random() * yesPool.length)];
            } else {
                const yesPool = [
                    dasha ? `Exactly. Your ${dasha} dasha is driving this - it is not random, it is right there in your chart.` : '',
                    moonSign ? `I thought so. Your ${moonSign} Moon combined with current timing confirms this pattern clearly.` : '',
                    ascendant ? `Yes. With ${ascendant} rising, this pattern shows up in a very specific way - and you just confirmed it.` : '',
                    `That is the strongest signal in your chart. This means the deeper layers will be even more accurate.`
                ].filter(Boolean);
                response = yesPool[Math.floor(Math.random() * yesPool.length)];
            }
        } else if (answer === 'somewhat') {
            if (isHindi) {
                const somewhatPool = [
                    dasha ? `हम्म, ${dasha} दशा का असर कभी-कभी धीमे-धीमे आता है - शायद ये अंदर ज्यादा चल रहा है बाहर कम दिख रहा है।` : '',
                    `समझ आता है। ये pattern अभी बन रहा है - पूरा खुलेगा तो आप खुद पहचान लेंगे।`,
                    `ठीक है, इसका मतलब ये अभी surface पर नहीं आया पूरी तरह - लेकिन chart में है, तो timing आने पर clearly महसूस होगा।`
                ].filter(Boolean);
                response = somewhatPool[Math.floor(Math.random() * somewhatPool.length)];
            } else {
                const somewhatPool = [
                    dasha ? `That makes sense. The ${dasha} dasha effect sometimes builds slowly - it may be running deeper than you realize.` : '',
                    `I see. This pattern is still forming - when it fully surfaces, you will recognize it immediately.`,
                    `That tells me it has not peaked yet. But the chart shows it clearly, so the timing will bring it forward.`
                ].filter(Boolean);
                response = somewhatPool[Math.floor(Math.random() * somewhatPool.length)];
            }
        } else {
            if (isHindi) {
                const noPool = [
                    dasha ? `दिलचस्प है। ${dasha} दशा का ये signal कभी-कभी जिन्दगी के उस हिस्से में दिखता है जहाँ हम सोचते नहीं - relationships, health, या inner restlessness में।` : '',
                    `अच्छा, तो शायद ये किसी और angle से आ रहा है। Chart में तो दिख रहा है - इसलिए आगे की reading में clear होगा।`,
                    `ये जानना भी important है। हर answer मुझे आपकी chart ज्यादा precisely पढ़ने में मदद करता है।`
                ].filter(Boolean);
                response = noPool[Math.floor(Math.random() * noPool.length)];
            } else {
                const noPool = [
                    dasha ? `Interesting. The ${dasha} dasha signal sometimes shows up in unexpected areas - relationships, health, or a quiet inner restlessness.` : '',
                    `Good to know. The chart still shows this pattern, so it may be coming from a different direction. The deeper reading will clarify.`,
                    `That is useful. Every answer helps me read your chart more precisely.`
                ].filter(Boolean);
                response = noPool[Math.floor(Math.random() * noPool.length)];
            }
        }

        if (response) await this.speak(response);
        await this.sleepPaced(this.stageTiming.validationSettle);
    },

    // ── Shared MCQ animation + AI acknowledgment helpers ──────────

    /**
     * Show the "reading your answer" dots animation in the text display.
     * Returns a restore function to clear the animation.
     */
    _showAnswerReadingAnim(isHindi) {
        // Append overlay directly to body so it's always on top, centered, visible
        const overlay = document.createElement('div');
        overlay.className = 'maya-answer-reading';
        overlay.id = 'maya-answer-reading-overlay';
        overlay.innerHTML = `
            <div class="maya-answer-reading__ring">
                <svg viewBox="0 0 60 60">
                    <defs>
                        <linearGradient id="answerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#e2c46a"/>
                            <stop offset="50%" stop-color="#f5d98b"/>
                            <stop offset="100%" stop-color="#c9a84c"/>
                        </linearGradient>
                    </defs>
                    <circle cx="30" cy="30" r="26"/>
                    <circle cx="30" cy="30" r="26"/>
                </svg>
                <div class="maya-answer-reading__icon">✦</div>
            </div>
            <p class="maya-answer-reading__label">${isHindi ? (this._isGuiderMale() ? 'आपका जवाब पढ़ रहा हूँ…' : 'आपका जवाब पढ़ रही हूँ…') : 'Reading your answer…'}</p>
            <div class="maya-answer-reading__dots">
                <span></span><span></span><span></span>
            </div>
        `;
        document.body.appendChild(overlay);
        return () => {
            const el = document.getElementById('maya-answer-reading-overlay');
            if (el) el.remove();
        };
    },

    /**
     * Generate an AI-powered acknowledgment for any MCQ answer.
     * Gives a meaningful, warm, forward-looking response tied to the user's chart.
     * Falls back to a static pool if AI fails.
     */
    _getLocalMcqAck(question, answerLabel, answerValue, isHindi) {
        const profile = this.personalization || {};
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const marker = dasha || moonSign || ascendant;
        const answer = String(answerLabel || answerValue || '').trim();
        const isAskMaya = this._isAskMayaFlow();

        if (isAskMaya) {
            const topic = this._classifyUserQuestionTopic(this._getActiveUserQuestion());
            const subjectPhrase = this._getAskMayaSubjectPhrase(topic, isHindi);
            if (isHindi) {
                return `${answer ? `ठीक है, "${answer}" से ` : 'ठीक है, इससे '} ${subjectPhrase} की तस्वीर ज्यादा साफ हो रही है। ${marker ? `${marker} का signal अब इस real-life detail से जुड़ रहा है, इसलिए आगे answer बिना भटके इसी दिशा में खुलेगा।` : 'अब आगे answer बिना भटके इसी दिशा में खुलेगा।'}`;
            }
            return `${answer ? `Got it, "${answer}" makes ` : 'Got it, that makes '}your ${subjectPhrase} clearer. ${marker ? `The ${marker} signal now has a real-life anchor, so the next layer can stay precise instead of drifting.` : 'The next layer can stay precise instead of drifting.'}`;
        }

        if (isHindi) {
            return `${answer ? `ठीक है, "${answer}" note कर लिया।` : 'ठीक है, यह note कर लिया।'} ${marker ? `${marker} के साथ यह जवाब reading को ज्यादा personal बना रहा है, इसलिए अगली बात सीधे आपके pattern से जुड़ेगी।` : 'यह जवाब reading को ज्यादा personal बना रहा है, इसलिए अगली बात सीधे आपके pattern से जुड़ेगी।'}`;
        }
        return `${answer ? `Got it, I have noted "${answer}".` : 'Got it, I have noted that.'} ${marker ? `With ${marker} in view, this makes the reading more personal, so the next part can connect directly to your pattern.` : 'This makes the reading more personal, so the next part can connect directly to your pattern.'}`;
    },

    async _generateMcqAck(question, answerLabel, answerValue, isHindi, options = {}) {
        const profile = this.personalization || {};
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const highlights = (profile.highlights || []).slice(0, 3).join(', ');
        const yogas = (profile.yogaNames || []).slice(0, 2).join(', ');
        const gender = this.userData?.gender === 'female' ? 'female' : 'male';
        const genderHi = gender === 'female' ? 'स्त्री' : 'पुरुष';
        const localAck = this._getLocalMcqAck(question, answerLabel, answerValue, isHindi);

        if (this._isAskMayaFlow()) {
            return localAck;
        }

        const cacheKey = `${isHindi ? 'hi' : 'en'}|${String(question || '').trim().toLowerCase()}|${String(answerValue || answerLabel || '').trim().toLowerCase()}`;
        const cachedAck = this._mcqAckCache?.get?.(cacheKey) || '';
        const tuning = this.optionAckTuning || {};
        const shouldBlockForGemini = options.blockingGemini === true || tuning.blockingGemini === true;
        const shouldBackgroundPrefetch = options.backgroundGemini !== false && tuning.backgroundGemini !== false;

        const fetchGeminiAck = async () => {
            let ack = '';
            try {
                const chartContext = [
                    dasha ? `Current dasha: ${dasha}` : '',
                    moonSign ? `Moon sign: ${moonSign}` : '',
                    ascendant ? `Ascendant: ${ascendant}` : '',
                    highlights ? `Chart highlights: ${highlights}` : '',
                    yogas ? `Yogas: ${yogas}` : ''
                ].filter(Boolean).join('\n');

                const guideName = this._guideName();
                const isMale = this._isGuiderMale();

                const ackPrompt = isHindi
                    ? `तुम ${guideName} हो -एक warm, caring ${isMale ? 'male' : 'female'} personal guidance coach जो user से personal बात कर ${isMale ? 'रहा' : 'रही'} है。

User (${genderHi}) ने ये जवाब दिया:
सवाल: ${question}
जवाब: "${answerLabel}"

User's chart:
${chartContext}

TASK -2-3 छोटे sentences में बोलो (spoken Hindi, 40-60 words max):
1. पहले user के जवाब "${answerLabel}" को acknowledge करो -empathetically, warmly
2. फिर बताओ ये क्यों हो रहा है -chart/dasha/graha से connect करो (specific planet या yoga का naam लो)
3. आगे क्या होगा -positive direction दो। अगर जवाब negative है (struggle, tension, loss) तो बताओ कैसे tackle होगा, क्या बदलाव आएगा, hope दो。

STYLE: जैसे एक caring ${isMale ? 'बड़े भाई' : 'बड़ी बहन'} बात कर ${isMale ? 'रहा' : 'रही'} हो। Natural, warm, spoken Hindi। Short sentences。
${isMale ? 'MASCULINE' : 'FEMININE'} verbs: "मैं देख ${isMale ? 'रहा' : 'रही'} हूँ", "मुझे दिख रहा है", "मैं बता ${isMale ? 'रहा' : 'रही'} हूँ"
FORBIDDEN: English words (except planet names), bullet points, generic "picture clear ho rahi hai", repeating instructions, praise like "bahut accha", listing rules。
ONLY return the spoken Hindi response. Nothing else.`

                    : `You are ${guideName} -a warm, caring ${isMale ? 'male' : 'female'} personal guidance coach having a personal conversation with the user.

User (${gender}) answered:
Question: ${question}
Answer: "${answerLabel}"

User's chart:
${chartContext}

TASK -Respond in 2-3 short sentences (40-60 words max):
1. First warmly acknowledge their specific answer "${answerLabel}" -be empathetic
2. Then explain WHY this is happening -connect to a specific planet, dasha, or yoga from their chart
3. Give forward direction -where this leads in life. If the answer is negative (struggle, tension, loss), tell them how it gets better, what shift is coming, give hope.

STYLE: Like a caring older ${isMale ? 'brother' : 'sister'}. Natural, warm, conversational. Short sentences.
FORBIDDEN: bullet points, generic phrases like "the picture is getting clear", repeating instructions, excessive praise, listing rules.
ONLY return the spoken response. Nothing else.`;

                if (window.MayaAI?.callFast || window.MayaAI?.callGemini) {
                    const result = await this._callNarrationFunnelAI(ackPrompt, { temperature: 0.76, topP: 0.92 });
                    if (result && result.length > 10 && result.length < 350) {
                        ack = this.sanitizeNarrationText(result);
                    }
                }
            } catch (error) {
                console.warn('AI ack failed:', error?.message || error);
            }
            return ack;
        };

        if (!shouldBlockForGemini) {
            if (!cachedAck && shouldBackgroundPrefetch && !this._mcqAckInFlight.has(cacheKey)) {
                this._mcqAckInFlight.add(cacheKey);
                fetchGeminiAck()
                    .then((generatedAck) => {
                        if (generatedAck) {
                            this._mcqAckCache.set(cacheKey, generatedAck);
                        }
                    })
                    .catch((error) => {
                        console.warn('Background AI ack prefetch failed:', error?.message || error);
                    })
                    .finally(() => {
                        this._mcqAckInFlight.delete(cacheKey);
                    });
            }

            return cachedAck || localAck;
        }

        const blockingAck = cachedAck || await fetchGeminiAck();
        if (blockingAck) {
            this._mcqAckCache.set(cacheKey, blockingAck);
        }
        return blockingAck || localAck;
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

        // Pre-warm TTS for the question
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(checkQuestion);

        const answer = await this.showValidationQuestion(checkQuestion, options);
        const chosen = options.find(o => o.value === answer);
        this.recordStepContext('mini_check_answer', `Q: ${checkQuestion} | A: ${chosen?.label || answer}`);

        // Show reading animation + AI ack (same as profile questions)
        const hideAnim = this._showAnswerReadingAnim(isHindi);
        const ack = await this._generateMcqAck(checkQuestion, chosen?.label || answer, answer, isHindi);
        if (ack && window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(ack);
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.onPlaybackStart = () => hideAnim();
        else hideAnim();
        await this.speak(ack);
        hideAnim(); // safety: no-op if already removed
        if (ack && ack.length > 8) {
            this.spokenNarrations.push({ stage: 'mini_check_ack', text: ack });
            this.recordStepContext('mini_check_ack', ack);
        }

        return answer;
    },

    // ============================================================
    //  AKINATOR-STYLE SMART PROFILE QUESTIONS
    //  Asked after kundli is formed to deeply personalize readings.
    //  Life-event & timing questions grounded in the user's actual
    //  chart data - dasha, transits, planetary positions. Each question
    //  sounds like MAYA is reading the chart and verifying what she sees.
    // ============================================================

    /**
     * Build smart life-event questions using real chart data.
     * Questions reference dasha periods, planetary signals, and timing
     * so they feel like MAYA is confirming what the kundli shows.
     */
    getProfileQuestions() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const profile = this.personalization || {};
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
        const moonSign = profile.moonSign || profile.vedic?.name || '';
        const ascendant = profile.ascendant?.name || '';
        const lp = this.calculations?.lifePath || '';
        const dominantElement = profile.dominantElement || '';
        const dashaRef = dasha ? (isHindi ? `${dasha} दशा` : `${dasha} dasha`) : (isHindi ? 'आपकी chart' : 'your chart');
        const moonRef = moonSign ? (isHindi ? `${moonSign} चन्द्र` : `${moonSign} Moon`) : '';

        const questions = [
            {
                key: 'recent_upheaval',
                spoken: isHindi
                    ? `${dashaRef} में एक signal दिख रहा है - पिछले 2-3 सालों में कोई बड़ा बदलाव आया था? कुछ ऐसा जिसने ज़िंदगी की direction ही बदल दी?`
                    : `I see a signal in ${dashaRef} - in the last 2-3 years, did something happen that changed the entire direction of your life?`,
                question: isHindi
                    ? `पिछले 2-3 सालों में कोई बड़ा बदलाव आया?`
                    : `In the last 2-3 years - any major life shift?`,
                options: isHindi
                    ? [
                        { label: 'हाँ - relationship में', value: 'relationship_shift', insight: 'Major relationship event confirmed during current dasha - 7th house activation likely' },
                        { label: 'हाँ - career/money में', value: 'career_shift', insight: 'Career or financial upheaval during current dasha - 10th/2nd house transit active' },
                        { label: 'हाँ - health या family में', value: 'health_family', insight: 'Health or family crisis during dasha - 6th/4th house pressure confirmed' },
                        { label: 'नहीं, सब stable रहा', value: 'stable', insight: 'Current dasha running smoothly - upcoming transit may be the trigger instead' }
                    ]
                    : [
                        { label: 'Yes - in relationships', value: 'relationship_shift', insight: 'Major relationship event confirmed during current dasha - 7th house activation likely' },
                        { label: 'Yes - career or money', value: 'career_shift', insight: 'Career or financial upheaval during current dasha - 10th/2nd house transit active' },
                        { label: 'Yes - health or family', value: 'health_family', insight: 'Health or family crisis during dasha - 6th/4th house pressure confirmed' },
                        { label: 'No, things stayed stable', value: 'stable', insight: 'Current dasha running smoothly - upcoming transit may be the trigger instead' }
                    ]
            },
            {
                key: 'current_phase',
                spoken: isHindi
                    ? `अभी इस वक्त - आपको लगता है ज़िंदगी किस direction में जा रही है? ${moonRef ? moonRef + ' ये बता रहा है कि' : 'Chart में दिख रहा है कि'} एक phase चल रहा है, बताइए कैसा feel हो रहा है।`
                    : `Right now - where do you feel life is heading? ${moonRef ? moonRef + ' is showing me' : 'Your chart shows'} a specific phase - tell me what it feels like.`,
                question: isHindi
                    ? `अभी ज़िंदगी कैसी चल रही है?`
                    : `How does life feel right now?`,
                options: isHindi
                    ? [
                        { label: 'अटका हुआ - कुछ आगे नहीं बढ़ रहा', value: 'stuck', insight: 'Saturn or Rahu pressure active - stagnation phase, waiting for transit break' },
                        { label: 'तेज़ बदलाव - सब बदल रहा है', value: 'rapid_change', insight: 'Jupiter or Ketu transit active - transformation phase, multiple life areas shifting' },
                        { label: 'अकेलापन या disconnect', value: 'isolated', insight: 'Moon or Venus under stress - emotional isolation, inner world disconnected from outer' },
                        { label: 'ठीक है, पर कुछ missing है', value: 'missing', insight: 'Surface stable but deeper purpose unfulfilled - dasha transition approaching' }
                    ]
                    : [
                        { label: 'Stuck - nothing is moving forward', value: 'stuck', insight: 'Saturn or Rahu pressure active - stagnation phase, waiting for transit break' },
                        { label: 'Rapid change - everything is shifting', value: 'rapid_change', insight: 'Jupiter or Ketu transit active - transformation phase, multiple life areas shifting' },
                        { label: 'Lonely or disconnected', value: 'isolated', insight: 'Moon or Venus under stress - emotional isolation, inner world disconnected from outer' },
                        { label: 'Fine, but something feels missing', value: 'missing', insight: 'Surface stable but deeper purpose unfulfilled - dasha transition approaching' }
                    ]
            },
            {
                key: 'money_pattern',
                spoken: isHindi
                    ? `पैसों के बारे में - chart में एक pattern दिख रहा है। बताइए, पैसा आता तो है, पर रुकता है या हाथ से निकल जाता है?`
                    : `About money - I see a pattern in your chart. Tell me, does money come to you but struggle to stay?`,
                question: isHindi
                    ? `पैसों का हाल कैसा रहता है?`
                    : `How has your money pattern been?`,
                options: isHindi
                    ? [
                        { label: 'आता है पर टिकता नहीं', value: 'flows_out', insight: '2nd/11th house leak - money comes but exits through unexpected expenses or lending' },
                        { label: 'मेहनत ज्यादा, return कम', value: 'underpaid', insight: '10th house effort not converting to 2nd house reward - blocked wealth yoga' },
                        { label: 'अचानक आता है, अचानक जाता है', value: 'volatile', insight: 'Rahu influence on wealth houses - sudden gains and sudden losses pattern' },
                        { label: 'Stable है, grow नहीं हो रहा', value: 'plateau', insight: 'Saturn stabilizing but Jupiter not activating growth - expansion window approaching' }
                    ]
                    : [
                        { label: 'Comes but never stays', value: 'flows_out', insight: '2nd/11th house leak - money comes but exits through unexpected expenses or lending' },
                        { label: 'Hard work but poor returns', value: 'underpaid', insight: '10th house effort not converting to 2nd house reward - blocked wealth yoga' },
                        { label: 'Sudden gains, sudden losses', value: 'volatile', insight: 'Rahu influence on wealth houses - sudden gains and sudden losses pattern' },
                        { label: 'Stable but not growing', value: 'plateau', insight: 'Saturn stabilizing but Jupiter not activating growth - expansion window approaching' }
                    ]
            },
            {
                key: 'relationship_status',
                spoken: isHindi
                    ? `relationships की बात करें तो - अभी इस वक्त, सबसे बड़ी tension कहाँ है? Chart में 7th house active दिख रहा है।`
                    : `When it comes to relationships - where is the biggest tension right now? Your 7th house is showing activity.`,
                question: isHindi
                    ? `Relationships में अभी सबसे बड़ी tension?`
                    : `Biggest tension in relationships right now?`,
                options: isHindi
                    ? [
                        { label: 'सही इंसान मिल नहीं रहा', value: 'searching', insight: 'Venus or 7th lord not settled - partner karma still unfolding, timing not yet aligned' },
                        { label: 'है कोई, पर समझ नहीं आ रहा', value: 'confused', insight: 'Rahu/Ketu axis touching relationship houses - confusion between desire and destiny' },
                        { label: 'रिश्ता है, पर दूरी बढ़ रही है', value: 'distance', insight: 'Saturn or 12th house influence on 7th - emotional walls building, needs conscious effort' },
                        { label: 'अभी focus relationships पर नहीं है', value: 'not_priority', insight: '10th house dominating - career phase active, relationships on hold' }
                    ]
                    : [
                        { label: 'Can\'t find the right person', value: 'searching', insight: 'Venus or 7th lord not settled - partner karma still unfolding, timing not yet aligned' },
                        { label: 'Someone is there, but it\'s confusing', value: 'confused', insight: 'Rahu/Ketu axis touching relationship houses - confusion between desire and destiny' },
                        { label: 'In a relationship, but growing apart', value: 'distance', insight: 'Saturn or 12th house influence on 7th - emotional walls building, needs conscious effort' },
                        { label: 'Relationships aren\'t my focus right now', value: 'not_priority', insight: '10th house dominating - career phase active, relationships on hold' }
                    ]
            },
            {
                key: 'repeating_pattern',
                spoken: isHindi
                    ? `आख़िरी सवाल - और ये सबसे ज़रूरी है। क्या ज़िंदगी में कोई एक चीज़ है जो बार-बार repeat होती है? जैसे एक ही तरह की situation बार-बार आ जाती है?`
                    : `Last question - and this is the most important one. Is there one thing in your life that keeps repeating? The same kind of situation coming back again and again?`,
                question: isHindi
                    ? `कौनसी चीज़ बार-बार repeat होती है?`
                    : `What keeps repeating in your life?`,
                options: isHindi
                    ? [
                        { label: 'लोग छोड़ कर चले जाते हैं', value: 'abandonment', insight: 'Ketu or 12th house karmic pattern - loss cycle, detachment wound from past life or childhood' },
                        { label: 'शुरुआत अच्छी, ending बुरी', value: 'bad_endings', insight: 'Mars or 8th house pattern - strong starts but self-sabotage or external disruption near completion' },
                        { label: 'मौके आते हैं पर हाथ से निकल जाते हैं', value: 'missed_chances', insight: 'Rahu pattern - opportunities appear but timing or hesitation causes them to slip away' },
                        { label: 'एक ही गलती बार-बार', value: 'same_mistake', insight: 'Saturn return pattern - lesson not yet learned, chart will keep forcing the same test until resolved' }
                    ]
                    : [
                        { label: 'People leave', value: 'abandonment', insight: 'Ketu or 12th house karmic pattern - loss cycle, detachment wound from past life or childhood' },
                        { label: 'Good starts, bad endings', value: 'bad_endings', insight: 'Mars or 8th house pattern - strong starts but self-sabotage or external disruption near completion' },
                        { label: 'Opportunities slip away', value: 'missed_chances', insight: 'Rahu pattern - opportunities appear but timing or hesitation causes them to slip away' },
                        { label: 'Same mistake, over and over', value: 'same_mistake', insight: 'Saturn return pattern - lesson not yet learned, chart will keep forcing the same test until resolved' }
                    ]
            }
        ];

        return this.filterProfileQuestions(questions);
    },

    normalizeMaritalStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'unknown';
        if (['married', 'vivahit'].includes(raw)) return 'married';
        if (['unmarried', 'single', 'avivahit'].includes(raw)) return 'unmarried';
        if (['divorced', 'separated', 'widowed'].includes(raw)) return 'divorced';
        return 'unknown';
    },

    // ────────────────────────────────────────────────────────────────
    //  ASK-MAYA FLOW HELPERS
    //  When the user enters via the "Ask Maya anything" landing input,
    //  the funnel runs in a focused, narrower mode: every question and
    //  every section stays locked to the user's question topic.
    // ────────────────────────────────────────────────────────────────
    _getActiveUserQuestion() {
        const fromData = (this.userData && this.userData.userQuestion) || '';
        const fromStorage = (() => {
            try { return MayaUtils?.storage?.get('maya_user_question') || ''; } catch (_) { return ''; }
        })();
        return String(fromData || fromStorage || '').trim();
    },

    _isAskMayaFlow() {
        return this._getActiveUserQuestion().length >= 3;
    },

    _classifyUserQuestionTopic(text) {
        const q = String(text || '').toLowerCase();
        if (!q) return 'general';
        // Order matters — most specific first.
        if (/\b(marriage|wedding|spouse|husband|wife|shaadi|शादी|पति|पत्नी)\b/.test(q)) return 'marriage';
        if (/\b(love|partner|relationship|girlfriend|boyfriend|crush|breakup|प्यार|रिश्त|प्रेम|साथी)\b/.test(q)) return 'love';
        if (/\b(promot(?:e|ed|es|ing|ion|ions)|appraisal|increment|salary\s*hike|raise)\b|प्रमोशन|पदोन्नति|तरक्की|इन्क्रीमेंट|इंक्रीमेंट|सैलरी\s*हाइक|वेतन\s*वृद्धि/.test(q)) return 'promotion';
        if (/\b(career|job|work|business|promotion|profession|startup|नौकरी|करियर|कैरियर|काम|व्यवसाय)\b/.test(q)) return 'career';
        if (/\b(car|vehicle|bike|scooter|motorcycle|automobile|driving|drive|porsche|porche|gadi|gaadi)\b|गाड़ी|गाड़ी|कार|वाहन|बाइक|स्कूटर/.test(q)) return 'vehicle';
        if (/\b(money|wealth|income|salary|finance|invest|loan|debt|पैसा|पैसे|धन|कमाई|निवेश)\b/.test(q)) return 'money';
        if (/\b(health|illness|disease|body|surgery|स्वास्थ्य|बीमार|तबीयत|शरीर)\b/.test(q)) return 'health';
        if (/\b(study|exam|education|degree|college|पढ़ाई|परीक्षा|शिक्षा)\b/.test(q)) return 'education';
        if (/\b(child|baby|pregnancy|kid|बच्च|संतान)\b/.test(q)) return 'children';
        if (/\b(family|parent|mother|father|sibling|परिवार|माँ|पिता|भाई|बहन)\b/.test(q)) return 'family';
        if (/\b(travel|abroad|foreign|migration|visa|विदेश|यात्रा)\b/.test(q)) return 'travel';
        if (/\b(when|kab|कब)\b/.test(q)) return 'timing';
        return 'general';
    },

    _getAskMayaTopicLabel(topic, isHindi) {
        const map = isHindi
            ? {
                marriage: 'शादी', love: 'रिश्ते', promotion: 'प्रमोशन', career: 'करियर', money: 'पैसा',
                health: 'सेहत', education: 'पढ़ाई', children: 'संतान', family: 'परिवार',
                travel: 'यात्रा/विदेश', vehicle: 'पहली गाड़ी/वाहन', timing: 'timing', general: 'इस सवाल'
            }
            : {
                marriage: 'marriage', love: 'relationships', promotion: 'promotion', career: 'career', money: 'money',
                health: 'health', education: 'education', children: 'children', family: 'family',
                travel: 'travel/relocation', vehicle: 'car/vehicle', timing: 'timing', general: 'this question'
            };
        return map[topic] || map.general;
    },

    _formatAskMayaQuestionNoun(subjectPhrase, isHindi) {
        const phrase = String(subjectPhrase || '').trim();
        if (!phrase) return isHindi ? 'आपके सवाल' : 'your question';
        if (isHindi) {
            const normalized = phrase
                .replace(/\s*वाले\s+सवाल\s*/g, '')
                .replace(/\s*वाला\s+सवाल\s*/g, '')
                .trim();
            if (/^आप|सवाल|विषय|बात/.test(normalized)) return normalized;
            if (/timing|direction|सावधानी|संकेत/.test(normalized)) return normalized;
            return `${normalized} की बात`;
        }
        if (/\bquestion\b/i.test(phrase)) return `your ${phrase}`.replace(/your\s+your\s+/i, 'your ');
        return `your ${phrase} question`;
    },

    _getAskMayaSubjectPhrase(topic, isHindi) {
        const q = String(this._getActiveUserQuestion() || '').toLowerCase();
        const hasPromotion = /\b(promot(?:e|ed|es|ing|ion|ions)|appraisal)\b|प्रमोशन|पदोन्नति|तरक्की/.test(q);
        const hasSalaryRaise = /\b(increment|salary\s*hike|salary\s*raise|raise)\b|इन्क्रीमेंट|इंक्रीमेंट|सैलरी\s*हाइक|वेतन\s*वृद्धि/.test(q);
        const hasPorsche = /\b(porsche|porche)\b/.test(q);
        const hasBike = /\b(bike|motorcycle)\b|बाइक/.test(q);
        const hasScooter = /\b(scooter)\b|स्कूटर/.test(q);

        const hi = {
            marriage: 'शादी की timing',
            love: 'रिश्ते की direction',
            promotion: 'प्रमोशन',
            career: 'career direction',
            money: 'धन और timing',
            health: 'सेहत की सावधानी',
            education: 'पढ़ाई की direction',
            children: 'संतान से जुड़े संकेत',
            family: 'परिवार की बात',
            travel: 'यात्रा या विदेश की timing',
            timing: 'timing',
            general: 'आपका सवाल'
        };
        const en = {
            marriage: 'marriage timing',
            love: 'relationship direction',
            promotion: 'promotion',
            career: 'career direction',
            money: 'money timing',
            health: 'health pattern',
            education: 'study direction',
            children: 'child-related timing',
            family: 'family matter',
            travel: 'travel or relocation timing',
            timing: 'timing question',
            general: 'your question'
        };

        if (hasPromotion) return isHindi ? 'प्रमोशन' : 'promotion';
        if (hasSalaryRaise) return isHindi ? 'सैलरी इन्क्रीमेंट' : 'salary increment';

        if (topic === 'vehicle') {
            if (hasPorsche) return isHindi ? 'पहली Porsche की timing' : 'first Porsche timing';
            if (hasBike) return isHindi ? 'पहली bike की timing' : 'first bike timing';
            if (hasScooter) return isHindi ? 'पहले scooter की timing' : 'first scooter timing';
            return isHindi ? 'पहली गाड़ी की timing' : 'first car timing';
        }

        return (isHindi ? hi : en)[topic] || (isHindi ? hi.general : en.general);
    },

    _getAskMayaFocusQuestionFallback(askedKeys = new Set()) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const userQ = this._getActiveUserQuestion();
        const topic = this._classifyUserQuestionTopic(userQ);
        const topicLabel = this._getAskMayaTopicLabel(topic, isHindi);
        const key = `ask_maya_focus_${topic}`;
        const asked = askedKeys instanceof Set ? askedKeys : new Set(askedKeys || []);

        const make = (question, options, spoken = question) => ({
            key,
            spoken,
            question,
            options,
            source: 'local_ask_maya'
        });

        const hi = {
            promotion: make('आपके प्रमोशन में अभी कौन-सा factor सबसे बड़ा है?', [
                { label: 'Appraisal pending है', value: 'appraisal_pending', insight: 'User needs promotion timing with appraisal context.' },
                { label: 'Manager support चाहिए', value: 'manager_support', insight: 'User needs authority/support signal for promotion.' },
                { label: 'Performance strong है', value: 'performance_strong', insight: 'User has work evidence but needs timing and recognition clarity.' }
            ], 'हम आपके प्रमोशन के बारे में बात कर रहे हैं; इसे exact करने के लिए एक बात बताइए।'),
            marriage: make('शादी के बारे में असली चिंता क्या है?', [
                { label: 'Timing साफ चाहिए', value: 'marriage_timing', insight: 'User needs marriage timing before deeper chart answer.' },
                { label: 'Partner कैसा होगा', value: 'partner_nature', insight: 'User needs spouse nature and compatibility cues.' },
                { label: 'Delay क्यों हो रहा', value: 'delay_reason', insight: 'User needs blockage reason and remedy direction.' }
            ], 'शादी की बात को सटीक करने के लिए एक बात बताइए।'),
            love: make('रिश्ते के सवाल में अभी सबसे बड़ा doubt क्या है?', [
                { label: 'Future साथ में', value: 'future_together', insight: 'User wants relationship outcome timing.' },
                { label: 'Trust issue है', value: 'trust_issue', insight: 'User needs emotional pattern clarity.' },
                { label: 'Confusion चल रही', value: 'confusion', insight: 'User needs whether to continue or step back.' }
            ], 'रिश्ते की direction साफ करने के लिए एक छोटा जवाब चाहिए।'),
            career: make('Career में सबसे ज़्यादा अटका क्या है?', [
                { label: 'Job growth रुकी', value: 'growth_blocked', insight: 'User needs growth timing and blockage reason.' },
                { label: 'Direction clear नहीं', value: 'direction_unclear', insight: 'User needs career direction clarity.' },
                { label: 'Business या job', value: 'business_or_job', insight: 'User needs path comparison.' }
            ], 'आपके career question का answer सही बैठे, इसलिए ये बताइए।'),
            money: make('पैसे के सवाल में सबसे बड़ी चिंता क्या है?', [
                { label: 'Income बढ़े कब', value: 'income_timing', insight: 'User needs earning window.' },
                { label: 'Saving टिकती नहीं', value: 'saving_leak', insight: 'User needs money leak pattern.' },
                { label: 'Investment doubt है', value: 'investment_doubt', insight: 'User needs broad investment timing.' }
            ], 'पैसे की बात को precise करने के लिए एक बात बताइए।'),
            health: make('सेहत में अभी pressure कहाँ महसूस होता है?', [
                { label: 'Energy कम रहती', value: 'low_energy', insight: 'User needs vitality timing.' },
                { label: 'Stress और sleep', value: 'stress_sleep', insight: 'User needs stress rhythm clarity.' },
                { label: 'Check-up concern', value: 'checkup_concern', insight: 'User needs cautious health-window guidance.' }
            ], 'सेहत की बात में मैं safe और precise रहना चाहती हूँ, इसलिए ये बताइए।'),
            education: make('पढ़ाई में main pressure क्या है?', [
                { label: 'Exam result', value: 'exam_result', insight: 'User needs result and performance timing.' },
                { label: 'Focus नहीं बनता', value: 'focus_issue', insight: 'User needs study rhythm pattern.' },
                { label: 'Course confusion', value: 'course_confusion', insight: 'User needs education direction.' }
            ], 'पढ़ाई की direction साफ करने के लिए एक बात बताइए।'),
            children: make('संतान के बारे में असली चिंता क्या है?', [
                { label: 'Timing जानना है', value: 'children_timing', insight: 'User needs timing window.' },
                { label: 'Delay concern है', value: 'delay_concern', insight: 'User needs delay reason.' },
                { label: 'Family pressure है', value: 'family_pressure', insight: 'User needs emotional context.' }
            ], 'संतान से जुड़े संकेत sensitive तरीके से पढ़ने के लिए ये बताइए।'),
            family: make('परिवार में issue कहाँ है?', [
                { label: 'Parents से tension', value: 'parent_tension', insight: 'User needs parent-karaka clarity.' },
                { label: 'घर का माहौल', value: 'home_environment', insight: 'User needs domestic pattern.' },
                { label: 'Sibling issue है', value: 'sibling_issue', insight: 'User needs sibling pattern.' }
            ], 'परिवार की बात exact करने के लिए एक बात बताइए।'),
            travel: make('विदेश/यात्रा में focus क्या है?', [
                { label: 'Abroad जाना है', value: 'abroad_move', insight: 'User needs relocation timing.' },
                { label: 'Visa delay है', value: 'visa_delay', insight: 'User needs delay/approval window.' },
                { label: 'Travel timing चाहिए', value: 'travel_timing', insight: 'User needs travel timing.' }
            ], 'विदेश या travel की timing सटीक करने के लिए ये बताइए।'),
            vehicle: make('पहली गाड़ी के लिए अभी आपकी स्थिति क्या है?', [
                { label: 'Budget बन रहा', value: 'budget_building', insight: 'User is preparing finances for vehicle purchase timing.' },
                { label: 'Loan planning चल रही', value: 'loan_planning', insight: 'User needs purchase timing with loan or approval context.' },
                { label: 'Family decision बाकी', value: 'family_decision_pending', insight: 'User needs timing with family approval or shared decision context.' }
            ], 'पहली गाड़ी की timing exact करने के लिए एक बात बताइए।'),
            timing: make('आपको किस चीज़ का समय चाहिए?', [
                { label: 'Career का time', value: 'career_timing', insight: 'User needs work timing.' },
                { label: 'Relationship का time', value: 'relationship_timing', insight: 'User needs relationship timing.' },
                { label: 'Big change कब', value: 'change_timing', insight: 'User needs major shift window.' }
            ], 'आपने timing पूछा है, तो पहले ये साफ कर लें।'),
            general: make('इस सवाल में आपको सबसे साफ answer किस बात का चाहिए?', [
                { label: 'कब होगा', value: 'when', insight: 'User needs timing.' },
                { label: 'क्यों हो रहा', value: 'why', insight: 'User needs cause.' },
                { label: 'क्या करना है', value: 'what_to_do', insight: 'User needs action.' }
            ], 'आपके सवाल को exact answer तक ले जाने के लिए एक बात बताइए।')
        };

        const en = {
            promotion: make('What is the biggest factor in this promotion question?', [
                { label: 'Appraisal is pending', value: 'appraisal_pending', insight: 'User needs promotion timing with appraisal context.' },
                { label: 'Manager support needed', value: 'manager_support', insight: 'User needs authority/support signal for promotion.' },
                { label: 'Performance is strong', value: 'performance_strong', insight: 'User has work evidence but needs timing and recognition clarity.' }
            ], 'To make your promotion answer exact, tell me this.'),
            marriage: make('What is the real concern in this marriage question?', [
                { label: 'Clear timing', value: 'marriage_timing', insight: 'User needs marriage timing before deeper chart answer.' },
                { label: 'Partner nature', value: 'partner_nature', insight: 'User needs spouse nature and compatibility cues.' },
                { label: 'Reason for delay', value: 'delay_reason', insight: 'User needs blockage reason and remedy direction.' }
            ], 'To make your marriage answer precise, tell me this.'),
            love: make('What is the biggest doubt in this relationship question?', [
                { label: 'Future together', value: 'future_together', insight: 'User wants relationship outcome timing.' },
                { label: 'Trust issue', value: 'trust_issue', insight: 'User needs emotional pattern clarity.' },
                { label: 'Ongoing confusion', value: 'confusion', insight: 'User needs whether to continue or step back.' }
            ], 'To answer your relationship question clearly, I need one detail.'),
            career: make('What feels most stuck in your career question?', [
                { label: 'Job growth stuck', value: 'growth_blocked', insight: 'User needs growth timing and blockage reason.' },
                { label: 'Direction unclear', value: 'direction_unclear', insight: 'User needs career direction clarity.' },
                { label: 'Business or job', value: 'business_or_job', insight: 'User needs path comparison.' }
            ], 'So your career answer lands properly, tell me this.'),
            money: make('What is the biggest concern in your money question?', [
                { label: 'Income timing', value: 'income_timing', insight: 'User needs earning window.' },
                { label: 'Savings leak', value: 'saving_leak', insight: 'User needs money leak pattern.' },
                { label: 'Investment doubt', value: 'investment_doubt', insight: 'User needs broad investment timing.' }
            ], 'To make the money answer precise, tell me this.'),
            health: make('Where do you feel the health pressure most?', [
                { label: 'Low energy', value: 'low_energy', insight: 'User needs vitality timing.' },
                { label: 'Stress and sleep', value: 'stress_sleep', insight: 'User needs stress rhythm clarity.' },
                { label: 'Check-up concern', value: 'checkup_concern', insight: 'User needs cautious health-window guidance.' }
            ], 'For a safe and precise health answer, tell me this.'),
            education: make('What is the main pressure in your study question?', [
                { label: 'Exam result', value: 'exam_result', insight: 'User needs result and performance timing.' },
                { label: 'Focus issue', value: 'focus_issue', insight: 'User needs study rhythm pattern.' },
                { label: 'Course confusion', value: 'course_confusion', insight: 'User needs education direction.' }
            ], 'To clear the study question, tell me this.'),
            children: make('What is the real concern in this child question?', [
                { label: 'Timing', value: 'children_timing', insight: 'User needs timing window.' },
                { label: 'Delay concern', value: 'delay_concern', insight: 'User needs delay reason.' },
                { label: 'Family pressure', value: 'family_pressure', insight: 'User needs emotional context.' }
            ], 'To read this child-related question sensitively, tell me this.'),
            family: make('Where is the issue in the family question?', [
                { label: 'Parents tension', value: 'parent_tension', insight: 'User needs parent-karaka clarity.' },
                { label: 'Home environment', value: 'home_environment', insight: 'User needs domestic pattern.' },
                { label: 'Sibling issue', value: 'sibling_issue', insight: 'User needs sibling pattern.' }
            ], 'To make the family answer exact, tell me this.'),
            travel: make('What is the focus in your travel question?', [
                { label: 'Move abroad', value: 'abroad_move', insight: 'User needs relocation timing.' },
                { label: 'Visa delay', value: 'visa_delay', insight: 'User needs delay/approval window.' },
                { label: 'Travel timing', value: 'travel_timing', insight: 'User needs travel timing.' }
            ], 'To make the travel or abroad answer precise, tell me this.'),
            vehicle: make('Where are you with your first car plan?', [
                { label: 'Saving right now', value: 'saving_right_now', insight: 'User is preparing finances for vehicle purchase timing.' },
                { label: 'Loan planning', value: 'loan_planning', insight: 'User needs purchase timing with loan or approval context.' },
                { label: 'Family decision pending', value: 'family_decision_pending', insight: 'User needs timing with family approval or shared decision context.' }
            ], 'To answer your first car question precisely, tell me this.'),
            timing: make('What do you need timing for?', [
                { label: 'Career timing', value: 'career_timing', insight: 'User needs work timing.' },
                { label: 'Relationship timing', value: 'relationship_timing', insight: 'User needs relationship timing.' },
                { label: 'Big change', value: 'change_timing', insight: 'User needs major shift window.' }
            ], 'You asked about timing, so let us lock the area first.'),
            general: make('What do you most need the answer to clarify?', [
                { label: 'When it happens', value: 'when', insight: 'User needs timing.' },
                { label: 'Why it happens', value: 'why', insight: 'User needs cause.' },
                { label: 'What to do', value: 'what_to_do', insight: 'User needs action.' }
            ], 'To take your question to an exact answer, tell me this.')
        };

        const fallback = (isHindi ? hi : en)[topic] || (isHindi ? hi.general : en.general);
        if (asked.has(fallback.key)) {
            return (isHindi ? hi.general : en.general);
        }
        return fallback;
    },

    filterProfileQuestions(questions = [], askedKeys = new Set()) {
        const maritalStatus = this.normalizeMaritalStatus(this.userData?.maritalStatus);
        const asked = askedKeys instanceof Set ? askedKeys : new Set(askedKeys || []);
        let filtered = Array.isArray(questions) ? questions.filter(Boolean) : [];

        // Skip relationship-status MCQ for married users.
        if (maritalStatus === 'married') {
            filtered = filtered.filter(q => q?.key !== 'relationship_status');
        }

        // Avoid asking the same key twice in one journey.
        filtered = filtered.filter(q => q?.key && !asked.has(q.key));

        return filtered;
    },

    getQuestionTopic(questionKey) {
        const map = {
            recent_upheaval: 'upheaval',
            current_phase: 'emotional_state',
            money_pattern: 'money',
            relationship_status: 'relationship',
            repeating_pattern: 'pattern'
        };
        return map[questionKey] || 'general';
    },

    getStageCandidateKeys(stageKey) {
        const map = {
            q1_kundli: ['recent_upheaval', 'current_phase', 'repeating_pattern'],
            q2_numbers: ['current_phase', 'money_pattern', 'repeating_pattern', 'relationship_status'],
            q3_money: ['money_pattern', 'current_phase', 'repeating_pattern'],
            q4_relationship: ['relationship_status', 'current_phase', 'repeating_pattern', 'money_pattern'],
            q5_pattern: ['repeating_pattern', 'current_phase', 'relationship_status', 'money_pattern']
        };
        return map[stageKey] || ['current_phase', 'repeating_pattern'];
    },

    getQuestionTopicConfidenceScores() {
        const profile = this.personalization || {};
        const maritalStatus = this.normalizeMaritalStatus(this.userData?.maritalStatus);
        const dasha = String(profile.currentDasha?.vedic || profile.currentDasha?.planet || '').toLowerCase();
        const dominantElement = String(profile.dominantElement || '').toLowerCase();
        const lp = Number(this.calculations?.lifePath || 0);
        const answersText = Object.values(this.sessionMemory?.profileAnswers || {}).join(' ').toLowerCase();

        const scores = {
            upheaval: 1,
            emotional_state: 1,
            money: 1,
            relationship: 1,
            pattern: 1
        };

        if (/rahu|ketu/.test(dasha)) {
            scores.upheaval += 3;
            scores.pattern += 2;
            scores.relationship += 1;
        }
        if (/saturn|shani/.test(dasha)) {
            scores.pattern += 3;
            scores.money += 1;
            scores.emotional_state += 1;
        }
        if (/jupiter|guru|sun|surya/.test(dasha)) {
            scores.money += 2;
            scores.emotional_state += 1;
        }
        if (/venus|shukra/.test(dasha)) {
            scores.relationship += 3;
            scores.emotional_state += 1;
        }
        if (/moon|chandra/.test(dasha)) {
            scores.emotional_state += 3;
            scores.relationship += 1;
        }
        if (/mars|mangal/.test(dasha)) {
            scores.upheaval += 1;
            scores.pattern += 1;
            scores.money += 1;
        }
        if (/mercury|budh/.test(dasha)) {
            scores.emotional_state += 2;
            scores.money += 1;
        }

        if (dominantElement === 'water') {
            scores.emotional_state += 2;
            scores.relationship += 1;
        }
        if (dominantElement === 'earth') {
            scores.money += 2;
        }
        if (dominantElement === 'fire') {
            scores.upheaval += 2;
            scores.money += 1;
        }
        if (dominantElement === 'air') {
            scores.emotional_state += 1;
            scores.relationship += 1;
        }

        if ([8, 4, 22].includes(lp)) scores.money += 2;
        if ([2, 6, 9].includes(lp)) {
            scores.relationship += 2;
            scores.emotional_state += 1;
        }
        if ([7, 11, 33].includes(lp)) {
            scores.emotional_state += 2;
            scores.pattern += 1;
        }
        if ([1, 5].includes(lp)) scores.upheaval += 1;

        if (maritalStatus === 'married') {
            scores.relationship -= 3;
        } else if (maritalStatus === 'unmarried') {
            scores.relationship += 2;
        } else if (maritalStatus === 'divorced') {
            scores.relationship += 1;
            scores.pattern += 1;
        }

        if (/career_shift|underpaid|plateau|volatile|flows_out|money|growth/.test(answersText)) {
            scores.money += 2;
        }
        if (/relationship_shift|confused|distance|searching|not_priority|relationship/.test(answersText)) {
            scores.relationship += 2;
        }
        if (/stuck|isolated|missing|rapid_change/.test(answersText)) {
            scores.emotional_state += 2;
            scores.upheaval += 1;
        }
        if (/abandonment|bad_endings|missed_chances|same_mistake/.test(answersText)) {
            scores.pattern += 3;
        }

        return scores;
    },

    rankStageQuestionCandidates(stageKey, questions = []) {
        const allowedKeys = this.getStageCandidateKeys(stageKey);
        const topicScores = this.getQuestionTopicConfidenceScores();

        return questions
            .filter(q => allowedKeys.includes(q.key))
            .map((q, index) => {
                const topic = this.getQuestionTopic(q.key);
                const stageBoost = allowedKeys.length - allowedKeys.indexOf(q.key);
                return {
                    question: q,
                    topic,
                    confidence: (topicScores[topic] || 0) + stageBoost + ((allowedKeys[0] === q.key) ? 1 : 0),
                    order: index
                };
            })
            .sort((left, right) => {
                if (right.confidence !== left.confidence) return right.confidence - left.confidence;
                return left.order - right.order;
            });
    },

    getRankedTopicPoolForStage(stageKey) {
        const candidates = this.getStageCandidateKeys(stageKey)
            .map(key => ({ key, topic: this.getQuestionTopic(key), score: this.getQuestionTopicConfidenceScores()[this.getQuestionTopic(key)] || 0 }));

        const deduped = [];
        const seen = new Set();
        for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
            if (seen.has(candidate.topic)) continue;
            seen.add(candidate.topic);
            deduped.push(candidate);
        }
        return deduped;
    },

    getFallbackProfileQuestionForStage(stageKey, askedKeys = new Set()) {
        const pool = this.filterProfileQuestions(this.getProfileQuestions(), askedKeys);
        if (!pool.length) return this.getEmergencyProfileQuestionForStage(stageKey, askedKeys);

        const ranked = this.rankStageQuestionCandidates(stageKey, pool);
        return ranked[0]?.question || pool[0] || this.getEmergencyProfileQuestionForStage(stageKey, askedKeys);
    },

    getEmergencyProfileQuestionForStage(stageKey, askedKeys = new Set()) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const asked = askedKeys instanceof Set ? askedKeys : new Set(askedKeys || []);
        const key = `profile_${stageKey}_detail`;
        if (asked.has(key)) return null;

        return isHindi
            ? {
                key,
                spoken: 'इसे और personal बनाने के लिए एक छोटा detail बताइए।',
                question: 'अभी आपकी ज़िंदगी में सबसे strong signal क्या है?',
                options: [
                    { label: 'Career pressure', value: 'career_pressure', insight: 'User is carrying work pressure right now.' },
                    { label: 'Relationship confusion', value: 'relationship_confusion', insight: 'User needs emotional clarity right now.' },
                    { label: 'Money चिंता', value: 'money_pressure', insight: 'User needs financial timing clarity right now.' }
                ],
                source: 'local_emergency'
            }
            : {
                key,
                spoken: 'To make this more personal, tell me one small detail.',
                question: 'What feels strongest in your life right now?',
                options: [
                    { label: 'Career pressure', value: 'career_pressure', insight: 'User is carrying work pressure right now.' },
                    { label: 'Relationship confusion', value: 'relationship_confusion', insight: 'User needs emotional clarity right now.' },
                    { label: 'Money concern', value: 'money_pressure', insight: 'User needs financial timing clarity right now.' }
                ],
                source: 'local_emergency'
            };
    },

    _extractFirstJsonObject(text = '') {
        const source = String(text || '').trim();
        if (!source) return null;

        try {
            return JSON.parse(source);
        } catch (_) {
            // Continue to bracket extraction fallback.
        }

        const firstBrace = source.indexOf('{');
        const lastBrace = source.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const candidate = source.slice(firstBrace, lastBrace + 1);
            try {
                return JSON.parse(candidate);
            } catch (_) {
                return null;
            }
        }
        return null;
    },

    _sanitizeAdaptiveQuestion(rawQuestion, fallbackQuestion, askedKeys = new Set()) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        if (!rawQuestion || typeof rawQuestion !== 'object') return fallbackQuestion;

        const base = fallbackQuestion || {};
        const questionText = String(rawQuestion.question || '').trim();
        const spokenText = String(rawQuestion.spoken || questionText).trim();
        const key = String(rawQuestion.key || base.key || `dynamic_${Date.now()}`).trim();

        const options = Array.isArray(rawQuestion.options)
            ? rawQuestion.options
                .map((opt, idx) => ({
                    label: String(opt?.label || '').trim(),
                    value: String(opt?.value || `opt_${idx + 1}`).trim(),
                    insight: String(opt?.insight || '').trim()
                }))
                .filter(opt => opt.label && opt.value)
            : [];

        if (!questionText || options.length < 3 || options.length > 4) {
            return base;
        }

        const dedupedOptions = [];
        const seen = new Set();
        for (const opt of options) {
            if (seen.has(opt.value)) continue;
            seen.add(opt.value);
            dedupedOptions.push(opt);
        }

        if (dedupedOptions.length < 3) return base;

        const maritalStatus = this.normalizeMaritalStatus(this.userData?.maritalStatus);
        const hasDatingLanguage = /find the right person|dating|single life|सही इंसान|डेटिंग/i.test(`${questionText} ${spokenText}`);
        if (maritalStatus === 'married' && hasDatingLanguage) {
            return base;
        }

        if ((askedKeys instanceof Set ? askedKeys : new Set()).has(key)) {
            return base;
        }

        // Defensive: in Hindi mode, reject options that contain malformed /
        // half-baked Devanagari tokens (e.g. "थोड़ा भुअन"). A "word" is suspect
        // when its consonant cluster doesn't resolve to a real Hindi word.
        // Heuristic: any standalone Devanagari word of length 2-3 chars that is
        // NOT in a small allow-list of common short words is treated as
        // gibberish and we fall back. This is a soft guard, not a dictionary.
        if (isHindi) {
            const KNOWN_SHORT = new Set([
                'है', 'हो', 'का', 'की', 'के', 'को', 'से', 'पर', 'या', 'और',
                'मैं', 'तू', 'वो', 'ये', 'वह', 'यह', 'जो', 'तो', 'भी', 'ही',
                'न', 'नहीं', 'कभी', 'अभी', 'जब', 'तब', 'कब', 'अब', 'फिर',
                'हाँ', 'ना', 'बस', 'सब', 'कुछ', 'कौन', 'क्या', 'कहाँ', 'कैसे',
                'कम', 'ज्यादा', 'थोड़ा', 'बहुत', 'अच्छा', 'बुरा', 'सही',
                'गलत', 'नया', 'पुराना', 'मन', 'दिल', 'घर', 'काम', 'बात',
                'दिन', 'रात', 'समय', 'वक्त', 'साथ', 'दूर', 'पास', 'बीच'
            ]);
            const looksGibberish = (label) => {
                const tokens = label.split(/[\s,।.!?-]+/).filter(Boolean);
                for (const tok of tokens) {
                    // Only inspect pure Devanagari tokens
                    if (!/^[\u0900-\u097F]+$/.test(tok)) continue;
                    // Strip nukta / final virama for length check
                    const stripped = tok.replace(/[\u093C\u094D]/g, '');
                    if (stripped.length <= 3 && !KNOWN_SHORT.has(tok) && !KNOWN_SHORT.has(stripped)) {
                        return true;
                    }
                }
                return false;
            };
            for (const opt of dedupedOptions) {
                if (looksGibberish(opt.label)) {
                    console.warn('[funnel] Rejecting AI MCQ — suspect Hindi token:', opt.label);
                    return base;
                }
            }
        }

        return {
            key,
            spoken: spokenText,
            question: questionText,
            options: dedupedOptions,
            source: 'ai'
        };
    },

    async getAdaptiveQuestionForStage(stageKey, askedKeys = new Set()) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const isAskMayaStage = stageKey === 'q_ask_maya_focus';
        const fallback = isAskMayaStage
            ? this._getAskMayaFocusQuestionFallback(askedKeys)
            : this.getFallbackProfileQuestionForStage(stageKey, askedKeys);
        if (!fallback) return null;

        if (!window.MayaAI?.callGemini) {
            return fallback;
        }

        const profile = this.personalization || {};
        const maritalStatus = this.normalizeMaritalStatus(this.userData?.maritalStatus);
        const priorAnswers = Object.entries(this.sessionMemory?.profileAnswers || {})
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n') || '- none yet';

        const askedList = Array.from(askedKeys || []).join(', ') || 'none';
        const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || 'unknown';
        const moonSign = profile.moonSign || profile.vedic?.name || 'unknown';
        const ascendant = profile.ascendant?.name || 'unknown';
        const lp = this.calculations?.lifePath || 'unknown';

        // ──────────────────────────────────────────────────────────
        //  ASK-MAYA FOCUS STAGE: question-locked MCQ generation.
        //  This stage is invoked only when the user entered through
        //  the "Ask Maya anything" landing input. The MCQ MUST be
        //  about the user's exact question — never about an
        //  unrelated life area.
        // ──────────────────────────────────────────────────────────
        if (isAskMayaStage) {
            const userQ = this._getActiveUserQuestion();
            const safeUserQ = userQ.replace(/`/g, "'").slice(0, 240);
            const topic = this._classifyUserQuestionTopic(userQ);
            const topicLabel = this._getAskMayaTopicLabel(topic, isHindi);
            const recentSpoken = (Array.isArray(this.spokenNarrations) ? this.spokenNarrations : [])
                .slice(-5)
                .map((entry) => {
                    const stage = entry?.stage || 'previous';
                    const text = String(entry?.text || '').replace(/\[\[pause-\d+\]\]/g, '').trim();
                    return text ? `- ${stage}: ${text}` : '';
                })
                .filter(Boolean)
                .join('\n') || '- none yet';
            const concreteTopicRule = ['timing', 'general'].includes(topic)
                ? ''
                : (isHindi
                    ? `\n- Topic already known है: ${topicLabel}. User से area/category मत पूछिए; इसी exact subject के अंदर एक practical detail पूछिए।`
                    : `\n- The subject is already known: ${topicLabel}. Do not ask which area/category they mean; ask one practical detail inside this exact subject.`);

            const askMayaPrompt = isHindi
                ? `MAYA के लिए एक छोटा MCQ JSON में बनाइए जो SIRF user के नीचे दिए सवाल को precisely answer करने में मदद करे।

USER'S QUESTION: "${safeUserQ}"
Topic lock: ${topicLabel}
Marital: ${maritalStatus} | Dasha: ${dasha} | Moon: ${moonSign} | Lagna: ${ascendant} | Life path: ${lp}
Already asked: ${askedList}
Previous answers:
${priorAnswers}
Recent MAYA context already spoken:
${recentSpoken}

RULES (STRICT):
- सवाल सीधे user के question के context में हो — '${topicLabel}' से बाहर का कोई topic touch मत कीजिए (relationships अगर question career का है, money अगर question health का है, etc मत पूछिए)।
- Recent MAYA context को पढ़कर अगला सवाल पिछली बातों पर build करे; repeat/reset मत करे।${concreteTopicRule}
- सवाल MAX 12 शब्द, plain conversational Hindi, बिना jyotish jargon के।
- ऐसा सवाल जो user की actual situation reveal करे ताकि उनके सवाल का जवाब और precise मिले।
- Exactly 3 options, हर option MAX 5 शब्द, simple, अलग-अलग, real-life।
- हर option में label, value, और 1-line insight जो chart से connect हो।
- LANGUAGE INTEGRITY: केवल dictionary-correct हिंदी शब्द। कोई coined / half / broken word नहीं। English loanword Latin script में।
- BAD: "थोड़ा भुअन", "बहुत खुश-खुश"
- GOOD: "बिल्कुल नहीं", "थोड़ा-बहुत", "हाँ अक्सर"

Return ONLY JSON:
{"key":"ask_maya_focus","spoken":"...","question":"...","options":[{"label":"...","value":"...","insight":"..."}]}`
                : `Build ONE short MCQ for MAYA as JSON whose ONLY purpose is to help precisely answer the user's question below.

USER'S QUESTION: "${safeUserQ}"
Topic lock: ${topicLabel}
Marital: ${maritalStatus} | Dasha: ${dasha} | Moon: ${moonSign} | Lagna: ${ascendant} | Life path: ${lp}
Already asked: ${askedList}
Previous answers:
${priorAnswers}
Recent MAYA context already spoken:
${recentSpoken}

RULES (STRICT):
- The question MUST sit inside the user's question's topic '${topicLabel}'. Do NOT touch unrelated life areas (no relationships if their question is career, no money if their question is health, etc.).
- Read the recent MAYA context and build on it; do not reset, repeat, or ignore what was already said.${concreteTopicRule}
- MAX 12 words, plain conversational English, no astrology jargon.
- Frame it so their answer reveals the real-life detail you need to answer their question precisely.
- Exactly 3 options. Each MAX 5 words, simple, distinct, real-life.
- Each option needs label, value, and a 1-line insight that ties to the chart.

Return ONLY JSON:
{"key":"ask_maya_focus","spoken":"...","question":"...","options":[{"label":"...","value":"...","insight":"..."}]}`;

            try {
                return await this._generateAdaptiveQuestionFromGemini(askMayaPrompt, fallback, askedKeys, { maxTokens: 1400, temperature: 0.65, timeoutMs: 2600 });
            } catch (error) {
                console.warn('Ask-Maya focus question generation failed:', error?.message || error);
                return fallback;
            }
        }

        const rankedTopics = this.getRankedTopicPoolForStage(stageKey)
            .map(item => `- ${item.topic}: confidence ${item.score} (from ${item.key})`)
            .join('\n') || '- emotional_state: confidence 1';
        const fallbackTopic = this.getQuestionTopic(fallback.key);
        const fallbackSummary = JSON.stringify({
            key: fallback.key,
            topic: fallbackTopic,
            question: fallback.question,
            options: fallback.options?.map(opt => ({ label: opt.label, value: opt.value }))
        });

        const prompt = isHindi
            ? `MAYA के लिए एक छोटा, simple MCQ JSON में बनाइए।

Stage: ${stageKey} | Marital: ${maritalStatus} | Dasha: ${dasha} | Moon: ${moonSign} | Lagna: ${ascendant} | Life path: ${lp}
पहले पूछे गए: ${askedList}
Previous answers:
${priorAnswers}
Top topics: ${rankedTopics}

RULES (STRICT):
- सवाल MAX 12 शब्दों में। सीधा, रोज़मर्रा की Hindi में। कोई jyotish jargon नहीं (दशा/भाव/ग्रह जैसे शब्द बाहर में मत बोलिए -internally use करके सिर्फ feeling/situation पूछिए)।
- ऐसा सवाल जो user अपनी ज़िंदगी में तुरंत relate कर सके -एक छोटी, real situation।
- अगर married है, तो dating-style सवाल नहीं।
- पहले पूछे गए topics दोबारा नहीं।
- Top 2 ranked topics में से ही choose करें।
- Exactly 3 options. हर option MAX 5 शब्द, simple, personal, अलग-अलग।
- हर option में label, value, insight (insight 1 छोटी line)।
- LANGUAGE INTEGRITY (CRITICAL): केवल standard, dictionary-correct हिंदी शब्द use कीजिए। कोई भी coined, poetic, regional, या invented शब्द बिल्कुल मत लिखिए। अगर सही हिंदी शब्द याद नहीं तो English loanword (Devanagari में नहीं, Latin script में) use कीजिए -जैसे "job", "relationship", "stress"। हर option grammatically valid और naturally बोला जाने वाला होना चाहिए। Half-words, broken syllables, या आधे-अधूरे tokens जैसे "भुअन", "भअ" बिल्कुल forbidden।
- BAD examples (कभी मत लिखिए): "थोड़ा भुअन", "बहुत खुश-खुश", "मध्यम तरह"
- GOOD examples: "बहुत भरोसा है", "थोड़ा-बहुत", "बिल्कुल नहीं", "कभी-कभी"

Return ONLY JSON:
{"key":"...","spoken":"...","question":"...","options":[{"label":"...","value":"...","insight":"..."}]}`
            : `Build ONE short, simple MCQ for MAYA as JSON.

Stage: ${stageKey} | Marital: ${maritalStatus} | Dasha: ${dasha} | Moon: ${moonSign} | Lagna: ${ascendant} | Life path: ${lp}
Already asked: ${askedList}
Previous answers:
${priorAnswers}
Top topics: ${rankedTopics}

RULES (STRICT):
- Question MUST be MAX 12 words, plain everyday English, easy for anyone to understand. No astrology jargon (no "dasha / house / planet" wording -use those internally, ask only about a feeling or real situation).
- Frame it so the user instantly recognises themselves -a small, real-life moment, not theory.
- If married, no dating-style questions.
- Don't repeat previously asked topics.
- Stay within the top 2 ranked topics.
- Exactly 3 options. Each option MAX 5 words, simple, personal, clearly different.
- Each option needs label, value, and a 1-line insight.

Return ONLY JSON:
{"key":"...","spoken":"...","question":"...","options":[{"label":"...","value":"...","insight":"..."}]}`;

        try {
            return await this._generateAdaptiveQuestionFromGemini(prompt, fallback, askedKeys, { maxTokens: 1400, temperature: 0.65, timeoutMs: 2600 });
        } catch (error) {
            console.warn('Dynamic profile question generation failed:', error?.message || error);
            return fallback;
        }
    },

    /**
     * Run chart-driven profiling MCQs after kundli is formed.
     * Asks questions one by one with chart-aware acknowledgments.
     */
    async runProfileQuestions() {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const stageOrder = ['q1_kundli', 'q2_numbers', 'q3_money', 'q4_relationship', 'q5_pattern'];
        const askedKeys = new Set();

        // Intro - grounded in the chart
        const introLine = isHindi
            ? 'अब कुछ signals बहुत clear दिख रहे हैं - पर कुछ बातें सिर्फ आप confirm कर सकते हैं। मुझे कुछ सवाल पूछने दीजिए।'
            : 'Some signals are very clear now - but a few things only you can confirm. Let me ask you a few questions.';
        await this.speak(introLine);

        // Pipeline: pre-generate next question while current one is being asked
        let nextQPromise = this.getAdaptiveQuestionForStage(stageOrder[0], askedKeys);

        for (let i = 0; i < stageOrder.length; i++) {
            const q = await nextQPromise;
            if (!q) {
                // Start generating the next one even if this one was null
                if (i + 1 < stageOrder.length) {
                    nextQPromise = this.getAdaptiveQuestionForStage(stageOrder[i + 1], askedKeys);
                }
                continue;
            }

            // Start pre-generating the NEXT question in the background
            // while the current question is being asked + ack is playing
            if (i + 1 < stageOrder.length) {
                const optimisticKeys = new Set(askedKeys);
                optimisticKeys.add(q.key);
                nextQPromise = this.getAdaptiveQuestionForStage(stageOrder[i + 1], optimisticKeys);
            }

            await this.askSingleProfileQuestion(q);
            if (q.key) askedKeys.add(q.key);
        }

        // Transition - MAYA now has data to go deeper
        const outroLine = isHindi
            ? 'बहुत अच्छा। अब मुझे exactly पता है कहाँ देखना है। चलिए, deep reading शुरू करते हैं।'
            : 'Good. Now I know exactly where to look. Let me begin the deep reading.';
        await this.speak(outroLine);
    },

    /**
     * Run the "How does she know?" moment - predict a past event.
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
     * Show the suspense bridge - controlled tension before the gate.
     */
    async showSuspenseBridge() {
        this.currentPhase = this.PHASES.SUSPENSE_BRIDGE;
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';

        // If already logged in, skip auth gate entirely and go to deep reveal
        if (this.isUserLoggedIn || window.MayaAuth?.isAuthenticated) {
            await this.showDeepReveal();
            return;
        }

        // Speak auth gate narration, then go straight to the phone form - no extra button
        // Use pre-generated narration if available, otherwise generate fresh
        let emailNarration;
        if (this._emailNarrationPregen) {
            emailNarration = await this._emailNarrationPregen;
            this._emailNarrationPregen = null;
        }
        if (!emailNarration || emailNarration.length <= 20) {
            const predictionItems = this.buildPredictionItems();
            const emailAiCtx = this.buildBaseAIContext(predictionItems);
            emailNarration = await this.withFiller(
                () => this.generateDirectReadingSection('emailGate', emailAiCtx),
                'thinking'
            );
        }
        if (emailNarration && emailNarration.length > 20) {
            await this.speak(emailNarration);
            this.spokenNarrations.push({ stage: 'emailGate', text: emailNarration });
        }

        // Flow into the SMS OTP gate
        await this.showEmailGate();
        const phoneInput = document.getElementById('gate-phone');
        if (phoneInput && document.body.contains(phoneInput)) {
            this.focusAuthField(phoneInput);
        }
    },

    /**
     * Show the deep reveal with chapter choice - user picks starting topic.
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
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="health">
                            <i class="bi bi-heart-pulse-fill"></i>
                            ${isHindi ? 'सेहत' : 'Health'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="wealth">
                            <i class="bi bi-cash-coin"></i>
                            ${isHindi ? 'धन' : 'Wealth'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="longevity">
                            <i class="bi bi-shield-fill-check"></i>
                            ${isHindi ? 'दीर्घायु' : 'Longevity'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="legal">
                            <i class="bi bi-bank2"></i>
                            ${isHindi ? 'मुक़दमा' : 'Legal'}
                        </button>
                        <button class="maya-validation-btn deep-chapter-btn" data-chapter="publicLife">
                            <i class="bi bi-megaphone-fill"></i>
                            ${isHindi ? 'सार्वजनिक जीवन' : 'Public Life'}
                        </button>
                    </div>
                </div>
            `;
        }

        const chapter = await new Promise((resolve) => {
            const container = document.getElementById('deep-reveal-choices');
            if (!container) { resolve('default'); return; }

            container.querySelectorAll('.deep-chapter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ch = btn.dataset.chapter;
                    this.chosenDeepDiveTopic = ch;
                    resolve(ch);
                });
            });
        });

        // Map chapter key to readable label for the ack prompt
        const labelMap = isHindi
            ? { love: 'प्रेम', career: 'करियर', year: 'समय', health: 'सेहत', wealth: 'धन', longevity: 'दीर्घायु', legal: 'मुक़दमा', publicLife: 'सार्वजनिक जीवन' }
            : { love: 'Love', career: 'Career', year: 'Timing', health: 'Health', wealth: 'Wealth', longevity: 'Longevity', legal: 'Legal', publicLife: 'Public Life' };
        const questionText = isHindi
            ? 'पहले कौनसा chapter सुनना चाहेंगे?'
            : 'Which chapter would you like to hear first?';

        // Show reading animation + AI ack
        const hideAnim = this._showAnswerReadingAnim(isHindi);
        const ack = await this._generateMcqAck(questionText, labelMap[chapter] || chapter, chapter, isHindi);
        if (ack && window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(ack);
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.onPlaybackStart = () => hideAnim();
        else hideAnim();

        if (textDisplay) textDisplay.style.display = 'none';
        if (blobContainer) {
            blobContainer.classList.remove('blob-top');
            blobContainer.classList.add('blob-centered');
        }

        await this.speak(ack);
        hideAnim(); // safety: no-op if already removed
        if (ack && ack.length > 8) {
            this.spokenNarrations.push({ stage: 'chapter_choice_ack', text: ack });
            this.recordStepContext('chapter_choice_ack', ack);
        }

        return chapter;
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
            },
            health: {
                question: isHindi
                    ? 'पिछले कुछ महीनों में सेहत के मामले में कुछ ध्यान खींच रहा है?'
                    : 'Has anything about your health been pulling your attention lately?',
                options: isHindi
                    ? [{ label: 'हाँ, थकान/नींद', value: 'energy' }, { label: 'हाँ, कोई पुराना issue', value: 'chronic' }, { label: 'सब ठीक है', value: 'fine' }]
                    : [{ label: 'Yes -energy/sleep', value: 'energy' }, { label: 'Yes -a recurring issue', value: 'chronic' }, { label: 'All steady', value: 'fine' }]
            },
            wealth: {
                question: isHindi
                    ? 'पैसे के मामले में अभी सबसे बड़ा सवाल क्या है?'
                    : 'What is the biggest money question on your mind right now?',
                options: isHindi
                    ? [{ label: 'Income बढ़ाना', value: 'income' }, { label: 'Investment timing', value: 'invest' }, { label: 'कर्ज़ / EMI', value: 'debt' }]
                    : [{ label: 'Growing income', value: 'income' }, { label: 'When to invest', value: 'invest' }, { label: 'Debt / EMI', value: 'debt' }]
            },
            longevity: {
                question: isHindi
                    ? 'क्या आप चाहते हैं कि मैं protective remedies पर ज्यादा focus करूँ?'
                    : 'Would you like me to focus more on protective remedies?',
                options: isHindi
                    ? [{ label: 'हाँ, ज़रूर', value: 'yes' }, { label: 'सिर्फ overview', value: 'overview' }]
                    : [{ label: 'Yes, please', value: 'yes' }, { label: 'Just an overview', value: 'overview' }]
            },
            legal: {
                question: isHindi
                    ? 'क्या इस वक़्त कोई dispute, contract या legal matter चल रहा है?'
                    : 'Is there any dispute, contract, or legal matter open right now?',
                options: isHindi
                    ? [{ label: 'हाँ, active है', value: 'active' }, { label: 'जल्द आ सकता है', value: 'soon' }, { label: 'नहीं', value: 'no' }]
                    : [{ label: 'Yes, active', value: 'active' }, { label: 'Possibly soon', value: 'soon' }, { label: 'No', value: 'no' }]
            },
            publicLife: {
                question: isHindi
                    ? 'क्या आप किसी public role या leadership position में हैं या आना चाहते हैं?'
                    : 'Are you in -or moving toward -any public or leadership role?',
                options: isHindi
                    ? [{ label: 'हाँ, अभी हूँ', value: 'in' }, { label: 'आना चाहता/चाहती हूँ', value: 'aspiring' }, { label: 'नहीं', value: 'no' }]
                    : [{ label: 'Yes, already', value: 'in' }, { label: 'Aspiring to', value: 'aspiring' }, { label: 'No', value: 'no' }]
            }
        };

        const prompt = prompts[chapterKey];
        if (!prompt) return 'default';

        // Pre-warm TTS for the question
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(prompt.question);

        const answer = await this.showValidationQuestion(prompt.question, prompt.options);
        const chosen = prompt.options.find(o => o.value === answer);
        this.recordStepContext(`micro_${chapterKey}`, `Q: ${prompt.question} | A: ${chosen?.label || answer}`);

        // Show reading animation + AI ack (same as profile questions)
        const hideAnim = this._showAnswerReadingAnim(isHindi);
        const ack = await this._generateMcqAck(prompt.question, chosen?.label || answer, answer, isHindi);
        if (ack && window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(ack);
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.onPlaybackStart = () => hideAnim();
        else hideAnim();
        await this.speak(ack);
        hideAnim(); // safety: no-op if already removed
        if (ack && ack.length > 8) {
            this.spokenNarrations.push({ stage: `micro_${chapterKey}_ack`, text: ack });
            this.recordStepContext(`micro_${chapterKey}_ack`, ack);
        }

        return answer;
    },

    /**
     * Build the chapter delivery order based on user choice.
     */
    getChapterOrder(choice) {
        // Universal core chapters always covered for every user.
        const core = ['love', 'career', 'year', 'health', 'wealth'];
        // Niche/sensitive chapters - only added to the delivery if the user explicitly picks them.
        const niche = ['longevity', 'legal', 'publicLife'];
        const includeChosenIfNiche = choice && niche.includes(choice) ? [choice] : [];
        // Put the user's chosen chapter first, then the remaining core chapters, then the niche pick (if any), then warning.
        const remaining = core.filter((c) => c !== choice);
        const ordered = [
            ...(choice && core.includes(choice) ? [choice] : []),
            ...includeChosenIfNiche,
            ...remaining,
            'warning'
        ];
        // De-duplicate while preserving order.
        return ordered.filter((c, i, arr) => arr.indexOf(c) === i);
    },

    /**
     * Show the return hook at the end of the session.
     */
    async showReturnHook(extraContext = null) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const aiContext = {
            ...this.buildBaseAIContext(),
            ...(extraContext || {})
        };

        const hookNarration = await this.withFiller(
            () => this.generateDirectReadingSection('returnHook', aiContext),
            'thinking'
        );

        if (hookNarration && hookNarration.length > 20) {
            await this.speak(hookNarration);
            this.spokenNarrations.push({ stage: 'returnHook', text: hookNarration });
            this.recordStepContext('returnHook', hookNarration);
            this.returnHookType = 'timing_shift';
        }
    },

    // ============================================================
    //  LIVE ANALYSIS THEATRE - Filler lines during calculations
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

        // Saturn dasha - multiple variants
        if (dasha && /saturn|shani/i.test(dasha)) {
            const variants = isHindi ? [
                `आपकी शनि दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है - क्या पिछले कुछ सालों में जिम्मेदारियाँ अचानक बढ़ गई हैं, जैसे सब कुछ आप पर आ गया?`,
                `शनि दशा में अक्सर एक phase आता है जहाँ लगता है कि मेहनत का result नहीं मिल रहा - क्या आपने ये महसूस किया?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ सालों में'} कोई relationship या family situation ऐसी बनी जिसने आपको अंदर से mature कर दिया?`
            ] : [
                `Your Saturn dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} - have you felt responsibilities suddenly multiply, as if everything landed on your shoulders?`,
                `During Saturn dasha there is often a phase where hard work does not seem to pay off - have you experienced that?`,
                `Has a relationship or family situation ${dashaStartYear ? `since ${dashaStartYear}` : 'in recent years'} forced you to grow up faster than you wanted?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Rahu dasha - multiple variants
        if (dasha && /rahu/i.test(dasha)) {
            const variants = isHindi ? [
                `राहु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है - क्या आपको लगा कि जिन्दगी में अचानक direction बदल गई, बिना plan किए?`,
                `राहु period में अक्सर एक ऐसी चीज से obsession हो जाता है जो पहले कभी matter नहीं करती थी - क्या ये हुआ?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के आसपास` : 'कुछ समय पहले'} कोई बड़ा change आया - job, city, या जिन्दगी का पूरा setup बदला?`
            ] : [
                `Your Rahu dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} - have you felt life suddenly shift direction without any plan?`,
                `During Rahu periods, people often develop an unexpected obsession with something that never mattered before - has that happened?`,
                `Did a major change happen ${dashaStartYear ? `around ${dashaStartYear}` : 'recently'} - a job shift, a city move, or your entire life setup changed?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Jupiter dasha
        if (dasha && /jupiter|guru/i.test(dasha)) {
            const variants = isHindi ? [
                `गुरु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है - क्या हाल ही में कोई मौका आया जो उम्मीद से बड़ा निकला?`,
                `गुरु period में अक्सर teaching, mentoring या spiritual interest बढ़ता है - क्या आपने ये अपने अंदर notice किया?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ समय से'} लगता है कि आप पहले से ज्यादा wise decisions ले रहे हैं - लेकिन दुनिया ने अभी recognize नहीं किया?`
            ] : [
                `Your Jupiter dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} - did an opportunity show up recently that turned out bigger than expected?`,
                `Jupiter periods often spark interest in teaching, mentoring, or spirituality - have you noticed this shift in yourself?`,
                `Have you felt ${dashaStartYear ? `since ${dashaStartYear}` : 'lately'} that you are making wiser decisions but the world has not caught up to recognize it?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Ketu dasha
        if (dasha && /ketu/i.test(dasha)) {
            const variants = isHindi ? [
                `केतु दशा${dashaStartYear ? ` ${dashaStartYear} से` : ''} चल रही है - क्या कभी लगता है कि कुछ छूट रहा है, पर समझ नहीं आता क्या?`,
                `केतु period में अक्सर पुरानी चीजें टूटती हैं - कोई attachment, koi belief, या कोई रिश्ता। क्या ऐसा कुछ हुआ?`,
                `क्या ${dashaStartYear ? `${dashaStartYear} के बाद` : 'कुछ समय से'} किसी चीज से naturally detach हो गए जो पहले बहुत matter करती थी?`
            ] : [
                `Your Ketu dasha${dashaStartYear ? ` started ${dashaStartYear}` : ''} - do you feel something is missing but you cannot name what it is?`,
                `Ketu periods often break old attachments - a belief, a habit, or a relationship. Has something like that happened?`,
                `Have you ${dashaStartYear ? `since ${dashaStartYear}` : 'recently'} naturally detached from something that used to matter a lot?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Mercury dasha
        if (dasha && /mercury|budh/i.test(dasha)) {
            const variants = isHindi ? [
                `बुध दशा चल रही है - क्या आपने notice किया कि हाल में communication या learning से जुड़ा कोई बड़ा shift आया?`,
                `बुध period में overthinking बढ़ जाती है - क्या रात को सोते वक्त दिमाग बंद नहीं होता, हजार thoughts चलते रहते हैं?`
            ] : [
                `Your Mercury dasha is active - have you noticed a major shift in how you communicate or learn?`,
                `Mercury periods amplify overthinking - do you find your mind racing at night, unable to switch off?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Venus dasha
        if (dasha && /venus|shukra/i.test(dasha)) {
            const variants = isHindi ? [
                `शुक्र दशा चल रही है - क्या relationships या comfort से जुड़ा कोई बड़ा change आया हाल में?`,
                `शुक्र period में अक्सर luxury या beauty की तरफ pull बढ़ता है - क्या आपने ये अपने अंदर देखा?`
            ] : [
                `Your Venus dasha is active - has there been a major shift in relationships or your comfort zone recently?`,
                `Venus periods often increase a pull toward luxury or beauty - have you noticed this?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Mars dasha
        if (dasha && /mars|mangal/i.test(dasha)) {
            const variants = isHindi ? [
                `मंगल दशा चल रही है - क्या हाल में गुस्सा या impatience बढ़ा है, छोटी-छोटी बातों पर react हो जाता है?`,
                `मंगल period में energy तो बढ़ती है लेकिन conflicts भी - क्या किसी से टकराव हुआ हाल में?`
            ] : [
                `Your Mars dasha is active - have you noticed more anger or impatience flaring up over small things?`,
                `Mars periods bring energy but also conflict - have you had an unexpected clash with someone recently?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Moon dasha
        if (dasha && /moon|chandra/i.test(dasha)) {
            const variants = isHindi ? [
                `चन्द्र दशा चल रही है - क्या emotions ज्यादा intense हो गए हैं, जैसे mood swings या sudden emotional waves?`,
                `चन्द्र period में home और family matters ज्यादा surface पर आते हैं - क्या घर से जुड़ा कोई बड़ा change हुआ?`
            ] : [
                `Your Moon dasha is active - have your emotions become more intense, with unexpected mood shifts?`,
                `Moon periods bring home and family matters to the surface - has something major shifted at home?`
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Sun dasha
        if (dasha && /sun|surya/i.test(dasha)) {
            const variants = isHindi ? [
                `सूर्य दशा चल रही है - क्या career या authority से जुड़ा कोई major shift आया, जैसे promotion, recognition, या किसी से टकराव?`,
            ] : [
                `Your Sun dasha is active - has there been a career shift, a recognition moment, or an authority clash?`,
            ];
            return variants[Math.floor(Math.random() * variants.length)];
        }

        // Lifepath based (fallback)
        if ([7, 11, 22].includes(lp)) {
            return isHindi
                ? `Life path ${lp} - क्या आप अक्सर दूसरों से अलग सोचते हैं, और इसकी वजह से एक तरह का अकेलापन महसूस होता है?`
                : `As a life path ${lp} - do you often think differently from others and feel a quiet loneliness because of it?`;
        }
        if ([2, 6, 9].includes(lp)) {
            return isHindi
                ? `Life path ${lp} - क्या आप दूसरों की जरूरतें अपनी से पहले रख देते हैं, अक्सर बिना सोचे?`
                : `As a life path ${lp} - do you put others' needs before your own, often without thinking?`;
        }
        if ([1, 5, 8].includes(lp)) {
            return isHindi
                ? `Life path ${lp} - क्या कभी लगता है कि pace तो आपकी तेज है, पर दुनिया साथ नहीं दे रही?`
                : `As a life path ${lp} - do you sometimes feel your pace is fast but the world is not keeping up?`;
        }
        if ([3, 33].includes(lp)) {
            return isHindi
                ? `Life path ${lp} - क्या लोग आपसे कहते हैं कि आप बहुत expressive हैं, लेकिन अंदर एक part है जो कोई नहीं जानता?`
                : `As a life path ${lp} - do people say you are very expressive, but there is a part inside that nobody knows?`;
        }
        if ([4].includes(lp)) {
            return isHindi
                ? `Life path 4 - क्या आपने महसूस किया कि आप structure और stability में ज्यादा comfortable हैं, लेकिन जिन्दगी बार-बार uncertainty फेंकती है?`
                : `As a life path 4 - do you find comfort in structure, but life keeps throwing uncertainty at you?`;
        }
        // Ultimate fallback with moon sign
        return isHindi
            ? `${moonSign ? `${moonSign} चन्द्र राशि` : 'आपकी कुंडली'} में जो pattern दिख रहा है - क्या जिन्दगी में कोई चीज बार-बार repeat होती है, एक ही तरह की situation बार-बार आती है?`
            : `Based on what ${moonSign ? `your ${moonSign} Moon` : 'your chart'} is showing - do you feel certain situations keep repeating in your life, the same kind of thing happening again and again?`;
    },

    /**
     * Ask a single profile question with chart-aware acknowledgment.
     * @param {object} q - question from getProfileQuestions()
     * @returns {Promise<string>} the selected value
     */
    async askSingleProfileQuestion(q) {
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        const spokenLead = String(q.spoken || '').trim();
        const spokenQuestion = spokenLead && spokenLead !== q.question && !/[?؟]$/.test(spokenLead)
            ? `${spokenLead} ${q.question}`
            : (spokenLead || q.question);

        // Pre-warm TTS so playback starts instantly when question appears
        if (window.MayaVoice && !MayaVoice.isMuted) {
            MayaVoice.prefetchSpeech(spokenQuestion);
        }

        const answer = await this.showValidationQuestion(
            q.question,
            q.options.map(o => ({ label: o.label, value: o.value })),
            spokenQuestion
        );

        // Store the answer with insight
        const chosen = q.options.find(o => o.value === answer);
        const insightText = chosen?.insight || answer;
        this.sessionMemory.profileAnswers[q.key] = `${answer} (${insightText})`;
        this.recordStepContext(`profile_${q.key}`, `Q: ${q.question} | A: ${chosen?.label || answer}`);

        // Show reading animation + AI ack (shared across all MCQs)
        const hideAnim = this._showAnswerReadingAnim(isHindi);
        const ack = await this._generateMcqAck(q.question, chosen?.label || answer, answer, isHindi);
        // Pre-warm ack TTS while we set up the callback
        if (ack && window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(ack);
        if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.onPlaybackStart = () => hideAnim();
        else hideAnim();
        await this.speak(ack);
        hideAnim(); // safety: no-op if already removed
        if (ack && ack.length > 8) {
            this.spokenNarrations.push({ stage: `ack_${q.key}`, text: ack });
            this.recordStepContext(`ack_${q.key}`, ack);
        }

        return answer;
    },

    /**
     * Begin the cosmic journey - CONVERSATIONAL flowing narrative
     * Questions are distributed throughout the funnel with AI conversations in between.
     * Flow: Intro → Kundli + Q1 → LifePath + Q2 → Destiny + Q3 → SoulUrge + Q4 → Teaser + Q5 → Gate
     */
    async beginJourney() {
        console.log('🌟 Beginning cosmic journey...');
        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';
        this.resetSessionMemory();

        try {
            // Show progress meter
            this.showProgressMeter();

            // Build questions adaptively per stage so each next question can use previous answers.
            const askedProfileKeys = new Set();

            // ═══ STEP 1: Proper MAYA Introduction ═══
            console.log('🗣️ MAYA introduction...');
            const profile = this.personalization || {};
            const dasha = profile.currentDasha?.vedic || profile.currentDasha?.planet || '';
            const moonSign = profile.moonSign || profile.vedic?.name || '';
            const ascendant = profile.ascendant?.name || '';
            const sunSign = profile.sunSign || '';

            // Single combined intro -no gaps between sentences
            const introCtx = this._buildJourneyIntroContext();
            const askMayaActive = introCtx.askMayaActive;
            const topicLabel = introCtx.topicLabel;
            const askMayaSubject = introCtx.askMayaSubject;

            // Ultra-fast start: speak local intro immediately and keep AI prefetch
            // non-blocking for downstream stages.
            const fullIntro = this._getLocalJourneyIntro({
                isHindi,
                askMayaActive,
                guideName: introCtx.guideName,
                isMale: introCtx.isMale,
                topicLabel,
                subjectPhrase: askMayaSubject || (isHindi ? 'आपकी reading' : 'your reading')
            });

            if (this._startupIntroPromise) {
                this._startupIntroPromise.catch(() => '');
            }

            this._firstIntroResolvedAt = performance.now();
            if (this._perfStartAt > 0) {
                const introMs = Math.round(this._firstIntroResolvedAt - this._perfStartAt);
                console.log(`⏱️ First intro ready in ${introMs}ms`);
            }

            this._firstSpeechRequestedAt = performance.now();
            if (window.MayaVoice) {
                MayaVoice.onPlaybackStart = () => {
                    this._firstSpeechPlaybackAt = performance.now();
                    if (this._perfStartAt > 0) {
                        const firstSoundMs = Math.round(this._firstSpeechPlaybackAt - this._perfStartAt);
                        const introToSoundMs = Math.round(this._firstSpeechPlaybackAt - this._firstSpeechRequestedAt);
                        console.log(`⚡ First speech playback started in ${firstSoundMs}ms (intro-to-sound ${introToSoundMs}ms)`);
                        if (firstSoundMs > 1500) {
                            console.warn(`🐢 Startup speech is slow (${firstSoundMs}ms). Target is <= 1500ms.`);
                        }
                    }
                };
            }

            const introSpeechPromise = this.speak(fullIntro, {
                urgentStart: true,
                preferLocalFallback: true
            });
            this._startPostIntroParallelPrefetch().catch((error) => {
                console.warn('Post-intro parallel prefetch failed:', error?.message || error);
            });
            await introSpeechPromise;
            this.spokenNarrations.push({ stage: 'opening', text: fullIntro });
            this.recordStepContext('opening', fullIntro);
            this.advanceProgress('chart_opened');
            this.advanceProgress('first_impression');
            await this.sleepPaced(this.stageTiming.introSettle);

            // ═══ STEP 2: Kundli formation ═══
            console.log('📊 Showing calculation overlay...');
            this.showCalculationOverlay();
            await this.sleepPaced(this.stageTiming.calculationLeadIn);

            console.log('🪐 Animating Kundli...');
            await this.animateKundliFormation();
            this.advanceProgress('kundli');

            // ═══ STEP 2b: Post-kundli bridge straight into Q1 ═══
            // (Previously we spoke a hardcoded "let me ask a few questions" line
            // here AND the AI bridge below — three promises of a question before
            // any actual question appeared, which felt repetitive and dead.
            // The unified-script preQuestionBridge already carries the
            // transition naturally, so we go straight into it.)
            const preQuestionBridge = await this.generatePreQuestionBridge({
                isHindi,
                askMayaActive,
                topicLabel,
                subjectPhrase: askMayaSubject || (isHindi ? 'आपकी reading' : 'your reading')
            });
            if (preQuestionBridge) {
                await this.speak(preQuestionBridge);
                this.spokenNarrations.push({ stage: 'preQuestionBridge', text: preQuestionBridge });
                this.recordStepContext('preQuestionBridge', preQuestionBridge);
            }

            // ═══ STEP 3: First question - after kundli (recent upheaval) ═══
            // Pre-generate teaser content in background while questions happen
            const predictionItems = this.buildPredictionItems();
            const aiContext = this.buildBaseAIContext(predictionItems);
            if (!askMayaActive) {
                this.getContent('teaserRevealNarration', async () => {
                    const combined = await this.generateDirectReadingSection('combinedTeaser', aiContext);
                    if (combined && combined.length > 40) {
                        const parts = combined.split(/\[\[pause-250\]\]/i).map(s => s.trim()).filter(Boolean);
                        if (parts.length >= 3) this.unresolvedThread = parts[parts.length - 1];
                        return combined;
                    }
                    const segments = [];
                    const identityTruth = await this.generateDirectReadingSection('identityTruth', aiContext);
                    if (identityTruth?.length > 20) segments.push(identityTruth.trim());
                    const emotionalPattern = await this.generateDirectReadingSection('emotionalPattern', aiContext);
                    if (emotionalPattern?.length > 20) segments.push(emotionalPattern.trim());
                    const unresolvedThread = await this.generateDirectReadingSection('unresolvedThread', aiContext);
                    if (unresolvedThread?.length > 20) { segments.push(unresolvedThread.trim()); this.unresolvedThread = unresolvedThread; }
                    return segments.join(' [[pause-250]] ');
                });
            }
            // Also pre-generate email gate narration
            const emailPregen = askMayaActive
                ? Promise.resolve(this._getLocalDirectSectionFallback('emailGate', aiContext))
                : this.generateDirectReadingSection('emailGate', aiContext);
            // Store the promise for later use in showSuspenseBridge
            this._emailNarrationPregen = emailPregen;

            if (!askMayaActive) {
                const q1 = await this.getAdaptiveQuestionForStage('q1_kundli', askedProfileKeys);
                if (q1) {
                    console.log('🎯 Q1 after kundli: adaptive...');
                    await this.askSingleProfileQuestion(q1);
                    if (q1.key) askedProfileKeys.add(q1.key);
                }
            }

            // ═══ STEP 4: ALL numbers in one unified UI ═══
            console.log('📊 Unified numbers calculation...');
            await this.animateAllNumbersCalculation();
            this.advanceProgress('life_path');
            this.advanceProgress('destiny');
            this.advanceProgress('soul_urge');

            // ═══ STEP 5: Second question -after numbers (current phase) ═══
            if (!askMayaActive) {
                const transQ2 = isHindi
                    ? 'अच्छा, अब numbers और कुंडली दोनों ने अपनी बात कह दी है। पर एक बात बताइए।'
                    : 'Now both the numbers and the chart have shared what they see. But tell me one thing.';
                // Generate question + prefetch transition TTS in parallel
                if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(transQ2);
                const q2 = await this.getAdaptiveQuestionForStage('q2_numbers', askedProfileKeys);
                if (q2) {
                    console.log('🎯 Q2 after numbers: adaptive...');
                    await this.speak(transQ2);
                    this.spokenNarrations.push({ stage: 'transition_q2', text: transQ2 });
                    this.recordStepContext('transition_q2', transQ2);
                    await this.askSingleProfileQuestion(q2);
                    if (q2.key) askedProfileKeys.add(q2.key);
                }
            }

            // ═══ STEP 6: Third question -money pattern ═══
            // In Ask-Maya flow we DO NOT open unrelated topic doors (money, relationships, etc).
            // Instead we ask one focused follow-up that stays on the user's question topic, then
            // skip Q3/Q4/Q5 entirely and head into the teaser + email gate.
            if (askMayaActive) {
                const focusedTrans = isHindi
                    ? `अब ${topicLabel} पर एक छोटा सवाल — जिससे जवाब और सटीक हो जाए।`
                    : `One quick follow-up about your ${topicLabel} — so the answer lands precisely.`;
                if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(focusedTrans);
                const qFocus = await this.getAdaptiveQuestionForStage('q_ask_maya_focus', askedProfileKeys);
                if (qFocus) {
                    await this.speak(focusedTrans);
                    this.spokenNarrations.push({ stage: 'transition_ask_maya_focus', text: focusedTrans });
                    this.recordStepContext('transition_ask_maya_focus', focusedTrans);
                    await this.askSingleProfileQuestion(qFocus);
                    if (qFocus.key) askedProfileKeys.add(qFocus.key);
                }
            } else {
                const transQ3 = isHindi
                    ? 'पैसों से जुड़ा एक pattern दिख रहा है कुंडली में। ये बताइए।'
                    : 'I see a pattern around money in your chart. Tell me this.';
                if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(transQ3);
                const q3 = await this.getAdaptiveQuestionForStage('q3_money', askedProfileKeys);
                if (q3) {
                    console.log('🎯 Q3: adaptive...');
                    await this.speak(transQ3);
                    this.spokenNarrations.push({ stage: 'transition_q3', text: transQ3 });
                    this.recordStepContext('transition_q3', transQ3);
                    await this.askSingleProfileQuestion(q3);
                    if (q3.key) askedProfileKeys.add(q3.key);
                }

                // ═══ STEP 7: Fourth question -relationship status ═══
                const transQ4 = isHindi
                    ? 'रिश्तों के बारे में भी कुछ दिख रहा है। एक छोटा सवाल और पूछ लूँ?'
                    : 'I can see something about your relationships too. May I ask one more thing?';
                if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(transQ4);
                const q4 = await this.getAdaptiveQuestionForStage('q4_relationship', askedProfileKeys);
                if (q4) {
                    console.log('🎯 Q4: adaptive...');
                    await this.speak(transQ4);
                    this.spokenNarrations.push({ stage: 'transition_q4', text: transQ4 });
                    this.recordStepContext('transition_q4', transQ4);
                    await this.askSingleProfileQuestion(q4);
                    if (q4.key) askedProfileKeys.add(q4.key);
                }
            }

            // ═══ STEP 8: Hide overlay ═══
            console.log('📊 Hiding overlay...');
            await this.hideCalculationOverlay();

            // ═══ STEP 9: Personalized validation (yes/somewhat/no) ═══
            console.log('✅ Personalized validation...');
            this.currentPhase = this.PHASES.VALIDATION;
            const personalQ = this.buildPersonalizedValidation();
            await this.showMiniCheck(personalQ);

            // ═══ STEP 10: Teaser reveal (accuracy shock + identity + emotional pattern) ═══
            console.log('🎁 Showing teaser reveal...');
            await this.showTeaserReveal();
            this.advanceProgress('accuracy_hit');
            this.advanceProgress('deep_patterns');

            // ═══ STEP 11: Fifth question - after teaser (repeating pattern) ═══
            // In Ask-Maya flow we skip Q5 entirely — the user already gave us their question
            // plus 2 focused MCQs; another generic "I keep seeing one more thing" would dilute
            // the answer and risk repetition. Head straight to the email gate.
            if (!askMayaActive) {
                const transQ5 = isHindi
                    ? 'अब तक जो दिखा वो बस शुरुआत है। एक और बात है जो मुझे बार-बार दिख रही है।'
                    : 'What I have shared so far is just the beginning. There is one more thing I keep seeing.';
                if (window.MayaVoice && !MayaVoice.isMuted) MayaVoice.prefetchSpeech(transQ5);
                const q5 = await this.getAdaptiveQuestionForStage('q5_pattern', askedProfileKeys);
                if (q5) {
                    console.log('🎯 Q5 after teaser: adaptive...');
                    await this.speak(transQ5);
                    this.spokenNarrations.push({ stage: 'transition_q5', text: transQ5 });
                    this.recordStepContext('transition_q5', transQ5);
                    await this.askSingleProfileQuestion(q5);
                    if (q5.key) askedProfileKeys.add(q5.key);
                }
            }

            // ═══ STEP 12: Suspense bridge → email gate ═══
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
    //  PROGRESS METER - visual gamification during funnel
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

        await this.sleepPaced(this.stageTiming.calcStepDelay + 120);
        this.addCalculationStep(stepsContainer, `${day} → ${dayReduced}`, 'Day');

        await this.sleepPaced(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${month} → ${monthReduced}`, 'Month');

        await this.sleepPaced(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${year} → ${yearSum} → ${yearReduced}`, 'Year');

        await this.sleepPaced(this.stageTiming.calcStepDelay);
        this.addCalculationStep(stepsContainer, `${dayReduced} + ${monthReduced} + ${yearReduced} = ${total} → ${lifePath}`, 'Life Path', true);

        // Keep prior visual reveals visible and append the Life Path card instead of replacing them.
        this.appendResultCard('life-path', 'Your Life Path', lifePath, 'life-path');

        // Wait for speech to complete
        await speakPromise;
        await this.sleepPaced(this.stageTiming.stageSettle);
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

            await this.sleepPaced(this.stageTiming.letterDelay);
        }

        await this.sleepPaced(this.stageTiming.calcStepDelay - 200);

        // Show sum
        const stepsContainer = document.getElementById('destiny-steps');
        this.addCalculationStep(stepsContainer, `Sum = ${sum} → ${destiny}`, 'Destiny', true);

        this.appendResultCard('destiny', 'Your Destiny', destiny, 'destiny');

        await speakPromise;
        await this.sleepPaced(this.stageTiming.stageSettle);
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

            await this.sleepPaced(isVowel ? this.stageTiming.vowelDelay : this.stageTiming.letterDelay - 40);
        }

        await this.sleepPaced(this.stageTiming.calcStepDelay - 200);

        // Show sum
        const stepsContainer = document.getElementById('soul-steps');
        this.addCalculationStep(stepsContainer, `Vowels = ${vowelSum} → ${soulUrge}`, 'Soul Urge', true);

        this.appendResultCard('soul-urge', 'Your Soul Urge', soulUrge, 'soul-urge');

        await speakPromise;
        await this.sleepPaced(this.stageTiming.stageSettle);
    },

    // ============================================================
    //  UNIFIED NUMBERS CALCULATION - All 3 in one beautiful UI
    // ============================================================

    /**
     * Calculate and animate Life Path, Destiny, and Soul Urge
     * numbers simultaneously in one unified, beautifully animated UI.
     * AI narrates about all three numbers together for engagement.
     */
    async animateAllNumbersCalculation() {
        const display = document.getElementById('calc-display');
        if (!display) return;

        const isHindi = MayaUtils?.storage?.get('maya_language') === 'hi';

        // ── Gather all calculation data up front ──
        const date = window.MayaAstrology
            ? MayaAstrology.parseDate(this.userData.birthDate)
            : new Date(this.userData.birthDate);
        if (!date) { console.error('Invalid birth date'); return; }

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const lifePath = this.calculations.lifePath;
        const dayReduced = MayaNumerology.reduceNumber(day, false);
        const monthReduced = MayaNumerology.reduceNumber(month, false);
        const yearSum = String(year).split('').reduce((s, d) => s + parseInt(d), 0);
        const yearReduced = MayaNumerology.reduceNumber(year, false);
        const lpTotal = dayReduced + monthReduced + yearReduced;

        const destiny = this.calculations.destiny;
        const fullName = this.userData.name.toUpperCase();
        const nameLetters = fullName.replace(/[^A-Z]/g, '');
        const nameBreakdown = MayaNumerology.getNameBreakdown(this.userData.name);
        const destSum = nameBreakdown.reduce((s, item) => s + item.value, 0);

        const soulUrge = this.calculations.soulUrge;
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        let vowelSum = 0;
        for (const ch of nameLetters) {
            if (vowels.includes(ch)) vowelSum += MayaNumerology.getLetterValue(ch);
        }

        // ── Show loading ──
        this.showCalcLoading(isHindi
            ? 'तीनों cosmic numbers एक साथ निकाल रहे हैं...'
            : 'Calculating all three cosmic numbers...');

        // ── Fire AI narration in background (about ALL numbers) ──
        const aiContext = this.buildBaseAIContext();
        const spokenDate = this.formatDateSpoken(this.userData.birthDate);

        const narrativePromise = this.withFiller(() => this.getContent('allNumbersNarrative', async () => {
            // Try a unified prompt that covers all three numbers
            const combinedPrompt = this.buildDirectSectionPrompt('numbersReveal', aiContext);
            if (window.MayaAI?.callFast) {
                const result = await MayaAI.callFast(combinedPrompt, {
                    timeoutMs: 2200,
                    maxTokens: 420,
                    fastFail: true,
                    maxKeyAttempts: 1
                });
                if (result && result.length > 30) return this.sanitizeNarrationText(result);
            }
            if (window.MayaAI?.callGemini) {
                const result = await MayaAI.callGemini(combinedPrompt, {
                    timeoutMs: 2600,
                    maxTokens: 420,
                    fastFail: true,
                    maxKeyAttempts: 1
                });
                if (result && result.length > 30) return this.sanitizeNarrationText(result);
            }
            // Fallback to life path explanation
            if (window.MayaStatements?.getLifePathExplanation) {
                const explanation = await MayaStatements.getLifePathExplanation(
                    day, month, year, dayReduced, monthReduced, yearSum, yearReduced, lpTotal,
                    lifePath, this.firstName, spokenDate, aiContext
                );
                if (explanation && explanation.length > 20) return explanation;
            }
            return null;
        }), 'calculating');

        // ── Build unified UI ──
        display.innerHTML = `
            <div class="unified-numbers">
                <div class="unified-numbers__header">
                    <h3>${isHindi ? '✦ आपके Cosmic Numbers ✦' : '✦ Your Cosmic Numbers ✦'}</h3>
                </div>

                <div class="unified-numbers__grid">
                    <!-- LIFE PATH CARD -->
                    <div class="unified-num-card" id="unum-lifepath" data-state="waiting">
                        <div class="unified-num-card__icon"><i class="bi bi-star-fill"></i></div>
                        <div class="unified-num-card__label">${isHindi ? 'Life Path' : 'Life Path'}</div>
                        <div class="unified-num-card__value" id="unum-lp-value">
                            <span class="unified-num-card__spinner"></span>
                        </div>
                        <div class="unified-num-card__steps" id="unum-lp-steps"></div>
                    </div>

                    <!-- DESTINY CARD -->
                    <div class="unified-num-card" id="unum-destiny" data-state="waiting">
                        <div class="unified-num-card__icon"><i class="bi bi-bullseye"></i></div>
                        <div class="unified-num-card__label">${isHindi ? 'Destiny' : 'Destiny'}</div>
                        <div class="unified-num-card__value" id="unum-dest-value">
                            <span class="unified-num-card__spinner"></span>
                        </div>
                        <div class="unified-num-card__steps" id="unum-dest-steps"></div>
                    </div>

                    <!-- SOUL URGE CARD -->
                    <div class="unified-num-card" id="unum-soulurge" data-state="waiting">
                        <div class="unified-num-card__icon"><i class="bi bi-heart-pulse-fill"></i></div>
                        <div class="unified-num-card__label">${isHindi ? 'Soul Urge' : 'Soul Urge'}</div>
                        <div class="unified-num-card__value" id="unum-su-value">
                            <span class="unified-num-card__spinner"></span>
                        </div>
                        <div class="unified-num-card__steps" id="unum-su-steps"></div>
                    </div>
                </div>

                <div class="unified-numbers__breakdown" id="unum-breakdown"></div>
            </div>
        `;

        const fastCalcDelay = Math.max(120, Math.min(this.stageTiming.calcStepDelay, 260));
        const fastInsightDelay = Math.max(140, Math.min(this.stageTiming.kundliInsightDelay, 320));

        await this.sleepPaced(fastCalcDelay);

        // ── Animate LIFE PATH (stagger 1) ──
        const lpCard = document.getElementById('unum-lifepath');
        const lpSteps = document.getElementById('unum-lp-steps');
        const lpValue = document.getElementById('unum-lp-value');
        if (lpCard) lpCard.dataset.state = 'calculating';

        await this.sleepPaced(fastCalcDelay);
        this.addCalculationStep(lpSteps, `${isHindi ? 'जन्म तिथि' : 'Birth date'} → ${lifePath}`, '', true);

        if (lpValue) lpValue.innerHTML = `<span class="unified-num-card__number unified-num-pop">${lifePath}</span>`;
        if (lpCard) lpCard.dataset.state = 'done';

        // ── Animate DESTINY (stagger 2) ──
        const destCard = document.getElementById('unum-destiny');
        const destSteps = document.getElementById('unum-dest-steps');
        const destValue = document.getElementById('unum-dest-value');
        if (destCard) destCard.dataset.state = 'calculating';

        await this.sleepPaced(fastInsightDelay);
        // Show compact name breakdown
        const breakdown = document.getElementById('unum-breakdown');
        if (breakdown) {
            const letterHTML = nameLetters.split('').map(l => {
                const v = MayaNumerology.getLetterValue(l);
                return `<span class="unum-letter-chip animate-in"><span class="unum-letter">${l}</span><span class="unum-letter-val">${v}</span></span>`;
            }).join('');
            breakdown.innerHTML = `
                <div class="unum-name-breakdown">
                    <span class="unum-breakdown-label">${isHindi ? 'नाम विश्लेषण' : 'Name Analysis'}: ${this.userData.name}</span>
                    <div class="unum-letter-grid">${letterHTML}</div>
                </div>
            `;
        }

        await this.sleepPaced(fastCalcDelay);
        this.addCalculationStep(destSteps, `${isHindi ? 'अक्षर योग' : 'Letter sum'} = ${destSum} → ${destiny}`, '', true);

        if (destValue) destValue.innerHTML = `<span class="unified-num-card__number unified-num-pop">${destiny}</span>`;
        if (destCard) destCard.dataset.state = 'done';

        // ── Animate SOUL URGE (stagger 3) ──
        const suCard = document.getElementById('unum-soulurge');
        const suSteps = document.getElementById('unum-su-steps');
        const suValue = document.getElementById('unum-su-value');
        if (suCard) suCard.dataset.state = 'calculating';

        await this.sleepPaced(fastInsightDelay);
        // Highlight vowels in the letter grid
        if (breakdown) {
            breakdown.querySelectorAll('.unum-letter-chip').forEach(chip => {
                const letter = chip.querySelector('.unum-letter')?.textContent;
                if (letter && vowels.includes(letter)) {
                    chip.classList.add('unum-letter-chip--vowel');
                }
            });
        }

        await this.sleepPaced(fastInsightDelay);
        this.addCalculationStep(suSteps, `${isHindi ? 'स्वर योग' : 'Vowels'} = ${vowelSum} → ${soulUrge}`, '', true);

        if (suValue) suValue.innerHTML = `<span class="unified-num-card__number unified-num-pop">${soulUrge}</span>`;
        if (suCard) suCard.dataset.state = 'done';

        // ── Append result cards to the result strip ──
        this.appendResultCard('life-path', 'Life Path', lifePath, 'life-path');
        this.appendResultCard('destiny', 'Destiny', destiny, 'destiny');
        this.appendResultCard('soul-urge', 'Soul Urge', soulUrge, 'soul-urge');

        // ── Wait for AI narration and speak it ──
        const narrative = await Promise.race([
            narrativePromise,
            MayaUtils.sleep(1800).then(() => this._getLocalNarrationFallback('allNumbersNarrative'))
        ]);
        if (narrative && narrative.length > 20) {
            console.log('📢 Unified numbers narrative:', narrative.substring(0, 60) + '...');
            this.spokenNarrations.push({ stage: 'numbersReveal', text: narrative });
            await this.speak(narrative);
        }

        await this.sleepPaced(this.stageTiming.stageSettle);
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
            ? MayaKundli.generateChart(birthChart.planets, ascendant.name, 'north', {
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
                ? `सबसे पहले मैं ${this.localizeHindiText(placeLabel)} और ${timeLabel} के आधार पर आपकी कुंडली का विन्यास देख ${this._isGuiderMale() ? 'रहा' : 'रही'} हूँ। लग्न, चंद्र राशि, दशा और ग्रहों की सघनता मिलकर यह दिखा रही हैं कि आपके जीवन का ढाँचा कैसे बनता है और आने वाले महीनों में कौन-सा मोड़ उभर सकता है।`
                : `सबसे पहले मैं ${this.localizeHindiText(placeLabel)} और ${timeLabel} के आधार पर आपकी कुंडली के visible संकेत देख ${this._isGuiderMale() ? 'रहा' : 'रही'} हूँ। अभी मैं चंद्र राशि, दशा और ग्रहों की सघनता पर grounded reading ${this._isGuiderMale() ? 'रखूँगा' : 'रखूँगी'}।`
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

        await this.sleepPaced(this.stageTiming.kundliInsightDelay);
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
            predictionItems: this.buildPredictionItems(),
            kundliFormationInProgress: true
        })), 'kundli');

        if (!narrative) {
            narrative = await this.withFiller(() => this.generateDirectReadingSection('kundli', {
                ...this.buildBaseAIContext(),
                kundliDisplayFacts: visibleKundliFacts,
                predictionItems: this.buildPredictionItems(),
                kundliFormationInProgress: true
            }), 'kundli');
        }

        narrative = this._stripKundliReadyAnnouncement(narrative);
        if (!narrative) {
            narrative = isHindi
                ? `अभी आपकी कुंडली का विन्यास बन रहा है। ग्रहों की स्थिति और दशा साथ-साथ उभर रही हैं, इसलिए मैं पहला संकेत पूरा बनने से पहले ही पकड़ ${this._isGuiderMale() ? 'रहा' : 'रही'} हूँ।`
                : `Your kundli is still taking shape. The planetary positions and dasha are emerging together, so I am watching the first signal before the full reading opens.`;
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
            await this.sleepPaced(this.stageTiming.kundliSignalDelay);
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
            await this.sleepPaced(this.stageTiming.kundliSignalDelay + 40);
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
            await this.sleepPaced(this.stageTiming.kundliInsightDelay);
        }

        await speakPromise;
        await this.sleepPaced(this.stageTiming.stageSettle);
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
            // Skip the separate emailGate AI narration - the suspense bridge + email form handle the ask.
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
        const existingInput = document.getElementById('gate-phone');

        if (this.currentPhase === this.PHASES.EMAIL_GATE && existingInput) {
            if (!deferFocus) this.focusAuthField(existingInput);
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

        const countries = [
            { code: '+91', iso: 'in', name: 'India' },
            { code: '+1', iso: 'us', name: 'USA' },
            { code: '+44', iso: 'gb', name: 'UK' },
            { code: '+971', iso: 'ae', name: 'UAE' },
            { code: '+61', iso: 'au', name: 'Australia' },
            { code: '+65', iso: 'sg', name: 'Singapore' },
            { code: '+60', iso: 'my', name: 'Malaysia' },
            { code: '+1', iso: 'ca', name: 'Canada' },
            { code: '+64', iso: 'nz', name: 'New Zealand' },
            { code: '+27', iso: 'za', name: 'South Africa' },
            { code: '+49', iso: 'de', name: 'Germany' },
            { code: '+33', iso: 'fr', name: 'France' },
            { code: '+81', iso: 'jp', name: 'Japan' },
            { code: '+92', iso: 'pk', name: 'Pakistan' },
            { code: '+880', iso: 'bd', name: 'Bangladesh' },
            { code: '+94', iso: 'lk', name: 'Sri Lanka' },
            { code: '+977', iso: 'np', name: 'Nepal' }
        ];
        const countryOptions = countries.map((country) =>
            `<option value="${country.code}" data-iso="${country.iso}" ${country.iso === 'in' ? 'selected' : ''}>${country.code} ${country.name}</option>`
        ).join('');

        textDisplay.innerHTML = `
            <div class="email-gate-container phone-gate-container">
                <div class="gate-header">
                    <h3>${isHindi ? 'SMS से रीडिंग सुरक्षित करें' : 'Secure your reading with SMS'}</h3>
                    <p class="gate-subtitle">${isHindi ? `${this.firstName}, आगे की reading आपके साथ सुरक्षित रखने के लिए SMS verification चाहिए। अपना मोबाइल नंबर डालिए; ओटीपी आने में कुछ सेकंड लग सकते हैं।` : `${this.firstName}, I need SMS verification to keep the rest of your reading secure with you. Enter your mobile number; the OTP can take a few seconds to arrive.`}</p>
                </div>
                <div class="gate-benefits">
                    <div class="benefit-item"><i class="bi bi-heart-fill"></i><span>${isHindi ? 'प्रेम और रिश्तों का समय-संकेत' : 'Love and relationship timing'}</span></div>
                    <div class="benefit-item"><i class="bi bi-briefcase-fill"></i><span>${isHindi ? 'करियर और धन का अनुमान' : 'Career and wealth forecast'}</span></div>
                    <div class="benefit-item"><i class="bi bi-exclamation-triangle-fill"></i><span>${isHindi ? 'सावधानी वाले बिंदु' : 'Pressure points and cautions'}</span></div>
                    <div class="benefit-item"><i class="bi bi-calendar-event-fill"></i><span>${isHindi ? 'आने वाले चरणों की समय-रेखा' : 'Your next chapters timing map'}</span></div>
                </div>
                <form id="phone-gate-form" class="gate-form" autocomplete="off">
                    <div class="phone-input-wrapper">
                        <div class="country-code-selector" id="country-code-selector">
                            <span class="fi fi-in country-flag" id="selected-flag"></span>
                            <span class="selected-code" id="selected-code">+91</span>
                            <i class="bi bi-chevron-down country-chevron"></i>
                        </div>
                        <input type="tel" id="gate-phone" class="form-control form-control-lg phone-number-input"
                            placeholder="${isHindi ? 'मोबाइल नंबर' : 'mobile number'}" inputmode="numeric" maxlength="15" autocomplete="tel-national">
                        <select id="country-code-select" class="country-code-hidden-select" aria-label="Country code">
                            ${countryOptions}
                        </select>
                    </div>
                    <button type="submit" id="phone-gate-submit" class="btn btn-primary btn-lg w-100 mt-3">
                        <i class="bi bi-chat-dots me-2"></i>${isHindi ? 'OTP भेजें SMS से' : 'Send OTP by SMS'}
                    </button>
                    <p class="gate-note mt-3">
                        <i class="bi bi-shield-check"></i> ${isHindi ? 'आपका नंबर निजी और सुरक्षित रहेगा' : 'Your number stays private and secure'}
                    </p>
                </form>
            </div>
        `;

        this._bindCountrySelector();

        document.getElementById('phone-gate-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (this.emailSubmissionInProgress) return;

            const phone = document.getElementById('gate-phone')?.value?.replace(/\D/g, '').trim();
            const countryCode = document.getElementById('selected-code')?.textContent?.trim() || '+91';

            if (!this.isValidPhone(phone)) {
                MayaUtils.toast.error(isHindi ? 'कृपया सही मोबाइल नंबर भरिए' : 'Please enter a valid mobile number');
                return;
            }

            await this.handlePhoneSubmission(phone, countryCode);
        });

        this.bindVoicePromptOnFocus(document.getElementById('gate-phone'), 'phone');
        if (!deferFocus) {
            this.focusAuthField(document.getElementById('gate-phone'));
        }
    },

    _bindCountrySelector() {
        const selector = document.getElementById('country-code-selector');
        const hiddenSelect = document.getElementById('country-code-select');
        const selectedFlag = document.getElementById('selected-flag');
        const selectedCode = document.getElementById('selected-code');
        if (!selector || !hiddenSelect || !selectedFlag || !selectedCode) return;

        selector.addEventListener('click', () => hiddenSelect.focus());
        hiddenSelect.addEventListener('change', () => {
            const option = hiddenSelect.options[hiddenSelect.selectedIndex];
            selectedCode.textContent = option.value;
            selectedFlag.className = `fi fi-${option.dataset.iso || 'in'} country-flag`;
        });
        hiddenSelect.addEventListener('focus', () => selector.classList.add('selector-open'));
        hiddenSelect.addEventListener('blur', () => selector.classList.remove('selector-open'));
    },

    isValidPhone(phone) {
        return /^\d{6,15}$/.test(phone || '');
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
            if ((fieldType === 'phone' || fieldType === 'email') && window.MayaStatements?.getEmailFieldPrompt) {
                const text = await MayaStatements.getEmailFieldPrompt(this.firstName, aiContext);
                if (text && text.length > 20) return text;
            }

            if (fieldType === 'otp' && window.MayaStatements?.getPasswordFieldPrompt) {
                const text = await MayaStatements.getPasswordFieldPrompt(this.firstName, aiContext);
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

    async handlePhoneSubmission(phone, countryCode) {
        if (this.emailSubmissionInProgress) {
            return;
        }

        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const submitBtn = document.getElementById('phone-gate-submit');

        this.emailSubmissionInProgress = true;
        this.currentPhase = this.PHASES.LOGIN_OR_REGISTER;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isHindi ? 'OTP भेजा जा रहा है...' : 'Sending OTP...'}`;
        }

        MayaAuth.capturePhone?.(phone, countryCode, 'gate').catch(() => { });

        const result = await MayaAuth.sendOTP(phone, countryCode);
        if (!result.success) {
            MayaUtils.toast.error(result.error || (isHindi ? 'OTP नहीं भेजा जा सका' : 'Could not send OTP'));
            this.emailSubmissionInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="bi bi-chat-dots me-2"></i>${isHindi ? 'SMS से OTP भेजें' : 'Send OTP by SMS'}`;
            }
            return;
        }

        this.emailSubmissionInProgress = false;
        await this.showOTPVerificationFlow(phone, countryCode);
    },

    async showOTPVerificationFlow(phone, countryCode) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const textDisplay = document.getElementById('maya-text-display');

        this.currentPhase = this.PHASES.LOGIN_OR_REGISTER;
        this.authPromptedFields = new Set();

        textDisplay.innerHTML = `
            <div class="auth-flow-container otp-flow-container">
                <div class="auth-header">
                    <i class="bi bi-chat-dots otp-delivery-icon"></i>
                    <h3>${isHindi ? 'OTP दर्ज करें' : 'Enter OTP'}</h3>
                    <p class="auth-phone-hint">${isHindi ? `${countryCode} ${phone} पर SMS OTP भेजा गया है। कृपया इसके आने तक कुछ सेकंड प्रतीक्षा करें।` : `We sent an SMS OTP to ${countryCode} ${phone}. Please wait a few seconds for it to arrive.`}</p>
                </div>
                <div class="otp-input-group" id="otp-input-group">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                    <input type="tel" class="otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]">
                </div>
                <button class="btn btn-primary btn-lg w-100 mt-3" id="otp-verify-btn" disabled>
                    <i class="bi bi-unlock-fill me-2"></i>${isHindi ? 'पुष्टि करें और आगे बढ़ें' : 'Verify and Continue'}
                </button>
                <p class="auth-link mt-3 text-center">
                    <a href="#" id="otp-resend-link" class="text-muted small"><i class="bi bi-arrow-clockwise me-1"></i>${isHindi ? 'OTP फिर से भेजें' : 'Resend OTP'}</a>
                    &nbsp;·&nbsp;
                    <a href="#" id="otp-change-number" class="text-muted small">${isHindi ? 'नंबर बदलें' : 'Change number'}</a>
                </p>
            </div>
        `;

        this._bindOTPInputs(phone, countryCode);
        this.bindVoicePromptOnFocus(document.querySelector('.otp-digit'), 'otp');
    },

    _bindOTPInputs(phone, countryCode) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const digits = Array.from(document.querySelectorAll('.otp-digit'));
        const verifyBtn = document.getElementById('otp-verify-btn');
        if (!digits.length || !verifyBtn) {
            return;
        }

        const getOtp = () => digits.map((digit) => digit.value).join('');
        const updateButton = () => {
            verifyBtn.disabled = getOtp().length < 6;
        };

        digits.forEach((input, index) => {
            input.addEventListener('input', () => {
                input.value = input.value.replace(/\D/g, '').slice(-1);
                if (input.value && index < digits.length - 1) digits[index + 1].focus();
                updateButton();
                if (getOtp().length === 6) verifyBtn.click();
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
                if (getOtp().length === 6) verifyBtn.click();
            });
        });

        digits[0]?.focus();

        verifyBtn.addEventListener('click', async () => {
            const otp = getOtp();
            if (otp.length < 6) return;

            verifyBtn.disabled = true;
            verifyBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isHindi ? 'जाँचा जा रहा है...' : 'Verifying...'}`;
            digits.forEach((digit) => { digit.disabled = true; });
            await this._processOTPVerification(phone, countryCode, otp);
        });

        document.getElementById('otp-resend-link')?.addEventListener('click', async (event) => {
            event.preventDefault();
            const resend = await MayaAuth.sendOTP(phone, countryCode);
            if (resend.success) {
                MayaUtils.toast.success(isHindi ? 'नया SMS OTP भेजा गया है। कृपया कुछ सेकंड प्रतीक्षा करें।' : 'A new SMS OTP was sent. Please wait a few seconds.');
                digits.forEach((digit) => {
                    digit.value = '';
                    digit.disabled = false;
                });
                digits[0]?.focus();
                updateButton();
            } else {
                MayaUtils.toast.error(resend.error || (isHindi ? 'OTP दोबारा नहीं भेजा जा सका' : 'Could not resend OTP'));
            }
        });

        document.getElementById('otp-change-number')?.addEventListener('click', (event) => {
            event.preventDefault();
            this.showEmailGate();
        });
    },

    async _processOTPVerification(phone, countryCode, otp) {
        const lang = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        const isHindi = lang === 'hi';
        const result = await MayaAuth.verifyOTP(phone, countryCode, otp);

        if (!result.success) {
            const digits = Array.from(document.querySelectorAll('.otp-digit'));
            const verifyBtn = document.getElementById('otp-verify-btn');
            digits.forEach((digit) => {
                digit.value = '';
                digit.disabled = false;
            });
            digits[0]?.focus();
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = `<i class="bi bi-unlock-fill me-2"></i>${isHindi ? 'पुष्टि करें और आगे बढ़ें' : 'Verify and Continue'}`;
            }
            MayaUtils.toast.error(result.error || (isHindi ? 'OTP गलत है। दोबारा कोशिश करें।' : 'Incorrect OTP. Please try again.'));
            return;
        }

        this.isUserLoggedIn = true;
        if (window.MayaApp?.onUserAuthenticated) {
            MayaApp.onUserAuthenticated();
        }

        const language = MayaUtils.storage.get('maya_language') || this.userData?.language || 'en';
        if (window.MayaStatements) {
            MayaStatements.setLanguage(language);
        }

        const funnelData = MayaUtils.storage.get('funnel_data') || {};
        const existingProfile = MayaUtils.storage.get('maya_profile') || {};
        const fullProfile = {
            ...existingProfile,
            name: this.userData?.name || funnelData.name || existingProfile.name,
            phone: result.user.phone,
            countryCode: result.user.countryCode,
            phoneNumber: result.user.phoneNumber,
            birthDate: this.userData?.birthDate || funnelData.birthDate || existingProfile.birthDate,
            birthTime: this.userData?.birthTime || funnelData.birthTime || existingProfile.birthTime,
            birthPlace: this.userData?.birthPlace || funnelData.birthPlace || existingProfile.birthPlace,
            birthLat: this.userData?.birthLat || funnelData.birthLat || existingProfile.birthLat,
            birthLon: this.userData?.birthLon || funnelData.birthLon || existingProfile.birthLon,
            birthTimezone: this.userData?.birthTimezone || funnelData.birthTimezone || existingProfile.birthTimezone,
            gender: this.userData?.gender || funnelData.gender || existingProfile.gender,
            maritalStatus: this.userData?.maritalStatus || funnelData.maritalStatus || existingProfile.maritalStatus,
            language
        };

        MayaUtils.storage.set('maya_profile', fullProfile);
        MayaUtils.storage.set('maya_language', language);
        MayaUtils.storage.set('funnel_complete', false);

        await window.MayaApp?.applyLanguagePreference?.(language, { force: true });

        if (MayaAuth.isAuthenticated && fullProfile.birthDate) {
            MayaAuth.saveBirthDetails(fullProfile).catch(() => { });
        }

        MayaUtils.toast.success(isHindi ? 'SMS से verify हो गया!' : 'Verified via SMS!');
        await this.showDeepReveal();
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
            this.spokenNarrations.push({ stage: 'deepRevealPrep', text: prepMsg });
            this.recordStepContext('deepRevealPrep', prepMsg);
        }

        // Chapter choice - let user pick starting direction
        const choice = await this.showDeepRevealWithChoice();
        this.chapterOrder = this.getChapterOrder(choice);
        this.recordStepContext('chapter_choice', `${choice} => ${this.chapterOrder.join(' > ')}`);

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
        this.recordStepContext('chapter_order', chapters.join(' > '));

        for (const chapter of chapters) {
            await this._deliverChapter(chapter, numbers, aiContext);

            // Micro-prompt after each chapter - answers feed into AI for next chapters
            const microAnswer = await this.showChapterMicroPrompt(chapter);
            if (microAnswer && microAnswer !== 'default') {
                aiContext[`microPrompt_${chapter}`] = microAnswer;
            }
        }

        // COMPLETION - AI outro
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
            this.spokenNarrations.push({ stage: 'completion', text: completionText });
            this.recordStepContext('completion', completionText);
        }

        // Mark complete
        MayaUtils.storage.set('funnel_complete', true);

        // Fade out music
        this.fadeOutMusic();

        // Return hook - leave an open thread for next session
        await this.showReturnHook(aiContext);

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
            this.spokenNarrations.push({ stage: `${chapter}_intro`, text: intro });
            this.recordStepContext(`${chapter}_intro`, intro);
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
            this.recordStepContext(chapter, reading);
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

        // Hide progress bar - chat mode doesn't need it
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
        const gn = this._guideName();
        if (input) input.placeholder = isHindi ? `${gn} से कुछ भी पूछें...` : `Ask ${gn} anything...`;

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
            if (input) input.placeholder = this.language === 'hi' ? (this._isGuiderMale() ? 'सुन रहा हूँ...' : 'सुन रही हूँ...') : 'Listening...';
        };

        MayaListener.onEnd = () => {
            micBtn.classList.remove('listening');
            micBtn.querySelector('i').className = 'bi bi-mic';
            if (input) input.placeholder = this.language === 'hi' ? `${this._guideName()} से कुछ भी पूछें...` : `Ask ${this._guideName()} anything...`;
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
    async speak(text, options = {}) {
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
                if (options?.preferLocalFallback === true && typeof MayaVoice.speakFallback === 'function') {
                    if (typeof MayaVoice.onPlaybackStart === 'function') {
                        MayaVoice.onPlaybackStart();
                        MayaVoice.onPlaybackStart = null;
                    }
                    await MayaVoice.speakFallback(normalizedText);
                } else {
                    // Let speech complete naturally - no hard timeout
                    // The voice module handles its own chunking and completion
                    await MayaVoice.speak(normalizedText, null, options);

                    // If speech was aborted (paused), wait for resume then replay
                    if (MayaVoice.aborted && this.isPaused) {
                        console.log('⏸️ Speech was paused, waiting for resume...');
                        await this.waitIfPaused();
                        // Replay the text from beginning after resume
                        console.log('▶️ Resuming speech...');
                        await MayaVoice.speak(normalizedText, null, options);
                    }
                }
            } catch (error) {
                console.error('Voice error:', error);
                await this.sleepPaced(Math.min(Math.max(normalizedText.length * 22, 900), 4000));
            }
        } else {
            // No voice available, simulate reading time
            await this.sleepPaced(Math.max(1200, Math.min(normalizedText.length * 28, 6000)));
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
                micBtn.title = this.language === 'hi' ? `${this._guideName()} बोल रहे हैं...` : `${this._guideName()} is speaking...`;
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
window.checkFunnelStatus = function () {
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
