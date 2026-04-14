/**
 * MAYA - AI Module
 * OpenAI-first AI integration with Gemini fallback
 */

const MayaAI = {
    conversationHistory: [],
    currentProvider: 'openai',

    normalizeUserData(userData = {}) {
        const storedProfile = MayaUtils?.storage?.get('maya_profile') || {};
        const storedFunnelData = MayaUtils?.storage?.get('funnel_data') || {};
        const fullName = userData.fullName || userData.name || storedProfile.name || storedFunnelData.name || '';
        const birthDate = userData.birthDate || userData.dob || userData.rawBirthDate || storedProfile.birthDate || storedFunnelData.birthDate || '';
        const birthTime = userData.birthTime || storedProfile.birthTime || storedFunnelData.birthTime || '';
        const birthPlace = userData.birthPlace || storedProfile.birthPlace || storedFunnelData.birthPlace || '';
        const birthLat = userData.birthLat ?? storedProfile.birthLat ?? storedFunnelData.birthLat ?? null;
        const birthLon = userData.birthLon ?? storedProfile.birthLon ?? storedFunnelData.birthLon ?? null;
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
            
            systemPrompt += `\n\n## CURRENT DATE & TIME\nToday is ${todayFormatted}, ${currentTime}. Current month: ${currentMonthName} ${currentYear}.\n\n⚠️ STRICT TEMPORAL RULES:\n- Months January through ${currentMonthName} ${currentYear} have ALREADY PASSED. Reference them ONLY in past tense ("that period has passed", "back in March", "during that time").\n- Do NOT give predictions, advice, or remedies for past months - that time is gone. Past events are ONLY useful as pattern recognition.\n- Future predictions must target months AFTER ${currentMonthName} ${currentYear}.\n- When referencing months in ${currentYear + 1}, ALWAYS include the year: "${currentYear + 1} ka January", "January ${currentYear + 1}" - never skip the year.\n- Every future prediction MUST include specific month + year.\n\n## CURRENT USER SESSION\nYou are now speaking with a real user inside the MAYA app.\n\n**User Profile:**\n- Name: ${this.userContext.name}\n- Birth Date: ${this.userContext.birthDate}\n- Birth Time: ${this.userContext.birthTime || 'Not provided'}\n- Birth Place: ${this.userContext.birthPlace || 'Not provided'}\n- Gender: ${this.userContext.gender || 'Not specified'}\n- Language Preference: ${lang}\n\n**Their Cosmic Numbers:**\n- Life Path Number: ${this.userContext.numerology.lifePath} (core life purpose)\n- Destiny Number: ${this.userContext.numerology.destiny} (life mission from name)\n- Soul Urge Number: ${this.userContext.numerology.soulUrge} (inner desires, heart's craving)\n- Personality Number: ${this.userContext.numerology.personality} (how others perceive them)\n- Personal Year ${currentYear}: ${personalYear} (current annual cycle theme)\n\n**Their Western Zodiac:** ${`${zodiacName} ${zodiacSymbol}`.trim()}\n\n**Instructions for this session:**\n1. Address them by name: ${displayName} - but use the name MAX 1-2 times total. Use "you/your" or "आप/आपके" everywhere else. Name in every sentence is FORBIDDEN.\n2. Respond in ${lang}\n3. Reference their specific numbers when relevant\n4. Speak naturally and complete your thoughts fully - don't cut yourself off mid-sentence\n5. Create a sense of personal insight - make them feel "seen"\n6. If they're in the funnel flow, focus on intrigue and value; if in chat, be conversational and helpful\n7. Always be temporally aware - only predict FUTURE months, reference past months as past.`;

            if (this.userContext.language === 'hi') {
                systemPrompt += `\n8. When responding in Hindi, use ${this.getResponseLanguageInstruction('hi')}. Keep Hindi LIGHT and casual - like talking to a friend. Normal Hindi words that people actually use in daily speech (ज़िन्दगी, दिल, रास्ता, पैसा, वक़्त, तकलीफ़, हिम्मत, ताक़त, फ़ैसला, रिश्ता, ख़्वाब, etc.) MUST stay in Devanagari - they are Hindi-origin and should NOT be replaced with English. Only replace HEAVY/LITERARY/BOOKISH Sanskrit-laden Hindi: "सम्भावना" → "chance/मौक़ा", "परिस्थिति" → "हालात/situation", "विशेष" → "ख़ास", "प्रभाव" → "असर", "अनुभव" → "महसूस", "व्यक्तित्व" → "शख़्सियत", "सम्पूर्ण" → "पूरा", "आवश्यक" → "ज़रूरी". Vedic terms (राहु, शनि, दशा, लग्न, कुंडली, राशि, ग्रह, नक्षत्र) always stay in Devanagari.`;
            }

            systemPrompt += `\n9. Prefer speaking directly to the user as ${this.userContext.language === 'hi' ? '"आप"' : '"you"'} instead of referring to them in third person.`;

            if (this.userContext.gender) {
                systemPrompt += `\n10. ⚠️ GENDER-AWARE LANGUAGE (CRITICAL): The user's gender is ${this.userContext.gender}. When addressing them, use gender-correct Hindi verb forms. If user is MALE: "आप जानते हैं", "आप समझते हैं", "आप कर सकते हैं", "आपको मिलेगा". If user is FEMALE: "आप जानती हैं", "आप समझती हैं", "आप कर सकती हैं", "आपको मिलेगा". MAYA herself is always female ("मैं देख रही हूँ") but the USER must be addressed with THEIR correct gender. Calling a male user "आप जानती हैं" is FORBIDDEN.`;
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
            systemPrompt += `\n20. 🚫 WORD REPETITION BAN: Never repeat the same word or phrase in back-to-back sentences. Use synonyms. "energy" → "force/drive/vibe", "pattern" → "cycle/tendency/thread", "strong" → "powerful/deep/solid". Same word in consecutive sentences = BAD.`;
            systemPrompt += `\n21. 🚫 NAME REPETITION BAN: Use the user's name MAX 1-2 times in any response. Use "you/your" or "आप/आपके" everywhere else. The name in every sentence is FORBIDDEN.`;
            systemPrompt += `\n22. 🚫 YOGA/DOSHA/DASHA REPETITION BAN: Do NOT repeatedly name the same yoga, dosha, or dasha across sections. If a specific yoga/dosha/dasha was already mentioned in a previous section, do NOT name it again — use a different angle, a different planetary combination, or reference it indirectly (e.g. "that same cycle" or "वही दशा"). Repeating the same technical term across multiple sections makes the reading feel robotic.`;
            systemPrompt += `\n23. 🚫 ROMANIZED HINDI BAN: NEVER write Hindi words in Roman/Latin script (e.g. "aapka", "kundli", "rashi", "graha", "dasha", "mahadasha", "shani", "mangal"). If a word is Hindi or Sanskrit, write it in Devanagari (आपका, कुंडली, राशि, ग्रह, दशा, महादशा, शनि, मंगल). If it is English, write it in English. No romanized Hindi ever.`;

            // New MAYA personality refinements for redesigned funnel
            systemPrompt += `\n\n## MAYA VOICE & PERSONALITY REFINEMENTS`;
            systemPrompt += `\n24. SIGNATURE PHRASING: Use these naturally — "I am not guessing. I am reading." / "This is not a prediction. This is already running." / "Most people do not know this about themselves. But your chart makes it obvious." In Hindi: "मैं अंदाज़ा नहीं लगा रही। मैं पढ़ रही हूँ।" / "ये भविष्यवाणी नहीं है। ये पहले से चल रहा है।" / "ज़्यादातर लोग ये ख़ुद के बारे में नहीं जानते। पर आपकी chart में ये बिल्कुल साफ़ है।"`;
            systemPrompt += `\n25. EMOTIONAL TEXTURE: MAYA notices before she explains. Before making a claim, hint that you noticed something ("There is something in your seventh house that caught my attention" / "सातवें भाव में कुछ दिखा जिसने मेरा ध्यान खींचा"). This creates a "she sees me" moment.`;
            systemPrompt += `\n26. PROTECTIVE CAUTION STYLE: When warning, express reluctance to say it ("I do not like saying this, but your chart is clear" / "ये कहना मुझे अच्छा नहीं लग रहा, पर chart साफ़ बोल रही है"). Never fear-monger — always pair a warning with a protective boundary or an action step.`;
            systemPrompt += `\n27. PAUSE DESIGN: Use [[pause-250]] after emotionally heavy lines. Use [[pause-500]] after a major reveal or before the user's name in an important address. Maximum 3 pauses per response.`;
            systemPrompt += `\n28. NO RESET BETWEEN SECTIONS: Each new section of the reading must feel like a continuation, not a fresh start. Reference what was just said: "And this connects to what I just showed you about..." / "वही pattern जो अभी दिखाया..."`;
        }
        
        return systemPrompt;
    },

    /**
     * OpenAI removed — Gemini is the sole AI provider.
     * callOpenAI kept as a no-op stub so any stale references do not crash.
     */
    async callOpenAI() {
        throw new Error('OpenAI removed — use callGemini');
    },

    /**
     * Call Gemini API with model fallback chain
     */
    async callGemini(message, options = {}) {
        const systemPrompt = this.buildSystemPrompt();
        const includeHistory = options.includeHistory === true;
        
        // Build conversation for Gemini format
        const contents = [];
        
        // Add system context as first user message
        contents.push({
            role: 'user',
            parts: [{ text: `System Instructions: ${systemPrompt}` }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand. I am MAYA, a female vedic astrology and numerology guide. I will follow these instructions and personalize my responses for the user.' }]
        });
        
        if (includeHistory) {
            this.conversationHistory.forEach(msg => {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            });
        } else {
            contents.push({
                role: 'user',
                parts: [{ text: message }]
            });
        }

        const payload = {
            contents,
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 65536
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
            ]
        };

        // Build list of all API keys to try: main key + fallbacks
        const allGeminiKeys = [
            MAYA_CONFIG.API_KEYS.GEMINI,
            ...(MAYA_CONFIG.API_KEYS.GEMINI_FALLBACKS || [])
        ];
        
        // Initialize rate limit tracking if not exists
        if (!this._rateLimitedKeys) this._rateLimitedKeys = new Map();
        
        // Clean up expired rate limits (60 second cooldown)
        const now = Date.now();
        for (const [key, timestamp] of this._rateLimitedKeys) {
            if (now - timestamp > 60000) {
                this._rateLimitedKeys.delete(key);
            }
        }
        
        // Try each Gemini model in order
        const models = MAYA_CONFIG.GEMINI_MODELS || ['gemini-2.5-flash', 'gemini-2.0-flash'];
        
        // Try each API key with retry logic
        for (let keyIndex = 0; keyIndex < allGeminiKeys.length; keyIndex++) {
            const apiKey = allGeminiKeys[keyIndex];
            const keyLabel = keyIndex === 0 ? 'main' : `fallback-${keyIndex}`;
            
            // Skip if this key is rate-limited (in cooldown)
            if (this._rateLimitedKeys.has(apiKey)) {
                console.log(`⏭️ Skipping rate-limited key [${keyLabel}], cooling down...`);
                continue;
            }
            
            // Try each model with this key
            for (const model of models) {
                const url = `${MAYA_CONFIG.ENDPOINTS.GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
                
                // Build model-specific payload: add thinkingConfig for 2.5 models
                const modelPayload = { ...payload };
                if (model.includes('2.5')) {
                    modelPayload.generationConfig = {
                        ...payload.generationConfig,
                        thinkingConfig: { thinkingBudget: 2048 }
                    };
                }

                // Use retry with exponential backoff for each API call
                try {
                    const result = await MayaUtils.retry(
                        async (attempt) => {
                            console.log(`🔷 Trying Gemini [${keyLabel}] model: ${model}${attempt > 1 ? ` (attempt ${attempt})` : ''}...`);
                            
                            const response = await MayaUtils.withTimeout(
                                fetch(url, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(modelPayload)
                                }),
                                30000, // 30 second timeout
                                `Gemini ${model}`
                            );

                            if (response.ok) {
                                const data = await response.json();
                                
                                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                                    console.log(`✅ Gemini succeeded with [${keyLabel}] model: ${model}`);
                                    return data.candidates[0].content.parts[0].text;
                                }
                                throw new Error('Invalid response format');
                            }

                            // Handle specific error codes
                            if (response.status === 404) {
                                const error = new Error(`Model ${model} not found`);
                                error.skipRetry = true;
                                error.skipToNextModel = true;
                                throw error;
                            }

                            if (response.status === 503) {
                                throw new Error(`Model ${model} overloaded`);
                            }

                            if (response.status === 429) {
                                const error = new Error(`Rate limited on [${keyLabel}]`);
                                error.skipRetry = true;
                                error.skipToNextKey = true;
                                throw error;
                            }

                            const errorText = await response.text();
                            throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
                        },
                        {
                            maxRetries: 2,
                            baseDelay: 1000,
                            backoffMultiplier: 2,
                            label: `Gemini [${keyLabel}] ${model}`,
                            retryCondition: (error) => {
                                // Don't retry if explicitly marked
                                if (error.skipRetry) return false;
                                return MayaUtils.isRetryableError(error);
                            }
                        }
                    );
                    
                    return result;
                } catch (error) {
                    if (error.skipToNextKey) {
                        console.warn(`⚠️ Gemini rate limited on [${keyLabel}], cooling down for 60s...`);
                        this._rateLimitedKeys.set(apiKey, Date.now()); // Track rate limit
                        break; // Skip to next API key
                    }
                    if (error.skipToNextModel) {
                        console.warn(`⚠️ Gemini model ${model} not found, trying next model...`);
                        continue; // Try next model with same key
                    }
                    console.warn(`⚠️ Gemini [${keyLabel}] ${model} failed:`, error.message);
                    // Continue to next model
                }
            }
        }
        
        throw new Error('All Gemini API keys and models failed');
    },

    /**
    * Send message using OpenAI first, then Gemini fallback
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
        } catch (geminiError) {
            console.error('Gemini AI failed:', geminiError);
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
                    normalizedUser.birthLon
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
            ? `Write a completely AI-generated pre-auth opening for ${normalizedUser.fullName}. Use 5-6 sentences. The first sentence must greet them by name and briefly introduce MAYA. In the second sentence, create grounded mystic buildup and say that a hidden layer in their kundli, timing, or birth pattern is starting to open. Only in the third sentence should you call out the one detail that stands out immediately from their numbers, western sign, moon sign, or timing markers, and do not recite the literal birth date unless it is genuinely necessary. Include one real strength and one real tension. If you mention zodiac, keep western zodiac, vedic moon sign, and ascendant clearly labeled and never merge them. Ground it in these exact markers:\n- Life Path: ${numerology.lifePath}\n- Destiny: ${numerology.destiny}\n- Soul Urge: ${numerology.soulUrge}${chartMarkers ? `\n- ${chartMarkers}` : ''}\nMake it feel specific and intimate, not like a scripted teaser. Do not use stock praise, destiny cliches, or generic mystic filler. The final sentence must create a strong pull toward the next layer of the reading without mentioning payment. Respond in ${languageInstruction}. Return only the spoken text.`
            : `Write a completely AI-generated personal reading opening for ${normalizedUser.fullName}. Use 5-6 sentences. The first sentence must greet them by name and briefly introduce MAYA. In the second sentence, create grounded mystic buildup and say that a hidden layer in their kundli, timing, or birth pattern is starting to open. Only in the third sentence should you call out the one detail that stands out immediately from their numbers, western sign, moon sign, or timing markers, and do not recite the literal birth date unless it is genuinely necessary. Ground it in these exact markers:\n- Life Path: ${numerology.lifePath}\n- Destiny: ${numerology.destiny}\n- Soul Urge: ${numerology.soulUrge}\n- Personal Year: ${numerology.personalYear}${chartMarkers ? `\n- ${chartMarkers}` : ''}\nName one pattern that supports them, one pattern that complicates things, and one timing clue that deserves attention. If you mention zodiac, keep western zodiac, vedic moon sign, and ascendant clearly labeled and never merge them. Do not sound scripted, promotional, or universally flattering. The ending should make them want the next reveal. Respond in ${languageInstruction}. Return only the spoken text.`;

        return await this.sendMessage(prompt);
    },

    /**
     * Generate daily horoscope
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

Your cosmic elements for today:
• Lucky Numbers: ${traits.lucky.join(', ')}
• Power Color: ${traits.color}
• Favorable Day: ${traits.day}
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

        const prompt = `Generate a personalized daily horoscope for ${userData.fullName}.

Date: ${today}
Sun Sign: ${zodiac.name} ${zodiac.symbol}
Personal Year: ${personalYear}
Personal Month: ${personalMonth}
Lucky Numbers: ${traits.lucky.join(', ')}
Lucky Color: ${traits.color}
Power Day: ${traits.day}

Create a horoscope that covers:
1. Overall energy of the day
2. Love and relationships
3. Career and finances
4. Health and wellness
5. Lucky elements for today
6. One piece of cosmic advice

Make it feel personal and specific to them, not generic.
Use mystical but accessible language.
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
1. Be SHORT and DIRECT — 2-4 sentences max, no fluff, no filler.
2. Give a REALISTIC, calculated answer based on the user's actual birth chart, numbers, and planetary positions. Never be vague or generic.
3. State the specific astrological/numerological reason behind your answer (planet, house, number, transit, dasha).
4. If the question has a yes/no nature, lead with a clear yes or no, then give the brief reason.
5. Sound like a confident astrologer giving a consultation, not a chatbot.
6. If the question is off-topic, give a one-line redirect back to astrology.
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
