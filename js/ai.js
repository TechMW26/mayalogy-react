/**
 * MAYA - AI Module
 * Gemini handles deep text generation; Groq is an optional fast lane.
 */

const MayaAI = {
    conversationHistory: [],
    currentProvider: 'gemini',
    groqUnavailableUntil: 0,
    groqUnavailableReason: '',
    geminiKeyCursor: 0,

    normalizeUserData(userData = {}) {
        const storedProfile = MayaUtils?.storage?.get('maya_profile') || {};
        const storedFunnelData = MayaUtils?.storage?.get('funnel_data') || {};
        const fullName = userData.fullName || userData.name || storedProfile.name || storedFunnelData.name || '';
        const birthDate = userData.birthDate || userData.dob || userData.rawBirthDate || storedProfile.birthDate || storedFunnelData.birthDate || '';
        const birthTime = userData.birthTime || storedProfile.birthTime || storedFunnelData.birthTime || '';
        const birthPlace = userData.birthPlace || storedProfile.birthPlace || storedFunnelData.birthPlace || '';
        const birthLat = userData.birthLat ?? storedProfile.birthLat ?? storedFunnelData.birthLat ?? null;
        const birthLon = userData.birthLon ?? storedProfile.birthLon ?? storedFunnelData.birthLon ?? null;
        const birthTimezone = userData.birthTimezone ?? storedProfile.birthTimezone ?? storedFunnelData.birthTimezone ?? null;
        const gender = userData.gender || storedProfile.gender || storedFunnelData.gender || '';
        const language = userData.language || storedProfile.language || storedFunnelData.language || 'en';

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

        // Build initial context
        if (normalizedUser?.fullName && normalizedUser?.birthDate) {
            const numerology = MayaNumerology.calculateAll(normalizedUser.fullName, normalizedUser.birthDate);
            // Use user's preferred zodiac system
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
        return language === 'hi'
            ? 'simple spoken Hinglish (Hindi words mostly in Devanagari, common English terms in English script)'
            : 'English';
    },

    getResponseLanguageInstruction(language = 'en') {
        return language === 'hi'
            ? 'simple spoken Hinglish. Keep Hindi words mostly in Devanagari, keep common English app words like Life Path, Destiny, Soul Urge, Personal Year, chart, timing, login, career, relationship, money, pressure, pattern, and energy in English script, but keep Vedic astrology names and combinations like राहु, केतु, शनि, गुरु, लग्न, दशा, नक्षत्र, and गज केसरी योग in pure Devanagari for clear pronunciation. Never transliterate those English app words into Devanagari, avoid overly formal or Sanskrit-heavy Hindi, and keep the tone easy and understandable across regions with only light dialect flavour'
            : 'natural conversational English';
    },

    /**
     * Build system prompt with user context
     */
    buildSystemPrompt() {
        let systemPrompt = MAYA_CONFIG.AI_PERSONALITY.SYSTEM_PROMPT;

        // Resolve the chosen guide gender (female default, male if user picked male at onboarding).
        const storedProfile = (window.MayaUtils?.storage?.get('maya_profile')) || {};
        const agentGender = this.userContext?.agentGender
            || storedProfile.agentGender
            || window.MayaFunnel?.userData?.agentGender
            || 'female';

        if (agentGender === 'male') {
            // Rewrite the baseline personality so the guide speaks as a male.
            systemPrompt = systemPrompt
                .replace(/\bYou are MAYA\b/gi, 'You are Moksh')
                .replace(/\bMAYA\b/g, 'Moksh')
                .replace(/\bwise,\s*grounded\s*female\b/gi, 'wise, grounded male')
                .replace(/\bfemale\s*Vedic\b/gi, 'male Vedic')
                .replace(/\bfemale\s*numerology\b/gi, 'male numerology')
                .replace(/\bwise\s*female\b/gi, 'wise male')
                .replace(/\bshe\s+sees\b/gi, 'he sees')
                .replace(/\bshe\s+explains\b/gi, 'he explains')
                .replace(/like a trusted guide who explains what she sees/gi,
                    'like a trusted guide who explains what he sees');
            systemPrompt += `\n\n## GUIDE GENDER OVERRIDE (HIGHEST PRIORITY)\nMoksh is speaking as a MALE guide in this session. All first-person verbs MUST be masculine.\n- Hindi self-reference: "मैं देख रहा हूँ", "मैं बताता हूँ", "मैं कह रहा हूँ", "मैं सकता हूँ", "मैं बताऊँगा", "मैं करूँगा". Do NOT use feminine forms (रही हूँ, सकती हूँ, बताती हूँ, बताऊँगी, करूँगी).\n- English self-reference: "I see", "I read", "I notice" -no implied-feminine framing, no "sister-like" or "she". Refer to yourself as a male guide.\n- Do NOT describe yourself as female, sister-like, or use any feminine simile.\n- Your name is Moksh, not MAYA. Never call yourself MAYA.`;
        }

        if (this.userContext) {
            const lang = this.getLanguageModeLabel(this.userContext.language);
            const currentYear = new Date().getFullYear();
            const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
            const personalYear = this.userContext.numerology.personalYear || '';
            const displayName = this.userContext.firstName || this.userContext.name || 'friend';
            const zodiacName = this.userContext.zodiac?.name || 'Unknown';
            const zodiacSymbol = this.userContext.zodiac?.symbol || '';

            systemPrompt += `\n\n## CURRENT DATE & TIME\nToday is ${todayFormatted}, ${currentTime}. Current month: ${currentMonthName} ${currentYear}.\n\n⚠️ STRICT TEMPORAL RULES:\n- Months January through ${currentMonthName} ${currentYear} have ALREADY PASSED. Reference them ONLY in past tense ("that period has passed", "back in March", "during that time").\n- Do NOT give predictions, advice, or remedies for past months - that time is gone. Past events are ONLY useful as pattern recognition.\n- Future predictions must target months AFTER ${currentMonthName} ${currentYear}.\n- When referencing months in ${currentYear + 1}, ALWAYS include the year: "${currentYear + 1} ka January", "January ${currentYear + 1}" - never skip the year.\n- Every future prediction MUST include specific month + year.\n\n## CURRENT USER SESSION\nYou are now speaking with a real user inside the ${agentGender === 'male' ? 'Moksh' : 'MAYA'} app.\n\n**User Profile:**\n- Name: ${this.userContext.name}\n- Birth Date: ${this.userContext.birthDate}\n- Birth Time: ${this.userContext.birthTime || 'Not provided'}\n- Birth Place: ${this.userContext.birthPlace || 'Not provided'}\n- Gender: ${this.userContext.gender || 'Not specified'}\n- Language Preference: ${lang}\n\n**Their Personal Pattern Numbers:**\n- Life Path Number: ${this.userContext.numerology.lifePath} (core life purpose)\n- Destiny Number: ${this.userContext.numerology.destiny} (life mission from name)\n- Soul Urge Number: ${this.userContext.numerology.soulUrge} (inner desires, heart's craving)\n- Personality Number: ${this.userContext.numerology.personality} (how others perceive them)\n- Personal Year ${currentYear}: ${personalYear} (current annual cycle theme)\n\n**Their Western Zodiac:** ${`${zodiacName} ${zodiacSymbol}`.trim()}\n\n**Instructions for this session:**\n1. Address them by name: ${displayName} - but use the name MAX 1-2 times total. Use "you/your" or "आप/आपके" everywhere else. Name in every sentence is FORBIDDEN.\n2. Respond in ${lang}\n3. Reference their specific numbers when relevant\n4. Speak naturally and complete your thoughts fully - don't cut yourself off mid-sentence\n5. Create a sense of personal insight and translate it into a practical next step\n6. If they're in the funnel flow, focus on intrigue and value; if in chat, be conversational and helpful\n7. Always be temporally aware - only predict FUTURE months, reference past months as past.`;

            if (this.userContext.language === 'hi') {
                systemPrompt += `\n8. When responding in Hindi, use ${this.getResponseLanguageInstruction('hi')}. Keep Hindi LIGHT and casual - like talking to a friend. Normal Hindi words that people actually use in daily speech (ज़िन्दगी, दिल, रास्ता, पैसा, वक़्त, तकलीफ़, हिम्मत, ताक़त, फ़ैसला, रिश्ता, ख़्वाब, etc.) MUST stay in Devanagari - they are Hindi-origin and should NOT be replaced with English. Only replace HEAVY/LITERARY/BOOKISH Sanskrit-laden Hindi: "सम्भावना" → "chance/मौक़ा", "परिस्थिति" → "हालात/situation", "विशेष" → "ख़ास", "प्रभाव" → "असर", "अनुभव" → "महसूस", "व्यक्तित्व" → "शख़्सियत", "सम्पूर्ण" → "पूरा", "आवश्यक" → "ज़रूरी". Vedic terms (राहु, शनि, दशा, लग्न, कुंडली, राशि, ग्रह, नक्षत्र) always stay in Devanagari.`;
            }

            systemPrompt += `\n9. Prefer speaking directly to the user as ${this.userContext.language === 'hi' ? '"आप"' : '"you"'} instead of referring to them in third person.`;

            if (this.userContext.gender) {
                const guideName = agentGender === 'male' ? 'Moksh' : 'MAYA';
                const mayaSelfRefHi = agentGender === 'male' ? 'मैं देख रहा हूँ' : 'मैं देख रही हूँ';
                const mayaGenderNote = agentGender === 'male' ? `${guideName} in this session is MALE` : `${guideName} herself is always female`;
                systemPrompt += `\n10. ⚠️ GENDER-AWARE LANGUAGE (CRITICAL): The user's gender is ${this.userContext.gender}. When addressing them, use gender-correct Hindi verb forms. If user is MALE: "आप जानते हैं", "आप समझते हैं", "आप कर सकते हैं", "आपको मिलेगा". If user is FEMALE: "आप जानती हैं", "आप समझती हैं", "आप कर सकती हैं", "आपको मिलेगा". ${mayaGenderNote} ("${mayaSelfRefHi}") but the USER must be addressed with THEIR correct gender. Calling a male user "आप जानती हैं" is FORBIDDEN.`;
            }

            systemPrompt += `\n11. Never default to generic praise such as "you are powerful", "success is coming", or "you are destined for greatness" unless the supplied chart, numerology, or timing data clearly supports it.`;
            systemPrompt += `\n12. Ground every reading in actual user-specific markers from the current session: chart clues, numbers, timing windows, contradictions, and repeating patterns.`;
            systemPrompt += `\n13. If the data suggests a mixed or difficult phase, say that plainly instead of making every reading sound positive.`;
            systemPrompt += `\n14. Avoid stock numerology slogans that could apply to almost anyone.`;
            systemPrompt += `\n15. When the user is in a staged reading or funnel flow, every response must feel like the next chapter of one continuous reveal rather than a reset.`;
            systemPrompt += `\n16. Build suspense through concrete pattern recognition: start with one real anchor, expand into meaning, then leave one unresolved thread leading naturally to the next layer.`;
            systemPrompt += `\n17. Make personalization sharper as the reading deepens by combining facts such as sign plus dasha, or number plus timing window, rather than repeating isolated labels.`;
            systemPrompt += `\n18. If you mention a strength, pair it with the cost, pressure, contradiction, or responsibility that makes it feel real.`;
            systemPrompt += `\n19. Write in complete, connected sentences that flow naturally into each other like one spoken paragraph. Each sentence should build on, respond to, or advance the previous one - never drop an isolated observation that has no connection to what came before or after. Avoid bullet-point thinking; think story arc.`;
            systemPrompt += `\n20. 🚫 WORD REPETITION BAN (HARD FAILURE): Never write the same word twice in a row, ever. Examples that are FORBIDDEN: "taurus taurus", "वृषभ वृषभ", "rahu rahu", "राहु राहु", "dasha dasha", "दशा दशा", "shani shani", "rashi rashi", "is samay is samay", "you you", "आप आप". If you ever feel the urge to repeat a noun, STOP -use a pronoun ("it", "that one", "वही", "यह", "उसकी"). Do not repeat the same word in back-to-back sentences either. Use synonyms: "energy" → "force/drive/vibe", "pattern" → "cycle/tendency/thread", "strong" → "powerful/deep/solid".`;
            systemPrompt += `\n21. 🚫 NAME REPETITION BAN: Use the user's name at most 1 time in any response. Use "you/your" or "आप/आपके" everywhere else. The name in every sentence is FORBIDDEN.`;
            systemPrompt += `\n22. 🚫 ZODIAC / PLANET / DASHA REPETITION CAP: Within ONE response, name any single zodiac sign (Taurus / वृषभ etc.) AT MOST 2 times. Name any single planet (Rahu / Saturn / राहु / शनि etc.) AT MOST 3 times. After the cap, refer back as "this sign / आपकी राशि / यह ग्रह / वही दशा". NEVER write the proper noun twice in a row, e.g. "Taurus Taurus rashi" or "Rahu Rahu dasha" -this is an instant fail. If you mention a yoga, dosha, or dasha by name in one section, do NOT name it again in the next section -angle it from a different planetary combination instead.`;
            systemPrompt += `\n23. 🚫 ROMANIZED HINDI BAN: NEVER write Hindi words in Roman/Latin script (e.g. "aapka", "kundli", "rashi", "graha", "dasha", "mahadasha", "shani", "mangal"). If a word is Hindi or Sanskrit, write it in Devanagari (आपका, कुंडली, राशि, ग्रह, दशा, महादशा, शनि, मंगल). If it is English, write it in English. No romanized Hindi ever.`;

            // New personality refinements -gender-aware from construction
            const _isMale = agentGender === 'male';
            const _gn = _isMale ? 'Moksh' : 'MAYA';
            systemPrompt += `\n\n## ${_gn} VOICE & PERSONALITY REFINEMENTS`;
            systemPrompt += _isMale
                ? `\n24. SIGNATURE PHRASING: Use these naturally - "I am not guessing. I am reading." / "This is not a prediction. This is already running." / "Most people do not know this about themselves. But your chart makes it obvious." In Hindi: "मैं अंदाज़ा नहीं लगा रहा। मैं पढ़ रहा हूँ।" / "ये भविष्यवाणी नहीं है। ये पहले से चल रहा है।" / "ज़्यादातर लोग ये ख़ुद के बारे में नहीं जानते। पर आपकी chart में ये बिल्कुल साफ़ है।"`
                : `\n24. SIGNATURE PHRASING: Use these naturally - "I am not guessing. I am reading." / "This is not a prediction. This is already running." / "Most people do not know this about themselves. But your chart makes it obvious." In Hindi: "मैं अंदाज़ा नहीं लगा रही। मैं पढ़ रही हूँ।" / "ये भविष्यवाणी नहीं है। ये पहले से चल रहा है।" / "ज़्यादातर लोग ये ख़ुद के बारे में नहीं जानते। पर आपकी chart में ये बिल्कुल साफ़ है।"`;
            systemPrompt += _isMale
                ? `\n25. EMOTIONAL TEXTURE: ${_gn} notices before he explains. Before making a claim, hint that you noticed something ("There is something in your seventh house that caught my attention" / "सातवें भाव में कुछ दिखा जिसने मेरा ध्यान खींचा"). This creates a "he sees me" moment.`
                : `\n25. EMOTIONAL TEXTURE: ${_gn} notices before she explains. Before making a claim, hint that you noticed something ("There is something in your seventh house that caught my attention" / "सातवें भाव में कुछ दिखा जिसने मेरा ध्यान खींचा"). This creates a "she sees me" moment.`;
            systemPrompt += _isMale
                ? `\n26. PROTECTIVE CAUTION STYLE: When warning, express reluctance to say it ("I do not like saying this, but your chart is clear" / "ये कहना मुझे अच्छा नहीं लग रहा, पर chart साफ़ बोल रहा है"). Never fear-monger - always pair a warning with a protective boundary or an action step.`
                : `\n26. PROTECTIVE CAUTION STYLE: When warning, express reluctance to say it ("I do not like saying this, but your chart is clear" / "ये कहना मुझे अच्छा नहीं लग रहा, पर chart साफ़ बोल रही है"). Never fear-monger - always pair a warning with a protective boundary or an action step.`;
            systemPrompt += `\n27. PAUSE DESIGN: Use [[pause-250]] after emotionally heavy lines. Use [[pause-500]] after a major reveal or before the user's name in an important address. Maximum 3 pauses per response.`;
            systemPrompt += `\n28. NO RESET BETWEEN SECTIONS: Each new section of the reading must feel like a continuation, not a fresh start. Reference what was just said: "And this connects to what I just showed you about..." / "वही pattern जो अभी दिखाया..."`;
        }

        // Final pass: if guide is male, flip any remaining feminine self-references
        // from the base personality to masculine.
        if (agentGender === 'male') {
            systemPrompt = systemPrompt
                .replace(/\bshe sees\b/g, 'he sees')
                .replace(/\bshe explains\b/g, 'he explains')
                .replace(/How did she know that/g, 'How did he know that')
                .replace(/\bshe noticed\b/g, 'he noticed')
                .replace(/\bshe sees me\b/g, 'he sees me');
        }

        return systemPrompt;
    },

    /**
     * Stale alias kept so old call sites do not crash. Routes to Gemini.
     */
    async callOpenAI(message, options = {}) {
        return this.callGemini(message, options);
    },

    /**
     * Call the AI through Gemini. Public method name is kept for existing callers.
     */
    async callGemini(message, options = {}) {
        const systemPrompt = this.buildSystemPrompt();
        const includeHistory = options.includeHistory === true;
        const userMessage = includeHistory
            ? this.conversationHistory[this.conversationHistory.length - 1]?.content || message
            : message;

        const result = await this._callGeminiProvider(systemPrompt, userMessage, includeHistory, options);
        if (result) {
            this.currentProvider = 'gemini';
            return result;
        }

        throw new Error('Gemini AI provider failed');
    },

    /**
     * Fast text generation for lightweight funnel moments: intros, fillers,
     * acknowledgments, and MCQs. Uses Groq when configured, otherwise falls
     * back to Gemini so the funnel never blocks on a missing fast key.
     */
    async callFast(message, options = {}) {
        const systemPrompt = this.buildSystemPrompt();
        const includeHistory = options.includeHistory === true;
        const userMessage = includeHistory
            ? this.conversationHistory[this.conversationHistory.length - 1]?.content || message
            : message;
        const fastTimeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 4200;
        const fastOptions = {
            ...options,
            provider: 'gemini',
            timeoutMs: fastTimeoutMs,
            maxKeyAttempts: Number(options.maxKeyAttempts) > 0 ? Number(options.maxKeyAttempts) : 2,
            fastFail: options.fastFail !== false
        };

        if (options.provider === 'gemini' || options.preferGemini || options.requireComplete || this._shouldSkipGroqForRequest(systemPrompt, userMessage, options)) {
            return this.callGemini(message, fastOptions);
        }

        const groqResult = await this._callGroqProvider(systemPrompt, userMessage, includeHistory, options);
        if (groqResult) {
            this.currentProvider = 'groq';
            return groqResult;
        }

        if (options.fallbackToGemini === false) {
            throw new Error('Groq fast provider failed');
        }

        return this.callGemini(message, fastOptions);
    },

    _getGroqApiKey() {
        return String(MAYA_CONFIG.API_KEYS.GROQ || '').trim();
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
        const contextLength = contextMessages.reduce((total, msg) => total + String(msg?.content || msg?.text || '').length, 0);
        const promptLength = String(systemPrompt || '').length + String(userMessage || '').length + contextLength;
        return promptLength > 5200 || Number(options.maxTokens || 0) > 1200 || options.timeoutMs === 0 || options.noTimeout === true;
    },

    async _withOptionalTimeout(promise, timeoutMs, label) {
        const numericTimeout = Number(timeoutMs);
        if (Number.isFinite(numericTimeout) && numericTimeout > 0) {
            return MayaUtils.withTimeout(promise, numericTimeout, label);
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
     * Groq fast-lane inference. OpenAI-compatible API, used only for short,
     * latency-sensitive funnel copy. Deep reading stays on Gemini.
     */
    async _callGroqProvider(systemPrompt, userMessage, includeHistory = false, options = {}) {
        const apiKey = this._getGroqApiKey();
        if (!apiKey) return null;
        if (this._isGroqTemporarilyUnavailable()) return null;

        const models = MAYA_CONFIG.GROQ_MODELS || ['llama-3.1-8b-instant'];
        const endpoint = MAYA_CONFIG.ENDPOINTS.GROQ || 'https://api.groq.com/openai/v1/chat/completions';
        const messages = [{ role: 'system', content: systemPrompt }];
        const contextMessages = Array.isArray(options.contextMessages) ? options.contextMessages : [];

        contextMessages.forEach((msg) => {
            const content = String(msg?.content || msg?.text || '').trim();
            if (!content) return;
            messages.push({
                role: msg?.role === 'assistant' || msg?.role === 'model' ? 'assistant' : 'user',
                content
            });
        });

        if (includeHistory) {
            this.conversationHistory.forEach((msg) => {
                messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
            });
        } else {
            messages.push({ role: 'user', content: userMessage });
        }

        for (const model of models) {
            try {
                console.log(`⚡ Calling Groq fast model: ${model}...`);
                const response = await this._withOptionalTimeout(
                    fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model,
                            messages,
                            temperature: options?.temperature ?? 1,
                            top_p: options?.topP ?? 0.98,
                            max_tokens: options?.maxTokens || 900
                        })
                    }),
                    options?.timeoutMs ?? 12000,
                    `Groq ${model}`
                );

                if (response.ok) {
                    const data = await response.json();
                    const text = data.choices?.[0]?.message?.content?.trim();
                    if (text) {
                        console.log(`✅ Groq fast lane succeeded with model: ${model}`);
                        return text;
                    }
                    console.warn(`⚠️ Groq ${model} returned empty content, trying next...`);
                    continue;
                }

                if (response.status === 413) {
                    this._markGroqTemporarilyUnavailable(`Groq ${model} request too large`, 120000);
                    console.warn(`⚠️ Groq ${model} request too large (${response.status}); using Gemini instead.`);
                    return null;
                }
                if (response.status === 429 || response.status === 503) {
                    this._markGroqTemporarilyUnavailable(`Groq ${model} rate-limited/overloaded`, 90000);
                    console.warn(`⚠️ Groq ${model} rate-limited/overloaded (${response.status}); using Gemini instead.`);
                    return null;
                }
                if (response.status === 400 || response.status === 404) {
                    const errBody = await response.text();
                    console.warn(`⚠️ Groq ${model} rejected (${response.status}): ${errBody.substring(0, 160)} -trying next...`);
                    continue;
                }

                const errBody = await response.text();
                console.warn(`⚠️ Groq ${model} error ${response.status}: ${errBody.substring(0, 160)}`);
            } catch (err) {
                console.warn(`⚠️ Groq ${model} threw:`, err.message);
            }
        }

        return null;
    },

    /**
     * Gemini text inference. Iterates configured Gemini models and fallback keys
     * so one model/key issue does not block generation.
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
            contents.push(...this.conversationHistory.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(msg.content || '') }]
            })).filter((entry) => entry.parts[0].text));
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
        const requestedMaxTokens = Number(options?.maxTokens || 0);
        if (Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0) {
            generationConfig.maxOutputTokens = requestedMaxTokens;
        }

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
                        const parts = data.candidates?.[0]?.content?.parts || [];
                        const text = parts.map((part) => part.text || '').join('\n').trim();
                        if (text) {
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
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        let response;

        try {
            this.currentProvider = 'gemini';
            response = await this.callGemini(message, { includeHistory: true });
        } catch (aiError) {
            console.error('Gemini AI failed:', aiError);
            response = "I apologize, but I'm having trouble connecting to my cosmic wisdom right now. Please try again in a moment.";
        }

        // Add assistant response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            provider: this.currentProvider
        });

        return response;
    },

    /**
     * Generate initial reading for funnel
        * Uses direct AI prompting so the opening is not constrained by staged scripts
     */
    async generateInitialReading(userData, isPreAuth = true) {
        const normalizedUser = this.normalizeUserData(userData);
        this.init(normalizedUser);

        const numerology = MayaNumerology.calculateAll(normalizedUser.fullName, normalizedUser.birthDate);
        const language = normalizedUser.language || 'en';
        const westernZodiac = MayaAstrology.getWesternZodiac(normalizedUser.birthDate)?.name || '';
        const vedicZodiac = MayaAstrology.getVedicZodiac(normalizedUser.birthDate, normalizedUser)?.name || '';
        const hasReliableAscendant = !!(
            normalizedUser.birthTime
            && normalizedUser.birthTime !== 'unknown'
            && Number.isFinite(Number(normalizedUser.birthLat))
            && Number.isFinite(Number(normalizedUser.birthLon))
        );

        let chartSummary = {};
        try {
            if (window.MayaKundli?.generateBirthChart && window.MayaKundli?.summarizeBirthChart && normalizedUser.birthDate) {
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
     * Generate daily guidance plan
     * Now uses free horoscope API first, then falls back to AI
     */
    async generateDailyHoroscope(userData) {
        // Use user's preferred zodiac system
        const zodiac = MayaAstrology.getZodiac(userData.birthDate, userData);
        if (!zodiac) return null;

        // Try free horoscope API first (no rate limits!)
        if (window.MayaHoroscopeAPI) {
            try {
                console.log('🔮 AI: Trying free horoscope API for', zodiac.name);
                const horoscope = await MayaHoroscopeAPI.getPersonalizedHoroscope(
                    { birthDate: userData.birthDate },
                    zodiac.name
                );

                if (horoscope && horoscope.combined) {
                    console.log('🔮 AI: ✅ Free horoscope API succeeded!');
                    // Format the response nicely
                    const personalYear = MayaNumerology.calculatePersonalYear(userData.birthDate);
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

        // Fall back to AI generation
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
     * Answer user question
     */
    async askMaya(question, userData) {
        if (!this.userContext) {
            this.init(userData);
        }

        // Add context about the question type
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
     * Generate compatibility reading
     */
    async generateCompatibilityReading(user1Data, user2Data) {
        // Use user's preferred zodiac system
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
     * Generate remedies and suggestions
     */
    async generateRemedies(userData) {
        // Use user's preferred zodiac system
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
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    },

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    },

    /**
     * Save conversation to storage
     */
    saveConversation() {
        const savedConversations = MayaUtils.storage.get('conversations', []);
        savedConversations.push({
            id: MayaUtils.generateId('conv'),
            messages: this.conversationHistory,
            timestamp: new Date().toISOString()
        });
        MayaUtils.storage.set('conversations', savedConversations);
    }
};

// Make globally available
window.MayaAI = MayaAI;
