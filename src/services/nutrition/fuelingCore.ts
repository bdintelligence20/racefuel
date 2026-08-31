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
