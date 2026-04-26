"""FastAPI entry point for the racefuel-flyover Cloud Run service.

Stage B (this file) ships the synchronous render path: POST /render takes a route +
nutrition payload, runs the headless Mapbox + ffmpeg pipeline, and returns the MP4
bytes directly in the response. Stage C will layer Firestore-backed async jobs on top.
"""
from __future__ import annotations

import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import render

logger = logging.getLogger("flyover")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")

# Where the bundled renderer lives in the container (set by the Dockerfile).
RENDERER_DIR = Path(os.environ.get("RENDERER_DIR", "/app/renderer"))
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")
SPA_ORIGIN = os.environ.get("SPA_ORIGIN", "*")  # tighten in production

app = FastAPI(title="racefuel-flyover", version="0.0.1")

# CORS — allow the SPA to call us. Restrict via SPA_ORIGIN env var in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[SPA_ORIGIN] if SPA_ORIGIN != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class GpsPoint(BaseModel):
    lat: float
    lng: float
    elevation: float | None = None


class ProductInfo(BaseModel):
    id: str
    name: str
    brand: str
    image: str = ""
    carbs: float = 0
    sodium: float = 0
    calories: float = 0


class NutritionPoint(BaseModel):
    id: str
    distanceKm: float = Field(..., alias="distanceKm")
    product: ProductInfo


class RenderOptions(BaseModel):
    durationSec: float = 20
    fps: int = 30
    aspect: Literal["landscape", "square", "portrait"] = "landscape"
    terrain3D: bool = True


class RenderRequest(BaseModel):
    name: str = "Untitled"
    gpsPath: list[GpsPoint]
    nutritionPoints: list[NutritionPoint] = []
    options: RenderOptions = Field(default_factory=RenderOptions)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "racefuel-flyover",
        "renderer_dir": str(RENDERER_DIR),
        "renderer_present": str((RENDERER_DIR / "index.html").exists()),
        "mapbox_token_set": str(bool(MAPBOX_TOKEN)),
    }


@app.post("/render")
async def render_endpoint(req: RenderRequest) -> Response:
    if not MAPBOX_TOKEN:
        raise HTTPException(500, "MAPBOX_TOKEN env var is not set on the server")
    if len(req.gpsPath) < 2:
        raise HTTPException(400, "gpsPath must have at least 2 points")
    if not (RENDERER_DIR / "index.html").exists():
        raise HTTPException(500, f"Renderer bundle not found at {RENDERER_DIR}")

    job_id = uuid.uuid4().hex[:12]
    logger.info("render job %s start: %s, %d gps pts, %d fuel pts, %s %ds@%dfps",
                job_id, req.name, len(req.gpsPath), len(req.nutritionPoints),
                req.options.aspect, req.options.durationSec, req.options.fps)

    with tempfile.TemporaryDirectory(prefix=f"flyover-{job_id}-") as tmp:
        out_path = Path(tmp) / "out.mp4"
        try:
            await render.render_flyover(
                renderer_dir=RENDERER_DIR,
                mapbox_token=MAPBOX_TOKEN,
                payload=req.model_dump(by_alias=True),
                output_path=out_path,
                job_id=job_id,
            )
        except render.RenderError as e:
            logger.exception("render job %s failed", job_id)
            raise HTTPException(500, f"Render failed: {e}") from e

        data = out_path.read_bytes()
        logger.info("render job %s done: %d bytes", job_id, len(data))

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in req.name)[:40] or "flyover"
    return Response(
        content=data,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_{req.options.aspect}.mp4"',
            "X-Flyover-Job": job_id,
        },
    )
