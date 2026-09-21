/**
 * Shared fueling core.
 *
 * The per-hour targets — carbs g/h, fluid ml/h, sodium mg/h, caffeine — are
 * time-driven and physiology-driven, NOT route-driven (see carbCalculator's
 * header: carb need is duration-tiered). Both the route planner and the AI
 * planner computed them with the same three calls and identical argument
 * mapping; this collapses that into one function so there is a single place
 * the targets are derived.
 *
 * Phase 1 is EXTRACTION ONLY — the evidence-locked calculators are untouched
 * and the composed result is byte-identical to the previous inline calls (see
 * planGenerator.snapshot.test.ts). Callers still compute `intensityPercent`
 * themselves and pass it in, so nothing about how intensity is derived changes
 * here.
 */
import { UserProfile } from '../../context/AppContext';
import { calculateCarbTarget, CarbTarget } from './carbCalculator';
import { calculateHydration, HydrationTarget } from './hydrationCalculator';
import { calculateCaffeineStrategy, CaffeineRecommendation } from './caffeineStrategy';

export interface FuelingConditions {
  temperatureCelsius: number;
  humidity: number;
  isCompetition: boolean;
  /** Distance only feeds the caffeine strategy's dose windows — the carb and
   *  fluid/sodium targets ignore it. Kept here so this stays the single call
   *  site; the time-driven gut-training path (Phase 2) passes a derived or
   *  informational distance, never one that sets duration. */
  distanceKm: number;
}

export interface FuelingTargets {
  carbTarget: CarbTarget;
  hydrationTarget: HydrationTarget;
  caffeineStrategy: CaffeineRecommendation;
}

/**
 * Composes the carb, hydration (which produces sodium) and caffeine targets
 * for an effort of `durationHours` at `intensityPercent`. Argument mapping is
 * identical to the previous inline calls in planGenerator and geminiPlanner.
 */
export function computeFuelingTargets(
  durationHours: number,
  intensityPercent: number,
  profile: UserProfile,
  conditions: FuelingConditions,
): FuelingTargets {
  const sport = profile.sport ?? 'running';
  const gutTolerance = profile.gutTolerance ?? 'trained';

  const carbTarget = calculateCarbTarget({
    durationHours,
    intensityPercent,
    gutTolerance,
    isCompetition: conditions.isCompetition,
    bodyWeightKg: profile.weight,
    userOverrideGPerHour: profile.carbTargetGPerHour,
  });

  const hydrationTarget = calculateHydration({
    bodyWeightKg: profile.weight,
    durationHours,
    temperatureCelsius: conditions.temperatureCelsius,
    humidity: conditions.humidity,
    intensityPercent,
    sweatRate: profile.sweatRate,
    sport,
    sweatSodiumBucket: profile.sweatSodiumBucket ?? 'unknown',
    heatAcclimatised: profile.heatAcclimatised ?? false,
    earlySeasonHeat: profile.earlySeasonHeat ?? false,
  });

  const caffeineStrategy = calculateCaffeineStrategy({
    bodyWeightKg: profile.weight,
    durationHours,
    distanceKm: conditions.distanceKm,
    isRegularConsumer: true,
    targetMgPerKg: conditions.isCompetition ? 4 : 3,
  });

  return { carbTarget, hydrationTarget, caffeineStrategy };
}

/* --------------------------- effort → intensity ------------------------- */

/**
 * Maps a 1–10 perceived-effort score to the intensity fraction the calculators
 * use (1 → 0.5, 10 → 0.95). This is the time-driven intensity source shared by
 * any effort-first caller (e.g. gut training). It is deliberately NOT the route
 * planner's `inferIntensity`, which reads pace + elevation off a course — that
 * stays a route concern and is never reachable from a time-only path.
 */
export function effortToIntensity(effortLevel: number): number {
  const clamped = Math.max(1, Math.min(10, effortLevel));
  return Math.max(0.5, Math.min(1.0, 0.5 + (clamped / 10) * 0.45));
}

/* ---------------------------- fuel schedule ----------------------------- */

export interface FuelBlock {
  /** Elapsed minutes from the start of the effort. */
  fromMinutes: number;
  toMinutes: number;
  grams: number;
}

export interface FuelSchedule {
  durationMinutes: number;
  targetGPerHour: number;
  blocks: FuelBlock[];
  totalGrams: number;
}

export interface SchedulePolicy {
  /** Nominal minutes per block; the schedule rounds to a whole number of
   *  blocks within [minBlocks, maxBlocks]. */
  blockMinutes: number;
  minBlocks?: number;
  maxBlocks?: number;
  /** Optional late-effort taper: hold the full rate through `holdFraction` of
   *  the duration, then ramp linearly down to `endMultiplier` by the finish.
   *  GI capacity and appetite typically drop late, so intake front-loads. */
  taper?: { holdFraction: number; endMultiplier: number };
}

/**
 * Time-driven intake schedule: splits an effort of `durationMinutes` into
 * elapsed-time blocks and assigns each block its carbohydrate load from the
 * per-hour target, with an optional late taper. Purely a function of time and
 * rate — no distance, pace, or route anywhere. This is the shared primitive
 * the gut-training session and race-day breakdowns build on; the route planner
 * maps its output onto distance in its own adapter.
 */
export function buildFuelSchedule(
  durationMinutes: number,
  targetGPerHour: number,
  policy: SchedulePolicy,
): FuelSchedule {
  const minBlocks = policy.minBlocks ?? 1;
  const maxBlocks = policy.maxBlocks ?? Infinity;
  const rawBlocks = policy.blockMinutes > 0 ? Math.round(durationMinutes / policy.blockMinutes) : 1;
  const blockCount = Math.max(minBlocks, Math.min(maxBlocks, Math.max(1, rawBlocks)));
  const blockMinutes = durationMinutes / blockCount;

  const blocks: FuelBlock[] = [];
  for (let i = 0; i < blockCount; i++) {
    const fromMinutes = Math.round(i * blockMinutes);
    const toMinutes = i === blockCount - 1 ? Math.round(durationMinutes) : Math.round((i + 1) * blockMinutes);
    const spanHours = (toMinutes - fromMinutes) / 60;
    let multiplier = 1;
    if (policy.taper) {
      const progress = blockCount > 1 ? i / (blockCount - 1) : 0;
      const { holdFraction, endMultiplier } = policy.taper;
      multiplier = progress <= holdFraction
        ? 1
        : 1 - (1 - endMultiplier) * ((progress - holdFraction) / (1 - holdFraction));
    }
    blocks.push({ fromMinutes, toMinutes, grams: Math.round(spanHours * targetGPerHour * multiplier) });
  }

  return {
    durationMinutes: Math.round(durationMinutes),
    targetGPerHour,
    blocks,
    totalGrams: blocks.reduce((sum, b) => sum + b.grams, 0),
  };
}
