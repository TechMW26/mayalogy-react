import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const mode = process.argv[2] || process.env.NODE_ENV || 'development';

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsedEnv = {};
  const fileText = readFileSync(filePath, 'utf8');

  for (const rawLine of fileText.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsedEnv[key] = value;
  }

  return parsedEnv;
}

const envFiles = [
  resolve(rootDir, '.env'),
  resolve(rootDir, '.env.local'),
  resolve(rootDir, `.env.${mode}`),
  resolve(rootDir, `.env.${mode}.local`),
];

const env = envFiles.reduce((mergedEnv, filePath) => ({
  ...mergedEnv,
  ...parseEnvFile(filePath),
}), {});

for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string' && value.length > 0) {
    env[key] = value;
  }
}

function parseList(rawValue) {
  if (!rawValue) {
    return [];
  }

  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return [];
  }

  if (trimmedValue.startsWith('[')) {
    try {
      const parsedValue = JSON.parse(trimmedValue);
      return Array.isArray(parsedValue)
        ? parsedValue.map((item) => String(item).trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  return trimmedValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const runtimeSecrets = {
  GEMINI_KEY: env.VITE_PUBLIC_GEMINI_KEY || '',
  GEMINI_FALLBACKS: [],
  ELEVENLABS_VOICE: env.VITE_PUBLIC_ELEVENLABS_VOICE || 'P3JECz9WQeXyyodBL3ZD',
  ELEVENLABS_MALE_VOICE: env.VITE_PUBLIC_ELEVENLABS_MALE_VOICE || '8TMmdpPgqHKvDOGYP2lN',
  ELEVENLABS_HI_VOICE: env.VITE_PUBLIC_ELEVENLABS_HI_VOICE || '',
  ELEVENLABS_EN_VOICE: env.VITE_PUBLIC_ELEVENLABS_EN_VOICE || '',
  GOOGLE_MAPS_KEY: env.VITE_PUBLIC_GOOGLE_MAPS_KEY || '',
  YOUTUBE_API_KEY: env.VITE_PUBLIC_YOUTUBE_API_KEY || '',
  GOOGLE_CLIENT_ID: env.VITE_PUBLIC_GOOGLE_CLIENT_ID || '',
  FIREBASE_DB_URL: env.VITE_PUBLIC_FIREBASE_DB_URL || '',
};

const fileContents = `window.MAYA_SECRETS = Object.freeze(${JSON.stringify(runtimeSecrets, null, 2)});\n`;
const outputFiles = [
  resolve(rootDir, 'public/js/runtime-env.js'),
  resolve(rootDir, 'js/runtime-env.js'),
];

for (const outputFile of outputFiles) {
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, fileContents, 'utf8');
}

console.log(`Synced runtime env for ${mode}`);