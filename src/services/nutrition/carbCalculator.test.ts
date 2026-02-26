import { describe, it, expect } from 'vitest';
import { calculateCarbTarget, calculateProgressiveCarbTargets } from './carbCalculator';

describe('calculateCarbTarget', () => {
  const baseInput = {
    durationHours: 3,
    intensityPercent: 0.75,
    gutTolerance: 'trained' as const,
    isCompetition: false,
    bodyWeightKg: 70,
  };

  it('returns higher carbs for longer durations', () => {
    const short = calculateCarbTarget({ ...baseInput, durationHours: 0.5 });
    const medium = calculateCarbTarget({ ...baseInput, durationHours: 1.5 });
    const long = calculateCarbTarget({ ...baseInput, durationHours: 3 });

    expect(short.target).toBeLessThan(medium.target);
    expect(medium.target).toBeLessThan(long.target);
  });

  it('returns low targets for efforts under 1 hour', () => {
    const result = calculateCarbTarget({ ...baseInput, durationHours: 0.5 });
    expect(result.max).toBeLessThanOrEqual(30);
    expect(result.rationale).toContain('<1hr');
  });

  it('scales with gut tolerance', () => {
    const beginner = calculateCarbTarget({ ...baseInput, gutTolerance: 'beginner' });
    const trained = calculateCarbTarget({ ...baseInput, gutTolerance: 'trained' });
    const elite = calculateCarbTarget({ ...baseInput, gutTolerance: 'elite' });

    expect(beginner.target).toBeLessThan(trained.target);
    expect(trained.target).toBeLessThan(elite.target);
  });

  it('bumps targets for competition', () => {
    const training = calculateCarbTarget({ ...baseInput, isCompetition: false });
    const race = calculateCarbTarget({ ...baseInput, isCompetition: true });
    expect(race.target).toBeGreaterThan(training.target);
  });

  it('ensures min <= target <= max', () => {
    const result = calculateCarbTarget(baseInput);
    expect(result.min).toBeLessThanOrEqual(result.target);
    expect(result.target).toBeLessThanOrEqual(result.max);
  });

  it('adjusts for body weight', () => {
    const light = calculateCarbTarget({ ...baseInput, bodyWeightKg: 55 });
    const heavy = calculateCarbTarget({ ...baseInput, bodyWeightKg: 85 });
    expect(light.target).toBeLessThanOrEqual(heavy.target);
  });
});

describe('calculateProgressiveCarbTargets', () => {
  it('returns correct number of segments', () => {
    const segments = calculateProgressiveCarbTargets(4, 90, 4);
    expect(segments).toHaveLength(4);
  });

  it('ramps up carb targets over time', () => {
    const segments = calculateProgressiveCarbTargets(4, 90, 4);
    expect(segments[0].targetGPerHr).toBeLessThanOrEqual(segments[segments.length - 1].targetGPerHr);
  });

  it('starts at roughly 70% of peak', () => {
    const segments = calculateProgressiveCarbTargets(4, 100, 4);
    expect(segments[0].targetGPerHr).toBe(70);
  });

  it('covers full duration', () => {
    const segments = calculateProgressiveCarbTargets(4, 90, 4);
    expect(segments[0].startHour).toBe(0);
    expect(segments[segments.length - 1].endHour).toBe(4);
  });
});
