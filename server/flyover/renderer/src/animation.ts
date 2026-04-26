// AUTO-GENERATED from src/services/flyover/animation.ts
// Update via: bash bin/sync-flyover-renderer.sh
import type * as mapboxgl from 'mapbox-gl';
import type { GpsPoint, NutritionPoint } from './types';
import {
  buildCumDist,
  sampleAt,
  lerpAngle,
  normalizeAzimuth,
  computeForwardBearing,
} from './geometry';

export interface FlyoverOptions {
  durationSec: number;
  fps: number;
  terrain3D: boolean;
  pitchDeg?: number;
  zoom?: number;
  exaggeration?: number;
}

export interface FlyoverContext {
  map: mapboxgl.Map;
  gpsPath: GpsPoint[];
  nutritionPoints: NutritionPoint[];
  options: FlyoverOptions;
}

interface FeatureRef {
  id: number;
  distanceKm: number;
}

interface InternalState {
  cumDistKm: number[];
  totalDistKm: number;
  features: FeatureRef[];
  registeredImages: string[];
  prevHighlighted: Set<number>;
  prevBearing: number | null;
  prevCenter: [number, number] | null;
  saved: {
    center: mapboxgl.LngLat;
    zoom: number;
    pitch: number;
    bearing: number;
    terrainAdded: boolean;
    skyAdded: boolean;
    hiddenLayers: { id: string; visibility: 'visible' | 'none' }[];
  };
}

const FLYOVER_SOURCE = 'flyover-route';
const FLYOVER_LINE_LAYER = 'flyover-route-line';
const FLYOVER_GLOW_LAYER = 'flyover-route-glow';
const FLYOVER_DOTS_SOURCE = 'flyover-dots';
const FLYOVER_DOTS_LAYER = 'flyover-dots-layer';
const FLYOVER_CARDS_LAYER = 'flyover-cards-layer';
const FLYOVER_CARD_IMAGE_PREFIX = 'flyover-card-';
const SKY_LAYER = 'flyover-sky';
const DEM_SOURCE = 'mapbox-dem';

// Layers from MapView we hide for the duration of the flyover so we can draw our own progressive line on top.
const HIDE_LAYER_IDS = ['route-line', 'route-glow', 'route-hover-area'];

// Highlight window: when distFromHead is in [-LEAD, +TRAIL], the symbol-layer card is opaque.
const MARKER_HIGHLIGHT_LEAD_KM = 0;
const MARKER_HIGHLIGHT_TRAIL_KM = 0.6;
const CENTER_LERP = 0.10;
const BEARING_LERP = 0.05;
const BEARING_LOOK_AHEAD_KM = 0.5;
const BEARING_SAMPLES = 6;
const DEFAULT_PITCH = 45;
const DEFAULT_ZOOM = 13;

const stateByMap = new WeakMap<mapboxgl.Map, InternalState>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

interface CardOpts {
  brandText: string;
  distanceText: string;
  kind: 'start' | 'fuel';
  image: HTMLImageElement | null;
  carbs?: number;
}

/**
 * Render a fully-styled card to a canvas (per fuel point) and return ImageData ready for
 * map.addImage(). Each card is a self-contained sprite — pill, optional product thumb,
 * multi-coloured brand and distance text, drop shadow — used as `icon-image` in a symbol
 * layer for true 3D anchoring with full HTML/CSS-quality typography.
 */
