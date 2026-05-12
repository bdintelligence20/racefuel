# Blog content model (Strapi)

The frontend `/blog` and `/blog/:slug` pages (`src/components/blog/*`) read
from the self-hosted Strapi v5 instance defined in `/cms`. The CMS deploys
as a separate Cloud Run service (`racefuel-cms`) from this same repo —
deploy details live in `cms/README.md`.

## Environment (frontend)

Set in the SPA's `.env`:

```
VITE_STRAPI_URL=https://racefuel-cms-<hash>-uc.a.run.app
# Optional, only if the public find/findOne routes are token-gated:
# VITE_STRAPI_TOKEN=<read-only api token>
```

The frontend strips a trailing `/` from `VITE_STRAPI_URL` and appends `/api`
to all requests.

## Collection type: `Article`

Defined in `cms/src/api/article/content-types/article/schema.json`. API ID
(singular): `article` · API ID (plural): `articles`.

| Field          | Type                          | Required | Notes                                                                 |
| -------------- | ----------------------------- | -------- | --------------------------------------------------------------------- |
| `title`        | Text (short)                  | yes      | Article headline.                                                     |
| `slug`         | UID, target field: `title`    | yes      | URL slug. Used in `/blog/:slug`.                                      |
| `excerpt`      | Text (long)                   | no       | Short summary shown on the index card and at the top of the detail page. |
| `body`         | Rich text (Blocks)            | yes      | Main content. Rendered by `src/components/blog/RichText.tsx`.         |
| `author`       | Text (short)                  | no       | Free-form author name.                                                |
| `coverImage`   | Media (single, images only)   | no       | Hero image on the card and the detail page.                           |
| `publishedAt`  | (provided by Strapi)          | —        | Strapi sets this automatically when you publish; the index sorts by it descending. |

No relations are required for v1. If you later add categories or tags, the
frontend client (`src/services/strapi/strapiClient.ts`) is the single place
to extend the `populate` query.

## Permissions

After the first deploy, visit `https://<cms-url>/admin`, create the first
admin user, then go to **Settings → Users & Permissions → Roles → Public**
and enable:

- `Article.find`
- `Article.findOne`

If you'd rather not expose them publicly, generate a read-only API token at
**Settings → API Tokens** and set `VITE_STRAPI_TOKEN`. The client sends it as
`Authorization: Bearer …` on every request.

## CORS

The CMS already allows `https://fuelcue.com`, `https://www.fuelcue.com`, and
`http://localhost:5173`. Extra origins can be appended via the `CORS_ORIGINS`
env var (comma-separated) on the Cloud Run service. The middleware config
lives in `cms/config/middlewares.ts`.

## What the frontend queries

- **List** — `GET /api/articles?populate=coverImage&sort=publishedAt:desc&pagination[pageSize]=50`
- **Detail** — `GET /api/articles?filters[slug][$eq]=<slug>&populate=coverImage&pagination[pageSize]=1`

Both endpoints return Strapi v5's standard `{ data, meta }` envelope with
content fields flattened on each item (no `attributes` wrapper).
