import { describe, it, expect } from 'vitest';
import { calculateHydration } from './hydrationCalculator';

describe('calculateHydration — spec §3 & Matrix Sheet "Carb & Fluid Tiers"', () => {
  const base = {
    bodyWeightKg: 70,
    durationHours: 3,
    temperatureCelsius: 20,
    humidity: 50,
    intensityPercent: 0.75,
    sweatRate: 'moderate' as const,
  };

  it('returns positive fluid and sodium targets', () => {
    const r = calculateHydration(base);
    expect(r.fluidMlPerHour).toBeGreaterThan(0);
    expect(r.sodiumMgPerHour).toBeGreaterThan(0);
    expect(r.totalFluidLiters).toBeGreaterThan(0);
    expect(r.totalSodiumMg).toBeGreaterThan(0);
  });

  it('applies heat multiplier ladder to sweat rate', () => {
    const mild = calculateHydration({ ...base, temperatureCelsius: 15 });
    const hot = calculateHydration({ ...base, temperatureCelsius: 32 });
    expect(hot.sweatRateLPerHour).toBeGreaterThan(mild.sweatRateLPerHour);
  });

  it('adds ~20% sweat rate when humidity > 70%', () => {
    const dry = calculateHydration({ ...base, humidity: 50 });
    const humid = calculateHydration({ ...base, humidity: 80 });
    expect(humid.sweatRateLPerHour).toBeCloseTo(dry.sweatRateLPerHour * 1.2, 1);
  });

  it('caps fluid at 800 ml/h for events > 4h (hyponatremia guardrail)', () => {
    const r = calculateHydration({
      ...base,
      durationHours: 6,
      temperatureCelsius: 34,
      humidity: 80,
      sweatRate: 'heavy',
    });
    expect(r.fluidMlPerHour).toBeLessThanOrEqual(800);
    expect(r.ultraCapApplied).toBe(true);
  });

  it('running has a higher baseline sweat rate than cycling at same conditions', () => {
    const run = calculateHydration({ ...base, sport: 'running' });
    const cycle = calculateHydration({ ...base, sport: 'cycling' });
    expect(run.sweatRateLPerHour).toBeGreaterThan(cycle.sweatRateLPerHour);
  });

  it('heat acclimatisation lowers sodium target (not sweat rate)', () => {
    const notAcclim = calculateHydration({ ...base, heatAcclimatised: false });
    const acclim = calculateHydration({ ...base, heatAcclimatised: true });
    expect(acclim.sweatRateLPerHour).toBe(notAcclim.sweatRateLPerHour);
    expect(acclim.sodiumMgPerHour).toBeLessThan(notAcclim.sodiumMgPerHour);
  });

  it('reproduces the Sheet 2 worked example end-to-end', () => {
    // cycling, 28°C, 60% RH, moderate intensity, 4h, medium [Na+], non-acclim.
    // Sheet says sweat_rate 1.35 L/h and sodium ~1,118 mg/h.
    const r = calculateHydration({
      bodyWeightKg: 72,
      durationHours: 4,
      temperatureCelsius: 28,
      humidity: 60,
      intensityPercent: 0.75,
      sweatRate: 'moderate',
      sport: 'cycling',
      sweatSodiumBucket: 'medium',
      heatAcclimatised: false,
      earlySeasonHeat: false,
    });
    expect(r.sweatRateLPerHour).toBeCloseTo(1.35, 2);
    expect(r.sodiumMgPerHour).toBeGreaterThan(1110);
    expect(r.sodiumMgPerHour).toBeLessThan(1125);
  });

  it('includes a rationale string', () => {
    const r = calculateHydration(base);
    expect(r.rationale.toLowerCase()).toContain('sweat rate');
  });
});
