/**
 * Caffeine timing strategy optimizer
 * Based on caffeine absorption kinetics: peak plasma at 45-60 min post-ingestion
 */

export interface CaffeineRecommendation {
  totalCaffeineMg: number;
  maxPerDoseMg: number;
  firstDoseKm: number;
  firstDosePercent: number;  // % of route
  rationale: string;
  timing: 'none' | 'late-only' | 'distributed';
}

export interface CaffeineInput {
  bodyWeightKg: number;
  durationHours: number;
  distanceKm: number;
  isRegularConsumer: boolean;
  targetMgPerKg: number;     // 3-6 mg/kg typical
}

export function calculateCaffeineStrategy(input: CaffeineInput): CaffeineRecommendation {
  const { bodyWeightKg, durationHours, distanceKm, isRegularConsumer, targetMgPerKg } = input;

  // No caffeine for short efforts
  if (durationHours < 1) {
    return {
      totalCaffeineMg: 0,
      maxPerDoseMg: 0,
      firstDoseKm: distanceKm,
      firstDosePercent: 100,
      rationale: 'Caffeine unnecessary for efforts under 1 hour',
      timing: 'none',
    };
  }

  // Calculate total caffeine budget
  const target = Math.max(3, Math.min(6, targetMgPerKg));
  const totalCaffeineMg = Math.round(bodyWeightKg * target);

  // Regular consumers may need slightly more for same effect
  const adjustedTotal = isRegularConsumer
    ? Math.round(totalCaffeineMg * 1.1)
    : totalCaffeineMg;

  // Max single dose: ~200mg or 3mg/kg, whichever is lower
  const maxPerDoseMg = Math.min(200, Math.round(bodyWeightKg * 3));

  // Timing: caffeine peaks at 45-60min, save for when it's needed most
  // For events >2.5hr: start at 50-60% through
  // For events 1-2.5hr: single dose at ~40% through
  let firstDosePercent: number;
  let timing: CaffeineRecommendation['timing'];
  let rationale: string;

  if (durationHours < 2.5) {
    firstDosePercent = 40;
    timing = 'late-only';
    rationale = `Single caffeine dose at ~${Math.round(distanceKm * 0.4)}km for peak effect in final third`;
  } else {
    firstDosePercent = 55;
    timing = 'distributed';
    rationale = `Start caffeine at ~${Math.round(distanceKm * 0.55)}km, distribute across final 45% for sustained effect`;
  }

  const firstDoseKm = Math.round(distanceKm * (firstDosePercent / 100) * 10) / 10;

  return {
    totalCaffeineMg: adjustedTotal,
    maxPerDoseMg,
    firstDoseKm,
    firstDosePercent,
    rationale,
    timing,
  };
}

/**
 * Check if a product should be placed as a caffeine source at a given distance.
 *
 * late-only: fire once (a single dose at the 40% mark). After any caffeine has
 * been consumed we fall back to normal product selection — otherwise the loop
 * will keep picking the same caffeinated gel until the budget is met, which
 * starves the carb target if that gel happens to be low-carb.
 *
 * distributed: fire each time until the total-caffeine budget is satisfied,
 * spreading doses across the final phase of the event.
 */
export function shouldUseCaffeineProduct(
  distanceKm: number,
  _totalDistanceKm: number,
  caffeineStrategy: CaffeineRecommendation,
  currentCaffeineMg: number
): boolean {
  if (caffeineStrategy.timing === 'none') return false;
  if (distanceKm < caffeineStrategy.firstDoseKm) return false;
  if (currentCaffeineMg >= caffeineStrategy.totalCaffeineMg) return false;
  if (caffeineStrategy.timing === 'late-only' && currentCaffeineMg > 0) return false;
  return true;
}
