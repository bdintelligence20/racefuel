# fuelcue CMS (Strapi v5, self-hosted)

This is the headless CMS that powers `/blog` on fuelcue.com. It's a Strapi v5
project deployed as its own Cloud Run service alongside the main frontend
container — separate image, separate revision, same GCP project.

## Architecture at a glance

- **Frontend** (`/src`): static SPA served from the `racefuel` Cloud Run
  service. Hits this CMS over HTTPS via `VITE_STRAPI_URL`.
- **CMS** (`/cms`, this folder): Node 20 + Strapi v5 deployed as the
  `racefuel-cms` Cloud Run service.
- **Database**: SQLite, stored as a single file at `/data/cms.db`. `/data` is
  a GCS bucket mounted as a Cloud Run volume so the DB survives revisions.
- **Media uploads**: written directly to a GCS bucket via the upload
  provider — never live on the container filesystem.

Because SQLite over GCS FUSE can't handle concurrent writers, the service
must run with `--max-instances=1`. This is fine for a low-traffic editorial
workflow (a single admin editor at a time) but won't scale past that without
moving to Cloud SQL.

## One-time GCP setup

Run these once per project, before the first deploy. Replace bucket names
to match your project if needed.

```bash
# Buckets — DATA_BUCKET stores the SQLite file, UPLOADS_BUCKET stores media.
gsutil mb -l us-central1 -b on gs://fuelcue-cms-data
gsutil mb -l us-central1 -b on gs://fuelcue-cms-uploads

# Make uploads publicly readable (so the frontend can render them via the
# bucket's public URL without signed URLs).
gsutil iam ch allUsers:objectViewer gs://fuelcue-cms-uploads

# Grant the Cloud Run service account write access to both buckets. Replace
# the SA email with the one Cloud Run uses for the racefuel-cms service.
SA=racefuel-cms@promogroup.iam.gserviceaccount.com
gsutil iam ch serviceAccount:${SA}:roles/storage.objectAdmin gs://fuelcue-cms-data
gsutil iam ch serviceAccount:${SA}:roles/storage.objectAdmin gs://fuelcue-cms-uploads
```

Generate the five required secrets (each is a base64 random string) and
store them in Secret Manager. The deploy workflow wires them in via
`--set-secrets`.

```bash
for name in cms-app-keys cms-api-token-salt cms-admin-jwt-secret \
            cms-transfer-token-salt cms-jwt-secret; do
  value=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
  echo -n "$value" | gcloud secrets create $name --data-file=-
done
```

`cms-app-keys` is technically expected to be a comma-separated list of 4
keys; the simplest version is to generate four values and join them:

```bash
keys=$(for _ in 1 2 3 4; do node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"; done | paste -sd,)
echo -n "$keys" | gcloud secrets versions add cms-app-keys --data-file=-
```

## Deploying

Push to `main` with changes under `cms/**` and the
`.github/workflows/deploy-cms.yml` workflow builds the image and rolls out a
new Cloud Run revision. The full `gcloud run deploy` command lives in that
workflow — copy it to deploy manually too.

First-time deploy:

1. Wait for the service to come up (check logs for `Server started`).
2. Visit `https://<service-url>/admin` and create the first admin user.
3. In **Settings → Users & Permissions → Roles → Public** enable
   `Article.find` and `Article.findOne`.
4. Set `VITE_STRAPI_URL` in the frontend's GitHub Action secrets / .env to
   the public URL of this service.

## Local development

```bash
cd cms
cp .env.example .env
# Fill in APP_KEYS and the four salts/secrets with throwaway random values.
npm install --legacy-peer-deps
npm run develop
# Strapi boots on http://localhost:1337. Admin UI is at /admin.
```

For local upload testing you can either set `GCS_SERVICE_ACCOUNT` to a JSON
key file, or run `gcloud auth application-default login` and the provider
will pick up the ADC.

## Content model

`Article` collection type — exact field list is in
`src/api/article/content-types/article/schema.json`. The frontend reads
title, slug, excerpt, body (blocks), author, coverImage, and the
auto-managed publishedAt.

## Gotchas

- **max-instances=1 is load-bearing.** Bumping it corrupts SQLite under any
  concurrent write. If you outgrow it, migrate to Cloud SQL Postgres and
  remove the volume mount.
- **Cold starts are slow** (~10–15s). Strapi has a heavy boot — fine for an
  editorial tool, but the public `/api/articles` endpoint will also be slow
  on the first hit after a scale-to-zero. Consider `--min-instances=1` if
  that matters; it costs ~$5/mo extra.
- **App keys must be stable across revisions.** They're loaded from Secret
  Manager — never let the workflow generate them at deploy time.
