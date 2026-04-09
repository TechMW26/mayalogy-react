/**
 * MAYA - Numerology Calculator
 * Pythagorean Numerology System - World-Class Implementation
 */

const MayaNumerology = {
    /**
     * Get Pythagorean value for a letter
     */
    getLetterValue(letter) {
        const upper = letter.toUpperCase();
        return MAYA_CONFIG.NUMEROLOGY.PYTHAGOREAN_VALUES[upper] || 0;
    },

    /**
     * Check if a letter is a vowel
     */
    isVowel(letter) {
        return MAYA_CONFIG.NUMEROLOGY.VOWELS.includes(letter.toUpperCase());
    },

    /**
     * Reduce a number to a single digit (or master number)
     */
    reduceNumber(num, keepMaster = true) {
        if (keepMaster && MAYA_CONFIG.NUMEROLOGY.MASTER_NUMBERS.includes(num)) {
            return num;
        }
        
        while (num > 9 && (!keepMaster || !MAYA_CONFIG.NUMEROLOGY.MASTER_NUMBERS.includes(num))) {
            num = String(num).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
        }
        
        return num;
    },

    /**
     * Calculate Life Path Number from birth date
     */
    calculateLifePath(birthDate) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return 1;
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const reducedDay = this.reduceNumber(day, false);
        const reducedMonth = this.reduceNumber(month, false);
        const reducedYear = this.reduceNumber(year, false);
        
        const sum = reducedDay + reducedMonth + reducedYear;
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Destiny/Expression Number from full name
     */
    calculateDestinyNumber(fullName) {
        const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '');
        let sum = 0;
        
        for (const letter of letters) {
            sum += this.getLetterValue(letter);
        }
        
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Soul Urge/Heart's Desire Number (from vowels)
     */
    calculateSoulUrge(fullName) {
        const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '');
        let sum = 0;
        
        for (const letter of letters) {
            if (this.isVowel(letter)) {
                sum += this.getLetterValue(letter);
            }
        }
        
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Personality Number (from consonants)
     */
    calculatePersonalityNumber(fullName) {
        const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '');
        let sum = 0;
        
        for (const letter of letters) {
            if (!this.isVowel(letter)) {
                sum += this.getLetterValue(letter);
            }
        }
        
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Birthday Number
     */
    calculateBirthdayNumber(birthDate) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return 1;
        const day = date.getDate();
        return this.reduceNumber(day);
    },

    /**
     * Calculate Personal Year Number
     */
    calculatePersonalYear(birthDate, year = new Date().getFullYear()) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return 1;
        const day = date.getDate();
        const month = date.getMonth() + 1;
        
        const sum = this.reduceNumber(day, false) + 
                    this.reduceNumber(month, false) + 
                    this.reduceNumber(year, false);
        
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Personal Month Number
     */
    calculatePersonalMonth(birthDate, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
        const personalYear = this.calculatePersonalYear(birthDate, year);
        const sum = personalYear + this.reduceNumber(month, false);
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Personal Day Number
     */
    calculatePersonalDay(birthDate, date = new Date()) {
        const personalMonth = this.calculatePersonalMonth(birthDate, date.getMonth() + 1, date.getFullYear());
        const sum = personalMonth + this.reduceNumber(date.getDate(), false);
        return this.reduceNumber(sum);
    },

    /**
     * Calculate Maturity Number (Life Path + Destiny)
     */
    calculateMaturityNumber(fullName, birthDate) {
        const lifePath = this.calculateLifePath(birthDate);
        const destiny = this.calculateDestinyNumber(fullName);
        return this.reduceNumber(lifePath + destiny);
    },

    /**
     * Calculate Balance Number (from initials)
     */
    calculateBalanceNumber(fullName) {
        const names = fullName.trim().split(/\s+/);
        let sum = 0;
        for (const name of names) {
            if (name.length > 0) {
                sum += this.getLetterValue(name[0]);
            }
        }
        return this.reduceNumber(sum);
    },

    /**
     * Check for Karmic Debt Numbers (13, 14, 16, 19)
     */
    getKarmicDebtNumbers(fullName, birthDate) {
        const karmicDebts = [];
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return karmicDebts;
        
        // Check Life Path for Karmic Debt
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const lifePathSum = this.reduceNumber(day, false) + this.reduceNumber(month, false) + this.reduceNumber(year, false);
        
        if ([13, 14, 16, 19].includes(lifePathSum)) {
            karmicDebts.push({ number: lifePathSum, type: 'Life Path' });
        }
        
        // Check Birthday for Karmic Debt
        if ([13, 14, 16, 19].includes(day)) {
            karmicDebts.push({ number: day, type: 'Birthday' });
        }
        
        // Check Destiny Number
        const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '');
        let destinySum = 0;
        for (const letter of letters) {
            destinySum += this.getLetterValue(letter);
        }
        if ([13, 14, 16, 19].includes(destinySum)) {
            karmicDebts.push({ number: destinySum, type: 'Destiny' });
        }
        
        return karmicDebts;
    },

    /**
     * Get Pinnacles (4 major life cycles)
     */
    calculatePinnacles(birthDate) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return [];
        
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const lifePath = this.calculateLifePath(birthDate);
        
        const reducedDay = this.reduceNumber(day, false);
        const reducedMonth = this.reduceNumber(month, false);
        const reducedYear = this.reduceNumber(year, false);
        
        // First Pinnacle ends at 36 - Life Path
        const firstEnd = 36 - lifePath;
        
        return [
            { 
                number: this.reduceNumber(reducedMonth + reducedDay),
                startAge: 0,
                endAge: firstEnd,
                period: 'Early Life'
            },
            {
                number: this.reduceNumber(reducedDay + reducedYear),
                startAge: firstEnd + 1,
                endAge: firstEnd + 9,
                period: 'Middle Years'
            },
            {
                number: this.reduceNumber(this.reduceNumber(reducedMonth + reducedDay) + this.reduceNumber(reducedDay + reducedYear)),
                startAge: firstEnd + 10,
                endAge: firstEnd + 18,
                period: 'Later Years'
            },
            {
                number: this.reduceNumber(reducedMonth + reducedYear),
                startAge: firstEnd + 19,
                endAge: 'End of Life',
                period: 'Final Stage'
            }
        ];
    },

    /**
     * Get Challenges (4 life challenges)
     */
    calculateChallenges(birthDate) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return [];
        
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const reducedDay = this.reduceNumber(day, false);
        const reducedMonth = this.reduceNumber(month, false);
        const reducedYear = this.reduceNumber(year, false);
        
        const first = Math.abs(reducedMonth - reducedDay);
        const second = Math.abs(reducedDay - reducedYear);
        const third = Math.abs(first - second);
        const fourth = Math.abs(reducedMonth - reducedYear);
        
        return [
            { number: first, period: 'First Challenge' },
            { number: second, period: 'Second Challenge' },
            { number: third, period: 'Main Challenge' },
            { number: fourth, period: 'Final Challenge' }
        ];
    },

    /**
     * Calculate Lucky Elements based on numbers
     */
    getLuckyElements(lifePath) {
        const elements = {
            1: { color: '#FF5733', colorName: 'Red', day: 'Sunday', planet: 'Sun', gemstone: 'Ruby', direction: 'East', metal: 'Gold' },
            2: { color: '#FFFFFF', colorName: 'White', day: 'Monday', planet: 'Moon', gemstone: 'Pearl', direction: 'North-West', metal: 'Silver' },
            3: { color: '#FFD700', colorName: 'Yellow', day: 'Thursday', planet: 'Jupiter', gemstone: 'Yellow Sapphire', direction: 'North', metal: 'Gold' },
            4: { color: '#4169E1', colorName: 'Blue', day: 'Sunday', planet: 'Rahu', gemstone: 'Hessonite', direction: 'South-West', metal: 'Iron' },
            5: { color: '#2ECC71', colorName: 'Green', day: 'Wednesday', planet: 'Mercury', gemstone: 'Emerald', direction: 'North', metal: 'Bronze' },
            6: { color: '#FF69B4', colorName: 'Pink', day: 'Friday', planet: 'Venus', gemstone: 'Diamond', direction: 'South-East', metal: 'Silver' },
            7: { color: '#F5F5F5', colorName: 'White', day: 'Monday', planet: 'Ketu', gemstone: "Cat's Eye", direction: 'South-West', metal: 'Silver' },
            8: { color: '#000080', colorName: 'Navy Blue', day: 'Saturday', planet: 'Saturn', gemstone: 'Blue Sapphire', direction: 'West', metal: 'Iron' },
            9: { color: '#DC143C', colorName: 'Crimson', day: 'Tuesday', planet: 'Mars', gemstone: 'Red Coral', direction: 'South', metal: 'Copper' },
            11: { color: '#C0C0C0', colorName: 'Silver', day: 'Monday', planet: 'Moon', gemstone: 'Pearl', direction: 'North-West', metal: 'Silver' },
            22: { color: '#FFD700', colorName: 'Gold', day: 'Saturday', planet: 'Saturn', gemstone: 'Blue Sapphire', direction: 'West', metal: 'Gold' },
            33: { color: '#9370DB', colorName: 'Violet', day: 'Thursday', planet: 'Jupiter', gemstone: 'Amethyst', direction: 'North', metal: 'Gold' }
        };
        return elements[lifePath] || elements[this.reduceNumber(lifePath, false)];
    },

    /**
     * Get compatibility between two numbers
     */
    getCompatibility(num1, num2) {
        const compatibilityChart = {
            1: { best: [1, 3, 5, 9], good: [2, 6], neutral: [4, 7], challenging: [8] },
            2: { best: [2, 4, 6, 8], good: [1, 9], neutral: [3, 5], challenging: [7] },
            3: { best: [1, 3, 5, 9], good: [6], neutral: [2, 7], challenging: [4, 8] },
            4: { best: [2, 4, 6, 8], good: [7], neutral: [1, 5], challenging: [3, 9] },
            5: { best: [1, 3, 5, 7, 9], good: [6], neutral: [2, 8], challenging: [4] },
            6: { best: [2, 4, 6, 8, 9], good: [1, 3, 5], neutral: [7], challenging: [] },
            7: { best: [5, 7], good: [4], neutral: [1, 3, 6, 9], challenging: [2, 8] },
            8: { best: [2, 4, 6, 8], good: [], neutral: [1, 5], challenging: [3, 7, 9] },
            9: { best: [1, 3, 5, 6, 9], good: [2], neutral: [7], challenging: [4, 8] }
        };
        
        const base = this.reduceNumber(num1, false);
        const chart = compatibilityChart[base];
        const target = this.reduceNumber(num2, false);
        
        if (chart.best.includes(target)) return { level: 'Excellent', score: 90, icon: 'bi-heart-fill' };
        if (chart.good.includes(target)) return { level: 'Good', score: 70, icon: 'bi-hand-thumbs-up-fill' };
        if (chart.neutral.includes(target)) return { level: 'Neutral', score: 50, icon: 'bi-dash-circle' };
        return { level: 'Challenging', score: 30, icon: 'bi-exclamation-triangle' };
    },

    /**
     * Calculate all numerology numbers - Extended
     */
    calculateAll(fullName, birthDate) {
        return {
            lifePath: this.calculateLifePath(birthDate),
            destiny: this.calculateDestinyNumber(fullName),
            soulUrge: this.calculateSoulUrge(fullName),
            personality: this.calculatePersonalityNumber(fullName),
            birthday: this.calculateBirthdayNumber(birthDate),
            maturity: this.calculateMaturityNumber(fullName, birthDate),
            balance: this.calculateBalanceNumber(fullName),
            personalYear: this.calculatePersonalYear(birthDate),
            personalMonth: this.calculatePersonalMonth(birthDate),
            personalDay: this.calculatePersonalDay(birthDate),
            pinnacles: this.calculatePinnacles(birthDate),
            challenges: this.calculateChallenges(birthDate),
            karmicDebts: this.getKarmicDebtNumbers(fullName, birthDate)
        };
    },

    /**
     * Get detailed breakdown of name calculation
     */
    getNameBreakdown(fullName) {
        const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '');
        const breakdown = [];
        
        for (const letter of letters) {
            breakdown.push({
                letter,
                value: this.getLetterValue(letter),
                isVowel: this.isVowel(letter)
            });
        }
        
        return breakdown;
    },

    /**
     * Get detailed breakdown of date calculation
     */
    getDateBreakdown(birthDate) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return { day: { original: 1, reduced: 1 }, month: { original: 1, reduced: 1 }, year: { original: 2000, reduced: 2 } };
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        return {
            day: {
                original: day,
                reduced: this.reduceNumber(day, false)
            },
            month: {
                original: month,
                reduced: this.reduceNumber(month, false)
            },
            year: {
                original: year,
                reduced: this.reduceNumber(year, false)
            }
        };
    },

    /**
     * Get meaning for a numerology number - Comprehensive Edition
     */
    getNumberMeaning(number, type = 'lifePath') {
        const meanings = {
            lifePath: {
                1: {
                    title: 'The Leader',
                    archetype: 'Pioneer & Innovator',
                    traits: ['Independent', 'Creative', 'Original', 'Ambitious', 'Determined', 'Courageous', 'Self-reliant'],
                    description: 'You are a natural born leader with an unwavering drive to succeed. Your independence and originality set you apart from the crowd. You possess the courage to forge new paths and the determination to see them through.',
                    mission: 'To develop individuality, self-confidence, and become a leader who inspires others through innovation and courage.',
                    strengths: ['Natural leadership abilities', 'Creative problem solving', 'Self-motivation', 'Pioneering spirit', 'Strong willpower'],
                    weaknesses: ['Can be stubborn or domineering', 'May struggle with teamwork', 'Tendency toward selfishness', 'Impatience with others'],
                    challenges: 'Learning patience and cooperation with others. Balancing independence with healthy relationships.',
                    careers: ['Entrepreneur', 'CEO/Executive', 'Inventor', 'Director', 'Freelancer', 'Military Leader', 'Sports Champion'],
                    relationships: 'You need a partner who respects your independence. Best matched with Life Paths 3, 5, and 9.',
                    healthFocus: 'Heart, eyes, blood circulation. Practice stress management.',
                    spiritualLesson: 'True leadership comes from serving others, not commanding them.',
                    affirmation: 'I am a powerful creator of my own destiny.'
                },
                2: {
                    title: 'The Mediator',
                    archetype: 'Peacemaker & Diplomat',
                    traits: ['Diplomatic', 'Cooperative', 'Sensitive', 'Patient', 'Supportive', 'Intuitive', 'Harmonious'],
                    description: 'You are a natural peacemaker with exceptional abilities to mediate and create harmony. Your sensitivity allows you to understand others on a deep emotional level. You thrive in partnerships and collaborative environments.',
                    mission: 'To develop cooperation, diplomacy, and become a healing presence that brings peace and balance to the world.',
                    strengths: ['Exceptional diplomacy', 'Deep empathy', 'Patience and tact', 'Mediation skills', 'Supportive nature'],
                    weaknesses: ['Oversensitivity', 'Indecisiveness', 'Dependency on others', 'Self-deprecation', 'Passive-aggressive tendencies'],
                    challenges: 'Overcoming self-doubt and being overly dependent on others. Standing up for yourself.',
                    careers: ['Counselor', 'Diplomat', 'Mediator', 'Healer', 'Artist', 'Social Worker', 'HR Professional'],
                    relationships: 'You need emotional security and genuine partnership. Best matched with Life Paths 2, 4, 6, and 8.',
                    healthFocus: 'Nervous system, digestion. Avoid stress and anxiety.',
                    spiritualLesson: 'Your sensitivity is your superpower, not a weakness.',
                    affirmation: 'I am worthy of love and my voice matters.'
                },
                3: {
                    title: 'The Communicator',
                    archetype: 'Artist & Inspirer',
                    traits: ['Creative', 'Expressive', 'Joyful', 'Artistic', 'Inspiring', 'Optimistic', 'Charismatic'],
                    description: 'You have been blessed with the gift of self-expression and creativity. Your optimism and joy are contagious, lifting the spirits of everyone around you. You are meant to inspire others through your words and artistic talents.',
                    mission: 'To develop creative self-expression and use your gifts to bring joy, inspiration, and beauty to the world.',
                    strengths: ['Exceptional communication', 'Creative imagination', 'Natural optimism', 'Artistic talent', 'Social charm'],
                    weaknesses: ['Scattered energy', 'Superficiality', 'Exaggeration', 'Moodiness', 'Difficulty with discipline'],
                    challenges: 'Scattered energy and difficulty with discipline. Focusing your creative talents.',
                    careers: ['Writer', 'Actor', 'Speaker', 'Designer', 'Entertainer', 'Marketing', 'Social Media'],
                    relationships: 'You need intellectual stimulation and playfulness. Best matched with Life Paths 1, 5, and 9.',
                    healthFocus: 'Throat, vocal cords, nervous system. Express emotions healthily.',
                    spiritualLesson: 'True creativity flows when you release the need for external validation.',
                    affirmation: 'I freely express my authentic self with joy and confidence.'
                },
                4: {
                    title: 'The Builder',
                    archetype: 'Architect & Organizer',
                    traits: ['Practical', 'Organized', 'Hardworking', 'Loyal', 'Dependable', 'Disciplined', 'Methodical'],
                    description: 'You are the foundation builder, creating lasting structures in life through dedication and hard work. Your reliability and attention to detail make you indispensable. You bring order from chaos.',
                    mission: 'To create solid foundations and lasting structures through discipline, hard work, and unwavering commitment.',
                    strengths: ['Exceptional organization', 'Strong work ethic', 'Reliability', 'Attention to detail', 'Building lasting value'],
                    weaknesses: ['Rigidity', 'Stubbornness', 'Over-cautiousness', 'Resistance to change', 'Workaholism'],
                    challenges: 'Rigidity and resistance to change. Learning to be more flexible and spontaneous.',
                    careers: ['Engineer', 'Architect', 'Accountant', 'Manager', 'Banker', 'Real Estate', 'Systems Analyst'],
                    relationships: 'You need stability and loyalty. Best matched with Life Paths 2, 4, 6, and 8.',
                    healthFocus: 'Bones, joints, teeth. Avoid overwork and stress.',
                    spiritualLesson: 'Security comes from within, not from external structures alone.',
                    affirmation: 'I build my dreams on solid foundations of faith and action.'
                },
                5: {
                    title: 'The Freedom Seeker',
                    archetype: 'Adventurer & Catalyst',
                    traits: ['Adventurous', 'Versatile', 'Dynamic', 'Curious', 'Progressive', 'Magnetic', 'Adaptable'],
                    description: 'You thrive on change and adventure, bringing excitement wherever you go. Your versatility allows you to adapt to any situation. You are here to experience all that life has to offer and share those experiences with others.',
                    mission: 'To embrace change, experience life fully, and teach others about freedom, adaptability, and the joy of new experiences.',
                    strengths: ['Remarkable adaptability', 'Natural magnetism', 'Quick thinking', 'Love of adventure', 'Versatility'],
                    weaknesses: ['Restlessness', 'Irresponsibility', 'Inconsistency', 'Overindulgence', 'Fear of commitment'],
                    challenges: 'Restlessness and difficulty with commitment. Finding balance between freedom and responsibility.',
                    careers: ['Travel Writer', 'Sales', 'Marketing', 'Entertainer', 'Pilot', 'Tour Guide', 'Entrepreneur'],
                    relationships: 'You need freedom and excitement. Best matched with Life Paths 1, 3, 5, and 7.',
                    healthFocus: 'Nervous system, lungs. Avoid substance abuse and excess.',
                    spiritualLesson: 'True freedom comes from inner peace, not constant external change.',
                    affirmation: 'I embrace change as the pathway to my highest potential.'
                },
                6: {
                    title: 'The Nurturer',
                    archetype: 'Healer & Caretaker',
                    traits: ['Responsible', 'Caring', 'Harmonious', 'Domestic', 'Protective', 'Compassionate', 'Artistic'],
                    description: 'You are a natural caregiver with an immense capacity for love and responsibility. Family and home are central to your life. You have a gift for healing and creating beauty and harmony in your environment.',
                    mission: 'To nurture, heal, and create harmony in families and communities through unconditional love and service.',
                    strengths: ['Unconditional love', 'Healing presence', 'Domestic harmony', 'Artistic sensibility', 'Responsibility'],
                    weaknesses: ['Over-controlling', 'Self-righteousness', 'Martyrdom', 'Perfectionism', 'Interfering'],
                    challenges: 'Being overly controlling or self-sacrificing. Learning when to let go and allow others to grow.',
                    careers: ['Teacher', 'Counselor', 'Healthcare', 'Interior Design', 'Chef', 'Veterinarian', 'Social Worker'],
                    relationships: 'You need appreciation and harmony. Best matched with Life Paths 2, 4, 6, 8, and 9.',
                    healthFocus: 'Heart, breasts, reproductive system. Avoid taking on others\' stress.',
                    spiritualLesson: 'You cannot pour from an empty cup. Self-care enables you to care for others.',
                    affirmation: 'I lovingly nurture myself and others with perfect balance.'
                },
                7: {
                    title: 'The Seeker',
                    archetype: 'Philosopher & Mystic',
                    traits: ['Analytical', 'Intuitive', 'Spiritual', 'Thoughtful', 'Wise', 'Introspective', 'Perfectionist'],
                    description: 'You are on a lifelong quest for truth and wisdom. Your analytical mind is perfectly balanced with deep intuition. You are drawn to the mysteries of life and have the rare ability to bridge science and spirituality.',
                    mission: 'To seek truth and wisdom, develop spiritual understanding, and share your insights with those ready to receive them.',
                    strengths: ['Profound wisdom', 'Analytical brilliance', 'Spiritual depth', 'Research abilities', 'Intuitive insights'],
                    weaknesses: ['Isolation tendencies', 'Emotional coldness', 'Perfectionism', 'Skepticism', 'Secretiveness'],
                    challenges: 'Isolation and difficulty expressing emotions. Trusting your intuition alongside your intellect.',
                    careers: ['Researcher', 'Scientist', 'Philosopher', 'Spiritual Teacher', 'Analyst', 'Professor', 'Writer'],
                    relationships: 'You need intellectual connection and space. Best matched with Life Paths 3, 5, and 7.',
                    healthFocus: 'Skin, glands, pineal gland. Meditation and nature are essential.',
                    spiritualLesson: 'Knowledge becomes wisdom when filtered through the heart.',
                    affirmation: 'I trust the wisdom that flows through my intuition and analysis.'
                },
                8: {
                    title: 'The Achiever',
                    archetype: 'Executive & Powerhouse',
                    traits: ['Ambitious', 'Powerful', 'Successful', 'Material', 'Authoritative', 'Efficient', 'Goal-oriented'],
                    description: 'You have the potential for tremendous material success and achievement. Your drive for accomplishment is matched by your ability to organize and lead others. You understand the relationship between effort and reward.',
                    mission: 'To achieve material success and use your power and resources to make a positive difference in the world.',
                    strengths: ['Business acumen', 'Leadership abilities', 'Financial intelligence', 'Determination', 'Executive presence'],
                    weaknesses: ['Materialism', 'Workaholism', 'Domineering behavior', 'Impatience', 'Power struggles'],
                    challenges: 'Balancing material success with spiritual growth. Using power wisely and ethically.',
                    careers: ['Executive', 'Banker', 'Lawyer', 'Politician', 'Real Estate', 'Finance', 'Business Owner'],
                    relationships: 'You need respect and partnership in building empire. Best matched with Life Paths 2, 4, 6, and 8.',
                    healthFocus: 'Blood pressure, stress-related issues. Balance work with rest.',
                    spiritualLesson: 'True abundance includes love, health, and spiritual fulfillment-not just wealth.',
                    affirmation: 'I use my power and abundance to create good in the world.'
                },
                9: {
                    title: 'The Humanitarian',
                    archetype: 'Visionary & Philanthropist',
                    traits: ['Compassionate', 'Generous', 'Artistic', 'Spiritual', 'Idealistic', 'Charismatic', 'Wise'],
                    description: 'You are here to serve humanity with your vast compassion and wisdom. Your artistic abilities and spiritual depth inspire others. You carry the energy of completion and have the potential to touch many lives.',
                    mission: 'To serve humanity through compassion, creative expression, and by embodying unconditional love for all beings.',
                    strengths: ['Universal compassion', 'Artistic talent', 'Spiritual wisdom', 'Charismatic influence', 'Generosity'],
                    weaknesses: ['Detachment', 'Moodiness', 'Scattered focus', 'Unrealistic idealism', 'Financial carelessness'],
                    challenges: 'Letting go of the past and personal attachments. Maintaining boundaries while serving others.',
                    careers: ['Humanitarian Worker', 'Artist', 'Healer', 'Teacher', 'Philanthropist', 'Actor', 'Writer'],
                    relationships: 'You need a partner who shares your vision. Best matched with Life Paths 1, 3, 5, 6, and 9.',
                    healthFocus: 'Heart, liver, nerves. Avoid emotional overwhelm and exhaustion.',
                    spiritualLesson: 'To give truly, you must first have nothing to lose.',
                    affirmation: 'I am a vessel of universal love and compassion.'
                },
                11: {
                    title: 'The Intuitive',
                    archetype: 'Illuminator & Visionary',
                    isMaster: true,
                    traits: ['Visionary', 'Inspirational', 'Intuitive', 'Idealistic', 'Sensitive', 'Spiritual', 'Illuminating'],
                    description: 'As a Master Number, you carry tremendous spiritual power and responsibility. You have heightened intuition and psychic abilities. You are meant to illuminate the path for others through your spiritual insights.',
                    mission: 'To channel higher wisdom and inspiration, illuminating the spiritual path for humanity through your elevated consciousness.',
                    strengths: ['Psychic sensitivity', 'Inspirational presence', 'Visionary abilities', 'Spiritual leadership', 'Creative genius'],
                    weaknesses: ['Nervous energy', 'Self-doubt', 'Overwhelm', 'Impracticality', 'Emotional volatility'],
                    challenges: 'Managing nervous energy and living up to your potential. Grounding your visions into reality.',
                    careers: ['Spiritual Teacher', 'Psychic', 'Counselor', 'Artist', 'Inventor', 'Life Coach', 'Inspirational Speaker'],
                    relationships: 'You need deep spiritual connection. Best matched with Life Paths 2, 6, and 11.',
                    healthFocus: 'Nervous system, eyes, heart. Meditation and grounding are essential.',
                    spiritualLesson: 'Your light shines brightest when you release the fear of being seen.',
                    affirmation: 'I am a channel for divine inspiration and healing light.'
                },
                22: {
                    title: 'The Master Builder',
                    archetype: 'Architect of Dreams',
                    isMaster: true,
                    traits: ['Visionary', 'Practical', 'Ambitious', 'Powerful', 'Disciplined', 'Masterful', 'Transformative'],
                    description: 'As the most powerful Master Number, you have the potential to achieve greatness on a grand scale. You can turn impossible dreams into concrete reality. You are meant to build structures that benefit humanity.',
                    mission: 'To manifest grand visions that serve humanity, building bridges between the spiritual and material worlds.',
                    strengths: ['Manifesting abilities', 'Practical vision', 'Large-scale thinking', 'Disciplined execution', 'Inspiring leadership'],
                    weaknesses: ['Enormous pressure', 'Self-imposed limitations', 'Workaholism', 'Control issues', 'Burnout'],
                    challenges: 'Enormous pressure to succeed and self-imposed limitations. Balancing vision with practicality.',
                    careers: ['Global Leader', 'Architect', 'Diplomat', 'Developer', 'Philanthropist', 'Statesman', 'Visionary CEO'],
                    relationships: 'You need a partner who shares your grand vision. Best matched with Life Paths 4, 6, and 22.',
                    healthFocus: 'Entire body systems due to stress. Regular rest and retreat are essential.',
                    spiritualLesson: 'The greatest structures are built with love, not just ambition.',
                    affirmation: 'I transform divine vision into lasting achievements for humanity.'
                },
                33: {
                    title: 'The Master Teacher',
                    archetype: 'Divine Healer & Guide',
                    isMaster: true,
                    traits: ['Nurturing', 'Spiritual', 'Selfless', 'Healing', 'Inspirational', 'Compassionate', 'Transformative'],
                    description: 'The rarest and most spiritually evolved Master Number. You carry the combined energy of 11 and 22, plus the nurturing 6. You are here to uplift humanity through divine love and masterful teaching.',
                    mission: 'To embody unconditional love and serve as a beacon of spiritual light, healing and teaching humanity through pure compassion.',
                    strengths: ['Divine love', 'Healing abilities', 'Spiritual mastery', 'Selfless service', 'Transformative presence'],
                    weaknesses: ['Martyrdom', 'Heavy responsibilities', 'Self-neglect', 'Unrealistic expectations', 'Emotional burden'],
                    challenges: 'Heavy responsibilities and self-sacrifice. Remembering to receive as well as give.',
                    careers: ['Spiritual Leader', 'Master Healer', 'Teacher', 'Humanitarian', 'Philanthropist', 'Counselor', 'Global Influencer'],
                    relationships: 'You need a spiritually evolved partner. Best matched with Life Paths 6, 9, and 33.',
                    healthFocus: 'Heart and entire nervous system. Self-care is crucial for service.',
                    spiritualLesson: 'Teaching is learning; healing others heals yourself.',
                    affirmation: 'I am divine love in human form, healing all I encounter.'
                }
            },
            soulUrge: {
                1: { title: 'Independence', icon: 'bi-rocket-takeoff', description: 'Your soul craves independence and leadership. You desire to be in control of your own destiny and leave your unique mark on the world.', desire: 'To be recognized as an original thinker and leader' },
                2: { title: 'Partnership', icon: 'bi-people-fill', description: 'Your soul yearns for love, harmony, and deep connections with others. You find fulfillment in creating peace and supporting others.', desire: 'To experience true love and create lasting harmony' },
                3: { title: 'Expression', icon: 'bi-palette-fill', description: 'Your soul wants to express itself creatively and bring joy to others. Self-expression through art, words, or performance fulfills you deeply.', desire: 'To create beauty and inspire joy in others' },
                4: { title: 'Stability', icon: 'bi-building', description: 'Your soul seeks security, order, and to build something lasting. You desire to create stable foundations for yourself and loved ones.', desire: 'To build a secure and orderly life' },
                5: { title: 'Freedom', icon: 'bi-airplane-fill', description: 'Your soul craves adventure, variety, and the freedom to explore. You feel most alive when experiencing new things and breaking boundaries.', desire: 'To experience all life has to offer without restriction' },
                6: { title: 'Love', icon: 'bi-heart-fill', description: 'Your soul desires to nurture, heal, and create harmony in relationships. You find deep fulfillment in caring for family and loved ones.', desire: 'To love and be loved unconditionally' },
                7: { title: 'Wisdom', icon: 'bi-book-fill', description: 'Your soul seeks truth, spiritual understanding, and inner peace. You are driven to understand the deeper mysteries of existence.', desire: 'To discover truth and achieve spiritual enlightenment' },
                8: { title: 'Achievement', icon: 'bi-trophy-fill', description: 'Your soul desires success, recognition, and material abundance. You are driven to accomplish great things and gain respect.', desire: 'To achieve success and be recognized for your power' },
                9: { title: 'Service', icon: 'bi-globe2', description: 'Your soul yearns to serve humanity and make the world a better place. You find meaning in helping others and making a difference.', desire: 'To make a meaningful difference in the world' },
                11: { title: 'Enlightenment', icon: 'bi-lightbulb-fill', description: 'Your soul craves spiritual illumination and to inspire others on their path. You seek to channel higher wisdom.', desire: 'To illuminate the spiritual path for others' },
                22: { title: 'Mastery', icon: 'bi-stars', description: 'Your soul desires to build something of lasting importance for humanity. You seek to turn grand visions into reality.', desire: 'To create lasting structures that serve humanity' },
                33: { title: 'Unconditional Love', icon: 'bi-suit-heart-fill', description: 'Your soul yearns to express divine love and heal others. You are drawn to serve humanity at the highest level.', desire: 'To embody and share divine love with all beings' }
            },
            destiny: {
                1: { title: 'Pioneer', icon: 'bi-compass-fill', description: 'Your destiny is to lead, innovate, and forge new paths. You are here to show others that courage and originality create success.' },
                2: { title: 'Diplomat', icon: 'bi-peace-fill', description: 'Your destiny is to bring peace, balance, and cooperation to others. You are meant to be a healing and unifying presence.' },
                3: { title: 'Artist', icon: 'bi-brush-fill', description: 'Your destiny is to inspire others through creative self-expression. You are here to spread joy and beauty through your unique gifts.' },
                4: { title: 'Builder', icon: 'bi-bricks', description: 'Your destiny is to create solid foundations and lasting structures. You are meant to bring order, stability, and practical value.' },
                5: { title: 'Adventurer', icon: 'bi-compass-fill', description: 'Your destiny is to embrace change and show others the value of freedom. You are here to experience and teach about life\'s variety.' },
                6: { title: 'Healer', icon: 'bi-bandaid-fill', description: 'Your destiny is to nurture, teach, and create harmony. You are meant to be a source of love, beauty, and healing for others.' },
                7: { title: 'Philosopher', icon: 'bi-journal-text', description: 'Your destiny is to seek and share wisdom and spiritual truths. You are here to bridge the gap between knowledge and understanding.' },
                8: { title: 'Executive', icon: 'bi-briefcase-fill', description: 'Your destiny is to achieve material success and use it wisely. You are meant to gain power and use it to create positive change.' },
                9: { title: 'Humanitarian', icon: 'bi-globe-americas', description: 'Your destiny is to serve humanity with compassion and wisdom. You are here to inspire others through selfless love and art.' },
                11: { title: 'Illuminator', icon: 'bi-sun-fill', description: 'Your destiny is to bring spiritual light and inspiration to others. You are meant to illuminate higher truths for humanity.' },
                22: { title: 'Master Builder', icon: 'bi-buildings', description: 'Your destiny is to create something of lasting benefit to humanity. You are meant to manifest grand visions into reality.' },
                33: { title: 'Master Teacher', icon: 'bi-mortarboard-fill', description: 'Your destiny is to uplift humanity through unconditional love. You are meant to be a divine teacher and healer.' }
            },
            birthday: {
                1: { title: 'Leadership', icon: 'bi-flag-fill', talents: ['Initiative', 'Independence', 'Originality'], description: 'You have natural leadership abilities and the courage to start new ventures.' },
                2: { title: 'Cooperation', icon: 'bi-people-fill', talents: ['Diplomacy', 'Patience', 'Mediation'], description: 'You excel at creating harmony and building partnerships.' },
                3: { title: 'Creativity', icon: 'bi-palette-fill', talents: ['Self-expression', 'Optimism', 'Artistic flair'], description: 'You have natural creative and communication gifts.' },
                4: { title: 'Organization', icon: 'bi-grid-fill', talents: ['Practicality', 'Reliability', 'Building'], description: 'You excel at organizing, planning, and creating order.' },
                5: { title: 'Versatility', icon: 'bi-shuffle', talents: ['Adaptability', 'Resourcefulness', 'Quick thinking'], description: 'You thrive on change and adapt quickly to new situations.' },
                6: { title: 'Nurturing', icon: 'bi-house-heart-fill', talents: ['Caring', 'Responsibility', 'Harmony'], description: 'You have a natural gift for nurturing and creating beauty.' },
                7: { title: 'Analysis', icon: 'bi-search-heart', talents: ['Research', 'Intuition', 'Wisdom'], description: 'You have exceptional analytical and intuitive abilities.' },
                8: { title: 'Authority', icon: 'bi-graph-up-arrow', talents: ['Business sense', 'Ambition', 'Judgment'], description: 'You have natural business acumen and executive abilities.' },
                9: { title: 'Compassion', icon: 'bi-heart-half', talents: ['Humanitarianism', 'Wisdom', 'Artistic vision'], description: 'You have a broad vision and deep compassion for humanity.' },
                11: { title: 'Inspiration', icon: 'bi-lightning-fill', talents: ['Intuition', 'Vision', 'Spiritual insight'], description: 'You have heightened intuition and inspirational abilities.' },
                22: { title: 'Manifestation', icon: 'bi-magic', talents: ['Vision', 'Practicality', 'Large-scale thinking'], description: 'You can manifest grand visions into concrete reality.' },
                33: { title: 'Healing', icon: 'bi-heart-pulse-fill', talents: ['Nurturing', 'Teaching', 'Spiritual healing'], description: 'You have extraordinary healing and teaching abilities.' }
            },
            personalYear: {
                1: { title: 'New Beginnings', theme: 'Fresh starts, independence, planting seeds', advice: 'Take initiative on new projects. This is a year to start fresh and assert yourself.', focus: 'Career and personal goals' },
                2: { title: 'Partnership', theme: 'Cooperation, patience, relationships', advice: 'Focus on partnerships and diplomacy. Patience is key this year.', focus: 'Relationships and emotional balance' },
                3: { title: 'Expression', theme: 'Creativity, social activities, joy', advice: 'Express yourself creatively. Socialize and bring more joy into your life.', focus: 'Creative projects and social connections' },
                4: { title: 'Foundation', theme: 'Hard work, building, organization', advice: 'Put in the hard work to build solid foundations. Get organized and be practical.', focus: 'Work, health, and stability' },
                5: { title: 'Change', theme: 'Freedom, adventure, transformation', advice: 'Embrace change and new experiences. This is a dynamic year of transformation.', focus: 'Travel, new experiences, breaking free' },
                6: { title: 'Responsibility', theme: 'Family, home, love, service', advice: 'Focus on home and family. Take responsibility for loved ones and community.', focus: 'Family, home, and relationships' },
                7: { title: 'Reflection', theme: 'Introspection, spiritual growth, study', advice: 'Go inward. This is a year for spiritual development and gaining wisdom.', focus: 'Spiritual growth and inner wisdom' },
                8: { title: 'Achievement', theme: 'Success, money, recognition', advice: 'Pursue career and financial goals. This is a power year for achievement.', focus: 'Career advancement and finances' },
                9: { title: 'Completion', theme: 'Endings, release, transformation', advice: 'Let go of what no longer serves you. Clear the path for new beginnings.', focus: 'Release, completion, and preparation' },
                11: { title: 'Spiritual Awakening', theme: 'Intuition, inspiration, higher calling', advice: 'Trust your intuition. This is a year of spiritual awakening and inspiration.', focus: 'Spiritual purpose and higher guidance' },
                22: { title: 'Master Building', theme: 'Manifesting dreams, large projects', advice: 'Think big and build lasting structures. Your power to manifest is amplified.', focus: 'Large-scale projects and legacy building' },
                33: { title: 'Master Teaching', theme: 'Healing, teaching, unconditional love', advice: 'Share your wisdom and heal others. Your capacity for love is infinite.', focus: 'Service, teaching, and spiritual leadership' }
            },
            challenge: {
                0: { title: 'Choice', description: 'You may face all challenges or have freedom to choose your path.' },
                1: { title: 'Self-Confidence', description: 'Learning to assert yourself and develop self-reliance without being aggressive.' },
                2: { title: 'Sensitivity', description: 'Balancing sensitivity with strength. Overcoming fear of confrontation.' },
                3: { title: 'Expression', description: 'Learning to express yourself authentically without scattering your energy.' },
                4: { title: 'Discipline', description: 'Developing patience, organization, and willingness to work hard.' },
                5: { title: 'Freedom', description: 'Learning to use freedom responsibly without falling into excess.' },
                6: { title: 'Responsibility', description: 'Balancing responsibility for others with self-care. Avoiding perfectionism.' },
                7: { title: 'Faith', description: 'Developing faith and trust. Overcoming fear, isolation, and skepticism.' },
                8: { title: 'Power', description: 'Learning to use power and money wisely without being controlled by them.' }
            },
            karmicDebt: {
                13: { title: 'Hard Work', description: 'Past life laziness. You must learn the value of honest hard work and perseverance.', lesson: 'Develop discipline and complete what you start.', healing: 'Stay focused and avoid shortcuts.' },
                14: { title: 'Moderation', description: 'Past life abuse of freedom. You must learn self-control and moderation.', lesson: 'Balance freedom with responsibility.', healing: 'Practice temperance and commitment.' },
                16: { title: 'Ego', description: 'Past life ego destruction of love. You must rebuild through humility.', lesson: 'Surrender ego and embrace spiritual growth.', healing: 'Cultivate humility and accept life\'s lessons.' },
                19: { title: 'Independence', description: 'Past life abuse of power. You must learn proper use of leadership.', lesson: 'Lead with integrity and help others.', healing: 'Balance independence with consideration for others.' }
            }
        };

        return meanings[type]?.[number] || { title: 'Unknown', description: 'Meaning not available.' };
    },

    /**
     * Animate numerology calculation
     */
    async animateCalculation(container, fullName, birthDate, onComplete) {
        const breakdown = this.getNameBreakdown(fullName);
        const dateBreakdown = this.getDateBreakdown(birthDate);
        
        // Create animation container
        container.innerHTML = `
            <div class="numerology-animation">
                <div class="calculation-display">
                    <h3 class="mb-4 text-gradient">Calculating Your Life Path Number</h3>
                    <div class="letter-calculation" id="letter-calc"></div>
                    <div class="calculation-result" id="calc-result"></div>
                </div>
            </div>
        `;

        const letterCalc = container.querySelector('#letter-calc');
        const calcResult = container.querySelector('#calc-result');

        // Animate name letters
        for (let i = 0; i < fullName.length; i++) {
            const char = fullName[i];
            if (char === ' ') {
                const spaceEl = document.createElement('div');
                spaceEl.className = 'letter-item';
                spaceEl.style.width = '20px';
                spaceEl.style.animationDelay = `${i * 100}ms`;
                letterCalc.appendChild(spaceEl);
                continue;
            }

            const value = this.getLetterValue(char);
            const letterEl = document.createElement('div');
            letterEl.className = 'letter-item';
            letterEl.style.animationDelay = `${i * 100}ms`;
            letterEl.innerHTML = `
                <span class="letter">${char.toUpperCase()}</span>
                <span class="number">${value}</span>
            `;
            letterCalc.appendChild(letterEl);
            
            await MayaUtils.sleep(100);
        }

        await MayaUtils.sleep(500);

        // Show date calculation
        const lifePath = this.calculateLifePath(birthDate);
        const dateSum = dateBreakdown.day.reduced + dateBreakdown.month.reduced + dateBreakdown.year.reduced;

        calcResult.innerHTML = `
            <div class="result-row">
                <span>Day: ${dateBreakdown.day.original} → ${dateBreakdown.day.reduced}</span>
            </div>
            <div class="result-row">
                <span>Month: ${dateBreakdown.month.original} → ${dateBreakdown.month.reduced}</span>
            </div>
            <div class="result-row">
                <span>Year: ${dateBreakdown.year.original} → ${dateBreakdown.year.reduced}</span>
            </div>
            <div class="result-row mt-3">
                <span>${dateBreakdown.day.reduced} + ${dateBreakdown.month.reduced} + ${dateBreakdown.year.reduced} = ${dateSum}</span>
            </div>
        `;

        await MayaUtils.sleep(1000);

        // Show final result with animation
        calcResult.innerHTML += `
            <div class="final-number mt-4">${lifePath}</div>
            <div class="number-name">${this.getNumberMeaning(lifePath, 'lifePath').title}</div>
        `;

        await MayaUtils.sleep(500);

        if (onComplete) {
            onComplete(lifePath);
        }
    },

    /**
     * Render the Numerology page - World Class Edition
     */
    renderNumerologyPage(profile, isHindi) {
        if (!profile || !profile.name || !profile.birthDate) {
            return `
                <div class="maya-page maya-page--numerology">
                    <div class="maya-empty-state text-center py-5">
                        <div class="maya-empty-state__icon">
                            <i class="bi bi-calculator"></i>
                        </div>
                        <h5 class="maya-empty-state__title">${isHindi ? 'प्रोफ़ाइल की आवश्यकता है' : 'Profile Required'}</h5>
                        <p class="maya-empty-state__text">${isHindi ? 'कृपया पहले अपनी प्रोफ़ाइल पूरी करें' : 'Please complete your profile first'}</p>
                    </div>
                </div>
            `;
        }

        const numbers = this.calculateAll(profile.name, profile.birthDate);
        const lifePathMeaning = this.getNumberMeaning(numbers.lifePath, 'lifePath');
        const destinyMeaning = this.getNumberMeaning(numbers.destiny, 'destiny');
        const soulUrgeMeaning = this.getNumberMeaning(numbers.soulUrge, 'soulUrge');
        const personalityMeaning = this.getNumberMeaning(numbers.personality, 'destiny');
        const birthdayMeaning = this.getNumberMeaning(numbers.birthday, 'birthday');
        const personalYearMeaning = this.getNumberMeaning(numbers.personalYear, 'personalYear');
        const luckyElements = this.getLuckyElements(numbers.lifePath);
        const maturityMeaning = this.getNumberMeaning(numbers.maturity, 'destiny');
        
        // Calculate current age for pinnacles
        const birthDate = window.MayaAstrology ? MayaAstrology.parseDate(profile.birthDate) : new Date(profile.birthDate);
        const currentAge = birthDate ? Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
        
        // Find current pinnacle
        let currentPinnacle = numbers.pinnacles[0];
        for (const pinnacle of numbers.pinnacles) {
            if (typeof pinnacle.endAge === 'number' && currentAge <= pinnacle.endAge) {
                currentPinnacle = pinnacle;
                break;
            } else if (pinnacle.endAge === 'End of Life' && currentAge > numbers.pinnacles[2].endAge) {
                currentPinnacle = pinnacle;
            }
        }

        return `
            <div class="maya-page maya-page--numerology maya-numerology-page">
                <div class="maya-page__content">
                    
                    <!-- ===== HERO: Life Path Number ===== -->
                    <div class="maya-numerology__hero mb-4">
                        <div class="maya-numerology__hero-bg"></div>
                        <div class="maya-numerology__hero-content">
                            <div class="maya-numerology__hero-left">
                                <div class="maya-numerology__hero-number">
                                    <span class="maya-numerology__hero-number-value">${numbers.lifePath}</span>
                                    <div class="maya-numerology__hero-number-glow"></div>
                                </div>
                            </div>
                            <div class="maya-numerology__hero-right">
                                <div class="maya-numerology__hero-badge">
                                    ${lifePathMeaning.isMaster ? `<span class="maya-numerology__master-tag"><i class="bi bi-stars"></i> ${isHindi ? 'मास्टर नंबर' : 'Master Number'}</span>` : ''}
                                </div>
                                <h2 class="maya-numerology__hero-title">${lifePathMeaning.title}</h2>
                                <p class="maya-numerology__hero-archetype">${lifePathMeaning.archetype || ''}</p>
                                <div class="maya-numerology__hero-label">
                                    <i class="bi bi-signpost-split-fill"></i>
                                    ${isHindi ? 'जीवन पथ अंक' : 'Life Path Number'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ===== Life Purpose & Mission ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-compass-fill"></i>
                            <h5>${isHindi ? 'आपका जीवन उद्देश्य' : 'Your Life Purpose'}</h5>
                        </div>
                        <div class="maya-numerology__purpose-card">
                            <p class="maya-numerology__description">${lifePathMeaning.description}</p>
                            ${lifePathMeaning.mission ? `
                            <div class="maya-numerology__mission">
                                <span class="maya-numerology__mission-label"><i class="bi bi-bullseye"></i> ${isHindi ? 'आपका मिशन' : 'Your Mission'}</span>
                                <p>${lifePathMeaning.mission}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- ===== Traits Grid ===== -->
                    ${lifePathMeaning.traits ? `
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-person-badge-fill"></i>
                            <h5>${isHindi ? 'मुख्य विशेषताएं' : 'Core Traits'}</h5>
                        </div>
                        <div class="maya-numerology__traits-grid">
                            ${lifePathMeaning.traits.map(trait => `
                                <div class="maya-numerology__trait-item">
                                    <i class="bi bi-check-circle-fill"></i>
                                    <span>${trait}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Strengths & Weaknesses ===== -->
                    ${lifePathMeaning.strengths && lifePathMeaning.weaknesses ? `
                    <div class="maya-numerology__dual-cards mb-4">
                        <div class="maya-numerology__strength-card">
                            <div class="maya-numerology__card-header maya-numerology__card-header--success">
                                <i class="bi bi-shield-fill-check"></i>
                                <span>${isHindi ? 'शक्तियां' : 'Strengths'}</span>
                            </div>
                            <ul class="maya-numerology__card-list">
                                ${lifePathMeaning.strengths.map(s => `<li><i class="bi bi-plus-circle-fill"></i> ${s}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="maya-numerology__weakness-card">
                            <div class="maya-numerology__card-header maya-numerology__card-header--warning">
                                <i class="bi bi-exclamation-triangle-fill"></i>
                                <span>${isHindi ? 'चुनौतियां' : 'Challenges'}</span>
                            </div>
                            <ul class="maya-numerology__card-list">
                                ${lifePathMeaning.weaknesses.map(w => `<li><i class="bi bi-dash-circle"></i> ${w}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Core Numbers Grid ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-diagram-3-fill"></i>
                            <h5>${isHindi ? 'आपके मूल अंक' : 'Your Core Numbers'}</h5>
                        </div>
                        <div class="maya-numerology__core-grid">
                            <!-- Destiny Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--destiny">
                                <div class="maya-numerology__core-number">${numbers.destiny}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'भाग्य अंक' : 'Destiny Number'}</span>
                                    <span class="maya-numerology__core-title">${destinyMeaning.title}</span>
                                </div>
                                <i class="bi ${destinyMeaning.icon || 'bi-arrow-right-circle'}"></i>
                            </div>
                            
                            <!-- Soul Urge Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--soul">
                                <div class="maya-numerology__core-number">${numbers.soulUrge}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'आत्मा अंक' : 'Soul Urge'}</span>
                                    <span class="maya-numerology__core-title">${soulUrgeMeaning.title}</span>
                                </div>
                                <i class="bi ${soulUrgeMeaning.icon || 'bi-heart'}"></i>
                            </div>
                            
                            <!-- Personality Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--personality">
                                <div class="maya-numerology__core-number">${numbers.personality}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'व्यक्तित्व' : 'Personality'}</span>
                                    <span class="maya-numerology__core-title">${personalityMeaning.title}</span>
                                </div>
                                <i class="bi bi-person-circle"></i>
                            </div>
                            
                            <!-- Birthday Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--birthday">
                                <div class="maya-numerology__core-number">${numbers.birthday}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'जन्मदिन अंक' : 'Birthday'}</span>
                                    <span class="maya-numerology__core-title">${birthdayMeaning.title}</span>
                                </div>
                                <i class="bi ${birthdayMeaning.icon || 'bi-gift'}"></i>
                            </div>
                            
                            <!-- Maturity Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--maturity">
                                <div class="maya-numerology__core-number">${numbers.maturity}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'परिपक्वता अंक' : 'Maturity'}</span>
                                    <span class="maya-numerology__core-title">${maturityMeaning.title}</span>
                                </div>
                                <i class="bi bi-tree-fill"></i>
                            </div>
                            
                            <!-- Balance Number -->
                            <div class="maya-numerology__core-card maya-numerology__core-card--balance">
                                <div class="maya-numerology__core-number">${numbers.balance}</div>
                                <div class="maya-numerology__core-info">
                                    <span class="maya-numerology__core-label">${isHindi ? 'संतुलन अंक' : 'Balance'}</span>
                                    <span class="maya-numerology__core-title">${isHindi ? 'कठिन समय में सहायक' : 'Crisis Response'}</span>
                                </div>
                                <i class="bi bi-symmetry-horizontal"></i>
                            </div>
                        </div>
                    </div>

                    <!-- ===== Soul Urge Deep Dive ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-heart-fill"></i>
                            <h5>${isHindi ? 'आत्मा की इच्छा' : "Heart's Desire"}</h5>
                        </div>
                        <div class="maya-numerology__insight-card maya-numerology__insight-card--soul">
                            <div class="maya-numerology__insight-icon">
                                <i class="bi ${soulUrgeMeaning.icon || 'bi-heart-fill'}"></i>
                            </div>
                            <div class="maya-numerology__insight-content">
                                <h6>${soulUrgeMeaning.title}</h6>
                                <p>${soulUrgeMeaning.description}</p>
                                ${soulUrgeMeaning.desire ? `
                                <div class="maya-numerology__desire">
                                    <span><i class="bi bi-quote"></i> ${soulUrgeMeaning.desire}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- ===== Current Personal Cycles ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-calendar-event-fill"></i>
                            <h5>${isHindi ? 'वर्तमान चक्र' : 'Current Cycles'}</h5>
                        </div>
                        
                        <!-- Personal Year - Featured -->
                        <div class="maya-numerology__year-card mb-3">
                            <div class="maya-numerology__year-header">
                                <div class="maya-numerology__year-number">${numbers.personalYear}</div>
                                <div class="maya-numerology__year-info">
                                    <span class="maya-numerology__year-label">${isHindi ? 'व्यक्तिगत वर्ष' : 'Personal Year'} ${new Date().getFullYear()}</span>
                                    <h6 class="maya-numerology__year-title">${personalYearMeaning.title}</h6>
                                </div>
                            </div>
                            <div class="maya-numerology__year-content">
                                <div class="maya-numerology__year-theme">
                                    <span class="maya-numerology__year-theme-label"><i class="bi bi-tag-fill"></i> ${isHindi ? 'थीम' : 'Theme'}</span>
                                    <p>${personalYearMeaning.theme}</p>
                                </div>
                                <div class="maya-numerology__year-advice">
                                    <span class="maya-numerology__year-advice-label"><i class="bi bi-lightbulb-fill"></i> ${isHindi ? 'सलाह' : 'Guidance'}</span>
                                    <p>${personalYearMeaning.advice}</p>
                                </div>
                                <div class="maya-numerology__year-focus">
                                    <i class="bi bi-bullseye"></i>
                                    <span>${isHindi ? 'फोकस' : 'Focus'}: ${personalYearMeaning.focus}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Month & Day -->
                        <div class="maya-numerology__cycles-row">
                            <div class="maya-numerology__cycle-card">
                                <div class="maya-numerology__cycle-number">${numbers.personalMonth}</div>
                                <div class="maya-numerology__cycle-info">
                                    <span class="maya-numerology__cycle-label">${isHindi ? 'व्यक्तिगत माह' : 'Personal Month'}</span>
                                    <span class="maya-numerology__cycle-title">${this.getNumberMeaning(numbers.personalMonth, 'personalYear').title}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__cycle-card">
                                <div class="maya-numerology__cycle-number">${numbers.personalDay}</div>
                                <div class="maya-numerology__cycle-info">
                                    <span class="maya-numerology__cycle-label">${isHindi ? 'आज का अंक' : "Today's Number"}</span>
                                    <span class="maya-numerology__cycle-title">${this.getNumberMeaning(numbers.personalDay, 'personalYear').title}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ===== Pinnacles (Life Cycles) ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-graph-up-arrow"></i>
                            <h5>${isHindi ? 'जीवन के शिखर' : 'Life Pinnacles'}</h5>
                        </div>
                        <p class="maya-numerology__section-desc">${isHindi ? 'चार प्रमुख जीवन चक्र जो आपके विकास को आकार देते हैं' : 'Four major life cycles that shape your growth and experiences'}</p>
                        <div class="maya-numerology__pinnacles">
                            ${numbers.pinnacles.map((pinnacle, idx) => {
                                const isCurrent = pinnacle === currentPinnacle;
                                const pinnacleMeaning = this.getNumberMeaning(pinnacle.number, 'personalYear');
                                return `
                                <div class="maya-numerology__pinnacle ${isCurrent ? 'maya-numerology__pinnacle--active' : ''}">
                                    <div class="maya-numerology__pinnacle-marker">
                                        <span class="maya-numerology__pinnacle-number">${pinnacle.number}</span>
                                        ${isCurrent ? '<span class="maya-numerology__pinnacle-current"><i class="bi bi-geo-alt-fill"></i></span>' : ''}
                                    </div>
                                    <div class="maya-numerology__pinnacle-info">
                                        <span class="maya-numerology__pinnacle-period">${pinnacle.period}</span>
                                        <span class="maya-numerology__pinnacle-ages">${isHindi ? 'आयु' : 'Ages'} ${pinnacle.startAge} - ${pinnacle.endAge}</span>
                                        <span class="maya-numerology__pinnacle-theme">${pinnacleMeaning.title}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- ===== Life Challenges ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-puzzle-fill"></i>
                            <h5>${isHindi ? 'जीवन की चुनौतियां' : 'Life Challenges'}</h5>
                        </div>
                        <p class="maya-numerology__section-desc">${isHindi ? 'मास्टर करने के लिए पाठ और बाधाएं' : 'Lessons and obstacles to master for soul growth'}</p>
                        <div class="maya-numerology__challenges">
                            ${numbers.challenges.map((challenge, idx) => {
                                const challengeMeaning = this.getNumberMeaning(challenge.number, 'challenge');
                                return `
                                <div class="maya-numerology__challenge">
                                    <div class="maya-numerology__challenge-number">${challenge.number}</div>
                                    <div class="maya-numerology__challenge-info">
                                        <span class="maya-numerology__challenge-period">${challenge.period}</span>
                                        <span class="maya-numerology__challenge-title">${challengeMeaning.title}</span>
                                        <p class="maya-numerology__challenge-desc">${challengeMeaning.description}</p>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- ===== Karmic Debt (if any) ===== -->
                    ${numbers.karmicDebts.length > 0 ? `
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header maya-numerology__section-header--warning">
                            <i class="bi bi-hourglass-split"></i>
                            <h5>${isHindi ? 'कर्मिक ऋण' : 'Karmic Debt'}</h5>
                        </div>
                        <div class="maya-numerology__karmic-alert">
                            <i class="bi bi-info-circle-fill"></i>
                            <p>${isHindi ? 'कर्मिक ऋण पिछले जीवन के अधूरे पाठों का संकेत है। इन्हें स्वीकार करना आध्यात्मिक विकास की कुंजी है।' : 'Karmic debts indicate lessons from past lives that need to be addressed. Acknowledging them is key to spiritual growth.'}</p>
                        </div>
                        <div class="maya-numerology__karmic-list">
                            ${numbers.karmicDebts.map(debt => {
                                const karmicMeaning = this.getNumberMeaning(debt.number, 'karmicDebt');
                                return `
                                <div class="maya-numerology__karmic-card">
                                    <div class="maya-numerology__karmic-header">
                                        <span class="maya-numerology__karmic-number">${debt.number}</span>
                                        <div class="maya-numerology__karmic-title">
                                            <span class="maya-numerology__karmic-type">${debt.type}</span>
                                            <span class="maya-numerology__karmic-name">${karmicMeaning.title}</span>
                                        </div>
                                    </div>
                                    <p class="maya-numerology__karmic-desc">${karmicMeaning.description}</p>
                                    <div class="maya-numerology__karmic-lesson">
                                        <i class="bi bi-lightbulb"></i>
                                        <span>${karmicMeaning.lesson}</span>
                                    </div>
                                    <div class="maya-numerology__karmic-healing">
                                        <i class="bi bi-heart-pulse"></i>
                                        <span>${karmicMeaning.healing}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Lucky Elements ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-stars"></i>
                            <h5>${isHindi ? 'भाग्यशाली तत्व' : 'Lucky Elements'}</h5>
                        </div>
                        <div class="maya-numerology__lucky-grid">
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon" style="background: linear-gradient(135deg, ${luckyElements.color}40, ${luckyElements.color}15);">
                                    <div class="maya-numerology__lucky-color-swatch" style="background: ${luckyElements.color};"></div>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'भाग्यशाली रंग' : 'Lucky Color'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.colorName}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon maya-numerology__lucky-icon--day">
                                    <i class="bi bi-calendar-week"></i>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'भाग्यशाली दिन' : 'Lucky Day'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.day}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon maya-numerology__lucky-icon--planet">
                                    <i class="bi bi-sun-fill"></i>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'शासक ग्रह' : 'Ruling Planet'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.planet}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon maya-numerology__lucky-icon--gem">
                                    <i class="bi bi-gem"></i>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'भाग्यशाली रत्न' : 'Lucky Gemstone'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.gemstone}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon maya-numerology__lucky-icon--direction">
                                    <i class="bi bi-compass"></i>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'भाग्यशाली दिशा' : 'Lucky Direction'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.direction}</span>
                                </div>
                            </div>
                            <div class="maya-numerology__lucky-item">
                                <div class="maya-numerology__lucky-icon maya-numerology__lucky-icon--metal">
                                    <i class="bi bi-circle-fill"></i>
                                </div>
                                <div class="maya-numerology__lucky-info">
                                    <span class="maya-numerology__lucky-label">${isHindi ? 'भाग्यशाली धातु' : 'Lucky Metal'}</span>
                                    <span class="maya-numerology__lucky-value">${luckyElements.metal}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ===== Career Guidance ===== -->
                    ${lifePathMeaning.careers ? `
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-briefcase-fill"></i>
                            <h5>${isHindi ? 'करियर मार्गदर्शन' : 'Career Guidance'}</h5>
                        </div>
                        <div class="maya-numerology__careers">
                            ${(Array.isArray(lifePathMeaning.careers) ? lifePathMeaning.careers : lifePathMeaning.careers.split(', ')).map(career => `
                                <span class="maya-numerology__career-tag">
                                    <i class="bi bi-check2"></i>
                                    ${career}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Relationships ===== -->
                    ${lifePathMeaning.relationships ? `
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-people-fill"></i>
                            <h5>${isHindi ? 'रिश्ते और प्रेम' : 'Relationships & Love'}</h5>
                        </div>
                        <div class="maya-numerology__relationship-card">
                            <i class="bi bi-heart-pulse-fill"></i>
                            <p>${lifePathMeaning.relationships}</p>
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Health Focus ===== -->
                    ${lifePathMeaning.healthFocus ? `
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-heart-pulse-fill"></i>
                            <h5>${isHindi ? 'स्वास्थ्य फोकस' : 'Health Focus'}</h5>
                        </div>
                        <div class="maya-numerology__health-card">
                            <i class="bi bi-activity"></i>
                            <p>${lifePathMeaning.healthFocus}</p>
                        </div>
                    </div>
                    ` : ''}

                    <!-- ===== Spiritual Lesson & Affirmation ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-sun-fill"></i>
                            <h5>${isHindi ? 'आध्यात्मिक संदेश' : 'Spiritual Message'}</h5>
                        </div>
                        
                        ${lifePathMeaning.spiritualLesson ? `
                        <div class="maya-numerology__spiritual-card mb-3">
                            <div class="maya-numerology__spiritual-icon">
                                <i class="bi bi-lightbulb-fill"></i>
                            </div>
                            <div class="maya-numerology__spiritual-content">
                                <span class="maya-numerology__spiritual-label">${isHindi ? 'आध्यात्मिक पाठ' : 'Spiritual Lesson'}</span>
                                <p>${lifePathMeaning.spiritualLesson}</p>
                            </div>
                        </div>
                        ` : ''}

                        ${lifePathMeaning.affirmation ? `
                        <div class="maya-numerology__affirmation-card">
                            <div class="maya-numerology__affirmation-header">
                                <i class="bi bi-chat-quote-fill"></i>
                                <span>${isHindi ? 'आपका प्रतिज्ञान' : 'Your Affirmation'}</span>
                            </div>
                            <p class="maya-numerology__affirmation-text">"${lifePathMeaning.affirmation}"</p>
                            <div class="maya-numerology__affirmation-tip">
                                <i class="bi bi-info-circle"></i>
                                ${isHindi ? 'इसे रोज सुबह दोहराएं' : 'Repeat this every morning for best results'}
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- ===== Name Breakdown (Interactive) ===== -->
                    <div class="maya-numerology__section mb-4">
                        <div class="maya-numerology__section-header">
                            <i class="bi bi-fonts"></i>
                            <h5>${isHindi ? 'नाम विश्लेषण' : 'Name Analysis'}</h5>
                        </div>
                        <div class="maya-numerology__name-breakdown">
                            ${this.getNameBreakdown(profile.name).map(item => `
                                <div class="maya-numerology__letter-item ${item.isVowel ? 'maya-numerology__letter-item--vowel' : ''}">
                                    <span class="maya-numerology__letter">${item.letter}</span>
                                    <span class="maya-numerology__letter-value">${item.value}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="maya-numerology__name-legend">
                            <span><span class="maya-numerology__legend-vowel"></span> ${isHindi ? 'स्वर (आत्मा)' : 'Vowels (Soul)'}</span>
                            <span><span class="maya-numerology__legend-consonant"></span> ${isHindi ? 'व्यंजन (व्यक्तित्व)' : 'Consonants (Personality)'}</span>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }
};

// Make globally available
window.MayaNumerology = MayaNumerology;
