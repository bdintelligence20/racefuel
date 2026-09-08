/**
 * Route-aware FIT export for the main planner. Two shapes the athlete chooses
 * between (see ExportModal):
 *
 *   Route + fuel cues  a FIT Course: the route track plus a Food / Sports-drink
 *                      course point at each fuel stop, so the watch navigates
 *                      the route and prompts by location.
 *   Fuel cues only     a FIT Workout: timed steps that beep at each fuel cue on
 *                      the clock, no route attached.
 *
 * Fuel-stop elapsed time is the app's own km→time model
 * (elapsed = km / total_km * total_seconds), matching the plan's stop times.
 */
import { RouteData, GpsPoint, NutritionPoint } from '../../context/AppContext';
import { downloadFile } from './downloadFile';
import {
  encodeCourseFit,
  encodeWorkoutFit,
  type FitSport,
  type FitTrackPoint,
  type FitCoursePoint,
  type FuelPointType,
} from '../nutrition/fitEncoder';

const MAX_TRACK_POINTS = 800;

function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulativeKm(path: GpsPoint[]): number[] {
  const out = new Array<number>(path.length);
  out[0] = 0;
  for (let i = 1; i < path.length; i++) out[i] = out[i - 1] + haversineKm(path[i - 1], path[i]);
  return out;
}

function interpolateAt(path: GpsPoint[], cumKm: number[], targetKm: number): GpsPoint {
  const total = cumKm[cumKm.length - 1];
  const t = Math.min(total, Math.max(0, targetKm));
  let lo = 0;
  let hi = cumKm.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (cumKm[mid] <= t) lo = mid; else hi = mid;
  }
  const seg = cumKm[hi] - cumKm[lo];
  const a = path[lo];
  const b = path[hi];
  if (seg === 0) return a;
  const f = (t - cumKm[lo]) / seg;
  const ele = a.elevation != null && b.elevation != null ? a.elevation + (b.elevation - a.elevation) * f : a.elevation ?? b.elevation;
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, elevation: ele };
}

/** Total effort in seconds from the route's estimate, falling back to a
 *  sport-appropriate pace when it can't be parsed. */
function totalSeconds(rd: RouteData): number {
  const s = (rd.userEstimatedTime || rd.estimatedTime || '').trim();
  const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) return +colon[1] * 3600 + +colon[2] * 60 + (colon[3] ? +colon[3] : 0);
  let sec = 0;
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  if (h) sec += +h[1] * 3600;
  if (m) sec += +m[1] * 60;
  if (sec > 0) return sec;
  const kmh = rd.routeSport === 'cycle' ? 28 : rd.routeSport === 'hike' ? 5 : 10;
  return Math.max(600, (rd.distanceKm / kmh) * 3600);
}

function sportFor(rd: RouteData): FitSport {
  if (rd.routeSport === 'cycle') return 'cycling';
  if (rd.routeSport === 'hike') return 'generic';
  return 'running';
}

function pointTypeFor(category: string | undefined): FuelPointType {
  if (category === 'gel') return 'energyGel';
  if (category === 'drink') return 'sportsDrink';
  return 'food';
}

function cueLabel(p: NutritionPoint): string {
  return `${p.product.name} ${p.product.carbs}g`;
}

function fileStem(rd: RouteData, suffix: string): string {
  const base = (rd.name || 'fuelcue-plan').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base}-${suffix}`;
}

const FIT_MIME = 'application/vnd.ant.fit';

/** True when the route has a real polyline we can build a course from. */
export function hasRoutePolyline(rd: RouteData): boolean {
  return (rd.gpsPath?.length ?? 0) > 1;
}

/** Route + fuel cues: a FIT Course (route track + Food/Drink course points). */
export function downloadRouteFitCourse(rd: RouteData): void {
  const path = rd.gpsPath;
  if (!path || path.length < 2) {
    // No polyline — fall back to the timed workout so the button still works.
    downloadRouteFitWorkout(rd);
    return;
  }
  const cumKm = cumulativeKm(path);
  const totalKm = cumKm[cumKm.length - 1] || rd.distanceKm || 1;
  const secs = totalSeconds(rd);

  // Stride-sample the polyline to keep the file small.
  const track: FitTrackPoint[] = [];
  const budget = Math.min(path.length, MAX_TRACK_POINTS);
  const step = path.length <= budget ? 1 : (path.length - 1) / (budget - 1);
  for (let i = 0; i < budget; i++) {
    const idx = Math.min(path.length - 1, Math.round(i * step));
    const km = cumKm[idx];
    track.push({
      lat: path[idx].lat,
      lng: path[idx].lng,
      distanceM: Math.round(km * 1000),
      altitudeM: path[idx].elevation,
      elapsedS: Math.round((km / totalKm) * secs),
    });
  }

  const points: FitCoursePoint[] = [...rd.nutritionPoints]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((p) => {
      const pos = interpolateAt(path, cumKm, p.distanceKm);
      return {
        lat: pos.lat,
        lng: pos.lng,
        distanceM: Math.round(Math.min(totalKm, Math.max(0, p.distanceKm)) * 1000),
        type: pointTypeFor(p.product.category),
        name: cueLabel(p),
      };
    });

  const bytes = encodeCourseFit(rd.name || 'fuelcue route', sportFor(rd), track, points);
  void downloadFile(new Blob([bytes], { type: FIT_MIME }), `${fileStem(rd, 'route')}.fit`, FIT_MIME);
}

/** Fuel cues only: a FIT Workout of timed steps (no route). */
export function downloadRouteFitWorkout(rd: RouteData): void {
  const totalKm = rd.distanceKm || 1;
  const secs = totalSeconds(rd);
  const cues = [...rd.nutritionPoints]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((p) => ({
      atMinutes: Math.round(((p.distanceKm / totalKm) * secs) / 60),
      label: cueLabel(p),
    }));
  const bytes = encodeWorkoutFit(`${rd.name || 'fuelcue'} fuel`, sportFor(rd), cues);
  void downloadFile(new Blob([bytes], { type: FIT_MIME }), `${fileStem(rd, 'fuel')}.fit`, FIT_MIME);
}
