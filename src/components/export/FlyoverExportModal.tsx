import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Video, Play, Square, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { useApp } from '../../context/AppContext';
import {
  setupFlyover,
  teardownFlyover,
  renderFrame,
  runPreview,
  setRenderScale,
  type FlyoverContext,
  type FlyoverOptions,
} from '../../services/flyover/animation';

interface FlyoverExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Aspect = 'landscape' | 'square' | 'portrait';
type Duration = 'auto' | 20 | 30 | 45 | 60;

const aspectMeta: Record<Aspect, { label: string; ratio: string; previewW: number; previewH: number; hdW: number; hdH: number }> = {
  landscape: { label: '16:9', ratio: '16 / 9', previewW: 480, previewH: 270, hdW: 1920, hdH: 1080 },
  square:    { label: '1:1',  ratio: '1 / 1',  previewW: 360, previewH: 360, hdW: 1080, hdH: 1080 },
  portrait:  { label: '9:16', ratio: '9 / 16', previewW: 240, previewH: 427, hdW: 1080, hdH: 1920 },
};

/**
 * Draw the fuelcue branding overlay onto a 2D canvas context. Mirrors what's shown as
 * HTML overlays in the preview, but rendered with canvas API so MediaRecorder picks it
 * up. Font sizes are fixed in canvas pixels so the branding stays readable at any
 * canvas resolution (preview-native, retina, or upscaled).
 */
