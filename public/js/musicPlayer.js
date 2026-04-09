/**
 * MAYA - Global Music Player Module
 * Persistent audio player with PiP and background playback support
 */

const MayaMusicPlayer = {
    currentVideoId: null,
    currentTitle: '',
    isPlaying: false,
    isMinimized: false,
    player: null, // YouTube IFrame API player
    pipWindow: null,
    
    /**
     * Initialize the music player
     */
    init() {
        // Create persistent player container in body
        this.createPlayerUI();
        
        // Load YouTube IFrame API
        this.loadYouTubeAPI();
        
        // Setup visibility change listener for background playback
        this.setupBackgroundPlayback();
        
        // Setup Media Session API for lock screen controls
        this.setupMediaSession();
        
        console.log('🎵 MayaMusicPlayer initialized');
    },
    
    /**
     * Create the persistent player UI
     */
    createPlayerUI() {
        // Check if player already exists
        if (document.getElementById('maya-global-player')) return;
        
        const isHindi = window.MayaUtils?.storage.get('maya_language') === 'hi';
        
        const playerHTML = `
            <div class="maya-global-player" id="maya-global-player">
                <div class="maya-global-player__container">
                    <!-- Mini Player View -->
                    <div class="maya-global-player__mini" id="maya-player-mini">
                        <div class="maya-global-player__mini-info">
                            <div class="maya-global-player__mini-icon">
                                <i class="bi bi-music-note-beamed"></i>
                            </div>
                            <div class="maya-global-player__mini-text">
                                <span class="maya-global-player__mini-title" id="maya-player-title">
                                    ${isHindi ? 'भक्ति संगीत' : 'Bhakti Music'}
                                </span>
                                <span class="maya-global-player__mini-status">
                                    <span class="maya-global-player__status-dot"></span>
                                    <span id="maya-player-status">${isHindi ? 'बज रहा है' : 'Playing'}</span>
                                </span>
                            </div>
                        </div>
                        <div class="maya-global-player__mini-controls">
                            <button class="maya-global-player__btn" id="maya-player-pip" title="Picture-in-Picture">
                                <i class="bi bi-pip"></i>
                            </button>
                            <button class="maya-global-player__btn" id="maya-player-play-pause">
                                <i class="bi bi-pause-fill" id="maya-play-icon"></i>
                            </button>
                            <button class="maya-global-player__btn maya-global-player__btn--expand" id="maya-player-expand">
                                <i class="bi bi-chevron-up"></i>
                            </button>
                            <button class="maya-global-player__btn maya-global-player__btn--close" id="maya-player-close">
                                <i class="bi bi-x"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Expanded Player View -->
                    <div class="maya-global-player__expanded" id="maya-player-expanded">
                        <div class="maya-global-player__expanded-header">
                            <button class="maya-global-player__btn" id="maya-player-minimize">
                                <i class="bi bi-chevron-down"></i>
                            </button>
                            <span class="maya-global-player__now-playing">
                                ${isHindi ? 'अभी बज रहा है' : 'Now Playing'}
                            </span>
                            <button class="maya-global-player__btn maya-global-player__btn--pip" id="maya-player-pip-expanded" title="Picture-in-Picture">
                                <i class="bi bi-pip"></i>
                            </button>
                        </div>
                        <div class="maya-global-player__video-container">
                            <div id="maya-youtube-player"></div>
                        </div>
                        <div class="maya-global-player__expanded-controls">
                            <h4 class="maya-global-player__track-title" id="maya-player-track-title">
                                ${isHindi ? 'भक्ति संगीत' : 'Bhakti Music'}
                            </h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', playerHTML);
        
        // Setup event listeners
        this.setupEventListeners();
    },
    
    /**
     * Load YouTube IFrame API
     */
    loadYouTubeAPI() {
        if (window.YT) {
            this.onYouTubeAPIReady();
            return;
        }
        
        // Load the API script
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        // Set callback
        window.onYouTubeIframeAPIReady = () => {
            this.onYouTubeAPIReady();
        };
    },
    
    /**
     * Called when YouTube API is ready
     */
    onYouTubeAPIReady() {
        console.log('🎬 YouTube IFrame API ready');
        
        // Create player instance
        this.player = new YT.Player('maya-youtube-player', {
            height: '100%',
            width: '100%',
            playerVars: {
                autoplay: 0,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                playsinline: 1, // Important for iOS
                enablejsapi: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (e) => this.onPlayerReady(e),
                onStateChange: (e) => this.onPlayerStateChange(e),
                onError: (e) => this.onPlayerError(e)
            }
        });
    },
    
    /**
     * Player ready callback
     */
    onPlayerReady(event) {
        console.log('🎵 YouTube player ready');
    },
    
    /**
     * Player state change callback
     */
    onPlayerStateChange(event) {
        const playIcon = document.getElementById('maya-play-icon');
        const statusEl = document.getElementById('maya-player-status');
        const isHindi = window.MayaUtils?.storage.get('maya_language') === 'hi';
        
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                this.isPlaying = true;
                if (playIcon) playIcon.className = 'bi bi-pause-fill';
                if (statusEl) statusEl.textContent = isHindi ? 'बज रहा है' : 'Playing';
                this.updateMediaSession();
                break;
            case YT.PlayerState.PAUSED:
                this.isPlaying = false;
                if (playIcon) playIcon.className = 'bi bi-play-fill';
                if (statusEl) statusEl.textContent = isHindi ? 'रुका हुआ' : 'Paused';
                break;
            case YT.PlayerState.ENDED:
                this.isPlaying = false;
                if (playIcon) playIcon.className = 'bi bi-play-fill';
                if (statusEl) statusEl.textContent = isHindi ? 'समाप्त' : 'Ended';
                break;
            case YT.PlayerState.BUFFERING:
                if (statusEl) statusEl.textContent = isHindi ? 'लोड हो रहा है...' : 'Buffering...';
                break;
        }
    },
    
    /**
     * Player error callback
     */
    onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        const statusEl = document.getElementById('maya-player-status');
        const isHindi = window.MayaUtils?.storage.get('maya_language') === 'hi';
        if (statusEl) statusEl.textContent = isHindi ? 'त्रुटि' : 'Error';
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Play/Pause
        document.getElementById('maya-player-play-pause')?.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        // Close
        document.getElementById('maya-player-close')?.addEventListener('click', () => {
            this.close();
        });
        
        // Expand
        document.getElementById('maya-player-expand')?.addEventListener('click', () => {
            this.expand();
        });
        
        // Minimize
        document.getElementById('maya-player-minimize')?.addEventListener('click', () => {
            this.minimize();
        });
        
        // PiP buttons
        document.getElementById('maya-player-pip')?.addEventListener('click', () => {
            this.requestPiP();
        });
        document.getElementById('maya-player-pip-expanded')?.addEventListener('click', () => {
            this.requestPiP();
        });
        
        // Click on mini player to expand
        document.getElementById('maya-player-mini')?.addEventListener('click', (e) => {
            if (e.target.closest('.maya-global-player__btn')) return; // Don't expand if clicking button
            this.expand();
        });
    },
    
    /**
     * Play a video
     */
    play(videoId, title = 'Bhakti Music') {
        this.currentVideoId = videoId;
        this.currentTitle = title;
        
        // Update UI
        const titleEls = document.querySelectorAll('#maya-player-title, #maya-player-track-title');
        titleEls.forEach(el => el.textContent = title);
        
        // Show player
        const playerEl = document.getElementById('maya-global-player');
        if (playerEl) {
            playerEl.classList.add('maya-global-player--visible');
        }
        
        // Load and play video
        if (this.player && this.player.loadVideoById) {
            this.player.loadVideoById(videoId);
            this.expand(); // Show expanded view when starting
        } else {
            // API not ready yet, retry
            setTimeout(() => this.play(videoId, title), 500);
        }
        
        // Update media session
        this.updateMediaSession();
    },
    
    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (!this.player) return;
        
        if (this.isPlaying) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
    },
    
    /**
     * Close the player
     */
    close() {
        const playerEl = document.getElementById('maya-global-player');
        if (playerEl) {
            playerEl.classList.remove('maya-global-player--visible', 'maya-global-player--expanded');
        }
        
        if (this.player) {
            this.player.stopVideo();
        }
        
        this.isPlaying = false;
        this.currentVideoId = null;
        this.currentTitle = '';
        
        // Clear any saved state to prevent auto-restore
        sessionStorage.removeItem('maya_music_state');
        
        // Exit PiP if active
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
        }
    },
    
    /**
     * Expand player
     */
    expand() {
        const playerEl = document.getElementById('maya-global-player');
        if (playerEl) {
            playerEl.classList.add('maya-global-player--expanded');
        }
        this.isMinimized = false;
    },
    
    /**
     * Minimize player
     */
    minimize() {
        const playerEl = document.getElementById('maya-global-player');
        if (playerEl) {
            playerEl.classList.remove('maya-global-player--expanded');
        }
        this.isMinimized = true;
    },
    
    /**
     * Request Picture-in-Picture mode
     */
    async requestPiP() {
        try {
            // Get the video element from the iframe
            const iframe = document.querySelector('#maya-youtube-player iframe');
            if (!iframe) {
                console.log('No iframe found for PiP');
                return;
            }
            
            // For YouTube iframe, we need to use the internal video element
            // This is tricky due to cross-origin restrictions
            // Alternative: Open in a mini window
            
            // Try to get video element (may not work due to cross-origin)
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const video = iframeDoc.querySelector('video');
                if (video && document.pictureInPictureEnabled) {
                    await video.requestPictureInPicture();
                    return;
                }
            } catch (e) {
                // Cross-origin restriction
            }
            
            // Fallback: Create a mini floating window
            this.createMiniWindow();
            
        } catch (error) {
            console.error('PiP error:', error);
            // Show toast
            if (window.MayaUtils?.toast) {
                const isHindi = MayaUtils.storage.get('maya_language') === 'hi';
                MayaUtils.toast.info(isHindi ? 'मिनी प्लेयर के लिए नीचे खींचें' : 'Drag down for mini player');
            }
        }
    },
    
    /**
     * Create a mini floating window for PiP-like experience
     */
    createMiniWindow() {
        // Just minimize to the floating mini player
        this.minimize();
        
        const isHindi = window.MayaUtils?.storage.get('maya_language') === 'hi';
        if (window.MayaUtils?.toast) {
            MayaUtils.toast.success(isHindi ? 'मिनी प्लेयर सक्रिय - संगीत चलता रहेगा' : 'Mini player active - music will continue');
        }
    },
    
    /**
     * Setup background playback handlers
     */
    setupBackgroundPlayback() {
        // Keep playing when tab becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isPlaying) {
                // Tab is hidden but music should continue
                // YouTube iframe should handle this, but we ensure it
                console.log('🎵 Tab hidden, music continues...');
            }
        });
        
        // Handle page navigation within the app
        window.addEventListener('beforeunload', (e) => {
            if (this.isPlaying) {
                // Save current state for potential restoration
                sessionStorage.setItem('maya_music_state', JSON.stringify({
                    videoId: this.currentVideoId,
                    title: this.currentTitle,
                    isPlaying: this.isPlaying
                }));
            }
        });
        
        // Restore state on page load
        this.restoreState();
    },
    
    /**
     * Restore playback state
     */
    restoreState() {
        try {
            const savedState = sessionStorage.getItem('maya_music_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (state.videoId && state.isPlaying) {
                    // Auto-resume after a short delay
                    setTimeout(() => {
                        this.play(state.videoId, state.title);
                    }, 1000);
                }
                sessionStorage.removeItem('maya_music_state');
            }
        } catch (e) {
            // Ignore
        }
    },
    
    /**
     * Setup Media Session API for lock screen/notification controls
     */
    setupMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                if (this.player) this.player.playVideo();
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                if (this.player) this.player.pauseVideo();
            });
            
            navigator.mediaSession.setActionHandler('stop', () => {
                this.close();
            });
        }
    },
    
    /**
     * Update Media Session metadata
     */
    updateMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentTitle,
                artist: 'MAYA Bhakti Music',
                album: 'Spiritual Music',
                artwork: [
                    { src: `https://img.youtube.com/vi/${this.currentVideoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
                    { src: `https://img.youtube.com/vi/${this.currentVideoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
                ]
            });
            
            navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MayaMusicPlayer.init();
});

// Also try immediate init if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => MayaMusicPlayer.init(), 100);
}

// Make globally available
window.MayaMusicPlayer = MayaMusicPlayer;
