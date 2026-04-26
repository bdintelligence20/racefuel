/**
 * Headless renderer bootstrap. Exposes `window.__renderFlyover` for the Python server
 * to drive via Playwright `page.evaluate()`. The server calls:
 *
 *   await window.__renderFlyover.setup(payload);
 *   for (let i = 0; i < frames; i++) {
 *     await window.__renderFlyover.renderFrame(i / (frames - 1));
 *     <screenshot>
 *   }
 *   await window.__renderFlyover.teardown();
 *
 * Mapbox GL JS is loaded as a global from the CDN <script> tag in index.html.
 */
import { setupFlyover, renderFrame, teardownFlyover, type FlyoverContext } from './animation';
import type { GpsPoint, NutritionPoint } from './types';

// mapboxgl is loaded as a global from the CDN <script> tag in index.html — its runtime
// shape is more permissive than the module's TS export structure (e.g. accessToken is a
// top-level mutable property), so we type it loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const mapboxgl: any;

interface SetupPayload {
  mapboxToken: string;
  styleUrl?: string;
  width: number;
  height: number;
  gpsPath: GpsPoint[];
  nutritionPoints: NutritionPoint[];
  options: {
    durationSec: number;
    fps: number;
    terrain3D: boolean;
  };
}

let ctx: FlyoverContext | null = null;
let map: mapboxgl.Map | null = null;

async function setup(payload: SetupPayload): Promise<{ totalDistKm: number }> {
  if (ctx || map) {
    throw new Error('Renderer already set up — call teardown first');
  }

  // Resize the map div to the requested output dimensions so the canvas matches the video frame.
  const mapEl = document.getElementById('map');
  if (!mapEl) throw new Error('#map element missing');
  mapEl.style.width = `${payload.width}px`;
  mapEl.style.height = `${payload.height}px`;

  mapboxgl.accessToken = payload.mapboxToken;
  const m: mapboxgl.Map = new mapboxgl.Map({
    container: 'map',
    style: payload.styleUrl || 'mapbox://styles/mapbox/outdoors-v12',
    center: [payload.gpsPath[0].lng, payload.gpsPath[0].lat],
    zoom: 12,
    attributionControl: false,
    interactive: false,
    preserveDrawingBuffer: true,
  });
  map = m;

  await new Promise<void>((resolve, reject) => {
    m.once('load', () => resolve());
    m.once('error', (e: { error?: Error }) => reject(e.error ?? new Error('map error')));
  });

  const c: FlyoverContext = {
    map: m,
    gpsPath: payload.gpsPath,
    nutritionPoints: payload.nutritionPoints,
    options: payload.options,
  };
  ctx = c;

  await setupFlyover(c);

  // Render the t=0 frame so the very first screenshot has the camera in position.
  renderFrame(c, 0);
  await waitForIdle();

  // Compute totalDistKm so the server can decide frame count = duration * fps independently.
  // The renderer also returns it so the server can sanity-check.
  const cumDistKm: number[] = [0];
  for (let i = 1; i < payload.gpsPath.length; i++) {
    const a = payload.gpsPath[i - 1];
    const b = payload.gpsPath[i];
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    cumDistKm.push(cumDistKm[i - 1] + 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
  }
  return { totalDistKm: cumDistKm[cumDistKm.length - 1] };
}

async function frame(t: number): Promise<void> {
  if (!ctx || !map) throw new Error('renderer not set up');
  renderFrame(ctx, t);
  await waitForIdle();
}

async function teardown(): Promise<void> {
  if (ctx) {
    try { teardownFlyover(ctx); } catch { /* map may already be removed */ }
    ctx = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
}

/**
 * Wait until the map has settled — all pending tile requests have completed and
 * raster-dem terrain has been applied. Bounded so a slow/failing tile doesn't hang
 * the whole render: timeout fires after 4s.
 */
function waitForIdle(timeoutMs = 4000): Promise<void> {
  const m = map;
  if (!m) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);
    m.once('idle', () => {
      clearTimeout(timeout);
      finish();
    });
  });
}

interface RendererApi {
  setup: typeof setup;
  renderFrame: typeof frame;
  teardown: typeof teardown;
  ready: true;
}

(window as unknown as { __renderFlyover: RendererApi }).__renderFlyover = {
  setup,
  renderFrame: frame,
  teardown,
  ready: true,
};
