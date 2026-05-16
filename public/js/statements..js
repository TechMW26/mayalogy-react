console.log('🔧 statements.js loading (AI prompt edition)...');

const MayaStatements = {
  currentLanguage: "en",

  setLanguage(lang) {
    this.currentLanguage = lang === "hi" ? "hi" : "en";
    console.log(`Language set to: ${this.currentLanguage}`);
  },

  // -------------------- BASIC UTILS --------------------
  random(arr) {
    if (!arr || arr.length === 0) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  },

  format(text, replacements) {
    let result = text || "";
    if (!replacements) return result;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), value);
    }
    return result;
  },

  // -------------------- SPEECH / TTS HELPERS --------------------
  _sanitizeName(name) {
    if (!name) return "";
    let n = String(name).trim();

    if (/^[A-Z\s]+$/.test(n)) {
      n = n
        .toLowerCase()
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ");
    }
    n = n.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    return n;
  },

  _numberToWordsEn(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return String(num);

    const special = { 11: "eleven", 22: "twenty-two", 33: "thirty-three" };
    if (special[n]) return special[n];

    const ones = ["zero","one","two","three","four","five","six","seven","eight","nine"];
    const teens = ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
    const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return o ? `${tens[t]} ${ones[o]}` : tens[t];
    }
    return String(n);
  },

  _numberToWordsHi(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return String(num);

    const map = {
      0:"ज़ीरो",1:"एक",2:"दो",3:"तीन",4:"चार",5:"पाँच",6:"छह",7:"सात",8:"आठ",9:"नौ",
      10:"दस",11:"ग्यारह",12:"बारह",13:"तेरह",14:"चौदह",15:"पंद्रह",16:"सोलह",17:"सत्रह",18:"अठारह",19:"उन्नीस",
      20:"बीस",21:"इक्कीस",22:"बाईस",23:"तेईस",24:"चौबीस",25:"पच्चीस",26:"छब्बीस",27:"सत्ताईस",28:"अट्ठाईस",29:"उनतीस",
      30:"तीस",31:"इकतीस",32:"बत्तीस",33:"तैंतीस",34:"चौंतीस",35:"पैंतीस",36:"छत्तीस",37:"सैंतीस",38:"अड़तीस",39:"उनतालीस",
      40:"चालीस",41:"इकतालीस",42:"बयालीस",43:"तैंतालीस",44:"चवालीस",45:"पैंतालीस",46:"छियालीस",47:"सैंतालीस",48:"अड़तालीस",49:"उनचास",
      50:"पचास"
    };
    if (map[n] != null) return map[n];
    return String(n);
  },

  _makeSpeechFriendly(text) {
    if (!text) return "";
    let t = String(text);

    t = t.replace(/\[\[pause-(\d+)\]\]/g, ", ");
    t = t.replace(/\s+/g, " ").trim();
    t = t.replace(/-/g, ", ").replace(/…/g, ", ");
    t = t.replace(/\s*,\s*/g, ", ");
    t = t.replace(/\s*\.\s*/g, ". ");
    t = t.replace(/\s*!\s*/g, "! ");
    t = t.replace(/\s*\?\s*/g, "? ");
    t = t.replace(/([,.!?])\s*\1+/g, "$1");
    t = t.replace(/\s*:\s*/g, ", ");
    return t.trim();
  },

  _formatForSpeech(text, replacements) {
    const lang = this.currentLanguage;
    const r = { ...(replacements || {}) };

    if (r.name) r.name = this._sanitizeName(r.name);
    if (r.firstName) r.firstName = this._sanitizeName(r.firstName);

    const numericKeys = ["number","sum","day","month","year","lifePath","destiny","soulUrge","dayReduced","monthReduced","yearSum","yearReduced","total"];
    for (const k of numericKeys) {
      if (r[k] != null && r[k] !== "") {
        r[k] = (lang === "hi") ? this._numberToWordsHi(r[k]) : this._numberToWordsEn(r[k]);
      }
    }

    return this._makeSpeechFriendly(this.format(text, r));
  },

  // -------------------- CACHING --------------------
  _cacheKey(partKey, lang, fingerprint) {
    return `maya_stmt_cache_${partKey}_${lang}_${fingerprint}`;
  },

  _fingerprint(obj) {
    // stable enough for caching without heavy hashing
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 48); }
    catch { return String(Date.now()); }
  },

  _readCache(key) {
    try { return MayaUtils?.storage?.get(key) || null; } catch { return null; }
  },

  _writeCache(key, value) {
    try { MayaUtils?.storage?.set(key, value); } catch {}
  },

  // =========================================================================
  // PROMPT DEFINITIONS (NO HARDCODED LINES)
  // =========================================================================
  prompts: {
    intro: {
      goal: "Warm welcome + credibility + personal hook + clean start",
      en: ({ name, date }, ctx) => `
You are MAYA, a wise mystical Vedic numerology + astrology guide in a voice-first app.
Write ONE spoken mini-script (3–5 sentences) to welcome ${name}.
User birth date: ${date || "(unknown)"}.
Tone: intimate, confident, not fluffy. Make it feel eerily personal without claiming certainty.
Must include 1–2 pause tokens like [[pause-250]].
Must end with a clear next step: “we start with Life Path”.
Avoid bullets. Avoid disclaimers. No medical/legal/guarantees.
`,
      hi: ({ name, date }, ctx) => `
आप MAYA हैं-एक wise Vedic numerology + astrology guide (voice-first app)।
${name} जी के लिए ONE spoken mini-script लिखिए (3–5 वाक्य)।
Birth date: ${date || "(unknown)"}।
Language: simple Hinglish देवनागरी में, user को “आप” कहिए।
Tone: warm, confident, थोड़ी mystery, पर fluffy नहीं।
1–2 pause tokens: [[pause-250]] ज़रूर।
Ending: “अब हम Life Path से शुरू करते हैं” जैसा clear next step।
Bullets नहीं। Guarantees/medical/legal नहीं।
`
    },


    fomoIntro: {
      goal: "Intense opening + FOMO + prediction bullets embedded in speech + then 'we start with Life Path'",
      en: ({ name, date, lifePath, destiny, personalYear, predictionItems }, ctx) => `
You are MAYA, a wise mystical Vedic numerology + astrology guide in a voice-first app.
Write ONE spoken opening (4–6 sentences) for ${name}. Birth date: ${date || "(unknown)"}.
Start with an intense, curiosity + FOMO inducing line (no fear-mongering, no threats).
You MUST reference their calculated numbers naturally: Life Path ${lifePath}, Destiny ${destiny}, Personal Year ${personalYear}.
Use the following prediction items (derived from chart calculations) as quick hooks inside the speech (do NOT format as bullets; weave them in as short lines):
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
Rules:
- Style must match your existing funnel tone: intimate, confident, a little mysterious, not fluffy.
- 1–2 pause tokens like [[pause-250]].
- No guarantees, no medical/legal.
End with a clear next step: “we start with Life Path”.
Return ONLY the script text.
`,
      hi: ({ name, date, lifePath, destiny, personalYear, predictionItems }, ctx) => `
आप MAYA हैं-एक wise Vedic numerology + astrology guide (voice-first app)।
${name} जी के लिए ONE opening लिखिए (4–6 वाक्य)। Birth date: ${date || "(unknown)"}।
Start: intense + curiosity + FOMO, लेकिन डराना/धमकी नहीं।
आपको उनके numbers naturally reference करने हैं: Life Path ${lifePath}, Destiny ${destiny}, Personal Year ${personalYear}।
ये prediction items (chart calculations से) speech में weave कीजिए-bullets नहीं:
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
Style: warm, confident, थोड़ी mystery, fluffy नहीं। 1–2 [[pause-250]]।
Guarantees/medical/legal नहीं।
Ending: “अब हम Life Path से शुरू करते हैं” जैसा clear next step।
Return ONLY the script text।
`
    },

    lifePathExplanation: {
      goal: "Explain Life Path result with explicit reductions + meaning hint",
      en: ({ name, date, day, month, year, dayReduced, monthReduced, yearSum, yearReduced, total, number }, ctx) => `
You are MAYA in a voice-first app. Write ONE short spoken script (4–6 sentences).
User: ${name}. Birth date: ${date}.
Show the explicit math reductions clearly in speech:
Day ${day} reduces to ${dayReduced}. Month ${month} reduces to ${monthReduced}. Year ${year} sums to ${yearSum} and reduces to ${yearReduced}.
Then total ${dayReduced} + ${monthReduced} + ${yearReduced} = ${total}, which reduces to Life Path ${number}.
After the math, add 2 sentences of meaning that feels specific: a pattern under pressure + a growth direction.
Include 1–2 [[pause-250]].
No bullets.
`,
      hi: ({ name, date, day, month, year, dayReduced, monthReduced, yearSum, yearReduced, total, number }, ctx) => `
आप MAYA हैं (voice-first)।
${name} जी के लिए ONE spoken script लिखिए (4–6 वाक्य)।
Birth date: ${date}।
Math spoken रूप में clear रखिए:
Day ${day} → ${dayReduced}, Month ${month} → ${monthReduced}, Year ${year} का sum ${yearSum} और reduce ${yearReduced}।
फिर ${dayReduced} + ${monthReduced} + ${yearReduced} = ${total} और Life Path ${number}।
इसके बाद 2 वाक्य meaning: pressure में उनका pattern + growth direction।
1–2 [[pause-250]]।
Bullets नहीं। “आप” का use।
`
    },

    destinyExplanation: {
      goal: "Destiny number from name sum, external vibe + opportunity lane",
      en: ({ name, sum, number }, ctx) => `
You are MAYA. Write ONE spoken script (3–5 sentences).
Explain Destiny from name ${name}: total vibration ${sum}, reduces to Destiny ${number}.
Add 2 lines: how people read them + what opportunities they attract.
Include [[pause-250]] once.
No bullets. No guarantees.
`,
      hi: ({ name, sum, number }, ctx) => `
आप MAYA हैं। ONE spoken script लिखिए (3–5 वाक्य)।
नाम ${name} का total ${sum} और reduce होकर Destiny ${number}।
2 lines: लोग आपको कैसे read करते हैं + कौन से opportunities attract होती हैं।
[[pause-250]] एक बार।
देवनागरी Hinglish, “आप”।
`
    },

    soulUrgeExplanation: {
      goal: "Inner craving + emotional driver + discomfort trigger",
      en: ({ name, sum, number }, ctx) => `
You are MAYA. Write ONE spoken script (3–5 sentences).
Explain Soul Urge: vowels total ${sum}, reduces to ${number}.
Add 2 lines: what they crave privately + what makes them restless.
Include [[pause-250]] once.
No bullets.
`,
      hi: ({ name, sum, number }, ctx) => `
आप MAYA हैं। ONE spoken script (3–5 वाक्य)।
Soul Urge: vowels का total ${sum}, reduce ${number}।
2 lines: आपकी private craving + किस वजह से restlessness आती है।
[[pause-250]] एक बार। “आप”।
`
    },


    loveReading: {
      goal: "Love/relationship reading based on Life Path + Soul Urge (flowing, specific, no fluff)",
      en: ({ name, lifePath, soulUrge }, ctx) => `
You are MAYA. Write ONE spoken love/relationship reading (4–6 sentences) for ${name}.
Inputs: Life Path ${lifePath}, Soul Urge ${soulUrge}.
Make it feel specific: a repeating relationship pattern + what triggers it + one growth shift.
Tone: intimate, confident, a little mysterious, not cheesy.
Include 1–2 [[pause-250]].
No bullets. No threats. No guarantees.
`,
      hi: ({ name, lifePath, soulUrge }, ctx) => `
आप MAYA हैं। ${name} जी के लिए love/relationship reading लिखिए (4–6 वाक्य)।
Inputs: Life Path ${lifePath}, Soul Urge ${soulUrge}।
एक repeating pattern + उसका trigger + एक growth shift बताइए।
Tone: intimate, confident, थोड़ी mystery, cheesy नहीं।
1–2 [[pause-250]]। Bullets नहीं। डराना/guarantee नहीं।
`
    },

    careerReading: {
      goal: "Career/wealth reading based on Destiny + Life Path, practical lane + shadow + next step",
      en: ({ name, destiny, lifePath }, ctx) => `
You are MAYA. Write ONE spoken career/wealth reading (4–6 sentences) for ${name}.
Inputs: Destiny ${destiny}, Life Path ${lifePath}.
Give: best lane (type of work/role), one money pattern, one caution (shadow), and one next step for the next 30–60 days.
Include 1–2 [[pause-250]].
No bullets. No financial guarantees.
`,
      hi: ({ name, destiny, lifePath }, ctx) => `
आप MAYA हैं। ${name} जी के लिए career/wealth reading लिखिए (4–6 वाक्य)।
Inputs: Destiny ${destiny}, Life Path ${lifePath}।
Best lane (work/role), एक money pattern, एक caution, और next 30–60 days का एक next step दीजिए।
1–2 [[pause-250]]। Bullets नहीं। Financial guarantee नहीं।
`
    },

    yearReading: {
      goal: "Personal Year reading based on personalYear + predictionItems from month chart",
      en: ({ name, personalYear, predictionItems }, ctx) => `
You are MAYA. Write ONE spoken timing reading (4–6 sentences) for ${name}.
They are in Personal Year ${personalYear}.
Use these chart-derived hooks inside the speech (no bullets): 
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
Give: what the year is teaching, what to lean into, and one avoid.
Include 1–2 [[pause-250]]. No guarantees.
`,
      hi: ({ name, personalYear, predictionItems }, ctx) => `
आप MAYA हैं। ${name} जी के लिए timing reading लिखिए (4–6 वाक्य)।
Personal Year ${personalYear}।
ये chart hooks speech में weave कीजिए (bullets नहीं):
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
Year का lesson, किस चीज़ में lean in करना है, और एक avoid बताइए।
1–2 [[pause-250]]। Guarantee नहीं।
`
    },

    warningReading: {
      goal: "Personalized warning based on Life Path + current cycle; ethical urgency",
      en: ({ name, lifePath, personalYear }, ctx) => `
You are MAYA. Write ONE spoken warning (3–5 sentences) for ${name}.
Use Life Path ${lifePath} and Personal Year ${personalYear} as context.
Give one specific caution pattern and one simple protective action.
Ethical urgency only. No fear-mongering. Include [[pause-250]] once.
`,
      hi: ({ name, lifePath, personalYear }, ctx) => `
आप MAYA हैं। ${name} जी के लिए ONE warning लिखिए (3–5 वाक्य)।
Life Path ${lifePath} और Personal Year ${personalYear} context है।
एक specific caution pattern + एक simple protective action।
Ethical urgency, डराना नहीं। [[pause-250]] एक बार।
`
    },

    deepRevealPrep: {
      goal: "Before deep reveal: prepare user, set consent tone, ask if ready",
      en: ({ name }, ctx) => `
You are MAYA. Write ONE spoken prep statement (3–5 sentences) for ${name} before a deep reveal.
It should feel intense and personal but respectful. Mention that some insights may feel uncomfortable because they are true patterns.
End with a clear consent question: “Are you ready?” Include 1–2 [[pause-250]]. No threats.
`,
      hi: ({ name }, ctx) => `
आप MAYA हैं। ${name} जी के लिए deep reveal से पहले ONE prep statement लिखिए (3–5 वाक्य)।
Tone intense + personal, लेकिन respectful। बोलिए कि कुछ insights uncomfortable लग सकते हैं क्योंकि वो patterns को touch करते हैं।
Ending: “क्या आप ready हैं?” जैसा clear consent question। 1–2 [[pause-250]]। धमकी नहीं।
`
    },

    completionOutro: {
      goal: "Warm ending: map not fate, invite questions",
      en: ({ name }, ctx) => `
You are MAYA. Write ONE closing statement (3–5 sentences) for ${name}.
Say: numbers are a map, not fate; choice is theirs; invite them to ask any question now.
Include [[pause-250]] once. No fluff.
`,
      hi: ({ name }, ctx) => `
आप MAYA हैं। ${name} जी के लिए closing statement लिखिए (3–5 वाक्य)।
बोलिए: numbers map हैं, fate नहीं; choice आपकी; अब कोई भी सवाल पूछिए।
[[pause-250]] एक बार। Fluffy नहीं।
`
    },

        teaser: {
      goal: "High curiosity + time-boxed window + chart hooks + ethical urgency",
      en: ({ name, lifePath, destiny, personalYear, predictionItems }, ctx) => `
You are MAYA. Create ONE conversion teaser (3–5 sentences) for ${name}.
Context numbers: Life Path ${lifePath}, Destiny ${destiny}, Personal Year ${personalYear}.
Weave in 1–2 chart-derived hooks (no bullets) from:
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
Mention a near-term “timing window” (next 14–30 days) WITHOUT exact dates.
Create urgency ethically: “if you miss it, the lesson repeats” style, but do NOT threaten harm.
End by saying the private report has exact windows + steps.
Include 1–2 [[pause-250]]. No bullets.
`,
      hi: ({ name, lifePath, destiny, personalYear, predictionItems }, ctx) => `
आप MAYA हैं। ${name} जी के लिए ONE conversion teaser (3–5 वाक्य)।
Context: Life Path ${lifePath}, Destiny ${destiny}, Personal Year ${personalYear}।
इन chart hooks में से 1–2 को speech में weave कीजिए (bullets नहीं):
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
next 14–30 days की timing window बोलिए (exact dates नहीं)।
Urgency ethically: “miss हुआ तो pattern repeat” - पर धमकी/डराना नहीं।
End: private report में exact windows + steps होंगे।
1–2 [[pause-250]]। देवनागरी Hinglish, “आप”।
`
    },

        emailGate: {
      goal: "Explain value of private file + include prediction items + ask email cleanly",
      en: ({ name, predictionItems }, ctx) => `
You are MAYA. Write ONE email gate transition (3–4 sentences) for ${name}.
Must include:
- What they get: next 12 months snapshot, strong/risky windows, and clear do/avoid steps.
- Mention 1–2 hooks from these chart items (no bullets):
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
- Privacy framing (kept private, saved).
- End with a direct email ask.
Include [[pause-250]] once. No bullets.
`,
      hi: ({ name, predictionItems }, ctx) => `
आप MAYA हैं। ${name} जी के लिए ONE email gate script (3–4 वाक्य)।
Include:
- next 12 months snapshot, strong/risky windows, do/avoid steps।
- इन chart items में से 1–2 hooks speech में weave कीजिए (bullets नहीं):
${(predictionItems || []).map((x)=>`- ${x}`).join("\n")}
- privacy: private + secure।
- End: व्हाट्सऐप नंबर माँगिए और कहिए कि ओटीपी आने में कुछ सेकंड लग सकते हैं।
[[pause-250]] एक बार। देवनागरी Hinglish, “आप”।
`
    },

    // Auth prompts (replace hardcoded auth lines if you want)
    authCheck: {
      goal: "Checking if user exists",
      en: ({ name }, ctx) => `
You are MAYA. Write ONE short spoken line while checking records for ${name}.
1 sentence + optional [[pause-250]]. No jokes about hacking. Warm + mystical.
`,
      hi: ({ name }, ctx) => `
आप MAYA हैं। ${name} जी के लिए records check करते हुए ONE short line।
1 sentence + optional [[pause-250]]। देवनागरी Hinglish, “आप”।
`
    },

        authWelcomeBack: {
      goal: "Returning user welcome + WhatsApp OTP continuation",
      en: ({ name }, ctx) => `
You are MAYA. Write ONE spoken script (2–3 sentences) for returning user ${name}.
    Warm recognition + saved reading mention + continue through WhatsApp OTP if verification is needed. Never mention email or password.
Include [[pause-250]] once.
`,
      hi: ({ name }, ctx) => `
आप MAYA हैं। returning user ${name} जी के लिए 2–3 वाक्य।
    Warm recognition + saved reading mention + ज़रूरत हो तो WhatsApp OTP से continue करने की बात। Email या password का ज़िक्र कभी न करें।
[[pause-250]] एक बार। “आप”।
`
    },

    authNewUser: {
      goal: "New user registration + WhatsApp OTP setup",
      en: ({ name }, ctx) => `
You are MAYA. Write ONE spoken script (2–3 sentences) for new user ${name}.
    Explain WhatsApp OTP secures their reading + keeps it private. End with a clear ask to verify with WhatsApp OTP. Never mention email or password.
Include [[pause-250]] once.
`,
      hi: ({ name }, ctx) => `
आप MAYA हैं। new user ${name} जी के लिए 2–3 वाक्य।
    WhatsApp OTP से reading secure + private रहती है। End: WhatsApp OTP से verify करने को कहिए। Email या password का ज़िक्र कभी न करें।
[[pause-250]] एक बार। “आप”।
`    },

    // =========================================================================
    // QUICK MEANING PROMPTS (for Life Path / Destiny / Soul Urge meanings)
    // =========================================================================
    lifePathMeaningQuick: {
      goal: "Short 1-2 sentence spoken meaning for Life Path number, personal, no guarantees",
      en: ({ name, number }, ctx) => `
You are MAYA, mystical numerologist. Write ONE short spoken meaning (1–2 sentences) for Life Path ${number}.
User: ${name}.
Tone: intimate, specific to this number's energy, slightly edgy.
Rules:
- Must feel personal to ${name}
- Include exactly ONE [[pause-250]] token
- Do NOT claim certainty or guarantee outcomes
- Do NOT use bullets
- TTS-safe (no special chars except [[pause-250]])
- Focus on: core energy, natural tendency, subtle challenge
`,
      hi: ({ name, number }, ctx) => `
आप MAYA हैं। Life Path ${number} के लिए ONE short spoken meaning (1–2 वाक्य)।
User: ${name} जी।
Language: simple Hinglish देवनागरी में।
Rules:
- ${name} जी को personal feel हो
- एक [[pause-250]] token
- certainty/guarantee नहीं claim करना
- bullets नहीं
- "आप" use करना, "तुम" नहीं
- Focus: core energy, natural tendency, subtle challenge
`
    },

    destinyMeaningQuick: {
      goal: "Short 1-2 sentence spoken meaning for Destiny number, personal, no guarantees",
      en: ({ name, number }, ctx) => `
You are MAYA, mystical numerologist. Write ONE short spoken meaning (1–2 sentences) for Destiny Number ${number}.
User: ${name}.
Tone: purposeful, slightly urgent, reveals life mission hint.
Rules:
- Must feel personal to ${name}
- Include exactly ONE [[pause-250]] token
- Do NOT claim certainty or guarantee outcomes
- Do NOT use bullets
- TTS-safe
- Focus on: life purpose direction, how world sees them, opportunity pattern
`,
      hi: ({ name, number }, ctx) => `
आप MAYA हैं। Destiny Number ${number} के लिए ONE short spoken meaning (1–2 वाक्य)।
User: ${name} जी।
Language: simple Hinglish देवनागरी में।
Rules:
- ${name} जी को personal feel हो
- एक [[pause-250]] token
- certainty/guarantee नहीं
- bullets नहीं, "आप" use
- Focus: life purpose, लोग कैसे देखते हैं, opportunity pattern
`
    },

    soulUrgeMeaningQuick: {
      goal: "Short 1-2 sentence spoken meaning for Soul Urge number, personal, no guarantees",
      en: ({ name, number }, ctx) => `
You are MAYA, mystical numerologist. Write ONE short spoken meaning (1–2 sentences) for Soul Urge ${number}.
User: ${name}.
Tone: intimate, slightly vulnerable, touches hidden desires.
Rules:
- Must feel personal to ${name}
- Include exactly ONE [[pause-250]] token
- Do NOT claim certainty or guarantee outcomes
- Do NOT use bullets
- TTS-safe
- Focus on: deepest private craving, what makes them restless, emotional driver
`,
      hi: ({ name, number }, ctx) => `
आप MAYA हैं। Soul Urge ${number} के लिए ONE short spoken meaning (1–2 वाक्य)।
User: ${name} जी।
Language: simple Hinglish देवनागरी में।
Rules:
- ${name} जी को personal feel हो
- एक [[pause-250]] token
- certainty/guarantee नहीं
- bullets नहीं, "आप" use
- Focus: deepest private craving, restlessness का कारण, emotional driver
`    },

    // =========================================================================
    // WARM WELCOME PROMPT (goosebump-inducing personal opening)
    // =========================================================================
    warmWelcome: {
      goal: "Create a deeply personal, goosebump-inducing welcome based on Life Path that feels eerily accurate",
      en: ({ name, lifePath, birthDay, birthMonth }, ctx) => `
You are MAYA, a mystical Vedic numerology guide in a voice-first app. Write ONE warm welcome (4-6 sentences) for ${name}.

Their Life Path is ${lifePath}. Birth day: ${birthDay}, month: ${birthMonth}.

Tone: intimate, slightly intense, eerily personal - like you can see into their soul.

Rules:
- Start with their name naturally
- Reference a SPECIFIC feeling or pattern they've likely experienced based on Life Path ${lifePath}
- Touch on something they haven't told anyone (based on number energy)
- Include exactly ONE [[pause-250]] token for dramatic effect
- End with validation or a hint that change is coming
- Do NOT claim certainty or make guarantees
- Do NOT use bullets or lists
- TTS-safe (will be spoken aloud)
- Sound like a wise spiritual mentor, not a fortune teller

Life Path ${lifePath} energy hints:
${lifePath === 1 ? '- Leadership loneliness, feeling different, waiting for permission' : ''}
${lifePath === 2 ? '- Deep sensitivity, past betrayal, building walls around heart' : ''}
${lifePath === 3 ? '- Suppressed creativity, someone told them to be practical, hidden voice' : ''}
${lifePath === 4 ? '- Carrying others weight, exhaustion, sacrificed own dreams' : ''}
${lifePath === 5 ? '- Feeling trapped, restlessness, torn between stability and freedom' : ''}
${lifePath === 6 ? '- Over-giving, someone taking too much, tired heart' : ''}
${lifePath === 7 ? '- Overthinking at night, spiritual hunger, searching for unnamed thing' : ''}
${lifePath === 8 ? '- Complicated money relationship, taught wanting is wrong, blocked success' : ''}
${lifePath === 9 ? '- Old soul, unexplained loss, purpose bigger than self' : ''}
${lifePath === 11 ? '- Intuitive knowing, dismissed as too sensitive, picking up frequencies' : ''}
${lifePath === 22 ? '- Big visions, frustrated by reality gap, master builder energy' : ''}
${lifePath === 33 ? '- Healer burden, absorbing others pain, empty cup syndrome' : ''}
`,
      hi: ({ name, lifePath, birthDay, birthMonth }, ctx) => `
आप MAYA हैं, एक mystical Vedic numerology guide (voice-first app)। ${name} जी के लिए ONE warm welcome (4-6 वाक्य) लिखिए।

उनका Life Path ${lifePath} है। Birth day: ${birthDay}, month: ${birthMonth}।

Tone: intimate, थोड़ा intense, eerily personal - जैसे आप उनकी soul में देख सकते हैं।

Rules:
- उनका नाम naturally use करें
- Life Path ${lifePath} के basis पर SPECIFIC feeling या pattern mention करें
- कुछ ऐसा touch करें जो उन्होंने किसी को नहीं बताया (number energy के basis पर)
- एक [[pause-250]] token dramatic effect के लिए
- End: validation या hint कि बदलाव आ रहा है
- certainty या guarantees नहीं claim करना
- bullets या lists नहीं
- TTS-safe (बोला जाएगा)
- "आप" use करना, "तुम" नहीं
- Wise spiritual mentor जैसा sound करना, fortune teller नहीं

Life Path ${lifePath} energy hints:
${lifePath === 1 ? '- Leadership अकेलापन, खुद को अलग feel करना, permission का wait' : ''}
${lifePath === 2 ? '- Deep sensitivity, past betrayal, दिल के around walls' : ''}
${lifePath === 3 ? '- Suppressed creativity, practical बनने को कहा गया, hidden voice' : ''}
${lifePath === 4 ? '- दूसरों का बोझ उठाना, थकान, अपने सपने sacrifice किए' : ''}
${lifePath === 5 ? '- Trapped feel, restlessness, stability और freedom के बीच' : ''}
${lifePath === 6 ? '- Over-giving, कोई बहुत ज़्यादा ले रहा, थका दिल' : ''}
${lifePath === 7 ? '- रात को overthinking, spiritual भूख, unnamed चीज़ ढूंढना' : ''}
${lifePath === 8 ? '- Complicated money relationship, चाहना गलत सिखाया, blocked success' : ''}
${lifePath === 9 ? '- Old soul, unexplained loss, खुद से बड़ा purpose' : ''}
${lifePath === 11 ? '- Intuitive knowing, too sensitive बोला गया, frequencies pick करना' : ''}
${lifePath === 22 ? '- Big visions, reality gap से frustrated, master builder energy' : ''}
${lifePath === 33 ? '- Healer burden, दूसरों का pain absorb करना, empty cup' : ''}
`
    }
  },

  // =========================================================================
  // CORE GENERATOR
  // =========================================================================
  async generate(partKey, replacements = {}, context = {}, { variants = 1, useCache = true } = {}) {
    const lang = this.currentLanguage;
    const def = this.prompts[partKey];
    if (!def) return "";

    // cache by (partKey + lang + replacements + context)
    const fingerprint = this._fingerprint({ replacements, context });
    const cacheKey = this._cacheKey(partKey, lang, fingerprint);

    if (useCache) {
      const cached = this._readCache(cacheKey);
      if (cached) {
        const arr = Array.isArray(cached) ? cached : [cached];
        return this._formatForSpeech(this.random(arr), replacements);
      }
    }

    // Build prompt
    const prompt = (lang === "hi" ? def.hi : def.en)(replacements, context);

    // Ask model for N variants in one go (still not “hardcoded statements”)
    const finalPrompt =
      variants > 1
        ? `${prompt}\nReturn ${variants} different options. Output ONLY a JSON array of strings.`
        : `${prompt}\nReturn ONLY the script text.`;

    let raw = "";
    if (window.MayaDynamicContent?.generate) {
      // Use your existing dynamic AI system
      raw = await MayaDynamicContent.generate(
        `statements_${partKey}`,
        {},
        { userData: context.userData || {}, language: lang, prompt: finalPrompt, meta: { partKey } }
      );
    } else if (window.MayaAI?.sendMessage) {
      // Fallback to your AI transport if exposed
      raw = await MayaAI.sendMessage(finalPrompt);
    }

    if (!raw) {
      // Minimal non-manipulative fallback (keeps app flowing)
      const fallback = lang === "hi"
        ? `${replacements.name || "आप"} जी, [[pause-250]] चलिए step by step आगे बढ़ते हैं।`
        : `${replacements.name || "You"}, [[pause-250]] let’s go step by step.`;
      return this._formatForSpeech(fallback, replacements);
    }

    // Parse variants if JSON array
    let options = null;
    if (variants > 1) {
      try {
        options = JSON.parse(raw);
        if (!Array.isArray(options)) options = [String(raw)];
      } catch {
        options = [String(raw)];
      }
    } else {
      options = [String(raw)];
    }

    // store cache
    this._writeCache(cacheKey, options);

    return this._formatForSpeech(this.random(options), replacements);
  },

  // =========================================================================
  // PUBLIC API (same outward signatures)
  // =========================================================================
  async getIntro(name, date, context = {}) {
    return this.generate("intro", { name, date }, context, { variants: 3 });
  },

  async getFomoIntro(name, date, lifePath, destiny, personalYear, predictionItems = [], context = {}) {
    return this.generate("fomoIntro", { name, date, lifePath, destiny, personalYear, predictionItems }, context, { variants: 3 });
  },

  async getLifePathExplanation(day, month, year, dayReduced, monthReduced, yearSum, yearReduced, total, lifePath, name, date, context = {}) {
    return this.generate(
      "lifePathExplanation",
      { day, month, year, dayReduced, monthReduced, yearSum, yearReduced, total, number: lifePath, name, date },
      context,
      { variants: 3 }
    );
  },

  async getDestinyExplanation(sum, destiny, name, context = {}) {
    return this.generate("destinyExplanation", { sum, number: destiny, name }, context, { variants: 3 });
  },

  async getSoulUrgeExplanation(sum, soulUrge, name, context = {}) {
    return this.generate("soulUrgeExplanation", { sum, number: soulUrge, name }, context, { variants: 3 });
  },

  async getLoveReadingAI(lifePath, soulUrge, firstName, context = {}) {
    return this.generate("loveReading", { name: firstName, lifePath, soulUrge }, context, { variants: 3 });
  },

  async getCareerReadingAI(destiny, lifePath, firstName, context = {}) {
    return this.generate("careerReading", { name: firstName, destiny, lifePath }, context, { variants: 3 });
  },

  async getYearReadingAI(personalYear, predictionItems, firstName, context = {}) {
    return this.generate("yearReading", { name: firstName, personalYear, predictionItems }, context, { variants: 3 });
  },

  async getWarningReadingAI(lifePath, personalYear, firstName, context = {}) {
    return this.generate("warningReading", { name: firstName, lifePath, personalYear }, context, { variants: 3 });
  },

  async getDeepRevealPrep(firstName, context = {}) {
    return this.generate("deepRevealPrep", { name: firstName }, context, { variants: 3 });
  },

  async getCompletionOutro(firstName, context = {}) {
    return this.generate("completionOutro", { name: firstName }, context, { variants: 3 });
  },

  async getTeaserHook(firstName, { lifePath, destiny, personalYear, predictionItems } = {}, context = {}) {
    return this.generate("teaser", { name: firstName, lifePath, destiny, personalYear, predictionItems }, context, { variants: 3 });
  },

  async getEmailGateTransition(firstName, predictionItems = [], context = {}) {
    return this.generate("emailGate", { name: firstName, predictionItems }, context, { variants: 3 });
  },

  async getAuthCheckStatement(firstName, context = {}) {
    return this.generate("authCheck", { name: firstName }, context, { variants: 3 });
  },

  async getWelcomeBackStatement(firstName, context = {}) {
    return this.generate("authWelcomeBack", { name: firstName }, context, { variants: 3 });
  },

  async getNewUserStatement(firstName, context = {}) {
    return this.generate("authNewUser", { name: firstName }, context, { variants: 3 });
  },

  // =========================================================================
  // QUICK MEANING AI METHODS (replace hardcoded dictionaries)
  // =========================================================================
  
  /**
   * Get AI-generated Life Path meaning (short, 1-2 sentences)
   * @param {number} number - Life Path number
   * @param {string} name - User's first name
   * @param {object} userData - Additional user context
   * @returns {Promise<string>} TTS-ready spoken meaning
   */
  async getLifePathMeaningAI(number, name, userData = {}) {
    try {
      const result = await this.generate(
        "lifePathMeaningQuick",
        { name: this._sanitizeName(name), number },
        { userData },
        { variants: 1, useCache: true }
      );
      if (result && result.length > 15) return result;
    } catch (e) {
      console.warn('AI Life Path meaning failed:', e.message);
    }
    // Minimal fallback (1 line only)
    const isHindi = this.currentLanguage === 'hi';
    return isHindi
      ? `${name} जी, [[pause-250]] Life Path ${number} आपकी core energy को define करता है।`
      : `${name}, [[pause-250]] Life Path ${number} defines your core energy.`;
  },

  /**
   * Get AI-generated Destiny meaning (short, 1-2 sentences)
   * @param {number} number - Destiny number
   * @param {string} name - User's first name
   * @param {object} userData - Additional user context
   * @returns {Promise<string>} TTS-ready spoken meaning
   */
  async getDestinyMeaningAI(number, name, userData = {}) {
    try {
      const result = await this.generate(
        "destinyMeaningQuick",
        { name: this._sanitizeName(name), number },
        { userData },
        { variants: 1, useCache: true }
      );
      if (result && result.length > 15) return result;
    } catch (e) {
      console.warn('AI Destiny meaning failed:', e.message);
    }
    // Minimal fallback (1 line only)
    const isHindi = this.currentLanguage === 'hi';
    return isHindi
      ? `${name} जी, [[pause-250]] Destiny ${number} आपके life mission की direction दिखाता है।`
      : `${name}, [[pause-250]] Destiny ${number} points toward your life mission.`;
  },

  /**
   * Get AI-generated Soul Urge meaning (short, 1-2 sentences)
   * @param {number} number - Soul Urge number
   * @param {string} name - User's first name
   * @param {object} userData - Additional user context
   * @returns {Promise<string>} TTS-ready spoken meaning
   */
  async getSoulUrgeMeaningAI(number, name, userData = {}) {
    try {
      const result = await this.generate(
        "soulUrgeMeaningQuick",
        { name: this._sanitizeName(name), number },
        { userData },
        { variants: 1, useCache: true }
      );
      if (result && result.length > 15) return result;
    } catch (e) {
      console.warn('AI Soul Urge meaning failed:', e.message);
    }
    // Minimal fallback (1 line only)
    const isHindi = this.currentLanguage === 'hi';
    return isHindi
      ? `${name} जी, [[pause-250]] Soul Urge ${number} आपकी सबसे गहरी cravings reveal करता है।`
      : `${name}, [[pause-250]] Soul Urge ${number} reveals your deepest cravings.`;
  },

  /**
   * Generic quick meaning wrapper
   * @param {string} type - 'lifePath', 'destiny', or 'soulUrge'
   * @param {number} number - The numerology number
   * @param {string} name - User's first name
   * @param {object} userData - Additional user context
   * @returns {Promise<string>} TTS-ready spoken meaning
   */
  async getQuickMeaning(type, number, name, userData = {}) {
    switch (type) {
      case 'lifePath':
        return this.getLifePathMeaningAI(number, name, userData);
      case 'destiny':
        return this.getDestinyMeaningAI(number, name, userData);
      case 'soulUrge':
        return this.getSoulUrgeMeaningAI(number, name, userData);
      default:
        console.warn(`Unknown quick meaning type: ${type}`);
        return '';
    }
  },

  /**
   * Get AI-generated warm welcome (goosebump-inducing personal opening)
   * @param {string} name - User's first name
   * @param {number} lifePath - Life Path number
   * @param {number} birthDay - Day of birth
   * @param {number} birthMonth - Month of birth
   * @param {object} userData - Additional user context
   * @returns {Promise<string>} TTS-ready warm welcome
   */
  async getWarmWelcomeAI(name, lifePath, birthDay, birthMonth, userData = {}) {
    try {
      const result = await this.generate(
        "warmWelcome",
        { name: this._sanitizeName(name), lifePath, birthDay, birthMonth },
        { userData },
        { variants: 1, useCache: true }
      );
      if (result && result.length > 30) return result;
    } catch (e) {
      console.warn('AI warm welcome failed:', e.message);
    }
    // Minimal fallback (1 line only)
    const isHindi = this.currentLanguage === 'hi';
    return isHindi
      ? `${name} जी, [[pause-250]] आपका यहाँ आना कोई coincidence नहीं है। चलिए आपके numbers की journey शुरू करते हैं।`
      : `${name}, [[pause-250]] your being here is no coincidence. Let's begin your numbers journey.`;
  }
};

// expose globally
window.MayaStatements = MayaStatements;