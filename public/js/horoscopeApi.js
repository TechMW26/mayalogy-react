const MayaHoroscopeAPI = {
    cache: new Map(),
    cacheExpiry: 0,
    cacheEnabled: false,

    // Map zodiac names to API format
    signMap: {
        'Aries': 'aries',
        'Taurus': 'taurus', 
        'Gemini': 'gemini',
        'Cancer': 'cancer',
        'Leo': 'leo',
        'Virgo': 'virgo',
        'Libra': 'libra',
        'Scorpio': 'scorpio',
        'Sagittarius': 'sagittarius',
        'Capricorn': 'capricorn',
        'Aquarius': 'aquarius',
        'Pisces': 'pisces'
    },

    // Vedic Moon Signs (Rashi)
    rashiMap: {
        'Mesha': 'Aries',
        'Vrishabha': 'Taurus',
        'Mithuna': 'Gemini',
        'Karka': 'Cancer',
        'Simha': 'Leo',
        'Kanya': 'Virgo',
        'Tula': 'Libra',
        'Vrishchika': 'Scorpio',
        'Dhanu': 'Sagittarius',
        'Makara': 'Capricorn',
        'Kumbha': 'Aquarius',
        'Meena': 'Pisces'
    },

    getCached(cacheKey) {
        if (!this.cacheEnabled || this.cacheExpiry <= 0) {
            return null;
        }

        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        return null;
    },

    setCached(cacheKey, data) {
        if (!this.cacheEnabled || this.cacheExpiry <= 0) {
            return;
        }

        this.cache.set(cacheKey, { data, timestamp: Date.now() });
    },

    /**
     * Get daily horoscope - MAYA-powered with personalization
     * @param {string} sign - Zodiac sign name
     * @param {string} day - 'today', 'tomorrow', or 'yesterday'
     * @param {object} userData - Optional user data for personalization
     * @returns {Promise<object>} Horoscope data
     */
    async getDailyHoroscope(sign, day = 'today', userData = null) {
        const signKey = this.signMap[sign] || sign.toLowerCase();
        
        // Get stored user data if not provided
        if (!userData) {
            userData = window.MayaUtils?.storage?.get('maya_user') || {};
        }
        
        const cacheKey = `${signKey}_${day}_${userData?.name || 'anon'}`;

        // Check cache first
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`📦 Horoscope cache hit: ${cacheKey}`);
            return cached;
        }

        console.log(`🔮 Generating personalized horoscope for ${sign} (${day})...`);

        // Generate MAYA-powered personalized horoscope
        try {
            const data = await this.generatePersonalizedHoroscope(sign, day, userData);
            if (data && data.description) {
                this.setCached(cacheKey, data);
                console.log(`✅ Horoscope: AI generation succeeded!`);
                return data;
            }
        } catch (error) {
            console.warn(`AI generation failed:`, error.message);
        }

        console.log(`⚠️ AI failed, returning live-reading unavailable state`);
        return this.getUnavailableHoroscope(sign, day, userData);
    },

    /**
     * Generate personalized horoscope using AI
     * Includes user's name, DOB, TOB, Rashi, and today's date
     */
    async generatePersonalizedHoroscope(sign, day, userData = {}) {
        if (!window.MayaAI) {
            throw new Error('MayaAI not available');
        }

        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Get language preference
        const language = window.MayaUtils?.storage?.get('maya_language') || 'en';
        const isHindi = language === 'hi';

        // Build personalization context
        const name = userData.name || userData.fullName || '';
        const firstName = name.split(' ')[0] || 'Friend';
        const dob = userData.birthDate || userData.dob || '';
        const tob = userData.birthTime || '';
        const birthPlace = userData.birthPlace || '';
        
        // Calculate numerology numbers if we have DOB
        let numerologyContext = '';
        if (dob && window.MayaNumerology) {
            const calcs = MayaNumerology.calculateAll(name, dob);
            numerologyContext = `
Their numerology numbers:
- Life Path: ${calcs.lifePath}
- Personal Year: ${calcs.personalYear}
- Personal Day: ${this.calculatePersonalDay(dob)}`;
        }

        // Get Rashi (Moon Sign) if available
        const rashi = userData.rashi || userData.moonSign || '';
        
        // Build the prompt
        const prompt = isHindi 
            ? `आप MAYA हैं - एक wise MALE Vedic astrologer और numerologist।

आज की तारीख: ${formattedDate}
राशि: ${sign}
${name ? `नाम: ${firstName}` : ''}
${dob ? `जन्म तिथि: ${dob}` : ''}
${tob ? `जन्म समय: ${tob}` : ''}
${birthPlace ? `जन्म स्थान: ${birthPlace}` : ''}
${rashi ? `चंद्र राशि (Rashi): ${rashi}` : ''}
${numerologyContext}

${firstName} जी के लिए आज का personalized राशिफल लिखिए।

RULES:
- ${day === 'today' ? 'आज' : day === 'tomorrow' ? 'कल' : 'कल (बीता हुआ)'} के लिए specific होना चाहिए
- उनके numbers और planetary positions को reference करें
- Practical advice दें जो actionable हो
- MALE verb forms use करें (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)
- 3-4 sentences, simple spoken Hinglish में
- Hindi words mostly Devanagari में रखें, लेकिन chart, timing, career, relationship, money, energy जैसे common English words English script में रखें
- बहुत शुद्ध या किताबी Hindi मत लिखें; light everyday dialect flavour ठीक है, लेकिन आसानी बनी रहे
- JSON format में respond करें:
{"description": "...", "mood": "...", "luckyNumber": "...", "color": "...", "advice": "..."}`
            : `You are MAYA - a wise MALE Vedic astrologer and numerologist.

Today's Date: ${formattedDate}
Zodiac Sign: ${sign}
${name ? `Name: ${firstName}` : ''}
${dob ? `Date of Birth: ${dob}` : ''}
${tob ? `Time of Birth: ${tob}` : ''}
${birthPlace ? `Birth Place: ${birthPlace}` : ''}
${rashi ? `Moon Sign (Rashi): ${rashi}` : ''}
${numerologyContext}

Write a personalized horoscope for ${firstName} for ${day}.

RULES:
- Be specific to ${day}'s cosmic energy and planetary positions
- Reference their numbers and personal cycles if available
- Give practical, actionable advice
- You are MALE - warm elder brother energy
- 3-4 sentences, conversational tone
- Respond in JSON format only:
{"description": "...", "mood": "...", "luckyNumber": "...", "color": "...", "advice": "..."}`;

        try {
            const response = await MayaAI.sendMessage(prompt);
            
            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    sign: sign,
                    date: today.toISOString().split('T')[0],
                    description: parsed.description,
                    mood: parsed.mood || '',
                    luckyNumber: parsed.luckyNumber || '',
                    color: parsed.color || '',
                    advice: parsed.advice || '',
                    personalized: true,
                    source: 'ai-personalized'
                };
            }
            
            // If no JSON, use the response as description
            return {
                sign: sign,
                date: today.toISOString().split('T')[0],
                description: response.substring(0, 500),
                personalized: true,
                source: 'ai-personalized'
            };
        } catch (error) {
            console.error('AI horoscope generation error:', error);
            throw error;
        }
    },

    /**
     * Get static horoscope content when AI fails
     * Uses pre-written content based on zodiac characteristics
     */
    getStaticHoroscope(sign, day) {
        return this.getUnavailableHoroscope(sign, day);
    },

    /**
     * Get personalized horoscope with full user data
     * Main entry point for pages.js
     */
    async getPersonalizedHoroscope(userData, zodiacSign) {
        const baseHoroscope = await this.getDailyHoroscope(zodiacSign, 'today', userData);
        
        // Get numerology personal day number for extra personalization
        const personalDay = userData?.birthDate ? this.calculatePersonalDay(userData.birthDate) : null;
        const personalDayInsight = personalDay ? this.getPersonalDayInsight(personalDay) : '';
        
        return {
            ...baseHoroscope,
            personalDay: personalDay,
            personalDayInsight: personalDayInsight,
            combined: personalDayInsight 
                ? `${baseHoroscope.description} ${personalDayInsight}`
                : baseHoroscope.description
        };
    },

    /**
     * Calculate personal day number
     */
    calculatePersonalDay(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        
        const day = today.getDate();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const birthDay = birth.getDate();
        const birthMonth = birth.getMonth() + 1;
        
        // Personal Day = Universal Day + Birth Day + Birth Month
        const universalDay = this.reduceNumber(day + month + year);
        const personal = this.reduceNumber(universalDay + birthDay + birthMonth);
        
        return personal;
    },

    /**
     * Reduce to single digit (preserve master numbers)
     */
    reduceNumber(num) {
        while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
            num = String(num).split('').reduce((sum, d) => sum + parseInt(d), 0);
        }
        return num;
    },

    /**
     * Get insight for personal day number
     */
    getPersonalDayInsight(number) {
        const insights = {
            1: "Today favors new beginnings and leadership initiatives.",
            2: "Cooperation and patience bring the best results today.",
            3: "Express yourself creatively and socially engage with others.",
            4: "Focus on practical tasks and building solid foundations.",
            5: "Embrace change and seek variety in your activities.",
            6: "Home, family, and responsibilities take center stage.",
            7: "Reflect, research, and seek deeper understanding.",
            8: "Financial and career matters require your attention.",
            9: "Complete projects and practice compassion today.",
            11: "Trust your intuition and inspire others with your vision.",
            22: "Think big and work toward manifesting your dreams.",
            33: "Your healing energy benefits those around you."
        };
        
        return insights[number] || insights[this.reduceNumber(number)];
    },

    /**
     * Generate Do's and Don'ts based on today's horoscope
     * @param {string} horoscopeText - The horoscope text to base recommendations on
     * @param {string} zodiacSign - User's zodiac sign
     * @param {object} userData - User data for personalization
     * @returns {Promise<object>} Object with dos and donts arrays
     */
    async generateDosAndDonts(horoscopeText, zodiacSign, userData = {}) {
        const cacheKey = `dos_donts_${zodiacSign}_${new Date().toISOString().split('T')[0]}`;
        
        // Check cache first
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`📦 Do's & Don'ts cache hit`);
            return cached;
        }

        if (!window.MayaAI) {
            console.warn('MayaAI not available for Do\'s & Don\'ts');
            return this.getUnavailableDosAndDonts();
        }

        const language = window.MayaUtils?.storage?.get('maya_language') || 'en';
        const isHindi = language === 'hi';
        const name = userData.name || userData.fullName || '';
        const firstName = name.split(' ')[0] || 'Friend';

        const prompt = isHindi
            ? `आप MAYA हैं - एक wise MALE Vedic astrologer।

आज का राशिफल ${zodiacSign} के लिए:
"${horoscopeText}"

${firstName} जी के लिए आज के Do's और Don'ts बताइए।

RULES:
- 5 Do's (करें) और 5 Don'ts (न करें) दें
- Do's और Don'ts independent होने चाहिए, एक दूसरे के opposite नहीं
- Short, actionable points (5-10 words each)
- Mix of practical, spiritual, and lifestyle tips
- simple spoken Hinglish रखें, बहुत formal Hindi नहीं
- Hindi words mostly Devanagari में रखें, common English words English script में रखें
- ONLY respond with JSON, no explanation:
{"dos": ["...", "...", "...", "...", "..."], "donts": ["...", "...", "...", "...", "..."]}`
            : `You are MAYA - a wise MALE Vedic astrologer.

Today's horoscope for ${zodiacSign}:
"${horoscopeText}"

Provide today's Do's and Don'ts for ${firstName}.

RULES:
- Give exactly 5 Do's and 5 Don'ts
- Do's and Don'ts should be INDEPENDENT, not opposites of each other
- Keep each point short and actionable (5-10 words)
- Mix of practical advice, spiritual guidance, and lifestyle tips
- ONLY respond with JSON, no explanation:
{"dos": ["...", "...", "...", "...", "..."], "donts": ["...", "...", "...", "...", "..."]}`;

        try {
            const response = await MayaAI.sendMessage(prompt);
            
            // Parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const result = {
                    dos: parsed.dos || [],
                    donts: parsed.donts || [],
                    source: 'ai'
                };
                
                // Cache the result
                this.setCached(cacheKey, result);
                console.log(`✅ Do's & Don'ts: AI generation succeeded!`);
                return result;
            }
        } catch (error) {
            console.warn('AI Do\'s & Don\'ts generation failed:', error.message);
        }

        return this.getUnavailableDosAndDonts();
    },

    /**
     * Get static Do's and Don'ts when AI fails
     */
    getStaticDosAndDonts(sign) {
        return this.getUnavailableDosAndDonts(sign);
    },

    /**
     * Generate detailed insight for a specific aspect (Love, Career, etc.)
     * @param {string} aspect - The aspect name (love, career, finance, health, family, luck)
     * @param {number} rating - The rating (1-5)
     * @param {string} horoscopeText - Today's horoscope for context
     * @param {string} zodiacSign - User's zodiac sign
     * @param {object} userData - User data for personalization
     * @returns {Promise<object>} Detailed insight with explanation and advice
     */
    async generateAspectInsight(aspect, rating, horoscopeText, zodiacSign, userData = {}) {
        const cacheKey = `aspect_${aspect}_${zodiacSign}_${new Date().toISOString().split('T')[0]}`;
        
        // Check cache first
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`📦 Aspect insight cache hit: ${aspect}`);
            return cached;
        }

        const language = window.MayaUtils?.storage?.get('maya_language') || 'en';
        const isHindi = language === 'hi';
        const name = userData.name || userData.fullName || '';
        const firstName = name.split(' ')[0] || (isHindi ? 'मित्र' : 'Friend');

        const ratingDescriptions = {
            1: isHindi ? 'बहुत कम (सावधान रहें)' : 'Very Low (Be Cautious)',
            2: isHindi ? 'कम (ध्यान दें)' : 'Low (Pay Attention)',
            3: isHindi ? 'मध्यम (संतुलित)' : 'Moderate (Balanced)',
            4: isHindi ? 'अच्छा (अनुकूल)' : 'Good (Favorable)',
            5: isHindi ? 'उत्कृष्ट (बहुत अनुकूल)' : 'Excellent (Very Favorable)'
        };

        const aspectLabels = {
            love: isHindi ? 'प्रेम और रिश्ते' : 'Love & Relationships',
            career: isHindi ? 'करियर और काम' : 'Career & Work',
            finance: isHindi ? 'धन और वित्त' : 'Finance & Money',
            health: isHindi ? 'स्वास्थ्य और ऊर्जा' : 'Health & Energy',
            family: isHindi ? 'परिवार और घर' : 'Family & Home',
            luck: isHindi ? 'भाग्य और अवसर' : 'Luck & Opportunities'
        };

        if (!window.MayaAI) {
            console.warn('MayaAI not available for aspect insight');
            return this.getUnavailableAspectInsight(aspect, aspectLabels[aspect], rating, ratingDescriptions[rating], firstName, isHindi);
        }

        const prompt = isHindi
            ? `आप MAYA हैं - एक wise MALE Vedic astrologer।

आज ${firstName} जी (${zodiacSign}) के लिए "${aspectLabels[aspect]}" का rating ${rating}/5 है (${ratingDescriptions[rating]})।

आज का राशिफल context:
"${horoscopeText}"

इस aspect के बारे में detailed insight दीजिए।

STRUCTURE:
1. WHY THIS RATING (2-3 sentences): आज यह rating क्यों है? Planetary positions और cosmic energy के basis पर explain करें।

2. WHAT TO EXPECT (2-3 sentences): आज इस area में specifically क्या experience हो सकता है? Specific situations mention करें।

3. ${rating <= 2 ? 'CAUTION & PROTECTION' : 'HOW TO MAXIMIZE'} (2-3 sentences): ${rating <= 2 ? 'कैसे सावधान रहें और negative energy से बचें?' : 'इस favorable energy को कैसे maximize करें?'}

4. TIMING (1 sentence): दिन का कौन सा समय इस aspect के लिए best/worst है?

RULES:
- Personal और specific रहें
- ${rating <= 2 ? 'Caring warning दें, fear-mongering नहीं' : 'Positive और encouraging रहें'}
- MALE forms use करें: हूँ, रहा हूँ, देख रहा हूँ
- भाषा simple spoken Hinglish रखिए; बहुत शुद्ध Hindi नहीं
- Hindi words mostly Devanagari में रखें, common English words English script में रखें
- 8-10 sentences total, TTS-safe, no emojis
- JSON format में respond करें:
{"explanation": "...", "advice": "...", "timing": "..."}`
            : `You are MAYA - a wise MALE Vedic astrologer.

Today ${firstName} (${zodiacSign}) has a ${rating}/5 rating for "${aspectLabels[aspect]}" (${ratingDescriptions[rating]}).

Today's horoscope context:
"${horoscopeText}"

Provide detailed insight about this aspect.

STRUCTURE:
1. WHY THIS RATING (2-3 sentences): Why is this the rating today? Explain based on planetary positions and cosmic energy.

2. WHAT TO EXPECT (2-3 sentences): What specific experiences might they have in this area today? Mention specific situations.

3. ${rating <= 2 ? 'CAUTION & PROTECTION' : 'HOW TO MAXIMIZE'} (2-3 sentences): ${rating <= 2 ? 'How should they be careful and protect against negative energy?' : 'How can they maximize this favorable energy?'}

4. TIMING (1 sentence): What time of day is best/worst for this aspect?

RULES:
- Be personal and specific
- ${rating <= 2 ? 'Give caring warnings, not fear-mongering' : 'Be positive and encouraging'}
- 8-10 sentences total, TTS-safe, no emojis
- Respond in JSON format:
{"explanation": "...", "advice": "...", "timing": "..."}`;

        try {
            const response = await MayaAI.sendMessage(prompt);
            
            // Parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const result = {
                    aspect: aspect,
                    aspectLabel: aspectLabels[aspect],
                    rating: rating,
                    ratingLabel: ratingDescriptions[rating],
                    explanation: parsed.explanation || '',
                    advice: parsed.advice || '',
                    timing: parsed.timing || '',
                    source: 'ai'
                };
                
                // Cache the result
                this.setCached(cacheKey, result);
                console.log(`✅ Aspect insight: AI generation succeeded for ${aspect}!`);
                return result;
            }
        } catch (error) {
            console.warn('AI aspect insight generation failed:', error.message);
        }

        return this.getUnavailableAspectInsight(aspect, aspectLabels[aspect], rating, ratingDescriptions[rating], firstName, isHindi);
    },

    /**
     * Get static aspect insight when AI fails
     */
    getStaticAspectInsight(aspect, rating, zodiacSign, firstName, isHindi) {
        const aspectLabels = {
            love: isHindi ? 'प्रेम और रिश्ते' : 'Love & Relationships',
            career: isHindi ? 'करियर और काम' : 'Career & Work',
            finance: isHindi ? 'धन और वित्त' : 'Finance & Money',
            health: isHindi ? 'स्वास्थ्य और ऊर्जा' : 'Health & Energy',
            family: isHindi ? 'परिवार और घर' : 'Family & Home',
            luck: isHindi ? 'भाग्य और अवसर' : 'Luck & Opportunities'
        };
        const ratingDescriptions = {
            1: isHindi ? 'बहुत कम (सावधान रहें)' : 'Very Low (Be Cautious)',
            2: isHindi ? 'कम (ध्यान दें)' : 'Low (Pay Attention)',
            3: isHindi ? 'मध्यम (संतुलित)' : 'Moderate (Balanced)',
            4: isHindi ? 'अच्छा (अनुकूल)' : 'Good (Favorable)',
            5: isHindi ? 'उत्कृष्ट (बहुत अनुकूल)' : 'Excellent (Very Favorable)'
        };

        return this.getUnavailableAspectInsight(
            aspect,
            aspectLabels[aspect],
            rating,
            ratingDescriptions[rating],
            firstName || (isHindi ? 'मित्र' : 'Friend'),
            isHindi
        );
    },

    getUnavailableHoroscope(sign, day, userData = {}) {
        const language = window.MayaUtils?.storage?.get('maya_language') || 'en';
        const isHindi = language === 'hi';
        const name = userData?.name || userData?.fullName || '';
        const firstName = name.split(' ')[0] || (isHindi ? 'मित्र' : 'Friend');
        const dayLabel = isHindi
            ? (day === 'tomorrow' ? 'कल' : day === 'yesterday' ? 'बीते दिन' : 'आज')
            : day;

        return {
            sign: sign,
            date: new Date().toISOString().split('T')[0],
            description: isHindi
                ? `${firstName}, ${dayLabel} के लिए live राशिफल अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर से पूछिए, फिर मैं fresh guidance दूंगा।`
                : `${firstName}, a live horoscope for ${dayLabel} is not available right now. Try again in a moment and I will give you a fresh reading.`,
            mood: '',
            luckyNumber: '',
            color: '',
            advice: isHindi ? 'थोड़ी देर बाद फिर से कोशिश करें।' : 'Retry in a moment.',
            personalized: false,
            source: 'unavailable'
        };
    },

    getUnavailableDosAndDonts() {
        const language = window.MayaUtils?.storage?.get('maya_language') || 'en';
        const isHindi = language === 'hi';

        return {
            dos: [
                isHindi ? 'थोड़ी देर बाद live guide फिर खोलें' : 'Open the live guide again shortly'
            ],
            donts: [
                isHindi ? 'इसे final guidance मत मानें' : 'Do not treat this as final guidance'
            ],
            source: 'unavailable'
        };
    },

    getUnavailableAspectInsight(aspect, aspectLabel, rating, ratingLabel, firstName, isHindi) {
        return {
            aspect: aspect,
            aspectLabel: aspectLabel,
            rating: rating,
            ratingLabel: ratingLabel,
            explanation: isHindi
                ? `${firstName}, इस पहलू की live insight अभी उपलब्ध नहीं है। Fresh reading के लिए थोड़ी देर बाद फिर से खोलिए।`
                : `${firstName}, a live insight for this aspect is not available right now. Open it again shortly for a fresh reading.`,
            advice: isHindi
                ? 'जब live insight लौटे, तभी इसे final guidance मानें।'
                : 'Treat it as final guidance only after the live insight returns.',
            timing: '',
            source: 'unavailable'
        };
    },

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Horoscope cache cleared');
    }
};

// Export
window.MayaHoroscopeAPI = MayaHoroscopeAPI;

console.log('🔮 MayaHoroscopeAPI loaded (Vedic personalized horoscopes)');
