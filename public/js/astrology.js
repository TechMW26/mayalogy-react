/**
 * MAYA - Astrology Calculator
 * Vedic and Western Astrology Calculations
 * Using IST (Indian Standard Time) for all calculations
 */

const MayaAstrology = {
    /**
     * Get the user's preferred zodiac system (default: western)
     */
    getZodiacSystem() {
        return MayaUtils?.storage?.get('maya_zodiac_system') || 'western';
    },

    /**
     * Set the user's preferred zodiac system
     */
    setZodiacSystem(system) {
        if (system === 'western' || system === 'vedic') {
            MayaUtils?.storage?.set('maya_zodiac_system', system);
            // Clear cached horoscope so it regenerates with new system
            MayaUtils?.storage?.remove('maya_daily_horoscope');
            return true;
        }
        return false;
    },

    /**
     * Get zodiac based on user's preferred system (Western or Vedic)
     * This is the main function to use throughout the app
     */
    getZodiac(birthDate, birthContext = {}) {
        const system = this.getZodiacSystem();
        if (system === 'vedic') {
            return this.getVedicZodiac(birthDate, birthContext);
        }
        return this.getWesternZodiac(birthDate);
    },

    normalizeBirthContext(birthContext = {}) {
        if (typeof birthContext === 'string') {
            return { birthTime: birthContext };
        }

        if (birthContext && typeof birthContext === 'object') {
            return birthContext;
        }

        return {};
    },

    resolveBirthContext(birthDate, birthContext = {}) {
        const normalized = this.normalizeBirthContext(birthContext);
        const storedProfile = MayaUtils?.storage?.get('maya_profile') || {};
        const storedFunnelData = MayaUtils?.storage?.get('funnel_data') || {};
        const requestedPlace = typeof normalized.birthPlace === 'string'
            ? normalized.birthPlace.trim().toLowerCase()
            : '';
        const storedPlaces = [storedProfile.birthPlace, storedFunnelData.birthPlace]
            .filter((value) => typeof value === 'string' && value.trim())
            .map((value) => value.trim().toLowerCase());
        const canReuseStoredCoords = !requestedPlace || storedPlaces.includes(requestedPlace);
        const merged = {
            ...storedProfile,
            ...storedFunnelData,
            ...normalized
        };

        const explicitLat = Number(normalized.birthLat);
        const explicitLon = Number(normalized.birthLon);
        const fallbackLat = canReuseStoredCoords ? Number(merged.birthLat) : Number.NaN;
        const fallbackLon = canReuseStoredCoords ? Number(merged.birthLon) : Number.NaN;

        return {
            birthTime: merged.birthTime || '12:00',
            birthPlace: merged.birthPlace || '',
            birthLat: Number.isFinite(explicitLat) ? explicitLat : (Number.isFinite(fallbackLat) ? fallbackLat : 0),
            birthLon: Number.isFinite(explicitLon) ? explicitLon : (Number.isFinite(fallbackLon) ? fallbackLon : 0)
        };
    },

    getSignByName(signName) {
        return MAYA_CONFIG?.ZODIAC?.SIGNS?.find((sign) => sign.name === signName) || null;
    },

    /**
     * Parse date string safely handling various formats
     * Assumes IST timezone for all calculations
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        // If already a Date object
        if (dateString instanceof Date) {
            return isNaN(dateString.getTime()) ? null : dateString;
        }
        
        // Handle ISO format (YYYY-MM-DD)
        if (typeof dateString === 'string') {
            const createValidatedDate = (year, month, day) => {
                if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                    return null;
                }

                const date = new Date(year, month - 1, day, 12, 0, 0);
                if (Number.isNaN(date.getTime())) {
                    return null;
                }

                if (
                    date.getFullYear() !== year
                    || date.getMonth() !== month - 1
                    || date.getDate() !== day
                ) {
                    return null;
                }

                return date;
            };

            // Remove any time component for consistent parsing
            const datePart = dateString.trim().split('T')[0].replace(/[./]/g, '-');

            // Strict ISO first: YYYY-MM-DD
            const isoMatch = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (isoMatch) {
                return createValidatedDate(
                    Number.parseInt(isoMatch[1], 10),
                    Number.parseInt(isoMatch[2], 10),
                    Number.parseInt(isoMatch[3], 10)
                );
            }

            // Numeric fallback: support DD-MM-YYYY and MM-DD-YYYY.
            // MAYA is India-first, so ambiguous numeric dates prefer DD-MM-YYYY.
            const numericMatch = datePart.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (numericMatch) {
                const first = Number.parseInt(numericMatch[1], 10);
                const second = Number.parseInt(numericMatch[2], 10);
                const year = Number.parseInt(numericMatch[3], 10);

                const candidates = [];

                if (first > 12) {
                    candidates.push({ day: first, month: second });
                } else if (second > 12) {
                    candidates.push({ day: second, month: first });
                } else {
                    candidates.push({ day: first, month: second });
                    candidates.push({ day: second, month: first });
                }

                for (const candidate of candidates) {
                    const parsed = createValidatedDate(year, candidate.month, candidate.day);
                    if (parsed) {
                        return parsed;
                    }
                }
            }
            
            // Try standard Date parsing as fallback
            const parsed = new Date(dateString);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        
        return null;
    },

    /**
     * Parse a HH:MM birth time string safely.
     */
    parseTimeParts(birthTime) {
        if (typeof birthTime !== 'string' || !birthTime.includes(':')) {
            return { hours: 12, minutes: 0, isApproximate: true };
        }

        const [rawHours, rawMinutes] = birthTime.split(':');
        const hours = Number.parseInt(rawHours, 10);
        const minutes = Number.parseInt(rawMinutes, 10);

        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            return { hours: 12, minutes: 0, isApproximate: true };
        }

        return {
            hours: Math.min(Math.max(hours, 0), 23),
            minutes: Math.min(Math.max(minutes, 0), 59),
            isApproximate: false
        };
    },

    /**
     * Build a concrete birth moment using the collected date and time.
     */
    buildBirthMoment(birthDate, birthTime = '12:00') {
        const date = this.parseDate(birthDate);
        if (!date) return null;

        const { hours, minutes } = this.parseTimeParts(birthTime);
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            hours,
            minutes,
            0,
            0
        );
    },

    /**
     * Keep any angular value within 0-360 degrees.
     */
    normalizeDegree(degrees) {
        return ((degrees % 360) + 360) % 360;
    },

    /**
     * Keep any hour value within 0-24 hours.
     */
    normalizeHour(hours) {
        return ((hours % 24) + 24) % 24;
    },

    getJulianDay(moment) {
        if (!(moment instanceof Date) || Number.isNaN(moment.getTime())) {
            return null;
        }

        let year = moment.getFullYear();
        let month = moment.getMonth() + 1;
        const day = moment.getDate()
            + (moment.getHours() + moment.getMinutes() / 60 + moment.getSeconds() / 3600) / 24;

        if (month <= 2) {
            year -= 1;
            month += 12;
        }

        const century = Math.floor(year / 100);
        const correction = 2 - century + Math.floor(century / 4);

        return Math.floor(365.25 * (year + 4716))
            + Math.floor(30.6001 * (month + 1))
            + day
            + correction
            - 1524.5;
    },

    getLahiriAyanamsa(julianDay) {
        if (!Number.isFinite(julianDay)) return null;
        return 23.85 + 0.0137 * ((julianDay - 2451545.0) / 365.25);
    },

    getTropicalSunLongitude(julianDay) {
        const T = (julianDay - 2451545.0) / 36525;
        const meanLongitude = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        const meanAnomaly = 357.52911 + 35999.05029 * T - 0.0001537 * T * T - 0.00000048 * T * T * T;
        const anomalyRadians = meanAnomaly * Math.PI / 180;
        const equationOfCenter =
            (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(anomalyRadians)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * anomalyRadians)
            + 0.000289 * Math.sin(3 * anomalyRadians);

        return this.normalizeDegree(meanLongitude + equationOfCenter);
    },

    getTropicalMoonLongitude(julianDay) {
        const T = (julianDay - 2451545.0) / 36525;
        let longitude = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841 - (T * T * T * T) / 65194000;
        let elongation = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868 - (T * T * T * T) / 113065000;
        let solarAnomaly = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000;
        let lunarAnomaly = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T * T * T) / 69699 - (T * T * T * T) / 14712000;
        let latitudeArgument = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - (T * T * T) / 3526000 + (T * T * T * T) / 863310000;

        elongation *= Math.PI / 180;
        solarAnomaly *= Math.PI / 180;
        lunarAnomaly *= Math.PI / 180;
        latitudeArgument *= Math.PI / 180;

        longitude += 6.289 * Math.sin(lunarAnomaly);
        longitude += 1.274 * Math.sin(2 * elongation - lunarAnomaly);
        longitude += 0.658 * Math.sin(2 * elongation);
        longitude += 0.214 * Math.sin(2 * lunarAnomaly);
        longitude -= 0.186 * Math.sin(solarAnomaly);
        longitude -= 0.059 * Math.sin(2 * elongation - 2 * lunarAnomaly);
        longitude -= 0.057 * Math.sin(2 * elongation - solarAnomaly - lunarAnomaly);
        longitude += 0.053 * Math.sin(2 * elongation + lunarAnomaly);
        longitude += 0.046 * Math.sin(2 * elongation - solarAnomaly);
        longitude += 0.041 * Math.sin(solarAnomaly - lunarAnomaly);
        longitude -= 0.035 * Math.sin(elongation);
        longitude -= 0.031 * Math.sin(solarAnomaly + lunarAnomaly);
        longitude -= 0.015 * Math.sin(2 * latitudeArgument - 2 * elongation);
        longitude += 0.011 * Math.sin(2 * latitudeArgument - lunarAnomaly);

        return this.normalizeDegree(longitude);
    },

    getSiderealLongitudes(birthDate, birthTime = '12:00') {
        const moment = this.buildBirthMoment(birthDate, birthTime);
        if (!moment) {
            return { sunLongitude: null, moonLongitude: null, julianDay: null };
        }

        const julianDay = this.getJulianDay(moment);
        const ayanamsa = this.getLahiriAyanamsa(julianDay);
        if (!Number.isFinite(julianDay) || !Number.isFinite(ayanamsa)) {
            return { sunLongitude: null, moonLongitude: null, julianDay: null };
        }

        return {
            julianDay,
            sunLongitude: this.normalizeDegree(this.getTropicalSunLongitude(julianDay) - ayanamsa),
            moonLongitude: this.normalizeDegree(this.getTropicalMoonLongitude(julianDay) - ayanamsa)
        };
    },

    /**
     * Get Western zodiac sign from birth date
     */
    getWesternZodiac(birthDate) {
        try {
            if (!birthDate) return null;
            
            // Use safe date parsing
            const date = this.parseDate(birthDate);
            if (!date) return null;
            
            const month = date.getMonth() + 1;
            const day = date.getDate();

            // Check if ZODIAC config exists
            if (!MAYA_CONFIG || !MAYA_CONFIG.ZODIAC || !MAYA_CONFIG.ZODIAC.SIGNS) {
                console.error('ZODIAC config not found');
                return { name: 'Unknown', symbol: '?', element: 'Unknown', hindi: 'अज्ञात' };
            }

            const zodiacDates = [
                { sign: 0, startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },   // Aries
                { sign: 1, startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },   // Taurus
                { sign: 2, startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },   // Gemini
                { sign: 3, startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },   // Cancer
                { sign: 4, startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },   // Leo
                { sign: 5, startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },   // Virgo
                { sign: 6, startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },  // Libra
                { sign: 7, startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 }, // Scorpio
                { sign: 8, startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 }, // Sagittarius
                { sign: 9, startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },  // Capricorn
                { sign: 10, startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },  // Aquarius
                { sign: 11, startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 }   // Pisces
            ];

        for (const z of zodiacDates) {
            if (z.startMonth === z.endMonth) {
                if (month === z.startMonth && day >= z.startDay && day <= z.endDay) {
                    return MAYA_CONFIG.ZODIAC.SIGNS[z.sign];
                }
            } else if (z.endMonth < z.startMonth) {
                // Capricorn spans December to January
                if ((month === z.startMonth && day >= z.startDay) || 
                    (month === z.endMonth && day <= z.endDay)) {
                    return MAYA_CONFIG.ZODIAC.SIGNS[z.sign];
                }
            } else {
                if ((month === z.startMonth && day >= z.startDay) || 
                    (month === z.endMonth && day <= z.endDay)) {
                    return MAYA_CONFIG.ZODIAC.SIGNS[z.sign];
                }
            }
        }

            return MAYA_CONFIG.ZODIAC.SIGNS[0]; // Default to Aries
        } catch (error) {
            console.error('Error in getWesternZodiac:', error);
            return { name: 'Aries', symbol: '♈', element: 'Fire', hindi: 'मेष' };
        }
    },

    /**
     * Get Vedic (Moon) zodiac sign - Rashi based on Sun sign with Ayanamsa correction
     * Uses Lahiri Ayanamsa (most common in India)
     * For IST timezone
     */
    getVedicZodiac(birthDate, birthContext = {}) {
        try {
            if (!birthDate) return null;

            const { birthTime, birthLat, birthLon } = this.resolveBirthContext(birthDate, birthContext);
            const { moonLongitude } = this.getSiderealLongitudes(birthDate, birthTime);

            if (Number.isFinite(moonLongitude) && MAYA_CONFIG?.ZODIAC?.SIGNS?.length) {
                return MAYA_CONFIG.ZODIAC.SIGNS[Math.floor(moonLongitude / 30) % 12];
            }

            const moonPlanet = this.calculateBirthPlanets(birthDate, birthTime, birthLat, birthLon)
                .find((planet) => planet.name === 'Moon');

            if (moonPlanet?.sign?.name) {
                return this.getSignByName(moonPlanet.sign.name) || moonPlanet.sign;
            }
            
            // Check if ZODIAC config exists
            if (!MAYA_CONFIG || !MAYA_CONFIG.ZODIAC || !MAYA_CONFIG.ZODIAC.SIGNS) {
                console.error('ZODIAC config not found');
                return { name: 'Unknown', symbol: '?', element: 'Unknown', hindi: 'अज्ञात' };
            }
            
            // Fallback approximation if the moon-sign path could not be computed.
            const date = this.parseDate(birthDate);
            if (!date) {
                console.error('Invalid birth date:', birthDate);
                return MAYA_CONFIG.ZODIAC.SIGNS[0];
            }
            
            const month = date.getMonth() + 1;
            const day = date.getDate();
            
            // Calculate approximate sun longitude (degrees)
            // Spring equinox (~March 21) is 0° Aries in Western
            let sunLongitude = 0;
            
            // Approximate sun position based on date
            const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            // Sun moves ~1 degree per day, starting from ~0° on March 21 (day 80)
            sunLongitude = ((dayOfYear - 80) * (360 / 365.25) + 360) % 360;
            
            // Apply Lahiri Ayanamsa for 2024 (~24.2 degrees)
            // Ayanamsa increases by ~50 arc-seconds per year
            const currentYear = new Date().getFullYear();
            const ayanamsa = 24.2 + (currentYear - 2024) * (50 / 3600);
            
            // Vedic longitude = Western longitude - Ayanamsa
            let vedicLongitude = (sunLongitude - ayanamsa + 360) % 360;
            
            // Each sign is 30 degrees
            const signIndex = Math.floor(vedicLongitude / 30);
            
            return MAYA_CONFIG.ZODIAC.SIGNS[signIndex];
        } catch (error) {
            console.error('Error in getVedicZodiac:', error);
            return { name: 'Unknown', symbol: '?', element: 'Unknown', hindi: 'अज्ञात' };
        }
    },

    /**
     * Get Chinese zodiac
     */
    getChineseZodiac(birthDate) {
        const date = new Date(birthDate);
        const year = date.getFullYear();
        
        const animals = [
            { name: 'Rat', emoji: '🐀', element: 'Water' },
            { name: 'Ox', emoji: '🐂', element: 'Earth' },
            { name: 'Tiger', emoji: '🐅', element: 'Wood' },
            { name: 'Rabbit', emoji: '🐇', element: 'Wood' },
            { name: 'Dragon', emoji: '🐉', element: 'Earth' },
            { name: 'Snake', emoji: '🐍', element: 'Fire' },
            { name: 'Horse', emoji: '🐎', element: 'Fire' },
            { name: 'Goat', emoji: '🐐', element: 'Earth' },
            { name: 'Monkey', emoji: '🐒', element: 'Metal' },
            { name: 'Rooster', emoji: '🐓', element: 'Metal' },
            { name: 'Dog', emoji: '🐕', element: 'Earth' },
            { name: 'Pig', emoji: '🐖', element: 'Water' }
        ];

        const index = (year - 4) % 12;
        return animals[index];
    },

    /**
     * Get zodiac compatibility using Ashtakoot Guna Milan (Hindu Vedic system)
     * Total 36 Gunas across 8 aspects (Ashtakoot)
     */
    getCompatibility(sign1, sign2) {
        // Nakshatra (birth star) data for each zodiac sign
        // Each sign spans 2.25 nakshatras, we use the primary nakshatra
        const signToNakshatra = {
            'Aries': { nakshatra: 'Ashwini', index: 0, nakshatraLord: 'Ketu' },
            'Taurus': { nakshatra: 'Rohini', index: 3, nakshatraLord: 'Moon' },
            'Gemini': { nakshatra: 'Mrigashira', index: 5, nakshatraLord: 'Mars' },
            'Cancer': { nakshatra: 'Pushya', index: 7, nakshatraLord: 'Saturn' },
            'Leo': { nakshatra: 'Magha', index: 9, nakshatraLord: 'Ketu' },
            'Virgo': { nakshatra: 'Hasta', index: 12, nakshatraLord: 'Moon' },
            'Libra': { nakshatra: 'Swati', index: 14, nakshatraLord: 'Rahu' },
            'Scorpio': { nakshatra: 'Anuradha', index: 16, nakshatraLord: 'Saturn' },
            'Sagittarius': { nakshatra: 'Mula', index: 18, nakshatraLord: 'Ketu' },
            'Capricorn': { nakshatra: 'Shravana', index: 21, nakshatraLord: 'Moon' },
            'Aquarius': { nakshatra: 'Shatabhisha', index: 23, nakshatraLord: 'Rahu' },
            'Pisces': { nakshatra: 'Revati', index: 26, nakshatraLord: 'Mercury' }
        };

        // Varna (Spiritual compatibility) - Max 1 point
        const varnaOrder = {
            'Brahmin': ['Cancer', 'Scorpio', 'Pisces'], // Water signs
            'Kshatriya': ['Aries', 'Leo', 'Sagittarius'], // Fire signs
            'Vaishya': ['Taurus', 'Virgo', 'Capricorn'], // Earth signs
            'Shudra': ['Gemini', 'Libra', 'Aquarius'] // Air signs
        };
        const varnaRank = { 'Brahmin': 4, 'Kshatriya': 3, 'Vaishya': 2, 'Shudra': 1 };

        // Vashya (Dominance/Control) - Max 2 points
        const vashyaGroups = {
            'Chatushpada': ['Aries', 'Taurus', 'Sagittarius', 'Capricorn'], // Quadruped
            'Manava': ['Gemini', 'Virgo', 'Libra', 'Aquarius'], // Human
            'Jalachara': ['Cancer', 'Pisces'], // Water creature
            'Vanachara': ['Leo'], // Wild animal
            'Keeta': ['Scorpio'] // Insect/Reptile
        };

        // Yoni (Sexual/Physical compatibility) - Max 4 points
        const yoniAnimals = {
            'Aries': { animal: 'Sheep', type: 'Male' },
            'Taurus': { animal: 'Cow', type: 'Female' },
            'Gemini': { animal: 'Serpent', type: 'Male' },
            'Cancer': { animal: 'Deer', type: 'Female' },
            'Leo': { animal: 'Cat', type: 'Female' },
            'Virgo': { animal: 'Rat', type: 'Female' },
            'Libra': { animal: 'Buffalo', type: 'Male' },
            'Scorpio': { animal: 'Cat', type: 'Male' },
            'Sagittarius': { animal: 'Horse', type: 'Male' },
            'Capricorn': { animal: 'Deer', type: 'Male' },
            'Aquarius': { animal: 'Horse', type: 'Female' },
            'Pisces': { animal: 'Elephant', type: 'Female' }
        };
        const yoniEnemies = {
            'Cow': 'Tiger', 'Tiger': 'Cow',
            'Horse': 'Buffalo', 'Buffalo': 'Horse',
            'Elephant': 'Lion', 'Lion': 'Elephant',
            'Sheep': 'Monkey', 'Monkey': 'Sheep',
            'Serpent': 'Mongoose', 'Mongoose': 'Serpent',
            'Dog': 'Rabbit', 'Rabbit': 'Dog',
            'Cat': 'Rat', 'Rat': 'Cat',
            'Deer': 'Dog'
        };

        // Gana (Temperament) - Max 6 points
        const ganaGroups = {
            'Deva': ['Aries', 'Leo', 'Sagittarius', 'Libra'], // Divine - gentle, kind
            'Manushya': ['Taurus', 'Gemini', 'Virgo', 'Aquarius'], // Human - mixed nature
            'Rakshasa': ['Cancer', 'Scorpio', 'Capricorn', 'Pisces'] // Demonic - dominant, harsh
        };

        // Graha Maitri (Planetary friendship) - Max 5 points
        const signLords = {
            'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury',
            'Cancer': 'Moon', 'Leo': 'Sun', 'Virgo': 'Mercury',
            'Libra': 'Venus', 'Scorpio': 'Mars', 'Sagittarius': 'Jupiter',
            'Capricorn': 'Saturn', 'Aquarius': 'Saturn', 'Pisces': 'Jupiter'
        };
        const planetaryFriendship = {
            'Sun': { friends: ['Moon', 'Mars', 'Jupiter'], enemies: ['Venus', 'Saturn'], neutral: ['Mercury'] },
            'Moon': { friends: ['Sun', 'Mercury'], enemies: [], neutral: ['Mars', 'Jupiter', 'Venus', 'Saturn'] },
            'Mars': { friends: ['Sun', 'Moon', 'Jupiter'], enemies: ['Mercury'], neutral: ['Venus', 'Saturn'] },
            'Mercury': { friends: ['Sun', 'Venus'], enemies: ['Moon'], neutral: ['Mars', 'Jupiter', 'Saturn'] },
            'Jupiter': { friends: ['Sun', 'Moon', 'Mars'], enemies: ['Mercury', 'Venus'], neutral: ['Saturn'] },
            'Venus': { friends: ['Mercury', 'Saturn'], enemies: ['Sun', 'Moon'], neutral: ['Mars', 'Jupiter'] },
            'Saturn': { friends: ['Mercury', 'Venus'], enemies: ['Sun', 'Moon', 'Mars'], neutral: ['Jupiter'] }
        };

        // Bhakoot (Love/Emotional) - Max 7 points
        // Based on moon sign positions (houses apart)
        const signOrder = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

        // Nadi (Health/Genes) - Max 8 points - MOST IMPORTANT
        const nadiGroups = {
            'Aadi': ['Aries', 'Cancer', 'Libra', 'Capricorn'], // Vata
            'Madhya': ['Taurus', 'Leo', 'Scorpio', 'Aquarius'], // Pitta
            'Antya': ['Gemini', 'Virgo', 'Sagittarius', 'Pisces'] // Kapha
        };

        // Helper functions
        const getVarna = (sign) => {
            for (const [varna, signs] of Object.entries(varnaOrder)) {
                if (signs.includes(sign)) return varna;
            }
            return 'Shudra';
        };

        const getVashya = (sign) => {
            for (const [vashya, signs] of Object.entries(vashyaGroups)) {
                if (signs.includes(sign)) return vashya;
            }
            return 'Manava';
        };

        const getGana = (sign) => {
            for (const [gana, signs] of Object.entries(ganaGroups)) {
                if (signs.includes(sign)) return gana;
            }
            return 'Manushya';
        };

        const getNadi = (sign) => {
            for (const [nadi, signs] of Object.entries(nadiGroups)) {
                if (signs.includes(sign)) return nadi;
            }
            return 'Madhya';
        };

        // Calculate each Guna score

        // 1. VARNA (1 point max) - Groom's varna should be equal or higher
        const varna1 = getVarna(sign1);
        const varna2 = getVarna(sign2);
        let varnaScore = 0;
        if (varnaRank[varna1] >= varnaRank[varna2]) {
            varnaScore = 1;
        } else if (Math.abs(varnaRank[varna1] - varnaRank[varna2]) === 1) {
            varnaScore = 0.5;
        }

        // 2. VASHYA (2 points max) - Control/dominance compatibility
        const vashya1 = getVashya(sign1);
        const vashya2 = getVashya(sign2);
        let vashyaScore = 0;
        if (vashya1 === vashya2) {
            vashyaScore = 2;
        } else if ((vashya1 === 'Manava' && vashya2 === 'Chatushpada') || 
                   (vashya1 === 'Chatushpada' && vashya2 === 'Manava')) {
            vashyaScore = 1;
        } else if (vashya1 === 'Jalachara' || vashya2 === 'Jalachara') {
            vashyaScore = 0.5;
        }

        // 3. TARA (3 points max) - Birth star compatibility
        const nakshatra1 = signToNakshatra[sign1]?.index || 0;
        const nakshatra2 = signToNakshatra[sign2]?.index || 0;
        const taraDiff = Math.abs(nakshatra2 - nakshatra1) % 9;
        let taraScore = 0;
        // Favorable taras: 1, 2, 4, 6, 8, 9
        if ([0, 1, 3, 5, 7, 8].includes(taraDiff)) {
            taraScore = 3;
        } else if ([2, 4].includes(taraDiff)) {
            taraScore = 1.5;
        }

        // 4. YONI (4 points max) - Physical/sexual compatibility
        const yoni1 = yoniAnimals[sign1];
        const yoni2 = yoniAnimals[sign2];
        let yoniScore = 0;
        if (yoni1.animal === yoni2.animal) {
            yoniScore = 4; // Same animal
        } else if (yoniEnemies[yoni1.animal] === yoni2.animal) {
            yoniScore = 0; // Enemy animals
        } else if (yoni1.type !== yoni2.type) {
            yoniScore = 3; // Different genders, compatible
        } else {
            yoniScore = 2; // Neutral
        }

        // 5. GRAHA MAITRI (5 points max) - Planetary lord friendship
        const lord1 = signLords[sign1];
        const lord2 = signLords[sign2];
        let grahaMaitriScore = 0;
        if (lord1 === lord2) {
            grahaMaitriScore = 5;
        } else if (planetaryFriendship[lord1]?.friends.includes(lord2)) {
            grahaMaitriScore = 5;
        } else if (planetaryFriendship[lord1]?.neutral.includes(lord2)) {
            grahaMaitriScore = 3;
        } else if (planetaryFriendship[lord1]?.enemies.includes(lord2)) {
            grahaMaitriScore = 0;
        } else {
            grahaMaitriScore = 2;
        }

        // 6. GANA (6 points max) - Temperament compatibility
        const gana1 = getGana(sign1);
        const gana2 = getGana(sign2);
        let ganaScore = 0;
        if (gana1 === gana2) {
            ganaScore = 6;
        } else if ((gana1 === 'Deva' && gana2 === 'Manushya') || 
                   (gana1 === 'Manushya' && gana2 === 'Deva')) {
            ganaScore = 5;
        } else if ((gana1 === 'Manushya' && gana2 === 'Rakshasa') || 
                   (gana1 === 'Rakshasa' && gana2 === 'Manushya')) {
            ganaScore = 1;
        } else {
            ganaScore = 0; // Deva-Rakshasa is inauspicious
        }

        // 7. BHAKOOT (7 points max) - Moon sign house compatibility
        const pos1 = signOrder.indexOf(sign1);
        const pos2 = signOrder.indexOf(sign2);
        const houseDiff = ((pos2 - pos1 + 12) % 12) + 1;
        let bhakootScore = 7;
        // Inauspicious combinations: 2-12, 5-9, 6-8
        if ([2, 12].includes(houseDiff) || [5, 9].includes(houseDiff) || [6, 8].includes(houseDiff)) {
            bhakootScore = 0;
        }

        // 8. NADI (8 points max) - Health/genetic compatibility - MOST CRITICAL
        const nadi1 = getNadi(sign1);
        const nadi2 = getNadi(sign2);
        let nadiScore = 0;
        if (nadi1 !== nadi2) {
            nadiScore = 8; // Different nadis - excellent for progeny
        } else {
            nadiScore = 0; // Same nadi - Nadi Dosha (major defect)
        }

        // Calculate total score out of 36
        const totalScore = varnaScore + vashyaScore + taraScore + yoniScore + 
                          grahaMaitriScore + ganaScore + bhakootScore + nadiScore;
        const percentage = Math.round((totalScore / 36) * 100);

        // Determine match level
        let level, description;
        if (totalScore >= 28) {
            level = 'Uttam (Excellent)';
            description = 'Highly auspicious match with excellent compatibility in all aspects. This union is blessed.';
        } else if (totalScore >= 21) {
            level = 'Madhyam (Very Good)';
            description = 'Good compatibility with strong foundation. Minor differences can be easily resolved.';
        } else if (totalScore >= 18) {
            level = 'Average';
            description = 'Acceptable match. Success depends on mutual understanding and effort from both sides.';
        } else if (totalScore >= 14) {
            level = 'Below Average';
            description = 'Some challenges exist. Remedial measures (Pariharas) may be recommended.';
        } else {
            level = 'Avivaahya (Not Recommended)';
            description = 'Low compatibility. Traditional texts advise caution. Detailed analysis recommended.';
        }

        // Check for major Doshas
        const doshas = [];
        if (nadiScore === 0) doshas.push('Nadi Dosha');
        if (bhakootScore === 0) doshas.push('Bhakoot Dosha');
        if (ganaScore === 0) doshas.push('Gana Dosha');

        return { 
            score: percentage,
            totalGunas: totalScore,
            maxGunas: 36,
            description, 
            level,
            doshas,
            aspects: {
                'Varna (वर्ण)': { score: varnaScore, max: 1, desc: 'Spiritual compatibility' },
                'Vashya (वश्य)': { score: vashyaScore, max: 2, desc: 'Mutual attraction & control' },
                'Tara (तारा)': { score: taraScore, max: 3, desc: 'Birth star compatibility' },
                'Yoni (योनि)': { score: yoniScore, max: 4, desc: 'Physical & intimate compatibility' },
                'Graha Maitri (ग्रह मैत्री)': { score: grahaMaitriScore, max: 5, desc: 'Mental compatibility' },
                'Gana (गण)': { score: ganaScore, max: 6, desc: 'Temperament & nature' },
                'Bhakoot (भकूट)': { score: bhakootScore, max: 7, desc: 'Love & family welfare' },
                'Nadi (नाड़ी)': { score: nadiScore, max: 8, desc: 'Health & progeny' }
            },
            sign1,
            sign2,
            varna: { person1: varna1, person2: varna2 },
            gana: { person1: gana1, person2: gana2 },
            nadi: { person1: nadi1, person2: nadi2 }
        };
    },

    /**
     * Get daily guidance plan traits
     */
    getDailyTraits(zodiacSign) {
        const traits = {
            Aries: { lucky: [1, 9], color: 'Red', stone: 'Diamond', day: 'Tuesday' },
            Taurus: { lucky: [2, 6], color: 'Green', stone: 'Emerald', day: 'Friday' },
            Gemini: { lucky: [3, 5], color: 'Yellow', stone: 'Agate', day: 'Wednesday' },
            Cancer: { lucky: [2, 7], color: 'Silver', stone: 'Pearl', day: 'Monday' },
            Leo: { lucky: [1, 4], color: 'Gold', stone: 'Ruby', day: 'Sunday' },
            Virgo: { lucky: [5, 6], color: 'Green', stone: 'Sapphire', day: 'Wednesday' },
            Libra: { lucky: [6, 9], color: 'Pink', stone: 'Opal', day: 'Friday' },
            Scorpio: { lucky: [1, 4], color: 'Maroon', stone: 'Topaz', day: 'Tuesday' },
            Sagittarius: { lucky: [3, 5], color: 'Purple', stone: 'Turquoise', day: 'Thursday' },
            Capricorn: { lucky: [6, 8], color: 'Brown', stone: 'Garnet', day: 'Saturday' },
            Aquarius: { lucky: [4, 8], color: 'Blue', stone: 'Amethyst', day: 'Saturday' },
            Pisces: { lucky: [3, 7], color: 'Sea Green', stone: 'Aquamarine', day: 'Thursday' }
        };

        return traits[zodiacSign] || traits.Aries;
    },

    /**
     * Get personality traits for zodiac
     */
    getPersonalityTraits(zodiacSign) {
        const personalities = {
            Aries: {
                positive: ['Courageous', 'Determined', 'Confident', 'Enthusiastic', 'Optimistic', 'Honest', 'Passionate'],
                negative: ['Impatient', 'Moody', 'Short-tempered', 'Impulsive', 'Aggressive'],
                love: 'Passionate and adventurous in love. Seeks excitement and challenge.',
                career: 'Natural leaders who thrive in competitive environments.',
                health: 'Prone to headaches and stress-related issues. Needs physical activity.'
            },
            Taurus: {
                positive: ['Reliable', 'Patient', 'Practical', 'Devoted', 'Responsible', 'Stable'],
                negative: ['Stubborn', 'Possessive', 'Uncompromising', 'Materialistic'],
                love: 'Loyal and sensual partners who value security and comfort.',
                career: 'Excel in finance, arts, and any field requiring patience.',
                health: 'Throat and neck issues. Should avoid overindulgence.'
            },
            Gemini: {
                positive: ['Gentle', 'Affectionate', 'Curious', 'Adaptable', 'Quick learner', 'Witty'],
                negative: ['Nervous', 'Inconsistent', 'Indecisive', 'Superficial'],
                love: 'Needs mental stimulation. Seeks a partner who can keep up intellectually.',
                career: 'Communication, writing, teaching, and media.',
                health: 'Nervous system issues. Needs variety and mental stimulation.'
            },
            Cancer: {
                positive: ['Tenacious', 'Highly imaginative', 'Loyal', 'Emotional', 'Sympathetic', 'Persuasive'],
                negative: ['Moody', 'Pessimistic', 'Suspicious', 'Manipulative', 'Insecure'],
                love: 'Deeply emotional and nurturing. Values family above all.',
                career: 'Healthcare, hospitality, and home-related businesses.',
                health: 'Digestive issues. Emotional eating tendencies.'
            },
            Leo: {
                positive: ['Creative', 'Passionate', 'Generous', 'Warm-hearted', 'Cheerful', 'Humorous'],
                negative: ['Arrogant', 'Stubborn', 'Self-centered', 'Lazy', 'Inflexible'],
                love: 'Generous and loyal lovers who need admiration and respect.',
                career: 'Entertainment, leadership, arts, and politics.',
                health: 'Heart and back issues. Needs regular exercise.'
            },
            Virgo: {
                positive: ['Loyal', 'Analytical', 'Kind', 'Hardworking', 'Practical', 'Reliable'],
                negative: ['Shyness', 'Worry', 'Overly critical', 'All work no play', 'Perfectionist'],
                love: 'Shows love through acts of service. Values intelligence.',
                career: 'Healthcare, analysis, editing, and service industries.',
                health: 'Digestive issues and anxiety. Benefits from routine.'
            },
            Libra: {
                positive: ['Cooperative', 'Diplomatic', 'Gracious', 'Fair-minded', 'Social', 'Idealistic'],
                negative: ['Indecisive', 'Avoids confrontations', 'Self-pity', 'Carries grudges'],
                love: 'Seeks harmony and balance in relationships. Very romantic.',
                career: 'Law, diplomacy, arts, and design.',
                health: 'Kidney and lower back issues. Needs balance in all things.'
            },
            Scorpio: {
                positive: ['Resourceful', 'Brave', 'Passionate', 'Stubborn', 'True friend', 'Intuitive'],
                negative: ['Distrusting', 'Jealous', 'Secretive', 'Violent', 'Manipulative'],
                love: 'Intense and passionate. All or nothing approach to love.',
                career: 'Research, investigation, psychology, and healing.',
                health: 'Reproductive system issues. Needs emotional outlets.'
            },
            Sagittarius: {
                positive: ['Generous', 'Idealistic', 'Great sense of humor', 'Adventurous', 'Optimistic'],
                negative: ['Very impatient', 'Will say anything', 'Careless', 'Tactless'],
                love: 'Values freedom and adventure. Needs an independent partner.',
                career: 'Travel, philosophy, education, and publishing.',
                health: 'Hip and thigh issues. Prone to overexertion.'
            },
            Capricorn: {
                positive: ['Responsible', 'Disciplined', 'Self-control', 'Good managers', 'Ambitious'],
                negative: ['Know-it-all', 'Unforgiving', 'Condescending', 'Expecting the worst'],
                love: 'Slow to commit but deeply loyal once they do.',
                career: 'Business, administration, finance, and politics.',
                health: 'Bone and joint issues. Needs to manage stress.'
            },
            Aquarius: {
                positive: ['Progressive', 'Original', 'Independent', 'Humanitarian', 'Innovative'],
                negative: ['Runs from emotional expression', 'Temperamental', 'Uncompromising', 'Aloof'],
                love: 'Values friendship in relationships. Needs intellectual connection.',
                career: 'Technology, science, social work, and innovation.',
                health: 'Circulation issues. Needs mental stimulation.'
            },
            Pisces: {
                positive: ['Compassionate', 'Artistic', 'Intuitive', 'Gentle', 'Wise', 'Musical'],
                negative: ['Fearful', 'Overly trusting', 'Sad', 'Desire to escape reality', 'Victim mentality'],
                love: 'Deeply romantic and sensitive. Needs emotional connection.',
                career: 'Arts, healing, spirituality, and service.',
                health: 'Feet and immune system issues. Needs boundaries.'
            }
        };

        return personalities[zodiacSign] || personalities.Aries;
    },

    /**
     * Calculate ascendant/rising sign (simplified)
     */
    calculateAscendant(birthDate, birthTime = '12:00', latitude = 0, longitude = 0) {
        const moment = this.buildBirthMoment(birthDate, birthTime);
        if (!moment || !MAYA_CONFIG?.ZODIAC?.SIGNS?.length) {
            return MAYA_CONFIG?.ZODIAC?.SIGNS?.[0] || null;
        }

        const normalizedLatitude = Number.isFinite(Number(latitude)) ? Number(latitude) : 0;
        const normalizedLongitude = Number.isFinite(Number(longitude)) ? Number(longitude) : 0;

        const startOfYear = new Date(moment.getFullYear(), 0, 0);
        const dayOfYear = (moment - startOfYear) / (1000 * 60 * 60 * 24);
        const hours = moment.getHours() + moment.getMinutes() / 60;

        // Approximate local sidereal time using longitude and seasonal drift.
        const daysSinceJ2000 = (moment.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
        const greenwichSidereal = 18.697374558 + 24.06570982441908 * daysSinceJ2000;
        const localSidereal = this.normalizeHour(greenwichSidereal + normalizedLongitude / 15 + hours * 0.041);

        const seasonalTilt = Math.sin((dayOfYear / 365.25) * Math.PI * 2) * 4.5;
        const ascDegree = this.normalizeDegree(localSidereal * 15 + seasonalTilt + normalizedLatitude * 0.38);
        const signIndex = Math.floor(ascDegree / 30) % 12;

        return MAYA_CONFIG.ZODIAC.SIGNS[signIndex];
    },

    /**
     * Approximate planetary positions for a user's birth chart.
     * This is not ephemeris-grade astronomy, but it is user-derived and stable.
     */
    calculateBirthPlanets(birthDate, birthTime = '12:00', latitude = 0, longitude = 0) {
        const moment = this.buildBirthMoment(birthDate, birthTime);
        if (!moment || !MAYA_CONFIG?.PLANETS?.LIST?.length) {
            return this.getCurrentPlanets();
        }

        const epoch = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
        const daysSinceEpoch = (moment.getTime() - epoch.getTime()) / 86400000;
        const { hours, minutes, isApproximate } = this.parseTimeParts(birthTime);
        const timeFactor = (hours + minutes / 60) / 24;
        const geoOffset = (Number(latitude) || 0) * 0.03 + (Number(longitude) || 0) * 0.015;
        const siderealLongitudes = this.getSiderealLongitudes(birthDate, birthTime);

        const orbitalProfiles = {
            Sun: { period: 365.256, baseLongitude: 280.466, timeSensitivity: 0.18, geoSensitivity: 0.08 },
            Moon: { period: 27.322, baseLongitude: 218.316, timeSensitivity: 0.95, geoSensitivity: 0.15 },
            Mercury: { period: 87.969, baseLongitude: 252.251, timeSensitivity: 0.45, geoSensitivity: 0.1 },
            Venus: { period: 224.701, baseLongitude: 181.98, timeSensitivity: 0.35, geoSensitivity: 0.08 },
            Mars: { period: 686.98, baseLongitude: 355.433, timeSensitivity: 0.22, geoSensitivity: 0.06 },
            Jupiter: { period: 4332.589, baseLongitude: 34.351, timeSensitivity: 0.08, geoSensitivity: 0.04 },
            Saturn: { period: 10759.22, baseLongitude: 50.077, timeSensitivity: 0.04, geoSensitivity: 0.03 },
            Rahu: { period: 6798.383, baseLongitude: 125.045, retrograde: true, timeSensitivity: 0.03, geoSensitivity: 0.02 },
            Ketu: { offsetFrom: 'Rahu', offset: 180 }
        };

        let rahuLongitude = null;

        return MAYA_CONFIG.PLANETS.LIST.map((planet) => {
            const profile = orbitalProfiles[planet.name];
            if (!profile) {
                return {
                    ...planet,
                    sign: MAYA_CONFIG.ZODIAC.SIGNS[0],
                    degree: 0,
                    absoluteDegree: 0,
                    isApproximate
                };
            }

            let absoluteDegree;

            if (profile.offsetFrom === 'Rahu') {
                const baseRahu = Number.isFinite(rahuLongitude)
                    ? rahuLongitude
                    : this.normalizeDegree(
                        orbitalProfiles.Rahu.baseLongitude - daysSinceEpoch * (360 / orbitalProfiles.Rahu.period)
                    );
                absoluteDegree = this.normalizeDegree(baseRahu + profile.offset);
            } else if (planet.name === 'Sun' && Number.isFinite(siderealLongitudes.sunLongitude)) {
                absoluteDegree = siderealLongitudes.sunLongitude;
            } else if (planet.name === 'Moon' && Number.isFinite(siderealLongitudes.moonLongitude)) {
                absoluteDegree = siderealLongitudes.moonLongitude;
            } else {
                const direction = profile.retrograde ? -1 : 1;
                const motion = daysSinceEpoch * (360 / profile.period) * direction;
                absoluteDegree = this.normalizeDegree(
                    profile.baseLongitude +
                    motion +
                    timeFactor * (profile.timeSensitivity || 0) * 30 +
                    geoOffset * (profile.geoSensitivity || 0)
                );

                if (planet.name === 'Rahu') {
                    rahuLongitude = absoluteDegree;
                }
            }

            const signIndex = Math.floor(absoluteDegree / 30) % 12;
            return {
                ...planet,
                sign: MAYA_CONFIG.ZODIAC.SIGNS[signIndex],
                degree: Number((absoluteDegree % 30).toFixed(1)),
                absoluteDegree: Number(absoluteDegree.toFixed(1)),
                isApproximate
            };
        });
    },

    /**
     * Get current planetary positions (simplified)
     */
    getCurrentPlanets() {
        // This returns approximate positions
        // For accurate data, would need astronomical API
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        
        return MAYA_CONFIG.PLANETS.LIST.map((planet, index) => {
            // Simplified orbital period approximation
            const periods = [365, 27.3, 687, 88, 4333, 225, 10759, 0, 0];
            const offset = periods[index] ? (dayOfYear / periods[index]) * 360 : (dayOfYear + index * 30) % 360;
            const signIndex = Math.floor(offset / 30) % 12;
            
            return {
                ...planet,
                sign: MAYA_CONFIG.ZODIAC.SIGNS[signIndex],
                degree: Math.floor(offset % 30)
            };
        });
    },

    /**
     * Get complete astrological profile
     */
    getCompleteProfile(fullName, birthDate, birthTime, birthPlace) {
        const western = this.getWesternZodiac(birthDate);
        const vedic = this.getVedicZodiac(birthDate, { birthTime });
        const chinese = this.getChineseZodiac(birthDate);
        const personality = this.getPersonalityTraits(western.name);
        const dailyTraits = this.getDailyTraits(western.name);
        const ascendant = this.calculateAscendant(birthDate, birthTime);

        return {
            name: fullName,
            birthDate,
            birthTime,
            birthPlace,
            western,
            vedic,
            chinese,
            ascendant,
            personality,
            dailyTraits
        };
    }
};

// Make globally available
window.MayaAstrology = MayaAstrology;
