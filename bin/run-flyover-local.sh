#!/usr/bin/env bash
# Run the flyover service locally WITHOUT Docker. Fastest iteration loop:
#   1) Sync the latest engine code into the renderer
#   2) Build the renderer to renderer/dist/
#   3) Start uvicorn pointing at it
#
# Prerequisites (one-time):
#   cd server/flyover && python3 -m venv .venv && source .venv/bin/activate
#   pip install -e .
#   playwright install chromium
#   brew install ffmpeg   # or: apt install ffmpeg
#
# Then run this script with MAPBOX_TOKEN set in your env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$ROOT/server/flyover"

if [ -z "${MAPBOX_TOKEN:-}" ]; then
  echo "✗ MAPBOX_TOKEN env var is required (use the same one as VITE_MAPBOX_TOKEN in .env)" >&2
  exit 1
fi

echo "▶ syncing engine code into renderer/"
bash "$ROOT/bin/sync-flyover-renderer.sh"

echo "▶ building renderer bundle"
cd "$SERVER/renderer"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build

echo "▶ starting FastAPI on http://localhost:8080"
cd "$SERVER"
RENDERER_DIR="$SERVER/renderer/dist" \
MAPBOX_TOKEN="$MAPBOX_TOKEN" \
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
