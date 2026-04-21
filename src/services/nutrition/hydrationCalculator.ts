/**
 * Hydration engine — Fuelcue spec §3 / Matrix sheets "Carb & Fluid Tiers" and "Sodium Model".
 *
 * Principle (ACSM 2007): keep body-mass loss < 2% over the session.
 *
 *   fluid_per_hour = sweat_rate × replacement_fraction
 *   sweat_rate     = baseline(sport, intensity) × heat_multiplier × humidity_adj
 *
 * Heat flows through sweat rate ONLY; it does NOT move [Na+] directly — that's the
 * acclimatisation channel (Baker 2022). The sodium side of the plan is produced by
 * sodiumCalculator.ts using the sweat_rate we compute here.
 *
 * Safety bound (spec §3.3, Hew-Butler 2015 EAH consensus): don't recommend sustained
 * fluid intake above ~800 ml/h for events > 4 h without matched sodium.
 */

import { calculateSodium, SweatSodiumBucket, IntensityBucket } from './sodiumCalculator';

export type Sport = 'running' | 'cycling';
export type SweatRateSelfReport = 'light' | 'moderate' | 'heavy';

export interface HydrationTarget {
  fluidMlPerHour: number;
  sodiumMgPerHour: number;
  totalFluidLiters: number;
  totalSodiumMg: number;
  sweatRateLPerHour: number;
  replacementFraction: number;
  ultraCapApplied: boolean;
  hyponatremiaRisk: boolean;
  rationale: string;
}

export interface HydrationInput {
  bodyWeightKg: number;
  durationHours: number;
  temperatureCelsius: number;
  humidity: number;
  intensityPercent: number;
  sweatRate: SweatRateSelfReport;
  sport?: Sport;
  sweatSodiumBucket?: SweatSodiumBucket;
  heatAcclimatised?: boolean;
  earlySeasonHeat?: boolean;
}

function intensityBucket(intensityPercent: number): IntensityBucket {
  if (intensityPercent < 0.65) return 'easy';
  if (intensityPercent < 0.80) return 'moderate';
  return 'hard';
}

/**
 * Baseline sweat rate (L/h) at moderate intensity, ~20°C ambient.
 * Population priors (Barnes 2019): running 1.0, cycling 0.9. Self-reported
 * sweatRate scales from the baseline for an individual user.
 */
function baselineSweatRate(sport: Sport, selfReport: SweatRateSelfReport): number {
  const sportBase = sport === 'cycling' ? 0.9 : 1.0;
  const scale =
    selfReport === 'light' ? 0.7 :
    selfReport === 'heavy' ? 1.3 :
                             1.0;
  return sportBase * scale;
}

/** Matrix sheet "Sodium Model" — heat ladder. */
function heatMultiplier(tempC: number): number {
  if (tempC < 18) return 1.0;
  if (tempC < 25) return 1.2;
  if (tempC < 30) return 1.5;
  if (tempC < 35) return 1.8;
  return 2.1;
}

/** Humidity impairs evaporative cooling; sweat output rises without cooling benefit. */
function humidityMultiplier(rh: number): number {
  return rh > 70 ? 1.2 : 1.0;
}

/** Intensity modifier on volume. Easy ~80% of moderate; hard ~115%. */
function intensitySweatMult(intensity: IntensityBucket): number {
  if (intensity === 'easy') return 0.8;
  if (intensity === 'hard') return 1.15;
  return 1.0;
}

/** Replacement fraction by duration (spec §3.2, ACSM 2007 — replace 60–100%). */
function replacementFractionForDuration(durationHours: number): number {
  if (durationHours < 2) return 0.6;
  if (durationHours < 4) return 0.7;
  if (durationHours < 6) return 0.8;
  return 0.9;
}

export function calculateHydration(input: HydrationInput): HydrationTarget {
  const {
    durationHours,
    temperatureCelsius,
    humidity,
    intensityPercent,
    sweatRate,
    sport = 'running',
    sweatSodiumBucket = 'unknown',
    heatAcclimatised = false,
    earlySeasonHeat = false,
  } = input;

  const intensity = intensityBucket(intensityPercent);

  const baseline = baselineSweatRate(sport, sweatRate);
  const heat = heatMultiplier(temperatureCelsius);
  const humid = humidityMultiplier(humidity);
  const intMult = intensitySweatMult(intensity);

  const sweatRateLPerHour = Math.round(baseline * heat * humid * intMult * 100) / 100;

  const frac = replacementFractionForDuration(durationHours);
  let fluidMlPerHour = Math.round(sweatRateLPerHour * 1000 * frac);

  // Spec §3.3 / Hew-Butler 2015 — hyponatremia guardrail on long events.
  const ULTRA_CAP_ML = 800;
  const ultraCapApplied = durationHours > 4 && fluidMlPerHour > ULTRA_CAP_ML;
  if (ultraCapApplied) fluidMlPerHour = ULTRA_CAP_ML;

  const totalFluidLiters = Math.round(fluidMlPerHour * durationHours) / 1000;

  const sodium = calculateSodium({
    sweatRateLPerHour,
    durationHours,
    intensity,
    bucket: sweatSodiumBucket,
    heatAcclimatised,
    earlySeasonHeat,
    fluidMlPerHour,
  });

  const pieces: string[] = [];
  pieces.push(`Sweat rate ~${sweatRateLPerHour} L/h (${sport}, ${intensity}, ${temperatureCelsius}°C, ${humidity}% RH).`);
  pieces.push(`Replacing ${Math.round(frac * 100)}% → ${fluidMlPerHour} ml/h.`);
  if (ultraCapApplied) {
    pieces.push(`Capped at ${ULTRA_CAP_ML} ml/h for event > 4 h (hyponatremia guardrail).`);
  }
  if (heatAcclimatised) pieces.push('Heat-acclimatised: sodium losses ~20% lower.');
  if (earlySeasonHeat) pieces.push('Early heat season: sodium losses elevated ~15%.');

  return {
    fluidMlPerHour,
    sodiumMgPerHour: sodium.sodiumMgPerHour,
    totalFluidLiters,
    totalSodiumMg: sodium.totalSodiumMg,
    sweatRateLPerHour,
    replacementFraction: frac,
    ultraCapApplied,
    hyponatremiaRisk: sodium.hyponatremiaRisk,
    rationale: pieces.join(' '),
  };
}
