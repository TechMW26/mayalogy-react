/**
 * MAYA - Internationalization (i18n) Module
 * Dynamic translation service without persistent caching
 */

const MayaI18n = {
    // Current language
    currentLang: 'en',
    
    // Initialization flag
    initialized: false,
    
    // Translation cache to avoid repeated API calls
    cache: new Map(),
    cacheEnabled: false,
    
    // DOM elements marked for translation
    observedElements: new Set(),
    
    // Translation dictionary for common UI strings (fallback)
    dictionary: {
        // Navigation
        'Home': { hi: 'होम' },
        'Kundli': { hi: 'कुंडली' },
        'Horoscope': { hi: 'राशिफल' },
        'Match': { hi: 'मिलान' },
        'Chat': { hi: 'चैट' },
        'Profile': { hi: 'प्रोफाइल' },
        'Settings': { hi: 'सेटिंग्स' },
        'Panchang': { hi: 'पंचांग' },
        'Remedies': { hi: 'उपाय' },
        'Muhurat': { hi: 'मुहूर्त' },
        'Vastu': { hi: 'वास्तु' },
        'Palm Reading': { hi: 'हस्तरेखा' },
        'Numerology': { hi: 'अंक ज्योतिष' },
        'Compatibility': { hi: 'अनुकूलता' },
        'Bhakti Music': { hi: 'भक्ति संगीत' },
        'Spiritual Music': { hi: 'आध्यात्मिक संगीत' },
        
        // Common Actions
        'Save': { hi: 'सहेजें' },
        'Cancel': { hi: 'रद्द करें' },
        'Close': { hi: 'बंद करें' },
        'Back': { hi: 'वापस' },
        'Next': { hi: 'आगे' },
        'Submit': { hi: 'जमा करें' },
        'Delete': { hi: 'हटाएं' },
        'Edit': { hi: 'संपादित करें' },
        'View': { hi: 'देखें' },
        'Share': { hi: 'साझा करें' },
        'Download': { hi: 'डाउनलोड' },
        'Loading...': { hi: 'लोड हो रहा है...' },
        'Please wait...': { hi: 'कृपया प्रतीक्षा करें...' },
        'Error': { hi: 'त्रुटि' },
        'Success': { hi: 'सफलता' },
        'Warning': { hi: 'चेतावनी' },
        'Retry': { hi: 'पुनः प्रयास' },
        
        // Headers & Titles
        'Good Morning': { hi: 'शुभ प्रभात' },
        'Good Afternoon': { hi: 'शुभ अपराह्न' },
        'Good Evening': { hi: 'शुभ संध्या' },
        'Welcome': { hi: 'स्वागत' },
        'Today': { hi: 'आज' },
        'Tomorrow': { hi: 'कल' },
        'Yesterday': { hi: 'कल' },
        'This Week': { hi: 'इस सप्ताह' },
        'This Month': { hi: 'इस महीने' },
        'This Year': { hi: 'इस वर्ष' },
        
        // Days
        'Sunday': { hi: 'रविवार' },
        'Monday': { hi: 'सोमवार' },
        'Tuesday': { hi: 'मंगलवार' },
        'Wednesday': { hi: 'बुधवार' },
        'Thursday': { hi: 'गुरुवार' },
        'Friday': { hi: 'शुक्रवार' },
        'Saturday': { hi: 'शनिवार' },
        
        // Zodiac Signs
        'Aries': { hi: 'मेष' },
        'Taurus': { hi: 'वृषभ' },
        'Gemini': { hi: 'मिथुन' },
        'Cancer': { hi: 'कर्क' },
        'Leo': { hi: 'सिंह' },
        'Virgo': { hi: 'कन्या' },
        'Libra': { hi: 'तुला' },
        'Scorpio': { hi: 'वृश्चिक' },
        'Sagittarius': { hi: 'धनु' },
        'Capricorn': { hi: 'मकर' },
        'Aquarius': { hi: 'कुंभ' },
        'Pisces': { hi: 'मीन' },
        
        // Planets
        'Sun': { hi: 'सूर्य' },
        'Moon': { hi: 'चंद्र' },
        'Mars': { hi: 'मंगल' },
        'Mercury': { hi: 'बुध' },
        'Jupiter': { hi: 'बृहस्पति' },
        'Venus': { hi: 'शुक्र' },
        'Saturn': { hi: 'शनि' },
        'Rahu': { hi: 'राहु' },
        'Ketu': { hi: 'केतु' },
        
        // Horoscope Categories
        'Daily Horoscope': { hi: 'दैनिक राशिफल' },
        'Weekly Horoscope': { hi: 'साप्ताहिक राशिफल' },
        'Monthly Horoscope': { hi: 'मासिक राशिफल' },
        'Yearly Horoscope': { hi: 'वार्षिक राशिफल' },
        'Love': { hi: 'प्रेम' },
        'Career': { hi: 'करियर' },
        'Health': { hi: 'स्वास्थ्य' },
        'Finance': { hi: 'वित्त' },
        'Family': { hi: 'परिवार' },
        
        // Panchang
        'Tithi': { hi: 'तिथि' },
        'Nakshatra': { hi: 'नक्षत्र' },
        'Yoga': { hi: 'योग' },
        'Karana': { hi: 'करण' },
        'Sunrise': { hi: 'सूर्योदय' },
        'Sunset': { hi: 'सूर्यास्त' },
        'Moonrise': { hi: 'चंद्रोदय' },
        'Moonset': { hi: 'चंद्रास्त' },
        'Rahu Kaal': { hi: 'राहु काल' },
        'Auspicious Time': { hi: 'शुभ समय' },
        'Inauspicious Time': { hi: 'अशुभ समय' },
        
        // Muhurat
        'Shubh Muhurat': { hi: 'शुभ मुहूर्त' },
        'Marriage': { hi: 'विवाह' },
        'Property': { hi: 'संपत्ति' },
        'Vehicle': { hi: 'वाहन' },
        'Business': { hi: 'व्यापार' },
        'Travel': { hi: 'यात्रा' },
        'Education': { hi: 'शिक्षा' },
        'Medical': { hi: 'चिकित्सा' },
        'Griha Pravesh': { hi: 'गृह प्रवेश' },
        'Namkaran': { hi: 'नामकरण' },
        'Mundan': { hi: 'मुंडन' },
        
        // Remedies
        'Gemstones': { hi: 'रत्न' },
        'Mantras': { hi: 'मंत्र' },
        'Donations': { hi: 'दान' },
        'Fasting': { hi: 'व्रत' },
        'Puja': { hi: 'पूजा' },
        'Yantra': { hi: 'यंत्र' },
        'Rudraksha': { hi: 'रुद्राक्ष' },
        
        // Spiritual Music
        'Aarti': { hi: 'आरती' },
        'Bhajan': { hi: 'भजन' },
        'Mantra': { hi: 'मंत्र' },
        'Chalisa': { hi: 'चालीसा' },
        'Meditation': { hi: 'ध्यान' },
        'Morning Prayers': { hi: 'प्रातः प्रार्थना' },
        'Evening Prayers': { hi: 'संध्या प्रार्थना' },
        'Now Playing': { hi: 'अभी बज रहा है' },
        
        // Vastu
        'Direction': { hi: 'दिशा' },
        'North': { hi: 'उत्तर' },
        'South': { hi: 'दक्षिण' },
        'East': { hi: 'पूर्व' },
        'West': { hi: 'पश्चिम' },
        'Northeast': { hi: 'ईशान' },
        'Northwest': { hi: 'वायव्य' },
        'Southeast': { hi: 'आग्नेय' },
        'Southwest': { hi: 'नैऋत्य' },
        'Entrance': { hi: 'प्रवेश द्वार' },
        'Kitchen': { hi: 'रसोई' },
        'Bedroom': { hi: 'शयनकक्ष' },
        'Bathroom': { hi: 'स्नानघर' },
        'Living Room': { hi: 'बैठक' },
        'Pooja Room': { hi: 'पूजा कक्ष' },
        'Study Room': { hi: 'अध्ययन कक्ष' },
        
        // Profile & Settings
        'Name': { hi: 'नाम' },
        'Date of Birth': { hi: 'जन्म तिथि' },
        'Time of Birth': { hi: 'जन्म समय' },
        'Place of Birth': { hi: 'जन्म स्थान' },
        'Gender': { hi: 'लिंग' },
        'Male': { hi: 'पुरुष' },
        'Female': { hi: 'महिला' },
        'Other': { hi: 'अन्य' },
        'Email': { hi: 'ईमेल' },
        'Phone': { hi: 'फोन' },
        'Language': { hi: 'भाषा' },
        'Theme': { hi: 'थीम' },
        'Dark': { hi: 'डार्क' },
        'Light': { hi: 'लाइट' },
        'System': { hi: 'सिस्टम' },
        'Notifications': { hi: 'सूचनाएं' },
        'Voice': { hi: 'आवाज़' },
        'Guest': { hi: 'अतिथि' },
        'Toggle menu': { hi: 'मेनू खोलें' },
        'Close notifications': { hi: 'सूचनाएं बंद करें' },
        'Logout': { hi: 'लॉग आउट' },
        'Log Out': { hi: 'लॉग आउट' },
        
        // Messages
        'Ask MAYA': { hi: 'MAYA से पूछें' },
        'Ask MAYA anything...': { hi: 'MAYA से कुछ भी पूछें...' },
        'Type your question...': { hi: 'अपना प्रश्न लिखें...' },
        'Thinking...': { hi: 'सोच रहा हूं...' },
        'No results found': { hi: 'कोई परिणाम नहीं मिला' },
        'Something went wrong': { hi: 'कुछ गलत हो गया' },
        'Please try again': { hi: 'कृपया पुनः प्रयास करें' },
        'Are you sure?': { hi: 'क्या आप निश्चित हैं?' },
        
        // Speed Dial
        'Speed Dial': { hi: 'स्पीड डायल' },
        
        // Status
        'Great Day': { hi: 'शुभ दिन' },
        'Mixed Day': { hi: 'सामान्य दिन' },
        'Be Mindful': { hi: 'सावधान रहें' },
        'Auspicious': { hi: 'शुभ' },
        'Inauspicious': { hi: 'अशुभ' },
        'Neutral': { hi: 'तटस्थ' },
        
        // Compatibility
        'Compatibility Score': { hi: 'अनुकूलता स्कोर' },
        'Gun Milan': { hi: 'गुण मिलान' },
        'Excellent Match': { hi: 'उत्तम मिलान' },
        'Good Match': { hi: 'अच्छा मिलान' },
        'Average Match': { hi: 'सामान्य मिलान' },
        'Poor Match': { hi: 'कमजोर मिलान' },
        
        // Numerology
        'Life Path Number': { hi: 'जीवन पथ अंक' },
        'Destiny Number': { hi: 'भाग्य अंक' },
        'Soul Number': { hi: 'आत्मा अंक' },
        'Personality Number': { hi: 'व्यक्तित्व अंक' },
        'Lucky Number': { hi: 'भाग्यशाली अंक' },
        'Lucky Color': { hi: 'भाग्यशाली रंग' },
        'Lucky Day': { hi: 'भाग्यशाली दिन' },
        
        // History
        'History': { hi: 'इतिहास' },
        'Chat History': { hi: 'चैट इतिहास' },
        'Recent': { hi: 'हाल ही में' },
        'Clear All': { hi: 'सभी हटाएं' },
        'No history': { hi: 'कोई इतिहास नहीं' },
        
        // Compatibility Page
        'Love Compatibility': { hi: 'प्रेम अनुकूलता' },
        'Discover your cosmic connection with your partner': { hi: 'अपने साथी के साथ अपने ब्रह्मांडीय संबंध की खोज करें' },
        'Person 1': { hi: 'व्यक्ति 1' },
        'Person 2': { hi: 'व्यक्ति 2' },
        'Enter name': { hi: 'नाम दर्ज करें' },
        "Enter partner's name": { hi: 'साथी का नाम दर्ज करें' },
        'Select': { hi: 'चुनें' },
        'Birth Date': { hi: 'जन्म तिथि' },
        'Birth Time': { hi: 'जन्म समय' },
        'Birth Place': { hi: 'जन्म स्थान' },
        'City, State, Country': { hi: 'शहर, राज्य, देश' },
        'Check Compatibility': { hi: 'अनुकूलता जांचें' },
        'How it works': { hi: 'यह कैसे काम करता है' },
        'Friend': { hi: 'मित्र' },
        
        // Greetings
        'Hello': { hi: 'नमस्ते' },
        'Namaste': { hi: 'नमस्ते' },
        
        // Horoscope Page
        'Listen': { hi: 'सुनें' },
        '(Tap for details)': { hi: '(टैप करें विस्तार के लिए)' },
        'Luck': { hi: 'भाग्य' },
        'Want personalized guidance?': { hi: 'व्यक्तिगत मार्गदर्शन चाहिए?' },
        'Ask MAYA': { hi: 'MAYA से पूछें' },
        
        // Chat History
        'No Conversations Yet': { hi: 'कोई चैट नहीं' },
        'Start chatting with MAYA and your conversations will appear here.': { hi: 'MAYA से बात करें और आपकी बातचीत यहां दिखाई देगी।' },
        'Chat with MAYA': { hi: 'MAYA से बात करें' },
        
        // Panchang
        'Shukla Paksha': { hi: 'शुक्ल पक्ष' },
        'Krishna Paksha': { hi: 'कृष्ण पक्ष' },
        'Vikram Samvat': { hi: 'विक्रम संवत्' },
        
        // Kundli
        'Birth Details Required': { hi: 'जन्म विवरण आवश्यक' },
        'Please add your birth date in profile to view your Kundli.': { hi: 'अपनी कुंडली देखने के लिए कृपया प्रोफाइल में जन्म तिथि जोड़ें।' },
        'North Indian': { hi: 'उत्तर भारतीय' },
        'South Indian': { hi: 'दक्षिण भारतीय' },
        
        // Vastu
        'Upload Floor Plan': { hi: 'फ्लोर प्लान अपलोड करें' },
        'Take Photo': { hi: 'फोटो लें' },
        'Analyze': { hi: 'विश्लेषण करें' },
        'Vastu Score': { hi: 'वास्तु स्कोर' },
        'Direction Analysis': { hi: 'दिशा विश्लेषण' },
        'Vastu Tips': { hi: 'वास्तु टिप्स' },
        'Vastu Remedies': { hi: 'वास्तु उपाय' },
        
        // Palm Reading
        'Upload Palm Image': { hi: 'हथेली की छवि अपलोड करें' },
        'Take Photo of Palm': { hi: 'हथेली की फोटो लें' },
        'Palm Analysis': { hi: 'हस्तरेखा विश्लेषण' },
        
        // Common UI
        'See All': { hi: 'सभी देखें' },
        'View All': { hi: 'सभी देखें' },
        'Learn More': { hi: 'और जानें' },
        'Read More': { hi: 'और पढ़ें' },
        'Show Less': { hi: 'कम दिखाएं' },
        'Show More': { hi: 'और दिखाएं' },
        'Go Back': { hi: 'वापस जाएं' },
        'Continue': { hi: 'जारी रखें' },
        'Skip': { hi: 'छोड़ें' },
        'Done': { hi: 'हो गया' },
        'OK': { hi: 'ठीक है' },
        'Yes': { hi: 'हां' },
        'No': { hi: 'नहीं' },
        'Confirm': { hi: 'पुष्टि करें' },
        'Reset': { hi: 'रीसेट' },
        'Update': { hi: 'अपडेट करें' },
        'Apply': { hi: 'लागू करें' },
        'Search': { hi: 'खोजें' },
        'Filter': { hi: 'फ़िल्टर' },
        'Sort': { hi: 'क्रम' },
        'Copy': { hi: 'कॉपी करें' },
        'Copied!': { hi: 'कॉपी हो गया!' },
        
        // Status Messages
        'Analyzing...': { hi: 'विश्लेषण हो रहा है...' },
        'Processing...': { hi: 'प्रोसेसिंग हो रही है...' },
        'Calculating...': { hi: 'गणना हो रही है...' },
        'Generating...': { hi: 'तैयार हो रहा है...' },
        'Connecting...': { hi: 'कनेक्ट हो रहा है...' },
        'Sending...': { hi: 'भेजा जा रहा है...' },
        'Saving...': { hi: 'सहेजा जा रहा है...' },
        'Uploading...': { hi: 'अपलोड हो रहा है...' },
        'Complete': { hi: 'पूर्ण' },
        'Failed': { hi: 'विफल' },
        'Offline': { hi: 'ऑफलाइन' },
        'Online': { hi: 'ऑनलाइन' },
        
        // Complete Sentences - Home Page
        'Daily Devotional Music & Mantras': { hi: 'दैनिक भक्ति संगीत और मंत्र' },
        'Your personalized cosmic guidance': { hi: 'आपका व्यक्तिगत ज्योतिषीय मार्गदर्शन' },
        'Explore your destiny through Vedic astrology': { hi: 'वैदिक ज्योतिष से अपनी नियति जानें' },
        'Start your spiritual journey today': { hi: 'आज ही अपनी आध्यात्मिक यात्रा शुरू करें' },
        'Discover what the stars have in store for you': { hi: 'जानिए सितारे आपके लिए क्या लेकर आए हैं' },
        
        // Complete Sentences - Horoscope
        'Your daily cosmic insights': { hi: 'आज का आपका राशिफल' },
        "Today's cosmic energy for you": { hi: 'आज की ब्रह्मांडीय ऊर्जा आपके लिए' },
        'Based on your birth chart': { hi: 'आपकी जन्म कुंडली के अनुसार' },
        'Tap any category for detailed insights': { hi: 'विस्तृत जानकारी के लिए किसी भी श्रेणी पर टैप करें' },
        
        // Complete Sentences - Music Player
        'Now Playing': { hi: 'अभी बज रहा है' },
        'Playing': { hi: 'बज रहा है' },
        'Paused': { hi: 'रुका हुआ' },
        'Pause': { hi: 'रोकें' },
        'Resume': { hi: 'फिर शुरू करें' },
        'Ended': { hi: 'समाप्त' },
        'Buffering...': { hi: 'लोड हो रहा है...' },
        'Mini player active - music will continue': { hi: 'मिनी प्लेयर सक्रिय - संगीत चलता रहेगा' },
        'Drag down for mini player': { hi: 'मिनी प्लेयर के लिए नीचे खींचें' },

        // Home & shell
        'Moon Sign': { hi: 'चंद्र राशि' },
        'Unknown': { hi: 'अज्ञात' },
        'Calculate': { hi: 'गणना करें' },
        'Life Path': { hi: 'जीवन पथ' },
        "Today's Cosmic Message": { hi: 'आज का ब्रह्मांडीय संदेश' },
        'Read Full Horoscope': { hi: 'पूरा राशिफल पढ़ें' },
        'Get Your Full Reading': { hi: 'अपनी पूरी रीडिंग पाएं' },
        'Discover what the cosmos has in store for your love, career, and destiny.': { hi: 'जानिए प्रेम, करियर और नियति के लिए ब्रह्मांड ने आपके लिए क्या संजोया है।' },
        'Start Reading': { hi: 'रीडिंग शुरू करें' },
        'Your Lucky Elements': { hi: 'आपके शुभ तत्व' },
        'Lucky Numbers': { hi: 'भाग्यशाली अंक' },
        'Gemstone': { hi: 'रत्न' },
        'Loading your personalized updates...': { hi: 'आपके निजी अपडेट लोड हो रहे हैं...' },
        'Please wait': { hi: 'कृपया प्रतीक्षा करें' },
        'Hold to speak': { hi: 'बोलने के लिए दबाकर रखें' },
        'Loading your journey...': { hi: 'आपकी यात्रा तैयार हो रही है...' },
        'The Leader': { hi: 'नेता' },
        'The Peacemaker': { hi: 'समन्वयक' },
        'The Communicator': { hi: 'संवादक' },
        'The Builder': { hi: 'निर्माता' },
        'The Explorer': { hi: 'अन्वेषक' },
        'The Nurturer': { hi: 'पालनकर्ता' },
        'The Seeker': { hi: 'साधक' },
        'The Achiever': { hi: 'सफलकर्ता' },
        'The Humanitarian': { hi: 'मानवतावादी' },
        'The Visionary': { hi: 'दृष्टा' },
        'The Master Builder': { hi: 'महान निर्माता' },
        'The Master Teacher': { hi: 'महान शिक्षक' },
        
        // Complete Sentences - Chat
        'How can I help you today?': { hi: 'आज मैं आपकी कैसे सहायता कर सकता हूं?' },
        'Ask me anything about astrology': { hi: 'ज्योतिष के बारे में कुछ भी पूछें' },
        'Type your question here...': { hi: 'अपना प्रश्न यहां लिखें...' },
        'Thinking about your question...': { hi: 'आपके प्रश्न पर विचार कर रहा हूं...' },
        
        // Complete Sentences - Profile & Settings
        'Your cosmic profile': { hi: 'आपकी ज्योतिषीय प्रोफाइल' },
        'Update your birth details for accurate predictions': { hi: 'सटीक भविष्यवाणी के लिए अपना जन्म विवरण अपडेट करें' },
        'Language changed to English': { hi: 'भाषा अंग्रेजी में बदल गई' },
        'Language changed to Hindi': { hi: 'भाषा हिंदी में बदल गई' },
        
        // Complete Sentences - Compatibility
        'Find your cosmic match': { hi: 'अपना ज्योतिषीय मेल खोजें' },
        'Enter both birth details for accurate matching': { hi: 'सटीक मिलान के लिए दोनों के जन्म विवरण दर्ज करें' },
        'Calculating your compatibility...': { hi: 'आपकी अनुकूलता की गणना हो रही है...' },
        
        // Complete Sentences - Panchang
        'Today\'s Vedic Calendar': { hi: 'आज का वैदिक कैलेंडर' },
        'Auspicious timings for today': { hi: 'आज के शुभ मुहूर्त' },
        'Avoid important activities during this time': { hi: 'इस समय महत्वपूर्ण कार्य न करें' },
        
        // Complete Sentences - Remedies
        'Personalized remedies for you': { hi: 'आपके लिए व्यक्तिगत उपाय' },
        'Based on your planetary positions': { hi: 'आपकी ग्रह स्थिति के अनुसार' },
        'Follow these remedies for better results': { hi: 'बेहतर परिणामों के लिए इन उपायों का पालन करें' },
        
        // Complete Sentences - Muhurat
        'Find the perfect time': { hi: 'सही समय खोजें' },
        'Auspicious timing for your activities': { hi: 'आपके कार्यों के लिए शुभ मुहूर्त' },
        'Best time for important decisions': { hi: 'महत्वपूर्ण निर्णयों के लिए सर्वोत्तम समय' },
        
        // Complete Sentences - Vastu
        'Analyze your space': { hi: 'अपने स्थान का विश्लेषण करें' },
        'Get Vastu recommendations for your home': { hi: 'अपने घर के लिए वास्तु सुझाव प्राप्त करें' },
        'Harmonize your living space': { hi: 'अपने रहने की जगह को संतुलित करें' },
        
        // Complete Sentences - Errors & Empty States
        'Something went wrong. Please try again.': { hi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' },
        'No data available': { hi: 'कोई डेटा उपलब्ध नहीं' },
        'Unable to load content': { hi: 'सामग्री लोड करने में असमर्थ' },
        'Please check your internet connection': { hi: 'कृपया अपना इंटरनेट कनेक्शन जांचें' },
        'Session expired. Please login again.': { hi: 'सत्र समाप्त हो गया। कृपया पुनः लॉगिन करें।' },
        
        // Complete Sentences - Spiritual Music
        'For Today': { hi: 'आज के लिए' },
        'High Energy': { hi: 'उच्च ऊर्जा' },
        'All': { hi: 'सभी' },
        "Today's Special": { hi: 'आज का विशेष' },
        'Your Rashi': { hi: 'आपकी राशि' },
        'Workout': { hi: 'वर्कआउट' },
        'Morning': { hi: 'सुबह' },
        'Evening': { hi: 'शाम' },
        'No videos found': { hi: 'कोई वीडियो नहीं मिला' },
        'Error loading videos': { hi: 'वीडियो लोड करने में त्रुटि' },
        'Aarti Collection': { hi: 'आरती संग्रह' },
        'Workout Bhakti': { hi: 'वर्कआउट भक्ति' }
    },
    
    /**
     * Initialize the translation service
     */
    init() {
        if (this.initialized) return;
        
        // Get saved language preference
        if (window.MayaUtils) {
            this.currentLang = MayaUtils.storage.get('maya_language') || 'en';
        } else {
            // Fallback if MayaUtils not loaded yet
            try {
                this.currentLang = localStorage.getItem('maya_language') || 'en';
            } catch (e) {
                this.currentLang = 'en';
            }
        }
        
        // Load cache from localStorage
        this.loadCache();
        
        // Set up mutation observer to auto-translate new elements
        if (document.body) {
            this.setupMutationObserver();
        }
        
        this.initialized = true;
        console.log('🌐 MayaI18n initialized, language:', this.currentLang);
        
        // Initial page translation if Hindi is selected
        if (this.currentLang === 'hi') {
            this.translatePage();
        }
    },
    
    /**
     * Load translation cache from localStorage
     */
    loadCache() {
        try {
            this.cache = new Map();
            localStorage.removeItem('maya_translation_cache');
            localStorage.removeItem('maya_maya_translation_cache');
        } catch (e) {
            console.warn('Failed to load translation cache:', e);
        }
    },
    
    /**
     * Save translation cache to localStorage
     */
    saveCache() {
        return;
    },
    
    /**
     * Set current language and translate page
     */
    async setLanguage(lang, options = {}) {
        const resolvedLang = lang === 'hi' ? 'hi' : 'en';
        const force = options.force === true;

        if (resolvedLang === this.currentLang && !force) return;
        
        this.currentLang = resolvedLang;
        MayaUtils.storage.set('maya_language', resolvedLang);
        
        // Translate all observed elements
        await this.translatePage();
        
        console.log('🌐 Language changed to:', resolvedLang);
    },
    
    /**
     * Get current language
     */
    getLanguage() {
        return this.currentLang;
    },
    
    /**
     * Check if current language is Hindi
     */
    isHindi() {
        return this.currentLang === 'hi';
    },

    getAttributeDatasetKey(attr) {
        switch (attr) {
            case 'placeholder':
                return 'i18nPlaceholder';
            case 'title':
                return 'i18nTitle';
            case 'aria-label':
                return 'i18nAriaLabel';
            default:
                return null;
        }
    },

    getAttributeOriginalDatasetKey(attr) {
        switch (attr) {
            case 'placeholder':
                return 'i18nPlaceholderOriginal';
            case 'title':
                return 'i18nTitleOriginal';
            case 'aria-label':
                return 'i18nAriaLabelOriginal';
            default:
                return null;
        }
    },

    translateAttributes(root = document) {
        const selector = '[placeholder], [title], [aria-label], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]';
        const elements = [];

        if (root?.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) {
            elements.push(root);
        }

        if (root?.querySelectorAll) {
            elements.push(...root.querySelectorAll(selector));
        }

        for (const el of elements) {
            ['placeholder', 'title', 'aria-label'].forEach((attr) => {
                const datasetKey = this.getAttributeDatasetKey(attr);
                const originalKey = this.getAttributeOriginalDatasetKey(attr);
                if (!datasetKey || !originalKey) return;

                const currentValue = el.getAttribute(attr);
                const translationKey = el.dataset[datasetKey] || el.dataset[originalKey] || currentValue;
                if (!translationKey) return;

                if (!el.dataset[originalKey] && currentValue) {
                    el.dataset[originalKey] = currentValue;
                }

                const translated = this.t(translationKey);
                if (translated) {
                    el.setAttribute(attr, translated);
                }
            });
        }
    },

    restoreTranslatedAttributes(root = document) {
        const selector = '[data-i18n-placeholder-original], [data-i18n-title-original], [data-i18n-aria-label-original]';
        const elements = [];

        if (root?.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) {
            elements.push(root);
        }

        if (root?.querySelectorAll) {
            elements.push(...root.querySelectorAll(selector));
        }

        for (const el of elements) {
            ['placeholder', 'title', 'aria-label'].forEach((attr) => {
                const originalKey = this.getAttributeOriginalDatasetKey(attr);
                if (originalKey && el.dataset[originalKey]) {
                    el.setAttribute(attr, el.dataset[originalKey]);
                }
            });
        }
    },
    
    /**
     * Translate a single string
     */
    t(text, targetLang = null) {
        const lang = targetLang || this.currentLang;
        
        // If English requested or text is empty, return as-is
        if (lang === 'en' || !text || typeof text !== 'string') {
            return text;
        }
        
        // Trim the text for lookup
        const trimmedText = text.trim();
        
        // Check dictionary first (instant)
        if (this.dictionary[trimmedText] && this.dictionary[trimmedText][lang]) {
            return this.dictionary[trimmedText][lang];
        }
        
        // Check cache
        const cacheKey = `${trimmedText}:${lang}`;
        if (this.cacheEnabled && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Return original if no translation found
        return text;
    },
    
    /**
     * Translate text asynchronously (with API fallback)
     */
    async translateAsync(text, targetLang = null) {
        const lang = targetLang || this.currentLang;
        
        // If English requested or text is empty, return as-is
        if (lang === 'en' || !text || typeof text !== 'string') {
            return text;
        }
        
        const trimmedText = text.trim();
        
        // Check dictionary first
        if (this.dictionary[trimmedText] && this.dictionary[trimmedText][lang]) {
            return this.dictionary[trimmedText][lang];
        }
        
        // Check cache
        const cacheKey = `${trimmedText}:${lang}`;
        if (this.cacheEnabled && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // For longer texts, use AI translation via MAYA
        if (trimmedText.length > 5 && window.MayaAI) {
            try {
                const translated = await this.translateWithAI(trimmedText, lang);
                if (translated && translated !== trimmedText) {
                    if (this.cacheEnabled) {
                        this.cache.set(cacheKey, translated);
                        this.saveCache();
                    }
                    return translated;
                }
            } catch (e) {
                console.warn('AI translation failed:', e);
            }
        }
        
        return text;
    },
    
    /**
     * Translate using MAYA AI
     */
    async translateWithAI(text, targetLang) {
        if (!window.MayaAI) return text;
        
        const langName = targetLang === 'hi' ? 'Hindi' : 'English';
        const prompt = `Translate the following UI text to ${langName}. Return ONLY the translated text, nothing else:\n\n"${text}"`;
        
        try {
            const response = await MayaAI.getResponse(prompt, { stream: false });
            // Clean up response - remove quotes and extra whitespace
            return response.replace(/^["']|["']$/g, '').trim();
        } catch (e) {
            return text;
        }
    },
    
    /**
     * Batch translate multiple strings
     */
    translateBatch(texts) {
        return texts.map(text => this.t(text));
    },
    
    /**
     * Mark an element for translation observation
     */
    observe(element) {
        if (!element) return;
        this.observedElements.add(element);
    },
    
    /**
     * Translate all text in the page
     */
    async translatePage() {
        document.documentElement.lang = this.currentLang === 'hi' ? 'hi' : 'en';

        if (this.currentLang === 'en') {
            // Restore original English text
            document.querySelectorAll('[data-i18n-original]').forEach(el => {
                el.textContent = el.dataset.i18nOriginal;
            });
            this.restoreTranslatedAttributes(document);
            return;
        }
        
        // Find all translatable elements
        const translatableSelectors = [
            '.maya-page__title',
            '.maya-page__subtitle',
            '.maya-section__title',
            '.maya-settings__item-label',
            '.maya-settings__item-desc',
            '.maya-settings__group-title',
            '.maya-btn',
            '.nav-link span',
            '.sidebar-link span',
            '.maya-card__title',
            '.maya-card__subtitle',
            '.user-name',
            '.notification-text',
            '.notification-time',
            '.bottom-nav .nav-item span',
            '[data-i18n]'
        ];
        
        const elements = document.querySelectorAll(translatableSelectors.join(', '));
        
        for (const el of elements) {
            // Use data-i18n attribute if present, otherwise use text content
            const i18nKey = el.dataset.i18n;
            const originalText = el.dataset.i18nOriginal || (i18nKey || el.textContent);
            
            // Store original if not already stored
            if (!el.dataset.i18nOriginal) {
                el.dataset.i18nOriginal = i18nKey || originalText;
            }
            
            // Translate using key if available
            const textToTranslate = i18nKey || originalText.trim();
            const translated = this.t(textToTranslate);
            if (translated !== textToTranslate) {
                el.textContent = translated;
            }
        }

        this.translateAttributes(document);
    },
    
    /**
     * Setup mutation observer to auto-translate new elements
     */
    setupMutationObserver() {
        if (this.observer) return;
        
        this.observer = new MutationObserver((mutations) => {
            if (this.currentLang === 'en') return;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Translate the new element and its children
                            this.translateElement(node);
                        }
                    });
                }
            }
        });
        
        // Start observing
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    
    /**
     * Translate a single element and its children
     */
    translateElement(element) {
        if (this.currentLang === 'en') return;
        
        // Check if element has translatable text
        const translatableSelectors = [
            '.maya-page__title',
            '.maya-page__subtitle',
            '.maya-section__title',
            '.maya-btn',
            '.bottom-nav .nav-item span',
            '[data-i18n]'
        ];
        
        // Check the element itself
        for (const selector of translatableSelectors) {
            if (element.matches && element.matches(selector)) {
                const i18nKey = element.dataset.i18n;
                const originalText = i18nKey || element.textContent.trim();
                const translated = this.t(originalText);
                if (translated !== originalText) {
                    if (!element.dataset.i18nOriginal) {
                        element.dataset.i18nOriginal = originalText;
                    }
                    element.textContent = translated;
                }
            }
        }
        
        // Check children
        const children = element.querySelectorAll?.(translatableSelectors.join(', '));
        children?.forEach(child => {
            const i18nKey = child.dataset.i18n;
            const originalText = i18nKey || child.textContent.trim();
            const translated = this.t(originalText);
            if (translated !== originalText) {
                if (!child.dataset.i18nOriginal) {
                    child.dataset.i18nOriginal = originalText;
                }
                child.textContent = translated;
            }
        });

        this.translateAttributes(element);
    },
    
    /**
     * Helper to create bilingual text
     */
    bilingual(english, hindi) {
        return this.currentLang === 'hi' ? hindi : english;
    },
    
    /**
     * Add translations to dictionary at runtime
     */
    addTranslations(translations) {
        Object.assign(this.dictionary, translations);
    }
};

// Make globally available immediately
window.MayaI18n = MayaI18n;

// Shorthand translation function
window.__ = (text) => MayaI18n.t(text);

// Initialize early - try immediately if possible
try {
    // Get language from localStorage directly for early init
    const savedLang = localStorage.getItem('maya_language');
    if (savedLang) {
        MayaI18n.currentLang = savedLang;
    }
    MayaI18n.loadCache();
} catch (e) {
    // Ignore - will initialize properly on DOMContentLoaded
}

// Full initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    MayaI18n.init();
});

// Also try when body is available
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => MayaI18n.init(), 10);
}
