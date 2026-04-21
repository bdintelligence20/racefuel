/**
 * Sodium engine — Fuelcue spec §4 / Matrix sheet "Sodium Model".
 *
 * Formula (spec §4.1):
 *   sodium_mg/h = sweat_rate × effective_[Na+] × replacement_fraction
 *
 *   sweat_rate        = baseline × heat_mult × humidity_mult   (from hydrationCalculator)
 *   effective_[Na+]   = baseline_bucket × intensity_mult × acclimatisation_adj
 *
 * Guardrails (§4.7):
 *   - Floor 300 mg/h for events > 2 h.
 *   - Ceiling 2000 mg/h without sweat-test confirmation (flag).
 *   - Hyponatremia check: fluid_per_hour / sodium_per_hour × 1000 > 1.5 L/g → warn.
 *
 * Citations: Baker 2017, Barnes 2019, Baker 2022, Holmes 2016, McCubbin & Costa
 * 2018, Hew-Butler 2015 (EAH).
 */

export type SweatSodiumBucket = 'low' | 'medium' | 'high' | 'unknown';
export type IntensityBucket = 'easy' | 'moderate' | 'hard';

export interface SodiumInput {
  sweatRateLPerHour: number;
  durationHours: number;
  intensity: IntensityBucket;
  bucket: SweatSodiumBucket;
  heatAcclimatised: boolean;
  earlySeasonHeat: boolean;
  fluidMlPerHour: number;
}

export interface SodiumTarget {
  sodiumMgPerHour: number;
  totalSodiumMg: number;
  sweatNaMmolPerLiter: number;
  sweatNaMgPerLiter: number;
  sodiumLossMgPerHour: number;
  replacementFraction: number;
  floorApplied: boolean;
  ceilingApplied: boolean;
  hyponatremiaRisk: boolean;
  rationale: string;
}

/**
 * Baseline [Na+] prior by bucket (mmol/L).
 * Barnes 2019 normative data: Low < 30, Medium 30–50, High > 50.
 * Unknown users get Medium (the safest central estimate, spec §4.2).
 */
function bucketToMmol(bucket: SweatSodiumBucket): number {
  if (bucket === 'low') return 25;
  if (bucket === 'high') return 55;
  return 40; // medium + unknown default
}

/** Holmes 2016: [Na+] rises with intensity. */
function intensityNaMult(intensity: IntensityBucket): number {
  if (intensity === 'easy') return 1.0;
  if (intensity === 'moderate') return 1.2;
  return 1.5;
}

/** Baker 2022: acclimatised athletes conserve sodium; first 10–14 days of season runs opposite. */
function acclimAdjustment(acclimatised: boolean, earlySeason: boolean): number {
  if (acclimatised) return 0.8; // −20%
  if (earlySeason) return 1.15; // +15%
  return 1.0;
}

/** Replacement fraction by duration (Matrix sheet, cross-ref McCubbin & Costa 2018). */
function replacementFraction(durationHours: number): number {
  if (durationHours < 2) return 0.3; // meals before/after cover most of it
  if (durationHours < 4) return 0.6;
  if (durationHours < 6) return 0.75;
  return 0.9;
}

export function calculateSodium(input: SodiumInput): SodiumTarget {
  const {
    sweatRateLPerHour,
    durationHours,
    intensity,
    bucket,
    heatAcclimatised,
    earlySeasonHeat,
    fluidMlPerHour,
  } = input;

  const baselineMmol = bucketToMmol(bucket);
  const intMult = intensityNaMult(intensity);
  const acclim = acclimAdjustment(heatAcclimatised, earlySeasonHeat);

  const effectiveNaMmol = baselineMmol * intMult * acclim;
  const effectiveNaMgPerL = effectiveNaMmol * 23; // Na atomic mass ≈ 23 g/mol

  const sodiumLossPerHour = sweatRateLPerHour * effectiveNaMgPerL;
  const frac = replacementFraction(durationHours);
  let target = sodiumLossPerHour * frac;

  // Guardrails §4.7
  const FLOOR = 300;
  const CEILING = 2000;
  let floorApplied = false;
  let ceilingApplied = false;
  if (durationHours > 2 && target < FLOOR) {
    target = FLOOR;
    floorApplied = true;
  }
  if (target > CEILING) {
    target = CEILING;
    ceilingApplied = true;
  }

  const sodiumMgPerHour = Math.round(target);
  const totalSodiumMg = Math.round(sodiumMgPerHour * durationHours);

  // Hyponatremia check — spec §4.7. Ratio L-fluid per gram-sodium.
  const sodiumGPerHour = sodiumMgPerHour / 1000;
  const fluidLPerHour = fluidMlPerHour / 1000;
  const hyponatremiaRisk =
    durationHours > 4 && sodiumGPerHour > 0 && fluidLPerHour / sodiumGPerHour > 1.5;

  let rationale = `~${Math.round(effectiveNaMmol)} mmol/L effective [Na+] × ${sweatRateLPerHour.toFixed(2)} L/h sweat × ${Math.round(frac * 100)}% replacement.`;
  if (floorApplied) {
    rationale += ` Floored at ${FLOOR} mg/h (spec minimum for >2 h events).`;
  }
  if (ceilingApplied) {
    rationale += ` Capped at ${CEILING} mg/h — raise only after a sweat test confirms high losses.`;
  }
  if (hyponatremiaRisk) {
    rationale += ` Fluid:sodium ratio exceeds 1.5 L/g — risk of dilutional hyponatremia on long events.`;
  }

  return {
    sodiumMgPerHour,
    totalSodiumMg,
    sweatNaMmolPerLiter: Math.round(effectiveNaMmol * 10) / 10,
    sweatNaMgPerLiter: Math.round(effectiveNaMgPerL),
    sodiumLossMgPerHour: Math.round(sodiumLossPerHour),
    replacementFraction: frac,
    floorApplied,
    ceilingApplied,
    hyponatremiaRisk,
    rationale,
  };
}
