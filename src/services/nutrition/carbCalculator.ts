/**
 * Evidence-based carbohydrate target calculator
 * Based on Jeukendrup (2014), Stellingwerff (2024), and current sports nutrition guidelines
 */

export interface CarbTarget {
  min: number;    // g/hr minimum
  max: number;    // g/hr maximum
  target: number; // g/hr recommended target
  rationale: string;
}

export interface CarbTargetInput {
  durationHours: number;
  intensityPercent: number;     // % of FTP (0.5-1.0)
  gutTolerance: 'beginner' | 'trained' | 'elite';
  isCompetition: boolean;
  bodyWeightKg: number;
}

export function calculateCarbTarget(input: CarbTargetInput): CarbTarget {
  const { durationHours, intensityPercent, gutTolerance, isCompetition, bodyWeightKg } = input;

  // Base targets from Jeukendrup (2014) guidelines
  let base: { min: number; max: number; target: number };
  let rationale: string;

  if (durationHours < 1) {
    base = { min: 0, max: 30, target: 20 };
    rationale = 'Short effort (<1hr): mouth rinse or small amount sufficient';
  } else if (durationHours < 2) {
    base = { min: 30, max: 60, target: 45 };
    rationale = 'Moderate duration (1-2hr): single transportable CHO sufficient';
  } else if (durationHours < 2.5) {
    base = { min: 60, max: 80, target: 70 };
    rationale = 'Extended effort (2-2.5hr): multiple transportable CHO recommended';
  } else {
    base = { min: 80, max: 120, target: 90 };
    rationale = 'Long effort (>2.5hr): maximal CHO intake with glucose:fructose ratio';
  }

  // Intensity adjustment (lower intensity = lower carb needs)
  const intensity = Math.max(0.5, Math.min(1.0, intensityPercent));
  const intensityMultiplier = 0.5 + (intensity * 0.5);

  // Gut tolerance adjustment
  const gutMultiplier =
    gutTolerance === 'beginner' ? 0.7 :
    gutTolerance === 'trained'  ? 1.0 :
                                  1.2;

  // Competition bump (10% higher for race vs training)
  const compMultiplier = isCompetition ? 1.1 : 1.0;

  // Body weight consideration (heavier athletes may tolerate more)
  const weightFactor = bodyWeightKg > 80 ? 1.05 : bodyWeightKg < 60 ? 0.95 : 1.0;

  const totalMultiplier = intensityMultiplier * gutMultiplier * compMultiplier * weightFactor;

  return {
    min: Math.round(base.min * totalMultiplier),
    max: Math.round(base.max * totalMultiplier),
    target: Math.round(base.target * totalMultiplier),
    rationale,
  };
}

/**
 * Calculate progressive carb targets that ramp up over the ride
 * Start lower, build up to peak intake rate
 */
export function calculateProgressiveCarbTargets(
  durationHours: number,
  peakTarget: number,
  numSegments: number = 4
): { startHour: number; endHour: number; targetGPerHr: number }[] {
  const segments: { startHour: number; endHour: number; targetGPerHr: number }[] = [];
  const segmentDuration = durationHours / numSegments;

  for (let i = 0; i < numSegments; i++) {
    // Ramp from 70% to 100% of peak in first half, maintain in second half
    const progress = i / (numSegments - 1);
    let multiplier: number;

    if (progress < 0.5) {
      multiplier = 0.7 + (progress * 0.6); // 70% → 100%
    } else {
      multiplier = 1.0; // maintain peak
    }

    segments.push({
      startHour: Math.round(i * segmentDuration * 100) / 100,
      endHour: Math.round((i + 1) * segmentDuration * 100) / 100,
      targetGPerHr: Math.round(peakTarget * multiplier),
    });
  }

  return segments;
}
