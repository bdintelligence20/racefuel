/**
 * Carbohydrate engine — Fuelcue spec §2 / Matrix sheet "Carb & Fluid Tiers".
 *
 * Core rules (Jeukendrup 2014, Burke 2011, Stellingwerff 2014, ACSM 2016):
 *   - Carb need is duration-tiered, NOT bodyweight-scaled. Intestinal absorption
 *     is the bottleneck, and it is independent of body mass.
 *   - Intensity picks where in the tier band you sit (easy → low, hard → high).
 *   - Gut tolerance is a hard MIN cap on top of the tier. Above-ceiling prescriptions
 *     cause GI failure in under-trained athletes.
 *   - Competition gets a small bump (top of tier), training stays mid-tier.
 *
 * Returned band is { min, max, target } in g/h.
 */

export type IntensityBucket = 'easy' | 'moderate' | 'hard';
export type GutTolerance = 'beginner' | 'trained' | 'elite';

export interface CarbTarget {
  min: number;
  max: number;
  target: number;
  rationale: string;
  /** The tier-level ceiling before gut cap is applied (for warnings/UX). */
  tierMaxBeforeGutCap: number;
  /** True if the gut ceiling shaved the target below what the tier would allow. */
  gutCapped: boolean;
}

export interface CarbTargetInput {
  durationHours: number;
  intensityPercent: number;
  gutTolerance: GutTolerance;
  isCompetition: boolean;
  /** Kept for API compatibility — intentionally unused. Carb targets do NOT scale with body weight. */
  bodyWeightKg?: number;
  /** User override in g/h. When set, replaces the tier target and raises the
   *  ceiling to match — the athlete is declaring their trained gut capacity.
   *  Clamped to [10, 120] for safety. */
  userOverrideGPerHour?: number;
}

interface Tier {
  min: number;
  max: number;
  label: string;
}

function intensityBucket(intensityPercent: number): IntensityBucket {
  if (intensityPercent < 0.65) return 'easy';
  if (intensityPercent < 0.80) return 'moderate';
  return 'hard';
}

/**
 * Map a duration+intensity to a carb tier (Matrix sheet "Carb & Fluid Tiers").
 *
 *   < 30 min:    0 (or mouth rinse)
 *   30–75 min:   0–30 (easy/mod, rinse at best); 20–30 if hard
 *   1–2 h:       30–60, any single source
 *   2–3 h:       60–90, glucose:fructose 2:1
 *   > 3 h easy:  60–90, G:F 1:0.8
 *   > 3 h hard:  90–120, G:F 1:0.8, requires gut training
 */
function pickTier(durationHours: number, intensity: IntensityBucket): Tier {
  if (durationHours < 0.5) {
    return { min: 0, max: 0, label: 'Under 30 min — no metabolic benefit from fuel ingestion.' };
  }
  if (durationHours < 1.25) {
    if (intensity === 'hard') {
      return { min: 20, max: 30, label: '30–75 min hard — small carbs or mouth rinse for CNS effect.' };
    }
    return { min: 0, max: 20, label: '30–75 min easy/moderate — mouth rinse optional; fuel is not required.' };
  }
  if (durationHours < 2) {
    return { min: 30, max: 60, label: '1–2 h — single-transportable CHO sufficient (SGLT1 below saturation).' };
  }
  if (durationHours < 3) {
    return { min: 60, max: 90, label: '2–3 h — multi-transportable CHO (glucose:fructose 2:1) above 60 g/h.' };
  }
  if (intensity === 'hard') {
    return { min: 90, max: 120, label: '>3 h hard — elite multi-transportable 90–120 g/h. Requires gut training.' };
  }
  return { min: 60, max: 90, label: '>3 h moderate/easy — multi-transportable 60–90 g/h (G:F 1:0.8).' };
}

function pickWithinTier(tier: Tier, intensity: IntensityBucket): number {
  if (tier.max === 0) return 0;
  if (intensity === 'easy') return tier.min;
  if (intensity === 'hard') return tier.max;
  return Math.round((tier.min + tier.max) / 2);
}

function gutCeilingFor(gut: GutTolerance): number {
  // Spec §2.3 / Matrix: conservative default 60 g/h for untrained guts.
  if (gut === 'beginner') return 60;
  if (gut === 'trained') return 90;
  return 120;
}

export function calculateCarbTarget(input: CarbTargetInput): CarbTarget {
  const { durationHours, intensityPercent, gutTolerance, isCompetition, userOverrideGPerHour } = input;

  const intensity = intensityBucket(intensityPercent);
  const tier = pickTier(durationHours, intensity);
  let gutCeiling = gutCeilingFor(gutTolerance);

  // Explicit user override — the athlete says "I can take 90 g/h, plan for that."
  // We respect it verbatim: it replaces the tier pick and lifts the gut ceiling
  // so downstream code doesn't silently trim it back. Clamp for safety only.
  if (userOverrideGPerHour != null && userOverrideGPerHour > 0 && tier.max > 0) {
    const override = Math.max(10, Math.min(120, Math.round(userOverrideGPerHour)));
    gutCeiling = Math.max(gutCeiling, override);
    const target = override;
    const min = Math.round(override * 0.85);
    const max = gutCeiling;
    return {
      min,
      max,
      target,
      rationale: `${tier.label} User override: ${override} g/h (gut ceiling raised to match).`,
      tierMaxBeforeGutCap: tier.max,
      gutCapped: false,
    };
  }

  // Target within the tier; race bumps by ~10% but never above tier.max.
  const raw = pickWithinTier(tier, intensity);
  const compBoost = isCompetition ? Math.round(raw * 1.1) : raw;
  const targetInTier = Math.min(tier.max, compBoost);

  // Gut ceiling as a MIN cap — spec §2.3.
  const target = Math.min(targetInTier, gutCeiling);
  const min = Math.min(tier.min, target);
  const max = Math.min(tier.max, gutCeiling);
  const gutCapped = targetInTier > gutCeiling || tier.max > gutCeiling;

  let rationale = tier.label;
  if (gutCapped && tier.max > 0) {
    rationale += ` Capped at gut ceiling of ${gutCeiling} g/h (${gutTolerance} tolerance) — raise via gradual gut training.`;
  }

  return {
    min,
    max,
    target,
    rationale,
    tierMaxBeforeGutCap: tier.max,
    gutCapped,
  };
}

/**
 * Progressive ramp over segments. Useful for plans that want to under-fuel
 * early and build. Sub-tiered because beginning on peak carbs spikes GI.
 */
export function calculateProgressiveCarbTargets(
  durationHours: number,
  peakTarget: number,
  numSegments = 4,
): { startHour: number; endHour: number; targetGPerHr: number }[] {
  const segments: { startHour: number; endHour: number; targetGPerHr: number }[] = [];
  const segmentDuration = durationHours / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const progress = numSegments > 1 ? i / (numSegments - 1) : 0;
    const multiplier = progress < 0.5 ? 0.7 + progress * 0.6 : 1.0;
    segments.push({
      startHour: Math.round(i * segmentDuration * 100) / 100,
      endHour: Math.round((i + 1) * segmentDuration * 100) / 100,
      targetGPerHr: Math.round(peakTarget * multiplier),
    });
  }

  return segments;
}
