/**
 * MAYA - i18n Language Bridge Fix
 * Load this file AFTER i18n.js and BEFORE funnel.js / ai.js / voice.js.
 *
 * Purpose:
 * - Keep UI language locked to English if you want.
 * - Keep narration/app language separate and stable.
 * - Stop MayaI18n.getLanguage() from returning "en" when the user selected Hindi.
 * - Prevent "Language changed to: en" from confusing other modules.
 *
 * Why this matters:
 * Some modules may call MayaI18n.getLanguage() instead of reading maya_language.
 * Your current i18n.js locks currentLang to "en", so those modules can think the
 * selected language is English even when the onboarding language is Hindi.
 */

(function applyMayaI18nLanguageBridgeFix() {
    const STORAGE_KEY = "maya_language";

    function normalizeMayaLanguage(lang) {
        const raw = String(lang || "").trim().toLowerCase();

        if (
            raw === "hi" ||
            raw === "hin" ||
            raw === "hindi" ||
            raw === "hi-in" ||
            raw === "hinglish" ||
            raw === "hindi-hinglish" ||
            raw.startsWith("hi")
        ) {
            return "hi";
        }

        if (
            raw === "en" ||
            raw === "eng" ||
            raw === "english" ||
            raw === "en-in" ||
            raw === "en-us" ||
            raw === "en-gb" ||
            raw.startsWith("en")
        ) {
            return "en";
        }

        return raw.includes("hi") ? "hi" : "en";
    }

    function getStoredNarrationLanguage() {
        try {
            const fromMayaUtils = window.MayaUtils?.storage?.get?.(STORAGE_KEY);
            if (fromMayaUtils) return normalizeMayaLanguage(fromMayaUtils);
        } catch (_error) {}

        try {
            const fromLocalStorage = window.localStorage?.getItem?.(STORAGE_KEY);
            if (fromLocalStorage) return normalizeMayaLanguage(fromLocalStorage);
        } catch (_error) {}

        try {
            const profile = window.MayaUtils?.storage?.get?.("maya_profile") || {};
            if (profile.language) return normalizeMayaLanguage(profile.language);
        } catch (_error) {}

        try {
            const funnelData = window.MayaUtils?.storage?.get?.("funnel_data") || {};
            if (funnelData.language) return normalizeMayaLanguage(funnelData.language);
        } catch (_error) {}

        return "en";
    }

    function setStoredNarrationLanguage(lang) {
        const normalized = normalizeMayaLanguage(lang);

        try {
            window.MayaUtils?.storage?.set?.(STORAGE_KEY, normalized);
        } catch (_error) {}

        try {
            window.localStorage?.setItem?.(STORAGE_KEY, normalized);
        } catch (_error) {}

        try {
            const profile = window.MayaUtils?.storage?.get?.("maya_profile") || {};
            window.MayaUtils?.storage?.set?.("maya_profile", {
                ...profile,
                language: normalized
            });
        } catch (_error) {}

        try {
            const funnelData = window.MayaUtils?.storage?.get?.("funnel_data") || {};
            window.MayaUtils?.storage?.set?.("funnel_data", {
                ...funnelData,
                language: normalized
            });
        } catch (_error) {}

        if (window.MayaFunnel?.userData) {
            window.MayaFunnel.userData.language = normalized;
        }

        if (window.MayaAI?.userData) {
            window.MayaAI.userData.language = normalized;
        }

        if (window.MayaAI?.userContext) {
            window.MayaAI.userContext.language = normalized;
        }

        try {
            window.MayaStatements?.setLanguage?.(normalized);
        } catch (_error) {}

        try {
            window.MayaDynamicContent?.setLanguage?.(normalized);
        } catch (_error) {}

        try {
            window.MayaListener?.setLanguage?.(normalized);
        } catch (_error) {}

        return normalized;
    }

    function patchI18n() {
        if (!window.MayaI18n) {
            return false;
        }

        if (window.MayaI18n.__languageBridgeFixed) {
            return true;
        }

        const original = {
            init: window.MayaI18n.init?.bind(window.MayaI18n),
            setLanguage: window.MayaI18n.setLanguage?.bind(window.MayaI18n),
            getLanguage: window.MayaI18n.getLanguage?.bind(window.MayaI18n),
            isHindi: window.MayaI18n.isHindi?.bind(window.MayaI18n),
            bilingual: window.MayaI18n.bilingual?.bind(window.MayaI18n)
        };

        window.MayaI18n.uiLang = "en";
        window.MayaI18n.currentLang = "en";
        window.MayaI18n.__languageBridgeFixed = true;

        /**
         * UI language stays English.
         */
        window.MayaI18n.getUILanguage = function getUILanguage() {
            return "en";
        };

        /**
         * Narration/app language is the real selected language.
         * This is intentionally returned from getLanguage() too because some
         * existing modules use MayaI18n.getLanguage() to decide AI/TTS language.
         */
        window.MayaI18n.getNarrationLanguage = function getNarrationLanguage() {
            return getStoredNarrationLanguage();
        };

        window.MayaI18n.getLanguage = function getLanguage() {
            return getStoredNarrationLanguage();
        };

        window.MayaI18n.isHindi = function isHindi() {
            return getStoredNarrationLanguage() === "hi";
        };

        window.MayaI18n.setNarrationLanguage = function setNarrationLanguage(lang, options = {}) {
            const normalized = setStoredNarrationLanguage(lang);

            if (options.applyUI !== false) {
                try {
                    window.MayaStatements?.setLanguage?.(normalized);
                    window.MayaDynamicContent?.setLanguage?.(normalized);
                } catch (_error) {}
            }

            console.log("🌐 Narration language changed to:", normalized);
            return normalized;
        };

        /**
         * Keep old setLanguage() calls safe:
         * - If called by onboarding/app language preference, store narration language.
         * - UI still remains English.
         * - Do not falsely log "Language changed to: en" when user selected Hindi.
         */
        window.MayaI18n.setLanguage = async function setLanguage(lang, options = {}) {
            const normalized = normalizeMayaLanguage(lang);

            if (options?.uiOnly === true) {
                this.currentLang = "en";
                this.uiLang = "en";
                await this.translatePage?.();
                console.log("🌐 UI language locked to: en");
                return;
            }

            setStoredNarrationLanguage(normalized);

            // UI text remains English.
            this.currentLang = "en";
            this.uiLang = "en";

            await this.translatePage?.();

            console.log("🌐 Narration language changed to:", normalized, "| UI language locked to: en");
        };

        window.MayaI18n.bilingual = function bilingual(english, hindi) {
            return getStoredNarrationLanguage() === "hi" ? hindi : english;
        };

        window.MayaI18n.init = function init() {
            if (this.initialized) return;

            this.currentLang = "en";
            this.uiLang = "en";

            try {
                this.loadCache?.();
            } catch (_error) {}

            if (document.body) {
                try {
                    this.setupMutationObserver?.();
                } catch (_error) {}
            }

            this.initialized = true;

            console.log(
                "🌐 MayaI18n initialized | UI language: en | Narration language:",
                getStoredNarrationLanguage()
            );

            // Keep UI English.
            try {
                this.translatePage?.();
            } catch (_error) {}
        };

        /**
         * Compatibility helper for app/funnel startup.
         */
        window.MayaI18n.syncNarrationLanguage = function syncNarrationLanguage(lang = null) {
            const normalized = setStoredNarrationLanguage(lang || getStoredNarrationLanguage());
            this.currentLang = "en";
            this.uiLang = "en";
            console.log("🌐 Synced narration language:", normalized, "| UI language: en");
            return normalized;
        };

        /**
         * Expose globally so funnel / onboarding can call it before first speech.
         */
        window.MayaSyncNarrationLanguage = function MayaSyncNarrationLanguage(lang = null) {
            return window.MayaI18n.syncNarrationLanguage(lang);
        };

        return true;
    }

    if (!patchI18n()) {
        const timer = setInterval(() => {
            if (patchI18n()) {
                clearInterval(timer);
            }
        }, 25);

        setTimeout(() => clearInterval(timer), 5000);
    }
})();