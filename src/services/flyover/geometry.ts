import type { GpsPoint } from '../../context/AppContext';

/** Great-circle distance in kilometres. */
export function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface CumDist {
  cumDistKm: number[];
  totalDistKm: number;
}

export function buildCumDist(gpsPath: GpsPoint[]): CumDist {
  const cum: number[] = [0];
  for (let i = 1; i < gpsPath.length; i++) {
    cum.push(cum[i - 1] + haversineKm(gpsPath[i - 1], gpsPath[i]));
  }
  return { cumDistKm: cum, totalDistKm: cum[cum.length - 1] || 0 };
}

export interface SamplePoint {
  lng: number;
  lat: number;
  /** Index of the segment-end vertex for this sample (1-based for interior, 0 at start, last at end). */
  index: number;
}

export function sampleAt(
  gpsPath: GpsPoint[],
  cumDist: number[],
  targetKm: number
): SamplePoint {
  if (gpsPath.length === 0) throw new Error('sampleAt: empty gpsPath');
  if (targetKm <= 0) {
    return { lng: gpsPath[0].lng, lat: gpsPath[0].lat, index: 0 };
  }
  const total = cumDist[cumDist.length - 1];
  if (targetKm >= total) {
    const last = gpsPath[gpsPath.length - 1];
    return { lng: last.lng, lat: last.lat, index: gpsPath.length - 1 };
  }
  // Binary search for the first index whose cumDist >= targetKm.
  let lo = 0;
  let hi = cumDist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] < targetKm) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const segDist = cumDist[i] - cumDist[i - 1];
  const t = segDist > 0 ? (targetKm - cumDist[i - 1]) / segDist : 0;
  const a = gpsPath[i - 1];
  const b = gpsPath[i];
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    index: i,
  };
}

/** Compass bearing from a → b in degrees, [0, 360). 0 = north, 90 = east. */
export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const lambda1 = (a.lng * Math.PI) / 180;
  const lambda2 = (b.lng * Math.PI) / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Wrap any angle in degrees into [0, 360). Mapbox sky-atmosphere-sun azimuth requires this. */
export function normalizeAzimuth(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Project a point N km from a start in a given bearing direction. Standard great-circle navigation. */
export function destinationPoint(
  startLng: number,
  startLat: number,
  distanceKm: number,
  bearingDeg: number
): { lng: number; lat: number } {
  const R = 6371;
  const ang = distanceKm / R;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (startLat * Math.PI) / 180;
  const lambda1 = (startLng * Math.PI) / 180;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(ang) + Math.cos(phi1) * Math.sin(ang) * Math.cos(theta)
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(ang) * Math.cos(phi1),
    Math.cos(ang) - Math.sin(phi1) * Math.sin(phi2)
  );
  return { lng: (lambda2 * 180) / Math.PI, lat: (phi2 * 180) / Math.PI };
}

/** Shortest-arc lerp between two angles in degrees. Returns [0, 360). e.g. 350° → 10° passes through 0°. */
export function lerpAngle(from: number, to: number, t: number): number {
  const f = normalizeAzimuth(from);
  const target = normalizeAzimuth(to);
  let diff = target - f;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return normalizeAzimuth(f + diff * t);
}

/**
 * Robust forward bearing for the flyover camera. Samples `samples` bearings across
 * [fromKm, fromKm + spanKm] and returns their circular mean. A multi-sample average
 * is dramatically less jittery than a two-point tangent on noisy GPS data.
 *
 * Returns `fallback` (or 0) if we're at the very end of the route, where there's no
 * forward span to look down.
 */
export function computeForwardBearing(
  gpsPath: GpsPoint[],
  cumDist: number[],
  totalDistKm: number,
  fromKm: number,
  spanKm: number,
  samples: number,
  fallback: number | null
): number {
  const end = Math.min(totalDistKm, fromKm + spanKm);
  if (end - fromKm < 0.001) return fallback ?? 0;

  let sumX = 0;
  let sumY = 0;
  let valid = 0;
  for (let i = 0; i < samples; i++) {
    const t1 = fromKm + (i / samples) * (end - fromKm);
    const t2 = fromKm + ((i + 1) / samples) * (end - fromKm);
    const a = sampleAt(gpsPath, cumDist, t1);
    const b = sampleAt(gpsPath, cumDist, t2);
    if (a.lng === b.lng && a.lat === b.lat) continue;
    const rad = (bearingDeg(a, b) * Math.PI) / 180;
    sumX += Math.cos(rad);
    sumY += Math.sin(rad);
    valid++;
  }
  if (valid === 0) return fallback ?? 0;
  return ((Math.atan2(sumY, sumX) * 180) / Math.PI + 360) % 360;
}
