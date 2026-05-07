import { RouteData, GpsPoint, NutritionPoint } from '../../context/AppContext';
import { downloadFile } from './downloadFile';

const MAX_RTE_POINTS = 500;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulativeDistanceKm(gpsPath: GpsPoint[]): number[] {
  const out = new Array<number>(gpsPath.length);
  out[0] = 0;
  for (let i = 1; i < gpsPath.length; i++) {
    out[i] = out[i - 1] + haversineKm(gpsPath[i - 1], gpsPath[i]);
  }
  return out;
}

function interpolateAt(
  gpsPath: GpsPoint[],
  cumKm: number[],
  targetKm: number
): GpsPoint {
  const total = cumKm[cumKm.length - 1];
  const t = Math.min(total, Math.max(0, targetKm));
  let lo = 0;
  let hi = cumKm.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (cumKm[mid] <= t) lo = mid;
    else hi = mid;
  }
  const seg = cumKm[hi] - cumKm[lo];
  const a = gpsPath[lo];
  const b = gpsPath[hi];
  if (seg === 0) return a;
  const f = (t - cumKm[lo]) / seg;
  const ele =
    a.elevation !== undefined && b.elevation !== undefined
      ? a.elevation + (b.elevation - a.elevation) * f
      : a.elevation ?? b.elevation;
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
    elevation: ele,
  };
}

function bounds(gpsPath: GpsPoint[]): {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
} {
  let minlat = gpsPath[0].lat;
  let maxlat = gpsPath[0].lat;
  let minlon = gpsPath[0].lng;
  let maxlon = gpsPath[0].lng;
  for (const p of gpsPath) {
    if (p.lat < minlat) minlat = p.lat;
    if (p.lat > maxlat) maxlat = p.lat;
    if (p.lng < minlon) minlon = p.lng;
    if (p.lng > maxlon) maxlon = p.lng;
  }
  return { minlat, minlon, maxlat, maxlon };
}

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number;
  distanceKm: number;
  nutrition?: NutritionPoint;
}

/** Build the rtept list: stride-sampled polyline merged with nutrition cues at
 *  their exact distance, sorted by distance, deduped by proximity. Suunto reads
 *  each rtept as a navigation point — we cap the total so older firmware
 *  doesn't reject the route. */
function buildRoutePoints(
  gpsPath: GpsPoint[],
  cumKm: number[],
  nutritionPoints: NutritionPoint[]
): RoutePoint[] {
  const total = cumKm[cumKm.length - 1];
  const fuelCount = nutritionPoints.length;
  const polylineBudget = Math.max(2, MAX_RTE_POINTS - fuelCount);

  const polyline: RoutePoint[] = [];
  if (gpsPath.length <= polylineBudget) {
    for (let i = 0; i < gpsPath.length; i++) {
      polyline.push({
        lat: gpsPath[i].lat,
        lng: gpsPath[i].lng,
        elevation: gpsPath[i].elevation,
        distanceKm: cumKm[i],
      });
    }
  } else {
    const step = (gpsPath.length - 1) / (polylineBudget - 1);
    for (let i = 0; i < polylineBudget; i++) {
      const idx = Math.min(gpsPath.length - 1, Math.round(i * step));
      polyline.push({
        lat: gpsPath[idx].lat,
        lng: gpsPath[idx].lng,
        elevation: gpsPath[idx].elevation,
        distanceKm: cumKm[idx],
      });
    }
  }

  const cues: RoutePoint[] = nutritionPoints.map((p) => {
    const pos = interpolateAt(gpsPath, cumKm, p.distanceKm);
    return {
      lat: pos.lat,
      lng: pos.lng,
      elevation: pos.elevation,
      distanceKm: Math.min(total, Math.max(0, p.distanceKm)),
      nutrition: p,
    };
  });

  const merged = [...polyline, ...cues].sort(
    (a, b) => a.distanceKm - b.distanceKm
  );

  // Drop polyline points within ~5m of a nutrition cue so the cue stays the
  // named navigation point at that distance (otherwise Suunto can announce a
  // generic polyline point right on top of it).
  const out: RoutePoint[] = [];
  for (const p of merged) {
    if (p.nutrition) {
      while (
        out.length > 0 &&
        !out[out.length - 1].nutrition &&
        Math.abs(out[out.length - 1].distanceKm - p.distanceKm) < 0.005
      ) {
        out.pop();
      }
      out.push(p);
    } else {
      const last = out[out.length - 1];
      if (
        last &&
        last.nutrition &&
        Math.abs(p.distanceKm - last.distanceKm) < 0.005
      ) {
        continue;
      }
      out.push(p);
    }
  }
  return out;
}

function nutritionCueName(point: NutritionPoint): string {
  const category = point.product.category?.toUpperCase() || 'FUEL';
  const km = Math.round(point.distanceKm);
  const brandShort =
    point.product.brand.length > 7
      ? point.product.brand.substring(0, 7)
      : point.product.brand;
  return `${category} ${km}k ${brandShort}`;
}

