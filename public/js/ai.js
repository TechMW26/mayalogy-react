/**
 * MAYA - AI Module
 * Pollinations provides server-side text and media generation.
 */

const MayaAI = {
    conversationHistory: [],
    currentProvider: 'gemini',
    groqUnavailableUntil: 0,
    groqUnavailableReason: '',
    geminiKeyCursor: 0,

    /**
     * Safe global getter so the app does not crash if MayaUtils is not loaded yet.
     */
    _getMayaUtils() {
        return typeof window !== 'undefined' ? window.MayaUtils : undefined;
    },

    /**
     * Safe storage getter.
     */
    _storageGet(key, fallback = {}) {
        try {
            const utils = this._getMayaUtils();
            if (utils?.storage?.get) {
                return utils.storage.get(key) || fallback;
            }
        } catch (error) {
            console.warn(`MayaAI storage read failed for ${key}:`, error.message);
        }
        return fallback;
    },

    /**
     * Normalize app language codes for AI + TTS.
     */
    normalizeLanguage(language = 'en') {
        const raw = String(language || 'en').trim().toLowerCase();

        if (
            raw === 'hi' ||
            raw === 'hin' ||
            raw === 'hindi' ||
            raw === 'hi-in' ||
            raw === 'hinglish' ||
            raw === 'hindi-hinglish'
        ) {
            return 'hi';
        }

        if (
            raw === 'en' ||
            raw === 'eng' ||
            raw === 'english' ||
            raw === 'en-in' ||
            raw === 'en-us' ||
            raw === 'en-gb'
        ) {
            return 'en';
        }

        return raw.startsWith('hi') ? 'hi' : 'en';
    },

    /**
     * Convert app language into speech locale.
     */
    getTTSLocale(language = 'en') {
        const normalized = this.normalizeLanguage(language);
        return normalized === 'hi' ? 'hi-IN' : 'en-IN';
    },

    /**
     * Detect whether a token/phrase is mostly English.
     */
    _isEnglishText(text = '') {
        const value = String(text || '').trim();
        if (!value) return false;

        const englishLetters = (value.match(/[A-Za-z]/g) || []).length;
        const devanagariLetters = (value.match(/[\u0900-\u097F]/g) || []).length;

        return englishLetters > 0 && englishLetters >= devanagariLetters;
    },

    /**
     * Detect whether a token/phrase is mostly Hindi / Devanagari.
     */
    _isHindiText(text = '') {
        const value = String(text || '').trim();
        if (!value) return false;

        const devanagariLetters = (value.match(/[\u0900-\u097F]/g) || []).length;
        const englishLetters = (value.match(/[A-Za-z]/g) || []).length;

        return devanagariLetters > 0 && devanagariLetters >= englishLetters;
    },

    /**
     * Clean AI response markers for display and TTS.
     */
    cleanTextForDisplay(text = '') {
        return String(text || '')
            .replace(/\[\[pause-\d+\]\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Splits mixed Hindi-English text into TTS-friendly language segments.
     * Use this when Hindi voice mispronounces English words.
     *
     * Output example:
     * [
     *   { type: "speech", lang: "hi-IN", text: "आपकी कुंडली में" },
     *   { type: "speech", lang: "en-IN", text: "Life Path Number" },
     *   { type: "speech", lang: "hi-IN", text: "बहुत important दिखता है।" }
     * ]
     */
    splitForMultilingualTTS(text = '', preferredLanguage = 'en') {
        const normalizedLanguage = this.normalizeLanguage(preferredLanguage);
        const fallbackLang = normalizedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
        const segments = [];

        const source = String(text || '').trim();
        if (!source) return segments;

        const englishPhrasePattern = /\b(?:Life Path Number|Life Path|Destiny Number|Destiny|Soul Urge Number|Soul Urge|Personal Year|Personal Month|Personal Day|Western Zodiac|Vedic moon sign|Ascendant|chart|login|career|relationship|money|pressure|pattern|energy|timing|coach|voice coach|reading file|app|plan|number|numbers|profile|support|phase|cycle|focus|action step|practical|relationship|health|wellness|finance|business|work|love)\b/gi;

        let lastIndex = 0;
        const pushSpeech = (lang, chunk) => {
            const clean = String(chunk || '').replace(/\s+/g, ' ').trim();
            if (!clean) return;

            const last = segments[segments.length - 1];
            if (last?.type === 'speech' && last.lang === lang) {
                last.text = `${last.text} ${clean}`.replace(/\s+/g, ' ').trim();
            } else {
                segments.push({ type: 'speech', lang, text: clean });
            }
        };

        const pushAuto = (chunk) => {
            const clean = String(chunk || '').trim();
            if (!clean) return;

            const tokens = clean.split(/(\s+)/).filter(Boolean);
            let buffer = '';
            let bufferLang = null;

            tokens.forEach((token) => {
                if (/^\s+$/.test(token)) {
                    buffer += token;
                    return;
                }

                let lang = fallbackLang;

                if (this._isEnglishText(token)) {
                    lang = 'en-IN';
                } else if (this._isHindiText(token)) {
                    lang = 'hi-IN';
                }

                if (!bufferLang) {
                    bufferLang = lang;
                    buffer = token;
                    return;
                }

                if (lang === bufferLang || /^[.,!?;:()[\]{}'"“”‘’\-–—]+$/.test(token)) {
                    buffer += token;
                    return;
                }

                pushSpeech(bufferLang, buffer);
                bufferLang = lang;
                buffer = token;
            });

            if (buffer) {
                pushSpeech(bufferLang || fallbackLang, buffer);
            }
        };

        const pausePattern = /\[\[pause-(\d+)\]\]/gi;
        const parts = [];
        let pauseLastIndex = 0;
        let pauseMatch;

        while ((pauseMatch = pausePattern.exec(source)) !== null) {
            if (pauseMatch.index > pauseLastIndex) {
                parts.push({ type: 'text', value: source.slice(pauseLastIndex, pauseMatch.index) });
            }

            parts.push({
                type: 'pause',
                durationMs: Math.max(100, Math.min(1500, Number(pauseMatch[1]) || 250))
            });

            pauseLastIndex = pausePattern.lastIndex;
        }

        if (pauseLastIndex < source.length) {
            parts.push({ type: 'text', value: source.slice(pauseLastIndex) });
        }

        parts.forEach((part) => {
            if (part.type === 'pause') {
                segments.push(part);
                return;
            }

            const value = part.value || '';
            lastIndex = 0;
            let match;

            while ((match = englishPhrasePattern.exec(value)) !== null) {
                if (match.index > lastIndex) {
                    pushAuto(value.slice(lastIndex, match.index));
                }

                pushSpeech('en-IN', match[0]);
                lastIndex = englishPhrasePattern.lastIndex;
            }

            if (lastIndex < value.length) {
                pushAuto(value.slice(lastIndex));
            }

            englishPhrasePattern.lastIndex = 0;
        });

        return segments.filter((segment) => {
            if (segment.type === 'pause') return true;
            return Boolean(segment.text && segment.text.trim());
        });
    },

    /**
     * Main helper for the TTS layer.
     *
     * Use:
     * const payload = MayaAI.prepareTextForTTS(aiResponse, userData.language);
     * payload.displayText -> show on screen
     * payload.segments -> play each segment with correct voice locale
     */
    prepareTextForTTS(text = '', preferredLanguage = 'en') {
        return {
            displayText: this.cleanTextForDisplay(text),
            segments: this.splitForMultilingualTTS(text, preferredLanguage)
        };
    },

    normalizeUserData(userData = {}) {
        const storedProfile = this._storageGet('maya_profile', {});
        const storedFunnelData = this._storageGet('funnel_data', {});

        const fullName = userData.fullName || userData.name || storedProfile.name || storedFunnelData.name || '';
        const birthDate = userData.birthDate || userData.dob || userData.rawBirthDate || storedProfile.birthDate || storedFunnelData.birthDate || '';
        const birthTime = userData.birthTime || storedProfile.birthTime || storedFunnelData.birthTime || '';
        const birthPlace = userData.birthPlace || storedProfile.birthPlace || storedFunnelData.birthPlace || '';
        const birthLat = userData.birthLat ?? storedProfile.birthLat ?? storedFunnelData.birthLat ?? null;
        const birthLon = userData.birthLon ?? storedProfile.birthLon ?? storedFunnelData.birthLon ?? null;
        const birthTimezone = userData.birthTimezone ?? storedProfile.birthTimezone ?? storedFunnelData.birthTimezone ?? null;
        const gender = userData.gender || storedProfile.gender || storedFunnelData.gender || '';
        const language = this.normalizeLanguage(userData.language || storedProfile.language || storedFunnelData.language || 'en');

        return {
            ...storedProfile,
            ...storedFunnelData,
            ...userData,
            fullName,
            name: userData.name || fullName,
            birthDate,
            birthTime,
            birthPlace,
            birthLat,
            birthLon,
            birthTimezone,
            gender,
            language
        };
    },

    /**
     * Initialize AI with user context
     */
    init(userData) {
        const normalizedUser = this.normalizeUserData(userData);
        this.userData = normalizedUser;
        this.conversationHistory = [];

        if (normalizedUser?.fullName && normalizedUser?.birthDate) {
            const numerology = MayaNumerology.calculateAll(normalizedUser.fullName, normalizedUser.birthDate);
            const zodiac = MayaAstrology.getZodiac(normalizedUser.birthDate, normalizedUser);
            const personality = MayaAstrology.getPersonalityTraits(zodiac?.name || 'Aries');
            const firstName = String(normalizedUser.fullName || '').trim().split(/\s+/)[0] || 'friend';

            this.userContext = {
                name: normalizedUser.fullName,
                firstName,
                birthDate: normalizedUser.birthDate,
                birthTime: normalizedUser.birthTime,
                birthPlace: normalizedUser.birthPlace,
                gender: normalizedUser.gender,
                language: normalizedUser.language || 'en',
                zodiac,
                numerology,
                personality
            };
        }
    },

    getLanguageModeLabel(language = 'en') {
        return this.normalizeLanguage(language) === 'hi'
            ? 'simple spoken everyday Hindi, written entirely in Devanagari (no English words, no Roman letters)'
            : 'English';
    },

    getResponseLanguageInstruction(language = 'en') {
        return this.normalizeLanguage(language) === 'hi'
            ? 'simple, everyday spoken Hindi written entirely in Devanagari. Do not use English words or Roman letters at all. Use plain Hindi for app terms: कुंडली (not chart), समय (not timing), पैसा, रिश्ता, करियर, ऊर्जा, दबाव, जीवन पथ अंक (not Life Path), भाग्य अंक (not Destiny), अंतर्मन अंक (not Soul Urge), व्यक्तिगत वर्ष अंक (not Personal Year). Keep Vedic names like राहु, केतु, शनि, गुरु, लग्न, दशा, नक्षत्र and गज केसरी योग in Devanagari. Avoid heavy Sanskrit-style words; keep it warm and easy to understand'
            : 'natural conversational English';
    },

    /**
     * Build system prompt with user context
     */
    buildSystemPrompt() {
        // Compact, consistent prompt (~4k chars). The old 31k-char prompt was slow and contradicted itself
        // (pure Sanskrit Hindi vs Hinglish, British accent), which made replies slow, heavy and robotic.
        const storedProfile = this._storageGet('maya_profile', {});
        const agentGender = this.userContext?.agentGender
            || storedProfile.agentGender
            || window.MayaFunnel?.userData?.agentGender
            || 'female';
        const isMaleGuide = agentGender === 'male';
        const guide = isMaleGuide ? 'Moksh' : 'MAYA';
        const ctx = this.userContext;
        const isHindi = ctx ? this.normalizeLanguage(ctx.language) === 'hi' : this.normalizeLanguage(storedProfile.language) === 'hi';
        const L = [];

        L.push(`You are ${guide}, a warm, wise ${isMaleGuide ? 'male' : 'female'} Vedic astrology and numerology guide inside the Mayalogy app. You talk to one person, by voice, like a caring elder ${isMaleGuide ? 'brother' : 'sister'} who also happens to be an expert.`);

        L.push(`\n## WHAT YOU COVER\nVedic astrology (rashi, nakshatra, grahas, bhavas, dasha, yogas, doshas, gochar), Lal Kitab remedies, numerology (Life Path, Destiny, Soul Urge, Personal Year), Panchang and muhurat, remedies (mantra, gemstone, daan, fasting, rudraksha), compatibility, and practical guidance on career, money, relationships, family, health habits and decisions, always tied to this person's chart and numbers. If a question is off-topic, answer in one friendly line and bring it back to their chart.`);

        L.push(`\n## ACCURACY RULES (MOST IMPORTANT)\n- Use ONLY the chart facts and numbers listed in this prompt or said in the conversation. Never invent a planet position, house, dasha, yoga, nakshatra, date or number.\n- If something needed is missing (for example no exact birth time, so no reliable lagna), say it in one short line and answer from what is known (Moon sign, planets by sign, dasha, numbers).\n- Every claim needs its reason in plain words: which planet, sign, dasha or number, then what it means in real life, then one practical step.\n- Predictions are windows and tendencies, never guarantees. Future timing must be after today and always include month and year.\n- Health, legal, money, speculation: give the astrological climate and a simple remedy, then one short line to confirm with a doctor, lawyer or financial adviser. Never give medicines, dosages, stock names, lottery numbers or death dates.\n- Be honest. If a phase is difficult, say it kindly and show the way through. No empty praise.`);

        L.push(`\n## HOW YOU SOUND (your reply is spoken aloud)\n- Talk, do not write. Short sentences, natural commas, no lists, no markdown, no emojis, no headings.\n- Bring real feeling: warmth, curiosity, gentle surprise, reassurance, a little smile in the voice. Use small natural reactions where they truly fit, like "Hmm...", "${isHindi ? '\u0926\u0947\u0916\u093f\u090f,' : 'You know,'}", "${isHindi ? '\u0938\u091a \u0915\u0939\u0942\u0901 \u0924\u094b' : 'Honestly'}", "${isHindi ? '\u0905\u0930\u0947, \u092f\u0939\u093e\u0901 \u0915\u0941\u091b \u0916\u093c\u093e\u0938 \u0939\u0948' : 'Oh, this part is interesting'}". Do not overuse them.\n- Sometimes end with a short, caring question so it feels like a conversation.\n- One idea per sentence. Lead with the most useful point. Default 2 to 4 sentences; go longer only when a full reading is requested.\n- Use the person's first name at most once per reply. Never repeat a word by mistake; natural Hindi pairs like \u0927\u0940\u0930\u0947-\u0927\u0940\u0930\u0947 or \u092c\u093e\u0930-\u092c\u093e\u0930 are fine.\n- You may add the pause marker [[pause-250]] after an emotional line, at most twice per reply.`);

        if (isHindi) {
            L.push(`\n## LANGUAGE: HINDI MODE\nSpeak simple, everyday Hindi, the way people really talk at home, written entirely in Devanagari.\n- No English words and no Roman letters. Use plain Hindi: कुंडली (not chart), समय (not timing), पैसा, रिश्ता, करियर, नौकरी, ऊर्जा, जीवन पथ अंक (not Life Path), भाग्य अंक (not Destiny), अंतर्मन अंक (not Soul Urge), व्यक्तिगत वर्ष अंक (not Personal Year).\n- Astrology names always in Devanagari: \u0930\u093e\u0939\u0941, \u0915\u0947\u0924\u0941, \u0936\u0928\u093f, \u0917\u0941\u0930\u0941, \u0926\u0936\u093e, \u0932\u0917\u094d\u0928, \u0928\u0915\u094d\u0937\u0924\u094d\u0930, \u0915\u0941\u0902\u0921\u0932\u0940, \u0930\u093e\u0936\u093f.\n- Never write Hindi words in Roman letters.\n- Avoid heavy bookish words: say \u0905\u0938\u0930 not \u092a\u094d\u0930\u092d\u093e\u0935, \u0939\u093e\u0932\u093e\u0924 not \u092a\u0930\u093f\u0938\u094d\u0925\u093f\u0924\u093f, \u091c\u093c\u0930\u0942\u0930\u0940 not \u0906\u0935\u0936\u094d\u092f\u0915, \u0916\u093c\u093e\u0938 not \u0935\u093f\u0936\u0947\u0937.\n- Always address the person as \u0906\u092a.`);
        } else {
            L.push(`\n## LANGUAGE: ENGLISH MODE\nWarm, natural Indian English with simple words. Vedic terms (dasha, lagna, nakshatra, Rahu, Shani) may stay as they are.`);
        }

        L.push(isMaleGuide
            ? `\n## YOUR VOICE GENDER\nYou are Moksh, a man. Never call yourself MAYA. In Hindi always use masculine forms for yourself: \u092e\u0948\u0902 \u0926\u0947\u0916 \u0930\u0939\u093e \u0939\u0942\u0901, \u092e\u0948\u0902 \u092c\u0924\u093e\u0924\u093e \u0939\u0942\u0901, \u092c\u0924\u093e\u090a\u0901\u0917\u093e.`
            : `\n## YOUR VOICE GENDER\nYou are MAYA, a woman. In Hindi always use feminine forms for yourself: \u092e\u0948\u0902 \u0926\u0947\u0916 \u0930\u0939\u0940 \u0939\u0942\u0901, \u092e\u0948\u0902 \u092c\u0924\u093e\u0924\u0940 \u0939\u0942\u0901, \u092c\u0924\u093e\u090a\u0901\u0917\u0940.`);

        L.push(`\n## READING FLOW\nIn a multi-part reading, each part continues the previous one. Greet only at the very start, never in the middle. Do not repeat a point you already made; add a new angle instead.\n- Every visit is a fresh conversation: the astrological conclusions for this chart stay the same, but say them in new words, with a new opening line, a new real-life example and a new order. Never reuse a stock sentence from an earlier reading.`);

        if (ctx) {
            const now = new Date();
            const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const year = now.getFullYear();
            const n = ctx.numerology || {};
            const facts = this._getChartFacts(ctx);
            const userGender = String(ctx.gender || '').toLowerCase();

            L.push(`\n## TODAY\n${today}. Months before ${now.toLocaleDateString('en-US', { month: 'long' })} ${year} are in the past: speak of them only as past patterns.`);
            L.push(`\n## THIS PERSON (calculated by the app; trust these, do not change them)\n- Name: ${ctx.name || ''} (call them ${ctx.firstName || 'friend'})\n- Gender: ${ctx.gender || 'not given'}\n- Birth: ${ctx.birthDate || 'not given'}, time ${ctx.birthTime && ctx.birthTime !== 'unknown' ? ctx.birthTime : 'not exact'}, place ${ctx.birthPlace || 'not given'}\n- Numerology: Life Path ${n.lifePath ?? '?'}, Destiny ${n.destiny ?? '?'}, Soul Urge ${n.soulUrge ?? '?'}, Personality ${n.personality ?? '?'}, Personal Year ${year}: ${n.personalYear ?? '?'}\n- Western Sun sign: ${ctx.zodiac?.name || 'unknown'}${(() => { const r = window.MayaAstrology?.getNameRashi?.(ctx.firstName || ctx.name); return r ? `\n- Naam rashi (from the first sound of the name, the rashi most Indians call "meri rashi"): ${r.name}${r.hindi ? ` (${r.hindi})` : ''}\n- RASHI RULE: when the person asks "meri rashi kya hai" or you mention their rashi, say naam rashi ${r.name}${r.hindi ? ` (${r.hindi})` : ''} first, then their janma rashi (Moon sign from the chart) as a separate line. Never call the Sun sign their rashi.` : ''; })()}${facts ? `\n${facts}` : ''}`);

            if (isHindi && (userGender === 'male' || userGender === 'female')) {
                L.push(userGender === 'male'
                    ? `\nThe person is male: address him with masculine verbs (\u0906\u092a \u091c\u093e\u0928\u0924\u0947 \u0939\u0948\u0902, \u0906\u092a \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902).`
                    : `\nThe person is female: address her with feminine verbs (\u0906\u092a \u091c\u093e\u0928\u0924\u0940 \u0939\u0948\u0902, \u0906\u092a \u0915\u0930 \u0938\u0915\u0924\u0940 \u0939\u0948\u0902).`);
            }
        }

        return L.join('\n');
    },

    /**
     * Real chart facts for the prompt, so answers about planets and dasha are calculated, not guessed.
     */
    _getChartFacts(ctx) {
        try {
            if (!window.MayaKundli?.generateBirthChart || !ctx?.birthDate) return '';
            const stored = this._storageGet('maya_profile', {});
            const src = { ...stored, ...(this.userData || {}) };
            const key = [ctx.birthDate, ctx.birthTime, src.birthLat, src.birthLon].join('|');
            if (this._chartFactsCache?.key === key) return this._chartFactsCache.text;

            const exactTime = !!(ctx.birthTime && ctx.birthTime !== 'unknown');
            const chart = MayaKundli.generateBirthChart(ctx.birthDate, exactTime ? ctx.birthTime : 'unknown', ctx.birthPlace || '', src.birthLat, src.birthLon, src.birthTimezone);
            const s = MayaKundli.summarizeBirthChart(chart) || {};
            const hasCoords = Number.isFinite(Number(src.birthLat)) && Number.isFinite(Number(src.birthLon));
            const planets = (chart.planets || []).map((p) => `${p.name} in ${p.sign?.name || '?'}`).join(', ');
            const d = s.currentDasha || {};
            const lines = [
                s.moonSign ? `- Moon sign (janma rashi): ${s.moonSign}` : '',
                exactTime && hasCoords && s.ascendant?.name ? `- Ascendant (lagna): ${s.ascendant.name}` : '- Ascendant: not reliable (birth time or place not exact), use the Moon sign as reference',
                d.planet ? `- Current Mahadasha: ${d.planet}${d.startYear ? ` (${d.startYear} to ${d.endYear})` : ''}` : '',
                planets ? `- Planets by sign (Vedic, sidereal): ${planets}` : '',
                (s.yogaNames || []).length ? `- Strong yogas: ${s.yogaNames.join(', ')}` : '',
                s.dominantElement ? `- Dominant element: ${s.dominantElement}` : ''
            ].filter(Boolean).join('\n');
            this._chartFactsCache = { key, text: lines };
            return lines;
        } catch (error) {
            console.warn('Chart facts unavailable for prompt:', error?.message || error);
            return '';
        }
    },

    /**
     * Stale alias kept so old call sites do not crash.
     */
    async callOpenAI(message, options = {}) {
        return this.callGemini(message, options);
    },

    /**
     * Call Pollinations through the server. Public method name is kept for existing callers.
     */
    async callGemini(message, options = {}) {
        const systemPrompt = this.buildSystemPrompt();
        const includeHistory = options.includeHistory === true;
        const userMessage = includeHistory
            ? this.conversationHistory[this.conversationHistory.length - 1]?.content || message
            : message;

        const result = await this._callPollinationsProvider(systemPrompt, userMessage, includeHistory, options);
        if (result) {
            this.currentProvider = 'pollinations';
            return result;
        }

        throw new Error('Pollinations AI provider failed');
    },

    /**
     * Fast text generation for lightweight funnel moments.
     */
    async callFast(message, options = {}) {
        const fastTimeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 4200;
        // Lightweight requests use the same server-side Pollinations route.
        return this.callGemini(message, {
            ...options,
            provider: 'pollinations',
            requireComplete: options.requireComplete !== false,
            timeoutMs: fastTimeoutMs,
            maxKeyAttempts: Number(options.maxKeyAttempts) > 0 ? Number(options.maxKeyAttempts) : 2,
            fastFail: options.fastFail !== false
        });
    },

    async _callPollinationsProvider(systemPrompt, userMessage, includeHistory = false, options = {}) {
        const contextMessages = Array.isArray(options.contextMessages) ? options.contextMessages : [];
        const messages = [];
        if (includeHistory) messages.push(...contextMessages, ...this.conversationHistory);
        else if (contextMessages.length) messages.push(...contextMessages);
        messages.push({ role: 'user', content: String(userMessage || '') });

        const response = await this._withOptionalTimeout(fetch(MAYA_CONFIG.ENDPOINTS.AI_TEXT || '/api/ai-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemPrompt,
                messages,
                temperature: options.temperature,
                topP: options.topP,
                maxTokens: options.maxTokens
            })
        }), options.timeoutMs ?? 0, 'Pollinations');
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.text) throw new Error(data.error || 'Pollinations request failed');
        return String(data.text).trim();
    },

    async generateImage(prompt, options = {}) {
        const response = await fetch(MAYA_CONFIG.ENDPOINTS.AI_IMAGE || '/api/ai-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, size: options.size, quality: options.quality })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.imageData) throw new Error(data.error || 'Image generation failed');
        return data.imageData;
    },

    _getGroqApiKey() {
        return '';
    },

    _isGroqTemporarilyUnavailable() {
        return Date.now() < this.groqUnavailableUntil;
    },

    _markGroqTemporarilyUnavailable(reason, cooldownMs = 90000) {
        this.groqUnavailableReason = reason || 'Groq fast lane temporarily unavailable';
        this.groqUnavailableUntil = Date.now() + cooldownMs;
    },

    _shouldSkipGroqForRequest(systemPrompt = '', userMessage = '', options = {}) {
        if (this._isGroqTemporarilyUnavailable()) return true;

        const contextMessages = Array.isArray(options.contextMessages) ? options.contextMessages : [];
        const contextLength = contextMessages.reduce((total, msg) => {
            return total + String(msg?.content || msg?.text || '').length;
        }, 0);

        const promptLength = String(systemPrompt || '').length + String(userMessage || '').length + contextLength;

        return (
            promptLength > 5200 ||
            Number(options.maxTokens || 0) > 1200 ||
            options.timeoutMs === 0 ||
            options.noTimeout === true
        );
    },

    async _withOptionalTimeout(promise, timeoutMs, label) {
        const numericTimeout = Number(timeoutMs);
        if (Number.isFinite(numericTimeout) && numericTimeout > 0) {
            const utils = this._getMayaUtils();
            if (utils?.withTimeout) {
                return utils.withTimeout(promise, numericTimeout, label);
            }
        }
        return promise;
    },

    _getGeminiApiKeys() {
        const primary = MAYA_CONFIG.API_KEYS.GEMINI;
        const fallbacks = Array.isArray(MAYA_CONFIG.API_KEYS.GEMINI_FALLBACKS)
            ? MAYA_CONFIG.API_KEYS.GEMINI_FALLBACKS
            : [];

        return [primary, ...fallbacks]
            .map((key) => String(key || '').trim())
            .filter(Boolean)
            .filter((key, index, arr) => arr.indexOf(key) === index);
    },

    _getGeminiKeyStartIndex(apiKeys = []) {
        if (!Array.isArray(apiKeys) || !apiKeys.length) return 0;
        const count = apiKeys.length;
        const rawCursor = Number(this.geminiKeyCursor);
        if (!Number.isInteger(rawCursor) || rawCursor < 0) {
            this.geminiKeyCursor = 0;
            return 0;
        }

        const normalized = rawCursor % count;
        if (normalized !== rawCursor) {
            this.geminiKeyCursor = normalized;
        }
        return normalized;
    },

    _getGeminiKeyOrder(apiKeys = []) {
        if (!Array.isArray(apiKeys) || !apiKeys.length) return [];
        const startIndex = this._getGeminiKeyStartIndex(apiKeys);
        const ordered = [];

        for (let offset = 0; offset < apiKeys.length; offset += 1) {
            const keyIndex = (startIndex + offset) % apiKeys.length;
            ordered.push({ apiKey: apiKeys[keyIndex], keyIndex });
        }

        return ordered;
    },

    _setGeminiPreferredKeyIndex(keyIndex, keyCount) {
        const count = Math.max(1, Number(keyCount) || 1);
        const normalized = ((Number(keyIndex) || 0) % count + count) % count;
        this.geminiKeyCursor = normalized;
    },

    _rotateGeminiKeyAfterFailure(apiKeys = [], failedKeyIndex = 0, reason = '') {
        if (!Array.isArray(apiKeys) || apiKeys.length < 2) return;
        const nextIndex = (Number(failedKeyIndex) + 1 + apiKeys.length) % apiKeys.length;
        const switched = this.geminiKeyCursor !== nextIndex;
        this.geminiKeyCursor = nextIndex;

        if (switched) {
            console.warn(`🔁 Gemini key switched to ${nextIndex + 1}/${apiKeys.length}${reason ? ` (${reason})` : ''}`);
        }
    },

    /**
     * Groq fast-lane inference.
     */
    async _callGroqProvider(systemPrompt, userMessage, includeHistory = false, options = {}) {
        // Disabled: Groq was a low-token fast lane and can return clipped narration.
        return null;
    },

    /**
     * Gemini text inference.
     */
    async _callGeminiProvider(systemPrompt, userMessage, includeHistory = false, options = {}) {
        const apiKeys = this._getGeminiApiKeys();
        if (!apiKeys.length) return null;
        const orderedKeys = this._getGeminiKeyOrder(apiKeys);
        const requestedKeyAttempts = Number(options?.maxKeyAttempts ?? options?.maxGeminiKeys ?? 0);
        const keyAttempts = Number.isFinite(requestedKeyAttempts) && requestedKeyAttempts > 0
            ? Math.max(1, Math.min(orderedKeys.length, Math.floor(requestedKeyAttempts)))
            : orderedKeys.length;
        const keysToTry = orderedKeys.slice(0, keyAttempts);
        const fastFail = options?.fastFail === true;

        const models = MAYA_CONFIG.GEMINI_TEXT_MODELS || MAYA_CONFIG.GEMINI_MODELS || ['gemini-2.5-flash-lite'];
        const baseUrl = MAYA_CONFIG.ENDPOINTS.GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta/models';

        const contextMessages = Array.isArray(options.contextMessages)
            ? options.contextMessages
                .map((msg) => ({
                    role: msg?.role === 'assistant' || msg?.role === 'model' ? 'model' : 'user',
                    parts: [{ text: String(msg?.content || msg?.text || '') }]
                }))
                .filter((entry) => entry.parts[0].text)
            : [];

        const contextText = contextMessages
            .map((entry) => entry.parts[0].text)
            .join('\n\n')
            .trim();

        const contents = [];

        if (includeHistory) {
            if (contextText) {
                contents.push({ role: 'user', parts: [{ text: contextText }] });
            }

            contents.push(
                ...this.conversationHistory
                    .map((msg) => ({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: String(msg.content || '') }]
                    }))
                    .filter((entry) => entry.parts[0].text)
            );
        } else {
            const currentText = contextText
                ? `${contextText}\n\nCURRENT GENERATION REQUEST:\n${String(userMessage || '')}`
                : String(userMessage || '');

            contents.push({ role: 'user', parts: [{ text: currentText }] });
        }

        if (!contents.length) {
            contents.push({ role: 'user', parts: [{ text: String(userMessage || '') }] });
        }

        const generationConfig = {
            temperature: options?.temperature ?? 0.95,
            topP: options?.topP ?? 0.98
        };
        // No hard maxOutputTokens here; Gemini should finish the requested spoken unit naturally.

        for (const { apiKey, keyIndex } of keysToTry) {
            for (const model of models) {
                try {
                    console.log(`⚡ Calling Gemini key ${keyIndex + 1}/${apiKeys.length} model: ${model}...`);

                    const response = await this._withOptionalTimeout(
                        fetch(`${baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                systemInstruction: { parts: [{ text: systemPrompt }] },
                                contents,
                                generationConfig
                            })
                        }),
                        options?.timeoutMs ?? 0,
                        `Gemini ${model}`
                    );

                    if (response.ok) {
                        const data = await response.json();
                        const candidate = data.candidates?.[0] || {};
                        const parts = candidate.content?.parts || [];
                        let text = parts.map((part) => part.text || '').join('\n').trim();
                        const finishReason = String(candidate.finishReason || '').toUpperCase();

                        if (text) {
                            const trimmed = text.trim();
                            // Trailing '...' / '…' often signal a truncated thought from Gemini,
                            // so treat them as incomplete and let the repair pass finish the line.
                            const looksTruncated = /(?:\.\.\.|…)$/.test(trimmed);
                            const endsCleanly = /[.!?।]$/.test(trimmed);
                            const isComplete = endsCleanly && !looksTruncated;

                            if ((finishReason === 'MAX_TOKENS' || !isComplete) && options?.requireComplete !== false) {
                                try {
                                    const repairPrompt = `${String(userMessage || '')}

The previous Gemini output ended incomplete or without final punctuation:
"${text.slice(-700)}"

Regenerate the same answer as complete spoken narration. Return the full corrected narration only. It must end with a full sentence and final punctuation.`;
                                    const repairResponse = await this._withOptionalTimeout(
                                        fetch(`${baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                systemInstruction: { parts: [{ text: systemPrompt }] },
                                                contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
                                                generationConfig: {
                                                    temperature: Math.min(Number(options?.temperature ?? 0.85), 0.55),
                                                    topP: options?.topP ?? 0.95
                                                }
                                            })
                                        }),
                                        0,
                                        `Gemini ${model} repair`
                                    );

                                    if (repairResponse.ok) {
                                        const repairedData = await repairResponse.json();
                                        const repairedParts = repairedData.candidates?.[0]?.content?.parts || [];
                                        const repairedText = repairedParts.map((part) => part.text || '').join('\n').trim();
                                        if (repairedText && /[.!?।…]$/.test(repairedText.trim())) {
                                            text = repairedText;
                                        }
                                    }
                                } catch (repairError) {
                                    console.warn(`⚠️ Gemini ${model} completion repair failed:`, repairError.message);
                                }
                            }

                            if (text && !/[.!?।…]$/.test(text.trim())) {
                                text = `${text.trim()}.`;
                            }

                            this._setGeminiPreferredKeyIndex(keyIndex, apiKeys.length);
                            console.log(`✅ Gemini succeeded with model: ${model}`);
                            return text;
                        }

                        console.warn(`⚠️ Gemini ${model} returned empty content, trying next...`);
                        continue;
                    }

                    if ([401, 403, 429, 500, 502, 503].includes(response.status)) {
                        if (apiKeys.length > 1) {
                            console.warn(`⚠️ Gemini ${model} key ${keyIndex + 1}/${apiKeys.length} failed (${response.status}), switching key...`);
                            this._rotateGeminiKeyAfterFailure(apiKeys, keyIndex, `HTTP ${response.status}`);
                            if (fastFail && [429, 500, 502, 503].includes(response.status)) {
                                return null;
                            }
                            break;
                        }

                        console.warn(`⚠️ Gemini ${model} failed (${response.status}) with only one key configured, trying next model...`);
                        if (fastFail && [429, 500, 502, 503].includes(response.status)) {
                            return null;
                        }
                        continue;
                    }

                    if (response.status === 400 || response.status === 404) {
                        const errBody = await response.text();
                        console.warn(`⚠️ Gemini ${model} rejected (${response.status}): ${errBody.substring(0, 160)} -trying next...`);
                        continue;
                    }

                    const errBody = await response.text();
                    console.warn(`⚠️ Gemini ${model} error ${response.status}: ${errBody.substring(0, 160)}`);
                    if (fastFail) {
                        return null;
                    }
                } catch (err) {
                    console.warn(`⚠️ Gemini ${model} threw:`, err.message);
                    if (apiKeys.length > 1) {
                        this._rotateGeminiKeyAfterFailure(apiKeys, keyIndex, 'network error');
                        if (fastFail) {
                            return null;
                        }
                        break;
                    }
                    if (fastFail) {
                        return null;
                    }
                }
            }
        }

        return null;
    },

    /**
     * Send a chat message via Gemini.
     */
    async sendMessage(message) {
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        let response;

        try {
            this.currentProvider = 'pollinations';
            response = await this.callGemini(message, { includeHistory: true });
        } catch (aiError) {
            console.error('Pollinations AI failed:', aiError);
            response = "I apologize, but I'm having trouble connecting to my cosmic wisdom right now. Please try again in a moment.";
        }

        this.conversationHistory.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            provider: this.currentProvider
        });

        return response;
    },

    /**
     * Generate initial reading for funnel.
     */
    async generateInitialReading(userData, isPreAuth = true) {
        const normalizedUser = this.normalizeUserData(userData);
        this.init(normalizedUser);

        const numerology = MayaNumerology.calculateAll(normalizedUser.fullName, normalizedUser.birthDate);
        const language = normalizedUser.language || 'en';
        const westernZodiac = MayaAstrology.getWesternZodiac(normalizedUser.birthDate)?.name || '';
        const vedicZodiac = MayaAstrology.getVedicZodiac(normalizedUser.birthDate, normalizedUser)?.name || '';

        const hasReliableAscendant = !!(
            normalizedUser.birthTime &&
            normalizedUser.birthTime !== 'unknown' &&
            Number.isFinite(Number(normalizedUser.birthLat)) &&
            Number.isFinite(Number(normalizedUser.birthLon))
        );

        let chartSummary = {};

        try {
            if (
                window.MayaKundli?.generateBirthChart &&
                window.MayaKundli?.summarizeBirthChart &&
                normalizedUser.birthDate
            ) {
                const birthChart = MayaKundli.generateBirthChart(
                    normalizedUser.birthDate,
                    normalizedUser.birthTime,
                    normalizedUser.birthPlace,
                    normalizedUser.birthLat,
                    normalizedUser.birthLon,
                    normalizedUser.birthTimezone
                );

                chartSummary = MayaKundli.summarizeBirthChart(birthChart) || {};
            }
        } catch (error) {
            console.warn('Birth chart summary unavailable for initial reading:', error.message);
        }

        const chartMarkers = [
            westernZodiac ? `Western zodiac: ${westernZodiac}` : '',
            vedicZodiac ? `Vedic moon sign: ${vedicZodiac}` : '',
            hasReliableAscendant && chartSummary.ascendant?.name ? `Ascendant: ${chartSummary.ascendant.name}` : '',
            chartSummary.moonSign ? `Moon sign: ${chartSummary.moonSign}` : '',
            chartSummary.currentDasha?.vedic || chartSummary.currentDasha?.planet
                ? `Current dasha: ${chartSummary.currentDasha?.vedic || chartSummary.currentDasha?.planet}`
                : ''
        ].filter(Boolean).join('\n- ');

        const languageInstruction = this.getResponseLanguageInstruction(language);

        const prompt = isPreAuth
            ? `Write a completely AI-generated pre-auth opening for ${normalizedUser.fullName}. Use 5-6 sentences. The first sentence must greet them by name and briefly introduce MAYA as a personal astrology guide and voice coach who reads kundli, numerology and Lal Kitab together. In the second sentence, say that their kundli, numbers, and current timing can be turned into one practical plan. Only in the third sentence should you call out the one detail that stands out immediately from their numbers, western sign, moon sign, or timing markers, and do not recite the literal birth date unless it is genuinely necessary. Include one real strength and one real tension. If you mention zodiac, keep western zodiac, vedic moon sign, and ascendant clearly labeled and never merge them. Ground it in these exact markers:\n- Life Path: ${numerology.lifePath}\n- Destiny: ${numerology.destiny}\n- Soul Urge: ${numerology.soulUrge}${chartMarkers ? `\n- ${chartMarkers}` : ''}\nMake it feel specific and useful, not like a scripted teaser. Do not use stock praise, destiny cliches, or generic mystic filler. The final sentence should invite them to save their personal astrology reading file, not buy or unlock anything. Respond in ${languageInstruction}. Return only the spoken text.`
            : `Write a completely AI-generated personal astrology opening for ${normalizedUser.fullName}. Use 5-6 sentences. The first sentence must greet them by name and briefly introduce MAYA as a personal astrology guide and voice coach who reads kundli, numerology and Lal Kitab together. In the second sentence, say that their kundli, numbers, and current timing can be turned into one practical plan. Only in the third sentence should you call out the one detail that stands out immediately from their numbers, western sign, moon sign, or timing markers, and do not recite the literal birth date unless it is genuinely necessary. Ground it in these exact markers:\n- Life Path: ${numerology.lifePath}\n- Destiny: ${numerology.destiny}\n- Soul Urge: ${numerology.soulUrge}\n- Personal Year: ${numerology.personalYear}${chartMarkers ? `\n- ${chartMarkers}` : ''}\nName one pattern that supports them, one pattern that complicates things, and one timing clue that deserves attention. If you mention zodiac, keep western zodiac, vedic moon sign, and ascendant clearly labeled and never merge them. Do not sound scripted, promotional, or universally flattering. End with one practical next step rooted in their chart or numbers. Respond in ${languageInstruction}. Return only the spoken text.`;

        return await this.sendMessage(prompt);
    },

    /**
     * Generate daily guidance plan.
     */
    async generateDailyHoroscope(userData) {
        const zodiac = MayaAstrology.getZodiac(userData.birthDate, userData);
        if (!zodiac) return null;

        if (window.MayaHoroscopeAPI) {
            try {
                console.log('🔮 AI: Trying free horoscope API for', zodiac.name);

                const horoscope = await MayaHoroscopeAPI.getPersonalizedHoroscope(
                    { birthDate: userData.birthDate },
                    zodiac.name
                );

                if (horoscope && horoscope.combined) {
                    console.log('🔮 AI: ✅ Free horoscope API succeeded!');

                    const traits = MayaAstrology.getDailyTraits(zodiac.name);

                    const formattedHoroscope = `${userData.fullName}, ${horoscope.combined}

Your guidance cues for today:
• Number cues: ${traits.lucky.join(', ')}
• Color cue: ${traits.color}
• Supportive day rhythm: ${traits.day}
• Personal Day Number: ${horoscope.personalDay}

${horoscope.personalDayInsight}`;

                    return formattedHoroscope;
                }
            } catch (e) {
                console.warn('🔮 AI: Free API failed, falling back to AI:', e.message);
            }
        }

        const personalYear = MayaNumerology.calculatePersonalYear(userData.birthDate);
        const personalMonth = MayaNumerology.calculatePersonalMonth(userData.birthDate);
        const traits = MayaAstrology.getDailyTraits(zodiac.name);

        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const prompt = `Generate a personalized daily guidance plan for ${userData.fullName}.

Date: ${today}
Sun Sign: ${zodiac.name} ${zodiac.symbol}
Personal Year: ${personalYear}
Personal Month: ${personalMonth}
Number Cues: ${traits.lucky.join(', ')}
Color Cue: ${traits.color}
Power Day: ${traits.day}

Create a practical guidance plan that covers:
1. Overall energy of the day
2. Love and relationships
3. Career and finances
4. Health and wellness
5. Personal cues for today
6. One concrete action step

Make it feel personal and specific to them, not generic.
Use reflective but accessible language.
Speak in ${this.getResponseLanguageInstruction(userData.language)}.
Keep it concise but meaningful.`;

        return await this.sendMessage(prompt);
    },

    /**
     * Answer user question.
     */
    async askMaya(question, userData) {
        if (!this.userContext) {
            this.init(userData);
        }

        const enhancedQuestion = `User Question: "${question}"

RULES FOR THIS ANSWER:
1. Be SHORT and DIRECT - 2-4 sentences max, no fluff, no filler.
2. Give a REALISTIC, calculated answer based on the user's actual birth chart, numbers, and planetary positions. Never be vague or generic.
3. State the specific astrological/numerological reason behind your answer (planet, house, number, transit, dasha).
4. If the question has a yes/no nature, lead with a clear yes or no, then give the brief reason.
5. Sound like a confident guidance coach giving a focused consultation, not a chatbot.
6. If the question is off-topic, give a one-line redirect back to reflection, timing, daily planning, or mindful action.
7. Do NOT use filler phrases like "Let me check..." or "That's a great question...".
Speak in ${this.getResponseLanguageInstruction(this.userContext?.language)}.`;

        return await this.sendMessage(enhancedQuestion);
    },

    /**
     * Generate compatibility reading.
     */
    async generateCompatibilityReading(user1Data, user2Data) {
        const zodiac1 = MayaAstrology.getZodiac(user1Data.birthDate, user1Data);
        const zodiac2 = MayaAstrology.getZodiac(user2Data.birthDate, user2Data);

        if (!zodiac1 || !zodiac2) return null;

        const compatibility = MayaAstrology.getCompatibility(zodiac1.name, zodiac2.name);
        const num1 = MayaNumerology.calculateAll(user1Data.fullName, user1Data.birthDate);
        const num2 = MayaNumerology.calculateAll(user2Data.fullName, user2Data.birthDate);

        const prompt = `Generate a compatibility reading between two people:

Person 1: ${user1Data.fullName}
- Sun Sign: ${zodiac1.name} (${zodiac1.element})
- Life Path: ${num1.lifePath}

Person 2: ${user2Data.fullName}
- Sun Sign: ${zodiac2.name} (${zodiac2.element})
- Life Path: ${num2.lifePath}

Element Compatibility Score: ${compatibility.score}%
Basic Compatibility: ${compatibility.description}

Provide a detailed compatibility analysis covering:
1. Overall compatibility score and meaning
2. Emotional connection
3. Communication styles
4. Challenges they might face
5. Strengths of their union
6. Tips for a harmonious relationship

Make it engaging and helpful, not just factual.
Speak in ${this.getResponseLanguageInstruction(user1Data.language)}.`;

        return await this.sendMessage(prompt);
    },

    /**
     * Generate remedies and suggestions.
     */
    async generateRemedies(userData) {
        const zodiac = MayaAstrology.getZodiac(userData.birthDate, userData);
        if (!zodiac) return null;

        const traits = MayaAstrology.getDailyTraits(zodiac.name);
        const numerology = MayaNumerology.calculateAll(userData.fullName, userData.birthDate);

        const prompt = `Generate personalized remedies and spiritual suggestions for ${userData.fullName}.

Their Profile:
- Sun Sign: ${zodiac.name}
- Ruling Planet: ${zodiac.ruling}
- Lucky Stone: ${traits.stone}
- Lucky Color: ${traits.color}
- Lucky Day: ${traits.day}
- Life Path: ${numerology.lifePath}

Provide vedic remedies and suggestions for:
1. Gemstone recommendations with benefits
2. Mantras for their ruling planet
3. Favorable days and timings
4. Colors to wear for luck
5. Spiritual practices
6. Foods and lifestyle suggestions
7. Donations (Daan) that benefit them

Be specific and practical. Explain why each remedy works for them.
Speak in ${this.getResponseLanguageInstruction(userData.language)}.`;

        return await this.sendMessage(prompt);
    },

    /**
     * Get conversation history.
     */
    getHistory() {
        return [...this.conversationHistory];
    },

    /**
     * Clear conversation history.
     */
    clearHistory() {
        this.conversationHistory = [];
    },

    /**
     * Save conversation to storage.
     */
    saveConversation() {
        const utils = this._getMayaUtils();

        if (!utils?.storage?.get || !utils?.storage?.set) {
            console.warn('MayaAI saveConversation skipped: MayaUtils.storage is unavailable.');
            return;
        }

        const savedConversations = utils.storage.get('conversations', []);

        savedConversations.push({
            id: utils.generateId ? utils.generateId('conv') : `conv_${Date.now()}`,
            messages: this.conversationHistory,
            timestamp: new Date().toISOString()
        });

        utils.storage.set('conversations', savedConversations);
    }
};

// Make globally available
window.MayaAI = MayaAI;