function makeCardImage(opts: CardOpts): { width: number; height: number; data: Uint8ClampedArray } {
  const { brandText, distanceText, kind, image, carbs } = opts;
  const dpr = 3;

  const fontFamily = '"Montserrat", "Inter", system-ui, -apple-system, sans-serif';
  const brandFont = `800 ${13 * dpr}px ${fontFamily}`;
  const distFont = `700 ${10 * dpr}px ${fontFamily}`;
  const fallbackFont = `800 ${11 * dpr}px ${fontFamily}`;

  const padX = 12 * dpr;
  const padY = 10 * dpr;
  const lineGap = 2 * dpr;
  const brandLineHeight = 16 * dpr;
  const distLineHeight = 13 * dpr;
  const imgSize = 30 * dpr;
  const imgRingPad = 2 * dpr;
  const imgGap = 6 * dpr;
  // Cap card screen width so on a 240-px portrait preview the card stays inside the frame.
  const maxContentWidthScreen = 170;
  const maxContentWidth = maxContentWidthScreen * dpr;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Canvas 2D context unavailable');
  mctx.font = brandFont;
  const brandLines = wrapText(mctx, brandText, maxContentWidth);
  const brandWidth = Math.max(...brandLines.map((l) => mctx.measureText(l).width));

  let distWidth = 0;
  if (kind === 'fuel') {
    mctx.font = distFont;
    distWidth = mctx.measureText(distanceText).width;
  }

  const includeImage = kind === 'fuel';
  const imgFootprint = includeImage ? imgSize + imgRingPad * 2 : 0;
  const contentWidth = Math.max(brandWidth, distWidth, imgFootprint);
  const totalContentHeight =
    (includeImage ? imgFootprint + imgGap : 0) +
    brandLines.length * brandLineHeight +
    (kind === 'fuel' ? lineGap + distLineHeight : 0);

  const pillWidth = Math.ceil(contentWidth + padX * 2);
  const pillHeight = Math.ceil(totalContentHeight + padY * 2);

  const shadowPad = 14 * dpr;
  const canvasWidth = Math.ceil(pillWidth + shadowPad * 2);
  const canvasHeight = Math.ceil(pillHeight + shadowPad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Pill background with drop shadow.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 14 * dpr;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4 * dpr;
  ctx.fillStyle = '#3D2152';
  const radius = 11 * dpr;
  const px = shadowPad;
  const py = shadowPad;
  ctx.beginPath();
  ctx.moveTo(px + radius, py);
  ctx.arcTo(px + pillWidth, py, px + pillWidth, py + pillHeight, radius);
  ctx.arcTo(px + pillWidth, py + pillHeight, px, py + pillHeight, radius);
  ctx.arcTo(px, py + pillHeight, px, py, radius);
  ctx.arcTo(px, py, px + pillWidth, py, radius);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = kind === 'start' ? 'rgba(255, 205, 107, 0.55)' : 'rgba(245, 160, 32, 0.30)';
  ctx.stroke();

  let cy = shadowPad + padY;
  const cx = shadowPad + pillWidth / 2;

  // Product thumbnail (white circle with brand-coloured ring + product image, or carbs fallback).
  if (includeImage) {
    const ringR = imgSize / 2 + imgRingPad;
    const cyImg = cy + ringR;
    // White ring background
    ctx.beginPath();
    ctx.arc(cx, cyImg, ringR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = '#F5A020';
    ctx.stroke();

    if (image) {
      // Clip to inner circle, draw image
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cyImg, imgSize / 2, 0, Math.PI * 2);
      ctx.clip();
      try {
        ctx.drawImage(image, cx - imgSize / 2, cy + imgRingPad, imgSize, imgSize);
      } catch {
        // Image was tainted (CORS) — fall through to label below.
      }
      ctx.restore();
    } else {
      // Fallback: draw carb count in plum on white bg
      ctx.fillStyle = '#3D2152';
      ctx.font = fallbackFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${carbs ?? 0}g`, cx, cyImg);
    }
    cy += imgFootprint + imgGap;
  }

  // Brand line(s)
  ctx.fillStyle = '#FFCD6B';
  ctx.font = brandFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const line of brandLines) {
    ctx.fillText(line, cx, cy + brandLineHeight / 2);
    cy += brandLineHeight;
  }

  // Distance line (fuel only)
  if (kind === 'fuel') {
    cy += lineGap;
    ctx.fillStyle = '#F5A020';
    ctx.font = distFont;
    ctx.fillText(distanceText, cx, cy + distLineHeight / 2);
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: img.data };
}

export async function setupFlyover(ctx: FlyoverContext): Promise<void> {
  const { map, gpsPath, nutritionPoints, options } = ctx;
  if (!gpsPath || gpsPath.length < 2) {
    throw new Error('Flyover needs at least 2 GPS points');
  }
  if (stateByMap.has(map)) {
    throw new Error('Flyover already initialised on this map — call teardownFlyover first');
  }

  const { cumDistKm, totalDistKm } = buildCumDist(gpsPath);

  const saved: InternalState['saved'] = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    terrainAdded: false,
    skyAdded: false,
    hiddenLayers: [],
  };

  for (const id of HIDE_LAYER_IDS) {
    if (map.getLayer(id)) {
      const v = (map.getLayoutProperty(id, 'visibility') as 'visible' | 'none') ?? 'visible';
      saved.hiddenLayers.push({ id, visibility: v });
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  }

  if (options.terrain3D) {
    if (!map.getSource(DEM_SOURCE)) {
      map.addSource(DEM_SOURCE, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      saved.terrainAdded = true;
    }
    map.setTerrain({ source: DEM_SOURCE, exaggeration: options.exaggeration ?? 1.4 });

    if (!map.getLayer(SKY_LAYER)) {
      map.addLayer({
        id: SKY_LAYER,
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 12,
        },
      });
      saved.skyAdded = true;
    }
  }

  // Route line (progressively revealed in renderFrame).
  map.addSource(FLYOVER_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [] },
    },
  });
  map.addLayer({
    id: FLYOVER_GLOW_LAYER,
    type: 'line',
    source: FLYOVER_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#F5A020',
      'line-width': 16,
      'line-opacity': 0.5,
      'line-blur': 10,
    },
  });
  map.addLayer({
    id: FLYOVER_LINE_LAYER,
    type: 'line',
    source: FLYOVER_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#FFCD6B',
      'line-width': 5,
    },
  });

  // Load every product image up front so the per-card canvases include them. Failed loads
  // (CORS, 404, etc.) come back as null and the card renders the carb-count fallback instead.
  const productImages = await Promise.all(
    nutritionPoints.map((np) => loadImage(np.product.image || ''))
  );

  // Per-feature pre-rendered card images. Each card is drawn to a canvas at high DPI
  // and registered as a Mapbox image, then referenced by its `imageId` from the symbol
  // layer's `icon-image: ['get', 'imageId']` — full styling control, zero stretching.
  type DotFeature = GeoJSON.Feature<GeoJSON.Point, {
    kind: 'start' | 'fuel';
    imageId: string;
  }>;
  const features: FeatureRef[] = [];
  const dotFeatures: DotFeature[] = [];
  const registeredImages: string[] = [];

  const registerCard = (id: number, opts: CardOpts): string => {
    const imageId = `${FLYOVER_CARD_IMAGE_PREFIX}${id}`;
    if (!map.hasImage(imageId)) {
      const img = makeCardImage(opts);
      map.addImage(imageId, img, { pixelRatio: 3 });
      registeredImages.push(imageId);
    }
    return imageId;
  };

  // Start point (id 0).
  {
    const imageId = registerCard(0, {
      brandText: 'START',
      distanceText: '',
      kind: 'start',
      image: null,
    });
    dotFeatures.push({
      type: 'Feature',
      id: 0,
      geometry: { type: 'Point', coordinates: [gpsPath[0].lng, gpsPath[0].lat] },
      properties: { kind: 'start', imageId },
    });
    features.push({ id: 0, distanceKm: 0 });
  }

  // Fuel points (ids 1..N).
  nutritionPoints.forEach((np, i) => {
    const id = i + 1;
    const sample = sampleAt(gpsPath, cumDistKm, np.distanceKm);
    const brandText =
      [np.product.brand, np.product.name]
        .filter(Boolean)
        .map((s) => s.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() || `${np.product.carbs}g carbs`;
    const distanceText = `${Math.round(np.distanceKm)}km`;
    const imageId = registerCard(id, {
      brandText,
      distanceText,
      kind: 'fuel',
      image: productImages[i],
      carbs: np.product.carbs,
    });
    dotFeatures.push({
      type: 'Feature',
      id,
      geometry: { type: 'Point', coordinates: [sample.lng, sample.lat] },
      properties: { kind: 'fuel', imageId },
    });
    features.push({ id, distanceKm: np.distanceKm });
  });

  map.addSource(FLYOVER_DOTS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: dotFeatures },
  });

  // 3D ground-anchored dots — pitch-aligned to the map plane, scale with perspective.
  // These are always visible and represent the "this point exists" signal.
  map.addLayer({
    id: FLYOVER_DOTS_LAYER,
    type: 'circle',
    source: FLYOVER_DOTS_SOURCE,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 5,
        13, 8,
        16, 14,
        18, 20,
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'kind'], 'start'], '#FFCD6B',
        '#F5A020',
      ],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    },
  });

  // 3D-anchored CARD layer — each card is a pre-rendered sprite (per-feature icon-image).
  // No icon-text-fit, no text-field: all the styling (pill, multi-coloured text, drop shadow)
  // is baked into each PNG-quality image at high DPI. Mapbox positions the icon in WebGL
  // 3D space at the feature's lat/lng, so it stays glued to the dot through any camera move.
  // Visibility comes from feature-state.highlighted (toggled per frame in renderFrame).
  map.addLayer({
    id: FLYOVER_CARDS_LAYER,
    type: 'symbol',
    source: FLYOVER_DOTS_SOURCE,
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-anchor': 'bottom',
      // Base position: 18px above the dot. icon-translate animates a transient offset
      // on top of this so the card "rises up" from below when it opens.
      'icon-offset': [0, -18],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
    paint: {
      'icon-opacity': [
        'case',
        ['boolean', ['feature-state', 'highlighted'], false], 1,
        0,
      ],
      // Note: Mapbox doesn't allow data expressions on icon-translate, so we can't tie a
      // slide-up to feature-state. A longer fade transition is the next best thing.
      'icon-opacity-transition': { duration: 450, delay: 0 },
    },
  });

  stateByMap.set(map, {
    cumDistKm,
    totalDistKm,
    features,
    registeredImages,
    prevHighlighted: new Set(),
    prevBearing: null,
    prevCenter: null,
    saved,
  });

  // Wait one idle so terrain tiles start streaming before the first frame.
  // Cap at 2.5s so a slow tile request can't leave the caller hanging forever.
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2500);
    map.once('idle', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export function renderFrame(ctx: FlyoverContext, t: number): void {
  const { map, gpsPath, options } = ctx;
  const state = stateByMap.get(map);
  if (!state) throw new Error('renderFrame called before setupFlyover');

  const tt = Math.max(0, Math.min(1, t));
  const distKm = tt * state.totalDistKm;

  const head = sampleAt(gpsPath, state.cumDistKm, distKm);

  // Robust target bearing: average bearings across BEARING_SAMPLES segments spanning
  // the next BEARING_LOOK_AHEAD_KM. Single-pair tangent jumps with every GPS wiggle;
  // multi-sample circular mean stays steady through switchbacks and noisy fixes.
  const targetBearing = computeForwardBearing(
    gpsPath,
    state.cumDistKm,
    state.totalDistKm,
    distKm,
    BEARING_LOOK_AHEAD_KM,
    BEARING_SAMPLES,
    state.prevBearing
  );
  const smoothBearing =
    state.prevBearing == null
      ? targetBearing
      : lerpAngle(state.prevBearing, targetBearing, BEARING_LERP);

  const targetCenter: [number, number] = [head.lng, head.lat];
  const smoothCenter: [number, number] =
    state.prevCenter == null
      ? targetCenter
      : [
          state.prevCenter[0] + (targetCenter[0] - state.prevCenter[0]) * CENTER_LERP,
          state.prevCenter[1] + (targetCenter[1] - state.prevCenter[1]) * CENTER_LERP,
        ];

  const revealed: [number, number][] = [];
  for (let i = 0; i <= head.index; i++) {
    revealed.push([gpsPath[i].lng, gpsPath[i].lat]);
  }
  if (head.index < gpsPath.length - 1) {
    revealed.push([head.lng, head.lat]);
  }
  const source = map.getSource(FLYOVER_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: revealed },
    });
  }

  map.jumpTo({
    center: smoothCenter,
    bearing: smoothBearing,
    pitch: options.pitchDeg ?? DEFAULT_PITCH,
    zoom: options.zoom ?? DEFAULT_ZOOM,
  });

  if (options.terrain3D && map.getLayer(SKY_LAYER)) {
    map.setPaintProperty(SKY_LAYER, 'sky-atmosphere-sun', [
      normalizeAzimuth(smoothBearing + 90),
      30,
    ]);
  }

  // Card visibility via feature-state. Mapbox interpolates icon-opacity / text-opacity
  // when the case-expression branch flips, giving a smooth fade in/out without us managing
  // CSS transitions. Cards are anchored 100% in WebGL space — no drift, no detachment.
  const nextHighlighted = new Set<number>();
  for (const f of state.features) {
    const distFromHead = distKm - f.distanceKm;
    if (distFromHead >= -MARKER_HIGHLIGHT_LEAD_KM && distFromHead <= MARKER_HIGHLIGHT_TRAIL_KM) {
      nextHighlighted.add(f.id);
    }
  }
  // Diff against previous frame to minimise setFeatureState calls.
  for (const id of nextHighlighted) {
    if (!state.prevHighlighted.has(id)) {
      map.setFeatureState({ source: FLYOVER_DOTS_SOURCE, id }, { highlighted: true });
    }
  }
  for (const id of state.prevHighlighted) {
    if (!nextHighlighted.has(id)) {
      map.setFeatureState({ source: FLYOVER_DOTS_SOURCE, id }, { highlighted: false });
    }
  }
  state.prevHighlighted = nextHighlighted;

  state.prevBearing = smoothBearing;
  state.prevCenter = smoothCenter;
}

export function teardownFlyover(ctx: FlyoverContext): void {
  const { map } = ctx;
  const state = stateByMap.get(map);
  if (!state) return;

  for (const id of [FLYOVER_CARDS_LAYER, FLYOVER_DOTS_LAYER, FLYOVER_LINE_LAYER, FLYOVER_GLOW_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [FLYOVER_DOTS_SOURCE, FLYOVER_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id);
  }
  for (const imageId of state.registeredImages) {
    if (map.hasImage(imageId)) map.removeImage(imageId);
  }

  if (state.saved.skyAdded && map.getLayer(SKY_LAYER)) map.removeLayer(SKY_LAYER);
  if (state.saved.terrainAdded) {
    map.setTerrain(null);
    if (map.getSource(DEM_SOURCE)) map.removeSource(DEM_SOURCE);
  }

  for (const { id, visibility } of state.saved.hiddenLayers) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  }

  map.jumpTo({
    center: state.saved.center,
    zoom: state.saved.zoom,
    pitch: state.saved.pitch,
    bearing: state.saved.bearing,
  });

  stateByMap.delete(map);
}

/**
 * Drives the flyover via requestAnimationFrame for in-browser preview.
 * The headless renderer drives renderFrame() directly with explicit `t` values
 * instead so frame timing is deterministic.
 */
export function runPreview(
  ctx: FlyoverContext,
  onProgress?: (t: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const totalMs = ctx.options.durationSec * 1000;
  const startMs = performance.now();

  return new Promise<void>((resolve, reject) => {
    let raf = 0;
    const onAbort = () => {
      cancelAnimationFrame(raf);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const frame = (now: number) => {
      const t = Math.min(1, (now - startMs) / totalMs);
      try {
        renderFrame(ctx, t);
      } catch (err) {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
        return;
      }
      onProgress?.(t);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    };
    raf = requestAnimationFrame(frame);
  });
}
