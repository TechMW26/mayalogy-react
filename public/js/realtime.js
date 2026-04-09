/**
 * MAYA - Gemini Live Voice Module
 * Provides live voice conversation using Gemini AI with browser speech recognition
 */

const MayaRealtime = {
    isConnected: false,
    isActive: false,
    isListening: false,
    recognition: null,
    onTranscript: null,
    onResponse: null,
    onStateChange: null,
    currentTranscript: '',

    /**
     * Check if user has completed funnel (required for realtime)
     */
    canUseRealtime() {
        const profile = MayaUtils?.storage?.get('maya_profile');
        return profile && profile.birthDate && profile.name;
    },

    /**
     * Initialize Gemini Live Voice connection
     */
    async init() {
        if (!this.canUseRealtime()) {
            console.log('📵 Realtime not available - funnel not completed');
            return false;
        }

        try {
            console.log('🎙️ Initializing Gemini Live Voice...');
            
            // Check for speech recognition support
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                throw new Error('Speech recognition not supported in this browser');
            }
            
            // Initialize speech recognition
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            // Set language based on user preference
            const language = MayaUtils?.storage?.get('maya_language') || 'en';
            this.recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
            
            this.setupRecognitionHandlers();
            
            this.isConnected = true;
            console.log('✅ Gemini Live Voice initialized!');
            
            if (this.onStateChange) {
                this.onStateChange('connected');
            }

            return true;

        } catch (error) {
            console.error('❌ Realtime init error:', error);
            this.isConnected = false;
            
            if (this.onStateChange) {
                this.onStateChange('error', error.message);
            }
            
            return false;
        }
    },

    /**
     * Setup speech recognition event handlers
     */
    setupRecognitionHandlers() {
        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            this.isActive = true;
            if (this.onStateChange) {
                this.onStateChange('user_speaking');
            }
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

            // Show interim results
            if (interimTranscript && this.onTranscript) {
                this.onTranscript(interimTranscript, 'interim');
            }

            // Process final transcript
            if (finalTranscript) {
                this.currentTranscript = finalTranscript;
                if (this.onTranscript) {
                    this.onTranscript(finalTranscript, 'user');
                }
                // Process with Gemini
                this.processWithGemini(finalTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                if (this.onStateChange) {
                    this.onStateChange('error', event.error);
                }
            }
        };

        this.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            this.isListening = false;
            if (this.onStateChange) {
                this.onStateChange('user_stopped');
            }
            
            // Auto-restart if still active (continuous listening mode)
            if (this.isActive && this.isConnected) {
                setTimeout(() => {
                    if (this.isActive && this.isConnected) {
                        try {
                            this.recognition.start();
                        } catch (e) {
                            console.log('Recognition restart skipped:', e.message);
                        }
                    }
                }, 100);
            }
        };
    },

    /**
     * Process transcript with Gemini AI
     */
    async processWithGemini(transcript) {
        if (!transcript.trim()) return;

        try {
            if (this.onStateChange) {
                this.onStateChange('ai_thinking');
            }

            // Stop listening while processing
            this.pauseListening();

            // Get response from Gemini
            const profile = MayaUtils?.storage?.get('maya_profile') || {};
            const language = MayaUtils?.storage?.get('maya_language') || 'en';
            
            // Initialize AI with user context if needed
            if (window.MayaAI && !MayaAI.userContext) {
                MayaAI.init(profile);
            }

            // Send to Gemini
            const response = await MayaAI.sendMessage(transcript);

            if (this.onResponse) {
                this.onResponse(response, 'done');
            }

            // Speak the response
            if (this.onStateChange) {
                this.onStateChange('ai_speaking');
            }

            if (window.MayaVoice && !MayaVoice.isMuted) {
                await MayaVoice.speak(response);
            }

            if (this.onStateChange) {
                this.onStateChange('ai_stopped');
            }

            // Resume listening after response
            this.resumeListening();

        } catch (error) {
            console.error('Gemini processing error:', error);
            if (this.onStateChange) {
                this.onStateChange('error', error.message);
            }
            this.resumeListening();
        }
    },

    /**
     * Start listening
     */
    startListening() {
        if (!this.isConnected || !this.recognition) {
            console.warn('Cannot start listening - not initialized');
            return;
        }

        try {
            this.isActive = true;
            this.recognition.start();
            console.log('🎤 Started listening');
        } catch (error) {
            console.error('Failed to start listening:', error);
        }
    },

    /**
     * Pause listening (during AI response)
     */
    pauseListening() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore
            }
        }
    },

    /**
     * Resume listening (after AI response)
     */
    resumeListening() {
        if (this.isActive && this.isConnected) {
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Resume listening skipped:', e.message);
                }
            }, 300);
        }
    },

    /**
     * Send text message (for typed input)
     */
    sendTextMessage(text) {
        if (!this.isConnected) return;
        
        if (this.onTranscript) {
            this.onTranscript(text, 'user');
        }
        this.processWithGemini(text);
    },

    /**
     * Toggle mute (stop/start listening)
     */
    setMuted(muted) {
        if (muted) {
            this.pauseListening();
            console.log('🎤 Microphone muted');
        } else {
            this.resumeListening();
            console.log('🎤 Microphone unmuted');
        }
    },

    /**
     * Stop and cleanup connection
     */
    stop() {
        this.isActive = false;
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore
            }
            this.recognition = null;
        }

        this.isConnected = false;
        this.isListening = false;
        
        console.log('🔌 Gemini Live Voice disconnected');
        
        if (this.onStateChange) {
            this.onStateChange('disconnected');
        }
    }
};

// Make globally available
window.MayaRealtime = MayaRealtime;
