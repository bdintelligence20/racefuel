"""Headless render pipeline: Playwright drives the Mapbox renderer page frame-by-frame,
captures each frame as PNG, then ffmpeg stitches them into an MP4.
"""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

logger = logging.getLogger("flyover.render")


class RenderError(RuntimeError):
    pass


# Output dimensions per aspect ratio. 1080p-ish targeting; bump for a 4K tier later.
ASPECT_DIMENSIONS: dict[str, tuple[int, int]] = {
    "landscape": (1920, 1080),
    "square": (1080, 1080),
    "portrait": (1080, 1920),
}


@dataclass
class RenderArgs:
    renderer_dir: Path
    mapbox_token: str
    payload: dict[str, Any]
    output_path: Path
    job_id: str


async def render_flyover(
    *,
    renderer_dir: Path,
    mapbox_token: str,
    payload: dict[str, Any],
    output_path: Path,
    job_id: str,
) -> None:
    args = RenderArgs(
        renderer_dir=renderer_dir,
        mapbox_token=mapbox_token,
        payload=payload,
        output_path=output_path,
        job_id=job_id,
    )

    aspect = payload.get("options", {}).get("aspect", "landscape")
    width, height = ASPECT_DIMENSIONS.get(aspect, ASPECT_DIMENSIONS["landscape"])
    fps = int(payload.get("options", {}).get("fps", 30))
    duration_sec = float(payload.get("options", {}).get("durationSec", 20))
    total_frames = max(2, int(round(duration_sec * fps)))

    frames_dir = output_path.parent / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    logger.info("[%s] rendering %dx%d %.1fs @ %dfps = %d frames", job_id, width, height, duration_sec, fps, total_frames)

    await _capture_frames(args, width, height, total_frames, frames_dir)
    _encode_mp4(frames_dir, output_path, fps)
    shutil.rmtree(frames_dir, ignore_errors=True)


async def _capture_frames(
    args: RenderArgs,
    width: int,
    height: int,
    total_frames: int,
    frames_dir: Path,
) -> None:
    index_url = (args.renderer_dir / "index.html").resolve().as_uri()
    setup_payload = {
        "mapboxToken": args.mapbox_token,
        "width": width,
        "height": height,
        "gpsPath": args.payload["gpsPath"],
        "nutritionPoints": args.payload.get("nutritionPoints", []),
        "options": args.payload.get("options", {}),
    }
    setup_payload_json = json.dumps(setup_payload)

    async with async_playwright() as pw:
        # --use-gl=swiftshader is critical on Cloud Run — there's no GPU, so WebGL falls
        # back to a software rasterizer. Without this, Mapbox initialises but renders nothing.
        browser = await pw.chromium.launch(
            headless=True,
            args=["--use-gl=swiftshader", "--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
            )
            page = await context.new_page()
            page.on("pageerror", lambda e: logger.warning("[%s] page error: %s", args.job_id, e))
            page.on("console", lambda m: logger.debug("[%s] console %s: %s", args.job_id, m.type, m.text))

            await page.goto(index_url, wait_until="networkidle")
            await page.wait_for_function("window.__renderFlyover && window.__renderFlyover.ready")

            # Setup the flyover with the payload.
            await page.evaluate(f"window.__renderFlyover.setup({setup_payload_json})")

            # Frame loop — drive renderer with explicit t values so timing is deterministic.
            for i in range(total_frames):
                t = i / max(1, total_frames - 1)
                await page.evaluate(f"window.__renderFlyover.renderFrame({t})")
                screenshot_path = frames_dir / f"frame_{i:05d}.png"
                await page.screenshot(path=str(screenshot_path), omit_background=False, full_page=False)
                if i % 30 == 0:
                    logger.info("[%s] frame %d/%d (t=%.3f)", args.job_id, i + 1, total_frames, t)

            await page.evaluate("window.__renderFlyover.teardown()")
        finally:
            await browser.close()


def _encode_mp4(frames_dir: Path, output_path: Path, fps: int) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%05d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",  # required for broad player compatibility (IG, TikTok, QuickTime)
        "-crf", "20",
        "-preset", "medium",
        "-movflags", "+faststart",
        str(output_path),
    ]
    logger.info("ffmpeg: %s", " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RenderError(f"ffmpeg failed (exit {res.returncode}): {res.stderr.strip()[-500:]}")


# Synchronous wrapper for local CLI testing without spinning up FastAPI.
def render_sync(*, renderer_dir: Path, mapbox_token: str, payload: dict[str, Any], output_path: Path) -> None:
    asyncio.run(render_flyover(
        renderer_dir=renderer_dir,
        mapbox_token=mapbox_token,
        payload=payload,
        output_path=output_path,
        job_id="cli",
    ))
