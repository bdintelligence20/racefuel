import { RouteData } from '../../context/AppContext';

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

export async function exportMapImage(
  routeData: RouteData,
  dimension: ImageDimension = 'landscape'
): Promise<void> {
  const mapCanvas = getMapCanvas();
  if (!mapCanvas) {
    throw new Error('Map canvas not found. Load a route first.');
  }

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Set dimensions based on chosen aspect ratio
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

  // Draw map (stretched to fit, maintaining content)
  ctx.drawImage(mapCanvas, 0, 0, width, height);

  // Brand-colored overlay gradient (plum tones instead of plain black)
  const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
  gradient.addColorStop(0, 'rgba(61, 33, 82, 0)');
  gradient.addColorStop(0.5, 'rgba(61, 33, 82, 0.4)');
  gradient.addColorStop(1, 'rgba(61, 33, 82, 0.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Top overlay for branding
  const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.12);
  topGradient.addColorStop(0, 'rgba(61, 33, 82, 0.7)');
  topGradient.addColorStop(1, 'rgba(61, 33, 82, 0)');
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, height * 0.12);

  // Top-left: fuelcue branding
  ctx.fillStyle = '#F5A020';
  ctx.font = 'bold 32px Montserrat, Inter, sans-serif';
  ctx.fillText('fuelcue', 30, 50);

  // Tagline
  ctx.fillStyle = 'rgba(255, 205, 107, 0.6)';
  ctx.font = '500 12px Montserrat, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('ROUTE AWARE NUTRITION', 30, 72);

  // Bottom left: Route stats
  const bottomY = height - 30;
  ctx.fillStyle = '#FFCD6B';
  ctx.font = 'bold 28px Montserrat, sans-serif';
  ctx.fillText(routeData.name || 'Untitled Route', 30, bottomY - 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 18px Montserrat, sans-serif';
  ctx.fillText(
    `${routeData.distanceKm.toFixed(1)}km  |  ${routeData.elevationGain}m gain  |  ${routeData.nutritionPoints.length} nutrition points`,
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

  // Convert to blob and download
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

export { dimensionMap };
