/**
 * Unified route-time estimator. The previous code had three separate paths —
 * GPX (`distance/25`), TCX (same), and drawn (Mapbox Directions duration) —
 * that disagreed with each other and produced absurd numbers for ultra/
 * mountain routes (e.g. 176 km UTMB → 6h 53m). This module gives every entry
 * point one estimator with elevation-aware pace and ultra-distance fatigue.
 *
 * Algorithm
 *   Base pace from sport + surface lookup (km/h on flat, no fatigue).
 *   Naismith's Rule: +1 hour per 600 m of climb for run/hike — non-negotiable
 *     floor that captures the energetic cost of vertical work.
 *   Tobler's Hiking Function (when slope-resolved samples exist): integrates
 *     walking velocity per segment as 6 * exp(-3.5 * |slope + 0.05|) km/h,
 *     then re-scales by the sport's flat-pace ratio so the curve generalises
 *     beyond walking.
 *   Riegel fatigue (T2 = T1 * (D2/D1)^1.06): scale time up for distances past
 *     a sport-specific reference (~21 km run, ~80 km ultra threshold, ~120 km
 *     cycle). Without it a flat 25 km/h on a 176 km route was the headline
 *     bug — Riegel keeps the per-km pace honest as distance grows.
 *   Effort scaling (1–10 perceived effort): ±20% wrap around the prediction.
 */

export type Sport = 'run' | 'cycle' | 'hike';
export type Surface = 'road' | 'trail' | 'mountain';

export interface TimeEstimateInput {
  distanceKm: number;
  elevationGainM: number;
  sport?: Sport;
  /** 1–10 perceived effort. 1 → +20% time, 10 → −10% time, 6 ≈ neutral. */
  effortLevel?: number;
  surface?: Surface;
  /** Per-GPS-point cumulative-distance + elevation samples. Enables Tobler
   *  per-segment integration; without it the estimator falls back to flat
   *  pace + Naismith. Lengths must match. */
  cumulativeDistancesKm?: number[];
  elevationsM?: number[];
}

export interface TimeEstimate {
  hours: number;
  basis: 'tobler' | 'naismith' | 'flat';
  notes: string[];
}

interface BasePace {
  /** Flat speed in km/h. */
  flatKmh: number;
  /** Distance (km) past which Riegel fatigue starts compounding. */
  fatigueOnsetKm: number;
}

function basePaceFor(sport: Sport, surface: Surface): BasePace {
  if (sport === 'cycle') {
    if (surface === 'mountain') return { flatKmh: 14, fatigueOnsetKm: 80 };
    if (surface === 'trail') return { flatKmh: 18, fatigueOnsetKm: 100 };
    return { flatKmh: 27, fatigueOnsetKm: 120 };
  }
  if (sport === 'hike') {
    if (surface === 'mountain') return { flatKmh: 4, fatigueOnsetKm: 25 };
    if (surface === 'trail') return { flatKmh: 5, fatigueOnsetKm: 30 };
    return { flatKmh: 5.5, fatigueOnsetKm: 30 };
  }
  // run
  if (surface === 'mountain') return { flatKmh: 5, fatigueOnsetKm: 30 };
  if (surface === 'trail') return { flatKmh: 8, fatigueOnsetKm: 30 };
  return { flatKmh: 12, fatigueOnsetKm: 21 };
}

function naismithExtraHours(sport: Sport, elevationGainM: number): number {
  if (elevationGainM <= 0) return 0;
  // Naismith adds 1 h per 600 m for hikers/runners. Scale down for cycling
  // where much of the climb is rolled at a lower vertical-cost ratio.
  const perMeter = sport === 'cycle' ? 1 / 1500 : 1 / 600;
  return elevationGainM * perMeter;
}

