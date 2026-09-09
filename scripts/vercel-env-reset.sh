#!/bin/bash
# Compatibility wrapper. The sync is non-destructive: missing local values never
# remove working Vercel configuration.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/vercel-env-sync.mjs "$@"
