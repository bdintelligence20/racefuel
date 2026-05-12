#!/usr/bin/env bash
#
# One-shot GCP setup for the racefuel-cms Cloud Run service. Run this once
# from your workstation (with the right gcloud account active) before the
# first push that triggers the deploy-cms workflow.
#
# Every step is idempotent — running again skips resources that already
# exist, so it's safe to re-run if a step fails partway through.
#
# Defaults match the values baked into .github/workflows/deploy-cms.yml.
# Override via env vars if you need different names:
#
#   PROJECT_ID=myproj REGION=eu-west1 ./cms/scripts/bootstrap-gcp.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-promogroup}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-racefuel-cms}"
DATA_BUCKET="${DATA_BUCKET:-fuelcue-cms-data}"
UPLOADS_BUCKET="${UPLOADS_BUCKET:-fuelcue-cms-uploads}"

# Cloud Run uses the Compute Engine default SA unless a dedicated one is set
# on the service. Detect the project number to construct that SA email.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUN_SA="${RUN_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

echo "Bootstrap targets:"
echo "  project       = $PROJECT_ID"
echo "  region        = $REGION"
echo "  service       = $SERVICE"
echo "  data bucket   = $DATA_BUCKET"
echo "  uploads bucket= $UPLOADS_BUCKET"
echo "  run SA        = $RUN_SA"
echo

bucket_exists() {
  gsutil ls -b "gs://$1" >/dev/null 2>&1
}

ensure_bucket() {
  local name="$1"
  if bucket_exists "$name"; then
    echo "✓ bucket gs://$name already exists"
  else
    echo "→ creating bucket gs://$name"
    gsutil mb -p "$PROJECT_ID" -l "$REGION" -b on "gs://$name"
  fi
}

ensure_bucket "$DATA_BUCKET"
ensure_bucket "$UPLOADS_BUCKET"

echo "→ ensuring uploads bucket is publicly readable"
gsutil iam ch allUsers:objectViewer "gs://$UPLOADS_BUCKET" || true

echo "→ granting Cloud Run SA write access to both buckets"
gsutil iam ch "serviceAccount:${RUN_SA}:roles/storage.objectAdmin" "gs://$DATA_BUCKET"
gsutil iam ch "serviceAccount:${RUN_SA}:roles/storage.objectAdmin" "gs://$UPLOADS_BUCKET"

# Secret Manager: 5 secrets that Strapi needs at boot. They must stay stable
# across revisions, so we create them once here rather than regenerating
# them in CI. Generated values use 16 bytes of cryptographic randomness
# encoded as base64 — Strapi's documented format.
secret_exists() {
  gcloud secrets describe "$1" --project="$PROJECT_ID" >/dev/null 2>&1
}

create_secret_if_missing() {
  local name="$1"
  local value="$2"
  if secret_exists "$name"; then
    echo "✓ secret $name already exists"
  else
    echo "→ creating secret $name"
    printf '%s' "$value" | gcloud secrets create "$name" \
      --project="$PROJECT_ID" \
      --replication-policy=automatic \
      --data-file=-
  fi
}

random_b64() {
  node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
}

# APP_KEYS is a comma-separated list of 4 keys.
APP_KEYS_VALUE=$(for _ in 1 2 3 4; do random_b64; done | paste -sd, -)

create_secret_if_missing "cms-app-keys" "$APP_KEYS_VALUE"
create_secret_if_missing "cms-api-token-salt" "$(random_b64)"
create_secret_if_missing "cms-admin-jwt-secret" "$(random_b64)"
create_secret_if_missing "cms-transfer-token-salt" "$(random_b64)"
create_secret_if_missing "cms-jwt-secret" "$(random_b64)"

echo "→ granting Cloud Run SA access to read those secrets"
for secret in cms-app-keys cms-api-token-salt cms-admin-jwt-secret \
              cms-transfer-token-salt cms-jwt-secret; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${RUN_SA}" \
    --role=roles/secretmanager.secretAccessor \
    --quiet >/dev/null
done

echo
echo "Done. The next push to main that touches cms/** will deploy cleanly."
echo
echo "After the first deploy:"
echo "  1. Visit https://<cms-cloud-run-url>/admin and create the first user."
echo "  2. Set VITE_STRAPI_URL on the frontend to that Cloud Run URL."
echo
echo "Public read permissions are granted automatically by the bootstrap"
echo "hook in cms/src/index.ts — no admin-UI clicks needed."