function toblerHours(
  sport: Sport,
  baseFlatKmh: number,
  cumulativeKm: number[],
  elevationsM: number[],
): number | null {
  if (cumulativeKm.length < 2 || cumulativeKm.length !== elevationsM.length) return null;
  // Tobler returns walking km/h. Scale by the sport's flat pace vs Tobler's
  // own flat speed (~5 km/h at slope 0) so it generalises to runs and rides.
  const TOBLER_FLAT_KMH = 6 * Math.exp(-3.5 * 0.05); // ≈ 5.04
  const sportScale = baseFlatKmh / TOBLER_FLAT_KMH;
  let hours = 0;
  for (let i = 1; i < cumulativeKm.length; i++) {
    const segmentKm = cumulativeKm[i] - cumulativeKm[i - 1];
    if (segmentKm <= 0) continue;
    const dEle = (elevationsM[i] ?? 0) - (elevationsM[i - 1] ?? 0);
    const slope = dEle / (segmentKm * 1000); // rise/run
    const toblerKmh = 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
    const segmentKmh = Math.max(0.5, toblerKmh * sportScale);
    hours += segmentKm / segmentKmh;
  }
  // Cycling has poor fit for Tobler (the curve is built for self-powered
  // walking) — return null for cycle so we use flat + Naismith.
  if (sport === 'cycle') return null;
  return hours > 0 ? hours : null;
}

function riegelScale(distanceKm: number, fatigueOnsetKm: number): number {
  if (distanceKm <= fatigueOnsetKm) return 1;
  // Standard Riegel exponent for endurance running (Pete Riegel 1981). We
  // apply it to time-vs-distance scaling above the fatigue onset only — below
  // the threshold the athlete hasn't entered fatigue territory yet.
  const exponent = 1.06;
  return Math.pow(distanceKm / fatigueOnsetKm, exponent - 1);
}

function effortScale(effortLevel: number | undefined): number {
  if (effortLevel == null) return 1;
  const clamped = Math.max(1, Math.min(10, effortLevel));
  // 1 → 1.20 (+20% time, easy day), 6 → 1.00 (neutral), 10 → 0.90 (-10%, race).
  if (clamped <= 6) return 1 + ((6 - clamped) / 5) * 0.2;
  return 1 - ((clamped - 6) / 4) * 0.1;
}

export function estimateRouteTime(input: TimeEstimateInput): TimeEstimate {
  const sport: Sport = input.sport ?? 'run';
  const surface: Surface = input.surface ?? 'road';
  const distance = Math.max(0, input.distanceKm);
  const climb = Math.max(0, input.elevationGainM ?? 0);
  const notes: string[] = [];

  if (distance === 0) return { hours: 0, basis: 'flat', notes: ['zero distance'] };

  const { flatKmh, fatigueOnsetKm } = basePaceFor(sport, surface);

  // Try Tobler when sample arrays are usable; otherwise fall back to
  // flat-pace + Naismith. Either way Riegel and effort scaling apply.
  let hours: number;
  let basis: TimeEstimate['basis'];
  const tobler = toblerHours(
    sport,
    flatKmh,
    input.cumulativeDistancesKm ?? [],
    input.elevationsM ?? [],
  );
  if (tobler != null) {
    hours = tobler;
    basis = 'tobler';
    notes.push(`tobler integration over ${input.cumulativeDistancesKm!.length} samples`);
  } else {
    const flat = distance / flatKmh;
    const climbExtra = naismithExtraHours(sport, climb);
    hours = flat + climbExtra;
    basis = climb > 0 ? 'naismith' : 'flat';
    notes.push(`flat pace ${flatKmh} km/h on ${surface} ${sport}`);
    if (climb > 0) notes.push(`naismith +${climbExtra.toFixed(2)}h for ${climb}m climb`);
  }

  const fatigue = riegelScale(distance, fatigueOnsetKm);
  if (fatigue !== 1) {
    notes.push(`riegel ×${fatigue.toFixed(2)} above ${fatigueOnsetKm}km`);
    hours *= fatigue;
  }

  const effort = effortScale(input.effortLevel);
  if (effort !== 1) {
    notes.push(`effort ${input.effortLevel} ×${effort.toFixed(2)}`);
    hours *= effort;
  }

  return { hours, basis, notes };
}

export function formatHoursAsHms(hours: number): string {
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const h = Math.floor(safe);
  const m = Math.floor((safe - h) * 60);
  const s = Math.floor(((safe - h) * 60 - m) * 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
