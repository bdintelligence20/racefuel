import { describe, it, expect } from 'vitest';
import { calculateCarbTarget, calculateProgressiveCarbTargets } from './carbCalculator';

describe('calculateCarbTarget — spec §2 tiers', () => {
  const base = {
    durationHours: 3,
    intensityPercent: 0.75,
    gutTolerance: 'trained' as const,
    isCompetition: false,
    bodyWeightKg: 70,
  };

  it('under 30 min: no fuel required', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 0.25 });
    expect(r.target).toBe(0);
    expect(r.max).toBe(0);
    expect(r.rationale).toMatch(/Under 30 min/);
  });

  it('30–75 min easy/moderate: mouth-rinse tier (0–20 g/h)', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 1, intensityPercent: 0.6 });
    expect(r.max).toBeLessThanOrEqual(20);
    expect(r.rationale).toMatch(/mouth rinse|rinse/i);
  });

  it('30–75 min hard: 20–30 g/h for CNS effect', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 1, intensityPercent: 0.9 });
    expect(r.min).toBeGreaterThanOrEqual(20);
    expect(r.max).toBeLessThanOrEqual(30);
  });

  it('1–2 h: single-transportable 30–60 g/h', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 1.5 });
    expect(r.min).toBeGreaterThanOrEqual(30);
    expect(r.max).toBeLessThanOrEqual(60);
  });

  it('2–3 h: multi-transportable 60–90 g/h', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 2.5 });
    expect(r.min).toBeGreaterThanOrEqual(60);
    expect(r.max).toBeLessThanOrEqual(90);
  });

  it('>3 h hard: 90–120 g/h for trained elites', () => {
    const r = calculateCarbTarget({ ...base, durationHours: 5, intensityPercent: 0.9, gutTolerance: 'elite' });
    expect(r.max).toBe(120);
  });

  it('gut ceiling is a MIN cap, not a multiplier', () => {
    // A 5h hard effort tier tops out at 120 g/h, but an untrained gut caps at 60.
    const beginner = calculateCarbTarget({ ...base, durationHours: 5, intensityPercent: 0.9, gutTolerance: 'beginner' });
    expect(beginner.target).toBeLessThanOrEqual(60);
    expect(beginner.max).toBeLessThanOrEqual(60);
    expect(beginner.gutCapped).toBe(true);
  });

  it('does NOT scale with body weight', () => {
    const light = calculateCarbTarget({ ...base, bodyWeightKg: 55 });
    const heavy = calculateCarbTarget({ ...base, bodyWeightKg: 95 });
    expect(light.target).toBe(heavy.target);
    expect(light.max).toBe(heavy.max);
  });

  it('competition bumps target slightly but never above tier max', () => {
    const training = calculateCarbTarget({ ...base, durationHours: 2.5, isCompetition: false });
    const race = calculateCarbTarget({ ...base, durationHours: 2.5, isCompetition: true });
    expect(race.target).toBeGreaterThanOrEqual(training.target);
    expect(race.target).toBeLessThanOrEqual(race.max);
  });

  it('min <= target <= max', () => {
    const r = calculateCarbTarget(base);
    expect(r.min).toBeLessThanOrEqual(r.target);
    expect(r.target).toBeLessThanOrEqual(r.max);
  });
});

describe('calculateProgressiveCarbTargets', () => {
  it('returns correct number of segments', () => {
    expect(calculateProgressiveCarbTargets(4, 90, 4)).toHaveLength(4);
  });

  it('ramps from ~70% to peak', () => {
    const s = calculateProgressiveCarbTargets(4, 100, 4);
    expect(s[0].targetGPerHr).toBe(70);
    expect(s[s.length - 1].targetGPerHr).toBe(100);
  });

  it('covers full duration', () => {
    const s = calculateProgressiveCarbTargets(4, 90, 4);
    expect(s[0].startHour).toBe(0);
    expect(s[s.length - 1].endHour).toBe(4);
  });
});
