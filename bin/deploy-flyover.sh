#!/usr/bin/env bash
# Deploy the racefuel-flyover Cloud Run service.
#
# Pre-flight: copy the latest animation engine into the renderer's source tree, then
# `gcloud run deploy --source ./server/flyover` so Cloud Build picks up the Dockerfile.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PROJECT="${GCP_PROJECT:-promogroup}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${SERVICE:-racefuel-flyover}"

if [ -z "${MAPBOX_TOKEN:-}" ]; then
  echo "✗ MAPBOX_TOKEN env var is required" >&2
  exit 1
fi

echo "▶ syncing flyover engine into renderer/"
bash "$ROOT/bin/sync-flyover-renderer.sh"

echo "▶ deploying to Cloud Run: $SERVICE in $PROJECT/$REGION"
gcloud run deploy "$SERVICE" \
  --source "$ROOT/server/flyover" \
  --project "$PROJECT" \
  --region "$REGION" \
  --memory 4Gi \
  --cpu 2 \
  --concurrency 1 \
  --timeout 900 \
  --max-instances 5 \
  --set-env-vars "MAPBOX_TOKEN=$MAPBOX_TOKEN,SPA_ORIGIN=${SPA_ORIGIN:-https://racefuel-dtlkpe56ha-uc.a.run.app}"

echo "▶ done. Service URL:"
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format="value(status.url)"
