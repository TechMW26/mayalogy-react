const COMPASS_CACHE_KEY = 'maya_compass_assets_v1';
const COMPASS_CACHE_VERSION = '20260909-compass-v1';
const MAX_COMPASS_ASSET_BYTES = 512 * 1024;

const COMPASS_ASSETS = {
  compassDial: '/compass-black-background_1063-119.avif',
  compassNeedle: '/19-194340_compass-needle-png-circle.png',
};

function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

function isValidCache(record) {
  return record?.version === COMPASS_CACHE_VERSION
    && isImageDataUrl(record.assets?.compassDial)
    && isImageDataUrl(record.assets?.compassNeedle);
}

function applyCompassAssets(assets) {
  const resolved = {
    compassDial: assets?.compassDial || COMPASS_ASSETS.compassDial,
    compassNeedle: assets?.compassNeedle || COMPASS_ASSETS.compassNeedle,
  };

  window.MayaAssets = resolved;
  document.documentElement.style.setProperty(
    '--maya-compass-dial-image',
    `url("${resolved.compassDial}")`,
  );
  return resolved;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Unable to read compass asset'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Compass asset request failed: ${response.status}`);

  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > MAX_COMPASS_ASSET_BYTES) {
    throw new Error('Compass asset response was invalid');
  }
  return blobToDataUrl(blob);
}

export async function preloadCompassAssets() {
  try {
    const cached = JSON.parse(localStorage.getItem(COMPASS_CACHE_KEY) || 'null');
    if (isValidCache(cached)) return applyCompassAssets(cached.assets);
  } catch (error) {
    console.warn('Stored compass assets could not be read:', error);
  }

  try {
    const [compassDial, compassNeedle] = await Promise.all([
      fetchImageAsDataUrl(COMPASS_ASSETS.compassDial),
      fetchImageAsDataUrl(COMPASS_ASSETS.compassNeedle),
    ]);
    const record = {
      version: COMPASS_CACHE_VERSION,
      assets: { compassDial, compassNeedle },
    };

    applyCompassAssets(record.assets);
    try {
      localStorage.setItem(COMPASS_CACHE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn('Compass assets loaded but could not be persisted:', error);
    }
    return record.assets;
  } catch (error) {
    console.warn('Compass preload failed; using static asset URLs:', error);
    return applyCompassAssets(COMPASS_ASSETS);
  }
}
