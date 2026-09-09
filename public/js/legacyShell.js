export const LEGACY_SHELL_HTML = String.raw`
<div id="app-container" class="app-container d-none">
    <header id="main-header" class="main-header">
        <div class="header-content">
            <button class="btn btn-link menu-toggle" id="sidebar-toggle" aria-label="Toggle menu" title="Toggle menu" data-i18n-aria-label="Toggle menu" data-i18n-title="Toggle menu">
                <i class="bi bi-list"></i>
            </button>
            <div class="header-logo">
                <img src="/images/maya-logo.png" alt="Mayalogy" class="logo-icon">
                <div class="header-brand-copy">
                    <span class="logo-name">Mayalogy</span>
                    <span class="header-section-name" id="current-page-title">Home</span>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-link header-profile-btn" data-page="profile" aria-label="Open profile" title="Profile">
                    <i class="bi bi-person-circle"></i>
                </button>
                <button class="btn btn-link" id="notifications-btn" aria-label="Notifications" title="Notifications" data-i18n-aria-label="Notifications" data-i18n-title="Notifications">
                    <i class="bi bi-bell"></i>
                    <span class="notification-badge d-none">3</span>
                </button>
            </div>
        </div>
    </header>

    <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <div class="user-profile" data-page="profile" style="cursor: pointer;">
                <div class="avatar-circle" id="sidebar-avatar">
                    <i class="bi bi-person"></i>
                </div>
                <div class="user-info" id="user-info">
                    <span class="user-name" id="user-name" data-i18n="Guest">Guest</span>
                    <div class="user-day-status" id="user-day-status"></div>
                </div>
            </div>
            <button class="btn btn-link sidebar-close d-md-none" id="sidebar-close">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <nav class="sidebar-nav" aria-label="Main navigation">
            <p class="sidebar-nav__label">Today</p>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link active" href="#" data-page="home">
                        <i class="bi bi-house-heart"></i>
                        <span data-i18n="Home">Home</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="horoscope">
                        <i class="bi bi-sun"></i>
                        <span data-i18n="Daily Horoscope">Daily Horoscope</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-action="showMaya">
                        <i class="bi bi-chat-square-text"></i>
                        <span>Ask MAYA</span>
                    </a>
                </li>
            </ul>
            <p class="sidebar-nav__label">Charts &amp; insights</p>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="kundli">
                        <i class="bi bi-diagram-3"></i>
                        <span data-i18n="Kundli">Kundli</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="numerology">
                        <i class="bi bi-123"></i>
                        <span data-i18n="Numerology">Numerology</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="compatibility">
                        <i class="bi bi-hearts"></i>
                        <span data-i18n="Compatibility">Compatibility</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="muhurat">
                        <i class="bi bi-calendar-check"></i>
                        <span data-i18n="Muhurat">Muhurat</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="panchang">
                        <i class="bi bi-calendar3"></i>
                        <span data-i18n="Panchang">Panchang</span>
                    </a>
                </li>
            </ul>
            <p class="sidebar-nav__label">Guidance tools</p>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="remedies">
                        <i class="bi bi-gem"></i>
                        <span data-i18n="Remedies">Remedies</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="vastu">
                        <i class="bi bi-compass"></i>
                        <span data-i18n="Vastu">Vastu</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="palm-reading">
                        <i class="bi bi-hand-index"></i>
                        <span data-i18n="Palm Reading">Palm Reading</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="spiritual-music">
                        <i class="bi bi-music-note-beamed"></i>
                        <span data-i18n="Spiritual Music">Spiritual Music</span>
                    </a>
                </li>
            </ul>
            <p class="sidebar-nav__label">Account</p>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="chat-history">
                        <i class="bi bi-chat-dots"></i>
                        <span data-i18n="Chat History">Chat History</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="profile">
                        <i class="bi bi-person"></i>
                        <span data-i18n="Profile">Profile</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-page="settings">
                        <i class="bi bi-gear"></i>
                        <span data-i18n="Settings">Settings</span>
                    </a>
                </li>
            </ul>
        </nav>
    </aside>

    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <aside id="notifications-panel" class="notifications-panel">
        <div class="notifications-header">
            <h5><i class="bi bi-bell me-2"></i><span data-i18n="Notifications">Notifications</span></h5>
            <button class="btn btn-link" id="notifications-close" title="Close notifications" data-i18n-title="Close notifications">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div class="notifications-body" id="notifications-body">
            <div class="notification-item">
                <div class="notification-icon"><i class="bi bi-hourglass-split"></i></div>
                <div class="notification-content">
                    <p class="notification-text" data-i18n="Loading your personalized updates...">Loading your personalized updates...</p>
                    <span class="notification-time" data-i18n="Please wait">Please wait</span>
                </div>
            </div>
        </div>
    </aside>
    <div class="notifications-overlay" id="notifications-overlay"></div>

    <main id="main-content" class="main-content"></main>

    <nav id="bottom-nav" class="bottom-nav d-md-none">
        <a href="#" class="nav-item active" data-page="home">
            <i class="bi bi-house"></i>
            <span data-i18n="Home">Home</span>
        </a>
        <a href="#" class="nav-item" data-page="horoscope">
            <i class="bi bi-sun"></i>
            <span data-i18n="Horoscope">Horoscope</span>
        </a>
        <button class="nav-item maya-btn" id="maya-nav-btn" aria-label="Ask MAYA">
            <span class="maya-nav-blob" aria-hidden="true"><span></span></span>
        </button>
        <a href="#" class="nav-item" data-page="kundli">
            <i class="bi bi-diagram-3"></i>
            <span data-i18n="Kundli">Kundli</span>
        </a>
        <a href="#" class="nav-item" data-page="profile">
            <i class="bi bi-person"></i>
            <span data-i18n="Profile">Profile</span>
        </a>
    </nav>
</div>

<div id="maya-overlay" class="maya-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="maya-overlay-title">
    <div class="maya-overlay-header">
        <button type="button" class="btn back-btn" id="maya-back" aria-label="Back" data-i18n-aria="Back">
            <i class="bi bi-arrow-left"></i>
        </button>
        <div class="maya-overlay-header__identity" id="maya-overlay-title">
            <span class="maya-overlay-header__mark" aria-hidden="true"><i class="bi bi-stars"></i></span>
            <span>
                <strong>Talk to MAYA</strong>
                <small>Your personal guide</small>
            </span>
        </div>
        <div class="maya-overlay-header__actions">
            <button type="button" class="btn history-btn" id="maya-history" aria-label="Chat history" data-i18n-aria="Chat history">
                <i class="bi bi-clock-history"></i>
            </button>
            <button type="button" class="btn close-btn" id="maya-close" aria-label="Close" data-i18n-aria="Close">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    </div>
    <div class="maya-blob-container" id="maya-blob-container"></div>
    <div class="maya-text-display" id="maya-text-display">
        <p class="maya-speaking-text" id="maya-speaking-text"></p>
    </div>
    <div class="maya-funnel-controls" id="maya-funnel-controls" style="display: none;">
        <button class="maya-funnel-btn" id="maya-pause-btn" title="Pause" data-i18n-title="Pause">
            <i class="bi bi-pause-fill"></i>
        </button>
    </div>
    <div class="maya-input-area" id="maya-input-area" style="display: none;">
        <button class="btn btn-outline-primary mic-btn" id="maya-mic" title="Hold to speak" data-i18n-title="Hold to speak">
            <i class="bi bi-mic"></i>
        </button>
        <input type="text" class="form-control" id="maya-input" placeholder="Ask MAYA anything..." data-i18n-placeholder="Ask MAYA anything...">
        <button class="btn btn-primary" id="maya-send">
            <i class="bi bi-send"></i>
        </button>
    </div>
</div>

<div class="modal fade" id="onboardingModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-fullscreen-onboarding">
        <div class="modal-content onboarding-modal">
            <div class="modal-body p-0">
                <div class="onboarding-main">
                    <div class="onboarding-content" id="onboardingContent">
                        <div class="text-center p-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-3" data-i18n="Loading your journey...">Loading your journey...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="authModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content auth-modal">
            <div class="modal-body">
                <div class="auth-container" id="auth-container"></div>
            </div>
        </div>
    </div>
</div>

<div class="toast-container position-fixed top-0 start-50 translate-middle-x p-3" id="toast-container" style="z-index: 9999;"></div>
`;
