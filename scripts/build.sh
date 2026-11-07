#!/usr/bin/env bash
# Build for a single-service host (e.g. Render/Railway): React build is served by Django via WhiteNoise.
# Start command:  cd backend && gunicorn config.wsgi --bind 0.0.0.0:$PORT --timeout 120
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$root/frontend" && npm ci && npm run build)
(cd "$root/backend" && pip install -r requirements.txt)