function nutritionCueDesc(point: NutritionPoint): string {
  const p = point.product;
  return `${p.brand} ${p.name} (${p.carbs}g carbs, ${p.sodium}mg Na, ${
    p.caffeine > 0 ? p.caffeine + 'mg caf' : 'no caf'
  })`;
}

function nutritionCueComment(point: NutritionPoint): string {
  const p = point.product;
  return `${p.carbs}g carbs · ${p.sodium}mg Na${
    p.caffeine > 0 ? ` · ${p.caffeine}mg caf` : ''
  }`;
}

export function generateGpx(routeData: RouteData): string {
  const { name, distanceKm, nutritionPoints, gpsPath } = routeData;

  const totalCarbs = nutritionPoints.reduce(
    (sum, p) => sum + p.product.carbs,
    0
  );
  const routeName = name || 'fuelcue Nutrition Plan';
  const metaDesc = `Nutrition plan: ${distanceKm.toFixed(1)}km, ${
    nutritionPoints.length
  } points, ${totalCarbs}g carbs`;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<gpx version="1.1" creator="fuelcue (https://fuelcue.com)" ' +
      'xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">'
  );

  lines.push('  <metadata>');
  lines.push(`    <name>${escapeXml(routeName)}</name>`);
  lines.push(`    <desc>${escapeXml(metaDesc)}</desc>`);
  lines.push(`    <time>${new Date().toISOString()}</time>`);
  if (gpsPath && gpsPath.length > 0) {
    const b = bounds(gpsPath);
    lines.push(
      `    <bounds minlat="${b.minlat.toFixed(7)}" minlon="${b.minlon.toFixed(
        7
      )}" maxlat="${b.maxlat.toFixed(7)}" maxlon="${b.maxlon.toFixed(7)}"/>`
    );
  }
  lines.push('  </metadata>');

  if (!gpsPath || gpsPath.length === 0) {
    lines.push('</gpx>');
    return lines.join('\n');
  }

  const cumKm = cumulativeDistanceKm(gpsPath);

  // Standalone waypoints — Garmin / generic GPX viewers display these as POIs.
  for (const point of nutritionPoints) {
    const pos = interpolateAt(gpsPath, cumKm, point.distanceKm);
    lines.push(
      `  <wpt lat="${pos.lat.toFixed(7)}" lon="${pos.lng.toFixed(7)}">`
    );
    if (pos.elevation !== undefined) {
      lines.push(`    <ele>${pos.elevation.toFixed(1)}</ele>`);
    }
    lines.push(`    <name>${escapeXml(nutritionCueName(point))}</name>`);
    lines.push(`    <cmt>${escapeXml(nutritionCueComment(point))}</cmt>`);
    lines.push(`    <desc>${escapeXml(nutritionCueDesc(point))}</desc>`);
    lines.push('    <sym>Food</sym>');
    lines.push('    <type>nutrition</type>');
    lines.push('  </wpt>');
  }

  // Route — Suunto reads this as the navigation track and announces every
  // named rtept as a cue. Polyline is downsampled and the nutrition points
  // are merged in at their exact distance.
  const rtepts = buildRoutePoints(gpsPath, cumKm, nutritionPoints);
  lines.push('  <rte>');
  lines.push(`    <name>${escapeXml(routeName)}</name>`);
  lines.push(`    <desc>${escapeXml(metaDesc)}</desc>`);
  for (const p of rtepts) {
    lines.push(
      `    <rtept lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">`
    );
    if (p.elevation !== undefined) {
      lines.push(`      <ele>${p.elevation.toFixed(1)}</ele>`);
    }
    if (p.nutrition) {
      lines.push(
        `      <name>${escapeXml(nutritionCueName(p.nutrition))}</name>`
      );
      lines.push(
        `      <cmt>${escapeXml(nutritionCueComment(p.nutrition))}</cmt>`
      );
      lines.push(
        `      <desc>${escapeXml(nutritionCueDesc(p.nutrition))}</desc>`
      );
      lines.push('      <sym>Food</sym>');
      lines.push('      <type>nutrition</type>');
    }
    lines.push('    </rtept>');
  }
  lines.push('  </rte>');

  // Track — full-resolution polyline with elevation. Most apps (Strava,
  // Komoot, Garmin Connect) draw the route line from this.
  lines.push('  <trk>');
  lines.push(`    <name>${escapeXml(routeName)}</name>`);
  lines.push('    <type>nutrition-plan</type>');
  lines.push('    <trkseg>');
  for (const point of gpsPath) {
    if (point.elevation !== undefined) {
      lines.push(
        `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(
          7
        )}"><ele>${point.elevation.toFixed(1)}</ele></trkpt>`
      );
    } else {
      lines.push(
        `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(
          7
        )}"></trkpt>`
      );
    }
  }
  lines.push('    </trkseg>');
  lines.push('  </trk>');

  lines.push('</gpx>');
  return lines.join('\n');
}

export function downloadGpx(routeData: RouteData): void {
  const gpxContent = generateGpx(routeData);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const filename = `${(routeData.name || 'racefuel-plan').replace(
    /\s+/g,
    '_'
  )}_nutrition.gpx`;
  void downloadFile(blob, filename, 'application/gpx+xml');
}
