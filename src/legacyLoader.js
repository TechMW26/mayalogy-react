const BUILD_STAMP = '20260922-palm-reading-upload-fix';

const SCRIPT_SOURCES = [
  { src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js', optional: true },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', optional: true },
  { src: 'https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/gsap.min.js', optional: true },
  { src: `/js/runtime-env.js?v=${BUILD_STAMP}` },
  { src: `/js/config.js?v=${BUILD_STAMP}` },
  { src: `/js/utils.js?v=${BUILD_STAMP}` },
  { src: `/js/i18n.js?v=${BUILD_STAMP}` },
  { src: `/js/musicPlayer.js?v=${BUILD_STAMP}` },
  { src: `/js/numerology.js?v=${BUILD_STAMP}` },
  { src: `/js/vendor/astronomy.browser.min.js?v=${BUILD_STAMP}` },
  { src: `/js/astrology.js?v=${BUILD_STAMP}` },
  { src: `/js/kundli.js?v=${BUILD_STAMP}` },
  { src: `/js/lalkitab-knowledge.js?v=${BUILD_STAMP}` },
  { src: `/js/horoscopeApi.js?v=${BUILD_STAMP}` },
  { src: `/js/ai.js?v=${BUILD_STAMP}` },
  { src: `/js/voice.js?v=${BUILD_STAMP}` },
  { src: `/js/realtime.js?v=${BUILD_STAMP}` },
  { src: `/js/blob.js?v=${BUILD_STAMP}`, optional: true },
  { src: `/js/firebase.js?v=${BUILD_STAMP}` },
  { src: `/js/dbSync.js?v=${BUILD_STAMP}` },
  { src: `/js/auth.js?v=${BUILD_STAMP}` },
  { src: `/js/dynamicContent.js?v=${BUILD_STAMP}` },
  { src: `/js/statements.js?v=${BUILD_STAMP}` },
  { src: `/js/funnel.js?v=${BUILD_STAMP}` },
  { src: `/js/onboarding.js?v=${BUILD_STAMP}` },
  { src: `/js/pages.js?v=${BUILD_STAMP}` },
  { src: `/js/app.js?v=${BUILD_STAMP}` },
  { src: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js', optional: true },
];

function getBridgeState() {
  if (!window.__MAYA_REACT_BRIDGE__) {
    window.__MAYA_REACT_BRIDGE__ = {
      scriptPromises: {},
    };
  }

  return window.__MAYA_REACT_BRIDGE__;
}

function loadScript(src, { optional = false } = {}) {
  const bridgeState = getBridgeState();

  if (bridgeState.scriptPromises[src]) {
    return bridgeState.scriptPromises[src];
  }

  bridgeState.scriptPromises[src] = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-maya-src="${src}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve(existingScript);
        return;
      }

      if (existingScript.dataset.failed === 'true') {
        if (optional) {
          resolve(existingScript);
          return;
        }

        reject(new Error(`Failed to load ${src}`));
        return;
      }

      existingScript.addEventListener('load', () => resolve(existingScript), { once: true });
      existingScript.addEventListener(
        'error',
        () => {
          if (optional) {
            resolve(existingScript);
            return;
          }

          reject(new Error(`Failed to load ${src}`));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.mayaSrc = src;

    if (src.startsWith('http')) {
      script.crossOrigin = 'anonymous';
    }

    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve(script);
    };

    script.onerror = () => {
      script.dataset.failed = 'true';
      if (optional) {
        console.warn(`Optional script failed to load: ${src}`);
        resolve(script);
        return;
      }

      reject(new Error(`Failed to load ${src}`));
    };

    document.body.appendChild(script);
  });

  return bridgeState.scriptPromises[src];
}

async function loadGoogleMapsApiIfNeeded() {
  const mapsKey = window.MAYA_SECRETS?.GOOGLE_MAPS_KEY;

  if (!mapsKey) {
    console.log('🗺️ Using fallback place search (Nominatim)');
    return;
  }

  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places&callback=Function.prototype`,
    { optional: true },
  );
  console.log('🗺️ Google Maps API loading...');
}

export function bootLegacyMayalogy() {
  if (window.__MAYA_LEGACY_BOOT_PROMISE__) {
    return window.__MAYA_LEGACY_BOOT_PROMISE__;
  }

  window.__MAYA_LEGACY_BOOT_PROMISE__ = (async () => {
    await loadScript(SCRIPT_SOURCES[0].src, SCRIPT_SOURCES[0]);
    await loadScript(SCRIPT_SOURCES[1].src, SCRIPT_SOURCES[1]);
    await loadScript(SCRIPT_SOURCES[2].src, SCRIPT_SOURCES[2]);

    for (const entry of SCRIPT_SOURCES.slice(3, 5)) {
      await loadScript(entry.src, entry);
    }

    await loadGoogleMapsApiIfNeeded();

    for (const entry of SCRIPT_SOURCES.slice(5)) {
      await loadScript(entry.src, entry);
    }
  })().catch((error) => {
    window.__MAYA_LEGACY_BOOT_PROMISE__ = null;
    throw error;
  });

  return window.__MAYA_LEGACY_BOOT_PROMISE__;
}
