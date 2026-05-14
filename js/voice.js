/**
 * MAYA - Voice Module
 * ElevenLabs Text-to-Speech Integration
 */

const MayaVoice = {
    audioContext: null,
    currentAudio: null,
    isPlaying: false,
    isMuted: false,
    audioQueue: [],
    analyser: null,
    dataArray: null,
    speakingLock: false,  // Prevent overlapping speech
    isInitialized: false, // Track if TTS is pre-warmed
    aborted: false,       // Flag to abort current speech
    elevenLabsUnavailableUntil: 0,
    elevenLabsUnavailableReason: '',

    /**
     * Initialize voice module - load saved mute preference and pre-warm TTS
     */
    init() {
        const savedMute = window.MayaUtils?.storage?.get('maya_voice_muted');
        if (savedMute !== null) {
            this.isMuted = savedMute;
        }

        // Pre-initialize audio context
        this.initAudioContext();
    },

    isElevenLabsUnavailable() {
        return Date.now() < this.elevenLabsUnavailableUntil;
    },

    markElevenLabsUnavailable(reason, cooldownMs = 120000) {
        this.elevenLabsUnavailableReason = reason || 'ElevenLabs is temporarily unavailable';
        this.elevenLabsUnavailableUntil = Date.now() + cooldownMs;
        try { this._prefetchCache?.clear?.(); } catch (_error) { }
    },

    shouldFallbackForTtsError(error) {
        const status = Number(error?.status || 0);
        return Boolean(error?.ttsFallback)
            || this.isElevenLabsUnavailable()
            || [401, 403, 404, 429, 500, 502, 503].includes(status);
    },

    buildTtsUnavailableError() {
        const error = new Error(this.elevenLabsUnavailableReason || 'ElevenLabs is temporarily unavailable');
        error.ttsFallback = true;
        return error;
    },

    /**
     * Mark voice as ready without sending synthetic provider requests.
     */
    async preWarmTTS() {
        if (this.isInitialized || this.isMuted || this.isElevenLabsUnavailable()) return;

        this.isInitialized = true;
    },

    // Number to words mapping for better TTS pronunciation
    numberWords: {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
        '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
        '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
        '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '21': 'twenty-one',
        '22': 'twenty-two', '23': 'twenty-three', '24': 'twenty-four',
        '25': 'twenty-five', '26': 'twenty-six', '27': 'twenty-seven',
        '28': 'twenty-eight', '29': 'twenty-nine', '30': 'thirty', '31': 'thirty-one',
        '32': 'thirty-two', '33': 'thirty-three', '34': 'thirty-four', '35': 'thirty-five',
        '36': 'thirty-six', '37': 'thirty-seven', '38': 'thirty-eight', '39': 'thirty-nine',
        '40': 'forty', '41': 'forty-one', '42': 'forty-two', '43': 'forty-three',
        '44': 'forty-four', '45': 'forty-five', '46': 'forty-six', '47': 'forty-seven',
        '48': 'forty-eight', '49': 'forty-nine', '50': 'fifty', '51': 'fifty-one',
        '52': 'fifty-two', '53': 'fifty-three', '54': 'fifty-four', '55': 'fifty-five',
        '56': 'fifty-six', '57': 'fifty-seven', '58': 'fifty-eight', '59': 'fifty-nine',
        '60': 'sixty', '61': 'sixty-one', '62': 'sixty-two', '63': 'sixty-three',
        '64': 'sixty-four', '65': 'sixty-five', '66': 'sixty-six', '67': 'sixty-seven',
        '68': 'sixty-eight', '69': 'sixty-nine', '70': 'seventy', '71': 'seventy-one',
        '72': 'seventy-two', '73': 'seventy-three', '74': 'seventy-four', '75': 'seventy-five',
        '76': 'seventy-six', '77': 'seventy-seven', '78': 'seventy-eight', '79': 'seventy-nine',
        '80': 'eighty', '81': 'eighty-one', '82': 'eighty-two', '83': 'eighty-three',
        '84': 'eighty-four', '85': 'eighty-five', '86': 'eighty-six', '87': 'eighty-seven',
        '88': 'eighty-eight', '89': 'eighty-nine', '90': 'ninety', '91': 'ninety-one',
        '92': 'ninety-two', '93': 'ninety-three', '94': 'ninety-four', '95': 'ninety-five',
        '96': 'ninety-six', '97': 'ninety-seven', '98': 'ninety-eight', '99': 'ninety-nine'
    },

    // Hindi number words
    numberWordsHindi: {
        '0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार',
        '5': 'पाँच', '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ',
        '10': 'दस', '11': 'ग्यारह', '12': 'बारह', '13': 'तेरह',
        '14': 'चौदह', '15': 'पंद्रह', '16': 'सोलह', '17': 'सत्रह',
        '18': 'अठारह', '19': 'उन्नीस', '20': 'बीस', '21': 'इक्कीस',
        '22': 'बाईस', '23': 'तेईस', '24': 'चौबीस', '25': 'पच्चीस',
        '26': 'छब्बीस', '27': 'सत्ताईस', '28': 'अट्ठाईस', '29': 'उनतीस',
        '30': 'तीस', '31': 'इकतीस', '32': 'बत्तीस', '33': 'तैंतीस',
        '34': 'चौंतीस', '35': 'पैंतीस', '36': 'छत्तीस', '37': 'सैंतीस',
        '38': 'अड़तीस', '39': 'उनतालीस', '40': 'चालीस', '41': 'इकतालीस',
        '42': 'बयालीस', '43': 'तैंतालीस', '44': 'चवालीस', '45': 'पैंतालीस',
        '46': 'छियालीस', '47': 'सैंतालीस', '48': 'अड़तालीस', '49': 'उनचास',
        '50': 'पचास', '51': 'इक्यावन', '52': 'बावन', '53': 'तिरेपन',
        '54': 'चौवन', '55': 'पचपन', '56': 'छप्पन', '57': 'सत्तावन',
        '58': 'अट्ठावन', '59': 'उनसठ', '60': 'साठ', '61': 'इकसठ',
        '62': 'बासठ', '63': 'तिरसठ', '64': 'चौंसठ', '65': 'पैंसठ',
        '66': 'छियासठ', '67': 'सड़सठ', '68': 'अड़सठ', '69': 'उनहत्तर',
        '70': 'सत्तर', '71': 'इकहत्तर', '72': 'बहत्तर', '73': 'तिहत्तर',
        '74': 'चौहत्तर', '75': 'पचहत्तर', '76': 'छिहत्तर', '77': 'सतहत्तर',
        '78': 'अठहत्तर', '79': 'उनासी', '80': 'अस्सी', '81': 'इक्यासी',
        '82': 'बयासी', '83': 'तिरासी', '84': 'चौरासी', '85': 'पचासी',
        '86': 'छियासी', '87': 'सतासी', '88': 'अट्ठासी', '89': 'नवासी',
        '90': 'नब्बे', '91': 'इक्यानवे', '92': 'बानवे', '93': 'तिरानवे',
        '94': 'चौरानवे', '95': 'पचानवे', '96': 'छियानवे', '97': 'सत्तानवे',
        '98': 'अट्ठानवे', '99': 'निन्यानवे'
    },

    // Filler phrases spoken while AI generates / charts calculate / plotting happens
    // Categories: thinking (generic), calculating (number crunching), revealing (deep reveal),
    //             love, career, year, kundli (narrative-specific)
    fillerPhrases: {
        en: {
            thinking: [
                "Hmm, let me look deeper into your chart.",
                "Hold on, something interesting is showing up.",
                "Okay wait, this part of your chart caught my eye.",
                "Let me connect these dots for you.",
                "Give me a second, your chart is quite layered.",
                "Okay, this is getting interesting.",
                "Hmm, I wasn't expecting this. Let me check again.",
                "There's a lot going on in your chart today.",
                "Bear with me, I want to get this right for you.",
                "Your planets are telling quite a story.",
                "Wait, I see multiple things lining up here.",
                "One moment, I want to double-check this before I say it.",
                "This is interesting, hold on.",
                "Let me trace this pattern more carefully.",
                "Hmm, something about your chart stands out to me."
            ],
            calculating: [
                "Mapping out your birth chart positions now.",
                "Running these through your exact coordinates.",
                "One moment, aligning the sidereal calculations.",
                "Processing your ascendant and house placements.",
                "Working through your dasha periods.",
                "Let me finalize these calculations.",
                "Almost done, cross-checking the birth time.",
                "Factoring in your birth location as well.",
                "These numbers are very specific to you.",
                "Every detail matters when the chart is this deep.",
                "Hold on, the math is nearly done.",
                "Charting the planetary degrees now.",
                "Your chart requires extra precision here.",
                "One more step before I can read this.",
                "The calculations are revealing something."
            ],
            revealing: [
                "Now this is important, listen carefully.",
                "Here's what your chart is really saying.",
                "I want you to pay close attention to this part.",
                "This is where it gets personal.",
                "Okay, this next part matters a lot.",
                "This is the part most people miss about themselves.",
                "Listen, this is directly from your chart.",
                "I don't say this to everyone, but your chart is clear.",
                "Pay attention, this is uniquely yours.",
                "Here comes the part that might surprise you.",
                "Okay I need to tell you this carefully.",
                "This is something very specific to your birth chart.",
                "Not many charts show this so clearly.",
                "I noticed something and I want to share it with you.",
                "This part is going to hit close to home."
            ],
            love: [
                "Your Venus placement is telling me something.",
                "Let me look at your seventh house closely.",
                "Your relationship pattern is very clear here.",
                "I can see how you love, and honestly, why.",
                "There's something specific about your romantic timing.",
                "The partnership angle is interesting in your chart.",
                "Hold on, your emotional blueprint is very unique.",
                "I'm seeing something about your love life."
            ],
            career: [
                "Your tenth house is showing a clear direction.",
                "Let me check your Saturn placement for career.",
                "Your professional timeline has some key moments.",
                "The wealth houses are active in your chart.",
                "I see your career pattern very clearly now.",
                "Your professional path has a unique signature.",
                "The money planets are aligned interestingly here.",
                "Hold on, let me read your professional destiny."
            ],
            year: [
                "This year's picture is forming in your chart.",
                "Let me read what the coming months are holding for you.",
                "Your personal year number changes things significantly.",
                "I can see some major shifts ahead for you.",
                "This period has a very specific energy.",
                "Some important dates are standing out to me.",
                "The next few months have a clear theme.",
                "Hold on, I'm seeing something about the near future."
            ],
            kundli: [
                "Your birth chart is taking shape now.",
                "The ascendant sets the foundation for everything.",
                "Each house tells a different chapter of your life.",
                "Your kundli has a very distinctive pattern.",
                "The lagna chart reveals a lot about you.",
                "Let me align the whole picture first.",
                "Your planetary positions are quite telling.",
                "Hold on, I'm mapping out the full chart."
            ]
        },
        hi: {
            thinking: [
                "अच्छा रुकिए, मैं आपकी कुंडली में कुछ देख रही हूँ।",
                "एक पल, मुझे यहाँ कुछ रोचक दिखा है।",
                "थोड़ा गहराई से देखती हूँ अब।",
                "रुकिए, इस ढंग को ध्यान से पकड़ना है।",
                "हम्म, आपकी कुंडली में यह बात काफ़ी दिलचस्प है।",
                "एक पल, मुझे यह कोण ठीक से देख लेने दीजिए।",
                "अच्छा, यह हिस्सा बहुत ध्यान माँगता है।",
                "बस, एक बात पक्की कर लूँ फिर बताती हूँ।",
                "आपके ग्रह बहुत कुछ कह रहे हैं, सुनिए।",
                "अरे, यह तो मुझे अपेक्षित नहीं था, फिर से देखती हूँ।",
                "कई बातें एक साथ मिल रही हैं आपकी कुंडली में।",
                "रुकिए, मैं इसे जाँच कर बताती हूँ।",
                "अच्छा, अब यह काफ़ी साफ़ दिख रहा है।",
                "एक पल, आपकी कुंडली काफ़ी गहरी है।",
                "हम्म, यह बात मुझे ठीक से समझ कर कहनी है।"
            ],
            calculating: [
                "ग्रहों के स्थान संरेखित हो रहे हैं, एक पल।",
                "आपकी सटीक जन्म कुंडली की गणना चल रही है।",
                "भावों का नक्शा बन रहा है, बस थोड़ा और।",
                "लग्न की गणना अंतिम चरण में है।",
                "दशा अवधियाँ निकाल रही हूँ, यह बहुत ज़रूरी है।",
                "बस ये गणनाएँ पूरी होने वाली हैं।",
                "जन्म समय और स्थान दोनों जोड़ रही हूँ।",
                "अंक लगभग तैयार हैं, बस एक चरण और।",
                "ये अंक केवल आपके हैं, और किसी के नहीं।",
                "हर अंश यहाँ मायने रखता है।",
                "गोचर के मेल देख रही हूँ, थोड़ा धीरज।",
                "नक्षत्र निर्देशांक मिलाए जा रहे हैं।",
                "ग्रहों के अंश मानचित्रित हो रहे हैं।",
                "बस, अंतिम चरण चल रहा है।",
                "ये गणनाएँ बहुत सूक्ष्म हैं, एक पल और।"
            ],
            revealing: [
                "अब ध्यान से सुनिए, यह बात बहुत ज़रूरी है।",
                "अच्छा, अब मैं वही कहती हूँ जो सच में दिख रहा है।",
                "यह हिस्सा बहुत निजी होने वाला है।",
                "सुनिए, यह सीधा आपकी कुंडली से आ रहा है।",
                "अभी कुछ बहुत स्पष्ट बात बताने वाली हूँ।",
                "यह बात मैं हर किसी को नहीं कहती, सुनिए।",
                "ध्यान दीजिए, यह केवल आपके लिए है।",
                "यह वह बात है जो ज़्यादातर लोग ख़ुद के बारे में नहीं जानते।",
                "अच्छा, अब महत्वपूर्ण हिस्सा आ रहा है।",
                "यह शायद आपको चौंका दे, पर कुंडली स्पष्ट है।",
                "मुझे यह बात ध्यान से कहनी है, सुनिए।",
                "यह बारीकी सबकी कुंडली में नहीं होती।",
                "अब बताती हूँ वह बात जो मुझे सबसे गहरी दिखी।",
                "रुकिए, यह सावधानी से कहना है।",
                "यह आपकी कुंडली का सबसे प्रबल संकेत है।"
            ],
            love: [
                "अच्छा, आपका शुक्र मुझे कुछ बता रहा है।",
                "सातवें भाव में कुछ दिखा, रुकिए।",
                "आपके सम्बन्धों का ढंग काफ़ी साफ़ आ रहा है।",
                "मुझे दिख रहा है आप कैसे प्रेम करते हैं, और क्यों।",
                "प्रेम के समय में कुछ ख़ास है, बताती हूँ।",
                "साझेदारी का कोण आपकी कुंडली में बहुत रोचक है।",
                "आपकी भावनाओं की बनावट बहुत अनूठी है।",
                "प्रेम जीवन में कुछ विशेष दिख रहा है।"
            ],
            career: [
                "दसवाँ भाव स्पष्ट दिशा दे रहा है।",
                "शनि की स्थिति से आपका व्यवसाय पढ़ रही हूँ।",
                "व्यावसायिक यात्रा में मुख्य पल दिख रहे हैं।",
                "धन के भाव सक्रिय हैं आपकी कुंडली में।",
                "आपके काम का ढंग अब साफ़ हो रहा है।",
                "व्यवसाय की राह में अनूठा संकेत है, देखिए।",
                "धन के ग्रह दिलचस्प तरह से बैठे हैं।",
                "व्यावसायिक भाग्य पढ़ रही हूँ, एक पल।"
            ],
            year: [
                "इस वर्ष के गोचर का चित्र बन रहा है।",
                "आने वाले महीने क्या लाएँगे, बताती हूँ।",
                "व्यक्तिगत वर्ष अंक ने सब कुछ बदल दिया है।",
                "आगे बड़े बदलाव दिख रहे हैं।",
                "इस समय की ऊर्जा बहुत विशेष है।",
                "कुछ महत्वपूर्ण तिथियाँ निकल रही हैं।",
                "अगले कुछ महीनों का स्पष्ट सार है, सुनिए।",
                "निकट भविष्य में कुछ ख़ास दिख रहा है।"
            ],
            kundli: [
                "आपकी जन्म कुंडली अब आकार ले रही है।",
                "लग्न सब कुछ की नींव है, देखिए।",
                "हर भाव आपके जीवन का अलग अध्याय खोलता है।",
                "ग्रह कहाँ बैठे हैं, यह नक्शा बन रहा है।",
                "आपकी कुंडली का ढंग काफ़ी विशिष्ट है।",
                "लग्न कुंडली बहुत कुछ उजागर कर रही है।",
                "पहले पूरा चित्र संरेखित होने दीजिए।",
                "ग्रहों का नक्शा आपका बहुत कुछ कह रहा है।"
            ]
        }
    },

    // Track recent fillers to avoid repetition (ring buffer of last N indices)
    _recentFillers: [],
    _maxRecentFillers: 5,
    fillerTimeout: null,

    // Dynamic AI-generated filler queue (per language+type). Consumed before falling back to static.
    // Shape: { 'hi:thinking': ['...', '...'], 'en:kundli': [...] }
    _dynamicFillerQueue: {},

    /**
     * Push AI-generated fillers into the queue. Called by MayaFunnel after pre-warming.
     */
    pushDynamicFillers(lang, type, phrases) {
        if (!Array.isArray(phrases) || !phrases.length) return;
        const key = `${lang}:${type}`;
        if (!this._dynamicFillerQueue[key]) this._dynamicFillerQueue[key] = [];
        // Cap queue at 12 per type to avoid unbounded growth
        this._dynamicFillerQueue[key] = this._dynamicFillerQueue[key].concat(phrases).slice(-12);
    },

    /**
     * Get a random filler phrase (prefers AI-generated dynamic queue, falls back to static)
     */
    getRandomFiller(type = 'thinking') {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        const lang = isHindi ? 'hi' : 'en';

        // Prefer dynamic AI-generated filler if available (FIFO)
        const dynKey = `${lang}:${type}`;
        const dynQ = this._dynamicFillerQueue[dynKey];
        if (dynQ && dynQ.length) {
            let phrase = dynQ.shift();
            if (isHindi && this._isGuideMale()) {
                phrase = phrase
                    .replace(/रही हूँ/g, 'रहा हूँ')
                    .replace(/सकती हूँ/g, 'सकता हूँ')
                    .replace(/बताती हूँ/g, 'बताता हूँ')
                    .replace(/कहती हूँ/g, 'कहता हूँ')
                    .replace(/वाली हूँ/g, 'वाला हूँ')
                    .replace(/\bबताऊँगी\b/g, 'बताऊँगा')
                    .replace(/\bकरूँगी\b/g, 'करूँगा')
                    .replace(/\bचाहती\b/g, 'चाहता')
                    .replace(/\bदेखती\b/g, 'देखता')
                    .replace(/\bकरती\b/g, 'करता');
            }
            // Trigger background refill when running low
            if (dynQ.length <= 1 && window.MayaFunnel?._refillDynamicFillers) {
                try { window.MayaFunnel._refillDynamicFillers(type); } catch (_e) { }
            }
            return phrase;
        }

        const phrases = this.fillerPhrases[lang][type] || this.fillerPhrases[lang].thinking;
        if (!phrases.length) return '';

        // Build a key that includes type so ring buffer is per-type
        const key = `${lang}:${type}`;

        // Get random index not in recent buffer for this type
        let index;
        let attempts = 0;
        do {
            index = Math.floor(Math.random() * phrases.length);
            attempts++;
        } while (this._recentFillers.includes(`${key}:${index}`) && attempts < 20 && phrases.length > 1);

        // Track in ring buffer
        this._recentFillers.push(`${key}:${index}`);
        if (this._recentFillers.length > this._maxRecentFillers) {
            this._recentFillers.shift();
        }

        let phrase = phrases[index];
        // Flip Hindi filler lines to masculine if guide is male
        if (isHindi && this._isGuideMale()) {
            phrase = phrase
                .replace(/रही हूँ/g, 'रहा हूँ')
                .replace(/सकती हूँ/g, 'सकता हूँ')
                .replace(/बताती हूँ/g, 'बताता हूँ')
                .replace(/कहती हूँ/g, 'कहता हूँ')
                .replace(/वाली हूँ/g, 'वाला हूँ')
                .replace(/\bबताऊँगी\b/g, 'बताऊँगा')
                .replace(/\bकरूँगी\b/g, 'करूँगा')
                .replace(/\bपाऊँगी\b/g, 'पाऊँगा')
                .replace(/\bचाहती\b/g, 'चाहता')
                .replace(/\bदेखती\b/g, 'देखता')
                .replace(/\bकरती\b/g, 'करता')
                .replace(/\bलेती\b/g, 'लेता')
                .replace(/\bबनाती\b/g, 'बनाता')
                .replace(/\bपढ़ती\b/g, 'पढ़ता');
        }
        return phrase;
    },

    /**
     * Check if guide is male
     */
    _isGuideMale() {
        const profile = window.MayaUtils?.storage?.get('maya_profile') || {};
        const funnelData = window.MayaUtils?.storage?.get('funnel_data') || {};
        const g = profile.agentGender || funnelData.agentGender
            || window.MayaFunnel?.userData?.agentGender
            || this.agentGender || 'female';
        return g === 'male';
    },

    /**
     * Speak a filler phrase while waiting
     */
    async speakFiller(type = 'thinking') {
        const phrase = this.getRandomFiller(type);
        if (!phrase) return;
        try {
            await this.speak(phrase);
        } catch (e) {
            // Filler failure is non-critical
        }
    },

    /**
     * Start speaking fillers at intervals while waiting for something
     * Returns a function to stop the fillers
     */
    startFillerLoop(intervalMs = 5000, type = 'thinking') {
        let stopped = false;
        const loop = async () => {
            while (!stopped) {
                await this.speakFiller(type);
                if (stopped) break;
                await new Promise(r => setTimeout(r, intervalMs));
            }
        };
        loop();
        return () => { stopped = true; };
    },

    /**
     * Wrapper for AI generation that speaks fillers naturally while waiting.
     * Loops through fillers with a pause between each, stopping when the async work finishes.
     * Options: type (filler category), startDelay (ms before first filler), interval (ms between fillers), maxFillers.
     */
    async withFillers(asyncFn, options = {}) {
        const type = options.type || 'thinking';
        const startDelay = options.startDelay ?? 800;
        const interval = options.interval ?? 3500;
        const maxFillers = options.maxFillers ?? 4;

        let done = false;
        const resultPromise = asyncFn().finally(() => { done = true; });

        // Filler loop: speaks up to maxFillers with interval gaps, stops when AI finishes
        const fillerLoop = async () => {
            // Initial delay before first filler
            if (startDelay > 0) {
                await new Promise(r => setTimeout(r, startDelay));
            }
            let count = 0;
            while (!done && count < maxFillers) {
                const phrase = this.getRandomFiller(type);
                if (!phrase) break;
                try {
                    await this.speak(phrase);
                } catch (e) { /* non-critical */ }
                count++;
                if (done || count >= maxFillers) break;
                // Pause between fillers
                await new Promise(r => setTimeout(r, interval));
            }
        };
        fillerLoop(); // fire-and-forget

        return await resultPromise;
    },

    // Audio cache for pre-generated audio
    audioCache: new Map(),
    pendingAudio: new Map(),
    preferredVoiceId: null,
    // Selected guide gender: 'female' (default MAYA) or 'male'. Drives voice + persona.
    agentGender: null,

    /**
     * Switch the guide's voice based on gender selection from onboarding.
     * Clears any manually-overridden voice id so the gender-specific default kicks in.
     */
    setAgentGender(gender) {
        const next = gender === 'male' ? 'male' : 'female';
        this.agentGender = next;
        this.preferredVoiceId = null;
        try {
            const profile = (window.MayaUtils?.storage?.get('maya_profile')) || {};
            profile.agentGender = next;
            window.MayaUtils?.storage?.set('maya_profile', profile);
        } catch (_e) { /* non-fatal */ }
        // Invalidate any cached pre-generated audio so new voice takes effect immediately.
        try { this.audioCache?.clear?.(); } catch (_e) { }
        try { this.pendingAudio?.clear?.(); } catch (_e) { }
        console.log(`🎙️ Guide voice set to ${next}`);
        return next;
    },

    // Rate limiting for ElevenLabs API
    rateLimitQueue: [],
    isProcessingQueue: false,
    lastRequestTime: 0,
    minRequestInterval: 180, // Keep audio generation responsive without hammering the API
    maxRetries: 3,
    retryBaseDelay: 1000, // Start with 1 second delay for retries
    speechProfile: {
        fallbackRate: 1,
        fallbackPitch: 1.04,
        interSentencePauseMs: 0,
        maxChunkChars: 420,
        maxSentencesPerChunk: 3,
        playbackRateEn: 1.04,
        playbackRateHi: 1.04
    },

    escapeRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Convert a Roman-script word to approximate Devanagari for Hindi TTS.
     * Not perfect, but far better than ElevenLabs trying to read Roman text in Hindi mode.
     */
    approximateDevanagari(text) {
        if (!text) return '';
        if (/[\u0900-\u097F]/.test(text)) return text;

        // Common Indian names -exact Devanagari for perfect pronunciation
        const nameMap = {
            'aviraj': 'अविराज', 'avinash': 'अविनाश', 'amit': 'अमित', 'amita': 'अमिता',
            'aarav': 'आरव', 'arjun': 'अर्जुन', 'aditya': 'आदित्य', 'ankit': 'अंकित',
            'ankita': 'अंकिता', 'akash': 'आकाश', 'alok': 'आलोक', 'ananya': 'अनन्या',
            'bhavya': 'भाव्या', 'bharat': 'भारत', 'chetan': 'चेतन',
            'deepak': 'दीपक', 'deepika': 'दीपिका', 'dev': 'देव', 'divya': 'दिव्या', 'diya': 'दिया',
            'gaurav': 'गौरव', 'geeta': 'गीता', 'harsh': 'हर्ष', 'harshit': 'हर्षित',
            'isha': 'ईशा', 'ishaan': 'ईशान', 'jay': 'जय', 'jatin': 'जतिन',
            'karan': 'करन', 'kavya': 'काव्या', 'kishan': 'किशन', 'kriti': 'कृति', 'krishna': 'कृष्णा',
            'lakshmi': 'लक्ष्मी', 'lalit': 'ललित', 'manish': 'मनीष', 'maya': 'माया', 'meera': 'मीरा', 'mohit': 'मोहित', 'mukesh': 'मुकेश',
            'naman': 'नमन', 'neha': 'नेहा', 'nikhil': 'निखिल', 'nisha': 'निशा', 'nitin': 'नितिन',
            'pankaj': 'पंकज', 'pooja': 'पूजा', 'priya': 'प्रिया', 'priyanka': 'प्रियंका',
            'rahul': 'राहुल', 'raj': 'राज', 'rajesh': 'राजेश', 'ravi': 'रवि', 'ritika': 'रितिका', 'rohit': 'रोहित', 'rohan': 'रोहन',
            'sachin': 'सचिन', 'sahil': 'साहिल', 'sandeep': 'संदीप', 'sanjay': 'संजय', 'shivam': 'शिवम', 'shreya': 'श्रेया', 'simran': 'सिमरन', 'sneha': 'स्नेहा', 'sunil': 'सुनील', 'swati': 'स्वाति',
            'tanvi': 'तन्वी', 'tushar': 'तुषार', 'varun': 'वरुण', 'vikram': 'विक्रम', 'vishal': 'विशाल', 'vivek': 'विवेक',
            'yash': 'यश', 'yogesh': 'योगेश',
        };
        const lookup = text.toLowerCase().trim();
        if (nameMap[lookup]) return nameMap[lookup];

        const w = lookup;
        let result = '';
        let i = 0;
        const C = {
            'shr': 'श्र', 'chh': 'छ', 'ksh': 'क्ष',
            'kh': 'ख', 'gh': 'घ', 'ch': 'च', 'jh': 'झ', 'th': 'थ', 'dh': 'ध', 'ph': 'फ', 'bh': 'भ', 'sh': 'श',
            'pr': 'प्र', 'kr': 'क्र', 'gr': 'ग्र', 'tr': 'त्र', 'br': 'ब्र', 'dr': 'द्र', 'sv': 'स्व', 'sw': 'स्व', 'st': 'स्त', 'sk': 'स्क', 'sp': 'स्प', 'sn': 'स्न', 'sm': 'स्म', 'ny': 'न्य',
            'k': 'क', 'g': 'ग', 'j': 'ज', 't': 'त', 'd': 'द', 'n': 'न', 'p': 'प', 'b': 'ब', 'm': 'म', 'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व', 'h': 'ह', 's': 'स', 'f': 'फ़', 'z': 'ज़', 'q': 'क़', 'x': 'क्स'
        };
        const VF = { 'aa': 'आ', 'ee': 'ई', 'oo': 'ऊ', 'ai': 'ऐ', 'au': 'औ', 'a': 'अ', 'i': 'इ', 'u': 'उ', 'e': 'ए', 'o': 'ओ' };
        const VM = { 'aa': 'ा', 'ee': 'ी', 'oo': 'ू', 'ai': 'ै', 'au': 'ौ', 'a': '', 'i': 'ि', 'u': 'ु', 'e': 'े', 'o': 'ो' };
        while (i < w.length) {
            let cons = null, cl = 0;
            for (const len of [3, 2, 1]) {
                const s = w.substring(i, i + len);
                if (C[s]) { cons = C[s]; cl = len; break; }
            }
            if (cons) {
                i += cl;
                let vm = null, vl = 0;
                for (const len of [2, 1]) {
                    const s = w.substring(i, i + len);
                    if (VM[s] !== undefined) { vm = VM[s]; vl = len; break; }
                }
                result += cons + (vm !== null ? vm : '');
                if (vl) i += vl;
            } else {
                let vf = null, vl = 0;
                for (const len of [2, 1]) {
                    const s = w.substring(i, i + len);
                    if (VF[s]) { vf = VF[s]; vl = len; break; }
                }
                if (vf) { result += vf; i += vl; }
                else { result += w[i]; i++; }
            }
        }
        return result;
    },

    /**
     * Normalize remaining romanized Hindi words to Devanagari for correct TTS pronunciation.
     */
    normalizeRomanHindiWords(text) {
        if (!text) return '';
        const map = {
            'kundli': 'कुंडली', 'kundali': 'कुंडली', 'kundali': 'कुंडली',
            'rashi': 'राशि', 'raashi': 'राशि',
            'graha': 'ग्रह', 'grahas': 'ग्रहों', 'grahon': 'ग्रहों',
            'nakshatra': 'नक्षत्र', 'nakshatras': 'नक्षत्रों',
            'bhav': 'भाव', 'bhava': 'भाव',
            'janma': 'जन्म', 'janam': 'जन्म',
            'jeevan': 'जीवन', 'jeewan': 'जीवन',
            'manglik': 'मांगलिक', 'mangalik': 'मांगलिक',
            'panchang': 'पंचांग',
            'muhurat': 'मुहूर्त', 'muhurt': 'मुहूर्त',
            'gochar': 'गोचर', 'transit': 'गोचर',
            'shubh': 'शुभ', 'ashubh': 'अशुभ',
            'vivaah': 'विवाह', 'vivah': 'विवाह',
            'chaliye': 'चलिए', 'dekhte': 'देखते', 'dekhiye': 'देखिए',
            'samajhte': 'समझते', 'samajhiye': 'समझिए',
            'suniye': 'सुनिए', 'bataiye': 'बताइए',
            'aapki': 'आपकी', 'aapka': 'आपका', 'aapke': 'आपके',
            'hai': 'है', 'hain': 'हैं', 'mein': 'में',
            'saath': 'साथ', 'aur': 'और',
            'bahut': 'बहुत', 'kuch': 'कुछ',
            'abhi': 'अभी', 'yahan': 'यहाँ',
            'dasha': 'दशा', 'lagna': 'लग्न', 'yoga': 'योग', 'dosha': 'दोष',
            'mahadasha': 'महादशा', 'antardasha': 'अंतर्दशा',
            'rahu': 'राहु', 'ketu': 'केतु', 'shani': 'शनि', 'mangal': 'मंगल',
            'shukra': 'शुक्र', 'guru': 'गुरु', 'budh': 'बुध', 'surya': 'सूर्य', 'chandra': 'चन्द्र',
            'bhav': 'भाव', 'bhava': 'भाव',
            'vedic': 'वैदिक', 'jyotish': 'ज्योतिष',
            'signals': 'संकेत', 'signal': 'संकेत',
            'pattern': 'पैटर्न', 'patterns': 'पैटर्न',
            'confirm': 'कन्फर्म', 'analysis': 'विश्लेषण',
            'exact': 'सटीक', 'positions': 'स्थितियां', 'position': 'स्थिति',
            'timeline': 'समयरेखा', 'transit': 'गोचर', 'transits': 'गोचर',
            'planetary': 'ग्रहों की',
            'houses': 'भाव', 'house': 'भाव',
            'ascendant': 'लग्न',
            'chart': 'कुंडली',
            'reading': 'रीडिंग', 'deep': 'गहरी',
            'profile': 'प्रोफाइल',
            'details': 'जानकारी',
            'guide': 'गाइड',
            'astrology': 'ज्योतिष',
        };
        let result = text;
        for (const [roman, devanagari] of Object.entries(map)) {
            result = result.replace(new RegExp(`\\b${this.escapeRegExp(roman)}\\b`, 'gi'), devanagari);
        }
        return result;
    },

    /**
     * Replace Urdu/Arabic/Persian words with pure Hindi equivalents.
     * Acts as a safety net when AI slips past the prompt rules.
     */
    replaceUrduWithHindi(text) {
        if (!text) return '';
        const map = [
            [/इश्क|मोहब्बत/g, 'प्रेम'], [/ख्वाब/g, 'सपना'], [/शख्सियत/g, 'व्यक्तित्व'],
            [/ताल्लुक/g, 'रिश्ता'], [/किस्मत|तक़दीर|तकदीर/g, 'भाग्य'], [/सुकून/g, 'शांति'],
            [/हौसला/g, 'हिम्मत'], [/वजह/g, 'कारण'], [/खुदा/g, 'भगवान'],
            [/वक़्त|वक्त/g, 'समय'], [/राज़/g, 'रहस्य'], [/ग़ौर|गौर/g, 'ध्यान'],
            [/नज़र/g, 'नजर'], [/हक़ीक़त|हकीकत/g, 'सच्चाई'], [/मंज़िल|मंजिल/g, 'लक्ष्य'],
            [/अल्फ़ाज़|अल्फाज/g, 'शब्द'], [/रूह/g, 'आत्मा'], [/जज़्बात|जज्बात/g, 'भावनाएँ'],
            [/ख़याल|ख्याल/g, 'विचार'], [/ज़माना|जमाना/g, 'दौर'], [/इज़्ज़त|इज्जत/g, 'सम्मान'],
            [/गुज़रना|गुजरना/g, 'बीतना'], [/ज़िन्दगी|जिन्दगी|ज़िंदगी/g, 'जिंदगी'],
            [/फ़ैसला|फैसला/g, 'निर्णय'], [/ख़ुशी|खुशी/g, 'खुशी'], [/दौलत/g, 'धन'],
            [/तक़रीबन|तकरीबन/g, 'लगभग'], [/शौक/g, 'रुचि'],
            // Remove nuqta from all letters
            [/ज़/g, 'ज'], [/क़/g, 'क'], [/ख़/g, 'ख'], [/ग़/g, 'ग'], [/फ़/g, 'फ'],
        ];
        let result = text;
        for (const [pattern, replacement] of map) {
            result = result.replace(pattern, replacement);
        }
        return result;
    },

    /**
     * Enforce consistent Devanagari spelling for astro terms.
     * Ensures the same term is always spelled identically across chunks
     * so ElevenLabs pronounces it consistently.
     */
    enforceConsistentAstroTerms(text) {
        if (!text) return '';
        const canonical = [
            // Planet names -always same Devanagari form
            [/\bराहू\b/g, 'राहु'], [/\bकेतू\b/g, 'केतु'],
            [/\bशनी\b/g, 'शनि'], [/\bशनिदेव\b/g, 'शनि'],
            [/\bमंगळ\b/g, 'मंगल'], [/\bबृहस्पती\b/g, 'बृहस्पति'],
            [/\bशुक्रा\b/g, 'शुक्र'], [/\bबुद्ध\b/g, 'बुध'],
            [/\bसुर्य\b/g, 'सूर्य'], [/\bचन्द्रमा\b/g, 'चन्द्र'],
            // Yoga names -consistent spelling
            [/गजकेसरी\s*योग|गज\s*केसरी\s*योग/g, 'गजकेसरी योग'],
            [/बुधादित्य\s*योग|बुध\s*आदित्य\s*योग/g, 'बुधादित्य योग'],
            [/चन्द्र\s*मंगल\s*योग|चंद्र\s*मंगल\s*योग/g, 'चन्द्र मंगल योग'],
            [/नीचभंग\s*राजयोग|नीच\s*भंग\s*राज\s*योग/g, 'नीचभंग राजयोग'],
            [/काल\s*सर्प\s*दोष|कालसर्प\s*दोष/g, 'काल सर्प दोष'],
            [/मंगल\s*दोष|मांगलिक\s*दोष/g, 'मंगल दोष'],
            // Dasha -consistent form
            [/महादशा/g, 'महादशा'], [/अंतरदशा|अन्तर्दशा/g, 'अंतर्दशा'],
            // Bhav/house -consistent
            [/भाव\b/g, 'भाव'],
            // Kundli -always same
            [/कुण्डली|कुन्डली/g, 'कुंडली'],
            // Lagna
            [/लग्ना\b/g, 'लग्न'],
        ];
        let result = text;
        for (const [pattern, replacement] of canonical) {
            result = result.replace(pattern, replacement);
        }
        return result;
    },

    getCanonicalUserNames() {
        const fullName = window.MayaFunnel?.userData?.name || window.MayaAI?.userContext?.name || '';
        const firstName = window.MayaFunnel?.firstName || (fullName ? fullName.trim().split(/\s+/)[0] : '');
        return {
            fullName: String(fullName || '').trim(),
            firstName: String(firstName || '').trim()
        };
    },

    normalizeNameReferences(text) {
        if (!text) return '';

        let normalized = String(text);
        const { fullName, firstName } = this.getCanonicalUserNames();

        if (fullName && firstName && fullName.toLowerCase() !== firstName.toLowerCase()) {
            normalized = normalized.replace(new RegExp(this.escapeRegExp(fullName), 'gi'), firstName);
        }

        if (firstName) {
            normalized = normalized
                .replace(new RegExp(`\\b${this.escapeRegExp(firstName)}\\s+${this.escapeRegExp(firstName)}\\b`, 'gi'), firstName)
                .replace(new RegExp(`\\b${this.escapeRegExp(firstName)}\\s+जी\\s+जी\\b`, 'gi'), `${firstName} जी`);
        }

        return normalized;
    },

    normalizeMixedScriptTerms(text) {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        if (!isHindi || !text) return String(text || '');

        const astroRules = MAYA_CONFIG?.LANGUAGE?.HINDI_ASTRO_TERM_RULES || [];

        return astroRules.reduce((localized, rule) => {
            try {
                return localized.replace(new RegExp(rule.pattern, 'gi'), rule.replacement);
            } catch (_error) {
                return localized;
            }
        }, String(text))
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
            .trim();
    },

    removeAdjacentPhraseRepetition(text) {
        let cleaned = String(text || '');
        const separator = '(?:\\s*[,.!?।;:\\-]\\s*|\\s+)';

        // Collapse repeated single tokens: "लग्न लग्न" -> "लग्न"
        cleaned = cleaned.replace(
            new RegExp(`\\b([A-Za-z\\u0900-\\u097F]+)\\b${separator}\\1\\b`, 'gi'),
            '$1'
        );

        // Collapse repeated 2-4 word phrases: "mean lagna mean lagna" -> "mean lagna"
        for (let pass = 0; pass < 3; pass++) {
            cleaned = cleaned.replace(
                new RegExp(`\\b((?:[A-Za-z\\u0900-\\u097F]+\\s+){1,3}[A-Za-z\\u0900-\\u097F]+)\\b${separator}\\1\\b`, 'gi'),
                '$1'
            );
        }

        return cleaned;
    },

    capRepeatedTerm(text, pattern, replacement, maxMentions = 2) {
        let count = 0;
        return String(text || '').replace(pattern, (match) => {
            count += 1;
            return count > maxMentions ? replacement : match;
        });
    },

    limitDashaOverfocus(text) {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        let limited = String(text || '');

        if (isHindi) {
            limited = this.capRepeatedTerm(limited, /राहु\s*दशा/gi, 'यह दशा');
            limited = this.capRepeatedTerm(limited, /राहु/gi, 'यह ग्रह');
            limited = this.capRepeatedTerm(limited, /दशा/gi, 'यह अवधि', 3);
        } else {
            limited = this.capRepeatedTerm(limited, /rahu\s*dasha/gi, 'this dasha period');
            limited = this.capRepeatedTerm(limited, /rahu/gi, 'this planet');
            limited = this.capRepeatedTerm(limited, /dasha/gi, 'this period', 3);
        }

        return limited;
    },

    normalizeHyphenatedExpressions(text) {
        let normalized = String(text || '');

        // Keep common expressive compounds tight for TTS rhythm.
        normalized = normalized
            .replace(/कभी\s*-\s*कभी/gi, 'कभी कभी')
            .replace(/थोड़ा\s*-\s*बहुत/gi, 'थोड़ा बहुत')
            .replace(/थोडा\s*-\s*बहुत/gi, 'थोडा बहुत')
            .replace(/kabhi\s*-\s*kabhi/gi, 'kabhi kabhi')
            .replace(/thoda\s*-\s*bahut/gi, 'thoda bahut');

        // For letter-letter hyphen compounds, remove the dash so TTS doesn't pause.
        normalized = normalized.replace(/([A-Za-z\u0900-\u097F])\s*-\s*([A-Za-z\u0900-\u097F])/g, '$1$2');

        return normalized;
    },

    splitIntoSpeechChunks(text) {
        const rawChunks = String(text || '').match(/[^.!?।]+(?:[.!?।]+|$)/g) || [String(text || '')];
        const sentences = [];
        const groupedChunks = [];
        let lastFingerprint = '';
        let currentChunk = '';
        let currentSentenceCount = 0;

        for (const rawChunk of rawChunks) {
            const chunk = String(rawChunk || '').trim();
            if (!chunk) continue;

            const fingerprint = chunk
                .toLowerCase()
                .replace(/[.!?।]+$/g, '')
                .replace(/\s+/g, ' ');

            if (!fingerprint || fingerprint === lastFingerprint) {
                continue;
            }

            sentences.push(chunk);
            lastFingerprint = fingerprint;
        }

        for (const sentence of sentences) {
            const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
            const tooLong = nextChunk.length > this.speechProfile.maxChunkChars;
            const tooManySentences = currentSentenceCount >= this.speechProfile.maxSentencesPerChunk;

            if (currentChunk && (tooLong || tooManySentences)) {
                groupedChunks.push(currentChunk);
                currentChunk = sentence;
                currentSentenceCount = 1;
                continue;
            }

            currentChunk = nextChunk;
            currentSentenceCount += 1;
        }

        if (currentChunk) {
            groupedChunks.push(currentChunk);
        }

        return groupedChunks;
    },

    buildChunkSpeechOptions(chunks, index) {
        return {
            previousText: chunks.slice(Math.max(0, index - 2), index).join(' ').trim(),
            nextText: chunks.slice(index + 1, index + 3).join(' ').trim()
        };
    },

    // ── TTS Prefetch ──────────────────────────────────────────
    // Pre-warm the first audio chunk so playback starts instantly.
    _prefetchCache: new Map(),

    prefetchSpeech(text) {
        if (!text || this.isMuted || this.isElevenLabsUnavailable()) return;
        try {
            const prepared = this.prepareForSpeech(text);
            const chunks = this.splitIntoSpeechChunks(prepared);
            if (chunks.length > 0) {
                const firstChunk = chunks[0];
                if (!this._prefetchCache.has(firstChunk)) {
                    const options = this.buildChunkSpeechOptions(chunks, 0);
                    const prefetchPromise = this.textToSpeech(firstChunk, options).catch((error) => {
                        this._prefetchCache.delete(firstChunk);
                        return { ttsPrefetchError: error };
                    });
                    this._prefetchCache.set(firstChunk, prefetchPromise);
                    // Auto-expire after 30s to avoid stale cache
                    setTimeout(() => this._prefetchCache.delete(firstChunk), 30000);
                }
            }
        } catch (e) {
            console.warn('Prefetch TTS failed:', e.message);
        }
    },

    async speakChunks(chunks, onProgress = null) {
        const normalizedChunks = (chunks || []).map((chunk) => String(chunk || '').trim()).filter(Boolean);
        if (!normalizedChunks.length) return;

        let pendingAudio = null;

        for (let index = 0; index < normalizedChunks.length; index++) {
            if (this.aborted) {
                console.log('🛑 Speech aborted');
                break;
            }

            const text = normalizedChunks[index];

            try {
                if (onProgress) {
                    onProgress(text, false);
                }

                if (!pendingAudio) {
                    // Use prefetched audio if available for this chunk
                    if (this._prefetchCache && this._prefetchCache.has(text)) {
                        pendingAudio = this._prefetchCache.get(text);
                        this._prefetchCache.delete(text);
                    } else {
                        pendingAudio = this.textToSpeech(text, this.buildChunkSpeechOptions(normalizedChunks, index));
                    }
                }

                const audioBlob = await pendingAudio;

                if (audioBlob?.ttsPrefetchError) {
                    throw audioBlob.ttsPrefetchError;
                }

                if (this.aborted) {
                    console.log('🛑 Speech aborted');
                    break;
                }

                const hasNext = index < normalizedChunks.length - 1;
                pendingAudio = hasNext
                    ? this.textToSpeech(normalizedChunks[index + 1], this.buildChunkSpeechOptions(normalizedChunks, index + 1))
                    : null;

                if (audioBlob) {
                    await this.playAudio(audioBlob);
                    if (hasNext && this.speechProfile.interSentencePauseMs > 0) {
                        await MayaUtils.sleep(this.speechProfile.interSentencePauseMs);
                    }
                }
            } catch (error) {
                pendingAudio = null;
                console.error('Error speaking chunk:', error);
                if (this.shouldFallbackForTtsError(error)) {
                    const remainingText = normalizedChunks.slice(index).join(' ').trim();
                    if (remainingText) {
                        try {
                            await this.speakFallback(remainingText);
                        } catch (fallbackError) {
                            console.error('Browser TTS fallback failed:', fallbackError);
                        }
                    }
                    break;
                }
            }
        }
    },

    numberToWordsEn(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return String(value);
        if (number < 100) return this.numberWords[String(number)] || String(number);
        if (number < 1000) {
            const hundreds = Math.floor(number / 100);
            const remainder = number % 100;
            return `${this.numberWords[String(hundreds)]} hundred${remainder ? ` ${this.numberToWordsEn(remainder)}` : ''}`;
        }
        if (number < 1000000) {
            const thousands = Math.floor(number / 1000);
            const remainder = number % 1000;
            return `${this.numberToWordsEn(thousands)} thousand${remainder ? ` ${this.numberToWordsEn(remainder)}` : ''}`;
        }
        return String(number)
            .split('')
            .map((digit) => this.numberWords[digit] || digit)
            .join(' ');
    },

    numberToWordsHi(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return String(value);
        if (number < 100) return this.numberWordsHindi[String(number)] || String(number);
        if (number < 1000) {
            const hundreds = Math.floor(number / 100);
            const remainder = number % 100;
            return `${this.numberWordsHindi[String(hundreds)]} सौ${remainder ? ` ${this.numberToWordsHi(remainder)}` : ''}`;
        }
        if (number < 100000) {
            const thousands = Math.floor(number / 1000);
            const remainder = number % 1000;
            return `${this.numberToWordsHi(thousands)} हजार${remainder ? ` ${this.numberToWordsHi(remainder)}` : ''}`;
        }
        if (number < 10000000) {
            const lakhs = Math.floor(number / 100000);
            const remainder = number % 100000;
            return `${this.numberToWordsHi(lakhs)} लाख${remainder ? ` ${this.numberToWordsHi(remainder)}` : ''}`;
        }
        return String(number)
            .split('')
            .map((digit) => this.numberWordsHindi[digit] || digit)
            .join(' ');
    },

    /**
     * Convert a year (1900-2099) to natural spoken Hindi.
     * 1990 → "उन्नीस सौ नब्बे", 2025 → "दो हजार पच्चीस", 2000 → "दो हजार"
     */
    yearToWordsHi(year) {
        const y = Number(year);
        if (!Number.isFinite(y) || y < 1900 || y > 2099) return this.numberToWordsHi(y);
        if (y === 2000) return 'दो हजार';
        if (y > 2000 && y < 2100) {
            const remainder = y - 2000;
            return `दो हजार ${this.numberWordsHindi[String(remainder)] || this.numberToWordsHi(remainder)}`;
        }
        // 1900-1999: "उन्नीस सौ <remainder>"
        if (y >= 1900 && y < 2000) {
            const remainder = y - 1900;
            if (remainder === 0) return 'उन्नीस सौ';
            return `उन्नीस सौ ${this.numberWordsHindi[String(remainder)] || this.numberToWordsHi(remainder)}`;
        }
        return this.numberToWordsHi(y);
    },

    /**
     * Convert a year to natural spoken English.
     * 2025 → "twenty twenty five", 1990 → "nineteen ninety", 2000 → "two thousand"
     */
    yearToWordsEn(year) {
        const y = Number(year);
        if (!Number.isFinite(y) || y < 1900 || y > 2099) return this.numberToWordsEn(y);
        if (y === 2000) return 'two thousand';
        if (y > 2000 && y <= 2009) {
            return `two thousand ${this.numberWords[String(y - 2000)] || this.numberToWordsEn(y - 2000)}`;
        }
        if (y >= 2010 && y < 2100) {
            const remainder = y - 2000;
            return `twenty ${this.numberWords[String(remainder)] || this.numberToWordsEn(remainder)}`;
        }
        // 1900-1999: "nineteen <remainder>"
        if (y >= 1900 && y < 2000) {
            const remainder = y % 100;
            if (remainder === 0) return 'nineteen hundred';
            return `nineteen ${this.numberWords[String(remainder)] || this.numberToWordsEn(remainder)}`;
        }
        return this.numberToWordsEn(y);
    },

    /**
     * Convert numbers in text to spoken words for better TTS.
     * Years (1900-2099) get special natural pronunciation.
     * Ordinals (7th, 1st, etc.) get natural spoken form.
     * Regular numbers use standard conversion.
     */
    convertNumbersToWords(text) {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';

        // Hindi ordinal map for houses/bhav (1-12)
        const hindiOrdinals = {
            '1': 'पहला', '2': 'दूसरा', '3': 'तीसरा', '4': 'चौथा',
            '5': 'पाँचवाँ', '6': 'छठा', '7': 'सातवाँ', '8': 'आठवाँ',
            '9': 'नौवाँ', '10': 'दसवाँ', '11': 'ग्यारहवाँ', '12': 'बारहवाँ'
        };
        const enOrdinals = {
            '1': 'first', '2': 'second', '3': 'third', '4': 'fourth',
            '5': 'fifth', '6': 'sixth', '7': 'seventh', '8': 'eighth',
            '9': 'ninth', '10': 'tenth', '11': 'eleventh', '12': 'twelfth'
        };

        let result = String(text || '');

        // Handle Hindi ordinals: "7वाँ भाव", "7वें", "7वीं", "1ला"
        if (isHindi) {
            result = result.replace(/(\d{1,2})\s*(?:वाँ|वां|वें|वीं|ला|ली|रा|री)\s*(भाव)?/g, (_, num, bhav) => {
                const ord = hindiOrdinals[num] || `${this.numberWordsHindi[num] || num}वाँ`;
                return bhav ? `${ord} भाव` : ord;
            });
        }

        // Handle English ordinals: "7th house", "1st", "2nd", "3rd"
        result = result.replace(/(\d{1,2})\s*(?:st|nd|rd|th)\b/gi, (_, num) => {
            if (isHindi) {
                return hindiOrdinals[num] || `${this.numberWordsHindi[num] || num}वाँ`;
            }
            return enOrdinals[num] || `${this.numberToWordsEn(num)}th`;
        });

        // Handle years: 4-digit numbers that look like years (1900-2099)
        result = result.replace(/\b((?:19|20)\d{2})\b/g, (match) => {
            return isHindi ? this.yearToWordsHi(match) : this.yearToWordsEn(match);
        });

        // Handle remaining numbers (1-5 digits, not already converted)
        result = result.replace(/\b(\d{1,5})\b/g, (match) => {
            return isHindi ? this.numberToWordsHi(match) : this.numberToWordsEn(match);
        });

        return result;
    },

    /**
     * Prepare text for TTS - convert numbers and clean up
     */
    prepareForSpeech(text) {
        let prepared = this.normalizeMixedScriptTerms(this.normalizeNameReferences(text));

        // When Hindi, convert user's name and remaining romanized Hindi words to Devanagari
        const isHindiPrep = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        if (isHindiPrep) {
            const { firstName } = this.getCanonicalUserNames();
            if (firstName && !/[\u0900-\u097F]/.test(firstName)) {
                const devName = this.approximateDevanagari(firstName);
                if (devName && devName !== firstName.toLowerCase()) {
                    prepared = prepared.replace(new RegExp(this.escapeRegExp(firstName), 'gi'), devName);
                }
            }
            prepared = this.normalizeRomanHindiWords(prepared);

            // Urdu/Arabic/Persian → pure Hindi replacement (safety net for AI slips)
            prepared = this.replaceUrduWithHindi(prepared);

            // Consistent Devanagari for astro terms across all chunks
            prepared = this.enforceConsistentAstroTerms(prepared);
        }

        prepared = this.normalizeHyphenatedExpressions(prepared);
        prepared = this.removeAdjacentPhraseRepetition(prepared);
        prepared = this.limitDashaOverfocus(prepared);

        // Convert authored pause markers into spoken punctuation before number expansion,
        // otherwise markers like [[pause-250]] can leak the number into speech.
        prepared = prepared.replace(/\[\[pause-?(\d+)\]\]/gi, (_, ms) => Number(ms) >= 500 ? '. ' : ', ');
        prepared = prepared.replace(/\[\[\s*pause[^\]]*\]\]/gi, ', ');
        prepared = prepared.replace(/\[\[pause\]\]/gi, ', ');
        prepared = prepared.replace(/\[pause\]/gi, ', ');
        prepared = prepared.replace(/\bpause\s*-?\s*\d+\b/gi, ' ');
        prepared = prepared.replace(/\bपॉज़\s*-?\s*\d+\b/gi, ' ');
        prepared = prepared.replace(/\bpause\b/gi, ' ');
        prepared = prepared.replace(/\bपॉज़\b/gi, ' ');

        // Convert numbers to words after pause markers are normalized.
        prepared = this.convertNumbersToWords(prepared);

        prepared = prepared.replace(/।/g, '. ');
        prepared = prepared.replace(/;/g, '. ');
        prepared = prepared.replace(/:/g, ', ');
        prepared = prepared.replace(/[()]/g, ', ');
        // Treat only punctuation dashes as pauses. In-word hyphens are normalized earlier.
        prepared = prepared.replace(/\s[\-–—]\s/g, ', ');
        prepared = prepared.replace(/\.\.\./g, '... ');

        // Remove emoji and special characters that TTS struggles with
        prepared = prepared.replace(/[\u{1F600}-\u{1F6FF}]/gu, '');
        prepared = prepared.replace(/[\u{2600}-\u{26FF}]/gu, '');

        // Clean up arrows and mathematical symbols
        prepared = prepared.replace(/→/g, ' becomes ');
        prepared = prepared.replace(/=/g, ' equals ');
        prepared = prepared.replace(/\+/g, ' plus ');

        // Remove excess punctuation
        prepared = prepared.replace(/[,]{2,}/g, ',');
        prepared = prepared.replace(/[.]{2,}/g, '.');
        prepared = prepared.replace(/\s+([,.!?])/g, '$1');

        // Clean up multiple spaces and trim
        prepared = prepared.replace(/\s+/g, ' ').trim();

        if (prepared && !/[.!?]$/.test(prepared)) {
            prepared += '.';
        }

        return prepared;
    },

    stopCurrentAudio({ releaseLock = false, markAborted = false } = {}) {
        if (markAborted) {
            this.aborted = true;
        }

        if (this.currentAudio) {
            try {
                this.currentAudio.stop();
            } catch (e) {
                // Ignore errors when stopping an already-finished source.
            }
            this.currentAudio = null;
        }

        this.isPlaying = false;

        if (releaseLock) {
            this.speakingLock = false;
        }
    },

    /**
     * Initialize audio context
     */
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (!this.masterGain || !this.analyser || !this.dataArray) {
            this.masterGain = this.audioContext.createGain();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.masterGain.gain.value = 1;
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        }
    },

    /**
     * Resume audio context (needed for browsers that suspend it)
     */
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    },

    /**
     * Get audio amplitude for blob animation
     */
    getAmplitude() {
        if (!this.analyser || !this.isPlaying) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.dataArray.length / 255;
    },

    // TTS provider: uses ElevenLabs for all languages
    ttsProvider: 'elevenlabs',

    /**
     * Convert text to speech using ElevenLabs
     */
    async textToSpeech(text, options = {}) {
        if (this.isElevenLabsUnavailable()) {
            throw this.buildTtsUnavailableError();
        }

        return await this.textToSpeechElevenLabs(text, options);
    },

    /**
     * Inject ElevenLabs v3 audio tags into narration so the model delivers
     * lines with warmth, soft pauses, gentle smiles, dramatic reveals and
     * properly intoned questions. Operates at the SENTENCE level so each
     * beat of the reading gets a tag that fits its mood.
     *
     * Supported v3 tags used here (per ElevenLabs v3 docs):
     *   Emotion       : [warm], [curious], [thoughtful], [intrigued],
     *                   [excited], [reassuring], [empathetic], [mysterious]
     *   Delivery      : [softly], [whispers], [gentle smile], [slowly]
     *   Non-verbal    : [pause], [long pause], [sighs], [exhales]
     *
     * Strategy:
     *  - Preserve any AI-authored tags already present (do not double-tag).
     *  - Split into sentences and tag each one based on detected sentiment.
     *  - Every question gets a [pause] beat before it and a [curious] /
     *    [intrigued] lead so the model lifts its intonation properly.
     *  - Ellipses become real silence beats.
     *  - Em-dashes become soft mid-sentence pauses.
     */
    _injectExpressionTags(rawText, ctx = {}) {
        if (!rawText || typeof rawText !== 'string') return rawText;

        // Deterministic tagging: per-sentence rotating tags caused each
        // generation to sound expressively different. Now we only:
        //  1. Convert long ellipses + em-dashes to v3 [pause] beats.
        //  2. Add ONE light opening tag if the AI hasn't already provided one.
        // This keeps prosody natural without creating per-render swings.
        const validTagPattern = /^\s*\[(?:warm|curious|thoughtful|softly|gentle smile|smile|pause|long pause|reassuring|whispers?|excited|empathetic|calm|sighs?|exhales?|laughs?|chuckles|intrigued|mysterious|dramatic|intimate|slowly|quickly|hesitant|confident|gasps?)\]/i;

        let t = rawText.trim();
        if (!t) return rawText;

        t = t.replace(/\s*…\s*/g, ' [pause] ');
        t = t.replace(/\s*\.{3,}\s*/g, ' [pause] ');
        t = t.replace(/\s+\u2014\s+/g, ' [pause] ');

        // If the text already opens with a valid tag, leave it alone.
        if (validTagPattern.test(t)) {
            return t.replace(/\s{2,}/g, ' ').trim();
        }

        // Single, fixed opening tag so every generation starts with the
        // same warmth instead of swinging between excited / softly / etc.
        return `[warm] ${t}`.replace(/\s{2,}/g, ' ').trim();
    },

    async buildElevenLabsError(response) {
        let errorMessage = `ElevenLabs API error: ${response.status}`;
        let errorCode = '';

        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const body = await response.json();
                errorCode = body?.code || body?.detail?.code || '';
                errorMessage = body?.error?.message || body?.detail?.message || body?.message || body?.error || errorMessage;
            } else {
                const bodyText = await response.text();
                if (bodyText) errorMessage = bodyText;
            }
        } catch (_error) {
            // Keep the generic status message if the error body cannot be read.
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = errorCode;
        error.ttsFallback = true;
        return error;
    },

    /**
     * ElevenLabs TTS - high quality voice synthesis with rate limiting
     */
    async textToSpeechElevenLabs(text, options = {}) {
        if (this.isElevenLabsUnavailable()) {
            throw this.buildTtsUnavailableError();
        }

        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        const previousText = String(options.previousText || '').trim();
        const nextText = String(options.nextText || '').trim();
        // Resolve the guide gender (male / female). Male uses the dedicated male voice id.
        const profile = window.MayaUtils?.storage?.get('maya_profile') || {};
        const funnelData = window.MayaUtils?.storage?.get('funnel_data') || {};
        const agentGender = this.agentGender
            || profile.agentGender
            || funnelData.agentGender
            || (window.MayaFunnel?.userData?.agentGender)
            || 'female';
        const isMaleGuide = agentGender === 'male';
        const voiceId = this.preferredVoiceId
            || (isMaleGuide
                ? (MAYA_CONFIG.API_KEYS.ELEVENLABS_MALE_VOICE_ID || MAYA_CONFIG.API_KEYS.ELEVENLABS_VOICE_ID)
                : (isHindi
                    ? (MAYA_CONFIG.API_KEYS.ELEVENLABS_HI_VOICE_ID || MAYA_CONFIG.API_KEYS.ELEVENLABS_VOICE_ID)
                    : (MAYA_CONFIG.API_KEYS.ELEVENLABS_EN_VOICE_ID || MAYA_CONFIG.API_KEYS.ELEVENLABS_VOICE_ID)));
        const url = MAYA_CONFIG.ENDPOINTS.ELEVENLABS;

        // Prefer ElevenLabs v3 (more expressive, conversational) with v2 as fallback.
        const modelChain = (this._elevenLabsModelChain && this._elevenLabsModelChain.length)
            ? this._elevenLabsModelChain
            : ['eleven_v3', 'eleven_multilingual_v2'];

        const latencyOptimization = isMaleGuide ? 3 : 2;
        // Tuned for CONSISTENCY across generations (was: low stability + high style
        // which made each render swing in speed, tone & volume). Keep speaker_boost on
        // so volume is normalized identically every time. Pin speed to a single value
        // so two consecutive replies don't sound paced differently.
        const voiceSettingsByModel = (modelId) => {
            const isV3 = modelId === 'eleven_v3';
            // Same settings for Hindi and English so the same voice doesn't
            // shift personality between languages mid-conversation.
            return {
                // High stability => far less per-generation drift in pacing & tone.
                stability: isV3 ? 0.70 : 0.72,
                // High similarity_boost locks the voice's timbre to the cloned identity.
                similarity_boost: isV3 ? 0.88 : 0.90,
                // Low style => calm, predictable expression. v3 amplifies style heavily;
                // keep it near zero to stop emotion from spiking unevenly.
                style: isV3 ? 0.20 : 0.18,
                use_speaker_boost: true,
                // Single pinned speed so all replies feel paced the same.
                // (Slightly slower for warmth, but identical for both genders.)
                speed: 0.96
            };
        };
        let modelId = modelChain[0];
        let modelIndex = 0;

        const buildRequestBody = (currentModelId) => {
            // Inject ElevenLabs v3 expression tags for warmer, more human delivery.
            const finalText = (currentModelId === 'eleven_v3')
                ? this._injectExpressionTags(text, { isHindi, isMaleGuide })
                : text;
            const body = {
                text: finalText,
                model_id: currentModelId,
                voice_settings: voiceSettingsByModel(currentModelId),
                optimize_streaming_latency: latencyOptimization
            };
            // language_code is only valid on the multilingual v2 model; v3
            // auto-detects language from the text and rejects this field.
            if (currentModelId !== 'eleven_v3') {
                body.language_code = isHindi ? 'hi' : 'en';
            }
            return body;
        };
        let requestBody = buildRequestBody(modelId);

        if (previousText) {
            requestBody.previous_text = previousText.slice(-350);
        }

        if (nextText) {
            requestBody.next_text = nextText.slice(0, 350);
        }

        // Rate limiting: wait if we're sending requests too fast
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await MayaUtils.sleep(this.minRequestInterval - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();

        // Retry logic with exponential backoff
        let lastError;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...requestBody,
                        voiceId
                    })
                });

                if (response.status === 429) {
                    // Rate limited - wait and retry with exponential backoff
                    lastError = new Error('ElevenLabs rate limit');
                    lastError.status = 429;
                    lastError.ttsFallback = true;
                    const retryDelay = this.retryBaseDelay * Math.pow(2, attempt);
                    console.warn(`⚠️ ElevenLabs rate limit hit, waiting ${retryDelay}ms before retry ${attempt + 1}/${this.maxRetries}`);
                    await MayaUtils.sleep(retryDelay);
                    continue;
                }

                if (!response.ok) {
                    const error = await this.buildElevenLabsError(response);
                    // If the current model isn't available on this ElevenLabs
                    // account (typical for v3 alpha access), try the next
                    // model in the chain instead of giving up.
                    const message = String(error?.message || '').toLowerCase();
                    const isModelRejection = (response.status === 400 || response.status === 404 || response.status === 422)
                        && (message.includes('model') || message.includes('not allowed') || message.includes('access'));
                    if (isModelRejection && modelIndex < modelChain.length - 1) {
                        modelIndex += 1;
                        const nextModel = modelChain[modelIndex];
                        console.warn(`⚠️ ElevenLabs model "${modelId}" rejected (${response.status}); falling back to "${nextModel}"`);
                        modelId = nextModel;
                        requestBody = buildRequestBody(modelId);
                        if (previousText) requestBody.previous_text = previousText.slice(-350);
                        if (nextText) requestBody.next_text = nextText.slice(0, 350);
                        continue;
                    }
                    if ([401, 403, 404, 500, 502, 503].includes(response.status)) {
                        const cooldownMs = response.status === 503 ? 300000 : 120000;
                        this.markElevenLabsUnavailable(error.message, cooldownMs);
                        error.ttsNoRetry = true;
                    }
                    throw error;
                }

                const audioBlob = await response.blob();
                return audioBlob;
            } catch (error) {
                lastError = error;
                console.error(`ElevenLabs TTS error (attempt ${attempt + 1}):`, error);

                if (error?.ttsNoRetry || this.isElevenLabsUnavailable()) {
                    throw error;
                }

                if (attempt < this.maxRetries - 1) {
                    const retryDelay = this.retryBaseDelay * Math.pow(2, attempt);
                    await MayaUtils.sleep(retryDelay);
                }
            }
        }

        // All retries failed
        console.error('ElevenLabs TTS failed after all retries:', lastError);
        throw lastError;
    },

    /**
     * Play audio blob
     */
    async playAudio(audioBlob) {
        return new Promise(async (resolve, reject) => {
            try {
                this.init();
                await this.resumeContext();

                // Stop the previous audio source without aborting the overall narration.
                this.stopCurrentAudio();

                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                source.buffer = audioBuffer;

                const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
                const playbackRate = isHindi
                    ? this.speechProfile.playbackRateHi
                    : this.speechProfile.playbackRateEn;
                source.playbackRate.value = playbackRate;

                source.connect(gainNode);
                gainNode.connect(this.masterGain || this.analyser);

                const now = this.audioContext.currentTime;
                const duration = audioBuffer.duration / playbackRate;
                const fadeIn = Math.min(0.045, duration / 3);
                const fadeOut = Math.min(0.08, duration / 2);
                const fadeOutStart = Math.max(now + fadeIn, now + duration - fadeOut);

                gainNode.gain.setValueAtTime(0.0001, now);
                gainNode.gain.linearRampToValueAtTime(1, now + fadeIn);
                gainNode.gain.setValueAtTime(1, fadeOutStart);
                gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);

                this.currentAudio = source;
                this.isPlaying = true;

                source.onended = () => {
                    this.isPlaying = false;
                    this.currentAudio = null;
                    resolve();
                };

                if (!this.isMuted) {
                    source.start(now);
                    // Fire one-shot callback so callers know audio is actually playing
                    if (this.onPlaybackStart) {
                        this.onPlaybackStart();
                        this.onPlaybackStart = null;
                    }
                } else {
                    resolve();
                }
            } catch (error) {
                console.error('Audio playback error:', error);
                this.isPlaying = false;
                reject(error);
            }
        });
    },

    /**
     * Pre-generate audio for a text (DISABLED - not using cache)
     */
    async pregenerateAudio(text, cacheKey = null) {
        // Cache disabled - audio generated fresh on demand
        console.log('⏭️ Audio pre-generation disabled');
        return;
    },

    /**
     * Wait for any ongoing speech to complete before starting new speech
     * This prevents voice overlap issues
     */
    async waitForSpeechComplete() {
        // Wait if currently speaking
        let waitCount = 0;
        while (this.speakingLock && waitCount < 100) {
            await MayaUtils.sleep(100);
            waitCount++;
        }
        if (waitCount >= 100) {
            console.warn('⚠️ Speech wait timeout, forcing unlock');
            this.speakingLock = false;
            this.stop();
        }
    },

    /**
     * Speak text with automatic chunking for long text
     * Uses parallel pre-fetching for faster playback - starts immediately
     * PREVENTS OVERLAP: waits for any ongoing speech to complete first
     */
    async speak(text, onProgress = null) {
        if (this.isMuted) {
            if (onProgress) onProgress(text, true);
            return;
        }

        // Wait for any ongoing speech to complete (prevents overlap)
        await this.waitForSpeechComplete();

        // Reset abort flag and acquire speaking lock
        this.aborted = false;
        this.speakingLock = true;

        try {
            // Prepare text for better TTS (convert numbers to words)
            const preparedText = this.prepareForSpeech(text);

            // Split text into speech chunks without dropping the trailing fragment.
            const sentencesArray = this.splitIntoSpeechChunks(preparedText);

            console.log('⚡ Natural speech pipeline - prefetching upcoming chunks');
            await this.speakChunks(sentencesArray, onProgress);

            if (onProgress) {
                onProgress(text, true);
            }
        } finally {
            // Always release the speaking lock
            this.speakingLock = false;
        }
    },

    /**
     * Stream speak - starts speaking immediately with first sentence while generating rest
     * Perfect for chat responses where we want instant feedback
     */
    async speakStreaming(text, onProgress = null) {
        if (this.isMuted) {
            if (onProgress) onProgress(text, true);
            return;
        }

        // Wait for any ongoing speech to complete
        await this.waitForSpeechComplete();

        this.aborted = false;
        this.speakingLock = true;

        try {
            const preparedText = this.prepareForSpeech(text);
            const sentencesArray = this.splitIntoSpeechChunks(preparedText);

            if (sentencesArray.length === 0) {
                this.speakingLock = false;
                return;
            }

            console.log('⚡ Streaming speech - ' + sentencesArray.length + ' chunks with prefetch');
            await this.speakChunks(sentencesArray, onProgress);

            if (onProgress) onProgress(text, true);

        } finally {
            this.speakingLock = false;
        }
    },

    /**
     * Speak with typing effect display
     */
    async speakWithDisplay(text, displayElement, onComplete = null) {
        if (!displayElement) return;

        displayElement.textContent = '';

        // Start speaking
        const speakPromise = this.speak(text, (currentSentence, isComplete) => {
            if (isComplete && onComplete) {
                onComplete();
            }
        });

        // Typing effect
        const words = text.split(' ');
        const avgWordDuration = 200; // Approximate ms per word

        for (let i = 0; i < words.length; i++) {
            displayElement.textContent = words.slice(0, i + 1).join(' ');
            await MayaUtils.sleep(avgWordDuration);
        }

        await speakPromise;
    },

    /**
     * Stop current audio playback and release lock
     */
    stop() {
        this.stopCurrentAudio({ releaseLock: true, markAborted: true });
    },

    /**
     * Toggle mute
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stop();
        }
        return this.isMuted;
    },

    /**
     * Set mute state
     */
    setMute(muted) {
        this.isMuted = muted;
        if (muted) {
            this.stop();
        }
    },

    /**
     * Fallback to browser's built-in TTS
     */
    speakFallback(text) {
        return new Promise((resolve, reject) => {
            if (!('speechSynthesis' in window)) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(this.prepareForSpeech(text));

            // Check language preference - use Hindi voice if selected
            const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
            utterance.lang = isHindi ? 'hi-IN' : 'en-US';
            utterance.rate = this.speechProfile.fallbackRate;
            utterance.pitch = this.speechProfile.fallbackPitch;

            // Try to find appropriate voice based on language
            const voices = window.speechSynthesis.getVoices();
            let preferredVoice = null;
            const femaleHints = isHindi
                ? ['female', 'veena', 'lekha', 'aditi', 'swara', 'priya', 'ananya']
                : ['female', 'samantha', 'ava', 'victoria', 'karen', 'allison', 'serena', 'zira', 'aria', 'google uk english female'];
            const maleHints = ['male', 'daniel', 'alex', 'google uk english male'];
            const hasHint = (voice, hints) => {
                const voiceName = (voice?.name || '').toLowerCase();
                return hints.some((hint) => voiceName.includes(hint));
            };

            if (isHindi) {
                // Prefer Hindi female or neutral voices so MAYA stays aligned on fallback audio.
                preferredVoice = voices.find((voice) =>
                    voice.lang.startsWith('hi') && hasHint(voice, femaleHints)
                ) || voices.find((voice) =>
                    voice.lang.startsWith('hi') && !hasHint(voice, maleHints)
                ) || voices.find((voice) => voice.lang.startsWith('hi'));
            } else {
                // Prefer English female or neutral voices and avoid known male-labelled voices.
                preferredVoice = voices.find((voice) =>
                    voice.lang.startsWith('en') && hasHint(voice, femaleHints)
                ) || voices.find((voice) =>
                    voice.lang.startsWith('en') && !hasHint(voice, maleHints)
                ) || voices.find((voice) => voice.lang.startsWith('en'));
            }

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(e);

            window.speechSynthesis.speak(utterance);
        });
    },

    /**
     * Speak with fallback to browser TTS
     */
    async speakWithFallback(text, displayElement = null, onComplete = null) {
        try {
            if (displayElement) {
                await this.speakWithDisplay(text, displayElement, onComplete);
            } else {
                await this.speak(text);
                if (onComplete) onComplete();
            }
        } catch (error) {
            console.warn('ElevenLabs failed, using browser TTS:', error);

            // Show text immediately
            if (displayElement) {
                displayElement.textContent = text;
            }

            // Try browser TTS
            try {
                await this.speakFallback(text);
            } catch (fallbackError) {
                console.error('Browser TTS also failed:', fallbackError);
            }

            if (onComplete) onComplete();
        }
    }
};

