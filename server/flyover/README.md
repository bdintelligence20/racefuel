# racefuel-flyover

Cloud Run service that renders a route + nutrition plan into a cinematic MP4 flyover.

## How it works

```
┌─────────────────┐    POST /render    ┌────────────────────┐
│  racefuel SPA   │ ─────────────────▶ │  racefuel-flyover  │
└─────────────────┘ ◀────── MP4 ────── │  (this service)    │
                                       └─────────┬──────────┘
                                                 │
                       ┌─────────────────────────┴──────────────────────────┐
                       ▼                                                    ▼
              ┌─────────────────────┐                            ┌──────────────────────┐
              │ Headless Chromium   │  per-frame screenshot      │ ffmpeg               │
              │ + Mapbox GL JS      │ ─────────────────────────▶ │ → MP4 (H.264, 1080p) │
              │ + animation engine  │                            └──────────────────────┘
              └─────────────────────┘
```

The renderer page (`renderer/index.html` + `renderer/src/main.ts`) is a tiny static page
that loads Mapbox GL JS and exposes `window.__renderFlyover` so the FastAPI server can
drive it via Playwright `page.evaluate()`.

The animation engine (`renderer/src/animation.ts`, `geometry.ts`) is **vendored** from the
SPA's `src/services/flyover/`. Re-sync after any SPA-side change:

```bash
bash bin/sync-flyover-renderer.sh
```

The auto-generated header at the top of the vendored files makes the relationship explicit.

## Stage B (this milestone)

- ✅ Synchronous `/render` endpoint — accepts a payload, returns the MP4 in the response
- ✅ Renderer page + Vite bundle
- ✅ Multi-stage Dockerfile (Node renderer build → Python+Playwright+ffmpeg server)
- ✅ Local testing via `docker run` + `curl`
- ⏸️ Auth (`app/auth.py`) — placeholder; service is currently unauthenticated
- ⏸️ Async jobs via Firestore (`app/firestore_io.py`) — placeholder; sync MP4 return for now
- ⏸️ Firebase Storage upload (`app/storage.py`) — placeholder; MP4 returned in HTTP response

Stage C will populate the placeholders and switch the SPA to a `submit → poll` flow.

## Local testing — two paths

### Path A: native (fastest iteration, no Docker)

One-time setup:

```bash
cd server/flyover
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
playwright install chromium      # downloads headless Chromium (~170MB)
brew install ffmpeg              # or `apt install ffmpeg` on Linux
```

Then any time you want to render a video locally:

```bash
export MAPBOX_TOKEN=pk.your-token   # same one VITE_MAPBOX_TOKEN points to
bash bin/run-flyover-local.sh       # syncs renderer, builds bundle, starts FastAPI on :8080
```

In another terminal:

```bash
curl http://localhost:8080/healthz
curl -X POST http://localhost:8080/render \
  -H 'Content-Type: application/json' \
  -d @bin/sample-render-payload.json \
  -o /tmp/flyover.mp4
open /tmp/flyover.mp4
```

For a 12s/30fps render of the bundled sample payload, expect **~30–60 seconds** of
local wall time depending on your CPU.

### Path B: Docker (closest to Cloud Run)

```bash
docker build -t racefuel-flyover ./server/flyover
docker run --rm -p 8080:8080 -e MAPBOX_TOKEN=pk.your-token racefuel-flyover
# then curl as above
```

Slower first build (~3 minutes — installs Playwright + Chromium + ffmpeg), but it
exercises the exact image that ships to Cloud Run.

## Deploy to Cloud Run

```bash
export MAPBOX_TOKEN=pk.your-token
bash bin/deploy-flyover.sh
```

Service name: `racefuel-flyover`. Project/region from env (`GCP_PROJECT`, `GCP_REGION`)
or defaults (`promogroup` / `us-central1`).

The deploy script syncs the engine code into `renderer/src/` first, then runs
`gcloud run deploy --source ./server/flyover` with `--cpu 2 --memory 4Gi --concurrency 1
--timeout 900 --max-instances 5`. Concurrency is intentionally 1 because Chromium is
RAM-heavy; horizontal scaling handles parallel requests.

## Why these choices

- **`--use-gl=swiftshader`** — Cloud Run doesn't have a GPU. Without this flag, Mapbox
  initialises but renders nothing because WebGL has no rasterizer. SwiftShader is
  a software rasterizer Chromium ships with.
- **`preserveDrawingBuffer: true`** on the map — required for `page.screenshot()` to
  capture the WebGL canvas (without it, the framebuffer is cleared between paints).
- **`yuv420p` + `+faststart`** in ffmpeg — required for broad player compatibility
  (Instagram, TikTok, QuickTime) and progressive download.
- **`--concurrency 1`** — one Chromium per Cloud Run instance keeps memory predictable;
  Cloud Run autoscales horizontally for parallel requests.
