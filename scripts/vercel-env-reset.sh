#!/bin/bash
# Remove all existing Vercel env vars and re-add from .env.local
set -e
cd "$(dirname "$0")/.."

echo "=== STEP 1: Removing all existing env vars ==="

# Production vars to remove
PROD_VARS=(
  INTERAKT_API_KEY
  FIREBASE_DB_URL
  INTERAKT_OTP_TEMPLATE
  VITE_PUBLIC_ELEVENLABS_HI_VOICE
  VITE_PUBLIC_ELEVENLABS_EN_VOICE
  ELEVENLABS_API_KEY
  REMOVE_BG_API_KEY
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
  OPENAI_API_KEY
  GOOGLE_CLIENT_SECRET
  MAYA_STORE_FILE
  MAYA_STORE_PASSWORD
  MAYA_KEY_ALIAS
  MAYA_KEY_PASSWORD
  VITE_PUBLIC_GOOGLE_MAPS_KEY
  VITE_PUBLIC_ELEVENLABS_VOICE
  VITE_PUBLIC_FIREBASE_DB_URL
  VITE_PUBLIC_GOOGLE_CLIENT_ID
  VITE_PUBLIC_YOUTUBE_API_KEY
  VITE_PUBLIC_GEMINI_FALLBACKS
  VITE_PUBLIC_GEMINI_KEY
)

# Preview vars to remove
PREVIEW_VARS=(
  VITE_PUBLIC_YOUTUBE_API_KEY
  VITE_PUBLIC_GEMINI_FALLBACKS
  VITE_PUBLIC_GEMINI_KEY
)

for var in "${PROD_VARS[@]}"; do
  echo "  Removing $var from production..."
  vercel env rm "$var" production --yes 2>/dev/null || echo "    (not found or already removed)"
done

for var in "${PREVIEW_VARS[@]}"; do
  echo "  Removing $var from preview..."
  vercel env rm "$var" preview --yes 2>/dev/null || echo "    (not found or already removed)"
done

echo ""
echo "=== STEP 2: Adding env vars from .env.local to production ==="

# Read .env.local and add each non-empty var to production
while IFS='=' read -r key value; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  # Skip vars with empty values
  [[ -z "$value" ]] && continue
  
  echo "  Adding $key to production..."
  printf '%s' "$value" | vercel env add "$key" production 2>/dev/null || echo "    (failed or already exists)"
done < .env.local

echo ""
echo "=== DONE ==="
vercel env ls 2>&1 | head -40
