/**
 * MAYA - Dynamic AI Content Generator
 * Generates personalized, conversion-focused content using AI
 * Designed for streaming/packet delivery with aggressive FOMO/fear psychology
 * 
 * Replaces static statements with AI-generated persuasive content
 */

const MayaDynamicContent = {
    cache: new Map(),
    pendingGenerations: new Map(),
    streamCallbacks: new Map(),
    
    // Current language
    language: 'en',

    /**
     * Set language for content generation
     */
    setLanguage(lang) {
        this.language = lang === 'hi' ? 'hi' : 'en';
        console.log(`🌐 DynamicContent language: ${this.language}`);
    },

    /**
     * Resolve the current guide gender ('female' default, or 'male' if user
     * selected the male guide during onboarding).
     */
    _getAgentGender() {
        try {
            const profile = window.MayaUtils?.storage?.get('maya_profile') || {};
            const funnelData = window.MayaUtils?.storage?.get('funnel_data') || {};
            const g = profile.agentGender || funnelData.agentGender
                || window.MayaFunnel?.userData?.agentGender
                || window.MayaVoice?.agentGender
                || 'female';
            return g === 'male' ? 'male' : 'female';
        } catch (_e) {
            return 'female';
        }
    },

    /**
     * Normalize persona instructions so the guide speaks with the correct gender.
     * Female = default MAYA. Male = rewritten to a masculine guide voice.
     */
    _normalizePersonaPrompt(prompt, lang = this.language) {
        if (!prompt) return '';
        const agentGender = this._getAgentGender();
        const isMale = agentGender === 'male';
        const guideName = isMale ? 'Moksh' : 'MAYA';

        // ─── Dynamic name + gender replacement (before any other normalization) ───
        let basePrompt = String(prompt)
            .replace(/\bMAYA\b/g, guideName)
            .replace(/\ba MALE\b/g, `a ${isMale ? 'male' : 'female'}`)
            .replace(/\ba FEMALE\b/g, `a ${isMale ? 'male' : 'female'}`)
            .replace(/\bMALE Vedic\b/g, `${isMale ? 'male' : 'female'} Vedic`)
            .replace(/\bFEMALE Vedic\b/g, `${isMale ? 'male' : 'female'} Vedic`)
            .replace(/\bMALE numerology\b/g, `${isMale ? 'male' : 'female'} numerology`)
            .replace(/\bFEMALE numerology\b/g, `${isMale ? 'male' : 'female'} numerology`)
            .replace(/\bMALE mystical\b/g, `${isMale ? 'male' : 'female'} mystical`)
            .replace(/\bFEMALE mystical\b/g, `${isMale ? 'male' : 'female'} mystical`)
            .replace(/\bMALE verb forms\b/g, `${isMale ? 'male' : 'female'} verb forms`)
            .replace(/\bFEMALE verb forms\b/g, `${isMale ? 'male' : 'female'} verb forms`)
            .replace(/elder brother figure/gi, isMale ? 'elder brother figure' : 'elder sister guide')
            .replace(/elder brother/gi, isMale ? 'elder brother' : 'elder sister')
            .replace(/elder sister/gi, isMale ? 'elder brother' : 'elder sister')
            .replace(/बड़े भाई/g, isMale ? 'बड़े भाई' : 'बड़ी बहन')
            .replace(/बड़ी बहन/g, isMale ? 'बड़े भाई' : 'बड़ी बहन');

        if (isMale) {
            const personaGuardMale = lang === 'hi'
                ? `\nPERSONA OVERRIDE: ${guideName} एक पुरुष guide है। अपने लिए हमेशा पुल्लिंग first-person forms use करें: हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ, बताता हूँ, कह रहा हूँ। कभी भी feminine forms जैसे रही हूँ, सकती हूँ, बताती हूँ use न करें। Tone simple spoken Hinglish रखें, बहुत भारी या literary Hindi नहीं।`
                : `\nPERSONA OVERRIDE: ${guideName} is strictly male. Speak as an expressive, conversational male guide with grounded authority. Never describe ${guideName} as female, sister-like, or feminine.`;
            return `${basePrompt}${personaGuardMale}`;
        }

        let normalized = basePrompt
            .replace(/देवनागरी Hinglish/gi, 'simple spoken Hinglish: Hindi words mostly in Devanagari, common English terms in English script')
            .replace(/Hinglish देवनागरी/gi, 'simple spoken Hinglish: Hindi words mostly in Devanagari, common English terms in English script')
            .replace(/simple Hinglish देवनागरी में/gi, 'simple spoken Hinglish: Hindi words mostly in Devanagari, common English terms in English script')
            .replace(/Natural Hinglish style/gi, 'simple spoken Hinglish with light everyday Indian flavour')
            .replace(/Natural Hinglish/gi, 'simple spoken Hinglish')
            .replace(/simple Hinglish/gi, 'simple spoken Hinglish')
            .replace(/हिंदी पूरी तरह देवनागरी में लिखिए/gi, 'Hindi words को mostly Devanagari में रखें, common English terms को English script में रखें, और tone simple spoken Hinglish रखें')
            .replace(/रोमन हिंदी या अंग्रेज़ी वर्तनी न लिखें/gi, 'Hindi words को mostly Devanagari में रखें, common English terms को English script में रखें, लेकिन बहुत शुद्ध Hindi मत लिखें')
            .replace(/MALE verb forms in Hindi \(हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ, बताता हूँ\)/g, 'FEMALE verb forms in Hindi (हूँ, रही हूँ, सकती हूँ, देख रही हूँ, बताती हूँ)')
            .replace(/MALE verb forms in Hindi \(हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ\)/g, 'FEMALE verb forms in Hindi (हूँ, रही हूँ, सकती हूँ, देख रही हूँ)');

        const personaGuard = lang === 'hi'
            ? `\nPERSONA OVERRIDE: ${guideName} एक महिला guide है। अपने लिए हमेशा स्त्रीलिंग first-person forms use करें: हूँ, रही हूँ, सकती हूँ, देख रही हूँ, बताती हूँ, कह रही हूँ। कभी भी masculine forms जैसे रहा हूँ, सकता हूँ, बताता हूँ use न करें। Tone simple spoken Hinglish रखें, बहुत भारी या literary Hindi नहीं। हल्का everyday dialect flavour ठीक है, लेकिन आसानी बनी रहे।`
            : `\nPERSONA OVERRIDE: ${guideName} is strictly female. Speak as an expressive, conversational female guide with grounded authority. Never describe ${guideName} as male, brother-like, or masculine.`;

        return `${normalized}${personaGuard}`;
    },

    _normalizeGeneratedText(text) {
        if (!text) return '';
        const agentGender = this._getAgentGender();
        const isMale = agentGender === 'male';
        const guideName = isMale ? 'Moksh' : 'MAYA';

        if (isMale) {
            // Male guide: convert any feminine self-references to masculine.
            return String(text)
                .replace(/\bMAYA\b/g, guideName)  // Dynamic guide name
                .replace(/```(?:json|text)?/gi, '')
                .replace(/`+/g, '')
                .replace(/^\s*(?:json|script|response)\s*[:\-]?\s*/i, '')
                .replace(/([A-Za-z\u0900-\u097F]+)\s*जी(?=[\s,.!?।]|$)/g, '$1')
                .replace(/elder sister/gi, 'elder brother')
                .replace(/sister-like/gi, 'brother-like')
                .replace(/sister energy/gi, 'brother energy')
                .replace(/female guide/gi, 'male guide')
                .replace(/female numerology guide/gi, 'male numerology guide')
                .replace(/wise female/gi, 'wise male')
                .replace(/\bI am female\b/gi, 'I am male')
                .replace(/\bI am a woman\b/gi, 'I am a man')
                .replace(/बड़ी बहन/g, 'बड़े भाई')
                .replace(/बहन जैसा/g, 'भाई जैसा')
                .replace(/मैं([^.!?\n]{0,80}?)रही हूँ/g, 'मैं$1रहा हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)सकती हूँ/g, 'मैं$1सकता हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)बताती हूँ/g, 'मैं$1बताता हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)कहती हूँ/g, 'मैं$1कहता हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)वाली हूँ/g, 'मैं$1वाला हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)गई हूँ/g, 'मैं$1गया हूँ')
                .replace(/मैं([^.!?\n]{0,80}?)आई हूँ/g, 'मैं$1आया हूँ')
                .replace(/\bबताऊँगी\b/g, 'बताऊँगा')
                .replace(/\bकहूँगी\b/g, 'कहूँगा')
                .replace(/\bकरूँगी\b/g, 'करूँगा')
                .replace(/\bjson\b/gi, '');
        }

        return String(text)
            .replace(/```(?:json|text)?/gi, '')
            .replace(/`+/g, '')
            .replace(/^\s*(?:json|script|response)\s*[:\-]?\s*/i, '')
            .replace(/([A-Za-z\u0900-\u097F]+)\s*जी(?=[\s,.!?।]|$)/g, '$1')
            .replace(/elder brother/gi, 'elder sister')
            .replace(/brother-like/gi, 'sister-like')
            .replace(/brother energy/gi, 'sister energy')
            .replace(/male guide/gi, 'female guide')
            .replace(/male numerology guide/gi, 'female numerology guide')
            .replace(/wise male/gi, 'wise female')
            .replace(/\bI am male\b/gi, 'I am female')
            .replace(/\bI am a man\b/gi, 'I am a woman')
            .replace(/बड़े भाई/g, 'बड़ी बहन')
            .replace(/भाई जैसा/g, 'बहन जैसा')
            .replace(/मैं([^.!?\n]{0,80}?)रहा हूँ/g, 'मैं$1रही हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)सकता हूँ/g, 'मैं$1सकती हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)बताता हूँ/g, 'मैं$1बताती हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)कहता हूँ/g, 'मैं$1कहती हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)वाला हूँ/g, 'मैं$1वाली हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)गया हूँ/g, 'मैं$1गई हूँ')
            .replace(/मैं([^.!?\n]{0,80}?)आया हूँ/g, 'मैं$1आई हूँ')
            .replace(/\bबताऊँगा\b/g, 'बताऊँगी')
            .replace(/\bकहूँगा\b/g, 'कहूँगी')
            .replace(/\bकरूँगा\b/g, 'करूँगी')
            .replace(/\bjson\b/gi, '');
    },

    _localizeHindiTerms(text) {
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

    /**
     * Master prompts for each content type with HEAVY conversion psychology
     * These are designed to create urgency, FOMO, fear, and immediate action
     */
    contentPrompts: {
        // ==================== LIFE PATH NUMBER MEANINGS ====================
        lifePathMeaning: {
            1: {
                theme: "The Leader - Independence, Ambition, Pioneering",
                shadows: "isolation, stubbornness, fear of dependence, ego battles",
                triggers: "feeling controlled, being ignored, not being first",
                hooks: "missed leadership opportunities, others taking credit, stuck following"
            },
            2: {
                theme: "The Diplomat - Partnership, Sensitivity, Harmony",
                shadows: "codependency, indecision, being walked over, conflict avoidance",
                triggers: "feeling alone, being dismissed, harsh criticism",
                hooks: "relationships failing, being used, never standing up for yourself"
            },
            3: {
                theme: "The Communicator - Creativity, Expression, Joy",
                shadows: "scattered energy, superficiality, emotional suppression, criticism fear",
                triggers: "being ignored, creative blocks, feeling ordinary",
                hooks: "talents wasted, voice unheard, joy stolen by routine"
            },
            4: {
                theme: "The Builder - Stability, Hard Work, Foundation",
                shadows: "rigidity, workaholism, fear of change, control issues",
                triggers: "chaos, instability, disrespect for effort",
                hooks: "hard work unrewarded, foundations crumbling, being stuck"
            },
            5: {
                theme: "The Freedom Seeker - Adventure, Change, Versatility",
                shadows: "restlessness, commitment fear, addiction tendencies, chaos creation",
                triggers: "routine, restriction, boredom, being trapped",
                hooks: "life passing by, adventures missed, golden cage syndrome"
            },
            6: {
                theme: "The Nurturer - Responsibility, Love, Service",
                shadows: "martyrdom, perfectionism, controlling love, self-sacrifice",
                triggers: "feeling unappreciated, family chaos, being taken for granted",
                hooks: "giving without receiving, burnout, loved ones struggling"
            },
            7: {
                theme: "The Seeker - Wisdom, Spirituality, Analysis",
                shadows: "isolation, distrust, overthinking, emotional detachment",
                triggers: "superficiality, being misunderstood, no alone time",
                hooks: "truth never found, wisdom unshared, spiritual emptiness"
            },
            8: {
                theme: "The Powerhouse - Success, Abundance, Authority",
                shadows: "materialism, power abuse, workaholic, fear of failure",
                triggers: "financial loss, being powerless, disrespect",
                hooks: "wealth slipping away, power never achieved, legacy unfulfilled"
            },
            9: {
                theme: "The Humanitarian - Compassion, Completion, Universal Love",
                shadows: "resentment, superiority, difficulty letting go, savior complex",
                triggers: "injustice, selfishness in others, endings",
                hooks: "purpose unfulfilled, world suffering, legacy of regret"
            },
            11: {
                theme: "The Master Intuitive - Illumination, Spiritual Insight, Inspiration",
                shadows: "anxiety, nervous energy, impractical dreams, sensitivity overload",
                triggers: "being doubted, spiritual disconnect, overwhelming situations",
                hooks: "gifts wasted, never reaching potential, living below your frequency"
            },
            22: {
                theme: "The Master Builder - Vision to Reality, Large-Scale Achievement",
                shadows: "overwhelm, impractical ambitions, pressure paralysis, self-doubt",
                triggers: "small thinking around you, lack of support, slow progress",
                hooks: "empire never built, vision dying, settling for mediocrity"
            },
            33: {
                theme: "The Master Teacher - Healing, Uplifting Humanity, Divine Love",
                shadows: "martyrdom, unrealistic expectations, emotional exhaustion",
                triggers: "suffering without meaning, being unable to help, ingratitude",
                hooks: "healing gifts unused, people you could've saved, love unexpressed"
            }
        },

        // ==================== DESTINY NUMBER MEANINGS ====================
        destinyMeaning: {
            1: { path: "leadership and innovation", warning: "If you don't step into leadership, others will always decide your fate" },
            2: { path: "partnership and diplomacy", warning: "Avoid partnership roles and you'll feel incomplete forever" },
            3: { path: "creative expression and communication", warning: "Suppress your voice and it will eat you from inside" },
            4: { path: "building lasting foundations", warning: "Without foundation, everything you build will collapse" },
            5: { path: "freedom and transformative change", warning: "Stay caged and your spirit will slowly die" },
            6: { path: "nurturing and responsibility", warning: "Ignore family duties and regret will be your companion" },
            7: { path: "spiritual wisdom and inner truth", warning: "Run from inner work and emptiness follows" },
            8: { path: "material mastery and power", warning: "Fear power and poverty mindset owns you forever" },
            9: { path: "humanitarian service and completion", warning: "Live selfishly and miss your entire purpose" },
            11: { path: "spiritual illumination and inspiration", warning: "Ignore your intuition and watch life fall apart" },
            22: { path: "master building on a grand scale", warning: "Think small and waste the rarest gift humans receive" },
            33: { path: "master teaching and healing", warning: "Hold back your love and the world loses a healer" }
        },

        // ==================== SOUL URGE NUMBER MEANINGS ====================
        soulUrgeMeaning: {
            1: { desire: "independence and recognition", void: "feel invisible and controlled", suppression: "That suppressed need for recognition? It's why you feel empty even when you achieve." },
            2: { desire: "love and deep connection", void: "lonely even in crowds", suppression: "Pretending you don't need anyone is slowly killing your soul." },
            3: { desire: "expression and being seen", void: "creatively suffocated", suppression: "Every unexpressed idea is a piece of you dying." },
            4: { desire: "security and order", void: "anxious and ungrounded", suppression: "That need for stability you ignore? It's why nothing feels solid." },
            5: { desire: "freedom and adventure", void: "trapped and restless", suppression: "Every adventure you postpone makes the cage smaller." },
            6: { desire: "love and being needed", void: "unappreciated and used", suppression: "Giving without receiving is not love, it's self-destruction." },
            7: { desire: "understanding and truth", void: "spiritually homeless", suppression: "Running from inner work creates outer chaos." },
            8: { desire: "power and abundance", void: "financially anxious forever", suppression: "Denying your ambition doesn't make it noble, it makes you bitter." },
            9: { desire: "meaning and impact", void: "purposeless existence", suppression: "That ache for meaning? It won't go away with distractions." }
        }
    },

    /**
     * Build aggressive conversion prompt for number meanings
     */
    buildNumberMeaningPrompt(type, number, userData, language) {
        const name = userData.name || 'Friend';
        const isHindi = language === 'hi';
        
        let contentData;
        let promptBase;

        if (type === 'lifePath') {
            contentData = this.contentPrompts.lifePathMeaning[number] || this.contentPrompts.lifePathMeaning[1];
            promptBase = `Generate a LIFE PATH ${number} reading for ${name}.
            
THEME: ${contentData.theme}
SHADOW ASPECTS: ${contentData.shadows}
EMOTIONAL TRIGGERS: ${contentData.triggers}
FEAR HOOKS: ${contentData.hooks}`;
        } else if (type === 'destiny') {
            contentData = this.contentPrompts.destinyMeaning[number] || this.contentPrompts.destinyMeaning[1];
            promptBase = `Generate a DESTINY NUMBER ${number} reading for ${name}.
            
LIFE PATH: ${contentData.path}
WARNING: ${contentData.warning}`;
        } else if (type === 'soulUrge') {
            contentData = this.contentPrompts.soulUrgeMeaning[number] || this.contentPrompts.soulUrgeMeaning[1];
            promptBase = `Generate a SOUL URGE ${number} reading for ${name}.
            
CORE DESIRE: ${contentData.desire}
VOID WHEN UNFULFILLED: ${contentData.void}
SUPPRESSION CONSEQUENCE: ${contentData.suppression}`;
        }

        const langInstruction = isHindi 
            ? `Respond in simple spoken Hinglish: keep Hindi words mostly in Devanagari, keep common English terms like Life Path, Destiny, Soul Urge, Personal Year, email, password, chart, timing, career, relationship, money, and energy in English script, avoid overly formal or Sanskrit-heavy Hindi, and keep the tone easy and understandable across regions. Prefer direct address as "आप", but you may naturally use the user's first name exactly as provided when it improves the spoken flow.`
            : `Respond in natural conversational English. Sound like a wise, slightly intense spiritual mentor.`;

        return `You are MAYA, a FEMALE mystical numerologist who speaks with conviction and grounded warmth. You're revealing ${name}'s ${type} number ${number}.

${promptBase}

${langInstruction}

CRITICAL PSYCHOLOGICAL TACTICS:
1. START with validation - describe something they've FELT but couldn't name
2. CREATE recognition - "This is why..." moments that make them nod
3. INTRODUCE shadow - gently expose the darker pattern they try to hide  
4. PLANT fear seed - what happens if they don't understand this
5. HINT at more - make them feel this is just surface level

CONVERSION PSYCHOLOGY TO USE:
• Pattern interruption: Say something unexpected that makes them stop
• Specificity: Use the number itself, their name, specific traits
• Future pacing: Paint a picture of what happens if they ignore this
• Open loop: End with something that makes them NEED the next part
• Emotional resonance: Hit feelings, not just information

TONE REQUIREMENTS:
- Confident, not tentative
- Intimate, like you can see through them
- Slightly uncomfortable truths
- Urgent but not pushy
- Mystical authority
- Elder sister energy - warm but direct

IMPORTANT: Use FEMALE verb forms in Hindi (हूँ, रही हूँ, सकती हूँ, देख रही हूँ)

FORMAT:
- Be naturally conversational - complete your thoughts fully without cutting off
- No filler words at start
- No "Let me tell you" or "I can see"
- Start with impact
- End with hook to next revelation
- NO emojis, asterisks, or formatting

Generate ONLY the spoken script:`;
    },

    /**
     * Build prompt for calculation explanations
     */
    buildCalculationPrompt(type, calculationData, userData, language) {
        const name = userData.name || 'Friend';
        const isHindi = language === 'hi';

        const langInstruction = isHindi 
            ? `Respond in simple spoken Hinglish: keep Hindi words mostly in Devanagari, keep common English terms in English script, and avoid overly formal or heavy Hindi.`
            : `Respond in natural conversational English.`;

        const prompts = {
            lifePathExplanation: `You are MAYA, a MALE numerology guide, explaining how Life Path Number is calculated.

DATA: Birth date ${calculationData.date}, result is Life Path ${calculationData.number}

${langInstruction}

    The on-screen visuals already show the math, so do NOT narrate step-by-step reductions.
    Mention the result once naturally, then explain the RELEVANCE:
- Create weight: "This isn't just math, this is the frequency you vibrate at"
- Add mystery: Hint this number appears in their life constantly
- Plant hook: "And this is just the first layer..."

    Focus on the MEANING of why this calculation matters.
Start directly, no intro phrases.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`,

            destinyExplanation: `You are MAYA, a MALE numerology guide, explaining Destiny Number from ${name}'s name.

DATA: Name "${userData.name}", Destiny Number ${calculationData.number}

${langInstruction}

    The letter grid and total are already visible on screen, so do NOT narrate A=1, B=2, or any letter-by-letter mapping.
    Mention the result once naturally, then explain WHY it matters:
- Create intrigue: "Your name chose you, not the other way around"
- Add weight: This number is their life mission
- Contrast: Show gap between current life and destiny path

    Focus on impact.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`,

            soulUrgeExplanation: `You are MAYA, a MALE numerology guide, revealing ${name}'s Soul Urge Number.

DATA: Soul Urge ${calculationData.number} from vowels in "${userData.name}"

${langInstruction}

    The vowel highlights are already visible on screen, so do NOT narrate A, E, I, O, U values or the full vowel math.
    Mention the result once naturally, then explain WHY it matters:
- Go deep: "This is what you actually want, beneath the social mask"
- Create discomfort: Hint at desires they've suppressed
- End with: Something that makes them need the full interpretation

    Focus on emotional impact, not mechanics.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`
        };

        return prompts[type] || prompts.lifePathExplanation;
    },

    /**
     * Build prompt for teaser/hook content
     */
    buildTeaserPrompt(type, userData, results, language) {
        const name = userData.name || 'Friend';
        const isHindi = language === 'hi';

        const langInstruction = isHindi 
            ? `Respond in simple spoken Hinglish: keep Hindi words mostly in Devanagari, keep common English terms in English script, and avoid overly formal or heavy Hindi.`
            : `Respond in natural conversational English.`;

        const prompts = {
            introTeaser: `You are MAYA, a MALE numerology guide, opening the numerology reading for ${name}.

Birth Date: ${userData.dob}
${results ? `Quick peek - Life Path will be ${results.lifePath}` : ''}

${langInstruction}

Create an opening that:
1. Makes their birth date feel SIGNIFICANT (not random)
2. Hints you can see patterns they've lived but couldn't explain
3. Creates urgency to hear more
4. Sounds mystical but grounded

FORBIDDEN: "Welcome", "Let me", "I'm going to", "Today we'll"
START with impact. Make them lean in. Complete your thoughts fully.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`,

            numberRevealTeaser: `You are MAYA, a MALE numerology guide, about to reveal ${name}'s core numbers.

${langInstruction}

Create a transition that:
1. Builds anticipation for what's coming
2. Hints these numbers explain their recurring patterns
3. Makes them slightly nervous (in a good way) about what they'll discover

END on an open loop. Complete your thoughts fully.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`,

            conversionTeaser: `You are MAYA, a MALE numerology guide, having revealed the basics to ${name}.

Their numbers: Life Path ${results?.lifePath || '?'}, Destiny ${results?.destiny || '?'}, Soul Urge ${results?.soulUrge || '?'}

${langInstruction}

Create a CONVERSION push that:
1. Summarizes what they've learned (validates time spent)
2. REVEALS there's much more (compatibility, timing, warnings)
3. Creates FOMO about what they're missing
4. Makes the premium/full reading feel ESSENTIAL not optional

TACTICS:
- "What I haven't told you yet..."
- "The timing aspect alone..."
- "There are specific dates coming up..."
- "Your compatibility patterns show..."

Make them feel incomplete without the full reading. Complete your thoughts fully.
IMPORTANT: Use MALE verb forms in Hindi (हूँ, रहा हूँ, सकता हूँ, देख रहा हूँ)`
        };

        return prompts[type] || prompts.introTeaser;
    },

    /**
     * Build prompt for warnings and fear content
     */
    buildWarningPrompt(type, userData, results, language) {
        const name = userData.name || 'Friend';
        const isHindi = language === 'hi';

        const langInstruction = isHindi 
            ? `Respond in simple spoken Hinglish: keep Hindi words mostly in Devanagari, keep common English terms in English script, use "आप", and avoid very formal or literary Hindi.`
            : `Respond in natural conversational English.`;

        return `You are MAYA, a MALE numerology guide, delivering a GENTLE WARNING to ${name} about their numerology.

Their Numbers: Life Path ${results?.lifePath}, Destiny ${results?.destiny}, Soul Urge ${results?.soulUrge}

${langInstruction}

Create a warning that:
1. Identifies a PATTERN in their numbers that needs attention
2. Describes what happens if ignored (consequences)
3. Creates urgency without being alarmist
4. Hints that full analysis would reveal timing and solutions

PSYCHOLOGICAL TACTICS:
- Loss aversion: What they'll LOSE by not knowing
- Specificity: Reference their actual numbers
- Time pressure: "This particular combination..."
- Social proof fear: "Most people with your numbers..."

BE SERIOUS but not scary. Concerned mentor, not doom prophet.
The goal is to make them NEED the complete picture. Complete your thoughts fully.`;
    },

    /**
     * Generate content using AI with streaming support
     * Speaks fillers while waiting for AI response
     */
    async generate(type, data, options = {}) {
        const {
            userData = {},
            results = {},
            number = null,
            language = this.language,
            stream = false,
            onChunk = null,
            speakFillers = true,  // Whether to speak fillers while generating
            prompt: customPrompt = null,  // Allow custom prompt from statements.js
            aiOnly = false,
            disableFallback = false,
            maxGenerationRetries = 2
        } = options;

        const forceAiOnly = aiOnly || Boolean(customPrompt) || String(type || '').startsWith('statements_');
        const allowFallback = !(disableFallback || forceAiOnly);

        // Cache disabled - all data stored in DB
        // Always generate fresh content

        // Build appropriate prompt
        let prompt;
        
        // If custom prompt provided (from statements.js), use it directly
        if (customPrompt) {
            prompt = customPrompt;
            console.log(`🎭 Using custom prompt for: ${type}`);
        } else {
            switch(type) {
                case 'lifePathMeaning':
                case 'destinyMeaning':
                case 'soulUrgeMeaning':
                    const numType = type.replace('Meaning', '');
                    prompt = this.buildNumberMeaningPrompt(numType, number || data.number, userData, language);
                    break;
                
                case 'lifePathExplanation':
                case 'destinyExplanation':
                case 'soulUrgeExplanation':
                    prompt = this.buildCalculationPrompt(type, data, userData, language);
                    break;

                case 'introTeaser':
                case 'numberRevealTeaser':
                case 'conversionTeaser':
                    prompt = this.buildTeaserPrompt(type, userData, results, language);
                    break;

                case 'warning':
                    prompt = this.buildWarningPrompt(type, userData, results, language);
                    break;

                default:
                    console.warn(`Unknown content type: ${type}`);
                    return allowFallback ? this.getFallback(type, { userData, results, number, language }) : '';
            }
        }

        prompt = this._normalizePersonaPrompt(prompt, language);

        console.log(`🎭 Generating: ${type}`);

        try {
            const fetchContent = async () => {
                let content;

                if (speakFillers && window.MayaVoice?.withFillers && !stream) {
                    content = await MayaVoice.withFillers(
                        () => this.callAI(prompt, language, {
                            stream,
                            onChunk,
                            aiOnly: forceAiOnly,
                            contentType: type
                        }),
                        {
                            startDelay: 1500,
                            interval: 3500,
                            maxFillers: 2
                        }
                    );
                } else {
                    content = await this.callAI(prompt, language, {
                        stream,
                        onChunk,
                        aiOnly: forceAiOnly,
                        contentType: type
                    });
                }

                const normalized = this._normalizeGeneratedText(content);
                if (!normalized || normalized.trim().length < 20) {
                    throw new Error(`Empty AI response for ${type}`);
                }

                return normalized;
            };

            const content = await MayaUtils.retry(fetchContent, {
                maxRetries: Math.max(1, maxGenerationRetries),
                baseDelay: 200,
                maxDelay: 1500,
                backoffMultiplier: 1.5,
                label: `${type} generation`,
                retryCondition: (error, attempt) => {
                    const message = error?.message || '';
                    return attempt < Math.max(1, maxGenerationRetries)
                        && (MayaUtils.isRetryableError(error) || /empty|all content sources failed|rate limit|timed out|timeout/i.test(message));
                }
            });
            
            // Cache disabled - not storing locally
            
            return content;
        } catch (error) {
            console.error(`❌ Generation failed: ${error.message}`);
            return allowFallback ? this.getFallback(type, { userData, results, number, language }) : '';
        }
    },

    /**
     * Generate multiple pieces in parallel (for background pre-generation)
     * Note: Fillers disabled for batch since it runs in background
     */
    async generateBatch(requests, language = this.language) {
        console.log(`🔮 Batch generating ${requests.length} content pieces...`);
        
        const promises = requests.map(req => 
            this.generate(req.type, req.data, { 
                ...req.options, 
                language,
                stream: false,
                speakFillers: false  // Don't speak fillers for background generation
            })
        );

        const results = await Promise.allSettled(promises);
        
        return results.map((result, i) => ({
            type: requests[i].type,
            content: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },

    /**
     * Pre-generate all content for a user (call after getting their data)
     */
    async pregenerateForUser(userData, calculations, language = this.language) {
        const requests = [
            { type: 'introTeaser', data: {}, options: { userData, results: calculations } },
            { type: 'lifePathMeaning', data: { number: calculations.lifePath }, options: { userData, number: calculations.lifePath } },
            { type: 'destinyMeaning', data: { number: calculations.destiny }, options: { userData, number: calculations.destiny } },
            { type: 'soulUrgeMeaning', data: { number: calculations.soulUrge }, options: { userData, number: calculations.soulUrge } },
            { type: 'conversionTeaser', data: {}, options: { userData, results: calculations } },
            { type: 'warning', data: {}, options: { userData, results: calculations } }
        ];

        // Fire off all generations in parallel
        this.generateBatch(requests, language).then(results => {
            console.log('✅ Background content generation complete');
            
            // Also pre-generate audio for each
            if (window.MayaVoice?.pregenerateAudio) {
                results.forEach(r => {
                    if (r.content) {
                        MayaVoice.pregenerateAudio(r.content);
                    }
                });
            }
        });

        console.log('🚀 Background generation started');
    },

    /**
     * Call AI API with retry and graceful fallbacks
     * Prioritizes free horoscope APIs before falling back to AI
     */
    async callAI(prompt, language, options = {}) {
        const {
            aiOnly = false,
            contentType = ''
        } = options;

        const allowHoroscope = !aiOnly && contentType === 'dailyHoroscope';
        const zodiacSign = allowHoroscope ? this.extractZodiacFromContext() : null;
        
        // Build array of content sources to try with retry
        const contentSources = [];
        
        // Source 1: Free horoscope API (if zodiac available)
        if (allowHoroscope && zodiacSign && window.MayaHoroscopeAPI) {
            contentSources.push(async () => {
                console.log('🔮 Trying free horoscope API first...');
                const horoscope = await MayaHoroscopeAPI.getDailyHoroscope(zodiacSign);
                if (horoscope && horoscope.description) {
                    console.log('✅ Free horoscope API succeeded');
                    return this.enhanceHoroscopeContent(horoscope.description, language);
                }
                throw new Error('Empty horoscope response');
            });
        }

        // Source 2: Gemini AI (primary)
        if (window.MayaAI?.callGemini) {
            contentSources.push(async () => {
                console.log('🤖 Trying Gemini...');
                const response = await MayaAI.callGemini(prompt);
                if (!response || !String(response).trim()) {
                    throw new Error('Empty Gemini response');
                }
                console.log('✅ Gemini succeeded');
                return this.cleanContent(response);
            });
        }

        // Try each source with retries
        if (contentSources.length > 0) {
            try {
                return await MayaUtils.retryWithFallbacks(contentSources, {
                    retriesPerFunction: 2,
                    baseDelay: 1000,
                    label: 'Content generation'
                });
            } catch (error) {
                console.warn('All content sources failed:', error.message);
            }
        }

        // If all sources fail, throw error to trigger static fallback
        throw new Error('All content sources failed');
    },

    /**
     * Extract zodiac sign from current user context
     */
    extractZodiacFromContext() {
        // Try to get from MayaAI context
        if (window.MayaAI?.userContext?.zodiac?.name) {
            return window.MayaAI.userContext.zodiac.name;
        }
        
        // Try to get from global user data
        if (window.currentUserData?.zodiac) {
            return window.currentUserData.zodiac;
        }
        
        // Try to get from stored user data
        const storedUser = MayaUtils?.storage?.get('maya_user');
        if (storedUser?.birthDate) {
            const zodiac = window.MayaAstrology?.getZodiac(storedUser.birthDate, storedUser);
            return zodiac?.name;
        }
        
        return null;
    },

    /**
     * Enhance horoscope content with personalization
     */
    enhanceHoroscopeContent(content, language) {
        // Add some mystical flair to the API content
        const prefixes = {
            en: [
                "The stars reveal that ",
                "Today's cosmic alignment shows ",
                "Your celestial guide sees that ",
                "The universe whispers that "
            ],
            hi: [
                "तारे बताते हैं कि ",
                "आज का cosmic alignment दिखाता है कि ",
                "आपका celestial guide देखता है कि ",
                "ब्रह्मांड कहता है कि "
            ]
        };
        
        const langPrefixes = prefixes[language] || prefixes.en;
        const prefix = langPrefixes[Math.floor(Math.random() * langPrefixes.length)];
        
        return prefix + content.charAt(0).toLowerCase() + content.slice(1);
    },

    /**
     * Clean AI response
     */
    cleanContent(text) {
        if (!text) return '';

        let cleaned = this._normalizeGeneratedText(text)
            .replace(/^(Here'?s?|Let me|I can see|I sense|Looking at|Based on|Okay|So|Well|Now|Alright).*?[,:]\s*/gi, '')
            .replace(/^["']|["']$/g, '')
            .replace(/\*+/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (/[\u0900-\u097f]/.test(cleaned)) {
            cleaned = this._localizeHindiTerms(cleaned)
                .replace(/।\s*।+/g, '।')
                .replace(/\?\s*\?+/g, '?')
                .replace(/!\s*!+/g, '!')
                .replace(/\s+/g, ' ')
                .trim();
        }

        return cleaned;
    },

    /**
     * Fallback content if AI fails
     */
    getFallback(type, { userData = {}, results = {}, number, language = 'en' }) {
        console.warn(`DynamicContent fallback disabled for ${type}; returning empty text.`);
        return '';
    },

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ DynamicContent cache cleared');
    }
};

// Export
window.MayaDynamicContent = MayaDynamicContent;

console.log('🎭 MayaDynamicContent loaded');
