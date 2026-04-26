/**
 * Route geometry helpers — keep waypoint positions honest.
 *
 * The old marker drag code computed `newKm = (vertexIndex / (n-1)) * totalKm`
 * which only works when GPS samples are uniformly spaced. They aren't —
 * urban tracking typically has 2–3× sample density at intersections, so the
 * marker would visually snap to the dragged-to point but the stored
 * `distanceKm` would be off by hundreds of meters. These utilities use
 * cumulative haversine distance, which is invariant to sample density.
 */

import { GpsPoint } from '../../context/AppContext';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const aTerm = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(aTerm), Math.sqrt(1 - aTerm));
}

/** Per-vertex running distance along the path, in km. Same length as gpsPath;
 *  cumulative[0] = 0, cumulative[n-1] = total route length. */
export function cumulativeDistancesKm(gpsPath: GpsPoint[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < gpsPath.length; i++) {
    if (i > 0) acc += haversineKm(gpsPath[i - 1], gpsPath[i]);
    out.push(acc);
  }
  return out;
}

/** Look up the GPS position at a target kilometre along the route. Linear
 *  interpolates between the two surrounding vertices so the returned point
 *  isn't snapped to a vertex — the marker can sit visually wherever the user
 *  actually dropped it. */
export function gpsPositionAtKm(
  gpsPath: GpsPoint[],
  cumulative: number[],
  km: number,
): GpsPoint {
  if (gpsPath.length === 0) return { lat: 0, lng: 0 };
  const total = cumulative[cumulative.length - 1];
  const clamped = Math.max(0, Math.min(total, km));
  // Binary search the first index whose cumulative distance ≥ km.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < clamped) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return gpsPath[0];
  const a = gpsPath[lo - 1];
  const b = gpsPath[lo];
  const segLen = cumulative[lo] - cumulative[lo - 1];
  if (segLen <= 0) return b;
  const t = (clamped - cumulative[lo - 1]) / segLen;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    elevation: a.elevation != null && b.elevation != null
      ? a.elevation + (b.elevation - a.elevation) * t
      : a.elevation ?? b.elevation,
  };
}

/** Project an arbitrary lng/lat onto the closest point along the route line
 *  (not the closest vertex) and return the cumulative kilometre at that
 *  projection. This is what the drag handler should call so the stored
 *  distanceKm matches what the user sees. */
export function kmFromLngLat(
  gpsPath: GpsPoint[],
  cumulative: number[],
  lng: number,
  lat: number,
): number {
  if (gpsPath.length < 2) return 0;
  let bestKm = 0;
  let bestDist = Infinity;
  // Iterate segments. For each, find the projection of (lng,lat) onto the
  // segment in lat/lng space (small-angle approximation is fine for distances
  // ≤ a few km). Pick the segment whose projection is closest.
  for (let i = 1; i < gpsPath.length; i++) {
    const a = gpsPath[i - 1];
    const b = gpsPath[i];
    const ax = a.lng;
    const ay = a.lat;
    const bx = b.lng;
    const by = b.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((lng - ax) * dx + (lat - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const px = ax + dx * t;
    const py = ay + dy * t;
    const dxp = lng - px;
    const dyp = lat - py;
    const dSq = dxp * dxp + dyp * dyp;
    if (dSq < bestDist) {
      bestDist = dSq;
      const segLen = cumulative[i] - cumulative[i - 1];
      bestKm = cumulative[i - 1] + segLen * t;
    }
  }
  return bestKm;
}