/**
 * MAYA Voice Recognition - Speech-to-Text
 */
const MayaListener = {
    recognition: null,
    isListening: false,
    isEnabled: true,
    onResult: null,
    onStart: null,
    onEnd: null,
    onError: null,
    initRetryCount: 0,
    maxRetries: 3,
    retryDelay: 1000,

    /**
     * Initialize speech recognition with retry mechanism
     */
    init() {
        return this._initWithRetry();
    },

    /**
     * Internal init with retry logic
     */
    async _initWithRetry() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported in this browser');
            return false;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();

            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.initRetryCount = 0; // Reset retry count on successful start
                console.log('🎤 Listening started');
                if (this.onStart) this.onStart();
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript && this.onResult) {
                    this.onResult(finalTranscript.trim());
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;

                // Handle specific errors with retry
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    console.warn('🎤 Microphone permission denied');
                    if (this.onError) this.onError('permission_denied');
                } else if (event.error === 'no-speech') {
                    // Normal - no speech detected, not an error
                    console.log('🎤 No speech detected');
                } else if (event.error === 'network') {
                    console.warn('🎤 Network error - will retry');
                    this._retryInit();
                } else if (event.error === 'aborted') {
                    // User or system aborted, don't retry
                    console.log('🎤 Recognition aborted');
                } else {
                    // Unknown error - try to recover
                    console.warn('🎤 Recognition error:', event.error, '- will retry');
                    this._retryInit();
                }

                if (this.onEnd) this.onEnd();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                console.log('🎤 Listening ended');
                if (this.onEnd) this.onEnd();
            };

            console.log('🎤 Speech recognition initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            return this._retryInit();
        }
    },

    /**
     * Retry initialization after delay
     */
    async _retryInit() {
        if (this.initRetryCount >= this.maxRetries) {
            console.error('🎤 Max retries reached for speech recognition init');
            if (this.onError) this.onError('max_retries');
            return false;
        }

        this.initRetryCount++;
        console.log(`🎤 Retrying speech recognition init (attempt ${this.initRetryCount}/${this.maxRetries})...`);

        // Clear existing recognition
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) { }
            this.recognition = null;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.initRetryCount));

        return this._initWithRetry();
    },

    /**
     * Start listening (only if MAYA is not speaking) with retry
     */
    start() {
        // Initialize if not done
        if (!this.recognition) {
            const initResult = this.init();
            if (!initResult) {
                console.warn('🎤 Could not initialize speech recognition');
                return false;
            }
        }

        // Don't start if MAYA is speaking
        if (MayaVoice.isPlaying) {
            console.log('🎤 Cannot listen while MAYA is speaking');
            return false;
        }

        if (!this.isEnabled) {
            console.log('🎤 Listening is disabled');
            return false;
        }

        if (this.isListening) {
            return true;
        }

        return this._startWithRetry();
    },

    /**
     * Start with retry mechanism
     */
    async _startWithRetry(retryCount = 0) {
        const maxStartRetries = 3;

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);

            if (error.message?.includes('already started')) {
                // Already running, that's fine
                return true;
            }

            if (retryCount < maxStartRetries) {
                console.log(`🎤 Retrying start (attempt ${retryCount + 1}/${maxStartRetries})...`);

                // Reinitialize and try again
                this.recognition = null;
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 500));

                return this._startWithRetry(retryCount + 1);
            }

            console.error('🎤 Failed to start after retries');
            return false;
        }
    },

    /**
     * Stop listening
     */
    stop() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore
            }
        }
        this.isListening = false;
    },

    /**
     * Temporarily disable listening (when MAYA speaks)
     */
    disable() {
        this.isEnabled = false;
        this.stop();
    },

    /**
     * Re-enable listening
     */
    enable() {
        this.isEnabled = true;
    },

    /**
     * Set language for recognition
     */
    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
        }
    }
};

// Make globally available
window.MayaVoice = MayaVoice;
window.MayaListener = MayaListener;
