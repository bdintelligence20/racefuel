import { RouteData, GpsPoint } from '../../context/AppContext';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function interpolateGpsPosition(
  gpsPath: GpsPoint[],
  distanceKm: number,
  totalDistanceKm: number
): { lat: number; lng: number; elevation?: number } {
  const progress = Math.min(1, Math.max(0, distanceKm / totalDistanceKm));
  const idx = Math.floor(progress * (gpsPath.length - 1));
  const point = gpsPath[Math.min(idx, gpsPath.length - 1)];
  return { lat: point.lat, lng: point.lng, elevation: point.elevation };
}

export function generateGpx(routeData: RouteData): string {
  const { name, distanceKm, nutritionPoints, gpsPath } = routeData;

  const totalCarbs = nutritionPoints.reduce((sum, p) => sum + p.product.carbs, 0);
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1" creator="RACEFUEL" xmlns="http://www.topografix.com/GPX/1/1">');
  lines.push('  <metadata>');
  lines.push(`    <name>${escapeXml(name || 'RACEFUEL Nutrition Plan')}</name>`);
  lines.push(`    <desc>Nutrition plan: ${distanceKm.toFixed(1)}km, ${nutritionPoints.length} points, ${totalCarbs}g carbs</desc>`);
  lines.push(`    <time>${new Date().toISOString()}</time>`);
  lines.push('  </metadata>');

  // Track data
  if (gpsPath && gpsPath.length > 0) {
    lines.push('  <trk>');
    lines.push(`    <name>${escapeXml(name || 'Route')}</name>`);
    lines.push('    <trkseg>');
    for (const point of gpsPath) {
      if (point.elevation !== undefined) {
        lines.push(`      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}"><ele>${point.elevation.toFixed(1)}</ele></trkpt>`);
      } else {
        lines.push(`      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}"></trkpt>`);
      }
    }
    lines.push('    </trkseg>');
    lines.push('  </trk>');
  }

  // Nutrition waypoints
  for (const point of nutritionPoints) {
    let lat = 0, lng = 0;
    let elevation: number | undefined;

    if (gpsPath && gpsPath.length > 0) {
      const pos = interpolateGpsPosition(gpsPath, point.distanceKm, distanceKm);
      lat = pos.lat;
      lng = pos.lng;
      elevation = pos.elevation;
    }

    const category = point.product.category?.toUpperCase() || 'FUEL';
    const wptName = `${category} @ ${point.distanceKm.toFixed(1)}km — ${point.product.brand} ${point.product.name}`;
    const desc = `${point.product.carbs}g carbs | ${point.product.calories} cal | ${point.product.sodium}mg Na${point.product.priceZAR ? ` | R${point.product.priceZAR.toFixed(2)}` : ''}`;

    lines.push(`  <wpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">`);
    if (elevation !== undefined) {
      lines.push(`    <ele>${elevation.toFixed(1)}</ele>`);
    }
    lines.push(`    <name>${escapeXml(wptName)}</name>`);
    lines.push(`    <desc>${escapeXml(desc)}</desc>`);
    lines.push('    <sym>Food</sym>');
    lines.push('    <type>nutrition</type>');
    lines.push('  </wpt>');
  }

  lines.push('</gpx>');

  return lines.join('\n');
}

export function downloadGpx(routeData: RouteData): void {
  const gpxContent = generateGpx(routeData);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(routeData.name || 'racefuel-plan').replace(/\s+/g, '_')}_nutrition.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
