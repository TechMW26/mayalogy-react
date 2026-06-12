// Builds Zenova brand assets from the user-supplied Z.png.
// - icon.png            (1024x1024, bone bg + Z centered)
// - favicon.png         (256x256,  bone bg + Z centered)
// - splash-icon.png     (1024x1024, transparent, Z centered)
// - android-icon-foreground.png (1024x1024, transparent, Z safely inset for adaptive mask)
// - android-icon-background.png (1024x1024, bone bg with sage halo)
// - android-icon-monochrome.png (1024x1024, transparent, Z in solid black)
//
// Run:  node scripts/gen-brand-assets.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.resolve(__dirname, '..', 'assets');
const SOURCE = path.join(ASSETS, 'Z.png');

const BG = '#f4eee2';
const ACCENT = '#6f9b80';
const ACCENT_SOFT = '#cfe0d4';

if (!fs.existsSync(SOURCE)) {
  console.error('Missing source Z.png at', SOURCE);
  process.exit(1);
}

async function makeCentered({
  outPath,
  size = 1024,
  bg = null,
  zRatio = 0.62,
  applyMonochrome = false,
  haloBg = false,
}) {
  // Start with the source Z, fit-contain into the desired Z area.
  const zPx = Math.round(size * zRatio);

  let zBuf = await sharp(SOURCE)
    .resize(zPx, zPx, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .toBuffer();

  if (applyMonochrome) {
    // Replace any non-transparent pixel with pure black for Android themed icons.
    zBuf = await sharp(zBuf)
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${zPx}" height="${zPx}"><rect width="${zPx}" height="${zPx}" fill="#000"/></svg>`,
          ),
          blend: 'in',
        },
      ])
      .png()
      .toBuffer();
  }

  let base;
  if (bg) {
    base = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bg,
      },
    });
  } else {
    base = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
  }

  const composites = [];
  if (haloBg) {
    const halo = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${ACCENT_SOFT}" stop-opacity="0.95"/>
        <stop offset="60%" stop-color="${ACCENT}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="url(#g)"/>
    </svg>`;
    composites.push({ input: Buffer.from(halo), top: 0, left: 0 });
  }

  composites.push({
    input: zBuf,
    top: Math.round((size - zPx) / 2),
    left: Math.round((size - zPx) / 2),
  });

  await base.composite(composites).png().toFile(outPath);
  console.log('wrote', path.relative(process.cwd(), outPath));
}

async function makeBackground(outPath, size = 1024) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.32}" fill="${ACCENT}" opacity="0.18"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.22}" fill="${ACCENT_SOFT}" opacity="0.75"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('wrote', path.relative(process.cwd(), outPath));
}

async function main() {
  // App icon (iOS / generic)
  await makeCentered({
    outPath: path.join(ASSETS, 'icon.png'),
    size: 1024,
    bg: BG,
    zRatio: 0.7,
    haloBg: true,
  });

  // Web favicon
  await makeCentered({
    outPath: path.join(ASSETS, 'favicon.png'),
    size: 256,
    bg: BG,
    zRatio: 0.7,
    haloBg: true,
  });

  // Splash icon: transparent so expo-splash plugin paints background separately.
  await makeCentered({
    outPath: path.join(ASSETS, 'splash-icon.png'),
    size: 1024,
    bg: null,
    zRatio: 0.55,
    haloBg: false,
  });

  // Adaptive icon foreground: render Z slightly smaller, safe within ~66% inner zone.
  await makeCentered({
    outPath: path.join(ASSETS, 'android-icon-foreground.png'),
    size: 1024,
    bg: null,
    zRatio: 0.48,
    haloBg: false,
  });

  // Adaptive icon background
  await makeBackground(path.join(ASSETS, 'android-icon-background.png'), 1024);

  // Adaptive icon monochrome (Material You)
  await makeCentered({
    outPath: path.join(ASSETS, 'android-icon-monochrome.png'),
    size: 1024,
    bg: null,
    zRatio: 0.48,
    haloBg: false,
    applyMonochrome: true,
  });

  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
