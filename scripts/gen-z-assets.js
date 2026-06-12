// Generates Z-logo PNG assets for app icon, splash, and adaptive foreground.
// Run with: node scripts/gen-z-assets.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.resolve(__dirname, '..', 'assets');

// Color palette
const INK = '#1f1c17';
const ACCENT = '#6f9b80';
const ACCENT_SOFT = '#cfe0d4';
const BG = '#f4eee2';
const BG_DEEP = '#ebe1cc';

function zLogoSvg({
  canvas = 1024,
  bg = null,
  ink = INK,
  accent = ACCENT,
  haloSoft = ACCENT_SOFT,
  withHalo = true,
  scale = 0.5,
}) {
  // Z geometry: horizontal top, diagonal, horizontal bottom; small accent dot beneath.
  const w = canvas * scale;
  const h = w * 0.82;
  const stroke = w * 0.16;
  const cx = canvas / 2;
  const cy = canvas / 2 - canvas * 0.04;

  const left = cx - w / 2;
  const top = cy - h / 2;
  const right = left + w;
  const bottom = top + h;

  const halfStroke = stroke / 2;
  const innerY1 = top + halfStroke;
  const innerY2 = bottom - halfStroke;

  // Halo discs behind the Z
  const haloOuter = withHalo
    ? `<circle cx="${cx}" cy="${cy}" r="${w * 0.95}" fill="${accent}" opacity="0.18"/>`
    : '';
  const haloInner = withHalo
    ? `<circle cx="${cx}" cy="${cy}" r="${w * 0.7}" fill="${haloSoft}" opacity="0.7"/>`
    : '';

  // Dot under the Z
  const dotR = w * 0.085;
  const dotY = bottom + dotR * 1.6;

  // Z paths as rects/lines
  const topBar = `<rect x="${left}" y="${top}" width="${w}" height="${stroke}" rx="${halfStroke}" ry="${halfStroke}" fill="${ink}"/>`;
  const bottomBar = `<rect x="${left}" y="${bottom - stroke}" width="${w}" height="${stroke}" rx="${halfStroke}" ry="${halfStroke}" fill="${ink}"/>`;
  // Diagonal as a thick line from (right, innerY1) to (left, innerY2)
  const diag = `<line x1="${right}" y1="${innerY1}" x2="${left}" y2="${innerY2}" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round"/>`;
  // Accent dot
  const dot = `<circle cx="${cx}" cy="${dotY}" r="${dotR}" fill="${accent}"/>`;

  const bgRect = bg
    ? `<rect width="${canvas}" height="${canvas}" fill="${bg}"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  ${bgRect}
  ${haloOuter}
  ${haloInner}
  ${topBar}
  ${diag}
  ${bottomBar}
  ${dot}
</svg>`;
}

async function svgToPng(svg, outPath, size, { transparent = false } = {}) {
  const pipeline = sharp(Buffer.from(svg)).resize(size, size, {
    fit: 'contain',
    background: transparent
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 244, g: 238, b: 226, alpha: 1 },
  });
  await pipeline.png().toFile(outPath);
  console.log('wrote', path.relative(process.cwd(), outPath), `(${size}x${size})`);
}

async function main() {
  // Square app icon (1024) with bone background + halo + Z
  await svgToPng(
    zLogoSvg({ canvas: 1024, bg: BG, withHalo: true, scale: 0.5 }),
    path.join(ASSETS, 'icon.png'),
    1024,
  );

  // Favicon (web) — small
  await svgToPng(
    zLogoSvg({ canvas: 256, bg: BG, withHalo: true, scale: 0.55 }),
    path.join(ASSETS, 'favicon.png'),
    256,
  );

  // Splash icon — transparent, centered, no halo (halo lives in app.json bg color)
  await svgToPng(
    zLogoSvg({ canvas: 1024, bg: null, withHalo: true, scale: 0.42 }),
    path.join(ASSETS, 'splash-icon.png'),
    1024,
    { transparent: true },
  );

  // Android adaptive icon foreground — Z only, transparent background.
  // Adaptive icon foreground is rendered inside ~66% safe zone; keep scale modest.
  await svgToPng(
    zLogoSvg({ canvas: 1024, bg: null, withHalo: false, scale: 0.4 }),
    path.join(ASSETS, 'android-icon-foreground.png'),
    1024,
    { transparent: true },
  );

  // Adaptive icon background — solid bone fill
  await svgToPng(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${BG}"/>
  <circle cx="512" cy="512" r="320" fill="${ACCENT}" opacity="0.16"/>
  <circle cx="512" cy="512" r="220" fill="${ACCENT_SOFT}" opacity="0.7"/>
</svg>`,
    path.join(ASSETS, 'android-icon-background.png'),
    1024,
  );

  // Monochrome variant (Android themed icons)
  await svgToPng(
    zLogoSvg({
      canvas: 1024,
      bg: null,
      withHalo: false,
      scale: 0.4,
      ink: '#000000',
      accent: '#000000',
    }),
    path.join(ASSETS, 'android-icon-monochrome.png'),
    1024,
    { transparent: true },
  );

  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
