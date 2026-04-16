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

    /**
     * Pre-warm TTS with a silent request to reduce first-speech latency
     */
    async preWarmTTS() {
        if (this.isInitialized) return;
        
        try {
            console.log('🔊 Pre-warming TTS for faster response...');
            // Generate a very short audio to warm up the API connection
            const warmupText = '.';
            await this.textToSpeech(warmupText);
            this.isInitialized = true;
            console.log('✅ TTS pre-warmed and ready');
        } catch (e) {
            console.warn('TTS pre-warm failed:', e.message);
        }
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
                "One moment, reading the planetary alignment.",
                "Just tracing the pattern here.",
                "Hold on, something interesting is showing up.",
                "Let me connect these dots for you.",
                "Your chart is quite layered, give me a second.",
                "I'm cross-referencing your dasha timeline.",
                "Okay, this is getting interesting.",
                "Let me check this particular angle.",
                "Almost there, just verifying one detail.",
                "There's a lot going on in your chart today.",
                "Bear with me, I want to get this right.",
                "Hmm, your planets are telling quite a story.",
                "I see multiple things lining up here.",
                "Let me read this more carefully."
            ],
            calculating: [
                "Calculating your planetary positions now.",
                "Running the numbers through your birth chart.",
                "Mapping out the house placements.",
                "Aligning the sidereal coordinates.",
                "Processing your ascendant calculations.",
                "Working through the dasha periods.",
                "Charting the planetary degrees.",
                "Computing the transit overlaps.",
                "Let me finalize these calculations.",
                "Cross-checking the birth time alignment.",
                "Factoring in your birth location now.",
                "One more step in the calculation.",
                "Almost done with the number crunching.",
                "These numbers are very specific to you.",
                "Every digit matters here."
            ],
            revealing: [
                "Now this part is important, listen carefully.",
                "Here's what your chart is really saying.",
                "I want you to pay close attention to this.",
                "This is where it gets personal.",
                "Let me share what I found in the deeper layer.",
                "Okay, this next part matters a lot.",
                "Here is the real picture forming.",
                "This is the part most people miss.",
                "I'm about to tell you something specific.",
                "Listen, this is directly from your chart.",
                "Not everyone gets to hear this level of detail.",
                "This part might surprise you.",
                "I don't say this to everyone.",
                "Pay attention, this is uniquely yours.",
                "Here comes the important part."
            ],
            love: [
                "Your Venus placement is revealing something.",
                "Let me look at your seventh house closely.",
                "Your relationship karma has a clear pattern.",
                "The heart line in your chart is quite strong.",
                "I can see how you love, and why.",
                "Your emotional blueprint is very specific.",
                "There's something about your romantic timing.",
                "I'm reading the partnership angle now."
            ],
            career: [
                "Your tenth house is showing a clear direction.",
                "Let me check your Saturn placement for career.",
                "Your professional timeline has some key markers.",
                "The wealth houses are active in your chart.",
                "I see your work pattern very clearly.",
                "Your career path has a unique signature.",
                "The money planets are aligned in an interesting way.",
                "Let me look at your professional destiny."
            ],
            year: [
                "This year's transit picture is forming.",
                "Let me read what the coming months hold.",
                "Your personal year number changes everything.",
                "The yearly forecast depends on several factors.",
                "I can see the major shifts ahead.",
                "This period carries a very specific energy.",
                "Some important dates are jumping out at me.",
                "The next few months have a clear theme."
            ],
            kundli: [
                "Your birth chart houses are taking shape.",
                "The ascendant sets the foundation for everything.",
                "Each house tells a different chapter of your life.",
                "I'm mapping out where each planet sits.",
                "Your kundli has a distinctive pattern.",
                "The lagna chart reveals so much about you.",
                "Let me align the whole picture first.",
                "Your planetary map is quite telling."
            ]
        },
        hi: {
            thinking: [
                "एक सेकंड, आपकी कुंडली में कुछ और देख रही हूँ।",
                "रुकिए, ग्रहों की position check कर रही हूँ।",
                "बस, इस pattern को trace कर रही हूँ।",
                "अभी, कुछ interesting दिख रहा है।",
                "ये dots connect करने दीजिए मुझे।",
                "आपकी कुंडली काफी गहरी है, एक पल।",
                "दशा timeline cross-check कर रही हूँ।",
                "अच्छा, ये तो काफी दिलचस्प है।",
                "एक और angle देख लेती हूँ।",
                "बस एक detail verify हो जाए।",
                "आज आपकी कुंडली में बहुत कुछ चल रहा है।",
                "मैं ठीक से देखना चाहती हूँ।",
                "आपके ग्रह काफी कुछ बता रहे हैं।",
                "कई चीजें एक साथ align हो रही हैं।",
                "इसे ध्यान से पढ़ती हूँ।"
            ],
            calculating: [
                "ग्रहों की positions calculate हो रही हैं।",
                "आपकी birth chart के numbers process कर रही हूँ।",
                "भावों की mapping चल रही है।",
                "सिडेरियल coordinates align हो रहे हैं।",
                "लग्न calculations finalize हो रही हैं।",
                "दशा periods work out कर रही हूँ।",
                "ग्रहों के degrees chart हो रहे हैं।",
                "Transit overlaps compute हो रहे हैं।",
                "बस ये calculations पूरी होने वाली हैं।",
                "जन्म समय की alignment check हो रही है।",
                "जन्म स्थान भी factor कर रही हूँ।",
                "बस एक और step बाकी है।",
                "numbers almost ready हैं।",
                "ये numbers सिर्फ़ आपके हैं।",
                "हर अंक यहाँ मायने रखता है।"
            ],
            revealing: [
                "ये हिस्सा जरूरी है, ध्यान से सुनिए।",
                "अब सुनिए, आपकी कुंडली असल में क्या कह रही है।",
                "इस बात पर ध्यान दीजिए।",
                "अब बात personal होने वाली है।",
                "जो deeper layer में मिला, वो share करती हूँ।",
                "ये अगला हिस्सा बहुत matter करता है।",
                "असली picture अब बन रही है।",
                "ये वो बात है जो ज्यादातर लोग miss करते हैं।",
                "अभी कुछ बहुत specific बताने वाली हूँ।",
                "सुनिए, ये सीधा आपकी कुंडली से बोल रही हूँ।",
                "ये detail सबको नहीं मिलती।",
                "ये हिस्सा शायद आपको surprise करे।",
                "ये बात मैं हर किसी को नहीं कहती।",
                "ध्यान दीजिए, ये सिर्फ आपके लिए है।",
                "अब important part आ रहा है।"
            ],
            love: [
                "आपका शुक्र कुछ बता रहा है।",
                "सातवें भाव को ध्यान से देखती हूँ।",
                "आपका relationship karma काफी clear है।",
                "आपकी heart line काफी strong है।",
                "मैं देख सकती हूँ आप कैसे प्यार करते हैं।",
                "आपका emotional blueprint बहुत specific है।",
                "romantic timing में कुछ खास दिख रहा है।",
                "partnership का angle पढ़ रही हूँ।"
            ],
            career: [
                "आपका दसवां भाव clear direction दे रहा है।",
                "शनि की placement career के लिए check करती हूँ।",
                "professional timeline में कुछ key markers हैं।",
                "wealth houses आपकी कुंडली में active हैं।",
                "आपका work pattern मुझे clear दिख रहा है।",
                "career path में एक unique signature है।",
                "पैसों के ग्रह interesting तरीके से बैठे हैं।",
                "professional destiny को देखती हूँ।"
            ],
            year: [
                "इस साल की transit picture बन रही है।",
                "आने वाले महीने क्या लाएंगे, देखती हूँ।",
                "personal year number सब बदल देता है।",
                "yearly forecast कई चीज़ों पर depend करता है।",
                "आगे major shifts दिख रहे हैं।",
                "इस time period की energy बहुत specific है।",
                "कुछ important dates सामने आ रही हैं।",
                "अगले कुछ महीनों का clear theme है।"
            ],
            kundli: [
                "आपकी birth chart के भाव shape ले रहे हैं।",
                "लग्न सब कुछ की foundation set करता है।",
                "हर भाव आपकी जिंदगी का अलग chapter है।",
                "हर ग्रह कहाँ बैठा है, map कर रही हूँ।",
                "आपकी कुंडली का pattern काफ़ी distinctive है।",
                "लग्न कुंडली बहुत कुछ reveal करती है।",
                "पहले पूरी picture align करने दीजिए।",
                "आपका planetary map काफ़ी कुछ कह रहा है।"
            ]
        }
    },

    // Track recent fillers to avoid repetition (ring buffer of last N indices)
    _recentFillers: [],
    _maxRecentFillers: 5,
    fillerTimeout: null,

    /**
     * Get a random filler phrase (avoids repeating any of the last N used)
     */
    getRandomFiller(type = 'thinking') {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        const lang = isHindi ? 'hi' : 'en';
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
        
        return phrases[index];
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
     * Speaks at most 1 filler while waiting. Kept to 1 to avoid random mid-flow speech.
     */
    async withFillers(asyncFn, options = {}) {
        const type = options.type || 'thinking';

        // Start the async work immediately
        let done = false;
        const resultPromise = asyncFn().finally(() => { done = true; });

        // Speak at most ONE filler to avoid sounding random
        const fillerLoop = async () => {
            if (done) return;
            const phrase = this.getRandomFiller(type);
            if (!phrase) return;
            try {
                await this.speak(phrase);
            } catch (e) { /* non-critical */ }
        };
        fillerLoop(); // fire-and-forget

        return await resultPromise;
    },

    // Audio cache for pre-generated audio
    audioCache: new Map(),
    pendingAudio: new Map(),
    preferredVoiceId: null,
    
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
        const w = text.toLowerCase();
        let result = '';
        let i = 0;
        const C = {
            'shr':'श्र','chh':'छ','ksh':'क्ष',
            'kh':'ख','gh':'घ','ch':'च','jh':'झ','th':'थ','dh':'ध','ph':'फ','bh':'भ','sh':'श',
            'pr':'प्र','kr':'क्र','gr':'ग्र','tr':'त्र','br':'ब्र','dr':'द्र','sv':'स्व','sw':'स्व','st':'स्त','sk':'स्क','sp':'स्प','sn':'स्न','sm':'स्म','ny':'न्य',
            'k':'क','g':'ग','j':'ज','t':'त','d':'द','n':'न','p':'प','b':'ब','m':'म','y':'य','r':'र','l':'ल','v':'व','w':'व','h':'ह','s':'स','f':'फ़','z':'ज़','q':'क़','x':'क्स'
        };
        const VF = {'aa':'आ','ee':'ई','oo':'ऊ','ai':'ऐ','au':'औ','a':'अ','i':'इ','u':'उ','e':'ए','o':'ओ'};
        const VM = {'aa':'ा','ee':'ी','oo':'ू','ai':'ै','au':'ौ','a':'','i':'ि','u':'ु','e':'े','o':'ो'};
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
            'numerology': 'न्यूमेरोलॉजी',
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
                    pendingAudio = this.textToSpeech(text, this.buildChunkSpeechOptions(normalizedChunks, index));
                }

                const audioBlob = await pendingAudio;

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
            return `${this.numberToWordsHi(thousands)} हज़ार${remainder ? ` ${this.numberToWordsHi(remainder)}` : ''}`;
        }
        return String(number)
            .split('')
            .map((digit) => this.numberWordsHindi[digit] || digit)
            .join(' ');
    },

    /**
     * Convert numbers in text to spoken words for better TTS
     */
    convertNumbersToWords(text) {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        
        return String(text || '').replace(/\b(\d{1,5})\b/g, (match) => {
            return isHindi ? this.numberToWordsHi(match) : this.numberToWordsEn(match);
        });
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
        }

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
        prepared = prepared.replace(/-/g, ', ');
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
        return await this.textToSpeechElevenLabs(text, options);
    },

    /**
     * ElevenLabs TTS - high quality voice synthesis with rate limiting
     */
    async textToSpeechElevenLabs(text, options = {}) {
        const isHindi = window.MayaUtils?.storage?.get('maya_language') === 'hi';
        const previousText = String(options.previousText || '').trim();
        const nextText = String(options.nextText || '').trim();
        const voiceId = this.preferredVoiceId
            || (isHindi
                ? (MAYA_CONFIG.API_KEYS.ELEVENLABS_HI_VOICE_ID || MAYA_CONFIG.API_KEYS.ELEVENLABS_VOICE_ID)
                : (MAYA_CONFIG.API_KEYS.ELEVENLABS_EN_VOICE_ID || MAYA_CONFIG.API_KEYS.ELEVENLABS_VOICE_ID));
        const url = MAYA_CONFIG.ENDPOINTS.ELEVENLABS;

        const modelId = 'eleven_v3';

        const latencyOptimization = 2;
        const voiceSettings = isHindi
            ? {
                stability: 0.45,
                similarity_boost: 0.85,
                style: 0.55,
                use_speaker_boost: true
            }
            : {
                stability: 0.42,
                similarity_boost: 0.82,
                style: 0.50,
                use_speaker_boost: true
            };

        const requestBody = {
            text,
            model_id: modelId,
            voice_settings: voiceSettings,
            optimize_streaming_latency: latencyOptimization,
            language_code: isHindi ? 'hi' : 'en'
        };

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
                    const retryDelay = this.retryBaseDelay * Math.pow(2, attempt);
                    console.warn(`⚠️ ElevenLabs rate limit hit, waiting ${retryDelay}ms before retry ${attempt + 1}/${this.maxRetries}`);
                    await MayaUtils.sleep(retryDelay);
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`ElevenLabs API error: ${response.status}`);
                }

                const audioBlob = await response.blob();
                return audioBlob;
            } catch (error) {
                lastError = error;
                console.error(`ElevenLabs TTS error (attempt ${attempt + 1}):`, error);
                
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
            } catch (e) {}
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
