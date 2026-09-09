import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const scopes = process.argv.slice(2);
const selectedScopes = scopes.length ? scopes : ['production', 'preview', 'development'];
const allowedScopes = new Set(['production', 'preview', 'development']);
if (selectedScopes.some((scope) => !allowedScopes.has(scope))) {
  console.error('Usage: node scripts/vercel-env-sync.mjs [production] [preview] [development]');
  process.exit(1);
}

const publicNames = [
  'VITE_PUBLIC_GOOGLE_MAPS_KEY',
  'VITE_PUBLIC_YOUTUBE_API_KEY',
  'VITE_PUBLIC_GOOGLE_CLIENT_ID',
  'VITE_PUBLIC_FIREBASE_DB_URL',
  'VITE_PUBLIC_FIREBASE_API_KEY',
  'VITE_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'VITE_PUBLIC_FIREBASE_PROJECT_ID',
  'VITE_PUBLIC_FIREBASE_APP_ID',
  'VITE_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_PUBLIC_ELEVENLABS_VOICE',
  'VITE_PUBLIC_ELEVENLABS_HI_VOICE',
  'VITE_PUBLIC_ELEVENLABS_EN_VOICE',
];
const secretNames = [
  'FIREBASE_DB_URL',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'MAYA_PUSH_API_SECRET',
  'APP_REVIEW_LOGIN_ID',
  'APP_REVIEW_LOGIN_PASSWORD',
  'POLLINATIONS_API_KEY',
];
const serverNames = [
  'APP_REVIEW_LOGIN_ENABLED',
  'POLLINATIONS_TEXT_MODELS',
  'POLLINATIONS_VISION_MODELS',
  'POLLINATIONS_IMAGE_MODELS',
  'POLLINATIONS_IMAGE_EDIT_MODELS',
  'POLLINATIONS_SPEECH_MODELS',
];

const env = loadEnv('development', process.cwd(), '');
let synced = 0;
for (const scope of selectedScopes) {
  for (const name of [...publicNames, ...secretNames, ...serverNames]) {
    const value = String(env[name] || '').trim();
    if (!value) continue;
    const args = ['env', 'add', name, scope, '--force', '--yes'];
    args.push(secretNames.includes(name) ? '--sensitive' : '--no-sensitive');
    const result = spawnSync('vercel', args, { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.status !== 0) {
      console.error(`Failed to sync ${name} to ${scope}: ${result.stderr.trim()}`);
      process.exit(result.status || 1);
    }
    console.log(`Synced ${name} to ${scope}${secretNames.includes(name) ? ' (sensitive)' : ''}`);
    synced += 1;
  }
}
console.log(`Finished: ${synced} environment assignments synced; missing local values were preserved on Vercel.`);