function drawBranding(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  route: { name: string; distanceKm: number; elevationGain: number; fuelPointCount: number }
): void {
  // Top gradient — plum fading down to draw the eye to the wordmark
  const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.18);
  topGrad.addColorStop(0, 'rgba(61, 33, 82, 0.78)');
  topGrad.addColorStop(1, 'rgba(61, 33, 82, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, height * 0.18);

  // Bottom gradient — plum fading up; deeper so route stats stay readable on busy maps
  const botGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
  botGrad.addColorStop(0, 'rgba(61, 33, 82, 0)');
  botGrad.addColorStop(0.55, 'rgba(61, 33, 82, 0.6)');
  botGrad.addColorStop(1, 'rgba(61, 33, 82, 0.96)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, 0, width, height);

  // Font sizes scale linearly with canvas width using a 240-px-wide baseline. At HD
  // (1080×1920) the brand wordmark is ~108px — chunky and readable when the file gets
  // upscaled or viewed full-screen on a phone. At preview-native (240 wide) it drops back
  // to 24px so the in-app preview overlay isn't dominated.
  const fontFamily = '"Montserrat", "Inter", system-ui, sans-serif';
  const s = width / 240;
  const brandSize = 24 * s;
  const tagSize = 10 * s;
  const nameSize = 22 * s;
  const statsSize = 14 * s;
  const padX = 16 * s;
  const padY = 14 * s;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Top-left: fuelcue wordmark + tagline
  ctx.fillStyle = '#F5A020';
  ctx.font = `800 ${brandSize}px ${fontFamily}`;
  ctx.fillText('fuelcue', padX, padY + brandSize);

  ctx.fillStyle = 'rgba(255, 205, 107, 0.7)';
  ctx.font = `700 ${tagSize}px ${fontFamily}`;
  ctx.fillText('ROUTE AWARE NUTRITION', padX, padY + brandSize + tagSize + 4);

  // Bottom: route name + stats
  const bottomY = height - padY;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = `600 ${statsSize}px ${fontFamily}`;
  ctx.fillText(
    `${route.distanceKm.toFixed(1)}km · ${route.elevationGain}m · ${route.fuelPointCount} fuel points`,
    padX,
    bottomY
  );
  ctx.fillStyle = '#FFCD6B';
  ctx.font = `800 ${nameSize}px ${fontFamily}`;
  ctx.fillText(route.name || 'Untitled route', padX, bottomY - statsSize - 6);
}

function getMapStyle(): string {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12';
}

function autoDuration(distanceKm: number): number {
  // ~0.4s per km, clamped 20–60s. A 50km ride lands at ~20s; 150km lands at the 60s cap.
  return Math.max(20, Math.min(60, Math.round(distanceKm * 0.4)));
}

export function FlyoverExportModal({ isOpen, onClose }: FlyoverExportModalProps) {
  const { routeData } = useApp();
  useModalBehavior(isOpen, onClose);

  const [aspect, setAspect] = useState<Aspect>('landscape');
  const [duration, setDuration] = useState<Duration>('auto');
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [flyoverReady, setFlyoverReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ctxRef = useRef<FlyoverContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resolvedDuration =
    duration === 'auto' ? autoDuration(routeData.distanceKm) : duration;

  const flyoverOptions: FlyoverOptions = useMemo(
    () => ({
      durationSec: resolvedDuration,
      fps: 30,
      terrain3D: true,
    }),
    [resolvedDuration]
  );

  const meta = aspectMeta[aspect];
  const hasRoute = !!routeData.gpsPath && routeData.gpsPath.length >= 2;

  // Create / destroy preview map alongside the modal.
  useEffect(() => {
    if (!isOpen) return;
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapRef.current) return;
    const gpsPath = routeData.gpsPath;
    if (!gpsPath || gpsPath.length < 2) return;

    const token = mapboxgl.accessToken || import.meta.env.VITE_MAPBOX_TOKEN || '';
    if (!token) {
      toast.error('Mapbox token not configured');
      return;
    }
    mapboxgl.accessToken = token;

    let cancelled = false;
    let map: mapboxgl.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const construct = () => {
      if (cancelled || mapRef.current) return;
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return; // wait for layout

      map = new mapboxgl.Map({
        container,
        style: getMapStyle(),
        center: [gpsPath[0].lng, gpsPath[0].lat],
        zoom: 12,
        attributionControl: false,
        interactive: false,
        // Required for MediaRecorder's captureStream to read the canvas.
        preserveDrawingBuffer: true,
      });
      mapRef.current = map;
      resizeObserver?.disconnect();

      map.on('error', (e) => {
        // eslint-disable-next-line no-console
        console.error('[flyover] mapbox error', e?.error ?? e);
      });

      map.on('load', async () => {
        if (cancelled || !map) return;
        setMapLoaded(true);
        map.resize();

        // Remove Mapbox logo + attribution from the preview map (they're DOM controls, not
        // WebGL canvas, so they don't end up in the MP4 anyway — this just keeps the live
        // preview clean).
        container.querySelectorAll('.mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib').forEach((el) => el.remove());

        const flyCtx: FlyoverContext = {
          map,
          gpsPath,
          nutritionPoints: routeData.nutritionPoints,
          options: flyoverOptions,
        };
        ctxRef.current = flyCtx;
        try {
          await setupFlyover(flyCtx);
          if (cancelled) return;
          renderFrame(flyCtx, 0);
          setFlyoverReady(true);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[flyover] setupFlyover failed', err);
          toast.error(err instanceof Error ? err.message : 'Failed to set up flyover');
        }
      });
    };

    // Try once now; if container hasn't laid out yet, defer until ResizeObserver fires.
    construct();
    if (!mapRef.current) {
      resizeObserver = new ResizeObserver(() => construct());
      resizeObserver.observe(container);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      abortRef.current?.abort();
      abortRef.current = null;
      if (ctxRef.current) {
        try { teardownFlyover(ctxRef.current); } catch { /* map may already be gone */ }
        ctxRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
      setMapLoaded(false);
      setFlyoverReady(false);
      setProgress(0);
      setIsPlaying(false);
    };
  }, [isOpen, routeData.gpsPath, routeData.nutritionPoints, flyoverOptions]);

  // When aspect ratio changes, the container's dimensions change — tell mapbox to re-measure.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const id = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(id);
  }, [aspect, mapLoaded]);

  const handlePlay = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setIsPlaying(true);
    setProgress(0);
    try {
      await runPreview(ctx, (t) => setProgress(t), ac.signal);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        toast.error('Preview failed');
      }
    } finally {
      setIsPlaying(false);
      // Reset to opening shot so the user can replay cleanly.
      try { renderFrame(ctx, 0); } catch { /* map may have unmounted */ }
      setProgress(0);
    }
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRender = useCallback(async () => {
    const flyCtx = ctxRef.current;
    const map = mapRef.current;
    if (!flyCtx || !map) return;

    // Pick the best codec the browser supports — Safari/iOS produces MP4, Chrome/Firefox WebM.
    const candidates = [
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

    // To record at HD without changing the visible preview, we expand the wrapper to true
    // HD pixels (1080-wide for portrait, 1920-wide for landscape, etc.), CSS-scale it back
    // down to its visual size so the modal looks unchanged, and bump the camera zoom by
    // log2(scale) so the same patch of world stays visible. Render-scale on the icons
    // keeps cards/dots/route line at the same proportional size on the HD frame.
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { hdW, hdH, previewW } = meta;
    const renderScale = hdW / previewW; // 4.5 for portrait, 4 for landscape, 3 for square
    const visualScale = previewW / hdW;

    const savedStyle = {
      width: wrapper.style.width,
      maxWidth: wrapper.style.maxWidth,
      height: wrapper.style.height,
      aspectRatio: wrapper.style.aspectRatio,
      transform: wrapper.style.transform,
      transformOrigin: wrapper.style.transformOrigin,
      marginBottom: wrapper.style.marginBottom,
    };
    wrapper.style.width = `${hdW}px`;
    wrapper.style.maxWidth = 'none';
    wrapper.style.height = `${hdH}px`;
    wrapper.style.aspectRatio = '';
    wrapper.style.transform = `scale(${visualScale})`;
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.marginBottom = `${-(hdH - hdH * visualScale)}px`;

    map.resize();
    setRenderScale(map, renderScale);
    const savedZoom = flyCtx.options.zoom;
    flyCtx.options.zoom = (savedZoom ?? 13) + Math.log2(renderScale);

    // Wait one idle so the new tiles are ready and the layer-style scaling has rendered
    // before we start recording.
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1200);
      map.once('idle', () => { clearTimeout(t); resolve(); });
    });

    // Repaint the t=0 frame at the new zoom so the first captured frame is correct.
    try { renderFrame(flyCtx, 0); } catch { /* ignore */ }

    const mapCanvas = map.getCanvas();
    const composite = document.createElement('canvas');
    composite.width = mapCanvas.width;
    composite.height = mapCanvas.height;
    const compCtx = composite.getContext('2d');
    const restore = () => {
      Object.assign(wrapper.style, savedStyle);
      setRenderScale(map, 1);
      flyCtx.options.zoom = savedZoom;
      try { map.resize(); } catch { /* ignore */ }
    };

    if (!compCtx) {
      toast.error('Your browser doesn\'t support 2D canvas.');
      restore();
      return;
    }

    // captureStream at 30 fps — most browsers don't actually honor 60fps output even if
    // we ask for it (the encoder downsamples), and asking for 60 was paradoxically dropping
    // bitrate because the recorder rebudgets when frames don't materialise. 30 is honest.
    const stream = composite.captureStream(30);
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try {
      // 8 Mbps is plenty for HD H.264 / VP9 cinematic content. Asking for more sometimes
      // makes the encoder rebudget aggressively and drop frames; 8 lets it deliver
      // consistent quality at consistent fps.
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[flyover] MediaRecorder init failed', err);
      toast.error('Your browser doesn\'t support video recording.');
      restore();
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = (e) => reject(e);
    });

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setIsPlaying(true);
    setProgress(0);

    // Pre-rasterize the branding overlay to a side canvas ONCE. The branding is identical
    // every frame (route name + stats don't change during recording), so re-running 5+
    // fillText calls per frame is wasted CPU. Bake it once, blit it cheaply each frame.
    const route = {
      name: routeData.name,
      distanceKm: routeData.distanceKm,
      elevationGain: routeData.elevationGain,
      fuelPointCount: routeData.nutritionPoints.length,
    };
    const brandingCanvas = document.createElement('canvas');
    brandingCanvas.width = composite.width;
    brandingCanvas.height = composite.height;
    const brandingCtx = brandingCanvas.getContext('2d');
    if (brandingCtx) {
      drawBranding(brandingCtx, brandingCanvas.width, brandingCanvas.height, route);
    }

    // Composite paint loop — copy Mapbox canvas + blit pre-baked branding.
    // Throttled to ~30 fps to match captureStream's sample rate. Without throttling we'd
    // paint 60×/sec on a 1080×1920 canvas (heavy GPU read-back) and only half are seen
    // by the encoder — wasted work that can starve Mapbox of frame time.
    const paintIntervalMs = 1000 / 30;
    let lastPaintAt = 0;
    let painting = true;
    const paintFrame = (now: number) => {
      if (!painting) return;
      if (now - lastPaintAt >= paintIntervalMs - 1) {
        lastPaintAt = now;
        try {
          compCtx.drawImage(mapCanvas, 0, 0);
          if (brandingCtx) compCtx.drawImage(brandingCanvas, 0, 0);
        } catch {
          // Map canvas may have been removed mid-render
        }
      }
      requestAnimationFrame(paintFrame);
    };
    requestAnimationFrame(paintFrame);

    recorder.start(100);

    let aborted = false;
    try {
      await runPreview(flyCtx, (t) => setProgress(t), ac.signal);
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        aborted = true;
      } else {
        // eslint-disable-next-line no-console
        console.error('[flyover] runPreview during record failed', err);
        toast.error('Render failed mid-flight');
        painting = false;
        try { recorder.stop(); } catch { /* ignore */ }
        restore();
        setIsPlaying(false);
        setProgress(0);
        return;
      }
    } finally {
      setIsPlaying(false);
    }

    // Tail paint so the last frame is composited.
    if (painting) {
      try {
        compCtx.drawImage(mapCanvas, 0, 0);
        if (brandingCtx) compCtx.drawImage(brandingCanvas, 0, 0);
      } catch { /* ignore */ }
    }
    painting = false;
    recorder.stop();

    restore();
    try { renderFrame(flyCtx, 0); } catch { /* map may have unmounted */ }
    setProgress(0);

    if (aborted) return;

    let blob: Blob;
    try {
      blob = await stopped;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[flyover] recorder failed', err);
      toast.error('Failed to assemble the video');
      return;
    }

    if (blob.size === 0) {
      toast.error('Got an empty video — please try again');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(routeData.name || 'flyover').replace(/\s+/g, '_')}_${aspect}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Video downloaded (${ext.toUpperCase()} · ${hdW}×${hdH})`);
  }, [aspect, meta, routeData.name, routeData.distanceKm, routeData.elevationGain, routeData.nutritionPoints.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95dvh] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-cyan-400/10 flex items-center justify-center flex-shrink-0 text-cyan-400">
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-display font-bold text-text-primary leading-tight">
                Flyover Video
              </h2>
              <div className="text-xs text-text-muted font-display truncate">
                {routeData.name || 'Untitled route'} · {routeData.distanceKm.toFixed(1)}km · {routeData.nutritionPoints.length} fuel points
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.08] active:bg-accent/[0.12] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {!hasRoute && (
            <div className="text-sm text-text-muted bg-surfaceHighlight border border-[var(--color-border)] rounded-xl p-4">
              Load a GPX route first — the flyover needs a GPS path to follow.
            </div>
          )}

          {hasRoute && (
            <>
              <div
                ref={wrapperRef}
                className="relative mx-auto rounded-xl overflow-hidden bg-black border border-[var(--color-border)]"
                style={{
                  width: '100%',
                  maxWidth: meta.previewW,
                  aspectRatio: meta.ratio,
                }}
              >
                {/* Mapbox forces position:relative on .mapboxgl-map, so absolute+inset-0 collapses
                    to zero height. Use explicit 100%×100% sizing instead — works regardless. */}
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

                {/* Top-of-frame branding (mirrors what'll be composited on the rendered MP4) */}
                {flyoverReady && (
                  <>
                    <div
                      className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
                      style={{ background: 'linear-gradient(180deg, rgba(61,33,82,0.7) 0%, rgba(61,33,82,0) 100%)' }}
                    />
                    <div className="absolute top-2.5 left-3 pointer-events-none select-none">
                      <div className="font-display font-extrabold text-[15px] leading-none" style={{ color: '#F5A020', letterSpacing: '-0.01em' }}>
                        fuelcue
                      </div>
                      <div className="font-display text-[8px] mt-0.5" style={{ color: 'rgba(255,205,107,0.65)', letterSpacing: '0.18em' }}>
                        ROUTE AWARE NUTRITION
                      </div>
                    </div>

                    {/* Bottom-of-frame route stats */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                      style={{ background: 'linear-gradient(0deg, rgba(61,33,82,0.92) 0%, rgba(61,33,82,0) 100%)' }}
                    />
                    <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none select-none">
                      <div className="font-display font-extrabold text-[13px] truncate" style={{ color: '#FFCD6B' }}>
                        {routeData.name || 'Untitled route'}
                      </div>
                      <div className="font-display font-semibold text-[10px] mt-0.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.92)' }}>
                        {routeData.distanceKm.toFixed(1)}km · {routeData.elevationGain}m · {routeData.nutritionPoints.length} fuel points
                      </div>
                    </div>
                  </>
                )}

                {!mapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60 pointer-events-none">
                    Loading map…
                  </div>
                )}
                {mapLoaded && !flyoverReady && (
                  <div className="absolute top-2 right-2 text-[10px] text-white/70 bg-black/40 rounded px-2 py-0.5 pointer-events-none">
                    Adding 3D terrain…
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 pointer-events-none">
                    <div
                      className="h-full bg-cyan-400 transition-[width] duration-100"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                {isPlaying ? (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] hover:border-accent/40 transition-colors text-sm font-display font-semibold text-text-primary"
                  >
                    <Square className="w-4 h-4" /> Stop preview
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    disabled={!flyoverReady}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/40 hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-display font-semibold text-cyan-400"
                  >
                    <Play className="w-4 h-4" /> Play preview · {resolvedDuration}s
                  </button>
                )}
              </div>

              <section>
                <div className="text-xs font-display font-bold text-text-muted uppercase tracking-wider mb-2">Aspect ratio</div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(aspectMeta) as Aspect[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAspect(a)}
                      className={`px-3 py-2 rounded-lg border text-sm font-display font-semibold transition-colors ${
                        aspect === a
                          ? 'bg-accent/10 border-accent/50 text-accent'
                          : 'bg-surfaceHighlight border-[var(--color-border)] text-text-secondary hover:border-accent/30'
                      }`}
                    >
                      {aspectMeta[a].label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="text-xs font-display font-bold text-text-muted uppercase tracking-wider mb-2">Duration</div>
                <div className="grid grid-cols-5 gap-2">
                  {(['auto', 20, 30, 45, 60] as Duration[]).map((d) => (
                    <button
                      key={String(d)}
                      onClick={() => setDuration(d)}
                      className={`px-2 py-2 rounded-lg border text-sm font-display font-semibold transition-colors ${
                        duration === d
                          ? 'bg-accent/10 border-accent/50 text-accent'
                          : 'bg-surfaceHighlight border-[var(--color-border)] text-text-secondary hover:border-accent/30'
                      }`}
                    >
                      {d === 'auto' ? 'Auto' : `${d}s`}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] p-4 flex-shrink-0">
          <button
            onClick={handleRender}
            disabled={!hasRoute || !flyoverReady || isPlaying}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white font-display font-bold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {isPlaying ? `Recording… ${Math.round(progress * 100)}%` : 'Download Video'}
          </button>
          <div className="text-[10px] text-text-muted text-center mt-2 font-display">
            {isPlaying
              ? `Capturing ${resolvedDuration}s of footage from your browser…`
              : `Records the flyover live in your browser · ${resolvedDuration}s · ${aspect}`}
          </div>
        </div>
      </div>
    </div>
  );
}
