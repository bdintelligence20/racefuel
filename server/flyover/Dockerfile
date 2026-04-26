# Multi-stage: build the renderer with Node+Vite, then assemble a Python image with
# Playwright (Chromium), ffmpeg, and FastAPI.

# ---------- Stage 1: build the renderer bundle ----------
FROM node:20-bookworm-slim AS renderer

WORKDIR /work
COPY renderer/package.json renderer/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY renderer/. ./
RUN npm run build
# Output: /work/dist/  (index.html + bundled JS)

# ---------- Stage 2: Python server with Playwright + ffmpeg ----------
# Mapbox + Playwright need a few system libs that aren't in -slim, so we use the standard
# python image and lean on Playwright's --with-deps installer for Chromium dependencies.
FROM python:3.12-slim-bookworm AS server

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ffmpeg + minimal CA / fonts so emoji/text rasterise correctly when Mapbox writes labels.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# Playwright + Chromium (with system deps).
RUN playwright install --with-deps chromium

# App code
COPY app ./app

# Renderer bundle from stage 1
COPY --from=renderer /work/dist /app/renderer

ENV RENDERER_DIR=/app/renderer \
    PORT=8080
EXPOSE 8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
