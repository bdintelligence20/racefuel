import type * as mapboxgl from 'mapbox-gl';
import { RouteData } from '../../context/AppContext';
import { buildCumDist, sampleAt } from '../flyover/geometry';

export type ImageDimension = 'square' | 'landscape' | 'portrait';

const dimensionMap: Record<ImageDimension, { label: string; ratio: string }> = {
  square: { label: '1:1 Square', ratio: '1:1' },
  landscape: { label: '16:9 Landscape', ratio: '16:9' },
  portrait: { label: '9:16 Portrait', ratio: '9:16' },
};

export function getMapCanvas(): HTMLCanvasElement | null {
  const mapboxCanvas = document.querySelector('.mapboxgl-canvas') as HTMLCanvasElement | null;
  return mapboxCanvas;
}

interface DrawTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Center-cropped (aspect-cover) draw: source fills the destination, cropped if aspects differ. */
function drawAspectCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  dest: { width: number; height: number },
  sourceCssWidth: number,
  sourceCssHeight: number
): DrawTransform {
  const scale = Math.max(dest.width / sourceCssWidth, dest.height / sourceCssHeight);
  const drawW = sourceCssWidth * scale;
  const drawH = sourceCssHeight * scale;
  const offsetX = (dest.width - drawW) / 2;
  const offsetY = (dest.height - drawH) / 2;
  ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
  return { scale, offsetX, offsetY };
}

/** Map a point in source CSS-pixel coords to destination canvas coords using a DrawTransform. */
function transformPoint(t: DrawTransform, cssX: number, cssY: number): { x: number; y: number } {
  return { x: t.offsetX + cssX * t.scale, y: t.offsetY + cssY * t.scale };
}

function drawWaypointMarkers(
  ctx: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  routeData: RouteData,
  transform: DrawTransform,
  outputWidth: number
): void {
  if (!routeData.gpsPath || routeData.gpsPath.length < 2 || routeData.nutritionPoints.length === 0) return;
  const { cumDistKm } = buildCumDist(routeData.gpsPath);
  // Pin radius scales with output width so the markers feel right at any export size.
  const r = Math.max(14, Math.round(outputWidth * 0.014));
  const fontSize = Math.max(11, Math.round(outputWidth * 0.011));

  for (const np of routeData.nutritionPoints) {
    const sample = sampleAt(routeData.gpsPath, cumDistKm, np.distanceKm);
    const cssPt = map.project([sample.lng, sample.lat]);
    const { x, y } = transformPoint(transform, cssPt.x, cssPt.y);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 160, 32, 0.35)';
    ctx.fill();

    // Pin disc — white fill with brand-color border (matches in-app marker design)
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3D2152';
    ctx.stroke();

    // Carb count inside (big visual signal of "this is a fuel point with X carbs")
    ctx.fillStyle = '#3D2152';
    ctx.font = `800 ${Math.round(r * 0.85)}px Montserrat, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${np.product.carbs}g`, x, y + 1);

    // Distance chip below the pin
    const labelText = `${Math.round(np.distanceKm)}km`;
    ctx.font = `800 ${fontSize}px Montserrat, system-ui, sans-serif`;
    const metrics = ctx.measureText(labelText);
    const padX = 6;
    const padY = 3;
    const labelW = metrics.width + padX * 2;
    const labelH = fontSize + padY * 2;
    const labelX = x - labelW / 2;
    const labelY = y + r + 6;
    ctx.fillStyle = 'rgba(61, 33, 82, 0.92)';
    roundRect(ctx, labelX, labelY, labelW, labelH, 4);
    ctx.fill();
    ctx.fillStyle = '#FFCD6B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, labelY + labelH / 2 + 1);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export async function exportMapImage(
  routeData: RouteData,
  dimension: ImageDimension = 'landscape',
  map?: mapboxgl.Map | null
): Promise<void> {
  const mapCanvas = getMapCanvas();
  if (!mapCanvas) {
    throw new Error('Map canvas not found. Load a route first.');
  }

  const outputCanvas = document.createElement('canvas');
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  const baseWidth = 1920;
  let width: number, height: number;
  switch (dimension) {
    case 'square':
      width = baseWidth;
      height = baseWidth;
      break;
    case 'portrait':
      width = 1080;
      height = 1920;
      break;
    default:
      width = baseWidth;
      height = 1080;
  }
  outputCanvas.width = width;
  outputCanvas.height = height;

  // Source CSS dimensions (what the user sees on screen) — drives aspect-cover math.
  const rect = mapCanvas.getBoundingClientRect();
  const transform = drawAspectCover(ctx, mapCanvas, { width, height }, rect.width, rect.height);

  // Overlay nutrition waypoints — only present in the DOM, not in the WebGL canvas.
  if (map) {
    drawWaypointMarkers(ctx, map, routeData, transform, width);
  }

  // Bottom branding gradient
  const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
  gradient.addColorStop(0, 'rgba(61, 33, 82, 0)');
  gradient.addColorStop(0.5, 'rgba(61, 33, 82, 0.4)');
  gradient.addColorStop(1, 'rgba(61, 33, 82, 0.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Top branding gradient
  const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.12);
  topGradient.addColorStop(0, 'rgba(61, 33, 82, 0.7)');
  topGradient.addColorStop(1, 'rgba(61, 33, 82, 0)');
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, height * 0.12);

  // fuelcue wordmark
  ctx.fillStyle = '#F5A020';
  ctx.font = 'bold 32px Montserrat, Inter, sans-serif';
  ctx.fillText('fuelcue', 30, 50);
  ctx.fillStyle = 'rgba(255, 205, 107, 0.6)';
  ctx.font = '500 12px Montserrat, sans-serif';
  ctx.fillText('ROUTE AWARE NUTRITION', 30, 72);

  // Bottom: route name + stats
  const bottomY = height - 30;
  ctx.fillStyle = '#FFCD6B';
  ctx.font = 'bold 28px Montserrat, sans-serif';
  ctx.fillText(routeData.name || 'Untitled Route', 30, bottomY - 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 18px Montserrat, sans-serif';
  ctx.fillText(
    `${routeData.distanceKm.toFixed(1)}km  |  ${routeData.elevationGain}m gain  |  ${routeData.nutritionPoints.length} fuel points`,
    30,
    bottomY - 50
  );

  const totalCarbs = routeData.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const totalCost = routeData.nutritionPoints.reduce((s, p) => s + (p.product.priceZAR || 0), 0);
  ctx.fillStyle = 'rgba(245, 160, 32, 0.8)';
  ctx.font = '16px Montserrat, sans-serif';
  ctx.fillText(
    `${totalCarbs}g carbs  |  R${totalCost.toFixed(2)} total`,
    30,
    bottomY - 20
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to export image')), 'image/png', 1.0);
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(routeData.name || 'fuelcue').replace(/\s+/g, '_')}_map_${dimension}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { dimensionMap, drawAspectCover, transformPoint, drawWaypointMarkers };
