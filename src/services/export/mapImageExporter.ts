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

  // Add overlay gradient at bottom for text readability
  const gradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Top-left: RACEFUEL branding
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold italic 28px Inter, sans-serif';
  ctx.fillText('RACEFUEL', 30, 50);

  // Bottom left: Route stats
  const bottomY = height - 30;
  ctx.fillStyle = '#ff6b00';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.fillText(routeData.name || 'Untitled Route', 30, bottomY - 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px "JetBrains Mono", monospace';
  ctx.fillText(
    `${routeData.distanceKm.toFixed(1)}km  |  ${routeData.elevationGain}m gain  |  ${routeData.nutritionPoints.length} nutrition points`,
    30,
    bottomY - 50
  );

  const totalCarbs = routeData.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const totalCost = routeData.nutritionPoints.reduce((s, p) => s + (p.product.priceZAR || 0), 0);
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '16px "JetBrains Mono", monospace';
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
  a.download = `${(routeData.name || 'racefuel').replace(/\s+/g, '_')}_map_${dimension}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { dimensionMap };
