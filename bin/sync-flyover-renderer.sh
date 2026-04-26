#!/usr/bin/env bash
# Copy the SPA's flyover engine into the headless renderer's source tree.
# Run this whenever animation.ts / geometry.ts change in the SPA.
#
# The renderer can't symlink across the Cloud Run build context, so we vendor copies
# and patch the SPA-specific import path (../../context/AppContext → ./types).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src/services/flyover"
DST="$ROOT/server/flyover/renderer/src"

mkdir -p "$DST"

for file in animation.ts geometry.ts; do
  cp "$SRC/$file" "$DST/$file"
  # Repoint the AppContext import to the renderer's local types stub
  sed -i.bak "s|'../../context/AppContext'|'./types'|g" "$DST/$file"
  rm -f "$DST/$file.bak"
  # Header so it's clear these are auto-generated
  tmp=$(mktemp)
  {
    echo "// AUTO-GENERATED from src/services/flyover/$file"
    echo "// Update via: bash bin/sync-flyover-renderer.sh"
    cat "$DST/$file"
  } >"$tmp"
  mv "$tmp" "$DST/$file"
done

echo "synced $SRC → $DST"
